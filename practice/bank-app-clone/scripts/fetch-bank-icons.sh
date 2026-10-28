#!/usr/bin/env bash
# 각 은행 공식 앱의 Google Play 아이콘을 받아 src/assets/local/bank-<코드>.png 로 저장한다.
# 결과물은 .gitignore 처리돼 커밋되지 않는다 (은행 로고는 상표라 공개 저장소에 올리면 안 됨).
#
#   ./scripts/fetch-bank-icons.sh          # 없는 것만 받기 (영상에서 잘라낸 bank-nh.png 등은 그대로)
#   FORCE=1 ./scripts/fetch-bank-icons.sh  # 전부 새로 받기
#
# 필요: curl. 받은 뒤 npm run build 해야 화면에 반영된다 (이미지는 빌드할 때 묶임).
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/src/assets/local"
SIZE="${SIZE:-192}" # 화면에선 최대 44px로 그리므로 3~4배면 충분
mkdir -p "$OUT"

# 은행 코드(server/banks.mjs) → Play 스토어 패키지 이름
APPS=(
  "kb       com.kbstar.kbbank"        # KB스타뱅킹
  "shinhan  com.shinhan.sbanking"     # 신한 SOL뱅크
  "woori    com.wooribank.smart.npib" # 우리WON뱅킹
  "hana     com.hanabank.oqf"         # 하나원큐
  "nh       nh.smart.banking"         # NH스마트뱅킹
  "ibk      com.ibk.android.ionebank" # i-ONE Bank
  "toss     viva.republica.toss"      # 토스
  "kbank    com.kbankwith.smartbank"  # 케이뱅크
  "post     com.epost.psf.sdsi"       # 우체국뱅킹
  "mg       com.smg.spbs"             # MG더뱅킹
  "sc       com.scbank.ma30"          # SC제일은행 모바일뱅킹
  "suhyup   com.suhyup.pesmb"         # 수협 헤이뱅크
)

for row in "${APPS[@]}"; do
  read -r code pkg <<<"$row"
  file="$OUT/bank-$code.png"
  if [[ -f "$file" && -z "${FORCE:-}" ]]; then
    echo "건너뜀  $code (이미 있음)"
    continue
  fi
  # 앱 상세 페이지의 og:image 가 앱 아이콘. 주소 끝 =s<크기> 로 해상도를 고를 수 있다
  icon=$(curl -fsSL "https://play.google.com/store/apps/details?id=$pkg&hl=ko&gl=KR" |
    grep -o '<meta property="og:image" content="[^"]*' | head -1 | sed 's/.*content="//; s/=.*$//')
  if [[ -z "$icon" ]]; then
    echo "실패    $code ($pkg 페이지에서 아이콘을 못 찾음)" >&2
    continue
  fi
  curl -fsSL "$icon=s$SIZE" -o "$file"
  echo "받음    $code ← $pkg"
done
