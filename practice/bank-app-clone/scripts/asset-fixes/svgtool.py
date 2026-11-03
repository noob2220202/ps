# 공용: 마스크 → potrace path, SVG 렌더(크롬 4배 → BOX 로 줄임), 합성
import sys, json, subprocess
sys.path.append('/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/sr-venv/lib/python3.13/site-packages')
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import potrace
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
def path_d(mask, scale=1.0, ox=0.0, oy=0.0, turd=8, alpha=1.0):
    bm = potrace.Bitmap(~mask.astype(bool))
    pl = bm.trace(turdsize=turd, alphamax=alpha, opticurve=True, opttolerance=0.2)
    f = lambda p: f"{p.x / scale + ox:.3f} {p.y / scale + oy:.3f}"
    out = []
    for c in pl:
        out.append("M" + f(c.start_point))
        for s in c.segments:
            out.append(("L" + f(s.c) + "L" + f(s.end_point)) if s.is_corner else ("C" + f(s.c1) + " " + f(s.c2) + " " + f(s.end_point)))
        out.append("Z")
    return "".join(out)
def smooth_mask(m, up=8, sigma=1.2):
    """마스크를 up 배로 키우며 매끈하게 (가우시안 sigma 는 원래 px 단위)"""
    h, w = m.shape
    f = ndi.gaussian_filter(m.astype(float), sigma)
    big = np.asarray(Image.fromarray(f.astype(np.float32), 'F').resize((w * up, h * up), Image.BICUBIC))
    return big > 0.5
def render(jobs, tag='r'):
    p = R + f'svgr/{tag}.json'
    json.dump(jobs, open(p, 'w'))
    subprocess.run(['node', R + 'svgr/render.cjs', p, R + 'svgr'], check=True, cwd='/home/user/ps/practice/bank-app-clone')
    out = {}
    for k, j in jobs.items():
        im = np.asarray(Image.open(R + f'svgr/{k}.png').convert('RGBA')).astype(float)
        a = im[..., 3:4] / 255
        pm = (im[..., :3] * a).reshape(j['h'], 4, j['w'], 4, 3).mean((1, 3)); al = a[..., 0].reshape(j['h'], 4, j['w'], 4).mean((1, 3))
        rgb = np.where(al[..., None] > 0, pm / np.maximum(al, 1e-6)[..., None], 0)
        out[k] = np.dstack([rgb, al * 255])
    return out
def over(top, bot):
    ta = top[..., 3:4] / 255; ba = bot[..., 3:4] / 255
    a = ta + ba * (1 - ta)
    rgb = np.where(a > 0, (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(a, 1e-6), 0)
    return np.dstack([rgb, a * 255])
def save(arr, path):
    o = arr.round().clip(0, 255).astype(np.uint8); o[o[..., 3] == 0] = 0
    Image.fromarray(o, 'RGBA').save(path, optimize=True)
def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
def fit_ellipse(xs, ys):
    """Fitzgibbon 직접 타원 맞춤 → (cx, cy, a, b, 각도deg)"""
    x = xs[:, None].astype(float); y = ys[:, None].astype(float)
    D = np.hstack([x * x, x * y, y * y, x, y, np.ones_like(x)])
    S = D.T @ D
    C = np.zeros((6, 6)); C[0, 2] = C[2, 0] = 2; C[1, 1] = -1
    import scipy.linalg as sl
    w, v = sl.eig(S, C)
    w = np.real(w); v = np.real(v)
    i = np.argmax(np.where(np.isfinite(w) & (w > 0), w, -np.inf)) if np.any((w > 0) & np.isfinite(w)) else 0
    A, B, Cc, Dd, E, F = v[:, i]
    M = np.array([[A, B / 2], [B / 2, Cc]])
    c = np.linalg.solve(2 * M, [-Dd, -E])
    Fc = F + 0.5 * (Dd * c[0] + E * c[1])
    ev, evec = np.linalg.eigh(M)
    ax = np.sqrt(-Fc / ev)
    ang = np.degrees(np.arctan2(evec[1, 0], evec[0, 0]))
    return c[0], c[1], ax[0], ax[1], ang
def ellipse_resid(p, xs, ys):
    cx, cy, a, b, ang = p
    t = np.radians(ang); dx, dy = xs - cx, ys - cy
    u = dx * np.cos(t) + dy * np.sin(t); v = -dx * np.sin(t) + dy * np.cos(t)
    return np.sqrt((u / a) ** 2 + (v / b) ** 2) - 1
