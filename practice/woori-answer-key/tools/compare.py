#!/usr/bin/env python3
"""스크린샷(shot) vs 영상 기준 프레임(ref) 픽셀 비교.

  python3 tools/compare.py shot.png ref.png outdir [옵션]
  python3 tools/compare.py --print-units          # 이 파일의 단위·마스크 상수 (selftest 가 woori-units.cjs 와 대조)

출력 (outdir):
  overlay.png  shot 50% + ref 50% 블렌드
  onion.png    shot 위에 ref 를 40% 로 얹은 어니언스킨
  diff.png     채널별 |shot-ref| 최댓값을 x4 증폭한 히트맵 (어두운 ref 위), 사선 무늬 = 마스크
  edges.png    어두운 배경에 ref 윤곽선=빨강, shot 윤곽선=청록, 일치=흰색 (위치 어긋남 찾기에 최적)
  side.png     ref | shot | edges | diff 나란히 + 48px(33dp) 띠별 차이 막대
  elements.png (--boxes 사용 시) 요소별 shot 위치(청록) vs ref 추정 위치(빨강)
  metrics.json 아래 JSON 과 동일

stdout 에 JSON 지표, stderr 에 사람이 읽는 요약:
  meanAbsDiff      마스크 밖 픽셀의 채널평균 |차이| (0..255)
  pctPixelsOver24  채널 최대 |차이| > 24 인 픽셀 비율(%)
  meanSignedRGB    (shot - ref) 평균 [R,G,B]  (+ 면 shot 이 더 밝음)
  globalOffset     콘텐츠 전체의 (dx,dy) 추정
  bands[]          y=0,48,96,... 48px 가로 띠별 meanAbsDiff / pctOver24 / signedRGB
  worstBands[]     차이 큰 띠들의 (dx,dy) 추정 (템플릿 매칭 + 위상상관)
  elements[]       --boxes 로 받은 DOM 요소별 (dx,dy) 추정

단위 (D1, tools/woori-units.cjs 와 같은 값): 두 그림 모두 524x1280 frame px
  (앱은 뷰포트 360x880 dp 를 deviceScaleFactor 16/11 로 찍은 것, ?frame=1 이면 가로 보정 transform 이 들어가 영상과 1:1).
  가로와 세로 배율이 다르다: dxDp = dx / 1.45803,  dyDp = dy × 0.6875 (= 11/16).
  위치는 x_dp = 180 + (x_px − 262.02)/1.45803, y_dp = y_px × 0.6875 (화면 위끝 기준, 앱 안 y = y_dp − 31.333).

오프셋 규칙: offset (dx,dy) = shot 위치 - ref 위치.
  dx>0 : shot 의 내용이 영상보다 오른쪽에 있음 -> 왼쪽으로 dx 만큼 옮기면 맞음
  dy>0 : shot 의 내용이 영상보다 아래에 있음   -> 위로 dy 만큼 옮기면 맞음

신뢰도: score(정규화 상관) < 0.5 이면 note=low-confidence, reliable=false — 내용 자체가 달라서
  오프셋 숫자는 의미가 없다 (먼저 내용/색을 맞출 것). no-content-in-search-image = 앱 쪽이 민무늬.

기본 마스크 (OS UI, 앱이 그리지 않는 곳): 상태바 0,0,524,46 · 3버튼 내비 바 0,1210,524,70
  (--no-mask-statusbar / --no-mask-navbar 로 하나씩, --no-default-mask 로 둘 다 해제).
  엣지 패널 손잡이는 기준 프레임(*-clean.mp4)에서 지웠으므로 마스크하지 않는다.
--mask x,y,w,h 로 추가 영역 제외 (스피너, 캐럿, OS 알림 등). 이름도 된다: keyboard · imeAppearing · rightColumnIso · edgePanelRawOnly.
"""
import argparse
import json
import os
import sys

sys.dont_write_bytecode = True

