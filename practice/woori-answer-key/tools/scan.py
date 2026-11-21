#!/usr/bin/env python3
"""영상 하나를 훑어 '정지 구간'과 '변화(전환) 구간'을 찾는다 (spec/timeline.md 작성용).

  python3 tools/scan.py --video v1 [--from 0] [--to 200.5] [--min-hold 0.15] [--thresh 0.05]
                        [--csv tools/out/scan/v1-frames.csv] [--json tools/out/scan/v1-segments.json]
                        [--mask x,y,w,h | --mask <이름> ...] [--contact tools/out/scan/v1-sheet.png]

영상은 tools/woori_video.py 로 읽는다: 기본 tools/ref/video/<v>-clean.mp4 (엣지 패널 손잡이를 지운 것, pts 는 원본과 같다).
원본 mp4 경로를 주면 프레임마다 woori_edge.clean_bgr 를 거친다. VFR 이라 프레임 번호(#)가 기준이다.

각 원본 프레임을 직전 프레임과 비교(앱 뷰포트 y=46..1209, 채널 최대 |차이| > 24 인 픽셀 비율)해서
  - 변화량이 thresh(기본 0.05%) 이하이면 같은 화면이 유지되는 중
  - 연속된 변화 프레임 묶음 = 전환(애니메이션/스크롤/타이핑)
으로 나눈다. 구간마다 시작/끝 시각, 원본 프레임 #i0–#i1, 변화가 일어난 bbox 를 출력한다.
정지 구간의 끝 시각 t1 = 다음 구간 첫 프레임 pts (그 순간까지 화면에 보였다). 구간 #i1 은 포함.
--contact 를 주면 정지 구간마다 가운데 프레임을 줄여 한 장의 시트로 만든다 (영상을 한 번 더 읽는다).
결과 그림·표에는 실제 화면이 담기므로 tools/out (git 제외) 이나 스크래치에만 둔다.
"""
import argparse
import csv
import json
import os
import sys

sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 만들지 않음
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

import woori_video as wv  # noqa: E402

APP_Y0, APP_Y1 = 46, 1210  # 앱 뷰포트 (상태바 0–45.58 · 내비 바 1210.18– 를 뺀 행)
NAMED_MASKS = {  # tools/woori-units.cjs OPTIONAL_MASKS 와 같은 값
    "keyboard": "0,738,524,542", "imeAppearing": "0,1207,524,73",
    "rightColumnIso": "523,0,1,1280", "edgePanelRawOnly": "0,147,9,176",
}


