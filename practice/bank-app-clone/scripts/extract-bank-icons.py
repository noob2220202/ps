#!/usr/bin/env python3
"""카카오뱅크 '은행선택' 화면에서 은행/증권사 동그라미 아이콘을 잘라 src/assets/local/bank-<코드>.png 로 저장.
결과물은 .gitignore 처리돼 커밋되지 않는다 (은행 로고는 상표).

  python3 scripts/extract-bank-icons.py 은행선택_녹화.mp4 은행선택_스크린샷1.jpg 은행선택_스크린샷2.jpg

- 녹화: 은행선택 시트가 맨 위(카카오뱅크~우체국)까지 보이는 녹화. 21~22초 구간을 평균 내서 압축 노이즈를 줄인다
- 스크린샷1: 신협중앙회 ~ 현대차증권이 보이는 화면, 스크린샷2: 삼성증권 ~ 토스증권이 보이는 화면
필요: ffmpeg, Pillow, numpy

아이콘 위치는 좌표를 박아두지 않고 "흰 배경이 아닌 덩어리"를 찾아서 자동으로 잡는다.
그래서 해상도가 조금 달라도 동작한다. 같은 은행이 여러 장에 있으면 해상도가 높은 스크린샷 것을 쓴다.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src/assets/local"
SIZE = 96  # 저장 크기 (화면에선 최대 44px → 2배 화면에서도 충분)

# 화면에 보이는 순서 그대로 (왼쪽 열, 오른쪽 열). 코드는 server/banks.mjs 와 같다
VIDEO_ROWS = (
    ["kakao", "ibk", "shinhan", "kdb", "citi", "sc", "kj", "boa", "nfcf", "mg", "shinhyup"],
    ["kb", "nh", "im", "woori", "hana", "kn", "deutsche", "busan", "savings", "suhyup", "post"],
)
SHOT1_ROWS = (
    ["shinhyup", "jb", "ccb", "boc", "hsbc", "kbank", "kyobo", "dbsec", "mirae", "samsung", "shinhansec", "hmsec"],
    ["post", "jeju", "icbc", "bnp", "jpm", "toss", "daishin", "meritz", "bookook", "shinyoung", "sks", "yuanta"],
)
SHOT2_ROWS = (
    ["samsung", "shinhansec", "hmsec", "eugene", "cape", "wooriinv", "imsec", "sangsangin", "kbsec", "bnksec", "kakaopaysec", "tosssec"],
    ["shinyoung", "sks", "yuanta", "ls", "kiwoom", "hanasec", "kis", "hanwha", "daol", "nhsec", "ibksec"],
)


def ink(a, threshold=40):
    """흰 배경과 확실히 다른 픽셀"""
    return np.abs(255 - a).max(axis=2) > threshold


def find_rows(a, x0, x1, y0, y1):
    """세로로 훑어서 아이콘이 있는 줄(y 구간)들을 찾는다"""
    hits = ink(a[:, x0:x1]).sum(axis=1)
    rows, start = [], None
    for y in range(y0, y1):
        if hits[y] and start is None:
            start = y
        elif not hits[y] and start is not None:
            if y - start > a.shape[1] * 0.025:  # 너무 얇은 건 구분선
                rows.append((start, y))
            start = None
    return rows


def cut(a, x0, x1, y0, y1, threshold, inset):
    """구간 안의 아이콘 덩어리를 정사각형으로 잘라 원형으로 오려낸다"""
    m = ink(a[y0:y1, x0:x1], threshold)
    ys, xs = np.nonzero(m)
    cx, cy = x0 + (xs.min() + xs.max() + 1) / 2, y0 + (ys.min() + ys.max() + 1) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 0.5 - inset
    img = Image.fromarray(a.astype(np.uint8)).crop((cx - r, cy - r, cx + r, cy + r))
    img = img.resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
    # 4배로 그린 원을 줄여서 가장자리를 부드럽게 (계단 현상 방지). 흰 테두리가 남지 않게 살짝 안쪽까지만
    big = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(big).ellipse((6, 6, SIZE * 4 - 7, SIZE * 4 - 7), fill=255)
    img.putalpha(big.resize((SIZE, SIZE), Image.LANCZOS))
    return img, r * 2


def main_color(img):
    """아이콘 대표색 (로고 이미지가 없을 때 쓰는 동그라미 색) — 가장자리 링의 평균"""
    a = np.asarray(img).astype(float)
    yy, xx = np.mgrid[:SIZE, :SIZE]
    d = np.hypot(xx - SIZE / 2, yy - SIZE / 2)
    ring = a[(d > SIZE * 0.40) & (d < SIZE * 0.46)][:, :3].mean(axis=0)
    return "#%02X%02X%02X" % tuple(int(v) for v in ring)


def sources(video, shot1, shot2, tmp):
    frame = Path(tmp) / "picker.png"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", "21.0", "-t", "0.9", "-i", video,
         "-vf", "tmix=frames=20", "-frames:v", "1", "-update", "1", str(frame)],
        check=True,
    )
    # (파일, 은행 순서, 목록이 시작되는 높이 비율, 배경과 구분하는 기준, 가장자리 깎을 px)
    # 녹화는 시트 제목+검색창 아래(30%)부터, 압축 노이즈가 있어서 기준을 높게 + 번진 흰 테두리 1px 깎기.
    # 스크린샷은 아주 옅은 배경(토스뱅크 등)도 잡히게 낮은 기준.
    # 해상도가 낮은 것부터 → 같은 코드는 뒤(스크린샷)가 덮어쓴다
    return [(frame, VIDEO_ROWS, 0.29, 30, 1.2), (shot2, SHOT2_ROWS, 0.2, 12, 0), (shot1, SHOT1_ROWS, 0.2, 12, 0)]


def run(video, shot1, shot2):
    OUT.mkdir(parents=True, exist_ok=True)
    best = {}
    with tempfile.TemporaryDirectory() as tmp:
        for path, cols, top, threshold, inset in sources(video, shot1, shot2, tmp):
            a = np.asarray(Image.open(path).convert("RGB")).astype(int)
            h, w = a.shape[:2]
            # 열 위치는 화면 폭 비율로
            for (x0, x1), codes in zip([(0.02, 0.13), (0.47, 0.565)], cols):
                rows = find_rows(a, int(w * x0), int(w * x1), int(h * top), int(h * 0.97))
                if len(rows) < len(codes):
                    sys.exit(f"{path}: 아이콘 줄을 {len(rows)}개만 찾음 (필요 {len(codes)}개)")
                for code, (y0, y1) in zip(codes, rows):
                    img, size = cut(a, int(w * x0), int(w * x1), y0 - 8, y1 + 8, threshold, inset)
                    if size >= best.get(code, (None, 0))[1]:
                        best[code] = (img, size)
    colors = {}
    for code, (img, size) in sorted(best.items()):
        file = OUT / f"bank-{code}.png"
        # 홈 화면 녹화에서 더 크게 잘라 둔 아이콘(농협 등)이 있으면 그걸 살린다
        if file.exists() and Image.open(file).width > SIZE:
            print(f"bank-{code}.png  (더 큰 이미지가 이미 있어서 건너뜀)")
            colors[code] = main_color(img)
            continue
        img.save(file)
        colors[code] = main_color(img)
        print(f"bank-{code}.png  원본 {size:.0f}px  대표색 {colors[code]}")
    print(f"\n{len(best)}개 → {OUT}")
    print("대표색:", json.dumps(colors))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    run(*sys.argv[1:])