FRAME_W, FRAME_H = 524, 1280
PX_PER_DP_X = 1.45803       # 가로: 1 dp = 1.45803 frame px
X_CENTER_PX, X_CENTER_DP = 262.02, 180.0
DP_PER_PX_Y = 11 / 16       # 세로: 1 frame px = 0.6875 dp
STATUS_BAR_DP = 94 / 3      # 31.333 (앱 뷰포트 위끝)
DEFAULT_MASKS = {"statusbar": "0,0,524,46", "navbar": "0,1210,524,70"}
OPTIONAL_MASKS = {"keyboard": "0,738,524,542", "imeAppearing": "0,1207,524,73",
                  "rightColumnIso": "523,0,1,1280", "edgePanelRawOnly": "0,147,9,176"}


def dx_dp(px):
    return px / PX_PER_DP_X


def dy_dp(px):
    return px * DP_PER_PX_Y


def x_dp(px):
    return X_CENTER_DP + (px - X_CENTER_PX) / PX_PER_DP_X


def r2(v):
    v = round(float(v), 2)
    return 0.0 if v == 0 else v


def r3(v):
    v = round(float(v), 3)
    return 0.0 if v == 0 else v


# ---------------------------------------------------------------- helpers
def load_rgb(path):
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f"이미지를 읽을 수 없음: {path}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:  # 투명 -> 흰 배경 합성
        a = img[:, :, 3:4].astype(np.float32) / 255.0
        img = (img[:, :, :3].astype(np.float32) * a + 255.0 * (1 - a)).round().astype(np.uint8)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def save_rgb(path, rgb):
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    cv2.imwrite(path, cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2BGR))


def parse_box(s):
    s = str(s).strip()
    s = DEFAULT_MASKS.get(s, OPTIONAL_MASKS.get(s, s))
    try:
        v = [int(round(float(t))) for t in s.split(",")]
    except ValueError:
        v = []
    if len(v) != 4:
        raise argparse.ArgumentTypeError(f"'{s}': x,y,w,h 또는 마스크 이름({', '.join(list(DEFAULT_MASKS) + list(OPTIONAL_MASKS))})")
    return tuple(v)


def gray(rgb):
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)


def subpix(res, x, y):
    """정규화 상관 맵 피크의 포물선 보간."""
    import numpy as np  # noqa: WPS433

    def para(a, b, c):
        den = a - 2 * b + c
        return 0.0 if abs(den) < 1e-9 else 0.5 * (a - c) / den
    h, w = res.shape
    sx = para(res[y, x - 1], res[y, x], res[y, x + 1]) if 0 < x < w - 1 else 0.0
    sy = para(res[y - 1, x], res[y, x], res[y + 1, x]) if 0 < y < h - 1 else 0.0
    return float(np.clip(sx, -0.5, 0.5)), float(np.clip(sy, -0.5, 0.5))


