#!/usr/bin/env python3
"""NH올원뱅크 (allone) 홈 · 전체메뉴 · 정기점검 그림 → src/assets/local/allone-home-*.png  (docs/allone-spec/plan.md §5.4, home.md §7)

  python3 scripts/allone-crops/home.py --c1 <녹화 C1 …_1_3.mp4> --c2 <녹화 C2 …_1_4.mp4> --c3 <녹화 C3 …_2.mp4> \
      --model <RealESRGAN_x4plus_anime_6B.pth> [--out <폴더>] [--only 이름,이름] [--force]

  --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 src/assets/local 로 옮김 (기본은 src/assets/local, 이미 있으면 건너뜀 — --force)

방법: 상자(녹화 px)를 프레임에서 자름 (가만히 있는 구간은 여러 프레임 평균) → Real-ESRGAN 4배 → 배경색 걷기
  (상자 테두리의 중앙값 = 배경색. 테두리와 이어진 배경 영역만 걷고, 그 가장자리는 배경 색을 빼서 반투명으로 — 그림 안쪽의 흰 부분은 그대로) → 4px/pt.
  출력마다 크기와 잉크 상자(녹화 화면 pt)를 알려 줌. 자리는 화면 CSS 가 정함 (home.md 의 잉크 상자).
녹화: 아이폰 1180 × 2556 px = 393 × 852 pt (x pt = px / 3.0025, y pt = px / 3.000).
개인정보: 상자는 plan.md §5.4 의 것만 — 그림만 있는 칸 (이름 · 계좌번호 · 잔액 · 상태바 밖). 실제 인물 광고 · 공익 광고는 쓰지 않음 (plan §5.6, Q16).
  두 상자는 녹화에서 다른 것이 겹쳐 줄임: 광고 2 손 + 돈은 아래 넘기기 알약 위에서 끊음 (h 213 → 199), 내 소비 가게는 카드 아래 테두리 위에서 (258 → 250),
  내 모임 통장도 카드 아래 테두리 위에서 (330 → 320). 바로가기 8번째 메뉴설정(점선 +)은 SVG.
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
import torch
from PIL import Image

_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from shared import averaged, resize_f, sr4  # noqa: E402  공용 스크립트의 평균 · 4배 업스케일(되투영) · float 줄이기
from esrgan import load as load_esrgan  # noqa: E402  (shared 가 ibk-crops 를 경로에 넣음)

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_X, PX_Y = 3.0025, 3.000
OUT_PX = 4  # 저장 배율 px / pt

# 이름: (녹화, 시각 또는 (평균 시작, 끝), 상자 x, y, w, h 녹화 px, 배경색 (None = 상자 테두리 중앙값))
CROPS = {
    # 배너 하트 + P 동전 (크림 바탕 #fffae2, 점 무늬 후광 포함)
    "banner": ("c3", (25.55, 25.95), (850, 450, 231, 198), None),
    # 오늘의 혜택 글줄 아이콘 3개 (흰 바탕)
    "ticker-flame": ("c1", 14.767, (132, 1042, 99, 123), None),
    "ticker-point": ("c1", 15.433, (129, 435, 105, 117), None),
    "ticker-bag": ("c2", 3.624, (132, 1036, 99, 129), None),
    # 바로가기 8개 (흰 카드)
    "quick-register": ("c1", 14.767, (168, 1360, 99, 99), None),
    "quick-accounts": ("c1", 14.767, (417, 1360, 99, 99), None),
    "quick-bills": ("c1", 14.767, (667, 1360, 102, 99), None),
    "quick-limit": ("c1", 14.767, (916, 1360, 102, 99), None),
    "quick-owner": ("c1", 14.767, (168, 1606, 99, 99), None),
    "quick-roulette": ("c1", 14.767, (417, 1606, 99, 99), None),
    "quick-coupon": ("c1", 14.767, (667, 1606, 102, 99), None),
    # 메뉴설정(회색 점선 +)은 SVG 로 그림 (home.md §2.7)
    # 내 모임 통장 (연보라 카드 #f4e8fd). 카드 아래 테두리(px 1781~) 위에서 끊음
    "moim": ("c2", 0.408, (787, 1459, 318, 320), None),
    # 광고 2 손 + 돈 (아래 넘기기 알약이 겹치는 줄 위에서 끊음)
    "ad-bond": ("c2", 1.208, (775, 730, 300, 199), None),
    # 금융일정 달력 · 내 소비 가게 · 내 자산 돈주머니
    "calendar": ("c2", 1.208, (799, 1309, 270, 258), None),
    "mart": ("c2", 1.208, (871, 1826, 192, 250), None),
    "asset": ("c2", 1.608, (871, 1417, 180, 183), None),
    # 생활자산 흰 타일 (파란 카드 바탕을 걷음)
    "life-car": ("c2", 2.008, (210, 1597, 204, 204), None),
    "life-insurance": ("c2", 2.008, (742, 1597, 204, 204), None),
    # NH금융그룹 6개
    "group-invest": ("c2", 2.408, (402, 754, 114, 111), None),
    "group-card": ("c2", 2.408, (949, 766, 114, 84), None),
    "group-life": ("c2", 2.408, (402, 1204, 114, 114), None),
    "group-insurance": ("c2", 2.408, (952, 1204, 108, 114), None),
    "group-capital": ("c2", 2.408, (402, 1657, 111, 114), None),
    "group-savings": ("c2", 2.408, (949, 1666, 114, 96), None),
    # 전체메뉴 바로가기 4개 · AI톡 타일 (전체메뉴가 가만히 있는 구간 평균)
    "menu-wallet": ("c3", (39.40, 39.80), (162, 558, 87, 93), None),
    "menu-security": ("c3", (39.40, 39.80), (423, 558, 90, 93), None),
    "menu-help": ("c3", (39.40, 39.80), (688, 558, 93, 93), None),
    "menu-event": ("c3", (39.40, 39.80), (952, 558, 99, 93), None),
    "menu-ai": ("c3", (39.40, 39.80), (970, 345, 156, 156), None),
    # 오늘 운세 말풍선의 네잎클로버 (검정 바탕)
    "clover": ("c3", (25.55, 25.95), (241, 343, 39, 50), (2.0, 2.0, 2.0)),
    # 정기점검 시트 종 (흰 시트, 가만히 있는 1초 평균)
    "notice-bell": ("c1", (12.80, 13.80), (880, 1880, 210, 210), None),
}


def frame(video, t, box, cache):
    if isinstance(t, tuple):
        x, y, w, h = box
        lr, n = averaged(video, t[0], t[1], (x, y, x + w, y + h), cache)
        return lr, n
    x, y, w, h = box
    out = Path(cache) / "one.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", "-vf", f"crop={w}:{h}:{x}:{y}", str(out)], check=True)
    return np.asarray(Image.open(out).convert("RGB")).astype(np.float64), 1


def border_bg(lr):
    ring = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
    return np.median(ring, axis=0)


def flood_outside(near):
    """테두리와 이어진 배경 칸 (near = 배경색에 가까운 칸). 테두리 씨앗에서 near 안으로만 한 칸씩 넓힘 (형태 재구성)"""
    out = np.zeros_like(near)
    out[0], out[-1], out[:, 0], out[:, -1] = near[0], near[-1], near[:, 0], near[:, -1]
    while True:
        grow = out.copy()
        grow[1:] |= out[:-1]
        grow[:-1] |= out[1:]
        grow[:, 1:] |= out[:, :-1]
        grow[:, :-1] |= out[:, 1:]
        grow &= near
        if (grow == out).all():
            return out
        out = grow


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx > r * r:
                continue
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def color_to_alpha(rgb, bg):
    """배경 b 위의 p 를 가장 작은 불투명도 a 로 설명 (p = a·f + (1−a)·b, f 는 0–255 안)"""
    up = np.where(rgb > bg, (rgb - bg) / np.maximum(255 - bg, 1e-6), 0)
    down = np.where(rgb < bg, (bg - rgb) / np.maximum(bg, 1e-6), 0)
    return np.clip(np.maximum(up, down).max(axis=2), 0, 1)


def key(lr, sr, bg):
    """테두리와 이어진 배경은 걷고(반투명 가장자리), 그림 안쪽은 불투명. 돌려줌: 곧은(premultiply 안 한) rgb, a
    배경 영역은 원래 크기에서 찾아 4배로 늘리고, 가장자리 띠는 4배 크기에서 넓힘"""
    outside = flood_outside(np.abs(lr - bg).max(axis=2) < 14)
    outside = np.kron(outside, np.ones((4, 4), dtype=bool))[: sr.shape[0], : sr.shape[1]]
    edge = dilate(outside, 6)  # 4배 크기에서 5px ≈ 0.4pt: 가장자리 섞인 칸까지
    a = color_to_alpha(sr, bg)
    d = np.abs(sr - bg).max(axis=2)
    a = a * np.clip((d - 12) / 16, 0, 1)  # 배경색과 12 안쪽 차이는 압축 잡음 → 0, 28 부터 그대로
    a = np.where(edge, a, 1.0)
    f = np.where(a[..., None] > 1e-3, (sr - (1 - a[..., None]) * bg) / np.maximum(a[..., None], 1e-3), 0)
    return np.clip(f, 0, 255), a


def make(net, name, clips, cache):
    clip, t, box, bg = CROPS[name]
    lr, n = frame(clips[clip], t, box, cache)
    bgc = np.array(bg) if bg is not None else border_bg(lr)
    sr = sr4(net, lr)
    rgb, a = key(lr, sr, bgc)
    x, y, w, h = box
    size = (round(w / PX_X * OUT_PX), round(h / PX_Y * OUT_PX))
    pa = resize_f(a * 255, size).clip(0, 255)
    prgb = resize_f(rgb * a[..., None], size)
    rgb2 = np.where(pa[..., None] > 0.5, prgb * 255 / np.maximum(pa[..., None], 1e-3), 0).clip(0, 255)
    ys, xs = np.nonzero(pa > 3)
    t0, b0, l0, r0 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb2, pa])[t0:b0, l0:r0]
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    fname = f"allone-home-{name}.png"
    img.save(OUT / fname, optimize=True)
    left, top = x / PX_X + l0 / OUT_PX, y / PX_Y + t0 / OUT_PX
    wpt, hpt = img.size[0] / OUT_PX, img.size[1] / OUT_PX
    when = f"{t[0]:.2f}–{t[1]:.2f}s 평균 {n}프레임" if isinstance(t, tuple) else f"{t:.3f}s"
    print(f"{fname}: {img.size[0]} × {img.size[1]} px = {wpt:.2f} × {hpt:.2f} pt, 잉크 x {left:.2f}–{left + wpt:.2f} y {top:.2f}–{top + hpt:.2f} "
          f"(녹화 {clip.upper()} {when}, 배경 {tuple(int(v) for v in bgc)})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--c1", required=True)
    ap.add_argument("--c2", required=True)
    ap.add_argument("--c3", required=True)
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", help="쉼표로 이름 (예: banner,clover)")
    ap.add_argument("--threads", type=int, default=2, help="torch CPU 스레드 (기본 2)")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(args.threads)
    names = args.only.split(",") if args.only else list(CROPS)
    clips = {"c1": args.c1, "c2": args.c2, "c3": args.c3}
    net = load_esrgan(args.model)
    with tempfile.TemporaryDirectory() as cache:
        for name in names:
            make(net, name, clips, cache)


if __name__ == "__main__":
    main()
