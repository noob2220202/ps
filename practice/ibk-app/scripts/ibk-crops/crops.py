#!/usr/bin/env python3
"""i-ONE Bank(IBK기업은행) 그림을 실제 앱 녹화에서 잘라 4배로 키워 src/assets/local/ibk-*.png 로 저장.

  python3 scripts/ibk-crops/crops.py --video <녹화.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--only 이름,이름] [--preview 미리보기.png]

녹화(2026-10-30, 384×832 = 1px 1dp, 30fps, 비트레이트가 낮아 번짐) 하나뿐이라:
  1. 같은 장면이 멈춰 있는 구간의 프레임을 여러 장 평균 → 압축 잡음을 줄임
  2. Real-ESRGAN(애니 모델, esrgan.py)으로 4배 → 가장자리가 또렷해짐
  3. 역투영: 키운 그림을 다시 줄여 원본과 비교한 차이를 더해 줌 → 업스케일이 바꾼 색·밝기를 원래대로
  4. 바탕 걷기: 가장자리에서 이어진 바탕색만 투명하게 (그림 안쪽의 같은 색은 남김) + 경계 2px 은 바탕을 덜어 낸 반투명
  5. 가로 되돌리기: 이 녹화는 화면이 가로로 1.0242배 늘어나 있음 (원·정사각형 11개 가로/세로 비, 클론 x = (녹화 x − 0.35) / 1.0242)
     → 키운 그림의 가로를 1/1.0242 로 줄여 실제 비율로
  6. 필요하면 동그라미 / 갤럭시 아이콘 모양으로 자름 (은행 로고 원 등)
상자(box)는 녹화 좌표. 화면에는 (상자 폭 / 1.0242) × 상자 높이 dp 로, 왼쪽 위는 x = (x0 − 0.35) / 1.0242 에 놓으면 위치가 맞음.
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import argparse
import json
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SCALE = 4
STRETCH = 1.0242  # 녹화의 가로 늘어남

# 그림 목록: assets/*.json (화면별 파일, 여러 사람이 동시에 고쳐도 안 겹치게)
#   {"이름": {"t": [시작 초, 끝 초], "box": [x0, y0, x1, y1] (녹화 px = dp), "bg": 바탕 처리, "shape": 모양, "note": 설명}}
#   bg: null = 그대로(네모 그림, 바탕째) / "auto" = 상자 가장자리 색을 바탕으로 보고 걷어 냄 / [r, g, b] = 그 색을 걷어 냄
#   shape: null / "circle" = 상자에 맞는 원 밖은 투명 / "squircle" = 갤럭시 앱 아이콘 모양 (초타원 n=2.7, 앱 서랍에서 잰 모서리)
def load_assets():
    out = {}
    for f in sorted((Path(__file__).resolve().parent / "assets").glob("*.json")):
        for name, a in json.loads(f.read_text()).items():
            out[name] = (a["t"][0], a["t"][1], tuple(a["box"]), tuple(a["bg"]) if isinstance(a["bg"], list) else a["bg"], a.get("shape"))
    return out


ASSETS = load_assets()


def frames(video, t0, t1, cache):
    """t0~t1 초를 30fps 로 뽑아 float 배열 목록 (같은 구간은 한 번만 뽑음)"""
    key = f"{t0:.2f}-{t1:.2f}"
    d = Path(cache) / key
    if not d.exists():
        d.mkdir(parents=True)
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t0), "-i", video, "-t", str(t1 - t0), "-vf", "fps=30", str(d / "%03d.png")], check=True)
    return [np.asarray(Image.open(f).convert("RGB")).astype(np.float64) for f in sorted(d.glob("*.png"))]


def averaged(video, t0, t1, box, cache):
    """구간 평균 (움직이는 프레임이 섞이지 않게: 가운데값에서 많이 벗어난 프레임은 뺌)"""
    x0, y0, x1, y1 = box
    stack = np.stack([f[y0:y1, x0:x1] for f in frames(video, t0, t1, cache)])
    med = np.median(stack, axis=0)
    dist = np.abs(stack - med).mean(axis=(1, 2, 3))
    keep = stack[dist <= np.median(dist) * 1.5 + 1]
    return keep.mean(axis=0)


def backproject(lr, sr, iters=2):
    """sr 을 줄였을 때 lr 과 같아지게: 차이를 키워서 더함 (색·밝기 보정, 디테일은 유지)"""
    h, w = lr.shape[:2]
    out = sr.astype(np.float64)
    for _ in range(iters):
        down = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float64)
        err = lr - down
        up = np.stack([np.asarray(Image.fromarray(err[..., c].astype(np.float32), "F").resize(out.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
        out = out + up
    return out.clip(0, 255)


def remove_bg(rgb, bg, tol=14):
    """가장자리에서 이어진, 바탕색과 tol 이내인 픽셀만 투명. 그 둘레 2px(4배 기준 8px) 띠는 바탕을 덜어 낸 반투명"""
    h, w, _ = rgb.shape
    bg = np.array(bg, np.float64)
    near = np.abs(rgb - bg).max(axis=2) <= tol
    clear = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if near[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if near[y, x])
    for y, x in q:
        clear[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not clear[ny, nx]:
                clear[ny, nx] = True
                q.append((ny, nx))
    band = np.zeros_like(clear)
    r = 2 * SCALE
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                band |= np.roll(np.roll(clear, dy, 0), dx, 1)
    band &= ~clear
    # 띠: 바탕보다 얼마나 다른지로 불투명도 (가장 다른 채널 / 그 방향으로 갈 수 있는 최대)
    diff = rgb - bg
    room = np.where(diff >= 0, 255 - bg, bg)
    a_band = np.clip((np.abs(diff) / np.maximum(room, 1)).max(axis=2) * 1.6, 0, 1)
    alpha = np.where(clear, 0.0, np.where(band, a_band, 1.0))
    safe = np.maximum(alpha, 1e-3)[..., None]
    fg = np.where(band[..., None], np.clip(bg + diff / safe, 0, 255), rgb)
    return np.dstack([fg, alpha * 255])


def circle(rgba):
    h, w, _ = rgba.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx, rad = (h - 1) / 2, (w - 1) / 2, min(h, w) / 2
    d = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    edge = np.clip(rad - d + 0.5, 0, 1)  # 1px 부드러운 가장자리
    out = rgba.copy()
    out[..., 3] = out[..., 3] * edge
    return out


def squircle(rgba, n=2.7):
    h, w, _ = rgba.shape
    yy, xx = np.mgrid[0:h, 0:w]
    a = min(h, w) / 2
    u, v = np.abs(xx - (w - 1) / 2) / a, np.abs(yy - (h - 1) / 2) / a
    r = (u**n + v**n) ** (1 / n)  # 1 이 가장자리
    edge = np.clip((1 - r) * a + 0.5, 0, 1)
    out = rgba.copy()
    out[..., 3] = out[..., 3] * edge
    return out


def make(net, video, cache, name, spec):
    t0, t1, box, bg, shape = spec
    lr = averaged(video, t0, t1, box, cache)
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    if bg == "auto":
        border = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
        bg = np.median(border, axis=0)
    rgba = remove_bg(sr, bg) if bg is not None else np.dstack([sr, np.full(sr.shape[:2], 255.0)])
    h, w = rgba.shape[:2]
    w2 = round(w / STRETCH)
    rgba = np.stack([np.asarray(Image.fromarray(rgba[..., c].astype(np.float32), "F").resize((w2, h), Image.LANCZOS)) for c in range(4)], axis=2).clip(0, 255)
    if shape == "circle":
        rgba = circle(rgba)
    elif shape == "squircle":
        rgba = squircle(rgba)
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / f"ibk-{name}.png", optimize=True)
    print(f"ibk-{name}: {(box[2] - box[0]) / STRETCH:.1f} × {box[3] - box[1]} dp → {img.size[0]} × {img.size[1]} px")
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--only", help="쉼표로 이름 몇 개만")
    ap.add_argument("--preview", help="잘라 낸 것들을 체크무늬 위에 모아 볼 파일")
    args = ap.parse_args()
    net = load_esrgan(args.model)
    names = args.only.split(",") if args.only else list(ASSETS)
    made = []
    with tempfile.TemporaryDirectory() as cache:
        for n in names:
            made.append(make(net, args.video, cache, n, ASSETS[n]))
    if args.preview and made:
        cell = 260
        sheet = Image.new("RGBA", (cell * min(len(made), 6), cell * ((len(made) + 5) // 6)), (200, 200, 200, 255))
        for i, im in enumerate(made):
            im = im.copy()
            im.thumbnail((cell - 10, cell - 10))
            sheet.alpha_composite(im, ((i % 6) * cell + 5, (i // 6) * cell + 5))
        sheet.save(args.preview)


if __name__ == "__main__":
    main()
