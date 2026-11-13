#!/usr/bin/env python3
"""NH올원뱅크 (allone) 시작 흐름 그림 → src/assets/local/allone-launch-*  (docs/allone-spec/plan.md §5.3, launch.md §2.5 · §2.7)

  python3 scripts/allone-crops/launch.py --c1 <녹화 C1 …_1_3.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> \
      [--out <폴더>] [--only splash|pin-title] [--force]

  --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 src/assets/local 로 옮김 (기본은 src/assets/local, 이미 있으면 건너뜀 — --force)

  allone-launch-splash.webp      시작화면 그림 (C1 3.75~6.00초 평균, 상태바 띠 아래 px y 177~2556 = 59~852 pt 전체 폭).
                                 3D 그림이라 키우지 않고 녹화 배율 그대로 (3 px/pt), WebP q90. 화면에서는 네이티브 층 y 59 에 393 × 793 pt 로 놓음
  allone-launch-pin-title.png    간편비밀번호 화면 머리글 "NH올원뱅크" 로고 글자 (흰색 알파 마스크). C1 6.40~7.50초 평균 → Real-ESRGAN 4배
                                 → 초록 #0C8F2D 바탕을 걷어 냄 (픽셀 = a·흰색 + (1−a)·초록 의 a) → 4 px/pt, 잉크 상자로 자름

녹화: 아이폰 1180 × 2556 px = 393 × 852 pt (x pt = px / 3.0025, y pt = px / 3.000). 상자는 녹화 px. 출력은 크기와 잉크 상자를 pt 로 알려 줌.
개인정보: 상자는 plan.md §5.3 의 것만 — 시작화면은 상태바 띠(시계 · 배터리)를 뺀 그림만, 로고는 머리글 가운데 칸만.
  녹화의 앞부분(C1 0~1.15초 아이폰 홈 화면)은 쓰지 않고, 위 두 시간 구간 밖의 프레임은 읽지 않음.
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from shared import averaged, resize_f, sr4  # noqa: E402  공용 스크립트의 평균 · 4배 업스케일(되투영) · float 줄이기
from esrgan import load as load_esrgan  # noqa: E402  (shared 가 ibk-crops 를 경로에 넣음)

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_X, PX_Y = 3.0025, 3.000
OUT_PX = 4  # 저장 배율 px / pt (로고)
W, H = 1180, 2556

SPLASH = {"t": (3.75, 6.00), "y0": 177}  # 59 pt 부터 화면 아래 끝까지
PIN_TITLE = {"t": (6.40, 7.50), "box": (430, 214, 750, 287)}
GREEN = np.array([12.0, 143.0, 45.0])  # 간편비밀번호 화면 바탕 #0C8F2D


def splash(video):
    """화면 전체 폭 평균: 프레임이 커서 한 번에 쌓지 않고 두 번 읽음 (1: 작게 줄인 모습으로 튀는 프레임 고르기, 2: 고른 프레임 합)"""
    t0, t1 = SPLASH["t"]
    y0 = SPLASH["y0"]
    h = H - y0
    cmd = ["ffmpeg", "-v", "error", "-ss", str(t0), "-i", video, "-t", str(t1 - t0), "-vf", f"format=rgb24,crop={W}:{h}:0:{y0}", "-vsync", "0",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    size = W * h * 3

    def frames():
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, W, 3)
        p.wait()

    small = [f[::8, ::8].astype(np.float64) for f in frames()]
    stack = np.stack(small)
    med = np.median(stack, axis=0)
    dist = np.abs(stack - med).mean(axis=(1, 2, 3))
    keep = dist <= np.median(dist) * 1.5 + 1
    acc = np.zeros((h, W, 3))
    for i, f in enumerate(frames()):
        if i < len(keep) and keep[i]:
            acc += f
    avg = acc / keep.sum()
    img = Image.fromarray(avg.round().clip(0, 255).astype(np.uint8), "RGB")
    path = OUT / "allone-launch-splash.webp"
    img.save(path, "WEBP", quality=90, method=6)  # keep_assets: 이미 있으면 건너뜀 (--force)
    print(f"allone-launch-splash.webp: {W} × {h} px = {W / PX_X:.2f} × {h / PX_Y:.2f} pt (평균 {int(keep.sum())}/{len(keep)}프레임), "
          f"화면 y {y0 / PX_Y:.2f}–{H / PX_Y:.2f} pt")


def pin_title(net, video):
    x0, y0, x1, y1 = PIN_TITLE["box"]
    with tempfile.TemporaryDirectory() as cache:
        lr, n = averaged(video, *PIN_TITLE["t"], PIN_TITLE["box"], cache)
    sr = sr4(net, lr)
    # 바탕 초록 위 흰 글자: 픽셀 − 초록 = a · (흰색 − 초록) 를 세 채널 최소제곱으로 풂
    v = 255.0 - GREEN
    a = ((sr - GREEN) @ v) / (v @ v)
    a = np.clip((a - 0.03) / 0.94, 0, 1)  # 바탕 압축 잡음 걷기
    size = (round((x1 - x0) / PX_X * OUT_PX), round((y1 - y0) / PX_Y * OUT_PX))
    a = resize_f(a * 255, size).clip(0, 255)
    ys, xs = np.nonzero(a > 8)
    t, b, l, r = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[t:b, l:r]
    rgba = np.dstack([np.full(a.shape, 255.0), np.full(a.shape, 255.0), np.full(a.shape, 255.0), a])
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / "allone-launch-pin-title.png", optimize=True)  # keep_assets
    left, top = x0 / PX_X + l / OUT_PX, y0 / PX_Y + t / OUT_PX
    w, h = img.size[0] / OUT_PX, img.size[1] / OUT_PX
    print(f"allone-launch-pin-title.png: {img.size[0]} × {img.size[1]} px = {w:.2f} × {h:.2f} pt (평균 {n}프레임), "
          f"ink pt x {left:.2f}–{left + w:.2f} y {top:.2f}–{top + h:.2f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--c1", required=True, help="녹화 C1 (…_1_3.mp4, 시작화면 · 간편비밀번호)")
    ap.add_argument("--model", help="RealESRGAN_x4plus_anime_6B.pth (로고에만 필요)")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", choices=["splash", "pin-title"], help="하나만 만들기")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    if args.only in (None, "splash"):
        splash(args.c1)
    if args.only in (None, "pin-title"):
        if not args.model:
            ap.error("--model 이 있어야 로고를 만듦")
        pin_title(load_esrgan(args.model), args.c1)


if __name__ == "__main__":
    main()
