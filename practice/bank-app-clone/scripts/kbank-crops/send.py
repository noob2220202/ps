#!/usr/bin/env python3
"""케이뱅크 이체 화면 그림을 녹화에서 잘라 4배로 키워 src/assets/local/kbank-*.png 로 저장.

  python3 scripts/kbank-crops/send.py --video <녹화.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--only 이름,이름]

녹화(cb67e5eb, 590×1280px, 1dp = 1.53646px). 파이프라인은 scripts/ibk-crops/crops.py 와 같음(평균 → Real-ESRGAN 4배 → 역투영 → 바탕 걷기/원)
다만 케이뱅크 녹화는 가로로 늘어나지 않아 가로 되돌리기 없음. 은행 로고는 녹화에 나온 것만 (카카오뱅크·케이뱅크·농축협·새마을금고)
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import argparse
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ibk-crops"))
from crops import averaged, backproject, circle, remove_bg  # noqa: E402
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"

# 이름: (시작 초, 끝 초, 상자 [x0, y0, x1, y1] 녹화 px, 바탕, 모양)
ASSETS = {
    # 확인 화면 K › B (프레임 930~1020, 지름 75px = 48.8dp)
    "bank-kbank": (31.0, 33.3, (184, 310, 259, 385), None, "circle"),
    "bank-kakao": (31.0, 33.3, (332, 310, 407, 385), None, "circle"),
    # '최근 보낸 계좌' 행 로고 (프레임 681~702, 지름 56px = 36.4dp) — 케이뱅크는 농축협이 주황 원, 새마을금고가 흰 원(옅은 테두리)
    "bank-nh": (22.7, 23.4, (30, 927, 87, 984), None, "circle"),
    "bank-mg": (22.7, 23.4, (30, 1047, 87, 1104), None, "circle"),
    # 'AI' 알약의 반짝이 (프레임 700, 잉크 170~195 × 1115~1143)
    "send-ai": (22.7, 23.4, (166, 1111, 200, 1147), "auto", None),
    # 완료 '메세지 보내기' 앞 네잎클로버 (프레임 1205~1218, 잉크 259~281 × 705~731)
    "send-clover": (40.17, 40.6, (254, 700, 287, 736), "auto", None),
}


def make(net, video, cache, name, spec):
    t0, t1, box, bg, shape = spec
    lr = averaged(video, t0, t1, box, cache)
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    if bg == "auto":
        border = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
        bg = np.median(border, axis=0)
    rgba = remove_bg(sr, bg) if bg is not None else np.dstack([sr, np.full(sr.shape[:2], 255.0)])
    if shape == "circle":
        rgba = circle(rgba)
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / f"kbank-{name}.png", optimize=True)
    print(f"kbank-{name}: {(box[2] - box[0]) / 1.53646:.1f} × {(box[3] - box[1]) / 1.53646:.1f} dp → {img.size[0]} × {img.size[1]} px")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--only")
    args = ap.parse_args()
    net = load_esrgan(args.model)
    with tempfile.TemporaryDirectory() as cache:
        for n in args.only.split(",") if args.only else ASSETS:
            make(net, args.video, cache, n, ASSETS[n])


if __name__ == "__main__":
    main()
