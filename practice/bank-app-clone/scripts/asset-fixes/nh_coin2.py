# 콕뱅크 '송금' 동전: 테두리 근처 옅은 점선 고리만 원 색으로 지움 (₩ · 배지는 그대로)
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
A = np.asarray(Image.open(R + 'bak/nh-history-coin.png').convert('RGBA')).astype(float)
rgb, a = A[..., :3], A[..., 3] / 255
h, w = a.shape; yy, xx = np.mgrid[0:h, 0:w]
cx, cy, r = 28.76, 28.78, 26.81
bcx, bcy, br = 43.63, 43.68, 12.23
rr = np.hypot(xx + .5 - cx, yy + .5 - cy)
band = (rr > r - 5) & (np.hypot(xx + .5 - bcx, yy + .5 - bcy) > br + 1.5)
Y = rgb @ [0.299, 0.587, 0.114]
ref = (rr > r - 9) & (rr < r - 5) & band.__invert__() == False
disc = np.median(rgb[(rr > r - 10) & (rr < r - 5) & (np.hypot(xx + .5 - bcx, yy + .5 - bcy) > br + 3)], 0)
Yd = disc @ [0.299, 0.587, 0.114]
light = band & (Y > Yd + 6) & (a > 0.3)
print('disc', disc.round(), 'fixed', int(light.sum()))
rgb = np.where(light[..., None], disc, rgb)
# 가장자리 반투명 픽셀 색도 원 색으로 (밝은 테 섞임)
edge = band & (a < 0.95) & (a > 0)
rgb = np.where(edge[..., None], disc * 0.6 + rgb * 0.4, rgb)
Image.fromarray(np.dstack([rgb, A[..., 3]]).round().clip(0, 255).astype(np.uint8), 'RGBA').save(R + 'nhf/nh-history-coin.png', optimize=True)
