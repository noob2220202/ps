#!/usr/bin/env python3
"""콕뱅크 '전체계좌 조회' · '농협계좌 등록' 화면 그림 자르기 (담당: accounts). 결과는 src/assets/local/nh-accounts-*.png, nh-register-*.png

  python3 scripts/nh-crops/accounts.py --accounts 전체계좌스크린샷.jpg --register 녹화2_62.5초.png

전체계좌 스크린샷(720px, 1 dp = 1.875 px, 바탕 #18171c 단색)에서:
- nh-accounts-acct.png   노란 농협 계좌 아이콘 + 청록 별 (x 66–146, y 786–864 px = 42.67 × 41.6 dp). 바탕을 빼고 투명하게
- nh-accounts-more.png   빈 섹션의 흰 동그라미 (x 312–408, y 1344–1440 px = 51.2 dp, 동그라미 지름 48 dp).
                         안의 점 3개는 화면에서 하나씩 나타나는 애니메이션이라 CSS로 그리고, 그림에서는 지움
                         (점 자리를 위·아래 행의 값으로 세로 직선 보간 — 공의 음영이 세로로만 천천히 바뀜)
녹화2 62.498초 프레임(480px, 1 dp = 1.25 px, 바탕 #17161b)에서 (스크린샷이 없어서 녹화가 가장 큰 해상도):
  프레임 뽑기: ffmpeg -ss 62 -to 63 -i video2.mp4 -copyts -fps_mode passthrough … 중 pts 62.498 인 프레임
- nh-register-char.png   '조회된 농협 계좌가 없습니다.' 위 캐릭터 + 오리 (x 176–306, y 292–404 px = 104 × 89.6 dp)
- nh-register-notice.png '확인하세요' 앞 청록 확성기 + 오른쪽 위 베이지 반짝임 (x 28–58, y 710–741 px = 24 × 24.8 dp).
                         바탕이 한 가지 색이라 사각형 그대로 자름(불투명). matte 를 쓰면 가장자리 색을 안쪽 이웃 색으로 바꾸면서
                         얇은 반짝임(#cbc09d 등)이 확성기의 청록으로 바뀌어 버림. 바탕만 녹화 #17161b → 화면 #18171c 로 옮김
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PAGE = np.array([24, 23, 28], float)  # #18171c (스크린샷)
PAGE_REC = np.array([23, 22, 27], float)  # #17161b (녹화는 1 어둡게 찍힘)


def matte(a, bg, tol=36, ring=2):
    """테두리에서부터 바탕(bg)과 비슷한 곳을 따라가며 투명하게 (scripts/nh-crops/history.py 와 같은 방법).
    경계 ring px 은 '안쪽 이웃 색(f)과 바탕(b) 사이 어디쯤인가'로 불투명도를 정하고 색은 f 로 둠"""
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


def rect_on(a, bg, page, full=24):
    """사각형 그대로(불투명). 바탕에 가까운 픽셀일수록 녹화 바탕(bg)을 화면 바탕(page)으로 옮김 (글자·그림 색은 그대로)"""
    dist = np.abs(a - bg).max(axis=2)
    w = 1 - np.clip(dist / full, 0, 1)
    out = a + (page - bg) * w[..., None]
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8), "RGB")


def save(img, name):
    img.save(OUT / name)
    print(f"{name:28s} {img.width}x{img.height}")


def accounts(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    assert a.shape[1] == 720, "전체계좌 스크린샷은 720px 폭"
    save(matte(a[786:864, 66:146], PAGE), "nh-accounts-acct.png")
    # 흰 공: 점 3개(x 337–383, y 1386–1398)를 세로 보간으로 지움
    b = a.copy()
    y0, y1 = 1385, 1399
    for x in range(336, 384):
        top, bot = b[y0, x], b[y1, x]
        for y in range(y0 + 1, y1):
            t = (y - y0) / (y1 - y0)
            b[y, x] = top * (1 - t) + bot * t
    save(matte(b[1344:1440, 312:408], PAGE, tol=30), "nh-accounts-more.png")


def register(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    assert a.shape[1] == 480, "녹화 프레임은 480px 폭"
    save(matte(a[292:404, 176:306], PAGE_REC, tol=14), "nh-register-char.png")
    save(rect_on(a[710:741, 28:58], PAGE_REC, PAGE), "nh-register-notice.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--accounts", required=True)
    ap.add_argument("--register", required=True)
    args = ap.parse_args()
    accounts(args.accounts)
    register(args.register)
