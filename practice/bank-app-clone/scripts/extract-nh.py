#!/usr/bin/env python3
"""NH 콕뱅크 화면 이미지를 스크린샷(720px)·녹화(480px)에서 잘라 src/assets/local/nh-*.png 로 저장.

  python3 scripts/extract-nh.py --home 홈.jpg --history 계좌별거래내역.jpg --detail-out 출금상세.jpg \\
                                --video1 녹화1.mp4 --video2 녹화2.mp4

(2026-10-28 21:4x 스크린샷·녹화 기준) 필요: ffmpeg, Pillow, numpy

콕뱅크는 다크 화면뿐이고 그림이 놓이는 바탕색이 정해져 있어서(페이지 #18171c, 메뉴 카드 #28323c …)
대부분 사각형 그대로 자른다 → CSS 바탕색을 같은 색으로 맞추면 이음새가 안 보임.
여러 바탕에 올라가는 계좌 아이콘만 바깥을 투명하게 딴다.
"""
import argparse
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "src/assets/local"
PAGE = (24, 23, 28)  # 페이지 바탕 #18171c


def load(path, width):
    img = Image.open(path).convert("RGB")
    if img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    return img


def frame(video, t, tmp):
    out = Path(tmp) / f"f{t}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", str(out)], check=True)
    return Image.open(out).convert("RGB")


def save(img, name):
    img.save(OUT / name)
    print(f"{name:28s} {img.width}x{img.height}")


def cutout_on(img, box, bg, tol=18, also=()):
    """바탕색(bg)과 비슷한 바깥 픽셀을 테두리부터 따라가며 투명하게. 경계는 바탕색을 빼고 원래 색으로 되돌림
    also: 같이 지울 다른 바탕색 (카드 둥근 모서리 밖의 페이지 색 등)"""
    a = np.asarray(img.crop(box).convert("RGBA")).astype(float)
    h, w = a.shape[:2]
    bgc = np.array(bg, float)
    dist = np.abs(a[:, :, :3] - bgc).max(axis=2)
    for c in also:
        dist = np.minimum(dist, np.abs(a[:, :, :3] - np.array(c, float)).max(axis=2))
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not seen[y, x] and dist[y, x] < tol:
            seen[y, x] = True
            q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    a[seen, 3] = 0
    near = seen.copy()
    for _ in range(2):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    edge = near & ~seen
    alpha = np.clip(dist[edge] / 90, 0.05, 1)[:, None]
    a[edge, :3] = np.clip((a[edge, :3] - (1 - alpha) * bgc) / alpha, 0, 255)
    a[edge, 3] = alpha[:, 0] * 255
    return Image.fromarray(a.astype(np.uint8))


def main(args):
    OUT.mkdir(parents=True, exist_ok=True)
    if args.home:  # 홈 스크린샷 720px
        img = load(args.home, 720)
        save(img.crop((0, 290, 720, 712)), "nh-hero.png")  # 캐릭터 + 뒤 파란 빛 (페이지 바탕까지 포함)
        # 카드 바탕이 위아래로 살짝 그라데이션이라 사각형으로 자르면 테두리가 보임 → 바깥을 투명하게
        for name, x0, x1 in [("send", 112, 166), ("myaccount", 259, 314), ("poke", 405, 462), ("dutch", 553, 609)]:
            save(cutout_on(img, (x0, 744, x1, 802), (40, 51, 62), 14), f"nh-menu-{name}.png")
        save(cutout_on(img, (215, 1040, 345, 1160), (35, 43, 52), 22, [PAGE]), "nh-kok-bulb.png")  # 지식콕
        save(cutout_on(img, (550, 1040, 674, 1160), (35, 43, 52), 22, [PAGE]), "nh-kok-pig.png")  # 금융콕
        save(cutout_on(img, (415, 1212, 670, 1415), (227, 239, 251), 16, [PAGE]), "nh-banner-char.png")  # 배너 캐릭터
    if args.history:  # 계좌별 거래내역 스크린샷 720px
        img = load(args.history, 720)
        save(cutout_on(img, (34, 274, 112, 352), (24, 23, 28)), "nh-account.png")  # 노란 농협 아이콘 + 별
        save(img.crop((67, 566, 108, 607)), "nh-chip-send.png")  # '송금' 칩 앞 동전
    if args.detail_out:  # 출금 거래 상세 스크린샷 720px
        img = load(args.detail_out, 720)
        save(img.crop((212, 1203, 308, 1299)), "nh-quick-register.png")  # 빠른송금 등록
        save(img.crop((412, 1203, 508, 1299)), "nh-same-send.png")  # 동일내역 송금
    with tempfile.TemporaryDirectory() as tmp:
        if args.video1:  # 녹화1 (480px): 시작 화면
            f = frame(args.video1, 1.0, tmp)
            save(f.crop((190, 486, 282, 574)), "nh-app-icon.png")  # 흰 바탕 위 콕 아이콘
            f = frame(args.video1, 2.0, tmp)
            save(f.crop((118, 412, 362, 498)), "nh-wordmark.png")
            save(f.crop((196, 108, 284, 160)), "nh-nonghyup.png")  # 새로운 대한민국 농협
            save(f.crop((198, 896, 282, 952)), "nh-ma.png")
        if args.video2:  # 녹화2: 송금 확인·완료
            f = frame(args.video2, 26.5, tmp)
            save(f.crop((204, 514, 276, 588)), "nh-shield.png")  # 시트 바탕(#2c3540) 그대로
            f = frame(args.video2, 30.5, tmp)
            save(f.crop((200, 165, 280, 250)), "nh-coin.png")
            f = frame(args.video2, 34.5, tmp)
            for name, x0 in [("card", 86), ("kakao", 203), ("mms", 319)]:
                save(f.crop((x0, 799, x0 + 70, 867)), f"nh-msg-{name}.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for flag in ("home", "history", "detail-out", "video1", "video2"):
        ap.add_argument(f"--{flag}")
    main(ap.parse_args())
