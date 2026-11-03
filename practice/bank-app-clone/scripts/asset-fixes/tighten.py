# 부드럽게 번진 누끼 가장자리를 1기기px 안팎으로 조이고(알파 경사 k배), 가장자리 색은 안쪽 색으로, 작은 섬은 지움, 안쪽은 살짝 선명하게
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
src, out, k = sys.argv[1], sys.argv[2], float(sys.argv[3])
sharp = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
sig = float(sys.argv[5]) if len(sys.argv) > 5 else 0.7
A = np.asarray(Image.open(src).convert('RGBA')).astype(float)
rgb, a = A[..., :3], A[..., 3] / 255
a_s = ndi.gaussian_filter(a, sig)
na = np.clip((a_s - 0.5) * k + 0.5, 0, 1)
lab, n = ndi.label(na > 0.02)
if n:
    sz = ndi.sum(na > 0.02, lab, range(1, n + 1)); keep = np.isin(lab, np.nonzero(sz >= 20)[0] + 1)
    na = np.where(keep, na, 0)
solid = a > 0.95
_, idx = ndi.distance_transform_edt(~solid, return_indices=True)
inner = rgb[idx[0], idx[1]]
w = np.clip((0.95 - a) / 0.35, 0, 1)[..., None]  # 반투명일수록 안쪽 색 쪽으로
col = rgb * (1 - w) + inner * w
if sharp:
    im = Image.fromarray(col.clip(0, 255).astype(np.uint8))
    sh = np.asarray(im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=int(sharp), threshold=1))).astype(float)
    m = ndi.binary_erosion(solid, iterations=2)[..., None]
    col = np.where(m, sh, col)
o = np.dstack([col, na * 255]).round().clip(0, 255).astype(np.uint8); o[o[..., 3] == 0] = 0
Image.fromarray(o, 'RGBA').save(out, optimize=True)
ys, xs = np.nonzero(o[..., 3]); print(out.split('/')[-1], 'bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 'of', o.shape[1], o.shape[0])
