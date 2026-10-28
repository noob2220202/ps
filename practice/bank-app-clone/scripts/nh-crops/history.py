#!/usr/bin/env python3
"""콕뱅크 '계좌별 거래내역' 화면 그림 자르기 (담당: history). 결과는 src/assets/local/nh-history-*.png

  python3 scripts/nh-crops/history.py --history 거래내역스크린샷.jpg

거래내역 스크린샷(720px, 1 dp = 1.875 px, 바탕 #18171c 단색)에서:
- nh-history-acct.png        노란 농협 계좌 아이콘 + 청록 별 (x 37–113, y 281–358 px). 바탕을 빼고 투명하게
- nh-history-acct-plain.png  별 없는 아이콘 (계좌선택 시트용, x 37–107, y 288–358 px).
                             별이 덮은 오른쪽 위 모서리는 아이콘이 좌우 대칭(가운데 x 71.5px)이라 왼쪽 위를 뒤집어 채움
- nh-history-coin.png        '송금' 칩 앞 동전 (x 66–110, y 565–609 px, 칩 안쪽 바탕도 #18171c)
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PAGE = np.array([24, 23, 28], float)  # #18171c


def matte(a, bg, tol=36, ring=2):
    """테두리에서부터 바탕(bg)과 비슷한 곳을 따라가며 투명하게.
    경계 ring px 은 '안쪽 이웃 색(f)과 바탕(b) 사이 어디쯤인가'로 불투명도를 정하고 색은 f 로 둠
    (JPEG 색 번짐으로 생긴 어두운 테두리가 다른 바탕 위에서 보이지 않게)"""
    h, w = a.shape[:2]
    dist = np.abs(a - bg).max(axis=2)
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not seen[y, x] and dist[y, x] < tol:
            seen[y, x] = True
            q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    near = seen.copy()
    for _ in range(ring):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    edge = near & ~seen
    inner = ~near
    alpha = np.where(seen, 0.0, 1.0)
    rgb = a.copy()
    r = ring + 2
    for y, x in zip(*np.nonzero(edge)):
        y0, y1, x0, x1 = max(0, y - r), min(h, y + r + 1), max(0, x - r), min(w, x + r + 1)
        m = inner[y0:y1, x0:x1]
        if not m.any():
            alpha[y, x] = np.clip(dist[y, x] / 120, 0, 1)
            continue
        f = np.median(a[y0:y1, x0:x1][m], axis=0)
        d = f - bg
        al = float(np.clip(np.dot(a[y, x] - bg, d) / max(np.dot(d, d), 1), 0, 1))
        alpha[y, x] = al
        rgb[y, x] = f
    rgb[seen] = 0
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")


def save(img, name):
    img.save(OUT / name)
    print(f"{name:28s} {img.width}x{img.height}")


def history(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    assert a.shape[1] == 720, "거래내역 스크린샷은 720px 폭"
    # 아이콘 + 별
    save(matte(a[281:358, 37:113], PAGE), "nh-history-acct.png")
    # 별 없는 아이콘: 별(x 86–113, y 283–311) 자리를 왼쪽 위(가운데 x 71.5 기준 대칭)로 채움
    b = a.copy()
    for x in range(86, 114):
        b[283:312, x] = a[283:312, 143 - x]
    save(matte(b[288:358, 37:107], PAGE), "nh-history-acct-plain.png")
    # 송금 칩 동전
    save(matte(a[565:609, 66:110], PAGE), "nh-history-coin.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--history", required=True)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    history(args.history)
