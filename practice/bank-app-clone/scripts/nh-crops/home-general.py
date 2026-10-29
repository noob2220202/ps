#!/usr/bin/env python3
"""콕뱅크 '일반' 홈 화면 그림 자르기. 결과는 src/assets/local/nh-gh-*.png

  python3 scripts/nh-crops/home-general.py --video3 일반홈녹화.mp4 [--appstore 앱스토어_메인.png]

녹화3(480×1066, 다크모드 일반 홈, 1 dp = 1.25 px)에서 4fps 프레임을 뽑아:
- 화면이 멈춰 있는 구간의 프레임을 평균(압축 잡음 줄이기)하고, 흰 카드 안의 그림만 잘라 냄 (바탕 흰색 그대로 — 카드가 흰색이라)
- 배너 9개는 각 배너가 떠 있는 구간을 평균
- 금융상품 '농협 생활 백서' 확성기는 스크롤 중에만 보여서, 스크롤 양만큼 맞춰 겹친 뒤 평균
- 마이데이터 계기판 오른쪽 아래는 위로가기(↑) 버튼에 가려서 왼쪽 아래를 좌우로 뒤집어 채움
- 아래 탭바 아이콘 5개는 회색 한 색이라 밝기 → 투명도(마스크)로 바꿔 저장 (색은 CSS)
앱스토어 스크린샷(1242×2688, 밝은 모드, 1 dp ≈ 1.888 px)에서: 콕추천 '준조합원 가입' 그림
화면 위치(dp)는 아래 표에 적은 값. 필요: ffmpeg, Pillow, numpy
"""
import argparse, os, subprocess, tempfile
import numpy as np
from PIL import Image

S = 1.25
OUT = "src/assets/local"


def frames(video):
    d = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", "fps=4", f"{d}/f%04d.png"], check=True)
    return lambda i: np.asarray(Image.open(f"{d}/f{i:04d}.png").convert("RGB")).astype(float)


def avg(get, idx, dy=None):
    """프레임 평균. dy[i] = 그 프레임의 스크롤 양(px) → 페이지 좌표로 맞춰 겹침"""
    if dy is None:
        return np.mean([get(i) for i in idx], 0)
    h = 1066 + max(dy.values())
    acc = np.zeros((h, 480, 3)); cnt = np.zeros((h, 1, 1))
    for i in idx:
        acc[dy[i] : dy[i] + 1066] += get(i); cnt[dy[i] : dy[i] + 1066] += 1
    return acc / np.maximum(cnt, 1)


def crop(img, x0, y0, x1, y1, s=S):
    return img[round(y0 * s) : round(y1 * s), round(x0 * s) : round(x1 * s)]


def tight(a, thr=14, pad=2):
    """흰 바탕에서 그림이 있는 곳만 (흰색과 thr 이상 다른 픽셀의 상자 + pad)"""
    m = (255 - a).max(2) > thr
    ys, xs = np.where(m)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + 1 + pad, a.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + 1 + pad, a.shape[1])
    return a[y0:y1, x0:x1], (x0, y0)


def save(a, name, origin_dp=None, s=S):
    Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8)).save(f"{OUT}/{name}.png")
    h, w = a.shape[:2]
    print(f"{name}: {w}x{h}px = {w / s:.1f} x {h / s:.1f} dp" + (f" at ({origin_dp[0]:.1f}, {origin_dp[1]:.1f})" if origin_dp else ""))


def erase_text(a, upto):
    """글자(무채색 회색·검정)를 흰색으로 지움 — 화면에선 진짜 글자를 그 위에 그림. upto: 이 열(px)보다 왼쪽만"""
    mx = a.max(2); mn = a.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    m = (sat < 0.2) & (mx < 245)
    m[:, upto:] = False
    for _ in range(2):  # 글자 가장자리 2px 까지 (흐린 무채색)
        m2 = m.copy()
        m2[1:] |= m[:-1]; m2[:-1] |= m[1:]; m2[:, 1:] |= m[:, :-1]; m2[:, :-1] |= m[:, 1:]
        m = m2 & (sat < 0.25)
        m[:, upto:] = False
    a[m] = 255


