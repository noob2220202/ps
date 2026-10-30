#!/usr/bin/env python3
"""하나원큐 화면 그림을 스크린샷·녹화에서 잘라 src/assets/local/hana-*.png 로 저장.

  python3 scripts/hana-crops/crops.py --shots <스크린샷 폴더> --dark <다크 녹화.mp4>

스크린샷(720×1600, 1dp = 1.875px, 2026-10-30)은 파일 이름 앞 8자리로 찾음 (아래 SHOTS).
  은행 로고      은행선택 시트의 타일(#f9fafc) 위 로고 → 타일 바탕을 걷어 낸 투명 PNG (hana-bank-<code>.png)
  배너 그림 10장 홈 배너 카드 오른쪽 그림 → 흰 바탕을 가장자리부터 걷어 냄 (다크 카드에도 놓이게) (hana-banner-<n>.png)
  메뉴 아이콘    홈 메뉴 카드 6개 (hana-menu-<n>.png), 하나금융그룹 보물상자 (hana-chest.png), 하나 로고 (hana-symbol.png)
  시작화면 로고  다크 녹화 5초쯤 '하나 1Q 원큐' (검은 바탕 → 투명) (hana-splash-logo.png)
그림은 자른 상자 그대로 화면에 놓으면(상자 가운데 = 원래 자리) 위치가 맞도록 상자 크기·가운데를 고정해서 자름.
필요: ffmpeg, Pillow, numpy
"""
import argparse
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
SHOTS = {
    "pick-top": "0871415a", "pick-mid": "64921a25", "pick-end": "eb102624",
    "home-10": "8dd6d3c1", "home-9": "14d34e1b", "home-8": "52031110", "home-7": "2b07370e", "home-6": "24c86a40",
    "home-5": "edfc2c4f", "home-4": "6e404abd", "home-3": "a45ca0f6", "home-2": "be567d7b", "home-1": "7d773389",
    "home-bottom": "d3850f0b", "home-menu": "069b9ebb", "history": "95fd8510",
}
# 배너 카드 위쪽 y (px) — 화면마다 스크롤이 달라서
BANNER_TOP = {10: 881, 9: 388, 8: 388, 7: 388, 6: 388, 5: 571, 4: 571, 3: 571, 2: 571, 1: 571}

# 은행선택 타일: 왼쪽 x 37 / 260 / 484, 폭 199, 높이 184, 줄 간격 208. 로고 가운데 = 타일 위 + 67px
COLS = (136.5, 359.5, 583.5)
PICK = {
    "pick-top": (459, [["hana", "kb", "shinhyup"], ["woori", "kn", "kj"], ["ibk", "nh", "busan"],
                       ["nfcf", "kdb", "mg"], ["suhyup", "shinhan", "post"]]),
    "pick-mid": (440, [["jb", "jeju", "kakao"], ["kbank", "toss", "citi"], ["im", "sc", "savings"],
                       ["deutsche", "boc", "ccb"], ["icbc", "bnp", "boa"]]),
    "pick-end": (499 + 3 * 208, [["hsbc", "jpm", "tax-national"], ["tax-customs", "tax-treasury", "tax-local"]]),
}
LOGO_BOX = (96, 66)  # 로고 자르는 상자 (px) = 51.2×35.2dp
TILE = np.array([249, 250, 252], float)


def load(shots, key):
    f = next(Path(shots).glob(f"{SHOTS[key]}*"))
    return np.asarray(Image.open(f).convert("RGB")).astype(float)


def unblend(c, bg):
    """밝은 바탕(bg) 위에 그려진 그림에서 바탕을 걷어 냄: 바탕보다 가장 어두워진 채널 비율을 불투명도로.
    바탕보다 밝은 픽셀은 JPEG 가장자리 번짐이라 버림 (다크 타일 위에서 흰 점으로 보이지 않게)"""
    d = np.maximum(bg - c, 0)
    a = np.clip((d / bg).max(axis=2), 0, 1)
    a = np.where(a < 0.09, 0, a)
    safe = np.where(a == 0, 1, a)[..., None]
    fg = np.clip(bg - d / safe, 0, 255)
    return np.dstack([fg, a * 255]).astype(np.uint8)


def crop_box(a, cx, cy, w, h):
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    return a[y0:y0 + h, x0:x0 + w]


def flood_clear(c, near=236):
    """가장자리에서부터 이어진 흰 바탕만 투명하게 (그림 안쪽 흰 부분은 남김). 경계 2px 은 흰 바탕에서 걷어 냄"""
    h, w, _ = c.shape
    white = c.min(axis=2) >= near
    bg = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if white[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if white[y, x])
    for y, x in q:
        bg[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    # 바탕에서 2px 안쪽 띠: 흰색에서 걷어 낸 값, 그 안쪽은 그대로
    band = np.zeros_like(bg)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            band |= np.roll(np.roll(bg, dy, 0), dx, 1)
    band &= ~bg
    out = np.dstack([c, np.full((h, w), 255.0)])
    soft = unblend(c, np.array([255.0, 255, 255])).astype(float)
    out[band] = soft[band]
    out[bg] = 0
    return out.astype(np.uint8)


def save(arr, name):
    Image.fromarray(arr).save(OUT / f"{name}.png", optimize=True)
    print("saved", name, arr.shape[1], "x", arr.shape[0])


def splash_logo(video):
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "s.png"
        subprocess.run(["ffmpeg", "-v", "error", "-ss", "5.0", "-i", video, "-frames:v", "1", str(f)], check=True)
        a = np.asarray(Image.open(f).convert("RGB")).astype(float)
    c = a[215:290, 115:365]  # 로고 상자 (녹화 480px 기준, 가운데 x 240, y 252.5)
    # 검은 바탕 위 초록(#00917f 무렵)·빨강(#e2231a 무렵) 두 색 → 가장 밝은 채널을 그 색의 최대값으로 나눠 불투명도
    red = c[..., 0] > c[..., 1]
    solid = np.where(red[..., None], [226.0, 35, 26], [0.0, 146, 128])
    a_ = np.clip(c.max(axis=2) / solid.max(axis=2), 0, 1)
    a_ = np.where(a_ < 0.06, 0, a_)
    return np.dstack([solid, a_ * 255]).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", required=True)
    ap.add_argument("--dark", help="다크모드 녹화 (시작화면 로고)")
    args = ap.parse_args()

    for key, (top, rows) in PICK.items():
        a = load(args.shots, key)
        for r, row in enumerate(rows):
            for cx, code in zip(COLS, row):
                c = crop_box(a, cx, top + r * 208 + 67, *LOGO_BOX)
                save(unblend(c, TILE), f"hana-bank-{code}" if not code.startswith("tax") else f"hana-{code}")

    for n, top in BANNER_TOP.items():
        a = load(args.shots, f"home-{n}")
        save(flood_clear(a[top + 10:top + 290, 410:670]), f"hana-banner-{n}")

    a = load(args.shots, "home-menu")
    for i, (cx, cy) in enumerate([(167, 953), (359, 953), (551, 953), (167, 1120), (359, 1120), (551, 1120), (167, 1288)]):
        save(flood_clear(crop_box(a, cx, cy, 84, 84)), f"hana-menu-{i + 1}")
    save(flood_clear(load(args.shots, "home-bottom")[748:862, 490:610].copy(), near=228), "hana-chest")
    save(flood_clear(crop_box(load(args.shots, "history"), 97, 252, 40, 40)), "hana-symbol")

    if args.dark:
        save(splash_logo(args.dark), "hana-splash-logo")


if __name__ == "__main__":
    main()
