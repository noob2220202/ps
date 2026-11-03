# 삼성증권 타일: 번진 글자를 지우고 Pretendard 굵은 글자로 같은 상자에 다시 씀
import subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
PW = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/common/pw/'
A = np.asarray(Image.open(R + 'bak/nh-bank-samsung.png').convert('RGBA')).astype(float)
rgb, a = A[..., :3], A[..., 3]; N = a.shape[0]
solid = a > 254
ring = solid & ~ndi.binary_erosion(solid, iterations=14) & ndi.binary_erosion(solid, iterations=3)
tcol = np.median(rgb[ring], 0)
dev = np.abs(rgb - tcol).max(2)
txt = (rgb.min(2) > 150) & ndi.binary_erosion(solid, iterations=6)
lab, k = ndi.label(ndi.binary_dilation(txt, iterations=2)); sz = ndi.sum(txt, lab, range(1, k + 1))
keep = np.isin(lab, np.nonzero(sz > 6)[0] + 1) & txt
ys, xs = np.nonzero((rgb.min(2) > 200) & keep)
tb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
print('text box', tb, 'tile', tcol.round())
base = A.copy(); base[solid, :3] = tcol
subprocess.run(['node', PW + 'text.cjs', R + 'svgr/_ss.png', '삼성증권', '700', '-0.02'], check=True, cwd=PW)
t = Image.open(R + 'svgr/_ss.png').getchannel('A'); ta = np.asarray(t).astype(float)
yy, xx = np.nonzero(ta > 127); ib = (xx.min(), yy.min(), xx.max() + 1, yy.max() + 1)
SS = 4
sx = (tb[2] - tb[0]) / (ib[2] - ib[0]); sy = (tb[3] - tb[1]) / (ib[3] - ib[1])
big = t.transform((N * SS, N * SS), Image.AFFINE, (1 / (sx * SS), 0, ib[0] - tb[0] / sx, 0, 1 / (sy * SS), ib[1] - tb[1] / sy), resample=Image.BICUBIC)
al = np.asarray(big.resize((N, N), Image.BOX)).astype(float) / 255
out = base.copy(); out[..., :3] = base[..., :3] * (1 - al[..., None]) + 255 * al[..., None]
Image.fromarray(np.clip(out + .5, 0, 255).astype(np.uint8), 'RGBA').save(R + 'nhf/nh-bank-samsung.png', optimize=True)
print('sx/sy', round(sx / sy, 3))