def estimate_offset(tmpl_src, search_src, x0, y0, x1, y1, R):
    """tmpl_src[y0:y1,x0:x1] 를 search_src 에서 ±R 범위로 찾는다.
    반환 (dx,dy) = search 에서 찾은 위치 - 원래 위치 (frame px, dp 도). 텍스처가 없으면 note."""
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    H, W = tmpl_src.shape
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    T = tmpl_src[y0:y1, x0:x1]
    if float(T.std()) < 2.0:
        return {"dx": None, "dy": None, "score": None, "note": "flat"}
    pad = cv2.copyMakeBorder(search_src, R, R, R, R, cv2.BORDER_REPLICATE)
    S = pad[y0:y1 + 2 * R, x0:x1 + 2 * R]
    if float(S.std()) < 2.0:  # 찾을 쪽이 민무늬 -> 대응 내용 없음
        return {"dx": None, "dy": None, "score": None, "note": "no-content-in-search-image"}
    res = cv2.matchTemplate(S, T, cv2.TM_CCOEFF_NORMED)
    res = np.nan_to_num(res, nan=-1.0)
    if float(res.max() - res.min()) < 1e-3:
        return {"dx": None, "dy": None, "score": None, "note": "no-match"}
    _, mx, _, loc = cv2.minMaxLoc(res)
    px, py = loc
    sx, sy = subpix(res, px, py)
    zero = float(res[R, R])
    r2m = res.copy()  # 두 번째 피크와의 차이 (반복 패턴이면 작음)
    r2m[max(0, py - 3):py + 4, max(0, px - 3):px + 4] = -1
    second = float(r2m.max()) if r2m.size else -1.0
    dx, dy = px - R + sx, py - R + sy
    out = {
        "dx": r2(dx), "dy": r2(dy), "dxInt": int(px - R), "dyInt": int(py - R),
        "dxDp": r2(dx_dp(dx)), "dyDp": r2(dy_dp(dy)),
        "score": round(float(mx), 4), "scoreAtZero": round(zero, 4), "distinct": round(float(mx) - second, 4),
    }
    notes = []
    if mx < 0.5:
        notes.append("low-confidence")  # 내용 자체가 다름 -> 오프셋 숫자는 의미 없음
    if out["distinct"] < 0.02:
        notes.append("ambiguous")
    if abs(px - R) == R or abs(py - R) == R:
        notes.append("at-search-limit")
    out["reliable"] = not notes
    if notes:
        out["note"] = ",".join(notes)
    try:  # 위상상관 (보조, 서브픽셀)
        a = tmpl_src[y0:y1, x0:x1].astype(np.float64)
        b = search_src[y0:y1, x0:x1].astype(np.float64)
        if a.shape[0] >= 8 and a.shape[1] >= 8:
            win = cv2.createHanningWindow((a.shape[1], a.shape[0]), cv2.CV_64F)
            (pdx, pdy), resp = cv2.phaseCorrelate(a, b, win)
            out["phase"] = {"dx": r2(pdx), "dy": r2(pdy), "response": round(float(resp), 3)}
    except cv2.error:
        pass
    return out


def negate(off):
    """ref→shot 방향 추정을 shot−ref 부호로 뒤집는다 (요소 오프셋)."""
    if not off or off.get("dx") is None:
        return off
    o = {**off, "dx": r2(-off["dx"]), "dy": r2(-off["dy"]), "dxInt": -off["dxInt"], "dyInt": -off["dyInt"],
         "dxDp": r2(-off["dxDp"]), "dyDp": r2(-off["dyDp"])}
    if "phase" in o:
        o["phase"] = {**o["phase"], "dx": r2(-o["phase"]["dx"]), "dy": r2(-o["phase"]["dy"])}
    return o


