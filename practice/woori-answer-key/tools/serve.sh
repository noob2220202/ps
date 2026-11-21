#!/usr/bin/env bash
# 백엔드 + 프론트엔드(Vite) 를 백그라운드로 띄운다. 이미 떠 있으면 건드리지 않음(멱등).
#   bash tools/serve.sh            # 둘 다
#   bash tools/serve.sh backend    # 하나만
#   bash tools/serve.sh frontend
#
# 환경 변수 (포트를 바꾸면 여러 쌍을 동시에 띄울 수 있다):
#   WOORI_WEB_PORT  Vite 포트 (기본 5273)
#   WOORI_API_PORT  백엔드 포트 (기본 4100). Vite 의 /api 프록시도 이 포트로 간다 (vite.config 가 읽음)
#   WOORI_DB_PATH   SQLite 파일 (기본 backend/woori.db). 없으면 백엔드가 시드로 채운다
#   WOORI_NOW, WOORI_DISABLE_DEV 는 백엔드에 그대로 전달된다 (환경에 있으면)
#   SERVE_TIMEOUT   포트가 응답할 때까지 기다리는 초 (기본 90)
# 로그/PID: tools/out/logs/{backend-<API포트>,frontend-<WEB포트>}.{log,pid}
# 종료: 같은 환경 변수로 bash tools/stop.sh
# backend/ · frontend/ 가 아직 없으면(package.json 없음) 그 쪽은 건너뛰고 알린다 (종료 코드 0). 있는데 못 띄우면 1.
set -u
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$TOOLS")"
LOGS="$TOOLS/out/logs"
mkdir -p "$LOGS"
TIMEOUT="${SERVE_TIMEOUT:-90}"
WEB_PORT="${WOORI_WEB_PORT:-5273}"
API_PORT="${WOORI_API_PORT:-4100}"
DB_PATH="${WOORI_DB_PATH:-$ROOT/backend/woori.db}"
# 상대 경로는 저장소 루트 기준으로 (백엔드는 backend/ 에서 돌아 상대 경로를 거기 기준으로 풀어 버린다)
case "$DB_PATH" in /*) ;; *) DB_PATH="$ROOT/$DB_PATH" ;; esac

# 새 프로세스 그룹으로 띄우는 앞단 (pid = 그룹 id 라야 stop.sh 가 자식(esbuild 등)까지 한 번에 끈다).
# util-linux setsid 가 없으면 (macOS, 작은 리눅스 이미지) perl setpgrp → python3 os.setsid → 그것도 없으면 nohup 만
# (그때는 stop.sh 가 pid 하나와 포트 기준으로 끈다). perl 을 python3 보다 먼저: macOS 의 python3 는 설치 안내만 띄우는 자리표시일 수 있다.
if command -v setsid >/dev/null 2>&1; then
  NEWGRP=(setsid nohup)
elif command -v perl >/dev/null 2>&1; then
  NEWGRP=(perl -e 'setpgrp(0, 0); exec @ARGV or die "exec $ARGV[0]: $!\n"' nohup)
elif command -v python3 >/dev/null 2>&1; then
  NEWGRP=(python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' nohup)
else
  NEWGRP=(nohup)
fi

listening() { # $1 port -> 0 if something answers HTTP on localhost:$1
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$1/" 2>/dev/null && return 0
  curl -s -o /dev/null --max-time 2 "http://localhost:$1/" 2>/dev/null && return 0
  return 1
}

ensure_deps() { # $1 dir
  if [ ! -d "$1/node_modules" ]; then
    echo "[serve] npm install ($1)"
    (cd "$1" && npm install --no-audit --no-fund >>"$LOGS/npm-install.log" 2>&1) || {
      echo "[serve] npm install 실패: $LOGS/npm-install.log"; return 1; }
  fi
}

STARTED=""
start() { # $1 name $2 port $3 dir $4.. command   (env 는 호출하는 쪽에서 붙임)
  local name="$1" port="$2" dir="$3"; shift 3
  local base="$LOGS/$name-$port"
  if [ ! -f "$dir/package.json" ]; then
    echo "[serve] $name: ${dir#"$ROOT"/}/package.json 없음 — 아직 만들지 않았으므로 건너뜀"; return 0
  fi
  if listening "$port"; then
    echo "[serve] $name: 이미 실행 중 (port $port)"
    return 0
  fi
  ensure_deps "$dir" || return 1
  echo "[serve] $name 시작 (port $port) -> $base.log"
  rm -f "$base.pid" # 지난번 pid 가 남아 있으면 wait_port 의 빨리 실패 검사가 속는다
  # setsid 가 fork 할 수도 있어서 $! 대신 그룹 리더가 자기 pid(= 그룹 id)를 직접 적는다.
  # 서브셸의 표준 입출력을 처음부터 로그로 돌리고 앞단(NEWGRP)을 exec 한다 — 그래야 출력을 파이프로 받는 셸
  # (`bash tools/serve.sh | cat`, CI, 에이전트 도구)에서도 serve.sh 가 끝나면 호출이 바로 돌아온다.
  (cd "$dir" || exit 1; exec "${NEWGRP[@]}" sh -c 'echo $$ >"$0"; exec "$@"' "$base.pid" "$@") >"$base.log" 2>&1 </dev/null &
  STARTED="$STARTED $name"
}

wait_port() { # $1 name $2 port
  local name="$1" port="$2" i=0 pid
  while ! listening "$port"; do
    i=$((i + 1))
    # 빨리 실패: 2초가 지나도 pid 파일이 없거나(띄우기부터 실패) 프로세스가 이미 끝났으면(포트 충돌 등) TIMEOUT 까지 기다리지 않는다
    if [ "$i" -gt 2 ]; then
      pid="$(cat "$LOGS/$name-$port.pid" 2>/dev/null)"
      if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "[serve] $name: 프로세스가 뜨지 않았거나 끝났음 (port $port). 로그 마지막 20줄:"
        tail -n 20 "$LOGS/$name-$port.log" 2>/dev/null
        rm -f "$LOGS/$name-$port.pid"
        return 1
      fi
    fi
    if [ "$i" -gt "$TIMEOUT" ]; then
      echo "[serve] $name: ${TIMEOUT}초 안에 port $port 응답 없음. 로그 마지막 20줄:"
      tail -n 20 "$LOGS/$name-$port.log" 2>/dev/null
      return 1
    fi
    sleep 1
  done
  echo "[serve] $name: OK  http://localhost:$port"
}

# 백엔드로 넘길 환경 변수 (있을 때만)
BACKEND_ENV=(PORT="$API_PORT" WOORI_API_PORT="$API_PORT" WOORI_DB_PATH="$DB_PATH")
[ -n "${WOORI_NOW:-}" ] && BACKEND_ENV+=(WOORI_NOW="$WOORI_NOW")
[ -n "${WOORI_DISABLE_DEV:-}" ] && BACKEND_ENV+=(WOORI_DISABLE_DEV="$WOORI_DISABLE_DEV")

which="${1:-all}"
case "$which" in all | backend | frontend) ;; *) echo "사용법: bash tools/serve.sh [backend|frontend]"; exit 2 ;; esac
rc=0
if [ "$which" = all ] || [ "$which" = backend ]; then
  start backend "$API_PORT" "$ROOT/backend" \
    env "${BACKEND_ENV[@]}" node --disable-warning=ExperimentalWarning server.js || rc=1
fi
if [ "$which" = all ] || [ "$which" = frontend ]; then
  start frontend "$WEB_PORT" "$ROOT/frontend" \
    env WOORI_WEB_PORT="$WEB_PORT" WOORI_API_PORT="$API_PORT" ./node_modules/.bin/vite --port "$WEB_PORT" --strictPort || rc=1
fi
case " $STARTED " in *" backend "*) wait_port backend "$API_PORT" || rc=1 ;; esac
case " $STARTED " in *" frontend "*) wait_port frontend "$WEB_PORT" || rc=1 ;; esac
[ "$rc" = 0 ] && [ -n "$STARTED" ] && [ "$which" = all ] && echo "[serve] DB: $DB_PATH  ·  /api → :$API_PORT (vite.config 가 WOORI_API_PORT 를 읽어야 함)"
exit $rc
