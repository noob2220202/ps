# 콕뱅크 홈 탭바 아이콘 마스크 5개: 울퉁불퉁한 PNG 윤곽 → 매끈한 벡터(SVG, 같은 79×77 판·같은 자리)
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
from svgtool import *
jobs = {}
for k in range(1, 6):
    a = np.asarray(Image.open(R + f'bak/nh-gh-tab-{k}.png').convert('RGBA')).astype(float)[..., 3] / 255
    h, w = a.shape
    UP = 8
    f = ndi.gaussian_filter(a, 1.1)
    big = np.asarray(Image.fromarray(f.astype(np.float32), 'F').resize((w * UP, h * UP), Image.BICUBIC)) > 0.5
    d = path_d(big, UP, turd=30, alpha=1.15)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="none"><path fill="#fff" fill-rule="evenodd" d="{d}"/></svg>\n'
    open(R + f'nhf/nh-gh-tab-{k}.svg', 'w').write(svg)
    jobs[f'tab{k}'] = dict(svg=svg, w=w, h=h)
out = render(jobs, 'tabs')
for k, v in out.items():
    save(v, R + f'nhf/{k}-check.png')
print('ok')
