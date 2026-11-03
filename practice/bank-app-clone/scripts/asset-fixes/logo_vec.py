# 공용 은행 로고(bank-*.png 150px 원) 가운데 그림을 벡터로 다시 그림:
# 고해상 참고 그림(hana-bank-*)의 모양을 potrace 로 따고, 카카오 은행선택 스크린샷의 그림 자리에 맞춰(닮음 변환) 흰색으로 얹음
import sys, json
sys.path.append('/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/sr-venv/lib/python3.13/site-packages')
import numpy as np
from PIL import Image
from scipy import ndimage as ndi, optimize
import potrace
U = '/root/.claude/uploads/5754ac99-d225-5cc3-aaea-ac914ba42ed7/'
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
FIT = json.load(open('/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/common/icons_fit.json'))
UP = 8

def path_d(mask, scale):
    bm = potrace.Bitmap(~mask.astype(bool))
    pl = bm.trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.2)
    f = lambda p: f"{p.x / scale:.3f} {p.y / scale:.3f}"
    out = []
    for c in pl:
        out.append("M" + f(c.start_point))
        for s in c.segments:
            out.append(("L" + f(s.c) + "L" + f(s.end_point)) if s.is_corner else ("C" + f(s.c1) + " " + f(s.c2) + " " + f(s.end_point)))
        out.append("Z")
    return "".join(out)

def ref_rgb(name):
    a = np.asarray(Image.open(L + name).convert('RGBA')).astype(float)
    al = a[..., 3:4] / 255
    return a[..., :3] * al + 255 * (1 - al), a[..., 3] / 255

def up_mask(soft):
    h, w = soft.shape
    big = np.asarray(Image.fromarray(soft.astype(np.float32), 'F').resize((w * UP, h * UP), Image.BICUBIC))
    return big > 0.5

def source(code, k=0):
    e = FIT[code][k]
    a = np.asarray(Image.open(U + e['src']).convert('RGB')).astype(float)
    cx, cy, R = e['fcx'] + .5, e['fcy'] + .5, e['R']
    x0, y0 = int(cx - R), int(cy - R)
    crop = a[y0:y0 + int(2 * R) + 2, x0:x0 + int(2 * R) + 2]
    yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
    rr = np.hypot(xx + .5 + x0 - cx, yy + .5 + y0 - cy) / R
    disc = np.median(crop[(rr > 0.72) & (rr < 0.9)], 0)
    v = 255 - disc
    g = np.clip(((crop - disc) * v).sum(2) / (v * v).sum(), 0, 1)
    g = np.where(rr < 0.75, g, 0)
    return dict(crop=crop, g=g, x0=x0, y0=y0, cx=cx, cy=cy, R=R, disc=disc, rr=rr)

def render(big, p, shape, x0, y0, ss=4):
    """big: 참고 마스크(UP 배), p=(s, th, tx, ty): 참고 px(가장자리 좌표) → 스크린샷 좌표. 스크린샷 격자에 덮임 비율"""
    s, th, tx, ty = p
    h, w = shape
    g = (np.arange(w * ss) + .5) / ss + x0, (np.arange(h * ss) + .5) / ss + y0
    X, Y = np.meshgrid(*g)
    c, si = np.cos(th), np.sin(th)
    dx, dy = X - tx, Y - ty
    u = (c * dx + si * dy) / s; v = (-si * dx + c * dy) / s
    iu = np.floor(u * UP).astype(int); iv = np.floor(v * UP).astype(int)
    ok = (iu >= 0) & (iv >= 0) & (iu < big.shape[1]) & (iv < big.shape[0])
    m = np.zeros(X.shape); m[ok] = big[iv[ok], iu[ok]]
    return m.reshape(h, ss, w, ss).mean((1, 3))

def fit(big, src, th0=0.0):
    g = src['g']; h, w = g.shape
    # 처음 값: 넓이·무게중심
    area_s = g.sum(); area_r = big.sum() / UP / UP
    s0 = np.sqrt(area_s / area_r)
    yy, xx = np.mgrid[0:h, 0:w]
    gx, gy = (g * (xx + .5)).sum() / area_s + src['x0'], (g * (yy + .5)).sum() / area_s + src['y0']
    by, bx = np.nonzero(big); rx, ry = (bx.mean() + .5) / UP, (by.mean() + .5) / UP
    def p_of(q):
        s, th, ox, oy = q
        c, si = np.cos(th), np.sin(th)
        return (s, th, gx + ox - s * (c * rx - si * ry), gy + oy - s * (si * rx + c * ry))
    gb = ndi.gaussian_filter(g, 0.6)
    def loss(q):
        m = render(big, p_of(q), g.shape, src['x0'], src['y0'])
        return ((ndi.gaussian_filter(m, 0.6) - gb) ** 2).sum()
    best = None
    for th in np.radians(np.arange(-12, 13, 4)) + th0:
        r = optimize.minimize(loss, [s0, th, 0, 0], method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-4, maxiter=600))
        if best is None or r.fun < best.fun: best = r
    return p_of(best.x), best.fun, loss([s0, th0, 0, 0])

def svg_matrix(p, src, N=150):
    """참고 px → 150px 출력 좌표 행렬"""
    s, th, tx, ty = p
    k = src['R'] / (N / 2)
    c, si = np.cos(th), np.sin(th)
    a, b, cc, d = s * c / k, s * si / k, -s * si / k, s * c / k
    e = N / 2 + (tx - src['cx']) / k; f = N / 2 + (ty - src['cy']) / k
    return [a, b, cc, d, e, f]
