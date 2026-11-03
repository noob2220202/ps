# 다듬은 그림을 잉크 상자로 잘라 넣고, CSS 상자(left/top/width/height)를 같은 화면 자리가 되게 고침
import re
import numpy as np
from PIL import Image
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
K = '/home/user/ps/practice/bank-app-clone/src/kbank/'
JOBS = [
    ('kbank-home-suitcase', 'kbank-home.css', '.kbh-rec__art--pick {'),
    ('kbank-home-cards', 'kbank-home.css', '.kbh-rec__art--rank {'),
    ('kbank-send-clover', 'kbank-done.css', '.kbd-emoji .kbd-emoji--clover {'),
    ('kbank-send-bag', 'kbank-done.css', '.kbd-emoji .kbd-emoji--bag {'),
    ('kbank-send-ai', 'kbank-send.css', '.kbs-ai img {'),
    ('kbank-home-lock', 'kbank-home.css', '.kbh-lock__open {'),
    ('kbank-home-lock-gray', 'kbank-home.css', '.kbh-lock__gray {'),
    ('kbank-home-lock-blue', 'kbank-home.css', '.kbh-lock__blue {'),
    ('kbank-home-adcloud', 'kbank-adsheet.css', '.kbad-art {'),
]
fmt = lambda x: ('%.3f' % x).rstrip('0').rstrip('.')
for name, css, sel in JOBS:
    im = np.asarray(Image.open(R + f'kbf/{name}.png').convert('RGBA'))
    H, W = im.shape[:2]
    ys, xs = np.nonzero(im[..., 3])
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    s = open(K + css).read()
    i = s.index(sel); j = s.index('}', i)
    blk = s[i:j]
    def get(prop):
        m = re.search(r'\n  %s: ([^;]+);' % prop, blk); return m
    ml, mt, mw, mh = get('left'), get('top'), get('width'), get('height')
    lv = ml.group(1); tv = float(mt.group(1)[:-2]); wv = float(mw.group(1)[:-2]); hv = float(mh.group(1)[:-2])
    sx, sy = wv / W, hv / H
    nt, nw, nh = tv + y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy
    mc = re.match(r'calc\(50% - ([\d.]+)px\)', lv)
    if mc:
        nl = f'calc(50% - {fmt(float(mc.group(1)) - x0 * sx)}px)'
    else:
        nl = fmt(float(lv[:-2]) + x0 * sx) + 'px'
    nb = blk.replace(ml.group(0), f'\n  left: {nl};').replace(mt.group(0), f'\n  top: {fmt(nt)}px;').replace(mw.group(0), f'\n  width: {fmt(nw)}px;').replace(mh.group(0), f'\n  height: {fmt(nh)}px;')
    s = s[:i] + nb + s[j:]
    open(K + css, 'w').write(s)
    Image.fromarray(im[y0:y1, x0:x1], 'RGBA').save(L + name + '.png', optimize=True)
    print(name, (W, H), '->', (x1 - x0, y1 - y0), 'css', nl, fmt(nt), fmt(nw), fmt(nh))
