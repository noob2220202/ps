#!/usr/bin/env python3
"""NH 콕뱅크 공용 이미지 몇 개를 스크린샷(720px)·녹화(480px)에서 잘라 src/assets/local/nh-*.png 로 저장.

  python3 scripts/extract-nh.py --history 계좌별거래내역.jpg --video1 녹화1.mp4

화면별 정밀 이미지는 scripts/nh-crops/*.py (화면 담당별) 가 만든다. 필요: ffmpeg, Pillow, numpy
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


def circle(img, cx, cy, d):
    """(cx, cy) 중심 지름 d 원만 남기고 바깥은 투명 (가장자리는 4배로 그려서 부드럽게)"""
    r = d / 2
    box = (round(cx - r) - 1, round(cy - r) - 1, round(cx + r) + 1, round(cy + r) + 1)
    out = img.crop(box).convert("RGBA")
    big = Image.new("L", (out.width * 4, out.height * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(big).ellipse([4 * (cx - r - box[0]), 4 * (cy - r - box[1]), 4 * (cx + r - box[0]), 4 * (cy + r - box[1])], fill=255)
    out.putalpha(big.resize(out.size, Image.LANCZOS))
    return out


def main(args):
    # 화면별 정밀 이미지는 scripts/nh-crops/<담당>.py 가 만든다 (홈·시작화면 home.py, 콕송금 send-who.py, 은행선택 picker.py,
    # 송금 확인·완료 confirm.py, 거래내역 history.py, 거래상세 txdetail.py, 전체계좌·등록 accounts.py).
    # 이 파일은 여러 화면이 같이 쓰는 몇 개만 만든다 — 예전 사각형 자르기를 여기서 다시 돌리면 정밀 이미지를 덮어쓰니 넣지 말 것.
    OUT.mkdir(parents=True, exist_ok=True)
    if args.history:  # 계좌별 거래내역 스크린샷 720px
        img = load(args.history, 720)
        # 노란 농협 아이콘 + 별 (아이콘 y 289–357, 별 위끝 281 → 아래가 잘리지 않게)
        save(cutout_on(img, (34, 280, 112, 358), (24, 23, 28)), "nh-account.png")
    with tempfile.TemporaryDirectory() as tmp:
        if args.video1:  # 녹화1 (480px)
            f = frame(args.video1, 1.0, tmp)
            save(f.crop((190, 486, 282, 574)), "nh-app-icon.png")  # 흰 바탕 위 콕 아이콘 (프로필 고르기 화면)
            f = frame(args.video1, 17.5, tmp)  # 콕송금 최근송금 목록
            save(circle(f, 52, 950, 45), "nh-bank.png")  # 목록의 농협 아이콘 (노란 동그라미)
            save(cutout_on(f, (28, 124, 62, 157), PAGE, 20), "nh-account-plain.png")  # 출금계좌 아이콘 (별 없음)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for flag in ("history", "video1"):
        ap.add_argument(f"--{flag}")
    main(ap.parse_args())
