import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
import numpy as np
from logo_vec import *
rgb, al = ref_rgb('hana-bank-ibk.png')
nonw = np.clip((255 - rgb.min(2)) / 120, 0, 1) * al
sil = ndi.binary_fill_holes(nonw > 0.5)
R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
red = (R_ > 150) & (G_ < 120) & (B_ < 120)
white_in = sil & (rgb.min(2) > 200)
light = sil & ~white_in & ~red & (G_ > 120)
dark = sil & ~white_in & ~red & ~light
lay = dict(sil=sil, light=light, dark=dark, white=white_in, red=red)
for k, v in lay.items(): print(k, int(v.sum()))
soft_sil = ndi.gaussian_filter(sil.astype(float), 0.7)
big = up_mask(soft_sil)
out = {}
for code in ['ibk', 'ibksec']:
    src = source(code)
    # 목표: 원 색과 다른 정도 (카드 전체)
    crop, disc = src['crop'], src['disc']
    g = np.clip(np.abs(crop - disc).max(2) / 90, 0, 1) * (src['rr'] < 0.75)
    src['g'] = g
    p, l, l0 = fit(big, src, th0=0)
    print(code, 'scale', round(p[0], 4), 'rot', round(np.degrees(p[1]), 2), 'loss', round(l, 2), round(l0, 2))
    cols = {}
    for k in ['light', 'dark', 'white', 'red']:
        bm = up_mask(ndi.gaussian_filter(lay[k].astype(float), 0.5))
        cov = render(bm, p, g.shape, src['x0'], src['y0'])
        w = np.clip((cov - 0.7) / 0.3, 0, 1)
        cols[k] = ((crop * w[..., None]).sum((0, 1)) / max(w.sum(), 1e-6)).round().tolist()
        print(' ', k, cols[k], round(w.sum(), 1))
    # 테두리: 실루엣 바깥 0.5~1.5 스크린샷 px 띠의 색
    cov = render(big, p, g.shape, src['x0'], src['y0'])
    edge = (cov > 0.2) & (cov < 0.8)
    print('  edge', crop[edge].mean(0).round().tolist(), 'disc', disc.round().tolist())
    paths = {k: path_d(up_mask(ndi.gaussian_filter(lay[k].astype(float), 0.5)), UP) for k in lay}
    out[code] = dict(paths=paths, m=svg_matrix(p, src), cols=cols, disc=disc.tolist(), scale=p[0], R=src['R'])
    m = cov
    viz = np.hstack([g, m, np.abs(g - m)])
    Image.fromarray((viz * 255).astype(np.uint8)).resize((viz.shape[1] * 8, viz.shape[0] * 8), Image.NEAREST).save(f'logo/fit-{code}.png')
json.dump(out, open('logo/ibk.json', 'w'))

# 카카오 은행선택 모양: 흰 테두리 카드 · 왼쪽 하늘색 · 오른쪽 짙은 파랑 · 흰 I · 빨간 세모 · 흰 <
def big_of(m, s=0.5): return up_mask(ndi.gaussian_filter(m.astype(float), s))
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
A = big_of(ndi.binary_fill_holes(sil | white_in), 0.7)
A = ndi.binary_fill_holes(A)
B = ndi.binary_erosion(A, disk(22))  # 흰 테두리 약 2.4px (150px 원 기준)
C = big_of(light) & B
D = big_of(white_in) & B
E = big_of(red) & B
layers = [('#ffffff', A), ('#0a4fa6', B), ('#2aa2e6', C), ('#ffffff', D), ('#ee4b2b', E)]
svg_layers = [(c, path_d(m, UP)) for c, m in layers]
for code in out:
    out[code]['layers'] = svg_layers
json.dump(out, open('logo/ibk.json', 'w'))