def label(img, text, org, scale=0.45, color=(255, 255, 255), thick=1, bg=None):
    import cv2  # noqa: WPS433
    if bg is not None:
        (tw, th), base = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)
        x, y = org
        cv2.rectangle(img, (x - 2, y - th - 3), (x + tw + 2, y + base), bg, -1)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def hatch(img, mask, color=(90, 90, 90)):
    """마스크 영역(제외 영역)을 사선 무늬로 표시."""
    import numpy as np  # noqa: WPS433
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w]
    sel = (~mask) & (((xx + yy) // 6) % 2 == 0)
    img[sel] = (img[sel] * 0.4 + np.array(color) * 0.6).astype(np.uint8)
    return img


def print_units():
    print(json.dumps({
        "frame": {"w": FRAME_W, "h": FRAME_H}, "pxPerDpX": PX_PER_DP_X, "xCenterPx": X_CENTER_PX, "xCenterDp": X_CENTER_DP,
        "dpPerPxY": DP_PER_PX_Y, "statusBarDp": STATUS_BAR_DP, "defaultMasks": DEFAULT_MASKS, "optionalMasks": OPTIONAL_MASKS,
    }))


# ---------------------------------------------------------------- main
def main():
    if "--print-units" in sys.argv[1:]:
        print_units()
        return
    import numpy as np  # noqa: WPS433

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shot")
    ap.add_argument("ref")
    ap.add_argument("outdir")
    ap.add_argument("--mask-statusbar", dest="mask_status", action="store_true", default=True, help="상태바 0,0,524,46 제외 (기본)")
    ap.add_argument("--no-mask-statusbar", dest="mask_status", action="store_false")
    ap.add_argument("--mask-navbar", dest="mask_nav", action="store_true", default=True, help="내비 바 0,1210,524,70 제외 (기본)")
    ap.add_argument("--no-mask-navbar", dest="mask_nav", action="store_false")
    ap.add_argument("--no-default-mask", action="store_true", help="상태바·내비 바 기본 마스크를 모두 끔")
    ap.add_argument("--mask", action="append", type=parse_box, default=[], metavar="x,y,w,h", help="추가 제외 영역 (여러 번, 이름도 됨)")
    ap.add_argument("--region", type=parse_box, metavar="x,y,w,h", help="이 영역만 비교")
    ap.add_argument("--band", type=int, default=48, help="띠 높이 px (기본 48 = 33dp)")
    ap.add_argument("--thresh", type=int, default=24, help="pctPixelsOver 임계값 (기본 24)")
    ap.add_argument("--search", type=int, default=24, help="오프셋 탐색 범위 ±px (기본 24)")
    ap.add_argument("--worst", type=int, default=6, help="오프셋을 추정할 최악 띠 수 (기본 6)")
    ap.add_argument("--boxes", help="shot.cjs 가 만든 boxes.json (요소별 오프셋 추정)")
    ap.add_argument("--quiet", action="store_true", help="stderr 요약 생략")
    ap.add_argument("--no-images", action="store_true", help="이미지 출력 생략 (지표만)")
    a = ap.parse_args()
    if a.no_default_mask:
        a.mask_status = a.mask_nav = False

    shot = load_rgb(a.shot)
    ref = load_rgb(a.ref)
    H, W = ref.shape[:2]
    notes = []
    if (W, H) != (FRAME_W, FRAME_H):
        notes.append(f"ref 크기 {W}x{H} 가 영상 프레임 {FRAME_W}x{FRAME_H} 가 아님 (dp 환산이 맞지 않을 수 있음)")
    if shot.shape[:2] != (H, W):
        notes.append(f"size mismatch: shot {shot.shape[1]}x{shot.shape[0]} vs ref {W}x{H} (shot 을 ref 크기로 자르거나 검정으로 채움)")
        s2 = np.zeros_like(ref)
        hh, ww = min(H, shot.shape[0]), min(W, shot.shape[1])
        s2[:hh, :ww] = shot[:hh, :ww]
        shot = s2

    mask = np.ones((H, W), bool)  # True = 비교 대상
    defaults = ([parse_box(DEFAULT_MASKS["statusbar"])] if a.mask_status else []) + \
               ([parse_box(DEFAULT_MASKS["navbar"])] if a.mask_nav else [])
    for (x, y, w, h) in defaults + a.mask:
        mask[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = False
    if a.region:
        x, y, w, h = a.region
        r = np.zeros_like(mask)
        r[max(0, y):y + h, max(0, x):x + w] = True
        mask &= r

    s16, r16 = shot.astype(np.int16), ref.astype(np.int16)
    sd = s16 - r16
    ad = np.abs(sd)
    dmean = ad.mean(axis=2)
    dmax = ad.max(axis=2)
    over = dmax > a.thresh
    n = int(mask.sum())

    def stats(m):
        k = int(m.sum())
        if k == 0:
            return None
        return {"meanAbsDiff": round(float(dmean[m].mean()), 3), "pctOver": round(float(over[m].mean() * 100), 3),
                "signedRGB": [round(float(sd[..., c][m].mean()), 2) for c in range(3)]}

    g = stats(mask) or {"meanAbsDiff": 0.0, "pctOver": 0.0, "signedRGB": [0, 0, 0]}
    gs, gr = gray(shot), gray(ref)
    R = a.search

    ys, xs = np.where(mask)  # 전역 오프셋: 마스크 안의 bounding box 영역 전체로
    glob = estimate_offset(gr, gs, int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, R) if len(ys) else None

    bands = []
    for y0 in range(0, H, a.band):
        y1 = min(H, y0 + a.band)
        bm = np.zeros_like(mask)
        bm[y0:y1] = True
        bm &= mask
        st = stats(bm)
        if st is None:
            continue
        cols = np.where(bm.any(axis=0))[0]
        rows = np.where(bm.any(axis=1))[0]
        bands.append({"y0": y0, "y1": y1, "y0Dp": r3(dy_dp(y0)), "y1Dp": r3(dy_dp(y1)),
                      "rows": [int(rows.min()), int(rows.max()) + 1], "cols": [int(cols.min()), int(cols.max()) + 1], **st})

    # 오프셋은 4행 이상 비교하는 띠에서만 (마스크에 걸려 1–2행만 남은 띠는 숫자가 흔들린다)
    order = sorted([b for b in bands if b["rows"][1] - b["rows"][0] >= 4],
                   key=lambda b: (b["pctOver"], b["meanAbsDiff"]), reverse=True)
    worst = []
    for b in order[:a.worst]:
        if b["pctOver"] < 0.05 and b["meanAbsDiff"] < 1.0:
            break
        off = estimate_offset(gr, gs, b["cols"][0], b["rows"][0], b["cols"][1], b["rows"][1], R)
        worst.append({**{k: b[k] for k in ("y0", "y1", "y0Dp", "y1Dp", "meanAbsDiff", "pctOver", "signedRGB")}, "offset": off})

    elements = []  # 요소별 (boxes.json: x/y/w/h frame px, dp D1)
    if a.boxes and os.path.exists(a.boxes):
        with open(a.boxes, encoding="utf-8") as fh:
            bx = json.load(fh)
        items = bx.get("boxes", bx) if isinstance(bx, dict) else bx
        for it in items:
            x, y, w, h = [int(round(it[k])) for k in ("x", "y", "w", "h")]
            if w < 4 or h < 4 or x >= W or y >= H or x + w <= 0 or y + h <= 0:
                continue
            # shot 의 요소를 ref 에서 찾음 -> found = ref 위치 - shot 위치 => offset = -found
            off = negate(estimate_offset(gs, gr, x, y, x + w, y + h, R))
            bmask = np.zeros_like(mask)
            bmask[max(0, y):y + h, max(0, x):x + w] = True
            st = stats(bmask & mask) or {}
            el = {"id": it.get("id"), "box": [x, y, w, h], **st, "offset": off}
            if isinstance(it.get("dp"), dict):
                el["boxDp"] = [it["dp"][k] for k in ("x", "y", "w", "h")]
            elements.append(el)

    result = {
        "shot": os.path.abspath(a.shot), "ref": os.path.abspath(a.ref),
        "size": [W, H], "comparedPixels": n,
        "units": {"pxPerDpX": PX_PER_DP_X, "dpPerPxY": DP_PER_PX_Y, "note": "dxDp = dx/1.45803, dyDp = dy×0.6875"},
        "masks": {"statusbar": a.mask_status, "navbar": a.mask_nav,
                  "extra": [",".join(map(str, m)) for m in a.mask], "region": ",".join(map(str, a.region)) if a.region else None},
        "meanAbsDiff": g["meanAbsDiff"],
        f"pctPixelsOver{a.thresh}": g["pctOver"],
        "meanSignedRGB": g["signedRGB"],
        "globalOffset": glob,
        "bandHeight": a.band,
        "bands": bands,
        "worstBands": worst,
        "elements": elements,
        "notes": notes,
    }
    if a.thresh != 24:
        result["pctPixelsOver24"] = round(float((dmax[mask] > 24).mean() * 100), 3) if n else 0.0

    os.makedirs(a.outdir, exist_ok=True)
    if not a.no_images:
        write_images(a, shot, ref, mask, dmax, bands, elements, result)
    with open(os.path.join(a.outdir, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=1)
    print(json.dumps(result, ensure_ascii=False))
    if not a.quiet:
        summary(result, a)


def write_images(a, shot, ref, mask, dmax, bands, elements, result):
    import cv2  # noqa: WPS433
    import numpy as np  # noqa: WPS433
    H, W = ref.shape[:2]
    sf, rf = shot.astype(np.float32), ref.astype(np.float32)
    od = a.outdir

    save_rgb(os.path.join(od, "overlay.png"), (0.5 * sf + 0.5 * rf).round().astype(np.uint8))
    save_rgb(os.path.join(od, "onion.png"), (0.6 * sf + 0.4 * rf).round().astype(np.uint8))

    amp = np.clip(dmax.astype(np.float32) * 4, 0, 255).astype(np.uint8)  # diff 히트맵
    heat = cv2.cvtColor(cv2.applyColorMap(amp, cv2.COLORMAP_INFERNO), cv2.COLOR_BGR2RGB).astype(np.float32)
    base = cv2.cvtColor(cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB).astype(np.float32) * 0.25
    alpha = np.clip(amp.astype(np.float32) / 64.0, 0, 1)[..., None]
    diff = hatch((base * (1 - alpha) + heat * alpha).round().astype(np.uint8), mask)
    save_rgb(os.path.join(od, "diff.png"), diff)

    def edges(rgb):
        g8 = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (3, 3), 0)
        return cv2.Canny(g8, 18, 54) > 0
    er, es = edges(ref), edges(shot)
    ed = np.zeros((H, W, 3), np.uint8)
    ed[:] = (14, 16, 20)
    ed[er & ~es] = (255, 60, 60)
    ed[es & ~er] = (0, 220, 255)
    ed[er & es] = (255, 255, 255)
    ed = hatch(ed, mask, color=(60, 60, 60))
    save_rgb(os.path.join(od, "edges.png"), ed)

    gap, head, barw = 8, 30, 74  # side-by-side
    panels = [("ref (video)", ref), ("shot (app)", shot), ("edges R=ref C=shot", ed), ("diff x4", diff)]
    side = np.full((H + head, len(panels) * (W + gap) + barw, 3), 32, np.uint8)
    for i, (t, p) in enumerate(panels):
        x = i * (W + gap)
        side[head:, x:x + W] = p
        label(side, t, (x + 6, 20), 0.55)
    bx = len(panels) * (W + gap)
    vmax = max([b["pctOver"] for b in bands] + [1.0])
    for b in bands:
        y0, y1 = b["rows"]
        L = int((barw - 8) * min(1.0, b["pctOver"] / vmax))
        col = (80, 200, 120) if b["pctOver"] < 1 else ((240, 190, 60) if b["pctOver"] < 5 else (240, 70, 70))
        cv2.rectangle(side, (bx + 2, head + y0 + 1), (bx + 2 + max(1, L), head + y1 - 2), col, -1)
        label(side, f"{b['pctOver']:.1f}", (bx + 4, head + y0 + 14), 0.35, (230, 230, 230))
    for wb in result["worstBands"]:
        o = wb["offset"] or {}
        if o.get("dx") is not None and o.get("reliable", True):
            label(side, f"({o['dxInt']},{o['dyInt']})", (bx + 4, head + wb["y0"] + 30), 0.35, (255, 255, 255))
        else:
            label(side, "(?)", (bx + 4, head + wb["y0"] + 30), 0.35, (160, 160, 160))
    label(side, "%>24", (bx + 6, 20), 0.5)
    save_rgb(os.path.join(od, "side.png"), side)

    if elements:
        el = (0.55 * rf + 0.45 * 255).round().astype(np.uint8)
        for e in elements:
            x, y, w, h = e["box"]
            cv2.rectangle(el, (x, y), (x + w - 1, y + h - 1), (0, 170, 220), 1)
            o = e.get("offset") or {}
            if o.get("dx") is None or not o.get("reliable", True):
                label(el, f"{e.get('id')} (?)", (x + 1, max(10, y - 2)), 0.32, (0, 0, 0), bg=(220, 220, 220))
            else:
                rx, ry = int(round(x - o["dx"])), int(round(y - o["dy"]))
                cv2.rectangle(el, (rx, ry), (rx + w - 1, ry + h - 1), (230, 40, 40), 1)
                if abs(o["dx"]) >= 0.75 or abs(o["dy"]) >= 0.75:
                    label(el, f"{e.get('id')} ({o['dxInt']},{o['dyInt']})", (x + 1, max(10, y - 2)), 0.32,
                          (0, 0, 0), bg=(255, 255, 210))
        save_rgb(os.path.join(od, "elements.png"), el)
    result["outputs"] = {k: os.path.join(os.path.abspath(od), k + ".png")
                         for k in ["overlay", "onion", "diff", "edges", "side"] + (["elements"] if elements else [])}


def summary(r, a):
    def off(o):
        if not o:
            return "-"
        if o.get("dx") is None:
            return o.get("note", "-")
        s = (f"({o['dx']:+.1f},{o['dy']:+.1f})px = ({o['dxDp']:+.2f},{o['dyDp']:+.2f})dp"
             f" score {o['score']:.3f} (0,0)→{o['scoreAtZero']:.3f}")
        if "phase" in o:
            s += f" phase({o['phase']['dx']:+.1f},{o['phase']['dy']:+.1f})"
        if o.get("note"):
            s += f" [{o['note']}]"
        return s
    k = f"pctPixelsOver{a.thresh}"
    p = sys.stderr
    print(f"[compare] meanAbsDiff {r['meanAbsDiff']:.2f}  {k} {r[k]:.2f}%  signedRGB {r['meanSignedRGB']}", file=p)
    print(f"          globalOffset {off(r['globalOffset'])}", file=p)
    for b in r["worstBands"]:
        print(f"          band y={b['y0']:4d}-{b['y1']:4d}px (dp {b['y0Dp']:g}-{b['y1Dp']:g}, 앱 {b['y0Dp'] - STATUS_BAR_DP:.1f}-{b['y1Dp'] - STATUS_BAR_DP:.1f})"
              f"  mad {b['meanAbsDiff']:6.2f}  >{a.thresh} {b['pctOver']:6.2f}%  offset {off(b['offset'])}", file=p)
    bad = [e for e in r["elements"] if e.get("offset") and (e["offset"].get("dx") is None or not e["offset"].get("reliable", True)
           or abs(e["offset"]["dx"]) >= 0.75 or abs(e["offset"]["dy"]) >= 0.75)]
    if r["elements"]:
        print(f"          elements {len(r['elements'])}개 중 어긋남/불확실 {len(bad)}개", file=p)
        for e in bad[:20]:
            bd = e.get("boxDp") or [r3(x_dp(e["box"][0])), r3(dy_dp(e["box"][1])), r3(dx_dp(e["box"][2])), r3(dy_dp(e["box"][3]))]
            print(f"            {e['id']}: box {e['box']}px = {bd}dp  offset {off(e['offset'])}", file=p)
    for nt in r["notes"]:
        print(f"          note: {nt}", file=p)
    print(f"          -> {os.path.abspath(a.outdir)}", file=p)


if __name__ == "__main__":
    main()
