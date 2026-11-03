# 판(둥근 네모) 그림: 판은 그대로 두고 안쪽 그림만 (dx, dy) 파일 px 만큼 옮김 + 판 색 평평하게
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out, dx, dy = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
fixdark = len(sys.argv) > 5 and sys.argv[5] == 'fixdark'
A = np.asarray(Image.open(src).convert('RGBA')).astype(float)
h, w = A.shape[:2]
a = A[..., 3] / 255
solid = a > 0.999
inter = ndi.binary_erosion(solid, iterations=5)
ring = solid & ~ndi.binary_erosion(solid, iterations=10)
plate = np.median(A[..., :3][ring & inter | (ring & solid)], 0)
rgb = A[..., :3].copy()
dist = np.abs(rgb - plate).max(2)
content = ndi.binary_dilation((dist > 10) & inter, iterations=2)
if fixdark:
    # 그림자 걷고 남은 검은 점: 둘레(검지 않은 그림 픽셀) 색으로 메움
    Y = rgb @ [0.299, 0.587, 0.114]
    core = (Y < 100) & inter
    bad = (Y < 178) & ndi.binary_dilation(core, iterations=3) & inter
    print('dark px', int(bad.sum()))
    good = content & ~ndi.binary_dilation(bad, iterations=1)
    for _ in range(12):
        num = np.dstack([ndi.uniform_filter(rgb[..., c] * good, 3) for c in range(3)]); den = ndi.uniform_filter(good.astype(float), 3)
        fill = bad & (den > 0)
        rgb[fill] = num[fill] / den[fill][:, None]
        good = good | fill; bad = bad & ~fill
# 판 색 평평하게 (그림 아닌 안쪽)
rgb = np.where((inter & ~content)[..., None], plate, rgb)
# 안쪽만 옮김 (바깥 판 가장자리는 그대로)
im = Image.fromarray(np.dstack([rgb, np.full((h, w), 255.0)]).clip(0, 255).astype(np.uint8), 'RGBA')
sh = np.asarray(im.transform((w, h), Image.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.BICUBIC)).astype(float)[..., :3]
# 옮긴 그림 바깥쪽은 판 색으로
inner2 = ndi.binary_erosion(solid, iterations=int(max(abs(dx), abs(dy))) + 6)
o = np.where(inner2[..., None], sh, rgb)
res = np.dstack([o, A[..., 3]]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(out, optimize=True)
print(out, 'plate', plate.round().tolist(), 'content px', int(content.sum()))
