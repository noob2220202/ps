#!/usr/bin/env bash
# serve.sh 로 띄운 백엔드/프론트엔드 종료.  bash tools/stop.sh [backend|frontend]
# serve.sh 와 같은 WOORI_WEB_PORT / WOORI_API_PORT 로 부른다 (기본 5273 / 4100). 그 포트 쌍만 끈다.
# 떠 있는 것이 없어도 오류가 아니다 (종료 코드 0).
set -u
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$TOOLS/out/logs"
WEB_PORT="${WOORI_WEB_PORT:-5273}"
API_PORT="${WOORI_API_PORT:-4100}"
which="${1:-all}"
case "$which" in all | backend | frontend) ;; *) echo "사용법: bash tools/stop.sh [backend|frontend]"; exit 2 ;; esac

stop_one() { # $1 name $2 port
  local name="$1" port="$2" pid pidfile="$LOGS/$1-$2.pid" what="떠 있지 않음"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    # serve.sh 가 새 그룹으로 띄웠으므로 pid = 프로세스 그룹 id → 그룹 전체(npm/node/esbuild 자식 포함) 종료.
    # 그룹을 못 만든 경우(nohup 만으로 띄움)는 pid 하나만 끄고, 남은 자식은 아래 포트 정리가 맡는다
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 -- "-$pid" 2>/dev/null || break
      sleep 0.3
    done
    kill -KILL -- "-$pid" 2>/dev/null
    rm -f "$pidfile"
    what="종료"
  fi
  # 남아 있으면 포트 기준으로 정리 (serve.sh 밖에서 띄운 것도 포함). 리눅스는 fuser, macOS 는 lsof
  # (macOS fuser 는 `port/tcp` 를 모른다). lsof 는 -sTCP:LISTEN 으로 듣는 쪽만 — 빼면 그 포트에 붙은 브라우저·Playwright 도 끈다
  if command -v fuser >/dev/null 2>&1 && fuser "$port/tcp" >/dev/null 2>&1; then
    fuser -k -TERM "$port/tcp" >/dev/null 2>&1
    sleep 0.5
    what="종료"
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)"
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086 # pid 여러 개를 낱낱이 넘긴다
      kill -TERM $pids 2>/dev/null
      sleep 0.5
      what="종료"
    fi
  fi
  echo "[stop] $name (port $port) $what"
}

if [ "$which" = all ] || [ "$which" = frontend ]; then stop_one frontend "$WEB_PORT"; fi
if [ "$which" = all ] || [ "$which" = backend ]; then stop_one backend "$API_PORT"; fi
exit 0
