"""우리WON 화면녹화 영상 공용 유틸 (ref·scan·compare 와 스펙 작업이 함께 쓰는 약속).

영상 두 개 (같은 폰·같은 날, 524x1280, VFR):
  v1 = gzhk9p (200.483 s, 7590 프레임)   v2 = 3k3eqy (90.896 s, 3441 프레임)
기본은 왼쪽 엣지 패널 손잡이를 지운 tools/ref/video/<v>-clean.mp4 (woori_edge.py encode 로 만듦, pts 는 원본과 같다).
원본(<v>.mp4)을 쓰면 프레임마다 woori_edge.clean_bgr 를 거친다.

시간 규칙 (VFR):
  - "시각 t 에 화면에 보이던 프레임" = pts ≤ t 인 마지막 프레임 (frame_at).
  - 구간은 **원본 프레임 인덱스 i0..i1 (둘 다 포함)** 로 정한다. 초 단위 t1 의 뜻이 문서마다 달랐으므로(마지막 프레임 pts / 다음 변화 시작)
    도구는 늘 i0/i1 로 고른다. 초로 받으면 i0 = frame_at(t0), i1 = frame_at(t1).
  - 표기: "12.5"(초), "#1234"(원본 인덱스).

기준 프레임(median) 규칙 — 스펙 작업과 ref 도구가 똑같이 만든다:
  i0..i1 의 프레임을 모두(많으면 균등하게 max_frames 장) 읽어 채널별 중앙값(np.median, 짝수 장이면 두 값 평균을 반올림)을 낸다.
  빠른 스크롤 직후 정지 구간의 첫 0.3–0.4 초는 코덱이 화질을 끌어올리는 프레임이라 구간에서 뺀다(구간을 고르는 쪽 책임).

  python3 tools/woori_video.py pts --video v1                         # 프레임 수, 길이, 처음·끝 pts
  python3 tools/woori_video.py at --video v1 --t 12.5                 # 그 시각에 보이던 프레임 #
  python3 tools/woori_video.py frame --video v2 --i 1234 --out a.png  # 한 프레임 (손잡이 지운 것)
  python3 tools/woori_video.py ref --video v1 --i0 400 --i1 430 --out tools/ref/home/idle.png [--max-frames 90]
"""
import argparse
import bisect
import json
import os
import subprocess
import sys

import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
VIDEO_DIR = os.path.join(TOOLS, "ref", "video")
W, H = 524, 1280
VIDEOS = ("v1", "v2")


def video_path(video="v1", raw=False):
    """'v1'/'v2' → 영상 경로 (기본: 손잡이 지운 clean). 그 밖의 값은 경로로 본다."""
    if video in VIDEOS:
        env = os.environ.get("WOORI_" + video.upper())
        if env:
            return env
        return os.path.join(VIDEO_DIR, f"{video}.mp4" if raw else f"{video}-clean.mp4")
    return video


def _is_raw(path):
    return not path.endswith("-clean.mp4")


_pts_cache = {}


def pts(video="v1"):
    """모든 프레임의 pts(초) 목록. tools/ref/video/<v>-pts.json 에 캐시 (clean 과 원본이 같다)."""
    path = video_path(video)
    if path in _pts_cache:
        return _pts_cache[path]
    cache = None
    if video in VIDEOS:
        cache = os.path.join(VIDEO_DIR, f"{video}-pts.json")
        if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(path):
            with open(cache) as f:
                _pts_cache[path] = json.load(f)
                return _pts_cache[path]
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time",
                          "-of", "csv=p=0", path], check=True, capture_output=True, text=True).stdout
    p = [float(x.split(",")[0]) for x in out.split() if x.split(",")[0].strip()]
    if cache:
        with open(cache, "w") as f:
            json.dump(p, f)
    _pts_cache[path] = p
    return p


