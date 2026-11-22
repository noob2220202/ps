#!/usr/bin/env python3
"""스플래시 아래 배지 두 장의 벡터 판(hq) 만들기 — 실제 기기(DPR 3)에서 흐리지 않게.

    python3 tools/woori_badges_svg.py            # frontend/public/woori/launch/splash-{if-award,ma-cert}.hq.svg
    python3 tools/woori_badges_svg.py --out DIR

같은 박스(frame px x3 = PNG 화소 좌표: iF 417x216, MA 513x171)에 그린다 → spec 의 css 상자 그대로 놓인다.
모든 값은 기존 hq png(영상 중앙값 → EDSR x3 → 역투영) 에서 잰 것:
  · 직선 가장자리: 가장자리 수직 방향 0.5 교차점(쌍선형 보간) 최소제곱 직선 (잔차 rms ≤ 0.18px)
  · 글자: 후보 글꼴 윤곽을 가우스 흐림(σ≈1–1.9px) 뒤 hq png 와 평균 절대차가 가장 작게 크기·자리·자간·가로 비율 맞춤
    (iF: Carlito Bold — Inter SemiBold·Pretendard 600 과 비슷하고 세 줄 크기가 44 로 한결같다.
     MA: 'Mobile Accessibility' Inter Regular (Liberation Sans 0.060 → 0.033), '모바일 접근성 인증' Pretendard 500)
글자는 윤곽(path)으로 바꿔 넣는다 (<img> 속 SVG 는 웹 글꼴을 못 쓴다). 래스터 없음.
필요: fontTools, brotli(woff2), skia-pathops (pip), Inter·Carlito (fonts-inter·fonts-crosextra-carlito), Pretendard (frontend/public/fonts).
영상 대조(프레임 모드)는 spec 의 file(PNG) 을 그대로 쓰므로 이 SVG 는 실제 앱 화면에만 영향을 준다.
"""
import argparse
import os

import numpy as np
import pathops
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = {
    'carlito-bold': '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf',
    'inter': '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
    'pretendard': os.path.join(ROOT, 'frontend/public/fonts/PretendardVariable.woff2'),
}


def font(key, wght=None):
    f = TTFont(FONTS[key])
    if wght is not None:
        from fontTools.varLib import instancer
        f = instancer.instantiateVariableFont(f, {'wght': wght})
    return f


def union(paths):
    out = paths[0]
    for q in paths[1:]:
        out = pathops.op(out, q, pathops.PathOp.UNION)
    return out


def text_path(f, text, size, x, base, tracking=0.0, sx=1.0):
    """글자 윤곽 (y 아래로). x = 펜 시작, base = 기준선, tracking = 글자 사이 더하는 px, sx = 가로 비율. 커닝 없음."""
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    s = size / f['head'].unitsPerEm
    parts = []
    for ch in text:
        g = cmap[ord(ch)]
        p = pathops.Path()
        gs[g].draw(TransformPen(p.getPen(glyphSet=gs), (s * sx, 0, 0, -s, x, base)))
        parts.append(p)
        x += gs[g].width * s * sx + tracking
    return union(parts)


def poly(pts):
    p = pathops.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    return p


def rect(x0, y0, x1, y1):
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def circle(cx, cy, r):
    k = 0.5522847498 * r
    p = pathops.Path()
    p.moveTo(cx + r, cy)
    p.cubicTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    p.cubicTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    p.cubicTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    p.cubicTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    p.close()
    return p


def line(p, d):
    d = np.array(d, float)
    return np.array(p, float), d / np.linalg.norm(d)


def inter(l1, l2):
    (p, d), (q, e) = l1, l2
    t = np.linalg.solve(np.array([[d[0], -e[0]], [d[1], -e[1]]]), q - p)
    return p + d * t[0]


def quad(a, b, top, bot):
    return poly([inter(a, top), inter(b, top), inter(b, bot), inter(a, bot)])


def mid(l1, l2):
    (p, a), (q, b) = l1, l2
    if a @ b < 0:
        b = -b
    qq = q + b * ((p - q) @ b)
    return line((p + qq) / 2, (a + b) / 2)


def rounded_poly(V, R):
    """볼록 다각형 V, 꼭짓점마다 반지름 R 의 둥근 모서리 (원호는 3차 베지어)"""
    n = len(V)
    segs = []
    for i in range(n):
        v, a, b, r = V[i], V[i - 1], V[(i + 1) % n], R[i]
        u1 = (a - v) / np.linalg.norm(a - v)
        u2 = (b - v) / np.linalg.norm(b - v)
        ang = np.arccos(np.clip(u1 @ u2, -1, 1))
        t = r / np.tan(ang / 2)
        h = 4 / 3 * np.tan((np.pi - ang) / 4) * r
        p1, p2 = v + u1 * t, v + u2 * t
        segs.append((p1, p1 - u1 * h, p2 - u2 * h, p2))
    p = pathops.Path()
    p.moveTo(*segs[0][0])
    for i, (p1, c1, c2, p2) in enumerate(segs):
        if i:
            p.lineTo(*p1)
        p.cubicTo(*c1, *c2, *p2)
    p.close()
    return p


def d_attr(p):
    pen = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    p.draw(pen)
    return pen.getCommands()


