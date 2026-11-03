# 새 그림(예전 파일과 같은 캔버스)을 잉크 상자로 잘라 넣고 art.ts 의 x,y,w,h 를 고침 (화면 위치 그대로)
import sys, re
import numpy as np
from PIL import Image
ART = '/home/user/ps/practice/bank-app-clone/src/hana/art.ts'
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
PPD = 3
src = open(ART).read()
for path in sys.argv[1:]:
    name = path.split('/')[-1][:-4]
    im = np.asarray(Image.open(path).convert('RGBA'))
    old = Image.open(L + name + '.png')
    assert old.size == (im.shape[1], im.shape[0]), (name, old.size, im.shape)
    ys, xs = np.nonzero(im[..., 3])
    l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    crop = im[t:b, l:r]
    Image.fromarray(crop, 'RGBA').save(L + name + '.png', optimize=True)
    m = re.search(r'  "%s": \[([^\]]+)\],' % re.escape(name), src)
    v = [float(x) for x in m.group(1).split(',')]
    assert abs(v[4] * PPD - im.shape[1]) < 0.6 and abs(v[5] * PPD - im.shape[0]) < 0.6, (name, v, im.shape)
    nv = v[:2] + [v[2] + l / PPD, v[3] + t / PPD, (r - l) / PPD, (b - t) / PPD]
    fmt = lambda x: ('%.3f' % x).rstrip('0').rstrip('.')
    src = src.replace(m.group(0), '  "%s": [%s],' % (name, ', '.join(fmt(x) for x in nv)))
    print(name, 'trim l t r b', l, t, im.shape[1] - r, im.shape[0] - b, '->', [fmt(x) for x in nv])
open(ART, 'w').write(src)