def parse_box(s):
    s = NAMED_MASKS.get(str(s).strip(), s)
    x, y, w, h = [int(round(float(v))) for v in str(s).split(",")]
    return x, y, w, h


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", default="v1", help="v1 | v2 | 영상 경로 (기본 v1 → tools/ref/video/v1-clean.mp4)")
    ap.add_argument("--from", dest="t_from", type=float, default=0.0)
    ap.add_argument("--to", dest="t_to", type=float, default=1e9)
    ap.add_argument("--thresh", type=float, default=0.05, help="정지로 볼 프레임간 변화 상한 (%% 픽셀>24)")
    ap.add_argument("--min-hold", type=float, default=0.15, help="이보다 짧은 정지는 전환에 합침 (초)")
    ap.add_argument("--mask", action="append", default=[], metavar="x,y,w,h", help="변화 계산에서 뺄 영역 (이름도 됨: keyboard …)")
    ap.add_argument("--csv")
    ap.add_argument("--json")
    ap.add_argument("--contact")
    a = ap.parse_args()

    path = wv.video_path(a.video)
    if not os.path.exists(path):
        sys.exit(f"영상 없음: {path}  (tools/ref/video/<v>-clean.mp4 를 woori_edge.py encode 로 만들거나 --video 로 경로를 준다)")
    p = wv.pts(a.video)
    i_from = wv.frame_at(a.video, a.t_from)
    i_to = wv.frame_at(a.video, a.t_to)

    m = np.zeros((wv.H, wv.W), bool)
    m[APP_Y0:APP_Y1] = True
    for b in a.mask:
        x, y, w, h = parse_box(b)
        m[max(0, y):y + h, max(0, x):x + w] = False
    if not m.any():
        sys.exit("마스크가 앱 뷰포트를 전부 덮는다")

    rows = []
    prev = None
    for i, t, f in wv.iter_frames(a.video, max(0, i_from - 1), i_to):
        if i < i_from:  # 첫 프레임의 변화량을 재려고 바로 앞 프레임부터 읽는다
            prev = f
            continue
        if prev is None:
            pct, mad, bbox = 100.0, 255.0, [0, 0, wv.W, wv.H]
        else:
            d = cv2.absdiff(f, prev).max(axis=2)
            ch = (d > 24) & m
            pct = float(ch.mean() / m.mean() * 100)
            mad = float(d[m].mean())
            if ch.any():
                ys, xs = np.where(ch)
                bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
            else:
                bbox = None
        lum = float(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)[APP_Y0:APP_Y1].mean())
        rows.append({"index": i, "pts": t, "pct": pct, "mad": mad, "bbox": bbox, "lum": lum})
        prev = f
    if not rows:
        sys.exit(f"구간에 프레임이 없다 ({a.t_from}–{a.t_to}s)")

    # 구간 나누기
    segs = []
    cur = None
    for k, r in enumerate(rows):
        kind = "hold" if r["pct"] <= a.thresh else "change"
        if cur is None or cur["kind"] != kind:
            if cur:
                segs.append(cur)
            cur = {"kind": kind, "i0": r["index"], "i1": r["index"], "t0": r["pts"], "k0": k, "k1": k,
                   "bbox": None, "maxPct": 0.0}
        cur["i1"], cur["k1"] = r["index"], k
        cur["maxPct"] = max(cur["maxPct"], r["pct"])
        if r["bbox"] and kind == "change":
            b = cur["bbox"]
            cur["bbox"] = r["bbox"] if b is None else [min(b[0], r["bbox"][0]), min(b[1], r["bbox"][1]),
                                                       max(b[2], r["bbox"][2]), max(b[3], r["bbox"][3])]
    if cur:
        segs.append(cur)
    # 끝 시각 = 다음 구간 첫 프레임 pts (hold 는 다음 변화가 화면에 뜨기 직전까지). 마지막은 다음 프레임 pts (없으면 +1/60)
    last = rows[-1]["index"]
    t_end = p[last + 1] if last + 1 < len(p) else rows[-1]["pts"] + 1 / 60
    for j, s in enumerate(segs):
        s["t1"] = segs[j + 1]["t0"] if j + 1 < len(segs) else t_end
    # 짧은 hold 는 change 에 흡수
    merged = []
    for s in segs:
        if s["kind"] == "hold" and s["t1"] - s["t0"] < a.min_hold and merged and merged[-1]["kind"] == "change":
            merged[-1]["t1"] = s["t1"]
            merged[-1]["i1"], merged[-1]["k1"] = s["i1"], s["k1"]
            continue
        if merged and merged[-1]["kind"] == s["kind"]:
            q = merged[-1]
            q["t1"], q["i1"], q["k1"] = s["t1"], s["i1"], s["k1"]
            q["maxPct"] = max(q["maxPct"], s["maxPct"])
            if s["bbox"]:
                b = q["bbox"]
                q["bbox"] = s["bbox"] if b is None else [min(b[0], s["bbox"][0]), min(b[1], s["bbox"][1]),
                                                         max(b[2], s["bbox"][2]), max(b[3], s["bbox"][3])]
            continue
        merged.append(dict(s))

    for s in merged:
        s["dur"] = s["t1"] - s["t0"]
        s["frames"] = s["i1"] - s["i0"] + 1
        s["lum"] = round(float(np.mean([rows[k]["lum"] for k in range(s["k0"], s["k1"] + 1)])), 1)
        tag = "HOLD  " if s["kind"] == "hold" else "CHANGE"
        bb = f" bbox x{s['bbox'][0]}-{s['bbox'][2]} y{s['bbox'][1]}-{s['bbox'][3]}" if s["bbox"] else ""
        print(f"{tag} {s['t0']:8.3f}-{s['t1']:8.3f}s  {s['dur']:6.3f}s  #{s['i0']}-#{s['i1']} ({s['frames']}f)"
              f"  max {s['maxPct']:6.2f}%  lum {s['lum']:5.1f}{bb}")

    if a.csv:
        os.makedirs(os.path.dirname(os.path.abspath(a.csv)), exist_ok=True)
        with open(a.csv, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["index", "pts", "pctOver24", "meanAbsDiff", "bbox", "lum"])
            for r in rows:
                w.writerow([r["index"], f"{r['pts']:.6f}", f"{r['pct']:.3f}", f"{r['mad']:.3f}",
                            "" if not r["bbox"] else " ".join(map(str, r["bbox"])), f"{r['lum']:.1f}"])
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        with open(a.json, "w") as fh:
            json.dump({"video": a.video, "path": path, "from": a.t_from, "to": a.t_to, "thresh": a.thresh,
                       "minHold": a.min_hold, "masks": a.mask,
                       "segments": [{k: v for k, v in s.items() if k not in ("k0", "k1")} for s in merged]},
                      fh, indent=1)
    if a.contact:
        holds = [s for s in merged if s["kind"] == "hold"]
        mids = {rows[(s["k0"] + s["k1"]) // 2]["index"]: n for n, s in enumerate(holds)}
        tw, th = 110, 269  # 524x1280 → 0.21 배
        cols = 10
        rws = max(1, (len(holds) + cols - 1) // cols)
        sheet = np.full((rws * (th + 24), cols * (tw + 4), 3), 40, np.uint8)
        if mids:  # 가운데 프레임만 다시 읽는다 (한 장씩)
            lo, hi = min(mids), max(mids)
            for i, t, f in wv.iter_frames(a.video, lo, hi):
                if i not in mids:
                    continue
                n = mids[i]
                s = holds[n]
                y, x = (n // cols) * (th + 24), (n % cols) * (tw + 4)
                sheet[y + 22:y + 22 + th, x + 2:x + 2 + tw] = cv2.resize(f, (tw, th), interpolation=cv2.INTER_AREA)
                cv2.putText(sheet, f"{n}:{s['t0']:.2f} #{s['i0']}", (x + 3, y + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.36,
                            (255, 255, 255), 1, cv2.LINE_AA)
        os.makedirs(os.path.dirname(os.path.abspath(a.contact)), exist_ok=True)
        cv2.imwrite(a.contact, sheet)
        print(f"[contact] {a.contact}  (정지 구간 {len(holds)}개)")


if __name__ == "__main__":
    main()
