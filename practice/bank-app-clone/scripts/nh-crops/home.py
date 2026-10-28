#!/usr/bin/env python3
"""콕뱅크 홈·시작화면 그림 자르기 (담당: home). 결과는 src/assets/local/nh-*.png

  python3 scripts/nh-crops/home.py --home 홈스크린샷.jpg --video1 녹화1.mp4

- 홈 스크린샷(720px, 1 dp = 1.875 px)에서: 캐릭터(nh-hero), 메뉴 아이콘 4개(nh-menu-*), 지식콕·금융콕 그림(nh-kok-*),
  배너 캐릭터(nh-banner-char, 배너 바탕째 사각형)
- 녹화1(480px, 1 dp = 1.25 px)에서: 시작화면 아이콘(nh-splash-icon), 'NH콕뱅크' 워드마크를 세 조각으로
  (nh-wordmark-nh / -kok / -bank: 따로 사라지는 애니메이션 때문), 위 농협 로고(nh-nonghyup), 아래 MA 로고(nh-ma),
  홈 말풍선 이모지(nh-tip-emoji)

배경이 일정하지 않은 곳(캐릭터 뒤 파란 빛, 메뉴카드 그라데이션)은 바탕을 모형으로 만들어 빼고 바깥을 투명하게 한다.
캐릭터 뒤 빛 모형 = 원형 직선 그라데이션: 중심 (359.5, 638.2)px, 반지름 354.1px, #2f4f74 → #18171c
(홈 스크린샷 바탕 픽셀 4만 개에 맞춘 값, 오차 rmse 0.78) — CSS의 radial-gradient 와 같은 값.
"""
import argparse
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PAGE = np.array([24, 23, 28], float)  # #18171c
GLOW = dict(cx=359.5, cy=638.2, r=354.1, c=np.array([0x2F, 0x4F, 0x74], float))


def save(img, name):
    img.save(OUT / name)
    print(f"{name:26s} {img.width}x{img.height}")


def frame(video, t, tmp):
    out = Path(tmp) / f"f{t}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", str(out)], check=True)
    return np.asarray(Image.open(out).convert("RGB")).astype(float)


def glow_bg(h, w, x0=0, y0=0):
    ys, xs = np.mgrid[y0:y0 + h, x0:x0 + w]
    f = np.clip(1 - np.hypot(xs - GLOW["cx"], ys - GLOW["cy"]) / GLOW["r"], 0, None)[..., None]
    return PAGE + (GLOW["c"] - PAGE) * f