def erase_color(a, color, rows, upto):
    """색 글자(배너 맨 윗줄 분류 글자): 흰색 ~ 글자색 사이 색인 픽셀을 지움. rows: (y0, y1) px, upto: 열 px"""
    c = np.array(color, float)
    d = c - 255
    seg = a[rows[0] : rows[1], :upto]
    t = np.clip(((seg - 255) * d).sum(2) / (d * d).sum(), 0, 1)
    dist = np.linalg.norm(seg - (255 + t[..., None] * d), axis=2)
    seg[(dist < 40) & (t > 0.04)] = 255


def cut(img, name, box, s=S, thr=14, white_outside=None, text_upto=None, color_text=None):
    """box(dp) 안에서 그림 상자만 잘라 저장. white_outside: 카드 둥근 모서리 밖을 흰색으로 (카드 x0,y0,x1,y1,반지름 dp)
    text_upto: 이 x(dp)보다 왼쪽의 글자를 지움"""
    a = crop(img, *box, s=s).copy()
    if text_upto:
        erase_text(a, round((text_upto - box[0]) * s))
    if color_text:  # (색, y0 dp, y1 dp, x 끝 dp)
        col, y0, y1, xe = color_text
        erase_color(a, col, (max(round((y0 - box[1]) * s), 0), round((y1 - box[1]) * s)), round((xe - box[0]) * s))
    if white_outside:
        cx0, cy0, cx1, cy1, r = white_outside
        H, W = a.shape[:2]
        for y in range(H):
            for x in range(W):
                X = box[0] + (x + 0.5) / s; Y = box[1] + (y + 0.5) / s
                dx = max(cx0 + r - X, 0, X - (cx1 - r)); dy = max(cy0 + r - Y, 0, Y - (cy1 - r))
                if X < cx0 or X > cx1 or Y < cy0 or Y > cy1 or dx * dx + dy * dy > r * r:
                    a[y, x] = 255
    t, (ox, oy) = tight(a, thr)
    save(t, name, (box[0] + ox / s, box[1] + oy / s), s)


