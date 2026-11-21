"""삼성 엣지 패널 손잡이(화면 왼쪽 가장자리의 반투명 세로 막대) 지우기.

영상 두 개 모두 x 0–7, y 149–320 (frame px) 에 같은 손잡이가 떠 있다. 손잡이는 앱 위에 OS 가 반투명하게 덮어 그린 것이라
    보이는 값 = (1 − a) · 앱 + a · H        (픽셀마다 고정된 불투명도 a 와 색 H)
로 쓸 수 있다. a 와 H 를 두 영상의 평평한 배경 프레임 수천 장에서 픽셀마다 맞춰(fit) 두고,
    앱 = (보이는 값 − a · H) / (1 − a)
로 되돌린다(un-blend). 주변을 지어내 채우는(inpaint) 게 아니라 손잡이 밑에 실제로 있던 앱 화면을 계산으로 되살린다.
프레임마다 손잡이 진하기 b(0 = 없음, 1 = 평소)를 찾아 a 에 곱하므로, 손잡이가 없거나 흐려지는 프레임도 그대로 맞는다.

  python3 tools/woori_edge.py fit                       # 두 영상에서 a, H 를 맞춰 tools/woori_edge.json 저장
  python3 tools/woori_edge.py check [--video v1|v2|경로]  # 프레임별 b, 지운 뒤 남은 경계 세기 → tools/out/edge/<v>-check.json + 전후 비교 그림
  python3 tools/woori_edge.py encode --video v1          # 손잡이를 지운 영상 tools/ref/video/v1-clean.mp4 (원본 pts 그대로, 브라우저 재생 가능)

다른 도구는 영상 프레임을 읽은 뒤 clean_rgb(frame) / clean_bgr(frame) 를 불러 같은 처리를 한다 (woori_video.py).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
MODEL_PATH = os.path.join(TOOLS, "woori_edge.json")
VIDEO_DIR = os.path.join(TOOLS, "ref", "video")
W, H = 524, 1280

# 맞춤 영역 (frame px). 손잡이 x 0–7, y 149–320 에 여유를 둔다.
BOX_X1 = 10
BOX_Y0, BOX_Y1 = 144, 326
# 손잡이 밖의 기준 열: 여기는 손잡이 영향이 없다 (a < 0.01)
REF_X0, REF_X1 = 9, 24
B_GRID = np.round(np.arange(0.0, 1.301, 0.05), 3)


def video_path(name):
    if name in ("v1", "v2"):
        return os.path.join(VIDEO_DIR, name + ".mp4")
    return name


def read_region(path, y0=BOX_Y0 - 4, y1=BOX_Y1 + 4, x1=48):
    """영상의 왼쪽 띠 (x 0..x1, y y0..y1) 를 모든 프레임에 대해 RGB float32 로."""
    hh = y1 - y0
    cmd = ["ffmpeg", "-v", "fatal", "-i", path, "-fps_mode", "passthrough",
           "-vf", f"crop={x1}:{hh}:0:{y0}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, hh, x1, 3).astype(np.float32)


# ---------------------------------------------------------------- 모델

_model = None


def load_model():
    global _model
    if _model is None:
        with open(MODEL_PATH, encoding="utf-8") as f:
            m = json.load(f)
        a = np.array(m["alpha"], np.float32)            # rows x cols
        ah = np.array(m["alphaColor"], np.float32)      # rows x cols x 3  (= a · H, RGB)
        _model = {"y0": m["box"]["y0"], "y1": m["box"]["y1"], "x1": m["box"]["x1"], "a": a, "ah": ah}
    return _model


def _unblend(region, a, ah, b):
    """region: rows x cols x 3 (RGB float). b: 진하기 배율."""
    ab = np.clip(a * b, 0.0, 0.95)[..., None]
    return (region - ah * b) / (1.0 - ab)


def _roughness(img):
    """가로 방향 총변화량 (x 0 → 손잡이 오른쪽 바깥 열까지 이웃 열 차이의 합, 행·채널 평균).
    손잡이가 남아 있으면 안쪽(흰 30%)·테두리(회색 52%)·바깥 사이에 계단이 생겨 커지고, 제대로 지우면 배경만 남아 작아진다.
    화면 왼쪽 8px 안쪽은 거의 늘 배경(앱 여백)이라 이 기준이 안정적이다. img: rows x cols x 3."""
    return float(np.abs(np.diff(img, axis=1)).sum(axis=1).mean())


def best_b(region, m):
    """이 프레임에서 손잡이 진하기 b 를 찾는다 (가로 총변화량이 가장 작아지는 값). 손잡이 몸통 행(y 160–308)만 본다.
    region 은 모델 폭보다 넓게(손잡이 밖 열 포함) 주고, m 의 a/ah 도 같은 폭으로 0 을 덧댄 것을 준다."""
    r0, r1 = 160 - m["y0"], 308 - m["y0"]
    reg = region[r0:r1, :BOX_X1 + 2]
    a, ah = m["a"][r0:r1, :BOX_X1 + 2], m["ah"][r0:r1, :BOX_X1 + 2]
    errs = [_roughness(_unblend(reg, a, ah, b)) for b in B_GRID]
    i = int(np.argmin(errs))
    # 이웃 세 점으로 포물선 보간
    if 0 < i < len(B_GRID) - 1:
        e0, e1, e2 = errs[i - 1], errs[i], errs[i + 1]
        den = e0 - 2 * e1 + e2
        off = 0.5 * (e0 - e2) / den if den > 1e-6 else 0.0
        b = float(B_GRID[i] + np.clip(off, -1, 1) * 0.05)
    else:
        b = float(B_GRID[i])
    return max(0.0, b), errs[0], min(errs)


def handle_present(region, m):
    """손잡이가 이 프레임에 떠 있는지 (b=1 로 지운 쪽이 b=0(그대로)보다 매끈하면 있음). region/m 은 best_b 와 같은 모양.
    두 영상 11,031 프레임 전부에서 손잡이가 떠 있었고 진하기는 늘 같았다(b 중앙값 0.99–1.00, P5–P95 0.94–1.04 는 측정 잡음).
    프레임마다 b 를 따로 맞추면 오히려 잡음이 커져서 (테두리 열 오차 P99 7.1 → 5.3) 있다/없다만 가린다."""
    r0, r1 = 160 - m["y0"], 308 - m["y0"]
    reg = region[r0:r1, :BOX_X1 + 2]
    a, ah = m["a"][r0:r1, :BOX_X1 + 2], m["ah"][r0:r1, :BOX_X1 + 2]
    e0 = _roughness(reg)
    e1 = _roughness(_unblend(reg, a, ah, 1.0))
    return e1 < e0, e0, e1


def clean_rgb(frame, b=None, return_info=False):
    """RGB uint8 프레임(524x1280)에서 손잡이를 지운 사본. b 를 주지 않으면 손잡이가 있으면 1, 없으면 0."""
    m = load_model()
    y0, y1, x1 = m["y0"], m["y1"], m["x1"]
    out = frame.copy()
    reg = frame[y0:y1, :x1 + 6].astype(np.float32)
    if b is None:
        pad = {**m, "a": np.pad(m["a"], ((0, 0), (0, 6))), "ah": np.pad(m["ah"], ((0, 0), (0, 6), (0, 0)))}
        present, e_raw, e_best = handle_present(reg, pad)
        b = 1.0 if present else 0.0
    else:
        e_raw = e_best = None
    if b > 0.02:
        fixed = _unblend(reg[:, :x1], m["a"], m["ah"], b)
        out[y0:y1, :x1] = np.clip(np.rint(fixed), 0, 255).astype(np.uint8)
    if return_info:
        return out, {"b": round(b, 3), "edgeRaw": e_raw, "edgeClean": e_best}
    return out


def clean_bgr(frame, b=None, return_info=False):
    """cv2(BGR) 프레임용."""
    res = clean_rgb(frame[..., ::-1], b=b, return_info=return_info)
    if return_info:
        return np.ascontiguousarray(res[0][..., ::-1]), res[1]
    return np.ascontiguousarray(res[..., ::-1])


# ---------------------------------------------------------------- fit

def cmd_fit(args):
    rows = BOX_Y1 - BOX_Y0
    data = [([], []) for _ in range(rows)]
    for v in args.videos:
        seg = read_region(video_path(v))
        ref = seg[:, :, REF_X0:REF_X1]
        bg = np.median(ref, axis=2)                                   # N x rows+8 x 3
        flat = (ref.max(axis=2) - ref.min(axis=2)).max(axis=2) < 3    # 그 행의 기준 열이 평평
        ok = flat.copy()
        for k in range(-3, 4):                                        # 위아래 3행도 평평하고 같은 색
            ok[:, 4:-4] &= np.roll(flat, k, axis=1)[:, 4:-4]
            ok[:, 4:-4] &= (np.abs(np.roll(bg, k, axis=1) - bg).max(axis=2) < 3)[:, 4:-4]
        for r in range(rows):
            idx = np.where(ok[:, r + 4])[0]
            data[r][0].append(bg[idx, r + 4])
            data[r][1].append(seg[idx, r + 4, :BOX_X1])
        print(f"{v}: {seg.shape[0]} 프레임", file=sys.stderr)
    alpha = np.zeros((rows, BOX_X1), np.float32)
    ah = np.zeros((rows, BOX_X1, 3), np.float32)
    rms = np.zeros((rows, BOX_X1), np.float32)
    nsamp = np.zeros(rows, int)
    levels = np.zeros(rows, int)
    for r in range(rows):
        b = np.concatenate(data[r][0])
        o = np.concatenate(data[r][1])
        lum = b.mean(axis=1)
        bins = np.round(lum / 4).astype(int)
        sel = []
        for u in np.unique(bins):                                    # 흰 배경만 많아 치우치지 않게 밝기 칸마다 최대 200개
            sel.extend(np.where(bins == u)[0][:200])
        sel = np.array(sel, int)
        b, o = b[sel], o[sel]
        nsamp[r] = len(b)
        levels[r] = len(np.unique(bins))
        n = len(b)
        for x in range(BOX_X1):
            A = np.zeros((3 * n, 4))
            y = np.zeros(3 * n)
            for ch in range(3):
                A[ch * n:(ch + 1) * n, 0] = b[:, ch]
                A[ch * n:(ch + 1) * n, 1 + ch] = 1
                y[ch * n:(ch + 1) * n] = o[:, x, ch]
            sol, *_ = np.linalg.lstsq(A, y, rcond=None)
            for _ in range(3):                                       # 튀는 표본(평평하지 않던 배경) 빼고 다시
                res = y - A @ sol
                sc = np.median(np.abs(res)) * 1.5 + 0.5
                w = np.abs(res) < 4 * sc
                sol, *_ = np.linalg.lstsq(A[w], y[w], rcond=None)
            a = 1.0 - sol[0]
            if a < 0.003:                                            # 손잡이 밖: 정확히 0 으로
                a, c = 0.0, np.zeros(3)
            else:
                c = sol[1:]
            alpha[r, x] = a
            ah[r, x] = c
            rms[r, x] = float(np.sqrt(np.mean((y - A @ sol)[w] ** 2)))
    model = {
        "about": "삼성 엣지 패널 손잡이 모델: 보이는 값 = (1-a)·앱 + a·H. alpha=a, alphaColor=a·H (RGB 0..255). tools/woori_edge.py fit 이 만든다.",
        "box": {"x0": 0, "x1": BOX_X1, "y0": BOX_Y0, "y1": BOX_Y1},
        "videos": args.videos,
        "samplesPerRowMin": int(nsamp.min()),
        "brightnessLevelsPerRowMin": int(levels.min()),
        "fitRmsMax": round(float(rms.max()), 2),
        "alpha": np.round(alpha, 4).tolist(),
        "alphaColor": np.round(ah, 3).tolist(),
    }
    with open(MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    body = alpha[20:160]
    print(json.dumps({
        "model": os.path.relpath(MODEL_PATH, ROOT),
        "samplesPerRowMin": model["samplesPerRowMin"],
        "brightnessLevelsPerRowMin": model["brightnessLevelsPerRowMin"],
        "fitRmsMax": model["fitRmsMax"],
        "alphaBodyCols": [round(float(v), 3) for v in np.median(body, axis=0)],
        "colorBodyCols": [round(float(c.mean() / a), 1) if a > 0.02 else None
                          for a, c in zip(np.median(body, axis=0), np.median(ah[20:160], axis=0))],
    }, ensure_ascii=False, indent=1))


# ---------------------------------------------------------------- check / encode

def _frames_rgb(path):
    """전체 프레임을 RGB uint8 로 하나씩 (pts 순서 = 디코드 순서)."""
    cmd = ["ffmpeg", "-v", "fatal", "-i", path, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H * 3
    try:
        while True:
            buf = p.stdout.read(n)
            if len(buf) < n:
                break
            yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    finally:
        p.stdout.close()
        p.wait()


def probe_pts(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time",
                          "-of", "csv=p=0", path], check=True, capture_output=True, text=True).stdout
    return [float(x.split(",")[0]) for x in out.split() if x.split(",")[0].strip()]


def cmd_check(args):
    m = load_model()
    path = video_path(args.video)
    name = args.video if args.video in ("v1", "v2") else os.path.splitext(os.path.basename(path))[0]
    outdir = os.path.join(TOOLS, "out", "edge")
    os.makedirs(outdir, exist_ok=True)
    seg = read_region(path, m["y0"], m["y1"], m["x1"] + 6)
    pad = {**m, "a": np.pad(m["a"], ((0, 0), (0, 6))), "ah": np.pad(m["ah"], ((0, 0), (0, 6), (0, 0)))}
    bs, raw_e, clean_e = [], [], []
    for reg in seg:
        b, e0, e1 = best_b(reg, pad)
        bs.append(round(b, 3))
        raw_e.append(round(e0, 2))
        clean_e.append(round(e1, 2))
    bs = np.array(bs)
    rep = {
        "video": name, "frames": len(bs),
        "bMedian": float(np.median(bs)), "bP5": float(np.percentile(bs, 5)), "bP95": float(np.percentile(bs, 95)),
        "framesHandleAbsent(b<0.1)": int((bs < 0.1).sum()),
        "framesHandleOdd(|b-1|>0.15)": int((np.abs(bs - 1) > 0.15).sum()),
        "roughRawMedian": float(np.median(raw_e)), "roughCleanMedian": float(np.median(clean_e)),
        "roughCleanP99": float(np.percentile(clean_e, 99)),
    }
    odd = [i for i in range(len(bs)) if abs(bs[i] - 1) > 0.15]
    rep["oddFrames"] = odd[:200]
    with open(os.path.join(outdir, f"{name}-check.json"), "w", encoding="utf-8") as f:
        json.dump({**rep, "b": bs.tolist(), "edgeRaw": raw_e, "edgeClean": clean_e}, f)
    print(json.dumps(rep, ensure_ascii=False, indent=1))


def cmd_encode(args):
    import cv2  # noqa: WPS433 (encode 에서만 필요)
    path = video_path(args.video)
    name = args.video if args.video in ("v1", "v2") else os.path.splitext(os.path.basename(path))[0]
    out = args.out or os.path.join(VIDEO_DIR, f"{name}-clean.mp4")
    tmp = os.path.join(TOOLS, "out", "edge", f"{name}-frames")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    pts = probe_pts(path)
    lines = ["ffconcat version 1.0"]
    n = 0
    for i, fr in enumerate(_frames_rgb(path)):
        c = clean_rgb(fr)
        fn = f"{i:05d}.png"
        cv2.imwrite(os.path.join(tmp, fn), c[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 1])
        n += 1
    if n != len(pts):
        sys.exit(f"프레임 수가 pts 수와 다름: {n} vs {len(pts)}")
    for i in range(n):
        dur = (pts[i + 1] - pts[i]) if i + 1 < n else max(1 / 120, pts[i] - pts[i - 1])
        lines.append(f"file '{i:05d}.png'")
        # 이미지 입력의 시간 단위 기본값은 1/25 초라서 그대로면 pts 가 0.04 초 단위로 뭉개진다 → 파일마다 1/90000 초로
        lines.append("option framerate 90000")
        lines.append(f"duration {dur:.6f}")
    lst = os.path.join(tmp, "list.ffconcat")
    with open(lst, "w") as f:
        f.write("\n".join(lines) + "\n")
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
           "-fps_mode", "passthrough", "-enc_time_base", "1/90000", "-video_track_timescale", "90000",
           "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    got = probe_pts(out)
    m = min(len(got), len(pts))
    dmax = max(abs(got[i] - pts[i]) for i in range(m)) if m else None
    print(json.dumps({"out": out, "frames": len(got), "srcFrames": len(pts), "ptsMaxDiffSec": dmax,
                      "sizeMB": round(os.path.getsize(out) / 1e6, 1)}, ensure_ascii=False))
    if len(got) != len(pts) or dmax is None or dmax > 1e-4:
        sys.exit("깨끗한 영상의 프레임 수나 pts 가 원본과 다름")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fit")
    f.add_argument("--videos", nargs="+", default=["v1", "v2"])
    c = sub.add_parser("check")
    c.add_argument("--video", default="v1")
    e = sub.add_parser("encode")
    e.add_argument("--video", default="v1")
    e.add_argument("--out")
    e.add_argument("--crf", type=int, default=10)
    e.add_argument("--preset", default="slow")
    args = ap.parse_args()
    {"fit": cmd_fit, "check": cmd_check, "encode": cmd_encode}[args.cmd](args)


if __name__ == "__main__":
    main()
