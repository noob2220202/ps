# 말풍선 = 맞춘 타원 + 꼬리(타원 밖 덩어리, 매끈하게)
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user-ps/5754ac99-d225-5cc3-aaea-ac914ba42ed7/scratchpad/assetqa/repair/py')
from svgtool import *
src = open(R + 'py/nh_msg.py').read()
# nh_msg.py 의 bd(말풍선 path) 만들기를 타원+꼬리로 바꿈
src = src.replace("        bd = path_d(smooth_mask(bub, UP, 1.0), UP)\n", """        big = smooth_mask(bub, UP, 0.8)
        edge = big & ~ndi.binary_erosion(big)
        ys, xs = np.nonzero(edge); xs = (xs + .5) / UP; ys = (ys + .5) / UP
        keep = np.ones(len(xs), bool)
        for _ in range(4):
            p = fit_ellipse(xs[keep], ys[keep]); res = ellipse_resid(p, xs, ys)
            keep = res < 0.03
        cx, cy, ea, eb, ang = p
        # 꼬리: 타원 밖으로 나온 부분 (큰 덩어리 하나)
        yy, xx = np.mgrid[0:big.shape[0], 0:big.shape[1]]
        inside = ellipse_resid(p, (xx + .5) / UP, (yy + .5) / UP) < 0.0
        tail = largest(big & ~inside)
        tail_big = ndi.binary_dilation(tail, disk(UP)) & big | tail
        tail_big = smooth_mask(tail_big[::2, ::2], 2, 1.5 * UP / 2)  # 꼬리 윤곽만 더 매끈하게
        td = path_d(tail_big, UP, turd=40)
        bd = None
        meta.setdefault(name, {})['ellipse'] = [round(float(v), 2) for v in p]
""")
src = src.replace("""        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><path fill="{hexc(bcol)}" d="{bd}"/>{inner_svg}</svg>'""",
"""        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><g fill="{hexc(bcol)}">'
               f'<ellipse cx="{cx:.3f}" cy="{cy:.3f}" rx="{ea:.3f}" ry="{eb:.3f}" transform="rotate({ang:.3f} {cx:.3f} {cy:.3f})"/><path d="{td}"/></g>{inner_svg}</svg>')""")
exec(compile(src, 'nh_msg', 'exec'))
