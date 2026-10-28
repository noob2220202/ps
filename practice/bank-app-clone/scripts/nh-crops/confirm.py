#!/usr/bin/env python3
"""콕뱅크 송금 확인·완료 화면 그림을 녹화2에서 잘라 src/assets/local 에 저장 (담당: confirm).

  python3 scripts/nh-crops/confirm.py --video2 녹화2.mp4 [--out src/assets/local] [--css src/nh/nh-confirm-mark.css]

만드는 것 (녹화 480px = 1.25px/dp 그대로, 화면에선 CSS로 0.8배):
  nh-shield.png      받는 분 확인 시트 방패 (시트가 멈춰 있는 26.45~27.85초 평균). 58×66px = 46.4×52.8dp
  nh-msg-card.png    완료 화면 '메시지 보내기' 둥근 사각 타일 3개 (32.75~35.0초 평균). 64×64px = 51.2dp
  nh-msg-kakao.png
  nh-msg-mms.png
  nh-done-mark.png   완료 화면 위 동전 회전 → 청록 체크 애니메이션의 모든 프레임을 가로로 이은 스프라이트
                     (100×110px 칸, 같은 그림이 이어지면 한 칸만). 프레임 시각은 녹화의 실제 표시 시각(VFR pts)
  --css 파일         위 스프라이트를 프레임 시각대로 넘기는 @keyframes (step-end)

바탕: 녹화는 어두운 색이 1 낮게 찍히므로(#17161b) 바탕과 비슷한 픽셀은 실제 바탕색(#18171c, 시트 #29343f) 쪽으로 옮김.
시각 기준 T0 = 30.147초 (확인 화면 마지막 프레임 30.138과 완료 화면 첫 프레임 30.155 사이).
필요: ffmpeg, Pillow, numpy
"""
import argparse
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PAGE_BG_REC, PAGE_BG = np.array([23, 22, 27.0]), np.array([24, 23, 28.0])  # 녹화 → 실제 #18171c
SHEET_BG = np.array([41, 52, 63.0])  # #29343f
T0 = 30.147
MARK_BOX = (190, 144, 290, 254)  # 동전·체크가 튀어 오르는 범위까지 (녹화 px)
MARK_START = 30.245  # 동전이 처음 보이는 때 (30.235 없음 / 30.255 있음)
MARK_FULL = 30.327  # 로딩 막(0.6)이 걷힌 첫 프레임. 그 전 동전 프레임은 막에 덮여 어두워서 이 프레임으로 대신
MARK_END = 32.33  # 체크 그림이 멈추는 때 (이후 프레임은 모두 같음)


def frames(video, t0, t1, tmp):
    """[t0, t1] 구간의 모든 프레임 (pts 초, RGB float 배열)"""
    d = Path(tmp) / f"f{t0:.2f}"
    d.mkdir()
    log = subprocess.run(
        ["ffmpeg", "-v", "info", "-ss", str(t0), "-to", str(t1), "-i", video, "-copyts", "-fps_mode", "passthrough",
         "-vf", "showinfo", "-f", "image2", str(d / "f_%04d.png")],
        check=True, capture_output=True, text=True).stderr
    ts = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", log)]
    fs = sorted(d.glob("f_*.png"))
    # -ss/-to 와 -copyts 를 같이 쓰면 끝이 조금 넘어가므로 pts로 다시 거름
    return [(t, np.asarray(Image.open(f).convert("RGB")).astype(float)) for t, f in zip(ts, fs) if t0 <= t <= t1]


def rebase(a, rec_bg, real_bg, soft=40.0):
    """바탕과 가까운 픽셀일수록 (실제 바탕 − 녹화 바탕) 만큼 옮김"""
    w = np.clip(1 - np.abs(a - rec_bg).max(axis=2, keepdims=True) / soft, 0, 1)
    return np.clip(a + (real_bg - rec_bg) * w, 0, 255)


