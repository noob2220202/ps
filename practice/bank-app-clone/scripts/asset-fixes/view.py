# usage: view.py out.png zoom bg1,bg2,... img1 [img2 ...]   (bg: checker|#rrggbb)
import sys
import numpy as np
from PIL import Image
out, z, bgs = sys.argv[1], float(sys.argv[2]), sys.argv[3].split(',')
ims = [Image.open(p).convert('RGBA') for p in sys.argv[4:]]
def bgimg(spec, w, h):
    if spec == 'checker':
        y, x = np.mgrid[0:h, 0:w]
        c = (((x // 8) + (y // 8)) % 2) * 60 + 150
        return Image.fromarray(np.dstack([c, c, c, np.full_like(c, 255)]).astype(np.uint8), 'RGBA')
    s = spec.lstrip('#')
    return Image.new('RGBA', (w, h), tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
cols = []
for im in ims:
    w, h = int(im.width * z), int(im.height * z)
    big = im.resize((w, h), Image.NEAREST if z >= 2 else Image.LANCZOS)
    row = []
    for b in bgs:
        c = bgimg(b, w, h); c.alpha_composite(big); row.append(c)
    cols.append(row)
W = sum(max(r[i].width for r in cols) for i in range(1)) 
pad = 6
tw = max(sum(c.width for c in r) + pad * (len(r) + 1) for r in cols)
th = sum(r[0].height for r in cols) + pad * (len(cols) + 1)
sheet = Image.new('RGBA', (tw, th), (255, 0, 255, 255))
y = pad
for r in cols:
    x = pad
    for c in r:
        sheet.paste(c, (x, y)); x += c.width + pad
    y += r[0].height + pad
sheet.convert('RGB').save(out)
print(out, sheet.size)
