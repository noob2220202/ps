# 하나 은행/증권 로고 손질 (누끼 남은 흰 점·들쭉날쭉 원·구멍)
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
L = '/home/user/ps/practice/bank-app-clone/src/assets/local/'
OUT = sys.argv[1]
def load(n): return np.asarray(Image.open(L + f'hana-bank-{n}.png').convert('RGBA')).astype(float)
def save(n, rgb, a):
    o = np.dstack([rgb, a * 255]).round().clip(0, 255).astype(np.uint8); o[o[..., 3] == 0] = 0
    Image.fromarray(o, 'RGBA').save(f'{OUT}/hana-bank-{n}.png', optimize=True)
    ys, xs = np.nonzero(o[..., 3]); print(n, o.shape[1], o.shape[0], 'bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
def disc_cov(h, w, cx, cy, r, ss=8):
    y, x = np.mgrid[0:h * ss, 0:w * ss]
    m = ((x + .5) / ss - cx) ** 2 + ((y + .5) / ss - cy) ** 2 <= r * r
    return m.reshape(h, ss, w, ss).mean((1, 3))
def fit_disc(a):
    s = a.sum(); h, w = a.shape; y, x = np.mgrid[0:h, 0:w]
    return (a * (x + .5)).sum() / s, (a * (y + .5)).sum() / s, np.sqrt(s / np.pi)
def hull(m):
    from scipy.spatial import ConvexHull
    ys, xs = np.nonzero(m); pts = np.stack([xs + .5, ys + .5], 1); hh = ConvexHull(pts)
    im = Image.new('L', (m.shape[1] * 8, m.shape[0] * 8), 0)
    ImageDraw.Draw(im).polygon([tuple(pts[i] * 8) for i in hh.vertices], fill=255)
    return np.asarray(im).reshape(m.shape[0], 8, m.shape[1], 8).mean((1, 3)) / 255
def over(fg, fa, bg):  # fg over 단색 bg
    return fg * fa[..., None] + np.asarray(bg, float) * (1 - fa[..., None])

# 저축은행 SB: 원 안은 모두 불투명, B 와 기둥은 흰색 (다크 녹화 37초)
A = load('savings'); a = A[..., 3] / 255
cx, cy, r = fit_disc(hull(a > 0.5))
cov = disc_cov(*a.shape, cx, cy, r)
rgb = over(A[..., :3], a, (255, 255, 255))
# 흰 획 안 작은 어두운 점/초록 점(가장자리 빼고)은 그대로, 원 밖은 버림
inside = cov > 0
# 원 가장자리 1px 띠는 안쪽 초록으로 (예전 가장자리의 흰 섞임 방지)
edge = (cov < 1) & inside
_, idx = ndi.distance_transform_edt(~((cov >= 1) & (a > 0.95)), return_indices=True)
rgb = np.where(edge[..., None], A[..., :3][idx[0], idx[1]], rgb)
save('savings', rgb, cov)
print(' disc', round(cx, 2), round(cy, 2), round(r, 2))

# DAOL: 검은 원 (해석적 원) + 흰 글자
A = load('daol'); a = A[..., 3] / 255
cx, cy, r = fit_disc(hull(a > 0.5))
cov = disc_cov(*a.shape, cx, cy, r)
inner = (cov >= 1)
body = np.median(A[..., :3][inner & (A[..., :3].max(2) < 60)], 0)
rgb = over(A[..., :3], a, body)
# 원 둘레 2px 띠는 원 색으로 (흰 점 섞인 테 없앰)
ring = disc_cov(*a.shape, cx, cy, r - 2.0) < 1
rgb = np.where(ring[..., None], body, rgb)
save('daol', rgb, cov)
print(' disc', round(cx, 2), round(cy, 2), round(r, 2), body)

# LS증권: 밝은 회색 원 + 글자
A = load('ls'); a = A[..., 3] / 255
cx, cy, r = fit_disc(hull(a > 0.5))
cov = disc_cov(*a.shape, cx, cy, r)
inner = cov >= 1
lum = A[..., :3] @ [0.299, 0.587, 0.114]
body = np.median(A[..., :3][inner & (a > 0.95) & (np.abs(lum - np.median(lum[inner])) < 8)], 0)
rgb = over(A[..., :3], a, body)
ring = disc_cov(*a.shape, cx, cy, r - 2.0) < 1
rgb = np.where(ring[..., None], body, rgb)
save('ls', rgb, cov)
print(' disc', round(cx, 2), round(cy, 2), round(r, 2), body)

# 대신증권: 흰 바탕 섞임을 회색 단색 기준으로 다시 따기 (흰 점 → 투명)
A = load('daishin'); a = A[..., 3] / 255
rgb = A[..., :3]
lum = rgb @ [0.299, 0.587, 0.114]
core = (a > 0.98) & (lum < 140)
_, idx = ndi.distance_transform_edt(~core, return_indices=True)
F = rgb[idx[0], idx[1]]; Lf = F @ [0.299, 0.587, 0.114]
comp = over(rgb, a, (255, 255, 255)); Lc = comp @ [0.299, 0.587, 0.114]
na = np.clip((255 - Lc) / np.maximum(255 - Lf, 1), 0, 1)
na = np.where(core, 1, na)
na = np.where(ndi.binary_dilation(core, iterations=2), na, 0)  # 멀리 떨어진 흰 점 버림
na = np.where(na < 0.08, 0, na)
save('daishin', np.where(core[..., None], rgb, F), na)

# 부국증권: 파란 마름모 바깥의 흰 테 없앰 (바깥 파란 선의 꼭짓점으로 마름모를 만들어 그 밖은 투명)
A = load('bookook'); a = A[..., 3] / 255
rgb = A[..., :3]
blue = (a > 0.5) & (rgb[..., 2] - rgb[..., 0] > 60) & (rgb[..., 2] < 230)
nw = (a > 0.5) & (rgb.min(2) < 200)
ys, xs = np.nonzero(nw)
pts = [(xs.min(), ys[xs == xs.min()].mean() + .5), (xs[ys == ys.min()].mean() + .5, ys.min()), (xs.max() + 1, ys[xs == xs.max()].mean() + .5), (xs[ys == ys.max()].mean() + .5, ys.max() + 1)]
im = Image.new('L', (a.shape[1] * 8, a.shape[0] * 8), 0)
ImageDraw.Draw(im).polygon([(x * 8, y * 8) for x, y in pts], fill=255)
cov = np.asarray(im).reshape(a.shape[0], 8, a.shape[1], 8).mean((1, 3)) / 255
# 테두리 띠(바깥 2px)는 파란 선 색으로
_, idx = ndi.distance_transform_edt(~blue, return_indices=True)
im2 = Image.new('L', (a.shape[1] * 8, a.shape[0] * 8), 0)
c = np.mean(pts, 0)
inner = [(c[0] + (x - c[0]) * 0.9, c[1] + (y - c[1]) * 0.9) for x, y in pts]
ImageDraw.Draw(im2).polygon([(x * 8, y * 8) for x, y in inner], fill=255)
cin = np.asarray(im2).reshape(a.shape[0], 8, a.shape[1], 8).mean((1, 3)) / 255
rgb2 = over(rgb, a, (255, 255, 255))
rgb2 = np.where((cin < 1)[..., None] & ~blue[..., None], rgb[idx[0], idx[1]], rgb2)
save('bookook', rgb2, cov)
print(' pts', [tuple(round(v, 1) for v in p) for p in pts])

# BNP: 초록 네모 안 구멍(별·새 끝) 메움: 네모 안은 모두 불투명, 구멍 색은 이웃 색
A = load('bnp'); a = A[..., 3] / 255
rgb = A[..., :3]
sq = hull(a > 0.5)
solid = a > 0.9
_, idx = ndi.distance_transform_edt(~solid, return_indices=True)
nb = rgb[idx[0], idx[1]]
# 반투명 픽셀은 원래 색과 이웃 색을 알파로 섞음
fill = rgb * a[..., None] + nb * (1 - a[..., None])
inside = sq >= 1
rgb3 = np.where(inside[..., None], fill, np.where((a > 0)[..., None], rgb, nb))
na = np.where(inside, 1.0, np.maximum(a, 0) * (sq > 0))
na = np.where(sq > 0, np.maximum(na, sq * (a > 0.3)), 0)
save('bnp', rgb3, np.where(inside, 1.0, np.minimum(a, sq) if False else a * (sq > 0)))