def frame_at(video, t):
    """시각 t(초)에 화면에 보이던 원본 프레임 인덱스 (pts ≤ t 인 마지막)."""
    p = pts(video)
    return max(0, bisect.bisect_right(p, t + 1e-9) - 1)


def parse_index(video, s):
    """'#123' → 123, '12.5' → frame_at(12.5)."""
    s = str(s).strip()
    if s.startswith("#"):
        return int(s[1:])
    return frame_at(video, float(s))


def read_frames(video, i0, i1, step=1):
    """원본 인덱스 i0..i1(포함) 중 step 간격 프레임을 BGR uint8 로 [(i, frame), ...]. 손잡이는 지운 상태."""
    path = video_path(video)
    p = pts(video)
    i0 = max(0, i0)
    i1 = min(len(p) - 1, i1)
    want = set(range(i0, i1 + 1, step))
    t_seek = max(0.0, p[i0] - 1.0)
    # -ss 를 -i 앞에 두면 빠르게 찾고, -copyts 로 원래 pts 를 유지해 select 로 정확히 고른다
    lo, hi = p[i0] - 1e-4, p[i1] + 1e-4
    cmd = ["ffmpeg", "-v", "fatal", "-ss", f"{t_seek:.6f}", "-copyts", "-i", path,
           "-vf", f"select='between(t\\,{lo:.6f}\\,{hi:.6f})'", "-fps_mode", "passthrough",
           "-frames:v", str(i1 - i0 + 1),  # 구간 뒤는 디코드하지 않게
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    n = len(raw) // (W * H * 3)
    frames = np.frombuffer(raw[: n * W * H * 3], np.uint8).reshape(n, H, W, 3)
    if n != i1 - i0 + 1:
        sys.exit(f"{video} #{i0}..#{i1}: 프레임 {i1 - i0 + 1}장을 기대했는데 {n}장을 읽음")
    out = []
    clean = None
    if _is_raw(path):
        sys.path.insert(0, TOOLS)
        import woori_edge  # noqa: WPS433
        clean = woori_edge.clean_bgr
    for k in range(n):
        i = i0 + k
        if i in want:
            f = frames[k]
            out.append((i, clean(f) if clean else f.copy()))
    return out


def read_frame(video, i):
    return read_frames(video, i, i)[0][1]


def median_ref(video, i0, i1, max_frames=90):
    """i0..i1(포함) 프레임의 채널별 중앙값 (BGR uint8). 많으면 균등 표본 max_frames 장."""
    n = i1 - i0 + 1
    if n <= 0:
        raise ValueError("빈 구간")
    idx = list(range(i0, i1 + 1))
    if n > max_frames:
        idx = sorted(set(int(round(x)) for x in np.linspace(i0, i1, max_frames)))
    got = dict(read_frames(video, i0, i1))
    stack = np.stack([got[i] for i in idx]).astype(np.float32)
    med = np.median(stack, axis=0)
    return np.clip(np.rint(med), 0, 255).astype(np.uint8), idx


def median_ref_stack(video, i0, i1, max_frames=90):
    """median_ref 와 같은 규칙(같은 표본 idx, 같은 중앙값·반올림)으로 기준 프레임을 만들고 쓴 프레임 묶음도 돌려준다.
    ref.py 의 안정성 검사(프레임마다 중앙값과 비교)가 영상을 두 번 읽지 않게 하려고 둔다.
    반환 (img BGR uint8, idx, stack uint8 N×H×W×3). selftest 가 median_ref 와 같은 그림인지 검사한다."""
    n = i1 - i0 + 1
    if n <= 0:
        raise ValueError("빈 구간")
    idx = list(range(i0, i1 + 1))
    if n > max_frames:
        idx = sorted(set(int(round(x)) for x in np.linspace(i0, i1, max_frames)))
    got = dict(read_frames(video, i0, i1))
    stack = np.stack([got[i] for i in idx])
    med = np.median(stack.astype(np.float32), axis=0)
    return np.clip(np.rint(med), 0, 255).astype(np.uint8), idx, stack


def iter_frames(video, i0=0, i1=None):
    """원본 인덱스 i0..i1(포함, 기본 끝까지)을 차례로 (i, pts, BGR uint8) 로 내준다. 메모리에 한 장씩만 둔다
    (scan.py 처럼 영상 전체를 훑을 때. read_frames 는 구간을 통째로 메모리에 올린다). 손잡이는 지운 상태.
    디코드 방식은 read_frames 와 같다 (-ss 앞 + -copyts + select 로 원래 pts 의 프레임만)."""
    path = video_path(video)
    p = pts(video)
    i0 = max(0, i0)
    i1 = len(p) - 1 if i1 is None else min(len(p) - 1, i1)
    if i1 < i0:
        return
    t_seek = max(0.0, p[i0] - 1.0)
    lo, hi = p[i0] - 1e-4, p[i1] + 1e-4
    cmd = ["ffmpeg", "-v", "fatal", "-ss", f"{t_seek:.6f}", "-copyts", "-i", path,
           "-vf", f"select='between(t\\,{lo:.6f}\\,{hi:.6f})'", "-fps_mode", "passthrough",
           "-frames:v", str(i1 - i0 + 1), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    clean = None
    if _is_raw(path):
        sys.path.insert(0, TOOLS)
        import woori_edge  # noqa: WPS433
        clean = woori_edge.clean_bgr
    size = W * H * 3
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    k = 0
    try:
        while k < i1 - i0 + 1:
            buf = proc.stdout.read(size)
            if len(buf) < size:
                break
            f = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            yield i0 + k, p[i0 + k], (clean(f) if clean else f.copy())
            k += 1
    finally:
        proc.stdout.close()
        proc.kill()
        proc.wait()
    if k != i1 - i0 + 1:
        sys.exit(f"{video} #{i0}..#{i1}: 프레임 {i1 - i0 + 1}장을 기대했는데 {k}장을 읽음")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("pts")
    a.add_argument("--video", default="v1")
    b = sub.add_parser("at")
    b.add_argument("--video", default="v1")
    b.add_argument("--t", type=float, required=True)
    c = sub.add_parser("frame")
    c.add_argument("--video", default="v1")
    c.add_argument("--i", required=True, help="#인덱스 또는 초")
    c.add_argument("--out", required=True)
    d = sub.add_parser("ref")
    d.add_argument("--video", default="v1")
    d.add_argument("--i0", required=True, help="#인덱스 또는 초")
    d.add_argument("--i1", required=True, help="#인덱스 또는 초 (포함)")
    d.add_argument("--out", required=True)
    d.add_argument("--max-frames", type=int, default=90)
    args = ap.parse_args()
    import cv2  # noqa: WPS433
    if args.cmd == "pts":
        p = pts(args.video)
        print(json.dumps({"video": args.video, "path": video_path(args.video), "frames": len(p),
                          "first": p[0], "last": p[-1]}, ensure_ascii=False))
    elif args.cmd == "at":
        i = frame_at(args.video, args.t)
        print(json.dumps({"i": i, "pts": pts(args.video)[i]}))
    elif args.cmd == "frame":
        i = parse_index(args.video, args.i)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        cv2.imwrite(args.out, read_frame(args.video, i))
        print(json.dumps({"i": i, "pts": pts(args.video)[i], "out": args.out}))
    elif args.cmd == "ref":
        i0 = parse_index(args.video, args.i0)
        i1 = parse_index(args.video, args.i1)
        img, idx = median_ref(args.video, i0, i1, args.max_frames)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        cv2.imwrite(args.out, img)
        p = pts(args.video)
        print(json.dumps({"out": args.out, "video": args.video, "i0": i0, "i1": i1, "t0": p[i0], "t1": p[i1],
                          "frames": len(idx)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