def save(a, path):
    Image.fromarray(np.round(a).astype(np.uint8)).save(path, optimize=True)
    print("saved", path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video2", required=True)
    ap.add_argument("--out", default=str(ROOT / "src/assets/local"))
    ap.add_argument("--css", default=str(ROOT / "src/nh/nh-confirm-mark.css"))
    a = ap.parse_args()
    out = Path(a.out)
    with tempfile.TemporaryDirectory() as tmp:
        # 방패: 시트가 멈춘 구간 평균. 시트 바탕(녹화 #28323e 근처)을 #29343f 로
        fs = frames(a.video2, 26.45, 27.85, tmp)
        avg = np.mean([f for _, f in fs], axis=0)
        x0, y0, x1, y1 = 212, 519, 270, 585
        c = avg[y0:y1, x0:x1]
        ring = np.concatenate([c[:2].reshape(-1, 3), c[-2:].reshape(-1, 3), c[:, :2].reshape(-1, 3), c[:, -2:].reshape(-1, 3)])
        save(rebase(c, np.median(ring, axis=0), SHEET_BG), out / "nh-shield.png")

        # 메시지 보내기 타일 (가운데 x 122 / 238 / 355, y 833.5)
        fs = frames(a.video2, 32.75, 35.0, tmp)
        avg = np.mean([f for _, f in fs], axis=0)
        for name, cx in [("card", 122), ("kakao", 238), ("mms", 355)]:
            c = avg[802:866, cx - 32:cx + 32]
            save(rebase(c, PAGE_BG_REC, PAGE_BG), out / f"nh-msg-{name}.png")

        # 동전 → 체크 스프라이트
        fs = frames(a.video2, 30.10, MARK_END + 0.05, tmp)
        x0, y0, x1, y1 = MARK_BOX
        full = next(f for t, f in fs if t >= MARK_FULL - 0.002)
        cells, times = [], []
        blank = np.ones((y1 - y0, x1 - x0, 3)) * PAGE_BG
        cells.append(blank)
        times.append(0.0)
        for t, f in fs:
            if t < MARK_START or t > MARK_END:
                continue
            src = full if t < MARK_FULL - 0.002 else f
            c = rebase(src[y0:y1, x0:x1], PAGE_BG_REC, PAGE_BG)
            st = MARK_START if not times[1:] else t  # 첫 동전은 보이기 시작한 때부터
            if np.abs(c - cells[-1]).mean() < 0.15:
                continue  # 앞 칸과 같은 그림
            cells.append(c)
            times.append(st - T0)
        end = MARK_END - T0
        sprite = np.concatenate(cells, axis=1)
        save(sprite, out / "nh-done-mark.png")
        n = len(cells)
        cw = (x1 - x0) * 0.8  # 칸 폭 dp
        lines = [
            "/* 송금 완료: 동전 회전 → 청록 체크 (scripts/nh-crops/confirm.py 가 만듦. 손으로 고치지 말 것)",
            f"   녹화2 {MARK_START:.3f}~{MARK_END:.3f}초 프레임 {n}칸, 칸 {cw:g}×{(y1 - y0) * 0.8:g}dp, 시각 기준 {T0}초 (완료 화면이 뜬 때) */",
            f".nh-dn-mark--sprite {{",
            f"  background-size: {n * cw:g}px {(y1 - y0) * 0.8:g}px;",
            f"  animation: nh-dn-mark {end * 1000:.0f}ms step-end both;",
            "}",
            "@keyframes nh-dn-mark {",
        ]
        for i, t in enumerate(times):
            lines.append(f"  {t / end * 100:.3f}% {{ background-position-x: {-i * cw:g}px; }}")
        lines.append(f"  100% {{ background-position-x: {-(n - 1) * cw:g}px; }}")
        lines.append("}")
        Path(a.css).write_text("\n".join(lines) + "\n")
        print("wrote", a.css, n, "frames", f"{end * 1000:.0f}ms")


if __name__ == "__main__":
    main()
