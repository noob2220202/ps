import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
import numpy as np
from logo_vec import *
out = {}
def soft_nonwhite(rgb, al):
    m = (255 - rgb.min(2)) / 255.0
    return np.clip(m / max(np.percentile(m[m > 0.3], 60), 1e-3), 0, 1) * al
JOBS = {}
rgb, al = ref_rgb('hana-bank-post.png'); JOBS['post'] = soft_nonwhite(rgb, al)
rgb, al = ref_rgb('hana-bank-shinyoung.png'); JOBS['shinyoung'] = soft_nonwhite(rgb, al)
rgb, al = ref_rgb('hana-bank-shinhyup.png'); JOBS['shinhyup'] = soft_nonwhite(rgb, al)
# BNP: 초록 네모 위 흰 별·새 → 흰 정도
rgb, al = ref_rgb('nh-bank-bnp.png')
green = np.median(rgb[(al > 0.9) & (rgb.min(2) < 140)], 0); v = 255 - green
w = np.clip(((rgb - green) * v).sum(2) / (v * v).sum(), 0, 1) * (al > 0.99)
w = ndi.binary_erosion(al > 0.99, iterations=3) * w
w = np.clip((w - 0.15) / 0.6, 0, 1)
JOBS['bnp'] = w
only = sys.argv[1:] or list(JOBS)
for code in only:
    soft = JOBS[code]
    big = up_mask(soft)
    # 작은 부스러기 버림
    lab, n = ndi.label(big); sz = ndi.sum(big, lab, np.arange(1, n + 1)); big = np.isin(lab, np.nonzero(sz >= 30 * UP * UP / 4)[0] + 1)
    d = path_d(big, UP)
    res = []
    for k in range(len(FIT[code])):
        src = source(code, k)
        p, l, l0 = fit(big, src)
        res.append((p, l, src))
        print(code, k, 'scale', round(p[0], 4), 'rot', round(np.degrees(p[1]), 2), 'loss', round(l, 2), 'init', round(l0, 2), flush=True)
    p, l, src = min(res, key=lambda r: r[1])
    out[code] = dict(d=d, m=svg_matrix(p, src), disc=src['disc'].tolist())
    # 확인용: 맞춘 그림 vs 스크린샷
    m = render(big, p, src['g'].shape, src['x0'], src['y0'])
    viz = np.hstack([src['g'], m, np.abs(src['g'] - m)])
    Image.fromarray((viz * 255).astype(np.uint8)).resize((viz.shape[1] * 8, viz.shape[0] * 8), Image.NEAREST).save(f'logo/fit-{code}.png')
json.dump(out, open('logo/mono-' + '-'.join(only) + '.json', 'w'))
