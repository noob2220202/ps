# 콕뱅크 완료 화면 '메시지' 타일 3종(다크·라이트): 판은 한 색으로, 카톡·문자 말풍선과 글자/점은 벡터로 다시 그림 (봉투만 그림 그대로)
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
from svgtool import *
OUT = R + 'nhf/'
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
def largest(m):
    lab, k = ndi.label(m)
    if k == 0: return m
    sz = ndi.sum(m, lab, range(1, k + 1)); return lab == (np.argmax(sz) + 1)
jobs, meta = {}, {}
for kind in ['kakao', 'mms', 'card']:
    for th in ['', '-light']:
        name = f'nh-msg-{kind}{th}'
        A = np.asarray(Image.open(R + f'bak/{name}.png').convert('RGBA')).astype(float)
        rgb, a = A[..., :3], A[..., 3]
        h, w = a.shape
        solid = a > 254
        if kind == 'mms':
            bub = (rgb[..., 2] > 170) & (rgb[..., 0] < 175) & (rgb[..., 0] > 70) & (rgb[..., 1] < 160) & (rgb[..., 2] - rgb[..., 1] > 50)
        else:
            bub = (rgb[..., 0] > 190) & (rgb[..., 1] > 160) & (rgb[..., 2] < 130)
        bub = largest(ndi.binary_fill_holes(ndi.binary_closing(bub, disk(1))))
        if kind == 'card':
            bub = ndi.binary_opening(bub, disk(6))  # 아래로 흘러내린 노란 번짐 떼어냄
            bub = largest(bub)
        inner = ndi.binary_erosion(bub, disk(3))
        if kind == 'mms':
            ink = (rgb.min(2) > 215) & inner
        else:
            ink = (rgb.max(2) < 120) & ndi.binary_erosion(bub, disk(2))
        bcol = np.median(rgb[inner & ~ndi.binary_dilation(ink, disk(2))], 0)
        icol = np.median(rgb[ndi.binary_erosion(ink, disk(1)) if ndi.binary_erosion(ink, disk(1)).sum() > 10 else ink], 0)
        # 판 색: 둘레 안쪽 띠
        ring = solid & ~ndi.binary_erosion(solid, disk(12)) & ndi.binary_erosion(solid, disk(3))
        pcol = np.median(rgb[ring], 0)
        content = bub.copy()
        base = rgb.copy()
        if kind == 'card':
            # 봉투(판 색이 아닌 곳) 는 그대로, 번짐(노랑인데 말풍선 밖) 은 둘레 봉투 색으로 메움
            yel = (rgb[..., 0] > 170) & (rgb[..., 1] > 140) & (rgb[..., 2] < 150) & (np.abs(rgb[..., 0] - rgb[..., 1]) < 90)
            drip = ndi.binary_dilation(yel & ~ndi.binary_dilation(bub, disk(1)), disk(1)) & ~ndi.binary_erosion(bub, disk(1))
            env = (np.abs(rgb - pcol).max(2) > 18) & solid & ~yel & ~drip & ~ndi.binary_dilation(bub, disk(1))
            good = env.copy(); bad = drip & ~bub
            for _ in range(30):
                num = np.dstack([ndi.uniform_filter(base[..., c] * good, 3) for c in range(3)]); den = ndi.uniform_filter(good.astype(float), 3)
                f = bad & (den > 0.2)
                if not f.any(): break
                base[f] = num[f] / den[f][:, None]; good |= f; bad &= ~f
            content = env | drip | bub
            print(name, 'drip px', int(drip.sum()))
        # 판 평평하게
        plate_in = solid & ~ndi.binary_dilation(content, disk(2))
        base = np.where(plate_in[..., None], pcol, base)
        if kind != 'card':
            base = np.where(solid[..., None], pcol, base)  # 말풍선은 벡터로 덮으니 판 전체를 한 색
        UP = 8
        bd = path_d(smooth_mask(bub, UP, 1.0), UP)
        if kind == 'mms':
            # 점 셋: 원으로
            lab, k = ndi.label(ink); circ = []
            for i in range(1, k + 1):
                m = lab == i
                if m.sum() < 8: continue
                ys, xs = np.nonzero(m); circ.append((xs.mean() + .5, ys.mean() + .5, np.sqrt(m.sum() / np.pi)))
            r = np.mean([c[2] for c in circ]) + 0.15
            cy = np.mean([c[1] for c in circ])
            inner_svg = ''.join(f'<circle cx="{c[0]:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{hexc(icol)}"/>' for c in sorted(circ))
            meta[name] = dict(dots=[(round(c[0], 2), round(c[1], 2), round(c[2], 2)) for c in circ])
        else:
            inner_svg = f'<path fill="{hexc(icol)}" fill-rule="evenodd" d="{path_d(smooth_mask(ink, UP, 0.55), UP, turd=4)}"/>'
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><path fill="{hexc(bcol)}" d="{bd}"/>{inner_svg}</svg>'
        jobs[name] = dict(svg=svg, w=w, h=h)
        meta.setdefault(name, {}).update(plate=hexc(pcol), bubble=hexc(bcol), ink=hexc(icol))
        np.save(R + f'svgr/{name}.base.npy', np.dstack([base, a]))
out = render(jobs, 'nhmsg')
for name, ov in out.items():
    base = np.load(R + f'svgr/{name}.base.npy')
    res = over(ov, base)
    res[..., 3] = base[..., 3]  # 판 알파 그대로 (말풍선은 판 안)
    save(res, OUT + name + '.png')
    print(name, meta[name])
