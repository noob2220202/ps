#!/usr/bin/env bash
# 화면 녹화(다크 모드)와 홈 스크린샷(라이트 모드)에서 실제 에셋을 잘라 src/assets/local/ 에 저장한다.
# 결과물은 .gitignore 처리돼 커밋되지 않는다 (브랜드 로고/광고 사진은 공개 저장소에 올리면 안 됨).
#
#   ./scripts/extract-assets.sh 화면녹화.mp4 [라이트모드_홈_스크린샷.jpg] [라이트모드_홈_녹화2.mp4] [배너_스크린샷2.jpg]
#
# 필요: ffmpeg. 좌표는 "원본 폭 기준 비율"로 계산하므로 같은 화면을 더 높은 해상도로 찍어도 동작한다.
# (좌표/시간은 이 프로젝트를 만들 때 쓴 녹화 기준. 다른 녹화면 아래 표의 숫자만 고치면 됨)
set -euo pipefail

VIDEO="${1:?사용법: $0 화면녹화.mp4 [스크린샷.jpg]}"
SHOT="${2:-}"
VIDEO2="${3:-}" # 라이트 모드 홈을 끝까지 스크롤한 녹화 (배너 캐러셀, 바로가기, 광고)
SHOT2="${4:-}"  # 배너가 보이는 라이트 모드 스크린샷
OUT="$(cd "$(dirname "$0")/.." && pwd)/src/assets/local"
mkdir -p "$OUT"

# crop 필터: 기준폭(BASE) 좌표 → 실제 해상도로 비율 변환
crop() { # BASE X Y W H
  echo "crop=w=iw*$4/$1:h=iw*$5/$1:x=iw*$2/$1:y=iw*$3/$1"
}
# 원 밖을 투명하게 (안티앨리어싱: 경계 1px을 부드럽게)
CIRCLE="format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(W/2-hypot(X-(W-1)/2,Y-(H-1)/2)+0.5,0,1)'"
# 밝은 회색/흰 배경을 투명하게 → 어떤 테마 배경 위에도 올릴 수 있음
KEY_LIGHT="format=rgba,colorkey=0xF5F5F5:0.07:0.05"
# 노란 배경의 검은 글자 → 글자만 남기고 투명하게 (초록 채널이 노랑≈222, 검정≈0 이라 그걸로 진하기 계산)
KEY_YELLOW="format=rgba,geq=r=17:g=17:b=17:a='255*clip((222-g(X,Y))/170,0,1)'"
# 가장자리를 서서히 투명하게 (사각형으로 잘라낸 일러스트를 배경 그라데이션에 자연스럽게 녹임)
FEATHER="format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(min(X,W-1-X)/(W*0.14),0,1)*clip(min(Y,H-1-Y)/(H*0.14),0,1)'"

# extract 이름 입력파일 시간(초|-) 기준폭 x y w h 배율 [추가필터]
extract() {
  local name=$1 input=$2 t=$3 base=$4 x=$5 y=$6 w=$7 h=$8 scale=$9 extra=${10:-}
  local vf="$(crop "$base" "$x" "$y" "$w" "$h"),scale=iw*$scale:ih*$scale:flags=lanczos"
  [ -n "$extra" ] && vf="$vf,$extra"
  local seek=()
  [ "$t" != "-" ] && seek=(-ss "$t")
  ffmpeg -v error -y "${seek[@]}" -i "$input" -frames:v 1 -vf "$vf" "$OUT/$name"
  echo "  ✓ $name"
}

echo "▶ 화면 녹화에서 (기준폭 480)"
extract banner-and2ble.jpg            "$VIDEO" 3.5   480  76 746 329 200 2
extract album-logo.png      "$VIDEO" 3.5   480 170 625 142  47 4 "$KEY_YELLOW"
extract friends.png         "$VIDEO" 20.0  480 126  98 223 147 2 "$FEATHER"
extract friends-avatar.png  "$VIDEO" 22.4  480 204 151  72  72 2 "$CIRCLE"
extract hand-tile.png       "$VIDEO" 20.0  480  48 343  45  45 3
extract coin.png            "$VIDEO" 35.0  480  36  74  26  26 4 "$CIRCLE"
extract ai-saving.dark.png  "$VIDEO" 35.0  480  43 668  44  44 3 "$CIRCLE"
extract card.dark.png       "$VIDEO" 11.75 480  48 893  36  50 3

if [ -n "$SHOT" ]; then
  echo "▶ 라이트 모드 스크린샷에서 (기준폭 720, 더 선명)"
  extract mini-b.png          "$SHOT" - 720  64  181 68 68 2 "$CIRCLE"
  extract hand.png            "$SHOT" - 720  64  369 68 68 2 "$KEY_LIGHT"
  extract bank-nh.png         "$SHOT" - 720  64  489 68 68 2 "$CIRCLE"
  extract ai-saving.light.png "$SHOT" - 720  64  607 68 68 2 "$CIRCLE"
  extract card.light.png      "$SHOT" - 720  72  972 52 74 2
  extract tmoney.png          "$SHOT" - 720  64 1191 68 68 2 "$KEY_LIGHT"
  extract star.png            "$SHOT" - 720 154  410 32 32 3 "$KEY_LIGHT"
else
  echo "▷ 스크린샷이 없어서 홈 아이콘(손/농협/티머니 등)은 기본 에셋을 씁니다"
fi

if [ -n "$VIDEO2" ]; then
  echo "▶ 두 번째 녹화에서 (라이트 모드 배너/하단 영역)"
  # 흰 배경 위의 이미지라 라이트 모드 전용(.light) — 다크 모드에선 기본 에셋이 쓰임
  extract banner-mcard.light.png       "$VIDEO2" 0.0 480 318 160 104  92 2
  extract banner-volunteer.light.png   "$VIDEO2" 1.2 480 312 148 122 106 2
  extract shortcut-timetable.light.png "$VIDEO2" 8.0 480  45 494  34  34 3
  extract shortcut-subsidy.light.png   "$VIDEO2" 8.0 480  45 557  34  34 3
  extract shortcut-id.light.png        "$VIDEO2" 8.0 480  45 620  34  34 3
  extract shortcut-mini26.light.png    "$VIDEO2" 8.0 480  45 683  34  34 3
  extract ad-shoe.light.png            "$VIDEO2" 8.0 480 296 820 144  76 2
fi
if [ -n "$SHOT2" ]; then
  extract banner-pcbang.light.png      "$SHOT2"  -  720 486 228 150 154 1
fi

echo "완료 → $OUT  (npm run build 다시 하면 반영)"
