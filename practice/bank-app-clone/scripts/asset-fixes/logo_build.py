# 맞춘 벡터 그림 → SVG → (크롬으로) 150px PNG → 깨끗한 원 위에 얹어 bank-*.png
import json, subprocess, sys
import numpy as np
from PIL import Image
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
mono = {}
for f in sys.argv[1:]:
    mono.update(json.load(open(f)))
ibk = json.load(open(R + 'logo/ibk.json'))
def mat(m): return 'matrix(' + ' '.join(f'{v:.5f}' for v in m) + ')'
jobs, svgs = {}, {}
for code, e in mono.items():
    if code in ibk: continue
    svgs[code] = f'<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><path transform="{mat(e["m"])}" fill="#fff" fill-rule="evenodd" d="{e["d"]}"/></svg>'
for code, e in ibk.items():
    body = ''.join(f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>' for c, d in e['layers'])
    svgs[code] = f'<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><g transform="{mat(e["m"])}">{body}</g></svg>'
json.dump(svgs, open(R + 'logo/svgs.json', 'w'))
for k, v in svgs.items(): open(R + f'logo/{k}.svg', 'w').write(v)
subprocess.run(['node', R + 'logo/render.cjs', R + 'logo/svgs.json', R + 'logo'], check=True, cwd='/home/user/ps/practice/bank-app-clone')
N = 150
yy, xx = np.mgrid[0:N, 0:N]
rr = np.hypot(xx + .5 - 75, yy + .5 - 75) / 75
for code in svgs:
    cur = np.asarray(Image.open(R + f'bak/bank-{code}.png').convert('RGBA')).astype(float)
    rgb, a = cur[..., :3], cur[..., 3]
    ring = (rr > 0.66) & (rr < 0.84)
    X = np.c_[xx[ring] / N, yy[ring] / N, np.ones(ring.sum())]; Y = rgb[ring]
    keep = np.ones(len(Y), bool)
    for _ in range(4):
        coef = np.linalg.lstsq(X[keep], Y[keep], rcond=None)[0]
        dev = np.abs(X @ coef - Y).max(1); keep = dev < max(6.0, np.percentile(dev, 60) * 2.5)
    model = np.dstack([xx / N, yy / N, np.ones((N, N))]) @ coef
    w = np.clip((rr - 0.86) / 0.04, 0, 1)[..., None]
    base = model * (1 - w) + rgb * w
    g = np.asarray(Image.open(R + f'logo/{code}.png').convert('RGBA')).astype(float)
    ga = g[..., 3:4] / 255
    out = g[..., :3] * ga + base * (1 - ga)
    o = np.dstack([out, a]).round().clip(0, 255).astype(np.uint8)
    o[a == 0] = 0
    Image.fromarray(o, 'RGBA').save(R + f'logo/bank-{code}.png', optimize=True)
    print(code, 'disc', model[75, 75].round().tolist())
