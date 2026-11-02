#!/usr/bin/env python3
"""케이뱅크 홈 — 두 번째 녹화에서 새로 나온 그림을 잘라 4배로 키워 src/assets/local/kbank-home-*.png 로 저장.

  python3 scripts/kbank-crops/home-v2.py --video <두 번째 녹화.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--only 이름,이름] [--preview 미리보기.png]

두 번째 녹화(590 × 1280px, 1dp = 1.53646px). 파이프라인은 home.py 와 같음 (멈춘 구간 평균 → Real-ESRGAN 4배 → 역투영 → 바탕 걷기).
프레임 번호는 30fps 로 뽑은 번호 (프레임 n = (n−1)/30 초). 이름·번호가 들어간 영역은 자르지 않음.
  adcloud  — 광고 시트의 파란 구름 말풍선 + 흰 '!' (프레임 236~257, 시트 위 칸 바탕 #e7ebf3 을 거리로 걷고 '!' 구멍은 채움)
  magnifier — 홈 알약 두 번째 문구 뒤 🔍 (파란 알약 262~330, 알약 바탕을 걷음 → 회색 알약 위에서도 네모가 안 보임)
  coin4    — '흩어져 있는 내 계좌' 하늘색 원 + 흰 반구 (스크롤이 멈춘 472~475)
  coin5    — 흰 원(옅은 회색 테두리) + 초록·파랑 S (멈춘 488~490)
  동그라미 둘은 바탕을 걷지 않고 동그라미 밖만 투명 (테두리(242)가 흰 바탕과 13 차이라 바탕 걷기가 원 안까지 새어 들어감).
  자르는 원은 동그라미 가장자리(4배 그림 반지름 122.5 = 녹화 지름 61.3px, coin1~3 과 같음) — 상자에 꽉 찬 원(지름 74)으로 자르면
  동그라미 밖 흰 고리가 남아 흰 카드가 아닌 바탕(누름 덮개 등)에서 보였음
"""
import argparse
import sys
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ibk-crops"))
from crops import backproject, circle, remove_bg  # noqa: E402
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402
from home import averaged  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SCALE = 1.53646

# 이름: (첫 프레임, 끝 프레임, (x0, y0, x1, y1) 녹화 px, 바탕, 모양)
#   바탕: None = 그대로 / "auto" = 상자 가장자리 색 / ("dist", (r, g, b)) = 거리로 반투명 + 구멍 채움
ASSETS = {
    # 잉크 213~379 × 749~898px 에 8px 여백 → 앱 x 133.4~251.9 · y 449.1~556.5 (118.5 × 107.4)
    "adcloud": (236, 257, (205, 741, 387, 906), ("dist", (231.1, 234.9, 243.0)), None),
    # 알약 안쪽만 (알약 끝 둥근 곳에 닿지 않게): 앱 x 299.4~321.5 · y 18.9~38.4 = 펼친 알약 왼끝(65.8) + 233.6 · 위(15.2) + 3.7
    "magnifier": (262, 330, (460, 80, 494, 110), "auto", None),
    # 동그라미 가운데가 상자 (37, 37) 에 오게 74px 상자 (첫 녹화 coin1~3 과 같은 칸, 지름 62px = 40.4dp)
    "coin4": (472, 475, (55, 888, 129, 962), None, "circle"),
    "coin5": (488, 490, (56, 1075, 130, 1149), None, "circle"),
}


def fill_holes(mask):
    """가장자리에서 이어지지 않은 빈 곳(구멍)을 채움"""
    h, w = mask.shape
    out = np.zeros_like(mask)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if not mask[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if not mask[y, x])
    for y, x in q:
        out[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return ~out


def erode(mask, n):
    for _ in range(n):
        m = mask.copy()
        m[1:] &= mask[:-1]
        m[:-1] &= mask[1:]
        m[:, 1:] &= mask[:, :-1]
        m[:, :-1] &= mask[:, 1:]
        mask = m
    return mask


def coin_cut(rgba, frac=122.5 / 148):
    """동그라미 가장자리에서 자름 (반지름 = 상자 반 × frac, 4배 그림에서 4px 부드러운 가장자리 = 녹화 1px)"""
    h, w, _ = rgba.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((yy - (h - 1) / 2) ** 2 + (xx - (w - 1) / 2) ** 2)
    edge = np.clip((min(h, w) / 2 * frac - d) / 4 + 0.5, 0, 1)
    out = rgba.copy()
    out[..., 3] = out[..., 3] * edge
    return out


def by_distance(rgb, bg):
    """바탕색과의 거리로 불투명도 (4 아래는 투명, 54 위는 불투명), 안쪽 구멍('!')은 불투명으로 채우고 색은 바탕을 덜어 냄"""
    bg = np.array(bg, np.float64)
    d = np.sqrt(((rgb - bg) ** 2).sum(2))
    alpha = np.clip((d - 4) / 50, 0, 1)
    alpha[erode(fill_holes(alpha > 0.5), 8)] = 1.0  # 4배라 2px → 8px
    a = alpha[..., None]
    fg = np.where(a > 0.02, (rgb - (1 - a) * bg) / np.maximum(a, 1e-3), bg)
    return np.dstack([np.clip(fg, 0, 255), alpha * 255])


def make(net, video, cache, name, spec):
    f0, f1, box, bg, shape = spec
    lr = averaged(video, f0, f1, box, cache)
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    if bg == "auto":
        border = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
        bg = tuple(np.median(border, axis=0))
    if bg is None:
        rgba = np.dstack([sr, np.full(sr.shape[:2], 255.0)])
    elif isinstance(bg[0], str) and bg[0] == "dist":
        rgba = by_distance(sr, bg[1])
    else:
        rgba = remove_bg(sr, bg)
    if shape == "circle":
        rgba = coin_cut(circle(rgba))
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / f"kbank-home-{name}.png", optimize=True)
    w, h = box[2] - box[0], box[3] - box[1]
    print(f"kbank-home-{name}: {w / SCALE:.2f} × {h / SCALE:.2f} dp (녹화 x {box[0] / SCALE:.2f}, 앱 y {box[1] / SCALE - 33.2:.2f}) → {img.size[0]} × {img.size[1]} px")
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--only", help="쉼표로 이름 몇 개만")
    ap.add_argument("--preview", help="잘라 낸 것들을 체크무늬·회색·파랑 알약 바탕 위에 모아 볼 파일")
    args = ap.parse_args()
    net = load_esrgan(args.model)
    names = args.only.split(",") if args.only else list(ASSETS)
    made = []
    with tempfile.TemporaryDirectory() as cache:
        for n in names:
            made.append(make(net, args.video, cache, n, ASSETS[n]))
    if args.preview and made:
        cell = 240
        bgs = [(200, 120, 200), (192, 203, 224), (234, 242, 254), (231, 235, 243)]
        sheet = Image.new("RGBA", (cell * len(made), cell * len(bgs)), (0, 0, 0, 255))
        for j, c in enumerate(bgs):
            for i, im in enumerate(made):
                tile = Image.new("RGBA", (cell, cell), c + (255,))
                im = im.copy()
                im.thumbnail((cell - 10, cell - 10))
                tile.alpha_composite(im, (5, 5))
                sheet.paste(tile, (i * cell, j * cell))
        sheet.save(args.preview)


if __name__ == "__main__":
    main()
