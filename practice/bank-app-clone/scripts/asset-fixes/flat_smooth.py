# 단색 몇 가지로 된 그림의 들쭉날쭉한 윤곽을 매끈하게: 4배로 키워 색 묶음(+투명) 지도를 만들고, 묶음마다 흐리게 해 다수결 → 다시 줄임
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.cluster.vq import kmeans2
src, out, K, sig = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
A = np.asarray(Image.open(src).convert('RGBA')).astype(float)
h, w = A.shape[:2]; SS = 4
a = A[..., 3] / 255
# 투명 쪽 색을 가까운 불투명 색으로 채워 두고 키움
_, idx = ndi.distance_transform_edt(a < 0.5, return_indices=True)
rgb = A[..., :3][idx[0], idx[1]]
up = lambda x: np.asarray(Image.fromarray(x.astype(np.float32), 'F').resize((w * SS, h * SS), Image.BICUBIC))
R4 = np.dstack([up(rgb[..., c]) for c in range(3)]); a4 = up(a)
op = a4 >= 0.5
np.random.seed(1)
px = R4[op][::7]
cent, _ = kmeans2(px, K, minit='++', seed=1)
d = ((R4[..., None, :] - cent[None, None]) ** 2).sum(-1)
lab = np.argmin(d, -1) + 1
lab[~op] = 0
# 묶음마다 흐리게 → 다수결
best = np.full(lab.shape, -1.0); new = np.zeros_like(lab)
for k in range(K + 1):
    m = ndi.gaussian_filter((lab == k).astype(float), sig * SS)
    better = m > best
    best = np.where(better, m, best); new = np.where(better, k, new)
chg = new != lab
print('changed px (4x)', int(chg.sum()), 'of', lab.size)
col = R4.copy()
for k in range(1, K + 1):
    m = (lab == k).astype(float)
    num = np.dstack([ndi.gaussian_filter(R4[..., c] * m, 2 * SS) for c in range(3)]); den = ndi.gaussian_filter(m, 2 * SS)
    loc = num / np.maximum(den, 1e-6)[..., None]
    sel = chg & (new == k)
    col[sel] = np.where(den[sel][:, None] > 1e-3, loc[sel], cent[k - 1])
al = (new > 0).astype(float)
pm = (col * al[..., None]).reshape(h, SS, w, SS, 3).mean((1, 3)); aa = al.reshape(h, SS, w, SS).mean((1, 3))
rgb2 = np.where(aa[..., None] > 0, pm / np.maximum(aa, 1e-6)[..., None], 0)
o = np.dstack([rgb2, aa * 255]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(o, 'RGBA').save(out, optimize=True)
ys, xs = np.nonzero(o[..., 3]); print(out, o.shape[1], o.shape[0], 'bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
