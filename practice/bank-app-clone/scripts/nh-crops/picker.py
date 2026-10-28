#!/usr/bin/env python3
"""콕뱅크 '은행선택' 화면의 둥근 사각 은행·증권사 아이콘을 녹화1에서 잘라 src/assets/local/nh-bank-<code>.png 로 저장.

  python3 scripts/nh-crops/picker.py --video1 녹화1.mp4 [--out src/assets/local]

녹화1(480×1066, 2026-10-28)의 은행선택 화면이 멈춰 있는 네 구간에서 모든 프레임을 평균 내서(압축 잡음 줄이기)
각 아이콘(36dp = 45px@480)을 가운데 맞춰 45×45로 자름. 아이콘 둘레는 둥근 사각(크기 44.6px, 모서리 17px —
흰 아이콘 3개의 가장자리에 영상 흐림까지 넣어 맞춘 모양) 바깥을 투명하게 하고, 가장자리 1.8px 안쪽 색은
타일 바탕(#1f242c)이 번져 들어와 있어서 조금 더 안쪽 색으로 채움 → 타일(#20252d)·시트(#29343f) 어디에 놓아도 됨.

아이콘 위치(녹화 px)는 클론 화면을 같은 스크롤로 그렸을 때의 위치이고, 실제 프레임에서 가장자리에 다시 맞춰 보정함.
필요: ffmpeg, Pillow, numpy
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
TILE = np.array([31, 36, 44], float)  # 녹화에서 타일 바탕 (실제 #20252d)
SIZE, BOX, RAD = 45, 44.6, 17.0  # 출력 px, 아이콘 한 변, 모서리 반경 (녹화 px)

# 정지 구간 (녹화1 초) → 아이콘 가운데 (녹화 px)
STATES = {
    "bank-top": ((46.30, 47.70), {
        "nh": (96.66, 324.55), "kb": (239.98, 324.55), "ibk": (383.32, 324.55), "shinhan": (96.66, 442.05), "woori": (239.98, 442.05),
        "hana": (383.32, 442.05), "kakao": (96.66, 559.55), "kbank": (239.98, 559.55), "toss": (383.32, 559.55), "sc": (96.66, 677.05),
        "kn": (239.98, 677.05), "kj": (383.32, 677.05), "im": (96.66, 791.35), "busan": (239.98, 799.22), "kdb": (383.32, 799.22),
        "suhyup": (96.66, 926.04), "jb": (239.98, 926.04), "jeju": (383.32, 926.04)}),
    "sec-top": ((44.05, 45.45), {
        "nhsec": (96.66, 324.55), "kyobo": (239.98, 324.55), "daishin": (383.32, 324.55), "mirae": (96.66, 442.05), "meritz": (239.98, 442.05),
        "bookook": (383.32, 442.05), "samsung": (96.66, 559.55), "shinyoung": (239.98, 559.55), "shinhansec": (383.32, 559.55),
        "eugene": (96.66, 677.05), "yuanta": (239.98, 677.05), "ls": (383.32, 677.05), "kakaopaysec": (96.66, 794.55), "cape": (239.98, 794.55),
        "kiwoom": (383.32, 794.55), "tosssec": (96.66, 912.05), "hanasec": (239.98, 912.05), "imsec": (383.32, 912.05)}),
    "bank-end": ((34.55, 35.20), {
        "citi": (96.66, 446.04), "mg": (239.98, 446.04), "shinhyup": (383.32, 446.04), "savings": (96.66, 563.54), "nfcf": (239.98, 563.54),
        "post": (383.32, 563.54), "deutsche": (96.66, 685.7), "boa": (239.98, 677.83), "icbc": (383.32, 685.7), "ccb": (96.66, 812.52),
        "boc": (239.98, 812.52), "bnp": (383.32, 812.52), "hsbc": (96.66, 930.02), "jpm": (239.98, 930.02)}),
    "sec-end": ((41.30, 42.95), {
        "kis": (96.66, 597.05), "wooriinv": (239.98, 597.05), "hanwha": (383.32, 597.05), "hmsec": (96.66, 714.55), "bnksec": (239.98, 714.55),
        "dbsec": (383.32, 714.55), "ibksec": (96.66, 832.05), "kbsec": (239.98, 832.05), "daol": (383.32, 832.05), "sks": (96.66, 949.55),
        "sangsangin": (239.98, 949.55)}),
}


def mean_frame(video, t0, t1, tmp):
    d = Path(tmp) / f"w{t0}"
    d.mkdir()
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t0), "-i", video, "-t", f"{t1 - t0:.3f}", "-fps_mode", "passthrough",
                    str(d / "f_%04d.png")], check=True)
    fs = sorted(d.glob("f_*.png"))
    return np.mean([np.asarray(Image.open(f).convert("RGB")).astype(float) for f in fs], axis=0), len(fs)


def rrect(cx, cy, n, box=BOX, rad=RAD, ss=6):
    """n×n 격자에 (cx, cy) 가운데 둥근 사각의 덮임 비율 (ss×ss 표본)"""
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    o = (np.arange(ss) + 0.5) / ss - 0.5
    h = box / 2
    acc = np.zeros((n, n))
    for dy in o:
        for dx in o:
            x = np.abs(xx + 0.5 + dx - cx)
            y = np.abs(yy + 0.5 + dy - cy)
            qx = np.maximum(x - (h - rad), 0)
            qy = np.maximum(y - (h - rad), 0)
            acc += (x <= h) & (y <= h) & (qx * qx + qy * qy <= rad * rad)
    return acc / ss / ss


def blur(a, s=0.6):
    k = np.arange(-3, 4)
    w = np.exp(-k * k / (2 * s * s))
    w /= w.sum()
    p = np.pad(a, 3, mode="edge")
    a = sum(wi * p[:, 3 + ki:p.shape[1] - 3 + ki] for ki, wi in zip(k, w))
    return sum(wi * a[3 + ki:a.shape[0] - 3 + ki] for ki, wi in zip(k, w))


def refine(img, px, py):
    """아이콘 바탕색이 타일과 충분히 다르면 둥근 사각 가장자리에 맞춰 가운데를 ±1.5px 안에서 다시 찾음"""
    n = 61
    x0, y0 = int(px) - 30, int(py) - 30
    sub = img[y0:y0 + n, x0:x0 + n]
    yy, xx = np.mgrid[0:n, 0:n]
    r = np.hypot(xx + 0.5 - (px - x0), yy + 0.5 - (py - y0))
    c = np.median(sub[(r > 15) & (r < 19)], axis=0)
    v = c - TILE
    if np.abs(v).max() < 25:
        return px, py, False
    a = np.clip(((sub - TILE) @ v) / (v @ v), 0, 1)
    m0 = rrect(px - x0, py - y0, n, ss=3)
    band = blur(((m0 > 0.02) & (m0 < 0.98)).astype(float), 1.5) > 0.02  # 가장자리 ±3px 띠
    best = (None, 0.0, 0.0)
    for step, span in ((0.5, 1.5), (0.1, 0.4)):  # 거칠게 → 촘촘하게
        bx, by = best[1], best[2]
        for dx in np.arange(bx - span, bx + span + 1e-6, step):
            for dy in np.arange(by - span, by + span + 1e-6, step):
                e = ((blur(rrect(px - x0 + dx, py - y0 + dy, n, ss=3)) - a)[band] ** 2).mean()
                if best[0] is None or e < best[0]:
                    best = (e, dx, dy)
    return px + best[1], py + best[2], True


def bilinear(img, x, y):
    x0 = np.clip(np.floor(x).astype(int), 0, img.shape[1] - 2)
    y0 = np.clip(np.floor(y).astype(int), 0, img.shape[0] - 2)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy)
            + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)


def cut(img, cx, cy):
    c = SIZE / 2
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(float) + 0.5
    # 둥근 사각까지의 안쪽 거리와 안쪽 방향 (가장자리 색을 안쪽 색으로 채우기 위해)
    h = BOX / 2
    dx, dy = xx - c, yy - c
    qx = np.maximum(np.abs(dx) - (h - RAD), 0)
    qy = np.maximum(np.abs(dy) - (h - RAD), 0)
    corner = (qx > 0) & (qy > 0)
    qd = np.hypot(qx, qy)
    dist = np.where(corner, RAD - qd, np.minimum(h - np.abs(dx), h - np.abs(dy)))
    nx = np.where(corner, -np.sign(dx) * qx / np.maximum(qd, 1e-6), np.where(h - np.abs(dx) < h - np.abs(dy), -np.sign(dx), 0))
    ny = np.where(corner, -np.sign(dy) * qy / np.maximum(qd, 1e-6), np.where(h - np.abs(dx) < h - np.abs(dy), 0, -np.sign(dy)))
    push = np.clip(2.5 - dist, 0, None)  # 가장자리 1.8px(+흐림) 안쪽까지는 2.5px 안쪽 색을 씀
    sx = xx + nx * push - c + cx
    sy = yy + ny * push - c + cy
    rgb = bilinear(img, sx - 0.5, sy - 0.5)
    alpha = rrect(c, c, SIZE)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video1", required=True)
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    out = Path(a.out)
    with tempfile.TemporaryDirectory() as tmp:
        for name, ((t0, t1), icons) in STATES.items():
            img, n = mean_frame(a.video1, t0, t1, tmp)
            print(f"{name}: {n} frames")
            for code, (px, py) in icons.items():
                cx, cy, ok = refine(img, px, py)
                cut(img, cx, cy).save(out / f"nh-bank-{code}.png")
                print(f"  nh-bank-{code}.png  center ({cx:.2f}, {cy:.2f}){'' if ok else '  (낮은 대비: 배치 위치 그대로)'}")


if __name__ == "__main__":
    main()
