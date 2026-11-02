#!/usr/bin/env python3
"""케이뱅크 홈 그림을 녹화에서 잘라 4배로 키워 src/assets/local/kbank-home-*.png 로 저장.

  python3 scripts/kbank-crops/home.py --video <녹화.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--only 이름,이름] [--preview 미리보기.png]

녹화(2026-11-02, 590 × 1280px, 1dp = 1.53646px). 파이프라인은 scripts/ibk-crops/crops.py 와 같음
(멈춘 구간 평균 → Real-ESRGAN 4배 → 역투영 → 바탕 걷기). 이 녹화는 가로로 늘어나지 않음(1.0).
이름·번호가 들어간 영역은 자르지 않음. 상자는 녹화 화면 px, 구간은 30fps 프레임 번호 (프레임 n = n/30 초, 처음부터 fps=30 으로 뽑은 번호).
"""
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
#   바탕: None = 그대로 / "auto" = 상자 가장자리 색 / (r, g, b)
#   스크롤 위치: 334~376 맨 위, 412~418 245px 내림, 474~487 1169px, 496~508 1375px
ASSETS = {
    # 계좌 카드 아래 'ONE 11월 쓴 돈' · 내 자산 '카드' 의 금색 카드 (내 자산 쪽이 더 큼: 녹화 43 × 68px)
    "card": (412, 418, (64, 997, 120, 1079), (255, 255, 255), None),
    # 계좌 카드 아래 넘김 칸의 작은 카드 (녹화 350 잉크 앱 49.3~74.4 × 235.0~274.5) — 큰 그림을 0.9배로 줄여 쓰면 모서리가 더 깎여 보였음
    "card-s": (334, 376, (70, 405, 120, 480), (255, 255, 255), None),
    # 안전한 금융거래 카드의 자물쇠 (파란 상태, 332 프레임부터 멈춤)
    "lock": (334, 376, (428, 742, 518, 864), (255, 255, 255), None),
    # 홈에 들어올 때 자물쇠: 잠긴 회색 → 잠긴 파랑 → 열림(위) (이체 뒤 돌아온 42초: 1256~1268 회색, 1270~1272 파랑, 1274~ 열림)
    "lock-gray": (1258, 1266, (428, 742, 518, 864), (255, 255, 255), None),
    "lock-blue": (1271, 1272, (428, 742, 518, 864), (255, 255, 255), None),
    # 바로가기 아이콘 (둘레 네모 테두리는 CSS)
    "won": (334, 376, (80, 936, 138, 992), (255, 255, 255), None),
    "autosend": (334, 376, (209, 942, 259, 990), (255, 255, 255), None),
    "charge": (334, 376, (339, 946, 375, 990), (255, 255, 255), None),
    "edit": (334, 376, (460, 946, 503, 989), (255, 255, 255), None),
    # 알약 속 👀 (파란 상태 바탕 234,242,254)
    "eyes": (334, 398, (459, 82, 491, 108), "auto", None),
    # '흩어져 있는 내 계좌' 동그라미 (약 1.1초마다 겹쳐 바뀜) — 노랑 474~482, 파랑 488(스크롤 57px), 남색 442
    "coin1": (474, 482, (55, 348, 129, 422), (255, 255, 255), "circle"),
    "coin2": (488, 488, (55, 291, 129, 365), (255, 255, 255), "circle"),
    "coin3": (442, 442, (55, 916, 129, 990), (255, 255, 255), "circle"),
    # 실시간 추천 카드 그림 (여행가방 · 카드 두 장)
    "suitcase": (496, 508, (118, 466, 205, 547), "auto", None),
    "cards": (496, 508, (340, 466, 415, 547), "auto", None),
    # '새로워진 케이뱅크 홈' 연필
    "pen": (496, 508, (60, 775, 102, 818), "auto", None),
    # 탭바 아이콘 (홈 = 파랑 활성, 나머지 회색)
    "tab-home": (496, 508, (46, 1182, 92, 1227), (255, 255, 255), None),
    "tab-product": (496, 508, (159, 1182, 205, 1227), (255, 255, 255), None),
    "tab-benefit": (496, 508, (272, 1182, 318, 1227), (255, 255, 255), None),
    "tab-service": (496, 508, (385, 1182, 431, 1227), (255, 255, 255), None),
    "tab-all": (496, 508, (497, 1182, 543, 1227), (255, 255, 255), None),
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
    img.save(OUT / f"kbank-home-{name}.png", optimize=True)
    w, h = box[2] - box[0], box[3] - box[1]
    print(f"kbank-home-{name}: {w / SCALE:.1f} × {h / SCALE:.1f} dp (녹화 x {box[0] / SCALE:.1f}, y {box[1] / SCALE:.1f}) → {img.size[0]} × {img.size[1]} px")
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
