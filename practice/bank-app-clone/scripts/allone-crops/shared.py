#!/usr/bin/env python3
"""NH올원뱅크 (allone) 공용 그림 → src/assets/local/allone-*.png  (docs/allone-spec/plan.md §5.2)

  python3 scripts/allone-crops/shared.py --c1 <녹화 C1 …_1_3.mp4> --c3 <녹화 C3 …_2.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> \
      [--out <폴더>] [--force]

  --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 src/assets/local 로 옮김 (기본은 src/assets/local, 이미 있으면 건너뜀 — --force)

  allone-wordmark.png      "all NH one" 워드마크의 흰색 알파 마스크 (시작화면 가운데). C1 3.75~6.00초 평균 → Real-ESRGAN 4배 →
                           초록 · 파랑 글자를 흰 바탕에서 걷어 냄(두 색의 합집합) → 4px/pt. 앱 아이콘 · 스피너 · 아이콘 그림에 CSS mask-image 로 씀
  allone-bank-<code>.png   36pt 은행 타일 (전북 jb · 신한 shinhan · 카카오뱅크 kakao · 하나 hana: C3 27.5초 '누구에게 보낼까요' 목록,
                           KB kb · 케이뱅크 kbank · NH nh: C3 4.5초 '출금계좌 선택' 시트). 로고만 있는 칸 (글자는 px 212 부터 — 상자 밖).
                           Real-ESRGAN 4배 → 상자 = 타일 (녹화 타일이 상자를 꽉 채움) → 초타원 마스크 (n 2.6, 녹화 타일 윤곽에 맞춘 값) → 144px (4px/pt)

녹화: 아이폰 1180 × 2556 px = 393 × 852 pt (x pt = px / 3.0025, y pt = px / 3.000). 상자는 녹화 px. 출력은 잉크 상자와 크기를 pt 로 알려 줌.
개인정보: 상자는 plan.md §5.2 의 것만 (로고만 있는 칸, 상태바 · 이름 · 번호 · 금액 밖). 녹화의 제외 구간(C1 2.28~3.37초 등)은 쓰지 않음.
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1] / "ibk-crops"))
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_X, PX_Y = 3.0025, 3.000  # 녹화 px / pt
OUT_PX = 4  # 저장 배율 px / pt
WHITE = np.array([255.0, 255.0, 255.0])

# 워드마크: 초록 "all" · "one" #0C8F2D, 파랑 "NH" #10429F (흰 바탕). plan.md §5.2
WORDMARK = {"t": (3.75, 6.00), "box": (410, 704, 770, 968)}
INKS = [np.array([12.0, 143.0, 45.0]), np.array([16.0, 66.0, 159.0])]

# 은행 타일 (녹화 px 상자 x0, y0, x1, y1). 108 px = 36 pt
TILE_X = (72, 180)
TILES = {
    "jb": (27.5, 1710),
    "shinhan": (27.5, 1900),
    "kakao": (27.5, 2088),
    "hana": (27.5, 2278),
    "kb": (4.5, 1582),
    "kbank": (4.5, 1771),
    "nh": (4.5, 1960),
}
TILE_PT = 36
SQUIRCLE_N = 2.6  # |x|^n + |y|^n = 1 — 녹화 타일 윤곽(가장자리 0.5 문턱)에 맞춘 지수 (평균 오차 0.12 px)


def averaged(video, t0, t1, box, cache):
    """t0~t1 프레임을 상자만 잘라 평균 (움직인 프레임은 중앙값과 차이로 뺌)"""
    x0, y0, x1, y1 = box
    d = Path(cache)
    for f in d.glob("*.png"):
        f.unlink()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(t0), "-i", video, "-t", str(t1 - t0), "-vf", f"crop={x1 - x0}:{y1 - y0}:{x0}:{y0}", "-vsync", "0", str(d / "%04d.png")],
        check=True,
    )
    stack = np.stack([np.asarray(Image.open(f).convert("RGB")).astype(np.float64) for f in sorted(d.glob("*.png"))])
    med = np.median(stack, axis=0)
    dist = np.abs(stack - med).mean(axis=(1, 2, 3))
    keep = dist <= np.median(dist) * 1.5 + 1
    return stack[keep].mean(axis=0), int(keep.sum())


def backproject(lr, sr, iters=2):
    """업스케일 결과를 다시 줄였을 때 원본과 같아지게 (번짐 · 색 틀어짐 줄임)"""
    h, w = lr.shape[:2]
    out = sr.astype(np.float64)
    for _ in range(iters):
        down = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float64)
        err = lr - down
        up = np.stack([np.asarray(Image.fromarray(err[..., c].astype(np.float32), "F").resize(out.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
        out = out + up
    return out.clip(0, 255)


def sr4(net, lr):
    return backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))


def resize_f(arr, size, box=None):
    """float 한 장(H×W) 또는 여러 장(H×W×C)을 LANCZOS 로 (box = 원본에서 잘라 쓸 float 상자)"""
    if arr.ndim == 2:
        return np.asarray(Image.fromarray(arr.astype(np.float32), "F").resize(size, Image.LANCZOS, box=box)).astype(np.float64)
    return np.stack([resize_f(arr[..., c], size, box) for c in range(arr.shape[2])], axis=2)


def save(rgba, name):
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / name, optimize=True)  # keep_assets: src/assets/local 에 이미 있으면 건너뜀 (--force)
    return img


# ---------- 워드마크 ----------
def coverage(rgb):
    """흰 바탕 위 글자 덮임 정도: 픽셀 = a·잉크 + (1−a)·흰색 의 a 를 두 잉크 색 방향으로 구해 큰 쪽 (합집합)"""
    w = WHITE - rgb
    a = np.zeros(rgb.shape[:2])
    for ink in INKS:
        v = WHITE - ink
        a = np.maximum(a, (w @ v) / (v @ v))
    a = np.clip((a - 0.03) / 0.94, 0, 1)  # 흰 바탕 압축 잡음 걷기
    return np.where(a < 0.05, a * (a / 0.05), a)


def wordmark(net, video):
    x0, y0, x1, y1 = WORDMARK["box"]
    with tempfile.TemporaryDirectory() as cache:
        lr, n = averaged(video, *WORDMARK["t"], WORDMARK["box"], cache)
    a = coverage(sr4(net, lr))
    size = (round((x1 - x0) / PX_X * OUT_PX), round((y1 - y0) / PX_Y * OUT_PX))
    a = resize_f(a * 255, size).clip(0, 255)
    ys, xs = np.nonzero(a > 8)
    t, b, l, r = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[t:b, l:r]
    rgba = np.dstack([np.full(a.shape, 255.0), np.full(a.shape, 255.0), np.full(a.shape, 255.0), a])
    img = save(rgba, "allone-wordmark.png")
    left, top = x0 / PX_X + l / OUT_PX, y0 / PX_Y + t / OUT_PX
    w, h = img.size[0] / OUT_PX, img.size[1] / OUT_PX
    print(f"allone-wordmark.png: {img.size[0]} × {img.size[1]} px = {w:.2f} × {h:.2f} pt (평균 {n}프레임), "
          f"splash ink pt x {left:.2f}–{left + w:.2f} y {top:.2f}–{top + h:.2f}")


# ---------- 은행 타일 ----------
def squircle_alpha(size, n=SQUIRCLE_N, ss=4):
    """초타원 |x|^n + |y|^n ≤ 1 이 칸을 덮는 비율 (ss×ss 표본)"""
    k = (np.arange(size * ss) + 0.5) / (size * ss) * 2 - 1
    yy, xx = np.meshgrid(k, k, indexing="ij")
    inside = (np.abs(xx) ** n + np.abs(yy) ** n) <= 1
    return inside.reshape(size, ss, size, ss).mean(axis=(1, 3))


def tile(net, video, code, t, y0, cache):
    x0, x1 = TILE_X
    # 상자 = 타일 (녹화 타일은 상자 안쪽 0.5 px 안팎까지 꽉 참 — 윤곽 맞춤 결과)
    lr, n = averaged(video, t - 0.25, t + 0.25, (x0, y0, x1, y0 + 108), cache)
    sr = sr4(net, lr)
    size = TILE_PT * OUT_PX
    rgb = resize_f(sr, (size, size)).clip(0, 255)
    # 가장자리 고리(바깥 3px)는 흰 바탕이 섞여 있음 → 같은 방향으로 조금 안쪽 색을 끌어다 씀
    c = (size - 1) / 2
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    dx, dy = (xx - c) / (size / 2), (yy - c) / (size / 2)
    rad = (np.abs(dx) ** SQUIRCLE_N + np.abs(dy) ** SQUIRCLE_N) ** (1 / SQUIRCLE_N)
    r_in = 1 - 3.0 / (size / 2)
    scale = np.where(rad > r_in, r_in / np.maximum(rad, 1e-6), 1.0)
    sx = np.clip(np.round(c + (xx - c) * scale), 0, size - 1).astype(int)
    sy = np.clip(np.round(c + (yy - c) * scale), 0, size - 1).astype(int)
    rgb = rgb[sy, sx]
    a = squircle_alpha(size) * 255
    img = save(np.dstack([rgb, a]), f"allone-bank-{code}.png")
    print(f"allone-bank-{code}.png: {img.size[0]} × {img.size[1]} px = {TILE_PT} × {TILE_PT} pt, ink = 칸 전체 (초타원 n {SQUIRCLE_N}); "
          f"C3 {t - 0.25:.2f}–{t + 0.25:.2f}s 평균 {n}프레임, 녹화 px x {x0}–{x1} y {y0}–{y0 + 108}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--c1", required=True, help="녹화 C1 (…_1_3.mp4, 시작화면)")
    ap.add_argument("--c3", required=True, help="녹화 C3 (…_2.mp4, 이체 · 출금계좌 선택)")
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", choices=["wordmark", "tiles"], help="하나만 만들기")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    net = load_esrgan(args.model)
    if args.only in (None, "wordmark"):
        wordmark(net, args.c1)
    if args.only in (None, "tiles"):
        with tempfile.TemporaryDirectory() as cache:
            for code, (t, y0) in TILES.items():
                tile(net, args.c3, code, t, y0, cache)


if __name__ == "__main__":
    main()
