# 메시지카드 타일: 봉투는 그림 그대로, 노란 번짐·말풍선 테 찌꺼기를 지우고 말풍선(타원)·TALK 는 벡터로
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
from svgtool import *
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
def largest(m):
    lab, k = ndi.label(m); sz = ndi.sum(m, lab, range(1, k + 1)); return lab == (np.argmax(sz) + 1)
jobs, bases = {}, {}
for th in ['', '-light']:
    name = f'nh-msg-card{th}'
    A = np.asarray(Image.open(R + f'bak/{name}.png').convert('RGBA')).astype(float)
    rgb, a = A[..., :3], A[..., 3]; h, w = a.shape
    solid = a > 254
    ring = solid & ~ndi.binary_erosion(solid, disk(12)) & ndi.binary_erosion(solid, disk(3))
    pcol = np.median(rgb[ring], 0)
    yel = (rgb[..., 0] > 190) & (rgb[..., 1] > 160) & (rgb[..., 2] < 130)
    bub = largest(ndi.binary_opening(ndi.binary_fill_holes(yel), disk(6)))
    UP = 8
    big = smooth_mask(bub, UP, 0.8); edge = big & ~ndi.binary_erosion(big)
    ys, xs = np.nonzero(edge); xs = (xs + .5) / UP; ys = (ys + .5) / UP
    keep = np.ones(len(xs), bool)
    for _ in range(4):
        p = fit_ellipse(xs[keep], ys[keep]); keep = ellipse_resid(p, xs, ys) < 0.03
    cx, cy, ea, eb, ang = p
    yy, xx = np.mgrid[0:h, 0:w]
    E = ellipse_resid(p, xx + .5, yy + .5) < 0.04
    sat = rgb.max(2) - rgb.min(2)
    lum = rgb @ [0.299, 0.587, 0.114]
    # 봉투: 판 색과 다르고, 채도 낮은 곳 (말풍선 밖)
    envm = solid & (np.abs(rgb - pcol).max(2) > 18) & (sat < 45) & ~ndi.binary_dilation(E, disk(1))
    envm = largest(ndi.binary_opening(envm, disk(1)))
    from scipy.spatial import ConvexHull
    ey, ex = np.nonzero(envm); hp = np.stack([ex + .5, ey + .5], 1); hh = ConvexHull(hp)
    im = Image.new('L', (w, h), 0); from PIL import ImageDraw; ImageDraw.Draw(im).polygon([tuple(hp[i]) for i in hh.vertices], fill=1)
    envh = np.asarray(im).astype(bool)
    bad = solid & ~E & ((sat >= 45) | ((np.abs(rgb - pcol).max(2) > 18) & ~envh))
    bad = ndi.binary_dilation(bad, disk(1)) & solid & ~E
    base = rgb.copy()
    out_b = bad & ~envh
    base[out_b] = pcol
    good = envm & ~bad; todo = bad & envh
    for _ in range(40):
        num = np.dstack([ndi.uniform_filter(base[..., c] * good, 3) for c in range(3)]); den = ndi.uniform_filter(good.astype(float), 3)
        f = todo & (den > 0.2)
        if not f.any(): break
        base[f] = num[f] / den[f][:, None]; good |= f; todo &= ~f
    base[todo] = pcol
    # 판 평평하게
    base = np.where((solid & ~envh & ~ndi.binary_dilation(E, disk(2)))[..., None], pcol, base)
    ink = (rgb.max(2) < 120) & ndi.binary_erosion(bub, disk(2))
    icol = np.median(rgb[ink], 0); bcol = np.median(rgb[ndi.binary_erosion(bub, disk(3)) & ~ndi.binary_dilation(ink, disk(2))], 0)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
           f'<ellipse fill="{hexc(bcol)}" cx="{cx:.3f}" cy="{cy:.3f}" rx="{ea:.3f}" ry="{eb:.3f}" transform="rotate({ang:.3f} {cx:.3f} {cy:.3f})"/>'
           f'<path fill="{hexc(icol)}" fill-rule="evenodd" d="{path_d(smooth_mask(ink, UP, 0.55), UP, turd=4)}"/></svg>')
    jobs[name] = dict(svg=svg, w=w, h=h); bases[name] = np.dstack([base, a])
    print(name, 'bad px', int(bad.sum()), 'ellipse', [round(float(v), 2) for v in p])
out = render(jobs, 'nhcard')
for name, ov in out.items():
    res = over(ov, bases[name]); res[..., 3] = bases[name][..., 3]
    save(res, R + 'nhf/' + name + '.png')
