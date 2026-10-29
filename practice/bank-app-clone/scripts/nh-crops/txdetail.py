#!/usr/bin/env python3
"""콕뱅크 '거래 상세' 화면 그림 자르기 (담당: txdetail). 결과는 src/assets/local/nh-*.png

  python3 scripts/nh-crops/txdetail.py --detail-out 출금상세_아래스크롤.jpg

출금 거래상세를 맨 아래로 내린 스크린샷(720px, 1 dp = 1.875 px, 바탕 #18171c 단색)에서
'빠른송금 등록'·'동일내역 송금' 동그라미(지름 48dp = 90px, 바탕 #1f2933)를 동그라미 크기 그대로 자름.
- 동그라미 경계가 반 픽셀에 있음: 왼쪽 동그라미 x 214.5–304.5, 오른쪽 414.5–504.5, 위아래 y 1205.5–1295.5 px
  → 반 픽셀만큼 옮겨서(bicubic) 90×90 으로 자름 → 화면에 48×48 CSS px 로 놓으면 원래 크기
- 네 귀퉁이는 페이지 바탕(#18171c) 그대로 둠 (화면 바탕과 같아서 이음새가 안 보임)
- nh-quick-register.png  노란 번개 + 더하기
- nh-same-send.png       청록 동전(₩) + 보라 화살표
"""
import argparse
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"


def crop_half(img, x0, y0, size):
    """(x0, y0) 가 소수일 수 있는 size×size 영역을 잘라냄 (bicubic)"""
    return img.transform((size, size), Image.AFFINE, (1, 0, x0, 0, 1, y0), resample=Image.BICUBIC)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--detail-out", required=True, help="출금 거래상세 맨 아래 스크린샷 (720×1600)")
    ap.add_argument("--light-frame", help="라이트모드 녹화의 거래상세 맨 아래 프레임 (480×1066) → *-light.png")
    a = ap.parse_args()
    if a.light_frame:  # 라이트모드: 같은 자리(dp 114.4 / 221.1, 642.9, 48)를 480px 프레임에서 (1 dp = 1.25 px)
        lf = Image.open(a.light_frame).convert("RGB")
        for name, x in (("nh-quick-register-light.png", 114.4), ("nh-same-send-light.png", 221.1)):
            x0, y0 = round(x * 1.25), round(642.9 * 1.25)
            lf.crop((x0, y0, x0 + 60, y0 + 60)).save(OUT / name)
    img = Image.open(a.detail_out).convert("RGB")
    assert img.width == 720, "720px 스크린샷이어야 함"
    for name, x0 in (("nh-quick-register.png", 214.5), ("nh-same-send.png", 414.5)):
        out = crop_half(img, x0, 1205.5, 90)
        out.save(OUT / name)
        print(f"{name:24s} {out.width}x{out.height}")


if __name__ == "__main__":
    main()