def if_award():
    """iF DESIGN AWARD 2026: 빨간 사각 2개 (230,0,18) + 흰 iF 기호 · 글자 (사각 안은 불투명)"""
    y0, y1 = 9.57, 206.8
    red = union([rect(8.0, y0, 201.45, y1), rect(212.77, y0, 406.41, y1)])
    glyph = union([circle(63.6, 66.3, 17.35), rect(49.4, 92.5, 79.4, 164.75), rect(89.86, 51.45, 120.58, 164.75),
                   rect(130.3, 51.45, 160.91, 81.9), rect(130.3, 92.4, 160.91, 123.4)])
    cf = font('carlito-bold')
    txt = union([text_path(cf, 'DESIGN', 44.05, 236.2, 80.0, 0.1, 1.03),
                 text_path(cf, 'AWARD', 43.8, 235.7, 122.25, 0.525, 1.015),
                 text_path(cf, '2026', 44.15, 236.15, 164.25, 1.7, 0.987)])
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 417 216" width="417" height="216">'
            f'<path fill="#e60012" d="{d_attr(red)}"/><path fill="#fff" d="{d_attr(union([glyph, txt]))}"/></svg>\n')


# MA 판·글자 가장자리 직선 (점, 방향) — hq png 에서 맞춘 값
MA = {
    'top': ((106.5517, 17.9078), (0.987147, 0.159815)), 'left': ((11.8421, 86.6566), (0.078072, 0.996948)),
    'right': ((179.2113, 85.9981), (0.031152, 0.999515)), 'bottom': ((104.4905, 157.9171), (0.99736, -0.072609)),
    'L_ll': ((15.8981, 34.2562), (-0.098771, 0.99511)), 'L_lr': ((24.8046, 70.5005), (-0.108423, 0.994105)),
    'D1_l': ((41.1927, 71.4896), (0.233459, 0.972367)), 'D1_r': ((49.9593, 54.9841), (0.252274, 0.967656)),
    'D2_l': ((80.0896, 58.7945), (0.440203, -0.897898)), 'D2_r': ((86.3073, 73.984), (0.433182, -0.901307)),
    'R_l': ((101.8644, 77.1209), (-0.105637, 0.994405)), 'R_r': ((115.8668, 67.4646), (-0.106, 0.994366)),
    'A_lo': ((118.1846, 116.0651), (-0.334005, 0.942571)), 'A_li': ((125.6962, 128.8841), (-0.329609, 0.944118)),
    'A_ro': ((163.2041, 105.9058), (0.420815, 0.907146)), 'A_ri': ((159.8734, 125.8544), (0.418034, 0.908432)),
    'CB_t': ((143.4941, 130.8267), (0.99866, -0.051747)), 'CB_b': ((143.4942, 141.7663), (0.999241, -0.038947)),
    'B': ((0, 104.8553), (0.99436, 0.106059)),  # M 아래끝(기울어진 기준선)
    'AT': ((0, 78.4209), (0.999278, -0.037981)),  # A 꼭대기 평평한 끝
}
MA_RADII = (18.0, 18.0, 19.0, 17.5)  # 판 모서리 TL TR BR BL


def ma_cert():
    """MA 마크: 남색 (35,63,144) 비스듬한 둥근 판 + 흰 M·A (판 밖으로 나간 획 끝은 판에서 잘림) + 회색 두 줄"""
    g = {k: line(*v) for k, v in MA.items()}
    V = [inter(g['top'], g['left']), inter(g['top'], g['right']), inter(g['bottom'], g['right']), inter(g['bottom'], g['left'])]
    plate = rounded_poly(V, MA_RADII)
    up, down = line((0, -40), (1, 0)), line((0, 240), (1, 0))
    m = union([quad(g['L_ll'], g['L_lr'], up, g['B']), quad(g['D1_l'], g['D1_r'], up, g['B']),
               quad(g['D2_l'], g['D2_r'], up, g['B']), quad(g['R_l'], g['R_r'], up, g['B'])])
    a = union([quad(g['A_lo'], g['A_li'], g['AT'], down), quad(g['A_ri'], g['A_ro'], g['AT'], down),
               quad(mid(g['A_lo'], g['A_li']), mid(g['A_ri'], g['A_ro']), g['CB_t'], g['CB_b'])])
    letters = pathops.op(union([m, a]), plate, pathops.PathOp.INTERSECTION)
    lat = text_path(font('inter'), 'Mobile Accessibility', 27.5, 196.55, 113.35, 0.5, 1.003)
    kor = text_path(font('pretendard', 500), '모바일 접근성 인증', 38.0, 194.3, 155.4, 2.2, 1.044)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 513 171" width="513" height="171">'
            f'<path fill="#233f90" d="{d_attr(plate)}"/><path fill="#fff" d="{d_attr(letters)}"/>'
            f'<path fill="#888" d="{d_attr(lat)}"/><path fill="#686868" d="{d_attr(kor)}"/></svg>\n')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'frontend/public/woori/launch'))
    out = ap.parse_args().out
    for name, fn in (('splash-if-award.hq.svg', if_award), ('splash-ma-cert.hq.svg', ma_cert)):
        with open(os.path.join(out, name), 'w', encoding='utf-8') as fh:
            fh.write(fn())
        print('wrote', os.path.join(out, name))
