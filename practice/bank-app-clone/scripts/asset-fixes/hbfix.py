# 하나 배너 5: 윤곽을 매끈하게 다시 따고 가장자리 색을 안쪽 색으로 (흰 테 없앰)
import sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
N = int(sys.argv[1]); OUT = sys.argv[2]; T = float(sys.argv[3]) if len(sys.argv) > 3 else 14.0
SRC = f'/home/user/ps/practice/bank-app-clone/src/assets/local/hana-banner-{N}.png'
SHOT = {5: 'edfc2c4f', 4: '6e404abd', 9: '14d34e1b'}[N]
TOP = {5: 571, 4: 571, 9: 388}[N] + 10
GEO = {5: (20.667, 26.667), 4: (16.333, 30), 9: (25.333, 26)}[N]
A = np.asarray(Image.open(SRC).convert('RGBA')).astype(float)
h, w = A.shape[:2]; SS = 4
src = Image.open(f'/root/.claude/uploads/5754ac99-d225-5cc3-aaea-ac914ba42ed7/{SHOT}-image.jpg').convert('RGB')
k = 1.875 / 3 / SS
S4 = np.asarray(src.transform((w * SS, h * SS), Image.AFFINE, (k, 0, 410 + GEO[0] * 1.875, 0, k, TOP + GEO[1] * 1.875), Image.BICUBIC)).astype(float)
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
ink = 255 - S4.min(2)
inkb = ndi.gaussian_filter(ink, SS * 0.8)
m = inkb > T
# 바깥(가장자리에서 이어진 곳)만 바탕 → 갇힌 흰 곳은 물체로
lab, n = ndi.label(~m)
edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
outside = np.isin(lab, edge_ids[edge_ids > 0])
m = ~outside
# 상자 아래 연한 그림자(흰 바탕 위 회색)는 물체가 아님: 아래 띠에서 밝은 곳은 뺌
Ys = S4 @ [0.299, 0.587, 0.114]
yy = np.arange(m.shape[0])[:, None] / SS
m &= ~((yy > 265) & (Ys > 200))
# 작은 섬 버림
lab, n = ndi.label(m)
sz = ndi.sum(m, lab, np.arange(1, n + 1))
m = np.isin(lab, np.nonzero(sz >= 400 * SS * SS / 16)[0] + 1)
# 열고 닫아 매끈하게 (반지름 1.5 출력 px)
r = 6
m = ndi.binary_closing(np.pad(m, r + 2), disk(r))[r + 2:-r - 2, r + 2:-r - 2]
m = ndi.binary_opening(m, disk(r))
# 1 출력 px 정도의 부드러운 가장자리
af = ndi.gaussian_filter(m.astype(float), SS * 0.42)
al = af.reshape(h, SS, w, SS).mean((1, 3))
# 색: 지금 그림의 안쪽 색. 가장자리 2px 띠에서 안쪽보다 밝은 픽셀(흰 바탕 섞임)은 안쪽 색으로
a0 = A[..., 3] / 255
rgb = A[..., :3].copy()
src1 = S4.reshape(h, SS, w, SS, 3).mean((1, 3))
rgb = np.where((a0 < 0.9)[..., None], src1, rgb)  # 예전 알파가 낮던 곳(윤곽 메운 곳)은 원본 색
solid = al > 0.999
core = ndi.binary_erosion(solid, disk(3))
_, idx = ndi.distance_transform_edt(~core, return_indices=True)
inner = rgb[idx[0], idx[1]]
Y = rgb @ [0.299, 0.587, 0.114]; Yi = inner @ [0.299, 0.587, 0.114]
band = ~core
rgb = np.where((band & (Y > Yi) & (al >= 0.5))[..., None], inner, rgb)
# 반투명 바깥 테는 가장 가까운 진한(알파 0.5 넘는) 픽셀 색 → 외곽선 색이 그대로 이어짐
_, idx2 = ndi.distance_transform_edt(al < 0.5, return_indices=True)
rgb = np.where((al < 0.5)[..., None], rgb[idx2[0], idx2[1]], rgb)
out = np.dstack([rgb, al * 255]).round().clip(0, 255).astype(np.uint8)
out[al * 255 < 0.5] = 0
ys, xs = np.nonzero(out[..., 3])
out = out[:ys.max() + 1]
Image.fromarray(out, 'RGBA').save(OUT, optimize=True)
ys, xs = np.nonzero(out[..., 3])
print('bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 'of', w, h)
