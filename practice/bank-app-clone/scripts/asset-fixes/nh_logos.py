# 콕뱅크 은행 고르기 타일 로고(108px 둥근 네모): 번진 로고를 지우고 고해상 참고 그림(hana-bank-*)에서 딴 벡터를 맞춰 얹음
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
from svgtool import *
from logo_vec import ref_rgb, up_mask, render as rrender, UP
from scipy import optimize
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
def tile_info(name):
    A = np.asarray(Image.open(R + f'bak/{name}.png').convert('RGBA')).astype(float)
    rgb, a = A[..., :3], A[..., 3]
    solid = a > 254
    ring = solid & ~ndi.binary_erosion(solid, disk(14)) & ndi.binary_erosion(solid, disk(3))
    tcol = np.median(rgb[ring], 0)
    return A, tcol, solid
def fit_to(big, g, init_scale=None):
    """참고 마스크(big, UP배) → 타일 격자 닮음 변환 (scale, rot, tx, ty) — 넓이·무게중심에서 시작해 흐린 차이 최소"""
    h, w = g.shape
    area_s = g.sum(); area_r = big.sum() / UP / UP
    s0 = np.sqrt(area_s / area_r)
    yy, xx = np.mgrid[0:h, 0:w]
    gx, gy = (g * (xx + .5)).sum() / area_s, (g * (yy + .5)).sum() / area_s
    by, bx = np.nonzero(big); rx, ry = (bx.mean() + .5) / UP, (by.mean() + .5) / UP
    def p_of(q):
        s, th, ox, oy = q; c, si = np.cos(th), np.sin(th)
        return (s, th, gx + ox - s * (c * rx - si * ry), gy + oy - s * (si * rx + c * ry))
    gb = ndi.gaussian_filter(g, 0.8)
    def loss(q):
        return ((ndi.gaussian_filter(rrender(big, p_of(q), g.shape, 0, 0, ss=2), 0.8) - gb) ** 2).sum()
    best = None
    for th in np.radians([-15, -9, -3, 3, 9, 15]):
        r = optimize.minimize(loss, [s0, th, 0, 0], method='Nelder-Mead', options=dict(xatol=1e-3, fatol=1e-3, maxiter=400))
        if best is None or r.fun < best.fun: best = r
    return p_of(best.x)
def mat(p):
    s, th, tx, ty = p; c, si = np.cos(th), np.sin(th)
    return f'matrix({s * c:.5f} {s * si:.5f} {-s * si:.5f} {s * c:.5f} {tx:.4f} {ty:.4f})'
def erase(A, tcol, solid, glyph, grow=2):
    base = A.copy()
    m = ndi.binary_dilation(glyph, disk(grow)) & solid
    base[m, :3] = tcol
    # 판 전체 한 색 (그림 밖)
    base[solid, :3] = tcol
    return base
