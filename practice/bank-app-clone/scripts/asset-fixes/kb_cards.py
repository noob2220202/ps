# 케이뱅크 '히든카드' 그림: 두 카드를 각각 맞춘 기울어진 둥근 네모로 다시 자름 (곧은 변, 1기기px 안팎 경계), 색은 안쪽 색
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
A = np.asarray(Image.open(R + 'bak/kbank-home-cards.png').convert('RGBA')).astype(float)
rgb, a = A[..., :3], A[..., 3] / 255
h, w = a.shape
lum = rgb @ [0.299, 0.587, 0.114]
solid = a > 0.9
blue = solid & (rgb[..., 2] > rgb[..., 0] + 25) & (lum > 70)
blue = ndi.binary_opening(blue, iterations=2)
lab, k = ndi.label(blue); sz = ndi.sum(blue, lab, range(1, k + 1)); blue = lab == np.argmax(sz) + 1
blue = ndi.binary_fill_holes(blue)
black = solid & ~ndi.binary_dilation(blue, iterations=2) & (lum < 120)
lab, k = ndi.label(black); sz = ndi.sum(black, lab, range(1, k + 1)); black = lab == np.argmax(sz) + 1
black = ndi.binary_fill_holes(ndi.binary_closing(black, iterations=2))
def min_rect(m):
    ys, xs = np.nonzero(m); pts = np.stack([xs + .5, ys + .5], 1)
    hp = pts[ConvexHull(pts).vertices]
    best = None
    for ang in np.radians(np.arange(-45, 45, 0.25)):
        c, s = np.cos(ang), np.sin(ang)
        u = hp @ [c, s]; v = hp @ [-s, c]
        area = (u.max() - u.min()) * (v.max() - v.min())
        if best is None or area < best[0]: best = (area, ang, u.min(), u.max(), v.min(), v.max())
    return best[1:]
def rr_mask(rect, grow, rad, ss=8):
    ang, u0, u1, v0, v1 = rect
    u0 -= grow; v0 -= grow; u1 += grow; v1 += grow
    c, s = np.cos(ang), np.sin(ang)
    yy, xx = np.mgrid[0:h * ss, 0:w * ss]
    X = (xx + .5) / ss; Y = (yy + .5) / ss
    u = X * c + Y * s; v = -X * s + Y * c
    # 둥근 네모: 모서리 반지름 rad
    du = np.maximum(np.maximum(u0 + rad - u, u - (u1 - rad)), 0); dv = np.maximum(np.maximum(v0 + rad - v, v - (v1 - rad)), 0)
    inside = (u >= u0) & (u <= u1) & (v >= v0) & (v <= v1) & (du * du + dv * dv <= rad * rad)
    return inside.reshape(h, ss, w, ss).mean((1, 3))
rb = min_rect(blue); rk = min_rect(black)
# 파란 카드 오른쪽 끝은 번진 테까지 잡혀서 넓음 → 카드 비율(85.6:54)로 폭을 정함 (왼끝 기준)
rb = (rb[0], rb[1], rb[1] + (rb[4] - rb[3]) / 1.585, rb[3], rb[4])
print('blue rect deg', round(np.degrees(rb[0]), 2), [round(x, 1) for x in rb[1:]], 'black deg', round(np.degrees(rk[0]), 2), [round(x, 1) for x in rk[1:]])
cb = rr_mask(rb, 0.6, 5.0); ck = rr_mask(rk, 0.6, 5.0)
# 색: 카드마다 안쪽 색을 바깥으로 이어 붙임
def extend(m):
    core = ndi.binary_erosion(m, iterations=4)
    _, idx = ndi.distance_transform_edt(~core, return_indices=True)
    return rgb[idx[0], idx[1]]
cb_rgb = np.where(ndi.binary_erosion(blue, iterations=4)[..., None], rgb, extend(blue))
ck_rgb = np.where(ndi.binary_erosion(black, iterations=4)[..., None], rgb, extend(black))
# 검은 카드 아래, 파란 카드 위
al = cb + ck * (1 - cb)
col = (cb_rgb * cb[..., None] + ck_rgb * (ck * (1 - cb))[..., None]) / np.maximum(al, 1e-6)[..., None]
o = np.dstack([col, al * 255]).round().clip(0, 255).astype(np.uint8); o[o[..., 3] == 0] = 0
Image.fromarray(o, 'RGBA').save(R + 'kbf/kbank-home-cards.png', optimize=True)
ys, xs = np.nonzero(o[..., 3]); print('bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 'of', w, h)
