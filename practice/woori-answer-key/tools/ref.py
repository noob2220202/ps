#!/usr/bin/env python3
"""기준(reference) 프레임 생성기 — 영상 구간의 원본 프레임 중앙값 (woori_video.median_ref 규칙).

  python3 tools/ref.py --name home/top-banner1 --video v1 --i0 '#365' --i1 '#388'   # 원본 프레임 #365..#388 (둘 다 포함)
  python3 tools/ref.py --name home/top-banner1 --video v1 --i0 13.139 --i1 13.614   # 초로 주면 그 시각에 보이던 프레임
  python3 tools/ref.py --name send-a/x --video v2 --i '#2735'                        # 한 프레임
  python3 tools/ref.py --info --video v1 --i0 13.1 --i1 13.7                         # 구간에 드는 원본 프레임만 출력
  python3 tools/ref.py --all [--only home/,send-a/] [--force]    # tools/shots.json (+ shots.d) 의 video·i0·i1 로 전부
  python3 tools/ref.py --list                                    # 병합한 레지스트리를 JSON 으로 (shots-lib.cjs 와 같은 규칙)

출력: tools/ref/<group>/<state>.png  +  같은 이름의 .json (영상·구간·쓴 프레임·안정성 검사 결과)
  (실제 화면이 담긴 그림이라 tools/ref 는 git 에 올리지 않는다)

규칙 (spec 작업과 이 도구가 똑같이 만든다 — tools/woori_video.py 머리말):
  - 영상은 늘 손잡이를 지운 tools/ref/video/<v>-clean.mp4 (VFR). 구간은 원본 프레임 인덱스 i0..i1 (둘 다 포함).
    초로 받으면 i = 그 시각에 보이던 프레임 (pts ≤ t 인 마지막).
  - 그림 = i0..i1 프레임(많으면 균등하게 --max-frames 장, 기본 90)의 채널별 중앙값.
  - 빠른 스크롤 직후 정지 구간의 첫 0.3–0.4초(코덱 화질 회복)는 구간에서 뺀다 (구간을 고르는 쪽 책임).

안정성 검사: 각 프레임을 중앙값 결과와 비교해서 앱 뷰포트(y=46..1209)에서 24 넘게 차이 나는 픽셀이 0.3% 를 넘는 프레임이
  있으면 "구간 안에 움직임이 있음" 경고 (--strict 면 종료 코드 2). 스피너·OS 알림처럼 움직이는 곳은 --mask 로 뺀다
  (shots 항목의 mask 도 그대로 쓴다. 이름 마스크 keyboard · imeAppearing … 도 된다).
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True  # tools/ 에 __pycache__ 를 만들지 않음
TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)

APP_Y0, APP_Y1 = 46, 1210
NAMED_MASKS = {  # tools/woori-units.cjs 와 같은 값
    "statusbar": "0,0,524,46", "navbar": "0,1210,524,70",
    "keyboard": "0,738,524,542", "imeAppearing": "0,1207,524,73",
    "rightColumnIso": "523,0,1,1280", "edgePanelRawOnly": "0,147,9,176",
}


def parse_box(s):
    s = NAMED_MASKS.get(str(s).strip(), s)
    x, y, w, h = [int(round(float(v))) for v in str(s).split(",")]
    return x, y, w, h


def load_shots(file, shots_d=None):
    """shots.json + shots.d/*.json 병합 (tools/shots-lib.cjs loadShots 와 같은 규칙).
    같은 name → 필드 덮어쓰기(얕은 병합), maskAdd → mask 뒤에 덧붙임, 새 name → 뒤에 추가 (url 필수), '_' 필드는 무시."""
    spec = {"shots": []}
    if os.path.exists(file):
        with open(file, encoding="utf-8") as fh:
            spec = json.load(fh)
    raw = spec if isinstance(spec, list) else spec.get("shots", [])
    jobs = [{k: v for k, v in j.items() if not k.startswith("_")} for j in raw]
    by_name = {j["name"]: j for j in jobs if "name" in j}
    d = shots_d if shots_d is not None else os.path.join(os.path.dirname(os.path.abspath(file)), "shots.d")
    if d and os.path.isdir(d):
        for f in sorted(n for n in os.listdir(d) if n.endswith(".json")):
            p = os.path.join(d, f)
            with open(p, encoding="utf-8") as fh:
                extra = json.load(fh)
            items = extra if isinstance(extra, list) else extra.get("shots")
            if not isinstance(items, list):
                sys.exit(f"{p}: 배열(또는 {{\"shots\":[…]}})이어야 한다")
            for e in items:
                e = {k: v for k, v in e.items() if not k.startswith("_")}
                if not e.get("name"):
                    sys.exit(f"{p}: name 없는 항목")
                add = e.pop("maskAdd", None)
                cur = by_name.get(e["name"])
                if cur is None:
                    if not e.get("url"):
                        sys.exit(f"{p}: 새 항목 {e['name']} 에 url 이 없다")
                    cur = by_name[e["name"]] = {}
                    jobs.append(cur)
                cur.update(e)
                if add:
                    cur["mask"] = list(cur.get("mask", [])) + list(add)
    return jobs


def match_only(name, only):
    ps = [p.strip() for p in (only or "").split(",") if p.strip()]
    return not ps or any(name == p[:-1] if p.endswith("$") else name.startswith(p) for p in ps)


def build(video, i0, i1, out, name=None, max_frames=90, masks=(), quiet=False):
    """기준 프레임 생성 → (moving 프레임 목록, 최대 변화율)."""
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    import woori_video as wv  # noqa: WPS433

    if i1 < i0:
        i0, i1 = i1, i0
    p = wv.pts(video)
    img, idx, stack = wv.median_ref_stack(video, i0, i1, max_frames)
    m = np.zeros((wv.H, wv.W), bool)
    m[APP_Y0:APP_Y1, :] = True
    for b in masks:
        x, y, w, h = parse_box(b)
        m[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = False
    per = []
    worst = 0.0
    for k, i in enumerate(idx):
        d = np.abs(stack[k].astype(np.int16) - img.astype(np.int16)).max(axis=2)
        pct = float((d[m] > 24).mean() * 100) if m.any() else 0.0
        mad = float(d[m].mean()) if m.any() else 0.0
        worst = max(worst, pct)
        ys = np.where((d > 24) & m)[0]
        per.append({"index": int(i), "pts": round(float(p[i]), 6), "pctOver24": round(pct, 3), "meanAbsDiff": round(mad, 3),
                    "changedRows": [int(ys.min()), int(ys.max())] if pct > 0.3 and len(ys) else None})
    moving = [q for q in per if q["pctOver24"] > 0.3]

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    cv2.imwrite(out, img)
    rel = os.path.relpath(os.path.abspath(out), ROOT)
    meta = {
        "name": name, "png": rel, "video": video, "path": os.path.relpath(wv.video_path(video), ROOT),
        "i0": int(i0), "i1": int(i1), "t0": round(float(p[i0]), 6), "t1": round(float(p[i1]), 6),
        "rule": "woori_video.median_ref", "frames": len(idx), "maxFrames": max_frames, "masks": list(masks),
        "stableMaxPctOver24": round(worst, 3), "moving": moving, "perFrame": per,
    }
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)

    if not quiet:
        print(f"[ref] {rel}")
        print(f"      {video} #{i0}..#{i1}  ({p[i0]:.3f}–{p[i1]:.3f}s)  원본 프레임 {len(idx)}장 중앙값")
        if moving:
            print(f"      경고: 구간 안에 움직임 {len(moving)}프레임 (최대 {worst:.2f}% 픽셀 >24):")
            for q in moving[:8]:
                print(f"        #{q['index']} t={q['pts']:.3f}s  {q['pctOver24']:.2f}%  rows {q['changedRows']}")
        else:
            print(f"      안정적 (프레임별 최대 {worst:.3f}% 픽셀 >24)")
    return moving, worst


def job_range(j):
    """shots 항목 → (video, i0, i1) 또는 None. i0/i1 (정수 또는 '#n') 이 먼저, 없으면 t0/t1 (초)."""
    import woori_video as wv  # noqa: WPS433
    v = j.get("video")
    if not v:
        return None
    if j.get("i0") is not None and j.get("i1") is not None:
        a, b = j["i0"], j["i1"]
        i0 = a if isinstance(a, int) else wv.parse_index(v, a)
        i1 = b if isinstance(b, int) else wv.parse_index(v, b)
        return v, i0, i1
    if j.get("t0") is not None and j.get("t1") is not None:
        return v, wv.frame_at(v, float(j["t0"])), wv.frame_at(v, float(j["t1"]))
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", help="<group>/<state>  예: home/top-banner1")
    ap.add_argument("--video", default="v1", help="v1 | v2 (기본 v1, 손잡이 지운 clean 영상) 또는 영상 경로")
    ap.add_argument("--i", help="한 프레임 ('#원본인덱스' 또는 초)")
    ap.add_argument("--i0", help="구간 시작 ('#원본인덱스' 또는 초)")
    ap.add_argument("--i1", help="구간 끝, 포함 ('#원본인덱스' 또는 초)")
    ap.add_argument("--out", help="출력 png 경로 직접 지정 (기본 tools/ref/<name>.png)")
    ap.add_argument("--max-frames", type=int, default=90, help="프레임이 많으면 균등 표본 (기본 90, median_ref 와 같음)")
    ap.add_argument("--mask", action="append", default=[], metavar="x,y,w,h", help="안정성 검사에서 뺄 영역 (여러 번, 이름도 됨)")
    ap.add_argument("--strict", action="store_true", help="움직임 감지 시 종료 코드 2")
    ap.add_argument("--info", action="store_true", help="구간 프레임 목록만 출력")
    ap.add_argument("--all", action="store_true", help="shots.json(+shots.d) 의 video·i0·i1 이 있는 항목 전부")
    ap.add_argument("--list", action="store_true", help="병합한 레지스트리를 JSON 으로 출력하고 끝")
    ap.add_argument("--shots", default=os.path.join(TOOLS, "shots.json"))
    ap.add_argument("--shots-d", help="덧붙임 폴더 (기본 <shots 폴더>/shots.d)")
    ap.add_argument("--only", help="--all 에서 이름 앞부분 (쉼표로 여러 개, 끝에 $ 면 정확히 그 이름)")
    ap.add_argument("--force", action="store_true", help="--all 에서 이미 있는 ref 도 다시 생성")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    if a.list:
        print(json.dumps(load_shots(a.shots, a.shots_d), ensure_ascii=False))
        return

    import woori_video as wv  # noqa: WPS433

    if a.all:
        jobs = load_shots(a.shots, a.shots_d)
        n_ok = n_skip = n_warn = n_norange = 0
        for j in jobs:
            if not match_only(j["name"], a.only):
                continue
            rng = job_range(j)
            if rng is None:
                n_norange += 1
                continue
            v, i0, i1 = rng
            out = os.path.join(TOOLS, "ref", j["name"] + ".png")
            if os.path.exists(out) and not a.force:
                n_skip += 1
                continue
            if not os.path.exists(wv.video_path(v)):
                sys.exit(f"영상 없음: {wv.video_path(v)}")
            moving, _ = build(v, i0, i1, out, j["name"], a.max_frames, list(j.get("mask", [])) + list(j.get("refMask", [])), a.quiet)
            n_ok += 1
            n_warn += bool(moving)
        print(f"[ref --all] 상태 {len(jobs)}개: 생성 {n_ok} · 건너뜀(이미 있음) {n_skip} · 구간 없음 {n_norange} · 움직임 경고 {n_warn}")
        return

    if not os.path.exists(wv.video_path(a.video)):
        sys.exit(f"영상 없음: {wv.video_path(a.video)}  (tools/ref/video/<v>-clean.mp4)")
    if a.i is not None:
        i0 = i1 = wv.parse_index(a.video, a.i)
    elif a.i0 is not None and a.i1 is not None:
        i0, i1 = wv.parse_index(a.video, a.i0), wv.parse_index(a.video, a.i1)
    else:
        ap.error("--i 또는 --i0/--i1 (또는 --all / --list) 이 필요합니다")
    if i1 < i0:
        i0, i1 = i1, i0

    if a.info:
        p = wv.pts(a.video)
        for i in range(i0, i1 + 1):
            print(f"#{i:5d}  pts={p[i]:8.3f}s")
        print(f"[{a.video} #{i0}..#{i1}  {p[i0]:.3f}–{p[i1]:.3f}s, {i1 - i0 + 1}장]")
        return

    if not a.name and not a.out:
        ap.error("--name 또는 --out 이 필요합니다")
    if a.name and ".." in a.name:
        ap.error("--name 에 .. 는 쓸 수 없다")
    out = a.out or os.path.join(TOOLS, "ref", a.name + ".png")
    moving, _ = build(a.video, i0, i1, out, a.name, a.max_frames, a.mask, a.quiet)
    if moving and a.strict:
        sys.exit(2)


if __name__ == "__main__":
    main()
