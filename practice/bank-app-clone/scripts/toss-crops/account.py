#!/usr/bin/env python3
"""토스 통장 · 거래내역 · 상세 · 다른 은행 계좌 화면 그림 (src/toss/account) → src/assets/local/toss-acct-*.png|jpg

  python3 scripts/toss-crops/account.py --a <녹화 A.mp4> --b <녹화 B.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> \
      --manifest <scratch frames/account/icons 폴더> [--out <폴더>] [--force] [--only 이름,…]

  --manifest 폴더의 manifest.json (상품 메뉴 24dp 아이콘 67개) 과 manifest_top.json (위쪽 타일 · 배너 · 거래 아이콘) 의
  상자(녹화 px, x0 y0 x1 y1) 와 시각(pts) 을 씀. --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 옮겨도 됨 (기본 src/assets/local)

  1) 녹화에서 그 시각의 프레임을 꺼내 상자대로 자름 (상자는 글자 · 이름 · 금액이 없는 아이콘 · 그림 자리만 — plan.md §5.3)
  2) 테두리에 닿은 바탕(화면 #17161b 언저리 · 누름 바탕 · 스크롤 막대)을 바탕색 하나로 칠함, 배너는 왼쪽 7px(엣지 패널 손잡이)을 지움
  3) Real-ESRGAN 4배 → 녹화와 맞춰 보정(back-projection) → 4px/dp 로 줄임
  4) 아이콘: 바탕을 걷어 투명하게 (color to alpha) 하고 잉크 가운데가 그림 가운데에 오게 맞춤. 배너: 걷지 않고 jpg

  만든 그림 (모두 4px/dp):
    toss-acct-m-<이름>.png      상품 메뉴 아이콘 (32dp 칸, 잉크 가운데 맞춤 → 24dp 자리 가운데에 겹쳐 놓음)
    toss-acct-tile-<이름>.png   체크카드 · 비상금 · 자동이체 · 추천 타일 (30dp 타일, 32dp 칸)
    toss-acct-promo.png         새로운 예금 NEW 통장 타일
    toss-acct-info-1/2.png      유용한 정보 썸네일
    toss-acct-tx-<이름>.png     거래내역 40dp 동그라미 (이체 ₩ · 캐시백 메달 · 이자 영수증 · 가게 ···)
    toss-acct-doc.png           상세 '증명서 발급하기' 문서 아이콘
    toss-acct-cashback.png      다른 은행 계좌 '캐시백 기회' 타일
    toss-acct-banner-autotransfer.jpg / toss-acct-banner-newdeposit.jpg  통장 위 배너 그림 (글자 나오기 전 프레임)
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import json
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1] / "ibk-crops"))
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
PX_PER_DP = 1.25  # 녹화
OUT_PX_PER_DP = 4  # 저장 배율

# manifest_top.json 이름 → 저장 이름. 여기 없는 것(토스뱅크 로고 타일 · 번개 동그라미)은 화면이 SVG/CSS 로 그림
TOP = {
    "row_checkcard_tile": "toss-acct-tile-checkcard.png",
    "row_emergency_tile": "toss-acct-tile-emergency.png",
    "row_autotransfer_tile": "toss-acct-tile-autotransfer.png",
    "reco_benefit_coin": "toss-acct-tile-benefit.png",
    "reco_fx_account": "toss-acct-tile-fx.png",
    "reco_nanum": "toss-acct-tile-nanum.png",
    "reco_gulbi": "toss-acct-tile-gulbi.png",
    "promo_new_deposit_tile": "toss-acct-promo.png",
    "info_thumb_1": "toss-acct-info-1.png",
    "info_thumb_2": "toss-acct-info-2.png",
    "banner_autotransfer_bg": "toss-acct-banner-autotransfer.jpg",
    "banner_newdeposit_bg": "toss-acct-banner-newdeposit.jpg",
    "tx_icon_toss_transfer": "toss-acct-tx-transfer.png",
    "tx_icon_cashback_medal": "toss-acct-tx-cashback.png",
    "tx_icon_interest_receipt": "toss-acct-tx-interest.png",
    "tx_icon_generic_merchant": "toss-acct-tx-store.png",
    "detail_cert_doc_icon": "toss-acct-doc.png",
    "otherbank_cashback_tile": "toss-acct-cashback.png",
}
BANNERS = {"banner_autotransfer_bg", "banner_newdeposit_bg"}
# 눈을 깜빡이는 아이콘: manifest 프레임(38.235초)은 누름 바탕 위 · 그 뒤 멈춘 프레임들은 눈 감은 모습이 섞여 중앙값이 뭉개짐
# → 눈 뜬 채 멈춰 있던 37.24–37.74초 (화면 y 869px) 에서 고름
OVERRIDE = {"svc_miracle_morning": (37.2389, [21, 869, 61, 909])}


def frame(video, pts, cache):
    p = Path(cache) / f"{Path(video).stem}_{pts:.4f}.png"
    if not p.exists():
        # pts 는 소수 넷째 자리로 반올림된 값 → 조금 앞에서 찾아 그 프레임을 꺼냄 (가변 프레임 녹화)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, pts - 0.002):.4f}", "-i", video, "-frames:v", "1", str(p)], check=True)
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def read_scroll(path):
    """녹화 A 통장 스크롤 기록 (scrollA1.txt: 'pts #프레임 누적스크롤px (d 이번 이동 …)') → [(pts, scroll, d)]"""
    rows = []
    if not path or not Path(path).exists():
        return rows
    for line in open(path):
        f = line.split()
        if len(f) >= 3:
            d = int(f[4]) if len(f) > 4 and f[3] == "(d" else 0
            rows.append((float(f[0]), int(f[2]), d))
    return rows


def stable_crops(video, pts, box, scroll, cache, n=7):
    """스크롤 중 프레임은 압축 때문에 아이콘이 겹쳐(잔상) 나오기도 함 → 같은 아이콘이 화면에 있는 '멈춘' 프레임(앞뒤 이동 0) 여럿의 중앙값.
    page y = 프레임 y + 스크롤 (녹화 A 25.97–42.4초 통장 한 화면). 멈춘 프레임이 없으면 주어진 프레임 하나"""
    x0, y0, x1, y1 = box
    at = min(scroll, key=lambda r: abs(r[0] - pts)) if scroll else None
    if at is None or abs(at[0] - pts) > 0.01:
        return frame(video, pts, cache)[y0:y1, x0:x1]
    page_y = y0 + at[1]
    still = [scroll[i] for i in range(1, len(scroll) - 1) if scroll[i][2] == 0 and scroll[i + 1][2] == 0 and scroll[i - 1][2] == 0]
    cands = [(t, page_y - sc) for t, sc, _ in still if 112 <= page_y - sc and page_y - sc + (y1 - y0) <= 1030]
    cands.sort(key=lambda c: abs(c[0] - pts))
    if not cands:
        return frame(video, pts, cache)[y0:y1, x0:x1]
    # 스크롤 기록은 ±2px 쯤 틀릴 수 있음 → 처음 고른 프레임에 위아래 ±6px 안에서 가장 잘 맞는 자리로 맞춘 뒤 중앙값
    h = y1 - y0
    ref = None
    stack = []
    for t, y in cands[:n]:
        f = frame(video, t, cache)
        if ref is None:
            ref = f[y : y + h, x0:x1]
            stack.append(ref)
            continue
        best = min(range(-6, 7), key=lambda dy: np.abs(f[y + dy : y + dy + h, x0:x1] - ref).mean() if 0 <= y + dy and y + dy + h <= f.shape[0] else 1e9)
        stack.append(f[y + best : y + best + h, x0:x1])
    return np.median(np.stack(stack), axis=0)


BG = np.array([0x17, 0x16, 0x1B], np.float64)  # 통장 · 거래내역 화면 바탕 (녹화 #17161b · #171619 · #17171c 가 섞여 나옴)


def flatten_bg(crop, bg, loose):
    """테두리에 닿은 '바탕 같은' 픽셀을 bg 하나로 칠함 (4방향 채우기). loose: 바탕보다 조금 밝은 누름 바탕 · 스크롤 막대까지
    (맨 아이콘만 — 타일은 #2c2c35 바탕이 누름 바탕과 비슷해서 지워지므로 바탕색 언저리만)"""
    h, w, _ = crop.shape
    lum = crop.mean(axis=2)
    chroma = crop.max(axis=2) - crop.min(axis=2)
    near = np.abs(crop - bg).max(axis=2) <= 7
    if loose:
        near |= (lum <= bg.mean() + 30) & (chroma <= 14)
    seen = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not near[y, x]:
            continue
        seen[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    out = crop.copy()
    out[seen] = bg
    return out


def backproject(lr, sr, iters=2):
    h, w = lr.shape[:2]
    out = sr.astype(np.float64)
    for _ in range(iters):
        down = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float64)
        err = lr - down
        up = np.stack([np.asarray(Image.fromarray(err[..., c].astype(np.float32), "F").resize(out.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
        out = out + up
    return out.clip(0, 255)


def color_to_alpha(rgb, bg):
    """바탕 bg 를 걷어 냄 (GIMP 'color to alpha'): 픽셀 = a·fg + (1−a)·bg 가 되는 가장 작은 a (밝은 쪽 · 어두운 쪽 모두)"""
    diff = rgb - bg
    room = np.where(diff >= 0, 255 - bg, bg)
    a = (np.abs(diff) / room).max(axis=2)
    a = np.clip((a - 0.02) / 0.98, 0, 1)
    a = np.where(a < 0.04, a * (a / 0.04), a)
    safe = np.maximum(a, 1e-3)[..., None]
    fg = np.clip(bg + diff / safe, 0, 255)
    return np.dstack([fg, a * 255])


def resize_rgba(rgba, size):
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3]])
    out = np.stack([np.asarray(Image.fromarray(pre[..., c].astype(np.float32), "F").resize(size, Image.LANCZOS)) for c in range(4)], axis=2)
    out[..., 3] = out[..., 3].clip(0, 255)
    aa = np.maximum(out[..., 3:4] / 255, 1e-4)
    out[..., :3] = np.where(out[..., 3:4] > 0.5, out[..., :3] / aa, 0)
    return out.clip(0, 255)


def center_ink(rgba, thresh=24):
    """잉크(불투명한 부분) 상자의 가운데가 그림 가운데에 오게 옮김 (크기 그대로, 밀려난 곳은 투명)"""
    ys, xs = np.nonzero(rgba[..., 3] > thresh)
    if not len(ys):
        return rgba
    h, w = rgba.shape[:2]
    dy = round(h / 2 - (ys.min() + ys.max() + 1) / 2)
    dx = round(w / 2 - (xs.min() + xs.max() + 1) / 2)
    out = np.zeros_like(rgba)
    sy0, sy1 = max(0, -dy), min(h, h - dy)
    sx0, sx1 = max(0, -dx), min(w, w - dx)
    out[sy0 + dy : sy1 + dy, sx0 + dx : sx1 + dx] = rgba[sy0:sy1, sx0:sx1]
    return out


def make(net, video, pts, box, cache, banner=False, loose=False, scroll=()):
    x0, y0, x1, y1 = box
    crop = stable_crops(video, pts, box, scroll, cache) if scroll else frame(video, pts, cache)[y0:y1, x0:x1]
    if banner:
        # 왼쪽 0–6px 은 삼성 엣지 패널 손잡이가 걸치는 자리 → 7px 열로 채움
        crop[:, :7] = crop[:, 7:8]
        sr = backproject(crop, upscale(net, crop.round().clip(0, 255).astype(np.uint8)))
        size = (round((x1 - x0) / PX_PER_DP * OUT_PX_PER_DP), round((y1 - y0) / PX_PER_DP * OUT_PX_PER_DP))
        return np.asarray(Image.fromarray(sr.round().clip(0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float64), None
    bg = BG
    flat = flatten_bg(crop, bg, loose)
    sr = backproject(flat, upscale(net, flat.round().clip(0, 255).astype(np.uint8)))
    size = (round((x1 - x0) / PX_PER_DP * OUT_PX_PER_DP), round((y1 - y0) / PX_PER_DP * OUT_PX_PER_DP))
    rgba = resize_rgba(color_to_alpha(sr, bg), size)
    return center_ink(rgba), bg


def save(arr, name):
    if name.endswith(".jpg"):
        img = Image.fromarray(arr.round().clip(0, 255).astype(np.uint8), "RGB")
        img.save(OUT / name, quality=90, optimize=True, progressive=True)
    else:
        img = Image.fromarray(arr.round().clip(0, 255).astype(np.uint8), "RGBA")
        img.save(OUT / name, optimize=True)  # keep_assets: src/assets/local 에 이미 있으면 건너뜀 (--force)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, help="녹화 A (토스 화면 녹화 첫째 파일)")
    ap.add_argument("--b", required=True, help="녹화 B (둘째 파일)")
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--manifest", required=True, help="manifest.json · manifest_top.json 이 있는 폴더")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", help="이름(manifest name) 쉼표 목록만")
    ap.add_argument("--scroll", help="녹화 A 통장 스크롤 기록 (기본 <manifest>/../scrollA1.txt). 없으면 manifest 프레임 하나씩")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    only = set(args.only.split(",")) if args.only else None
    videos = {"A": args.a, "B": args.b}
    jobs = []
    for e in json.load(open(Path(args.manifest) / "manifest.json")):
        jobs.append((e, f"toss-acct-m-{e['name'].replace('_', '-')}.png"))
    for e in json.load(open(Path(args.manifest) / "manifest_top.json")):
        if e["name"] in TOP:
            jobs.append((e, TOP[e["name"]]))
    scroll = read_scroll(args.scroll or Path(args.manifest).parent / "scrollA1.txt")
    net = load_esrgan(args.model)
    with tempfile.TemporaryDirectory() as cache:
        for e, name in jobs:
            if only and e["name"] not in only:
                continue
            if e["name"] in OVERRIDE:
                e = {**e, "pts": OVERRIDE[e["name"]][0], "box_px": OVERRIDE[e["name"]][1]}
            menu = name.startswith(("toss-acct-m-", "toss-acct-info-"))  # 누름 바탕이 걸린 칸이 있는 것 (타일은 아님)
            # 스크롤 기록은 녹화 A 통장 화면(25.97–42.4초)만. 배너는 글자가 나오기 전 그 프레임 그대로
            still = scroll if e["video"] == "A" and 25.9 <= e["pts"] <= 42.5 and e["name"] not in BANNERS else ()
            arr, bg = make(net, videos[e["video"]], e["pts"], e["box_px"], cache, banner=e["name"] in BANNERS, loose=menu, scroll=still)
            img = save(arr, name)
            note = "" if bg is None else f" bg #{''.join(f'{round(c):02x}' for c in bg)}"
            print(f"{name}: {img.size[0]} × {img.size[1]} px = {img.size[0] / OUT_PX_PER_DP:.1f} × {img.size[1] / OUT_PX_PER_DP:.1f} dp ({e['video']} {e['pts']}){note}")


if __name__ == "__main__":
    main()
