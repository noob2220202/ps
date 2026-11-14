#!/usr/bin/env python3
"""토스 홈 · 광고 화면 그림 (src/toss/home) → src/assets/local/toss-home-*.png

  python3 scripts/toss-crops/home.py --a <녹화 A.mp4> --b <녹화 B.mp4> --model <RealESRGAN_x4plus_anime_6B.pth> [--out <폴더>] [--only 이름,…] [--force]

  --out 으로 임시 폴더에 먼저 만들어 눈으로 확인한 뒤 옮겨도 됨 (기본 src/assets/local)

  1) 화면이 멈춰 있는 동안의 프레임 여럿을 평균 (압축 잡음 줄이기). 상자(녹화 px)는 글자 · 이름 · 금액이 없는 그림 자리만 (plan.md §5.2)
  2) Real-ESRGAN 4배 → 녹화와 맞춰 보정(back-projection)
  3) 바탕을 걷어 투명하게 (color to alpha, 바탕보다 어두운 그림자도 검정 반투명으로) → 4px/dp 로 줄임 → 잉크 상자로 자름
  4) 화면 자리(잉크 상자의 dp 좌표)를 찍어 줌 → home.css 의 자리

  만든 그림 (모두 4px/dp):
    toss-home-li-account / li-shopping / li-checkcard  목록 카드 24dp 아이콘 (계좌 개설 · 토스쇼핑 · 체크카드 혜택 추천), B 136.07–137.45
    toss-home-deal            오늘의 딜 청록 표시 36dp, A 10.45–13.10
    toss-home-half-store / half-coffee  반쪽 카드 3D 그림 (바탕 = 카드 #171619 + 아래 빛 — 줄마다 그림 밖 바탕을 재서 걷음), B 136.07–137.45
    toss-home-coupon          쿠폰 광고 '5000' 쿠폰 그림, B 72.6–77.2
    toss-home-cal-plus / cal-won / cal-flip / cal-edge / cal-bag
                              '30일 동안' 광고 달력 로티 열쇠 장면 5개 (같은 캔버스 — 겹쳐 놓고 차례로 바꿈), B 126.79–129.29
필요: ffmpeg, torch(CPU 판), numpy, Pillow
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1] / "ibk-crops"))
from esrgan import load as load_esrgan  # noqa: E402
from esrgan import upscale  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "src/assets/local"
W, H = 480, 1066  # 녹화 프레임 (px)
PX_PER_DP = 1.25  # 녹화
OUT_PX_PER_DP = 4  # 저장 배율

CARD = np.array([0x19, 0x18, 0x1B], np.float64)  # 홈 카드
PAGE = np.array([0x17, 0x16, 0x19], np.float64)  # 광고 화면 · 반쪽 카드
DEEP = np.array([0x10, 0x0F, 0x12], np.float64)  # 홈 바탕 (카드 밖)

# 이름: (녹화, (t0, t1) 평균 구간 또는 한 프레임 pts, 상자 x0 y0 x1 y1, 바탕)
ICONS = {
    "li-account": ("B", (136.07, 137.45), (38, 766, 74, 800), CARD),
    "li-shopping": ("B", (136.07, 137.45), (38, 826, 74, 860), CARD),
    "li-checkcard": ("B", (136.07, 137.45), (38, 888, 74, 924), CARD),
    "deal": ("A", (10.45, 13.10), (354, 811, 418, 875), CARD),
    "coupon": ("B", (72.60, 77.20), (24, 634, 108, 688), PAGE),
}
# 반쪽 카드 (B 136.113 캐시 홈): 카드 상자(녹화 px, 잰 값). 카드 아래 빛 띠는 그림 둘레에만 있는 번짐이라 그림의 일부로 같이 잘라 냄
# (바탕 = 평평한 #171619). 글자 상자(제목 2줄, 잰 값 + 2px)는 바탕으로 칠해 지움
HALF = {
    "half-store": {"card": (15.0, 647.9, 234.4, 733.3), "text": (39, 667, 142, 714)},
    "half-coffee": {"card": (244.5, 647.9, 464.2, 733.3), "text": (268, 667, 372, 714)},
}
CARD_R = 22.8 * PX_PER_DP  # 카드 모서리 (px)
# 달력 로티 열쇠 장면. 마지막 배치(127.587 이후) 상자 172,226,342,410 (≈136 × 147dp). '+' 장면은 배치가 바뀌기 전이라 67px 아래
CAL_BOX = (172, 226, 342, 410)
CAL = {
    "cal-plus": ((126.79, 127.21), 67),  # 연한 ₩ 가 그려지기 시작 ('+' 처럼 보임)
    "cal-won": (129.084, 0),  # 주황 ₩ (그려지는 중엔 조금씩 움직여서 한 프레임)
    "cal-flip": (129.284, 0),  # 장이 넘어가는 중 (한 프레임)
    "cal-edge": ((127.62, 128.24), 0),  # 옆으로 선 달력 (장이 부채처럼)
    "cal-bag": ((128.28, 128.58), 0),  # 금색 돈주머니
}


def pts_list(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", video], capture_output=True, text=True, check=True).stdout
    return [float(p) for p in out.split()]


def frames(video, t0, t1):
    """t0–t1 의 모든 프레임 (가변 프레임 녹화라 멈춘 화면은 프레임이 적음)"""
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0:.4f}", "-i", video, "-t", f"{t1 - t0:.4f}", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    n = len(p.stdout) // (W * H * 3)
    return np.stack([np.frombuffer(p.stdout, np.uint8, W * H * 3, i * W * H * 3).reshape(H, W, 3) for i in range(n)]).astype(np.float64)


def still(video, when, box, dy=0):
    """when = (t0, t1) 이면 그 사이 프레임 평균 (다른 프레임과 많이 다른 것은 뺌), 숫자면 그 프레임 하나"""
    x0, y0, x1, y1 = box
    if isinstance(when, tuple):
        st = frames(video, *when)[:, y0 + dy : y1 + dy, x0:x1]
        med = np.median(st, axis=0)
        dist = np.abs(st - med).mean(axis=(1, 2, 3))
        return st[dist <= np.median(dist) * 1.5 + 0.5].mean(axis=0)
    f = frames(video, max(0, when - 0.002), when + 0.012)[0]
    return f[y0 + dy : y1 + dy, x0:x1]


def backproject(lr, sr, iters=2):
    h, w = lr.shape[:2]
    out = sr.astype(np.float64)
    for _ in range(iters):
        down = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float64)
        err = lr - down
        up = np.stack([np.asarray(Image.fromarray(err[..., c].astype(np.float32), "F").resize(out.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
        out = out + up
    return out.clip(0, 255)


def color_to_alpha(rgb, bg, knee=True):
    """바탕 bg (색 하나 또는 픽셀마다) 를 걷음: 픽셀 = a·fg + (1−a)·bg 가 되는 가장 작은 a (밝은 쪽 · 어두운 쪽 둘 다).
    같은 바탕 위에 다시 얹으면 녹화와 같은 색. 아주 작은 a(압축 잡음)는 부드럽게 0 으로"""
    bg = np.broadcast_to(bg, rgb.shape)
    diff = rgb - bg
    # 바탕 언저리 ±3 은 압축 · 업스케일 잡음 → 0 (어두운 바탕 위 '더 어두운 쪽'은 3 차이도 알파 .1 이 되므로)
    diff = np.sign(diff) * np.maximum(np.abs(diff) - 3, 0)
    room = np.where(diff >= 0, 255 - bg, bg)
    a = (np.abs(diff) / np.maximum(room, 1)).max(axis=2)
    a = np.clip((a - 0.03) / 0.97, 0, 1)
    if knee:
        a = np.where(a < 0.06, a * (a / 0.06), a)
    safe = np.maximum(a, 1e-3)[..., None]
    fg = np.clip(bg + diff / safe, 0, 255)
    return np.dstack([fg, a * 255])


def resize_rgba(rgba, size):
    # 미리 곱한 알파로 줄여야 가장자리에 바탕색이 번지지 않음
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3]])
    out = np.stack([np.asarray(Image.fromarray(pre[..., c].astype(np.float32), "F").resize(size, Image.LANCZOS)) for c in range(4)], axis=2)
    out[..., 3] = out[..., 3].clip(0, 255)
    aa = np.maximum(out[..., 3:4] / 255, 1e-4)
    out[..., :3] = np.where(out[..., 3:4] > 0.5, out[..., :3] / aa, 0)
    return out.clip(0, 255)


def ink_box(alpha, thresh=8):
    ys, xs = np.nonzero(alpha > thresh)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def upscale_key(net, lr, bg, knee=True):
    """LR(녹화 px) → SR 4배 → 바탕 걷기 → 4px/dp"""
    sr = backproject(lr, upscale(net, lr.round().clip(0, 255).astype(np.uint8)))
    if bg.ndim == 3:  # 픽셀마다 바탕 → SR 크기로
        bg = np.stack([np.asarray(Image.fromarray(bg[..., c].astype(np.float32), "F").resize(sr.shape[1::-1], Image.BICUBIC)) for c in range(3)], axis=2)
    h, w = lr.shape[:2]
    size = (round(w / PX_PER_DP * OUT_PX_PER_DP), round(h / PX_PER_DP * OUT_PX_PER_DP))
    return resize_rgba(color_to_alpha(sr, bg, knee), size)


def save(rgba, name):
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), "RGBA")
    img.save(OUT / f"toss-home-{name}.png", optimize=True)  # keep_assets: src/assets/local 에 이미 있으면 건너뜀 (--force)
    return img


def report(name, img, box, off, dy=0):
    x0, y0 = box[0], box[1] + dy
    left, top = x0 / PX_PER_DP + off[0] / OUT_PX_PER_DP, y0 / PX_PER_DP + off[1] / OUT_PX_PER_DP
    print(f"toss-home-{name}.png: {img.size[0]} × {img.size[1]} px = {img.size[0] / OUT_PX_PER_DP:.2f} × {img.size[1] / OUT_PX_PER_DP:.2f} dp, ink dp x {left:.2f} y {top:.2f}")


def icon(net, video, name):
    v, when, box, bg = ICONS[name]
    lr = still(video, when, box)
    # 상자 테두리 중앙값이 그 자리 바탕 (카드 #19181b · 화면 #171619 언저리)
    edge = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
    bg = np.median(edge, axis=0) if np.abs(np.median(edge, axis=0) - bg).max() <= 3 else bg
    rgba = upscale_key(net, lr, bg)
    x0, y0, x1, y1 = ink_box(rgba[..., 3])
    img = save(rgba[y0:y1, x0:x1], name)
    report(name, img, box, (x0, y0))


def rounded_mask(card, box, inset=1.5):
    """카드(둥근 사각형) 안이면 1 — box 안 픽셀 가운데 기준. 가장자리 inset px 은 밖으로 (화면 바탕과 섞인 테두리)"""
    cx0, cy0, cx1, cy1 = card[0] + inset, card[1] + inset, card[2] - inset, card[3] - inset
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[y0:y1, x0:x1] + 0.5
    dx = np.maximum(np.maximum(cx0 + CARD_R - xx, xx - (cx1 - CARD_R)), 0)
    dy = np.maximum(np.maximum(cy0 + CARD_R - yy, yy - (cy1 - CARD_R)), 0)
    inside = (xx >= cx0) & (xx <= cx1) & (yy >= cy0) & (yy <= cy1) & (np.hypot(dx, dy) <= CARD_R)
    return inside


def half(net, video, name):
    spec = HALF[name]
    full = still(video, (136.07, 137.45), (0, 0, W, H))
    cx0, cy0, cx1, cy1 = spec["card"]
    box = (int(cx0), int(cy0) + 4, int(np.ceil(cx1)), int(np.ceil(cy1)))
    x0, y0, x1, y1 = box
    lr = full[y0:y1, x0:x1].copy()
    tx0, ty0, tx1, ty1 = spec["text"]
    lr[ty0 - y0 : ty1 - y0, tx0 - x0 : tx1 - x0] = PAGE
    # 카드 밖(둥근 모서리 · 아래 화면 바탕)도 바탕으로 칠해 투명하게 (CSS 카드가 같은 모서리로 자름)
    lr[~rounded_mask(spec["card"], box)] = PAGE
    rgba = upscale_key(net, lr, PAGE, knee=False)  # 아래 빛 번짐(+6–12)도 남김
    bx0, by0, bx1, by1 = ink_box(rgba[..., 3], 3)
    img = save(rgba[by0:by1, bx0:bx1], name)
    report(name, img, box, (bx0, by0))
    print(f"   카드 dp x {cx0 / PX_PER_DP:.2f}–{cx1 / PX_PER_DP:.2f} y {cy0 / PX_PER_DP:.2f}–{cy1 / PX_PER_DP:.2f}")


def calendar(net, video):
    made = {}
    for name, (when, dy) in CAL.items():
        lr = still(video, when, CAL_BOX, dy)
        edge = np.concatenate([lr[0], lr[-1], lr[:, 0], lr[:, -1]])
        bg = np.median(edge, axis=0)
        made[name] = upscale_key(net, lr, bg)
        print(f"  {name}: bg #{''.join(f'{round(c):02x}' for c in bg)}")
    # 모든 장면을 같은 캔버스로 (겹쳐서 바꿔 끼움) → 합친 잉크 상자로 자름
    union = np.max(np.stack([m[..., 3] for m in made.values()]), axis=0)
    x0, y0, x1, y1 = ink_box(union, 6)
    for name, rgba in made.items():
        img = save(rgba[y0:y1, x0:x1], name)
        report(name, img, CAL_BOX, (x0, y0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, help="녹화 A (Screen_Recording_…175407)")
    ap.add_argument("--b", required=True, help="녹화 B (Screen_Recording_…175809)")
    ap.add_argument("--model", required=True, help="RealESRGAN_x4plus_anime_6B.pth")
    ap.add_argument("--out", help="저장 폴더 (기본 src/assets/local)")
    ap.add_argument("--only", help="이름 쉼표 목록만 (li-account, deal, coupon, half-store, cal …; cal = 달력 5장)")
    args = ap.parse_args()
    global OUT
    if args.out:
        OUT = Path(args.out)
        OUT.mkdir(parents=True, exist_ok=True)
    only = set(args.only.split(",")) if args.only else None
    want = lambda n: not only or n in only  # noqa: E731
    videos = {"A": args.a, "B": args.b}
    net = load_esrgan(args.model)
    for name, spec in ICONS.items():
        if want(name):
            icon(net, videos[spec[0]], name)
    for name in HALF:
        if want(name):
            half(net, videos["B"], name)
    if want("cal"):
        calendar(net, videos["B"])


if __name__ == "__main__":
    main()
