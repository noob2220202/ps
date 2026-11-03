# 지금 그림의 알파 윤곽만 매끈하게 (4배로 키워 문턱 → 열고 닫기 → 1px 부드러운 가장자리), 가장자리 색은 가까운 진한 픽셀 색
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out, r = sys.argv[1], sys.argv[2], int(sys.argv[3])
mind = int(sys.argv[4]) if len(sys.argv) > 4 else 400
A = np.asarray(Image.open(src).convert('RGBA')).astype(float)
h, w = A.shape[:2]; SS = 4
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
a = A[..., 3] / 255
a4 = np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w * SS, h * SS), Image.BICUBIC))
m = a4 > 0.5
p = r + 2
m = np.pad(m, p)
m = ndi.binary_closing(m, disk(r)); m = ndi.binary_opening(m, disk(r))
m = m[p:-p, p:-p]
lab, n = ndi.label(m)
if n:
    sz = ndi.sum(m, lab, np.arange(1, n + 1)); m = np.isin(lab, np.nonzero(sz >= mind)[0] + 1)
al = ndi.gaussian_filter(m.astype(float), SS * 0.42).reshape(h, SS, w, SS).mean((1, 3))
rgb = A[..., :3]
_, idx = ndi.distance_transform_edt(a < 0.7, return_indices=True)
rgb = np.where((a < 0.7)[..., None], rgb[idx[0], idx[1]], rgb)
# 검은 반투명 그림자(알파 0.5 아래, 어두운 색)는 그대로 밑에 깔아 둠
Yh = A[..., :3] @ [0.299, 0.587, 0.114]
sh = np.where((a < 0.5) & (Yh < 80), a, 0)
tot = al + sh * (1 - al)
rgb = np.where((tot > 0)[..., None], (rgb * al[..., None] + A[..., :3] * (sh * (1 - al))[..., None]) / np.maximum(tot, 1e-6)[..., None], 0)
al = tot
o = np.dstack([rgb, al * 255]).round().clip(0, 255).astype(np.uint8)
o[o[..., 3] == 0] = 0
Image.fromarray(o, 'RGBA').save(out, optimize=True)
ys, xs = np.nonzero(o[..., 3]); print(out, 'bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 'of', w, h)
