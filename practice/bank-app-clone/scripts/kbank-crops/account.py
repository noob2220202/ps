#!/usr/bin/env python3
"""케이뱅크 계좌 화면 그림을 녹화에서 잘라 4배로 키워 src/assets/local/kbank-account-*.png 로 저장.

  python3 scripts/kbank-crops/account.py --video <녹화.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--only 이름,이름] [--preview 미리보기.png]

파이프라인은 home.py 와 같음 (멈춘 구간 평균 → Real-ESRGAN 4배 → 역투영 → 바탕 걷기). 이름·번호 영역은 자르지 않음.
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import subprocess
import argparse
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ibk-crops"))
from crops import backproject, circle, remove_bg  # noqa: E402
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SCALE = 1.53646

# 이름: (첫 프레임, 끝 프레임, (x0, y0, x1, y1) 녹화 px, 바탕, 모양)
# 계좌 화면 맨 위 (프레임 605~640 멈춤). 아이콘 네모(#f6f7fa, 둥근 모서리)째 자름 — 바깥은 흰 바탕이라 그대로 씀.
# 네모: 녹화 x 52~113 · 193~254 · 335~396 · 476~537, y 501~562 (62px = 40.4dp)
ASSETS = {
    "plusbox": (605, 640, (52, 501, 114, 563), None, None),  # 플러스박스 (돈주머니 ₩)
    "reward": (605, 640, (193, 501, 255, 563), None, None),  # 입출금리워드 (별 카드)
    "card": (605, 640, (335, 501, 397, 563), None, None),  # 체크카드
    "charge": (605, 640, (476, 501, 538, 563), None, None),  # 자동충전 (번개)
}


def frames(video, f0, f1, cache):
    """30fps 프레임 f0~f1 (끝 포함) 을 float 배열로 (같은 구간은 한 번만 뽑음)"""
    d = Path(cache) / f"{f0}-{f1}"
    if not d.exists():
        d.mkdir(parents=True)
        # select 의 n 은 0부터 → 프레임 번호 n 은 n−1 (F/0001.png 이 n=0)
        vf = f"fps=30,select='between(n\\,{f0 - 1}\\,{f1 - 1})'"
        subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", vf, "-fps_mode", "passthrough", str(d / "%03d.png")], check=True)
    return [np.asarray(Image.open(f).convert("RGB")).astype(np.float64) for f in sorted(d.glob("*.png"))]


def averaged(video, f0, f1, box, cache):
    """구간 평균 (가운데값에서 많이 벗어난 프레임은 뺌 — 화면 터치 표시 등)"""
    x0, y0, x1, y1 = box
    stack = np.stack([f[y0:y1, x0:x1] for f in frames(video, f0, f1, cache)])
    med = np.median(stack, axis=0)
    dist = np.abs(stack - med).mean(axis=(1, 2, 3))
    return stack[dist <= np.median(dist) * 1.5 + 1].mean(axis=0)


def make(net, video, cache, name, spec):
    f0, f1, box, bg, shape = spec
    lr = averaged(video, f0, f1, box, cache)
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    if bg == "auto":
        border = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
        bg = np.median(border, axis=0)
    rgba = remove_bg(sr, bg) if bg is not None else np.dstack([sr, np.full(sr.shape[:2], 255.0)])
    if shape == "circle":
        rgba = circle(rgba)
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / f"kbank-account-{name}.png", optimize=True)
    w, h = box[2] - box[0], box[3] - box[1]
    print(f"kbank-account-{name}: {w / SCALE:.1f} × {h / SCALE:.1f} dp (녹화 x {box[0] / SCALE:.1f}, y {box[1] / SCALE:.1f}) → {img.size[0]} × {img.size[1]} px")
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
        cell = 200
        sheet = Image.new("RGBA", (cell * min(len(made), 6), cell * ((len(made) + 5) // 6)), (200, 120, 200, 255))
        for i, im in enumerate(made):
            im = im.copy()
            im.thumbnail((cell - 10, cell - 10))
            sheet.alpha_composite(im, ((i % 6) * cell + 5, (i // 6) * cell + 5))
        sheet.save(args.preview)


if __name__ == "__main__":
    main()