jobs, bases = {}, {}
def job(name, ref, layers, fit_mask_fn, glyph_thr=40, layer_cols=None, fill=False):
    """layers: [(색 또는 'sample', 참고 마스크)] 아래→위 순. fit_mask_fn(ref_rgb, ref_alpha) → 맞출 실루엣"""
    A, tcol, solid = tile_info(name)
    rgb = A[..., :3]
    dev = np.abs(rgb - tcol).max(2)
    g = np.clip((dev - 10) / (glyph_thr * 2), 0, 1) * ndi.binary_erosion(solid, disk(4))
    if fill:  # 카드 안쪽이 판과 같은 색이면 흰 테두리 안을 채워 실루엣으로
        g = np.maximum(g, ndi.binary_fill_holes(ndi.binary_closing(g > 0.25, disk(2))).astype(float))
    rr, ra = ref_rgb(ref)
    sil = fit_mask_fn(rr, ra)
    big = up_mask(ndi.gaussian_filter(sil.astype(float), 0.6))
    p = fit_to(big, g)
    body = ''
    for col, m in layers(rr, ra):
        bm = up_mask(ndi.gaussian_filter(m.astype(float), 0.6))
        if col == 'tile':
            col = hexc(tcol)
        elif col == 'sample':
            cov = rrender(bm, p, g.shape, 0, 0, ss=2)
            wgt = np.clip((cov - 0.8) / 0.2, 0, 1)
            col = hexc((rgb * wgt[..., None]).sum((0, 1)) / max(wgt.sum(), 1e-6))
        body += f'<path fill="{col}" fill-rule="evenodd" d="{path_d(bm, UP, turd=20)}"/>'
    h, w = g.shape
    jobs[name] = dict(svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><g transform="{mat(p)}">{body}</g></svg>', w=w, h=h)
    bases[name] = erase(A, tcol, solid, g > 0.05)
    print(name, 'tile', hexc(tcol), 'scale', round(p[0], 3), 'rot', round(np.degrees(p[1]), 2), flush=True)

# KB: 노란 ✱b
kb_mask = lambda rr, ra: (ra > 0.5) & (rr[..., 2] < 150) & (rr[..., 0] > 180)
for n in ['nh-bank-kb', 'nh-bank-kbsec']:
    job(n, 'hana-bank-kb.png', lambda rr, ra: [('#fbb417', kb_mask(rr, ra))], kb_mask)
# 우체국: 빨간 나비넥타이 + 주황 갈매기
def post_layers(rr, ra):
    red = (ra > 0.5) & (rr[..., 0] > 170) & (rr[..., 1] < 110)
    org = (ra > 0.5) & (rr[..., 0] > 200) & (rr[..., 1] >= 110) & (rr[..., 2] < 140)
    return [('#e8392b', red), ('#f4a83a', org)]
job('nh-bank-post', 'hana-bank-post.png', post_layers, lambda rr, ra: (ra > 0.5) & (rr.min(2) < 200))
# IBK: 흰 테 카드 + 왼쪽 하늘 · 오른쪽 짙은 파랑 · 흰 I < · 빨간 세모 (logo_ibk.py 와 같은 층)
def ibk_parts(rr, ra):
    nonw = np.clip((255 - rr.min(2)) / 120, 0, 1) * ra
    sil = ndi.binary_fill_holes(nonw > 0.5)
    R_, G_, B_ = rr[..., 0], rr[..., 1], rr[..., 2]
    red = (R_ > 150) & (G_ < 120) & (B_ < 120)
    white_in = sil & (rr.min(2) > 200)
    light = sil & ~white_in & ~red & (G_ > 120)
    dark = sil & ~white_in & ~red & ~light
    full = ndi.binary_fill_holes(sil | white_in)
    inset = ndi.binary_erosion(full, disk(2))
    return full, inset, light & inset, dark & inset, white_in & inset, red & inset
def ibk_layers(rr, ra):
    full, inset, light, dark, white, red = ibk_parts(rr, ra)
    return [('#ffffff', full), ('#1f4d96', dark | light | white | red), ('tile', light), ('#ffffff', white), ('#ee4b2b', red)]
for n in ['nh-bank-ibk', 'nh-bank-ibksec', 'nh-sendwho-ibk']:
    job(n, 'hana-bank-ibk.png', ibk_layers, lambda rr, ra: ibk_parts(rr, ra)[0], fill=True)
# CAPE: 흰 C·P·E + 빨간 A (참고 그림의 점선 고리는 뺌)
def cape_parts(rr, ra):
    h, w = ra.shape; yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx + .5 - w / 2, yy + .5 - h / 2) / (min(h, w) / 2)
    inner = r < 0.72
    blue = (ra > 0.5) & (rr[..., 2] > 150) & (rr[..., 0] < 120) & inner
    red = (ra > 0.5) & (rr[..., 0] > 150) & (rr[..., 1] < 110) & inner
    return blue, red
job('nh-bank-cape', 'hana-bank-cape.png', lambda rr, ra: [('#ffffff', cape_parts(rr, ra)[0]), ('#e5413d', cape_parts(rr, ra)[1])], lambda rr, ra: cape_parts(rr, ra)[0] | cape_parts(rr, ra)[1])
out = render(jobs, 'nhlogos')
for name, ov in out.items():
    res = over(ov, bases[name]); res[..., 3] = bases[name][..., 3]
    save(res, R + 'nhf/' + name + '.png')
