#!/usr/bin/env python3
"""하나원큐 아이콘·배경을 실제 스크린샷(720px, 1dp = 1.875px)·녹화(480px)에서 잘라 src/assets/local/ 에 저장.

  python3 scripts/hana-crops/icons.py --shots <스크린샷 폴더> --frames <scratchpad/hana 폴더(L/, D/ 프레임)>

아이콘은 **알파 마스크**(검은 RGBA, 알파 = 바탕보다 어두워진 비율)로 저장 → 화면에서는 CSS mask + background: currentColor 로
칠해서 라이트/다크 둘 다 씀 (hana-ic-<이름>.png, 2px 여백). 흰 아이콘(검색 칩 돋보기)은 밝아진 비율로.
공유 아이콘 3개(카카오톡·문자·내역복사)는 색이 있어서 원 바탕(#f6f7f9)을 걷어 낸 한 색 RGBA 로 (hana-share-*.png).
배경: 다크는 글자 없는 프레임 D/0012 를 그대로(hana-home-bg-dark.jpg), 라이트는 홈 스크린샷 8dd6d3c1 에서 글자·카드 자리를
위아래 색으로 메워서(hana-home-bg-light.jpg). 둘 다 상태바 아래(28dp)부터.
필요: Pillow, numpy
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SHOTS = {"home": "8dd6d3c1", "home-mid": "069b9ebb", "home-b3": "a45ca0f6", "history": "95fd8510", "detail": "b296deb7", "sheet": "0871415a"}
# 이름: (스크린샷, 대략 상자 x0,y0,x1,y1 (px@720), 모드) — 상자 안에서 잉크를 찾아 가운데 맞춰 자름
ICONS = {
    "my": ("home", (20, 60, 110, 150), "dark"),
    "wallet": ("home", (540, 65, 612, 145), "dark"),
    "scan": ("home-mid", (540, 65, 612, 145), "dark"),
    "bell": ("home", (606, 65, 686, 145), "dark", None, (668, 86, 15)),  # N 배지(분홍, 가운데 668,86 r≈13)는 원째 지움
    "copy": ("home", (556, 328, 600, 372), "dark"),
    "more": ("home", (645, 265, 672, 315), "dark"),
    "gear": ("home", (436, 652, 480, 698), "dark"),
    "view-arrow": ("home", (622, 790, 650, 832), "dark"),
    "tab-home": ("home", (50, 1450, 120, 1500), "dark"),  # 아이콘 잉크 y 1459~1491, 글자는 1510~ 라 상자에서 뺌
    "tab-asset": ("home", (190, 1450, 260, 1500), "dark"),
    "tab-product": ("home", (325, 1450, 395, 1500), "dark"),
    "tab-invest": ("home", (460, 1450, 530, 1500), "dark"),
    "tab-menu": ("home", (595, 1450, 665, 1500), "dark"),
    "search-white": ("home", (40, 1384, 83, 1414), "light", (0, 163, 142)),  # 초록 칩 위 흰 돋보기
    "double-down": ("home-b3", (335, 1470, 390, 1525), "dark"),
    "back": ("history", (30, 80, 80, 130), "dark"),
    "close": ("detail", (630, 80, 685, 130), "dark"),
    "chevron-down": ("history", (414, 285, 448, 325), "dark"),
    "search": ("history", (36, 676, 80, 722), "dark"),
    "sort": ("history", (652, 682, 688, 718), "dark"),
}
PAD = 2


def load(shots, key):
    f = next(Path(shots).glob(f"{SHOTS[key]}*"))
    return np.asarray(Image.open(f).convert("RGB")).astype(float)


def border_bg(c):
    """상자 가장자리 색으로 안쪽 바탕을 추정 (가로·세로 그라데이션을 따라감): 위↔아래, 왼↔오른 보간의 평균"""
    h, w, _ = c.shape
    ty = (np.arange(h) / max(h - 1, 1))[:, None, None]
    tx = (np.arange(w) / max(w - 1, 1))[None, :, None]
    v = c[0][None] * (1 - ty) + c[-1][None] * ty
    hz = c[:, 0][:, None] * (1 - tx) + c[:, -1][:, None] * tx
    return (v + hz) / 2


def mask_of(c, bg, mode):
    """바탕(bg)보다 어두워진(dark) / 밝아진(light) 비율 → 알파. 바탕색과 다른 색(분홍 배지 등)은 채도로 걷어 냄"""
    if mode == "dark":
        a = np.clip((np.maximum(bg - c, 0) / np.maximum(bg, 1)).max(axis=2), 0, 1)
    else:
        a = np.clip((np.maximum(c - bg, 0) / np.maximum(255 - bg, 1)).max(axis=2), 0, 1)
    a = np.where(a < 0.1, 0, a)
    # 걷어 낸 전경색의 채도: 검정/흰 아이콘이면 낮고, 분홍 배지면 높음
    safe = np.where(a == 0, 1, a)[..., None]
    fg = np.clip(bg - (bg - c) / safe, 0, 255) if mode == "dark" else np.clip(bg + (c - bg) / safe, 0, 255)
    sat = fg.max(axis=2) - fg.min(axis=2)
    a = np.where((a > 0.3) & (sat > 70), 0, a)
    return a


def crop_icon(a, box, mode, bg=None, hole=None):
    x0, y0, x1, y1 = box
    c = a[y0:y1, x0:x1]
    bg = np.array(bg, float) if bg is not None else border_bg(c)
    m = mask_of(c, bg, mode)
    if hole:  # (cx, cy, r) 원 안은 지움 (알림 종의 N 배지)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        m = np.where((xx - hole[0]) ** 2 + (yy - hole[1]) ** 2 <= hole[2] ** 2, 0, m)
    ys, xs = np.where(m > 0.25)
    if not len(xs):
        raise SystemExit(f"잉크 없음: {box}")
    bx0, bx1, by0, by1 = xs.min() - PAD, xs.max() + 1 + PAD, ys.min() - PAD, ys.max() + 1 + PAD
    m = m[max(by0, 0):by1, max(bx0, 0):bx1]
    rgba = np.zeros((*m.shape, 4), np.uint8)
    rgba[..., 3] = (m * 255).astype(np.uint8)
    return rgba, (xs.min() + x0, ys.min() + y0, xs.max() + 1 + x0, ys.max() + 1 + y0)


def save(arr, name, **kw):
    Image.fromarray(arr).save(OUT / name, optimize=True, **kw)


def share_icons(a):
    """상세 화면 공유 원 3개 (ø≈88px, 가운데 y≈1305): 원 바탕 #f6f7f9 를 걷어 낸 RGBA.
    아이콘마다 한 가지 색이라 가장 진한 1% 의 평균을 전경색으로 두고, 알파 = (바탕 − 픽셀)을 (바탕 − 전경색) 쪽으로 투영한 비율.
    (픽셀마다 가장 옅은 알파로 풀면 회색 아이콘이 '반투명 검정'이 돼서 다크의 어두운 원 위에서 거의 안 보임 — D/0213 은 라이트와 같은 색)"""
    out = {}
    bg = np.array([246.0, 247, 249])
    for name, cx in (("kakao", 209), ("sms", 359), ("copy", 509)):
        c = a[1261:1349, cx - 44:cx + 44]
        d = bg - c
        dist = np.sqrt((d**2).sum(axis=2))
        core = c[dist >= np.percentile(dist, 99)].mean(axis=0)
        v = bg - core
        al = np.clip((d * v).sum(axis=2) / (v * v).sum(), 0, 1)
        al = np.where(al < 0.08, 0, al)
        fg = np.broadcast_to(core, c.shape)
        yy, xx = np.mgrid[0:88, 0:88]
        al = np.where((xx - 44) ** 2 + (yy - 44) ** 2 > 40 * 40, 0, al)  # 원 밖(흰 페이지) 제거
        ys, xs = np.where(al > 0.25)
        x0, x1, y0, y1 = xs.min() - PAD, xs.max() + 1 + PAD, ys.min() - PAD, ys.max() + 1 + PAD
        rgba = np.dstack([fg, al * 255]).astype(np.uint8)[y0:y1, x0:x1]
        out[name] = (rgba, (x1 - x0, y1 - y0))
    return out


def fill_boxes(img, boxes, k):
    """상자(dp, 앱 영역 기준) 안을 위·아래 줄 색으로 세로 보간해 메움. k = px/dp"""
    for x0, y0, x1, y1 in boxes:
        x0, y0, x1, y1 = (int(round(v * k)) for v in (x0, y0, x1, y1))
        top, bot = img[y0 - 1], img[y1]
        t = (np.arange(y1 - y0) / max(y1 - y0 - 1, 1))[:, None, None]
        img[y0:y1, x0:x1] = top[None, x0:x1] * (1 - t) + bot[None, x0:x1] * t


HEADER_BOXES = [(14, 6, 50, 50), (218, 10, 283, 46), (286, 6, 324, 50), (328, 6, 368, 50)]  # MY · 홈|간편 · 지갑/스캔 · 종 (dp)
# 글줄·버튼 상자 (앱 영역 dp, 상태바 뺀 좌표 = CSS 값): 입출금|통장이름·⋮ / 하나은행 번호·복사 / 한도계좌 / 잔액·숨김 / 가져오기·보내기 / 1/2·톱니
TEXT_BOXES = [(60, 112, 365, 143), (60, 142, 322, 172), (150, 171, 234, 196), (100, 194, 282, 236), (60, 252, 326, 304), (118, 320, 268, 350)]
CARDS_TOP = 378.7  # 전체계좌 카드 위 (358 + 20.7)


def home_bg(a, k, page):
    """홈 화면(글자·카드 있음) → 글자·카드 자리를 메운 배경. a 는 상태바 포함 전체 화면, k = px/dp.
    글줄은 위·아래 색으로 세로 보간, 카드 영역은 줄마다 왼쪽 여백(x 4~16dp)·오른쪽 여백(x 368~380dp) 색으로 가로 보간
    (작은 카드 줄은 오른쪽 여백까지 카드가 덮어서 그 줄들은 위아래 여백 색으로), 탭 판(686.7dp~)은 페이지색으로 이어 붙임"""
    img = a[int(28 * k) :].copy()
    h, w, _ = img.shape
    fill_boxes(img, HEADER_BOXES + TEXT_BOXES, k)
    y0 = int(CARDS_TOP * k)
    left = np.median(img[y0:, int(4 * k) : int(16 * k)], axis=1)
    right = np.median(img[y0:, int(368 * k) : int(380 * k)], axis=1)
    # 작은 카드 줄(614.5~682.8dp)은 셋째 카드가 오른쪽 끝까지 덮어서(글자까지) 줄째로 카드 취급
    card = np.zeros(len(right), bool)
    card[int(612 * k) - y0 : int(686 * k) - y0] = True
    idx = np.arange(len(right))
    if card.any():
        for ch in range(3):
            right[card, ch] = np.interp(idx[card], idx[~card], right[~card, ch])
    t = (np.arange(w) / (w - 1))[None, :, None]
    img[y0:] = left[:, None] * (1 - t) + right[:, None] * t
    y1, y2 = int(686 * k), min(int(800 * k), h)
    tt = (np.arange(y2 - y1) / (y2 - y1 - 1))[:, None, None]
    img[y1:y2] = img[y1 - 1][None] * (1 - tt) + page[None, None] * tt
    img[y2:] = page
    from PIL import ImageFilter
    return Image.fromarray(img.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", required=True)
    ap.add_argument("--frames", required=True, help="scratchpad/hana (D/0012.jpg 가 있는 곳)")
    ap.add_argument("--preview", help="잘라 낸 것들을 한 장에 모아 볼 파일")
    args = ap.parse_args()

    shots = {k: load(args.shots, k) for k in SHOTS}
    sizes = {}
    previews = []
    for name, (shot, box, mode, *rest) in ICONS.items():
        rgba, ink = crop_icon(shots[shot], box, mode, *rest)
        save(rgba, f"hana-ic-{name}.png")
        sizes[name] = (rgba.shape[1] / 1.875, rgba.shape[0] / 1.875)
        print(f"hana-ic-{name:12s} 잉크 x {ink[0]}-{ink[2]} y {ink[1]}-{ink[3]} (px@720) → 상자 {sizes[name][0]:.1f} × {sizes[name][1]:.1f} dp")
        previews.append(rgba)
    for name, (rgba, _) in share_icons(shots["detail"]).items():
        save(rgba, f"hana-share-{name}.png")
        print(f"hana-share-{name}: {rgba.shape[1] / 1.875:.1f} × {rgba.shape[0] / 1.875:.1f} dp")
        previews.append(rgba)

    # 라이트: 스크린샷 8dd6d3c1 (720px). 다크: 녹화 D/0014 (480px, 글자 뜬 뒤 그라데이션이 다 나타난 첫 프레임)
    light = home_bg(shots["home"], 1.875, np.array([241.0, 242, 244]))
    light.save(OUT / "hana-home-bg-light.jpg", quality=93)
    d = np.asarray(Image.open(Path(args.frames) / "D/0014.jpg").convert("RGB")).astype(float)
    d[:, :8] = d[:, 8:9]  # 왼쪽 끝 갤럭시 엣지 패널 손잡이(녹화에만 있는 밝은 세로 막대)를 옆 열 색으로
    dark = home_bg(d, 1.25, np.array([32.0, 33, 37]))
    dark.save(OUT / "hana-home-bg-dark.jpg", quality=93)
    print("배경 저장: hana-home-bg-light.jpg", light.size, "(1dp = 1.875px) / hana-home-bg-dark.jpg", dark.size, "(1dp = 1.25px)")

    if args.preview:
        W = 1200
        x = y = rowh = 0
        canvas = Image.new("RGB", (W, 400), (230, 232, 236))
        for p in previews:
            im = Image.fromarray(p)
            if x + im.width > W:
                x, y, rowh = 0, y + rowh + 8, 0
            canvas.paste(im, (x, y), im)
            x += im.width + 8
            rowh = max(rowh, im.height)
        canvas.save(args.preview)


if __name__ == "__main__":
    main()
