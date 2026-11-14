#!/usr/bin/env python3
"""토스 공용 그림 (src/toss 여러 화면이 같이 씀) → src/assets/local/toss-*.png

  python3 scripts/toss-crops/shared.py --video <녹화 A.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--out <폴더>] [--force]

  --out 으로 다른 폴더(예: 임시 폴더)에 먼저 만들어 눈으로 확인한 뒤 src/assets/local 로 옮겨도 됨 (기본은 src/assets/local)

  toss-symbol.png        3D 파란 토스 심볼 (시작화면 녹화 1.0~5.5초 평균 → Real-ESRGAN 4배 → 바탕 걷기). 바탕보다 밝은 부분만 남김
                         → 토스트 · 은행 로고(BankLogo) · 머리줄 회색 표시(CSS 틴트) 에 씀. 4px/dp
  toss-symbol-splash.png 같은 심볼 + 아래 그림자(바탕보다 어두운 부분도 검정 반투명으로) → 시작화면 (#171619 위)
  toss-app-icon.png      앱 아이콘 (로그인 · 프로필 고르기 · 계정 관리). App Store 원본 1024px(iTunes 조회, 인터넷 필요) →
                         갤럭시 아이콘 모양(초타원 n=2.7, ibk-crops/appicon.py 와 같음)으로 자름. 인터넷이 없으면 흰 초타원 + toss-symbol 로 만듦

녹화(480 × 1066 = 384 × 853.33dp, 1.25px/dp). 상자는 녹화 px. 잘라 낸 그림은 개인정보가 없는 시작화면 가운데(상태바 밖)만.
출력은 잉크 상자로 잘라 냄 → 화면 자리는 아래 출력의 'ink dp' (상자 왼쪽 위 기준이 아니라 화면 좌표)
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import io
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1] / "ibk-crops"))
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_PER_DP = 1.25  # 녹화
OUT_PX_PER_DP = 4  # 저장 배율
BG = np.array([23, 22, 25], np.float64)  # #171619 시작화면 바탕
SPLASH = {"t": (1.0, 5.5), "box": (156, 454, 324, 610)}  # 녹화 px (plan.md §5.1)
APPSTORE_ID = 839333328  # '토스' (Viva Republica)


def averaged(video, t0, t1, box, cache):
    x0, y0, x1, y1 = box
    d = Path(cache)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(t0), "-i", video, "-t", str(t1 - t0), "-vf", f"fps=30,crop={x1 - x0}:{y1 - y0}:{x0}:{y0}", str(d / "%03d.png")],
        check=True,
    )
    stack = np.stack([np.asarray(Image.open(f).convert("RGB")).astype(np.float64) for f in sorted(d.glob("*.png"))])
    med = np.median(stack, axis=0)
    dist = np.abs(stack - med).mean(axis=(1, 2, 3))
    return stack[dist <= np.median(dist) * 1.5 + 1].mean(axis=0)


def backproject(lr, sr, iters=2):
    h, w = lr.shape[:2]
    out = sr.astype(np.float64)
    for _ in range(iters):
        down = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float64)
        err = lr - down
        up = np.stack([np.asarray(Image.fromarray(err[..., c].astype(np.float32), "F").resize(out.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
        out = out + up
    return out.clip(0, 255)


def color_to_alpha(rgb, bg, darker):
    """바탕 bg 를 걷어 냄 (GIMP 'color to alpha'): 픽셀 = a·fg + (1−a)·bg 가 되는 가장 작은 a.
    darker=False 면 바탕보다 밝은 쪽만 (그림자 · 어두운 잡음은 투명). 잡음(a < .06)은 부드럽게 0 으로"""
    diff = rgb - bg
    if darker:
        room = np.where(diff >= 0, 255 - bg, bg)
        a = (np.abs(diff) / room).max(axis=2)
    else:
        a = (np.clip(diff, 0, None) / (255 - bg)).max(axis=2)
    a = np.clip((a - 0.04) / 0.96, 0, 1)
    a = np.where(a < 0.06, a * (a / 0.06), a)
    safe = np.maximum(a, 1e-3)[..., None]
    fg = np.clip(bg + diff / safe, 0, 255)
    return np.dstack([fg, a * 255])


def resize_rgba(rgba, size):
    # 색은 미리 곱한 알파로 줄여야 가장자리에 바탕색이 번지지 않음
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3]])
    out = np.stack([np.asarray(Image.fromarray(pre[..., c].astype(np.float32), "F").resize(size, Image.LANCZOS)) for c in range(4)], axis=2)
    out[..., 3] = out[..., 3].clip(0, 255)
    aa = np.maximum(out[..., 3:4] / 255, 1e-4)
    out[..., :3] = np.where(out[..., 3:4] > 0.5, out[..., :3] / aa, 0)
    return out.clip(0, 255)


def trim(rgba, thresh=8):
    ys, xs = np.nonzero(rgba[..., 3] > thresh)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[y0:y1, x0:x1], (x0, y0)


def save(rgba, name):
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / name, optimize=True)  # keep_assets: src/assets/local 에 이미 있으면 건너뜀 (--force)
    return img


def symbol(net, video):
    with tempfile.TemporaryDirectory() as cache:
        lr = averaged(video, *SPLASH["t"], SPLASH["box"], cache)
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    x0, y0, x1, y1 = SPLASH["box"]
    size = (round((x1 - x0) / PX_PER_DP * OUT_PX_PER_DP), round((y1 - y0) / PX_PER_DP * OUT_PX_PER_DP))
    made = {}
    for name, darker in (("toss-symbol.png", False), ("toss-symbol-splash.png", True)):
        rgba = resize_rgba(color_to_alpha(sr, BG, darker), size)
        rgba, (ox, oy) = trim(rgba)
        img = save(rgba, name)
        left, top = x0 / PX_PER_DP + ox / OUT_PX_PER_DP, y0 / PX_PER_DP + oy / OUT_PX_PER_DP
        made[name] = img
        print(f"{name}: {img.size[0]} × {img.size[1]} px = {img.size[0] / OUT_PX_PER_DP:.2f} × {img.size[1] / OUT_PX_PER_DP:.2f} dp, ink dp x {left:.2f} y {top:.2f}")
    return made


def squircle_alpha(n, size):
    yy, xx = np.mgrid[0:size, 0:size]
    a = size / 2
    r = ((np.abs(xx - (size - 1) / 2) / a) ** n + (np.abs(yy - (size - 1) / 2) / a) ** n) ** (1 / n)
    return np.clip((1 - r) * a + 0.5, 0, 1) * 255


def app_icon(sym):
    size = 464
    try:
        info = json.load(urllib.request.urlopen(f"https://itunes.apple.com/lookup?id={APPSTORE_ID}&country=kr", timeout=20))["results"][0]
        url = info["artworkUrl512"].replace("512x512bb.jpg", "1024x1024bb.png")
        im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert("RGB").resize((size, size), Image.LANCZOS)
        rgb = np.asarray(im).astype(np.float64)
        src = "App Store"
    except Exception as e:  # 인터넷이 없으면 흰 바탕 + 심볼
        print("App Store 아이콘을 못 받음 → 흰 바탕 + 심볼로 만듦:", e)
        base = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        s = sym.copy()
        s.thumbnail((int(size * 0.62), int(size * 0.62)), Image.LANCZOS)
        base.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
        rgb = np.asarray(base.convert("RGB")).astype(np.float64)
        src = "흰 바탕 + 심볼"
    img = save(np.dstack([rgb, squircle_alpha(2.7, size)]), "toss-app-icon.png")
    print(f"toss-app-icon.png: {img.size} ({src})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, help="녹화 A (시작화면이 있는 것)")
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    made = symbol(load_esrgan(args.model), args.video)
    app_icon(made["toss-symbol.png"])


if __name__ == "__main__":
    main()
