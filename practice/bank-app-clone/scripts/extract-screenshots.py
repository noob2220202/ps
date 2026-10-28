#!/usr/bin/env python3
"""스크린샷(720px 폭)에서 홈 화면 이미지를 선명하게 다시 잘라 src/assets/local/ 에 저장.
화면 녹화(480px)보다 1.5배 선명하다. 가진 스크린샷만 넘기면 그 부분만 만든다.

  python3 scripts/extract-screenshots.py \
    --home   라이트_홈.jpg        # [노란 카드][mini·농협·AI 목표적금][카드·티머니] 가 보이는 화면
    --dark   다크_홈.jpg          # 같은 화면의 다크 모드 (AI 목표적금 다크 아이콘)
    --bottom 라이트_홈_아래.jpg   # 바로가기 4개 + 아래 광고 카드
    --banner-mcard  배너1.jpg --banner-pcbang 배너2.jpg --banner-friday 배너3.jpg   # 라이트 모드, 배너가 보이는 화면

(2026-10-28 12:00~12:12 스크린샷 기준) 필요: Pillow, numpy

- 위치는 고정 좌표 대신 "배경이 아닌 덩어리"를 찾아서 잡는다 (몇 px 어긋나도 동작)
- 동그라미 아이콘은 4배로 그린 원으로 잘라 가장자리를 부드럽게
- 나머지는 바깥 배경만 투명하게 (누끼) → 라이트/다크 어느 배경에도 올라감
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src/assets/local"


def ink_box(a, x0, x1, y0, y1, threshold=10):
    """구간 안에서 흰 배경(255)과 다른 픽셀의 경계 상자"""
    m = np.abs(255 - a[y0:y1, x0:x1]).max(axis=2) > threshold
    ys, xs = np.nonzero(m)
    return x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1


def circle(img, box):
    """경계 상자에 맞는 원으로 잘라내기 (가장자리 안티앨리어싱)"""
    x0, x1, y0, y1 = box
    size = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    crop = img.crop((round(cx - size / 2), round(cy - size / 2), round(cx + size / 2), round(cy + size / 2))).convert("RGBA")
    big = Image.new("L", (size * 4, size * 4), 0)
    # 1px 안쪽까지만: 원 바깥 경계에 섞인 흰 배경이 다크 모드에서 흰 테두리로 보이지 않게
    ImageDraw.Draw(big).ellipse((5, 5, size * 4 - 6, size * 4 - 6), fill=255)
    crop.putalpha(big.resize((size, size), Image.LANCZOS))
    return crop


def cutout(img, box, is_bg):
    """테두리에서부터 배경색인 픽셀을 따라 들어가며(flood fill) 투명하게.
    그림 안쪽의 흰색(카드 무늬 등)은 바깥과 이어져 있지 않으면 남는다."""
    x0, x1, y0, y1 = box
    crop = img.crop((x0 - 2, y0 - 2, x1 + 2, y1 + 2)).convert("RGBA")
    a = np.asarray(crop).copy()
    h, w = a.shape[:2]
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if not (0 <= y < h and 0 <= x < w) or seen[y, x] or not is_bg(a[y, x, :3]):
            continue
        seen[y, x] = True
        q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    a[seen, 3] = 0
    # 경계 2px: 흰 배경과 섞여 연해진 픽셀 → "흰색을 빼고" 원래 색 + 반투명으로 되돌린다
    # (섞인 색 c = 원래색·α + 흰색·(1-α) 를 거꾸로 풀기). 안 하면 다크 모드에서 하얀 테두리가 보임
    near = seen.copy()
    for _ in range(2):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    edge = near & ~seen
    c = a[edge, :3].astype(float)
    alpha = np.clip((255 - c.min(axis=1)) / 110, 0.05, 1)[:, None]
    a[edge, :3] = np.clip((c - (1 - alpha) * 255) / alpha, 0, 255).astype(np.uint8)
    a[edge, 3] = (alpha[:, 0] * 255).astype(np.uint8)
    return Image.fromarray(a)


def load(path):
    img = Image.open(path).convert("RGB")
    if img.width != 720:
        img = img.resize((720, round(img.height * 720 / img.width)), Image.LANCZOS)
    return img, np.asarray(img).astype(int)


def save(img, name):
    img.save(OUT / name)
    print(f"{name:28s} {img.width}x{img.height}")


near_white = lambda c: c.min() > 236  # noqa: E731  흰색 + 아이콘 뒤 연회색(#f5f5f5)


def home(path):
    img, a = load(path)
    for name, area, how in [
        ("bank-nh.png", (50, 145, 470, 565), "circle"),
        ("ai-saving.light.png", (50, 145, 585, 685), "circle"),
        ("tmoney.png", (50, 145, 1170, 1265), "cutout"),
    ]:
        box = ink_box(a, *area, threshold=8 if how == "circle" else 20)
        save(circle(img, box) if how == "circle" else cutout(img, box, near_white), name)

    # 카드: 아래로 이어진 끈(가는 선)은 CSS가 그리므로 카드 부분만. 폭이 끈 굵기(≈4px)로 줄어드는 줄에서 끊는다
    x0, x1, y0, _ = ink_box(a, 60, 135, 955, 1050)
    y1 = y0
    while (np.abs(255 - a[y1, x0:x1]).max(axis=1) > 10).sum() > 8:
        y1 += 1
    save(cutout(img, (x0, x1, y0, y1), near_white), "card.png")
    # 예전 테마별 카드(녹화에서 자른 흐린 것)는 지운다 → card.png 하나를 두 테마에서 같이 씀
    for old in ("card.light.png", "card.dark.png"):
        (OUT / old).unlink(missing_ok=True)


def dark(path):
    img, a = load(path)
    bg = a[700, 40]  # 다크 카드 배경색
    m = np.abs(a[900:1000, 50:145] - bg).max(axis=2) > 10
    ys, xs = np.nonzero(m)
    save(circle(img, (50 + xs.min(), 51 + xs.max(), 900 + ys.min(), 901 + ys.max())), "ai-saving.dark.png")


def bottom(path):
    img, a = load(path)
    # 바로가기 아이콘 4개 (위에서부터 실제 앱 순서)
    names = ["shortcut-subsidy", "shortcut-timetable", "shortcut-allowance", "shortcut-coupon"]
    for name, y0 in zip(names, (700, 795, 890, 985)):
        x0, x1, y0b, y1 = ink_box(a, 55, 135, y0, y0 + 80, threshold=14)
        # 정사각형으로 맞춰서 (아이콘마다 가로세로가 조금씩 달라도 같은 크기 칸에 들어가게)
        size = max(x1 - x0, y1 - y0b) + 4
        cx, cy = (x0 + x1) // 2, (y0b + y1) // 2
        save(cutout(img, (cx - size // 2, cx + size // 2, cy - size // 2, cy + size // 2), near_white), f"{name}.png")
    # 광고 상품 사진: 연회색(#f7f7f7) 광고 카드 위의 흰 상자 그대로
    ad_bg = a[1250, 40]
    m = np.abs(a[1190:1330, 420:655] - ad_bg).max(axis=2) > 4
    ys, xs = np.nonzero(m)
    save(img.crop((420 + xs.min(), 1190 + ys.min(), 421 + xs.max(), 1191 + ys.max())), "ad-product.png")
    # 광고 출처의 작은 로고 ("○○ 앱에서 구매하기" 앞)
    save(cutout(img, (70, 98, 1214, 1233), near_white), "ad-logo.png")


def banner(path, name):
    """배너 오른쪽 그림. 세 배너 모두 같은 틀(192×150px)로 잘라야 화면에서 위치가 실제와 같다"""
    img, _ = load(path)
    save(cutout(img, (455, 647, 260, 410), near_white), f"{name}.png")
    # 예전 흰 배경째 자른 라이트 전용 파일은 지움 (이제 배경이 투명해서 두 테마 공통)
    (OUT / f"{name}.light.png").unlink(missing_ok=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for flag in ("home", "dark", "bottom", "banner-mcard", "banner-pcbang", "banner-friday"):
        ap.add_argument(f"--{flag}")
    args = vars(ap.parse_args())
    if not any(args.values()):
        ap.error("스크린샷을 하나 이상 넘겨 주세요")
    OUT.mkdir(parents=True, exist_ok=True)
    for flag, fn in (("home", home), ("dark", dark), ("bottom", bottom)):
        if args[flag]:
            fn(args[flag])
    for flag in ("banner_mcard", "banner_pcbang", "banner_friday"):
        if args[flag]:
            banner(args[flag], flag.replace("_", "-"))
