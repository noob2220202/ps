#!/usr/bin/env bash
# WON 답지 APK (연습용, 배포하지 않음) — 서버·PC·네트워크 없이 폰 혼자 도는 로컬 모드 빌드.
#
#   bash tools/build-apk.sh            # → tools/out/apk/WON-answer-key-debug.apk
#
# 1) 웹 빌드  VITE_WOORI_LOCAL=1 vite build → frontend/dist-apk  (backend 순수 로직을 sql.js 위에서 앱 안에 품는다 — frontend/src/WooriLocal.ts)
# 2) npx cap sync android              (dist-apk → android/app/src/main/assets/public, 플러그인 @capacitor/app)
# 3) gradle assembleDebug              (frontend/android, --max-workers=$WOORI_GRADLE_WORKERS 기본 2, versionCode = git 커밋 수,
#                                       서명 = 저장소의 고정 연습용 키 frontend/android/app/woori-debug.keystore)
# 4) 복사 → tools/out/apk/WON-answer-key-debug.apk (gitignore)
#
# 필요: Node 22, JDK 21, Android SDK (platforms;android-36 · build-tools;35.0.0, 라이선스 수락) — ANDROID_HOME (기본 /opt/android-sdk).
# Gradle: PATH 의 gradle 이 래퍼와 같은 버전이면 그걸, 아니면 ./gradlew (처음 한 번 배포본을 받는다).
# 웹 답지(dist/, Express 백엔드)는 건드리지 않는다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FE="$ROOT/frontend"
OUT_DIR="$ROOT/tools/out/apk"
APK_NAME="WON-answer-key-debug.apk"
WORKERS="${WOORI_GRADLE_WORKERS:-2}"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [ ! -d "$ANDROID_HOME/platforms" ] || [ ! -d "$ANDROID_HOME/build-tools" ]; then
  echo "Android SDK 가 없다: $ANDROID_HOME (platforms;android-36, build-tools;35.0.0 — frontend/README.md 'APK')" >&2
  exit 1
fi

cd "$FE"
if [ ! -d node_modules/@capacitor/cli ] || [ ! -d node_modules/sql.js ]; then
  echo "== npm install (frontend)"
  npm install
fi

echo "== 1/4 웹 빌드 (로컬 모드, VITE_WOORI_LOCAL=1 → dist-apk)"
VITE_WOORI_LOCAL=1 npx vite build

echo "== 2/4 cap sync android"
npx cap sync android

echo "== 3/4 gradle assembleDebug (workers $WORKERS)"
cd "$FE/android"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > local.properties
WANT="$(sed -n 's/.*gradle-\([0-9.]*\)-.*/\1/p' gradle/wrapper/gradle-wrapper.properties)"
GRADLE="./gradlew"
if command -v gradle >/dev/null 2>&1 && gradle --version 2>/dev/null | grep -q "^Gradle $WANT\$"; then
  GRADLE="gradle"
fi
# versionCode = git 커밋 수 (새 빌드가 이전 설치 위로 덮어 깔리게). git 이 없으면 1
VERSION_CODE="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)"
echo "   versionCode $VERSION_CODE"
"$GRADLE" --no-daemon --max-workers="$WORKERS" -PwooriVersionCode="$VERSION_CODE" assembleDebug

echo "== 4/4 복사"
mkdir -p "$OUT_DIR"
cp app/build/outputs/apk/debug/app-debug.apk "$OUT_DIR/$APK_NAME"
ls -la "$OUT_DIR/$APK_NAME"
sha256sum "$OUT_DIR/$APK_NAME"
