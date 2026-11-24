#!/usr/bin/env bash
# NH올원뱅크 APK (연습용, 배포하지 않음) — 서버·PC·네트워크 없이 폰 혼자 도는 로컬 모드 빌드.
#
#   bash apk-allone/build-apk.sh        # (= npm run apk:allone) → apk-allone/out/NH-allone-debug.apk
#
# 1) 웹 빌드  vite build --mode allone-apk → apk-allone/www  (server/*.mjs 를 웹뷰 안에서 돌리도록 껍데기를 끼운다 — src/apk/, vite.config.ts)
# 2) npx cap sync android              (www → android/app/src/main/assets/public)
# 3) gradle assembleDebug              (versionCode = 빌드 시각(2025-01-01 UTC 부터 분), 서명 = 저장소의 고정 연습용 키 apk-allone/android/app/allone-debug.keystore
#                                       → 새 빌드가 이전 설치 위에 덮어 깔리고 폰에 저장된 데이터가 그대로 남는다)
# 4) 복사 → apk-allone/out/NH-allone-debug.apk (gitignore)
#
# 필요: Node 22, JDK 21, Android SDK (platforms;android-36 · build-tools;35.0.0, 라이선스 수락) — ANDROID_HOME (기본 /opt/android-sdk).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT_DIR="$HERE/out"
APK_NAME="NH-allone-debug.apk"
WORKERS="${ALLONE_GRADLE_WORKERS:-2}"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [ ! -d "$ANDROID_HOME/platforms" ] || [ ! -d "$ANDROID_HOME/build-tools" ]; then
  echo "Android SDK 가 없다: $ANDROID_HOME (platforms;android-36, build-tools;35.0.0)" >&2
  exit 1
fi

cd "$ROOT"
if [ ! -d node_modules/@capacitor/cli ] || [ ! -d node_modules/sql.js ]; then
  echo "== npm install"
  npm install
fi

echo "== 1/4 웹 빌드 (allone-apk → apk-allone/www)"
npx vite build --mode allone-apk

echo "== 2/4 cap sync android"
cd "$HERE"
npx cap sync android

echo "== 3/4 gradle assembleDebug (workers $WORKERS)"
cd "$HERE/android"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > local.properties
WANT="$(sed -n 's/.*gradle-\([0-9.]*\)-.*/\1/p' gradle/wrapper/gradle-wrapper.properties)"
GRADLE="./gradlew"
if command -v gradle >/dev/null 2>&1 && gradle --version 2>/dev/null | grep -q "^Gradle $WANT\$"; then
  GRADLE="gradle"
fi
VERSION_EPOCH=1735689600
VERSION_CODE="$(( ($(date +%s) - VERSION_EPOCH) / 60 ))"
echo "   versionCode $VERSION_CODE"
"$GRADLE" --no-daemon --max-workers="$WORKERS" -PalloneVersionCode="$VERSION_CODE" assembleDebug

echo "== 4/4 복사"
mkdir -p "$OUT_DIR"
cp app/build/outputs/apk/debug/app-debug.apk "$OUT_DIR/$APK_NAME"
ls -la "$OUT_DIR/$APK_NAME"
sha256sum "$OUT_DIR/$APK_NAME"