def plane_bg(a):
    """자른 조각 테두리 1px 의 색으로 평면(ax+by+c)을 맞춰 바탕을 만든다 (카드 그라데이션 + 비치는 빛)"""
    h, w = a.shape[:2]
    ys, xs = np.mgrid[:h, :w]
    edge = np.zeros((h, w), bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    M = np.stack([xs[edge], ys[edge], np.ones(edge.sum())], 1)
    coef, *_ = np.linalg.lstsq(M, a[edge], rcond=None)
    return np.stack([xs, ys, np.ones_like(xs)], -1) @ coef


def dist_from(mask, steps):
    """mask 바깥 픽셀의 (체스판) 거리, steps 까지"""
    d = np.full(mask.shape, steps + 1, float)
    cur = mask.copy()
    d[cur] = 0
    for k in range(1, steps + 1):
        nxt = cur.copy()
        nxt[1:] |= cur[:-1]; nxt[:-1] |= cur[1:]; nxt[:, 1:] |= cur[:, :-1]; nxt[:, :-1] |= cur[:, 1:]
        d[nxt & ~cur] = k
        cur = nxt
    return d


def matte(a, bg, tol=10, soft=60):
    """테두리에서부터 바탕(bg, 픽셀별 배열)과 비슷한 곳을 따라가며 투명하게. 경계 픽셀은 바탕을 빼서 원래 색으로 되돌림"""
    h, w = a.shape[:2]
    dist = np.abs(a - bg).max(axis=2)
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not seen[y, x] and dist[y, x] < tol:
            seen[y, x] = True
            q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    alpha = np.where(seen, 0.0, 1.0)
    near = dist_from(seen, 2) <= 2
    edge = near & ~seen
    al = np.clip(dist[edge] / soft, 0.05, 1)
    alpha[edge] = al
    rgb = a.copy()
    rgb[edge] = np.clip((a[edge] - (1 - al)[:, None] * bg[edge]) / al[:, None], 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")


def components(mask, min_area):
    """4-이웃 연결 덩어리 중 min_area 이상만 남김 (빛 그라데이션의 띠 무늬·압축 잡티 제거)"""
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    keep = np.zeros((h, w), bool)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        pix, q = [], deque([(y0, x0)])
        lab[y0, x0] = n
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    q.append((yy, xx))
        if len(pix) >= min_area:
            ys, xs = zip(*pix)
            keep[list(ys), list(xs)] = True
    return keep


def feather(a, bg, core_tol, ramp):
    """캐릭터처럼 바탕과 다른 부분(core)을 꽉 채우고, 그 바깥 ramp px 동안 부드럽게 투명해지게.
    바깥쪽은 바탕만 있는 곳이라 CSS 빛 위에 올려도 이음새가 안 보임"""
    from PIL import ImageFilter
    d = np.asarray(Image.fromarray(np.abs(a - bg).max(axis=2).astype(np.uint8)).filter(ImageFilter.BoxBlur(1))).astype(float)
    core = components(d > core_tol, 300)
    core = np.asarray(Image.fromarray(core.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0  # 가장자리 반투명 픽셀까지
    grow = Image.fromarray(core.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * (ramp // 2) + 1))
    alpha = np.asarray(grow.filter(ImageFilter.GaussianBlur(ramp / 2.5))).astype(float) / 255
    alpha = np.where(core, 1.0, np.clip(alpha, 0, 1))
    ys, xs = np.nonzero(alpha > 0)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    img = np.dstack([a, alpha * 255])[box[1]:box[3], box[0]:box[2]]
    return Image.fromarray(img.round().astype(np.uint8), "RGBA"), box


def home(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    assert a.shape[1] == 720, "홈 스크린샷은 720px 폭"
    # 캐릭터: 빛 모형을 바탕으로 보고 다른 곳(캐릭터 + 발밑 옅은 그림자) + 바깥 8px 페이드
    x0, y0, x1, y1 = 200, 360, 520, 690
    img, box = feather(a[y0:y1, x0:x1], glow_bg(y1 - y0, x1 - x0, x0, y0), 3.5, 8)
    save(img, "nh-hero.png")
    print(f"   hero box (screenshot px) x {x0 + box[0]}–{x0 + box[2]}, y {y0 + box[1]}–{y0 + box[3]}")
    # 메뉴 아이콘: 열 가운데 x(138.5 / 286 / 433 / 580.5)를 중심으로 62×62px, 아이콘 세로 가운데 773.5
    for name, cx in [("send", 138.5), ("myaccount", 286), ("poke", 433), ("dutch", 580.5)]:
        bx0, by0 = int(round(cx - 31)), 743
        c = a[by0:by0 + 62, bx0:bx0 + 62]
        save(matte(c, plane_bg(c), 9, 50), f"nh-menu-{name}.png")
        print(f"   menu {name} box x {bx0}–{bx0 + 62}, y {by0}–{by0 + 62}")
    # 지식콕 전구 / 금융콕 돼지 (카드 그라데이션 위)
    for name, (bx0, by0, bx1, by1) in [("bulb", (212, 1036, 324, 1146)), ("pig", (556, 1040, 644, 1146))]:
        c = a[by0:by1, bx0:bx1]
        save(matte(c, plane_bg(c), 9, 50), f"nh-kok-{name}.png")
        print(f"   kok {name} box x {bx0}–{bx1}, y {by0}–{by1}")
    # 배너 캐릭터: 배너 바탕(#e3effb)이 고르고 그림이 배너 안에만 놓이므로 사각형 그대로 (테두리 픽셀 모두 227,239,251 ±2).
    # 바깥을 투명하게 하면 머리 위 옅은 테두리 같은 반투명 픽셀이 바뀜
    bx0, by0, bx1, by1 = 430, 1222, 664, 1404
    save(Image.fromarray(a[by0:by1, bx0:bx1].astype(np.uint8)), "nh-banner-char.png")
    print(f"   banner char box x {bx0}–{bx1}, y {by0}–{by1}")


def video1(path):
    with tempfile.TemporaryDirectory() as tmp:
        # 흰 화면 아이콘 (창이 다 펼쳐진 뒤 1.5초). 흰 바탕 그대로 사각형으로
        f = frame(path, 1.5, tmp)
        save(Image.fromarray(f[484:580, 188:284].astype(np.uint8)), "nh-splash-icon.png")
        # 어두운 시작화면 (2.3초). 녹화는 어두운 색이 1 낮게 나와서 바탕(23,22,27)을 빼고 투명하게
        f = frame(path, 2.3, tmp)
        bg = np.array([23, 22, 27.])
        for name, (x0, y0, x1, y1) in {
            "nh-nonghyup": (196, 108, 284, 162),
            "nh-ma": (196, 894, 284, 954),
            "nh-wordmark-nh": (118, 430, 206, 478),
            "nh-wordmark-kok": (206, 412, 279, 498),
            "nh-wordmark-bank": (279, 427, 362, 483),
        }.items():
            c = f[y0:y1, x0:x1]
            save(matte(c, np.broadcast_to(bg, c.shape), 7, 60), f"{name}.png")
            print(f"   {name} box (480px) x {x0}–{x1}, y {y0}–{y1}")
        # 홈 말풍선 이모지 (10~13초 동안 그대로). 말풍선 바탕 위
        f = np.mean([frame(path, t, tmp) for t in (11.1, 11.6, 12.1, 12.6)], axis=0)
        c = f[205:237, 88:120]
        save(matte(c, plane_bg(c), 12, 50), "nh-tip-emoji.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--home")
    ap.add_argument("--video1")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.home:
        home(args.home)
    if args.video1:
        video1(args.video1)
