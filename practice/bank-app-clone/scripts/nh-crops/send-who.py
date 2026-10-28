#!/usr/bin/env python3
"""콕송금 '누구에게 보낼까요?' 화면(담당: send-who)의 은행 아이콘을 녹화1에서 잘라 src/assets/local/nh-sendwho-*.png 로 저장.

  python3 scripts/nh-crops/send-who.py 녹화1.mp4

- 최근송금/내계좌/자주쓰는 목록의 은행 아이콘은 36dp 둥근 사각형(모서리 약 11dp). 녹화(480px, 1dp = 1.25px)에서
  45×45px 로 자름. 맨 위 출금계좌 아이콘(24dp)은 30×30px. 화면이 멈춰 있는 구간의 모든 프레임을 평균해서 압축 잡음을 줄임.
- 바탕(시트 #28333e / 페이지 #17161b)이 보이는 네 모서리는 둥근 사각형 마스크로 투명하게 하고, 경계 픽셀은 바탕색을 빼서 원래 색으로 되돌림.
필요: ffmpeg, Pillow, numpy
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SHEET = (40, 51, 62)  # 녹화 속 시트 바탕
PAGE = (23, 22, 27)  # 녹화 속 페이지 바탕

# (파일 이름, 멈춘 구간 시작, 끝, 아이콘 왼쪽 위 x, y, 한 변 px, 모서리 반경 px, 바탕)  — 녹화1 기준 (2026-10-28)
# 목록 아이콘: 36dp = 45px, 반경 14px(11.2dp). 출금계좌 아이콘: 24dp = 30px, 반경 13.1px (원 맞추기)
ICONS = [
    ("kakao", 16.35, 17.44, 30, 803, 45, 14.0, SHEET),  # 접힌 시트 1번째 줄
    ("nh", 16.35, 17.44, 30, 928, 45, 14.0, SHEET),  # 농축협 (노란 NH)
    ("shinhan", 18.55, 19.17, 30, 673, 45, 14.0, SHEET),  # 펼친 시트 4번째 줄
    ("nhbank", 18.55, 19.17, 30, 798, 45, 14.0, SHEET),  # 농협은행 (파란 NH, 11자리)
    ("woori", 18.55, 19.17, 30, 923, 45, 14.0, SHEET),
    ("toss", 21.47, 21.92, 30, 409, 45, 14.0, SHEET),  # 끝까지 내린 뒤
    ("ibk", 21.47, 21.92, 30, 909, 45, 14.0, SHEET),
    ("account", 22.56, 23.85, 30, 298, 45, 14.0, SHEET),  # 내계좌 탭의 내 계좌
    ("hana", 24.04, 25.37, 30, 298, 45, 14.0, SHEET),  # 자주쓰는 탭
    ("from", 16.35, 17.44, 30, 125, 30, 13.1, PAGE),  # 맨 위 출금계좌 줄 (24dp)
    # 자주쓰는 탭을 누른 직후 잠깐 보이는 빈 상태의 흰 공(눈 2개). 막이 걷힌 뒤 두 프레임(23.977, 23.997)만 평균. 48dp = 60px 원
    ("favempty", 23.97, 23.995, 210, 290, 60, 30.0, SHEET),
]


def frames(video, t0, t1, tmp):
    d = Path(tmp) / f"{t0}"
    d.mkdir()
    subprocess.run(
        ["ffmpeg", "-v", "fatal", "-ss", str(t0), "-to", str(t1), "-i", video, "-fps_mode", "passthrough", str(d / "f_%04d.png")],
        check=True,
    )
    return [np.asarray(Image.open(p).convert("RGB")).astype(float) for p in sorted(d.glob("*.png"))]


def rounded_mask(n, r):
    """n×n 둥근 사각형의 픽셀 덮임 비율 (4×4 부분 샘플)"""
    s = (np.arange(n * 4) + 0.5) / 4
    x, y = np.meshgrid(s, s)
    cx = np.clip(x, r, n - r)
    cy = np.clip(y, r, n - r)
    inside = ((x - cx) ** 2 + (y - cy) ** 2) <= r * r
    return inside.reshape(n, 4, n, 4).mean(axis=(1, 3))


def main():
    video = sys.argv[1]
    with tempfile.TemporaryDirectory() as tmp:
        cache = {}
        for name, t0, t1, x, y, size, radius, bg in ICONS:
            key = (t0, t1)
            if key not in cache:
                cache[key] = np.mean(frames(video, t0, t1, tmp), axis=0)
            crop = cache[key][y : y + size, x : x + size]
            mask = rounded_mask(size, radius)
            a = mask[..., None]
            rgb = np.where(a > 0.02, (crop - (1 - a) * np.array(bg, float)) / np.maximum(a, 0.02), crop)
            out = np.dstack([np.clip(rgb, 0, 255), mask * 255]).round().astype(np.uint8)
            Image.fromarray(out, "RGBA").save(OUT / f"nh-sendwho-{name}.png")
            print(f"nh-sendwho-{name}.png  {size}x{size}  (t {t0}-{t1}, x {x}, y {y})")


if __name__ == "__main__":
    main()