def mask(img, name, box, s=S):
    """회색 아이콘 → 흰색 + 투명도 (바탕 밝기 0, 아이콘 밝기 1)"""
    a = crop(img, *box, s=s).mean(2)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]))
    fg = a.max()
    al = np.clip((a - bg) / (fg - bg), 0, 1)
    out = np.dstack([np.full_like(al, 255)] * 3 + [al * 255])
    Image.fromarray(out.round().astype(np.uint8), "RGBA").save(f"{OUT}/{name}.png")
    print(f"{name}: mask {a.shape[1]}x{a.shape[0]}px at ({box[0]}, {box[1]}) dp")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video3", required=True)
    ap.add_argument("--appstore")
    o = ap.parse_args()
    get = frames(o.video3)

    top = avg(get, range(13, 25))  # 3~6초: 맨 위, 배너 1번
    # 콕추천 카드 (가운데 68~316, 왼쪽 카드는 52 에서 끝남), y 416~521, 모서리 20
    cut(top, "nh-gh-rec-diary", (214, 418, 316, 521), white_outside=(68, 416.4, 316, 521, 20), text_upto=240)
    cut(top, "nh-gh-rec-coin", (0, 418, 52, 521), white_outside=(-200, 416.4, 52, 521, 20))
    # 배너 (24~360, 551.6~684, 모서리 22): 오른쪽 그림. 배너마다 떠 있는 프레임 구간
    TEXT_END = {1: 226, 2: 200, 3: 200, 4: 240, 5: 200, 6: 200, 7: 200, 8: 220, 9: 206}  # 배너 제목·링크 글자 오른쪽 끝 + 여유 (dp)
    groups = [range(13, 25), range(55, 58), range(60, 83), range(86, 108), range(111, 118), range(121, 126), range(130, 133), range(137, 139), range(143, 146)]
    for k, g in enumerate(groups, 1):
        b = avg(get, g)
        if k == 2:  # AD 표시는 화면에서 그림
            b[round(553 * S) : round(574 * S), round(322 * S) : round(352 * S)] = 255
        col = b[round(566 * S) : round(588 * S), round(46 * S) : round(150 * S)].reshape(-1, 3)
        col = col[col.min(1).argmin()]  # 분류 글자에서 가장 진한 픽셀 = 글자색
        cut(b, f"nh-gh-banner-{k}", (196, 553, 360, 684), white_outside=(24, 551.6, 360, 684.4, 22), text_upto=TEXT_END[k], color_text=(col, 564, 590, 345))
    # 아래 탭바 아이콘 (가운데 x 45.4/118.8/192.4/266.2/338.8, y 793.6, 26dp 상자. 글자는 808 부터)
    for k, cx in enumerate([45.4, 118.8, 192.4, 266.2, 338.8], 1):
        mask(top, f"nh-gh-tab-{k}", (cx - 13, 793.6 - 13, cx + 13, 793.6 + 13))

    # 금융상품 타일: 글자(제목 두 줄)는 그림 왼쪽에서 끝남 → 그 앞까지만 지움 (민트색 확성기가 무채색에 가까워서)
    # 스크롤 위치: 프레임 38·39 = 822px, 46~48 = 1032px. 30~34 는 스크롤 중 (423/463/497/559/622px)
    mid = avg(get, [38, 39])
    off = 822 / S
    cut(mid, "nh-gh-fin-saving", (232, 998 - off, 358, 1118 - off), white_outside=(24, 925 - off, 360, 1120 - off, 22))
    cut(mid, "nh-gh-tile-rice", (100, 1232 - off, 185, 1291 - off), white_outside=(24, 1178 - off, 186, 1292 - off, 22), text_upto=128)
    cut(mid, "nh-gh-tile-sale", (262, 1232 - off, 359, 1291 - off), white_outside=(198, 1178 - off, 360, 1292 - off, 22), text_upto=300)
    bot = avg(get, [46, 47, 48])
    off = 1032 / S
    cut(bot, "nh-gh-tile-target", (100, 1368 - off, 185, 1426 - off), white_outside=(24, 1314 - off, 186, 1427 - off, 22), text_upto=128)
    cut(bot, "nh-gh-tile-mall", (262, 1368 - off, 359, 1426 - off), white_outside=(198, 1314 - off, 360, 1427 - off, 22), text_upto=300)
    # 마이데이터 계기판: 오른쪽 아래가 ↑ 버튼(무채색 원·그림자)에 가려짐 → 가운데 세로선 기준 왼쪽을 뒤집어 채움
    g = crop(bot, 266, 1528 - off, 336, 1592 - off).copy()
    gm = (255 - g).max(2) > 14
    ys, xs = np.where(gm[: g.shape[0] // 2])
    cx = (xs.min() + xs.max()) / 2
    mx = g.max(2); mn = g.min(2)
    neutral = (((mx - mn) / np.maximum(mx, 1) < 0.1) | (mx < 70)) & (mx < 250)
    H, W = neutral.shape
    for y, x in zip(*np.where(neutral)):
        if y < H / 2 or x < cx:
            continue
        m = int(round(2 * cx - x))
        g[y, x] = g[y, m] if 0 <= m < W else 255
    t, (ox, oy) = tight(g)
    save(t, "nh-gh-mydata", (266 + ox / S, 1528 + oy / S))
    # 확성기 (농협 생활 백서): 스크롤 중 프레임 30~34 를 스크롤 양만큼 맞춰 평균
    dy = {30: 423, 31: 463, 32: 497, 33: 559, 34: 622}
    page = avg(get, dy.keys(), {i: v - 423 for i, v in dy.items()})  # 페이지 y = 프레임 y + 스크롤 (423px 를 0 으로)
    shift = 423 / S
    cut(page, "nh-gh-fin-notice", (36, 822 - shift, 100, 886 - shift))

    if o.appstore:  # 밝은 모드 메인 (1 dp ≈ 1.888 px, 화면 왼쪽 위 = 259, 872 px)
        a = np.asarray(Image.open(o.appstore).convert("RGB")).astype(float)[872:, 259:]
        cut(a, "nh-gh-rec-tax", (205, 425, 306, 512), s=1.888, white_outside=(71, 422, 313, 514, 22))


if __name__ == "__main__":
    main()
