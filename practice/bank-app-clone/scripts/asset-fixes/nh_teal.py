# 별 배지 밖의 청록 점(팔레트 평평화 때 노란 네모 테두리에 잘못 붙은 색) → 노란색 (알파는 그대로)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
A = np.asarray(Image.open(src).convert('RGBA')).astype(float)
rgb, a = A[..., :3], A[..., 3]
teal_c = np.array([0, 145, 160.]); yel = np.median(rgb[(a > 250) & (rgb[..., 0] > 200) & (rgb[..., 2] < 80)], 0); wht = np.array([252, 252, 240.])
d = lambda c: ((rgb - c) ** 2).sum(2)
teal = (d(teal_c) < np.minimum(d(yel), d(wht))) & (a > 0)
lab, n = ndi.label(teal); sz = ndi.sum(teal, lab, np.arange(1, n + 1)); big = lab == (np.argmax(sz) + 1)
badge = ndi.binary_fill_holes(big)
ys, xs = np.nonzero(badge); cx, cy = xs.mean() + .5, ys.mean() + .5; r = np.sqrt(badge.sum() / np.pi)
yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
outside = np.hypot(xx + .5 - cx, yy + .5 - cy) > r + 1.5
bad = teal & outside
print(src.split('/')[-1], 'badge', round(cx, 1), round(cy, 1), round(r, 1), 'recoloured', int(bad.sum()))
rgb = np.where(bad[..., None], yel, rgb)
Image.fromarray(np.dstack([rgb, a]).round().clip(0, 255).astype(np.uint8), 'RGBA').save(out, optimize=True)
