#!/usr/bin/env python3
"""다크 화면에서 잘라 온 그림(바탕이 어두운 사각형)을 라이트모드용 *-light.png 로 바꿈.

  python3 scripts/nh-crops/light-variants.py

라이트모드 녹화에 이 화면들(송금 완료·받는 분 확인·계좌 등록)이 없어서, 그림을 다시 자르지 않고 바탕만 갈아 끼움:
픽셀마다 가장 가까운 '다크 바탕색'을 찾고, 그 바탕과의 거리로 그림이 얼마나 덮였는지(a)를 어림해서
그림 색 = 바탕 + (픽셀 − 바탕) / a 를 '라이트 바탕색' 위에 다시 섞음. 바탕과 많이 다른(진한) 부분은 그대로 남음.
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
T = 150.0  # 바탕과 이만큼(RGB 거리) 다르면 그림이 완전히 덮은 것으로 (작으면 가장자리에 어두운 테가 남음)

# 이름: [(다크 바탕, 라이트 바탕), ...]  — 첫 번째가 화면 바탕, 나머지는 그림 안의 타일·판 색
JOBS = {
    "nh-done-mark": [((24, 23, 28), (255, 255, 255))],
    "nh-coin": [((23, 22, 27), (255, 255, 255))],
    "nh-msg-card": [((24, 23, 28), (255, 255, 255)), ((30, 38, 50), (244, 245, 250))],
    "nh-msg-kakao": [((24, 23, 28), (255, 255, 255)), ((30, 38, 50), (244, 245, 250))],
    "nh-msg-mms": [((24, 23, 28), (255, 255, 255)), ((30, 38, 50), (244, 245, 250))],
    "nh-register-notice": [((24, 23, 28), (255, 255, 255))],
    "nh-shield": [((41, 52, 63), (255, 255, 255))],  # 받는 분 확인 시트 바탕 #29343f
}


def remap(a, pairs):
    dark = np.array([d for d, _ in pairs], float)
    light = np.array([l for _, l in pairs], float)
    d = np.linalg.norm(a[..., None, :] - dark[None, None], axis=-1)  # H W K
    k = d.argmin(-1)
    b = dark[k]
    L = light[k]
    al = np.clip(d.min(-1) / T, 0, 1)[..., None]
    fg = np.where(al > 0, b + (a - b) / np.maximum(al, 1e-3), b)
    return np.clip(L * (1 - al) + fg * al, 0, 255)


def main():
    for name, pairs in JOBS.items():
        src = OUT / f"{name}.png"
        if not src.exists():
            continue
        im = Image.open(src).convert("RGB")
        out = remap(np.asarray(im).astype(float), pairs)
        Image.fromarray(out.round().astype(np.uint8)).save(OUT / f"{name}-light.png")
        print(f"{name}-light.png {im.size}")


if __name__ == "__main__":
    main()
