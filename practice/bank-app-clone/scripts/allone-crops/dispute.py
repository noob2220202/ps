#!/usr/bin/env python3
"""NH올원뱅크 (allone) 이의제기 · 통합검색 그림 → src/assets/local/allone-dispute-*.png

  python3 scripts/allone-crops/dispute.py --c3 <녹화 C3 …_2.mp4> --c4 <녹화 C4 …_3.mp4> \
      --model <RealESRGAN_x4plus_anime_6B.pth> [--out <폴더>] [--only 이름,이름] [--force]

  --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 src/assets/local 로 옮김 (기본은 src/assets/local, 이미 있으면 건너뜀 — --force)

방법은 home.py 와 같음: 상자(녹화 px)를 가만히 있는 구간 평균으로 자름 → Real-ESRGAN 4배 → 상자 테두리와 이어진 배경색을 걷음
  (가장자리는 배경색을 빼서 반투명) → 4px/pt, 잉크 상자로 잘라 저장. 출력마다 크기와 잉크 상자(녹화 화면 pt)를 알려 줌 (자리는 화면 CSS).
  allone-dispute-clipboard.png  이의제기 첫 화면의 클립보드 + 돋보기 그림 (C4 0.43–1.40초 평균, 흰 바탕) — 일반 그림 (글자 · 개인정보 없음)
  allone-dispute-arrow.png      이의제기 첫 화면이 내용을 받기 전 가운데의 초록 화살표 (C4 0.04–0.24초, 가만히 있는 그림 평균, 흰 바탕) — 일반 그림
  allone-dispute-aitok.png      통합검색 결과 AI톡 알약의 캐릭터 (C3 43.70–44.75초 평균, 알약 파란 바탕 #1d5eda 를 걷음).
                                알약 테두리(#1246aa)는 알약 안쪽 모양(오른쪽 반원 중심 343.03, 762 · 반지름 24.6, 위 737.7 · 아래 786.4 — 테두리의 번진 칸까지) 밖을 걷어 뺌
녹화: 아이폰 1180 × 2556 px = 393 × 852 pt (x pt = px / 3.0025, y pt = px / 3.000).
개인정보: 두 상자 모두 그림만 있는 칸 (계좌번호 · 이름 · 금액 · 상태바 밖). C4 12.4초 뒤(본인인증)는 쓰지 않음.
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import tempfile
from pathlib import Path

import numpy as np
import torch
from PIL import Image

_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from shared import resize_f, sr4  # noqa: E402  평균 · 4배 업스케일(되투영) · float 줄이기
from home import border_bg, frame, key  # noqa: E402  상자 자르기 · 배경색 · 배경 걷기 (home.py 와 같은 방법)
from esrgan import load as load_esrgan  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_X, PX_Y = 3.0025, 3.000
OUT_PX = 4  # 저장 배율 px / pt



def inside_pill(x, y):
    """AI톡 알약 안쪽 (화면 pt): 테두리 1pt 안, 오른쪽 끝은 반원"""
    cx, cy, r = 343.03, 762.0, 24.6
    return (y >= 737.7) & (y <= 786.4) & ((x <= cx) | (np.hypot(x - cx, y - cy) <= r))


# 이름: (녹화, (평균 시작, 끝), 상자 x, y, w, h 녹화 px, 배경색 (None = 상자 테두리 중앙값), 남길 곳 (화면 pt → bool, None = 전부))
CROPS = {
    "clipboard": ("c4", (0.43, 1.40), (318, 872, 476, 498), None, None),
    "aitok": ("c3", (43.70, 44.75), (944, 2210, 156, 156), None, inside_pill),
    "arrow": ("c4", (0.035, 0.245), (480, 1200, 214, 186), None, None),
}


def make(net, name, clips, cache):
    clip, t, box, bg, keep = CROPS[name]
    lr, n = frame(clips[clip], t, box, cache)
    bgc = np.array(bg) if bg is not None else border_bg(lr)
    sr = sr4(net, lr)
    rgb, a = key(lr, sr, bgc)
    x, y, w, h = box
    size = (round(w / PX_X * OUT_PX), round(h / PX_Y * OUT_PX))
    pa = resize_f(a * 255, size).clip(0, 255)
    if keep is not None:
        gy, gx = np.mgrid[0 : size[1], 0 : size[0]]
        pa = np.where(keep(x / PX_X + (gx + 0.5) / OUT_PX, y / PX_Y + (gy + 0.5) / OUT_PX), pa, 0)
    prgb = resize_f(rgb * a[..., None], size)
    rgb2 = np.where(pa[..., None] > 0.5, prgb * 255 / np.maximum(pa[..., None], 1e-3), 0).clip(0, 255)
    ys, xs = np.nonzero(pa > 3)
    t0, b0, l0, r0 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb2, pa])[t0:b0, l0:r0]
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    fname = f"allone-dispute-{name}.png"
    img.save(OUT / fname, optimize=True)
    left, top = x / PX_X + l0 / OUT_PX, y / PX_Y + t0 / OUT_PX
    wpt, hpt = img.size[0] / OUT_PX, img.size[1] / OUT_PX
    print(f"{fname}: {img.size[0]} × {img.size[1]} px = {wpt:.2f} × {hpt:.2f} pt, 잉크 x {left:.2f}–{left + wpt:.2f} y {top:.2f}–{top + hpt:.2f} "
          f"(녹화 {clip.upper()} {t[0]:.2f}–{t[1]:.2f}s 평균 {n}프레임, 배경 {tuple(int(v) for v in bgc)})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--c3", required=True)
    ap.add_argument("--c4", required=True)
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", help="쉼표로 이름 (예: clipboard)")
    ap.add_argument("--threads", type=int, default=2, help="torch CPU 스레드 (기본 2)")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(args.threads)
    names = args.only.split(",") if args.only else list(CROPS)
    clips = {"c3": args.c3, "c4": args.c4}
    net = load_esrgan(args.model)
    with tempfile.TemporaryDirectory() as cache:
        for name in names:
            make(net, name, clips, cache)


if __name__ == "__main__":
    main()
