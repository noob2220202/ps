# 콕뱅크 시작화면 '새로운 / 대한민국 농협': 번진 글자를 지우고 Pretendard 로 같은 두 줄 상자에 다시 씀 (ㄴ·ㅇ 로고는 그대로)
import subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/'
PW = '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/common/pw/'
A = np.asarray(Image.open(R + 'bak/nh-nonghyup.png').convert('RGBA')).astype(float)
h, w = A.shape[:2]
a = A[..., 3] / 255
# 글자 칸: 왼쪽 (로고 ㄴ 왼끝보다 왼쪽)
logo = (a > 0.3) & ((A[..., :3].max(2) - A[..., :3].min(2)) > 60)
lx = np.nonzero(logo.any(0))[0].min()
chroma = A[..., :3].max(2) - A[..., :3].min(2)
logo_d = ndi.binary_dilation(logo, iterations=2)
txt0 = (a > 0.25) & (chroma < 50) & ~logo_d
lab, k = ndi.label(ndi.binary_dilation(txt0, iterations=1)); sz = ndi.sum(txt0, lab, range(1, k + 1))
txt = np.isin(lab, np.nonzero(sz > 3)[0] + 1) & txt0
# ㅇ(파란 원) 왼끝보다 왼쪽만 글자
blue = logo & (A[..., 2] > A[..., 0] + 40)
bx = np.nonzero(blue[60:].any(0))[0].min()
txt &= (np.arange(w) < bx - 2)[None, :]
reg = ndi.binary_dilation(txt, iterations=2) & ~logo_d
rows = np.nonzero(txt.any(1))[0]
# 줄 나누기: 빈 줄
runs = []; st = rows[0]
for i in range(1, len(rows)):
    if rows[i] != rows[i - 1] + 1: runs.append((st, rows[i - 1] + 1)); st = rows[i]
runs.append((st, rows[-1] + 1))
lines = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:2])
print('runs', runs)
boxes = []
for (y0, y1) in lines:
    m = txt[y0:y1]; xs = np.nonzero(m.any(0))[0]
    # 50% 잉크 상자
    m2 = (a[y0:y1] > 0.5) & reg[y0:y1]; ys2, xs2 = np.nonzero(m2)
    boxes.append((xs2.min(), y0 + ys2.min(), xs2.max() + 1, y0 + ys2.max() + 1))
print('logo x', lx, 'boxes', boxes)
base = A.copy()
er = np.zeros_like(reg)
for (x0, y0, x1, y1) in boxes: er[max(y0 - 2, 0):y1 + 2, max(x0 - 2, 0):x1 + 2] = True
er &= ~logo_d
base[er] = 0
SS = 4
acc = np.zeros((h * SS, w * SS))
for text, tb in zip(['새로운', '대한민국 농협'], boxes):
    subprocess.run(['node', PW + 'text.cjs', R + 'svgr/_sl.png', text, '600', '0'], check=True, cwd=PW, capture_output=True)
    t = Image.open(R + 'svgr/_sl.png').getchannel('A'); ta = np.asarray(t).astype(float)
    yy, xx = np.nonzero(ta > 127); ib = (xx.min(), yy.min(), xx.max() + 1, yy.max() + 1)
    sx = (tb[2] - tb[0]) / (ib[2] - ib[0]); sy = (tb[3] - tb[1]) / (ib[3] - ib[1])
    big = t.transform((w * SS, h * SS), Image.AFFINE, (1 / (sx * SS), 0, ib[0] - tb[0] / sx, 0, 1 / (sy * SS), ib[1] - tb[1] / sy), resample=Image.BICUBIC)
    acc = np.maximum(acc, np.asarray(big).astype(float) / 255)
    print(text, 'sx/sy', round(sx / sy, 3))
al = acc.reshape(h, SS, w, SS).mean((1, 3)) * er
col = np.array([255, 255, 255.])
oa = base[..., 3] / 255
na = al + oa * (1 - al)
rgb = np.where(na[..., None] > 0, (col * al[..., None] + base[..., :3] * (oa * (1 - al))[..., None]) / np.maximum(na, 1e-6)[..., None], 0)
o = np.dstack([rgb, na * 255]).round().clip(0, 255).astype(np.uint8); o[o[..., 3] == 0] = 0
Image.fromarray(o, 'RGBA').save(R + 'nhf/nh-nonghyup.png', optimize=True)
