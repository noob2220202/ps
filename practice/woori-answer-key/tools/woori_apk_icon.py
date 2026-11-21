#!/usr/bin/env python3
"""APK 아이콘·스플래시 만들기 (WON 답지 — 연습용 앱, 은행 로고·캐릭터와 무관한 새 그림).

그림: 짙은 초록 바탕 + 흰 답안지(모서리 둥근 종이) + 회색 글줄 두 개 + 초록 체크 표시. 도형만 쓴다.
좌표는 적응형 아이콘 전경 108 x 108 단위(안전 영역 21–87) 하나로 정하고, 같은 도형으로
  - res/drawable/ic_launcher_foreground_won.xml  (벡터, 적응형 아이콘 전경·단색 아이콘)
  - res/mipmap-*/ic_launcher.png · ic_launcher_round.png · ic_launcher_foreground.png (API 24–25 용 PNG)
  - res/mipmap-anydpi-v26/ic_launcher(_round).xml, res/values/ic_launcher_background.xml
  - res/drawable/splash.xml (흰 바탕 — Capacitor 기본 스플래시 그림을 지운다)
를 쓴다. 사용: python3 tools/woori_apk_icon.py  (frontend/android 가 있어야 한다)
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'frontend', 'android', 'app', 'src', 'main', 'res')

BG = '#1E6E5A'      # 바탕 (짙은 초록)
PAPER = '#FFFFFF'   # 답안지
LINE = '#BFD3CC'    # 글줄
CHECK = '#1E6E5A'   # 체크

# 108 단위 도형
PAPER_BOX = (34, 27, 74, 81)   # x0, y0, x1, y1
PAPER_R = 5
LINES = [(41, 37, 67, 41), (41, 46, 60, 50)]  # 둥근 막대 (높이 4)
CHECK_PTS = [(41.5, 62), (50.5, 71), (67, 55)]
CHECK_W = 6.5


def draw_art(img, scale, ox=0.0, oy=0.0):
    d = ImageDraw.Draw(img)
    S = lambda v, o: v * scale + o  # noqa: E731
    x0, y0, x1, y1 = PAPER_BOX
    d.rounded_rectangle((S(x0, ox), S(y0, oy), S(x1, ox), S(y1, oy)), radius=PAPER_R * scale, fill=PAPER)
    for (a, b, c, e) in LINES:
        d.rounded_rectangle((S(a, ox), S(b, oy), S(c, ox), S(e, oy)), radius=2 * scale, fill=LINE)
    pts = [(S(x, ox), S(y, oy)) for x, y in CHECK_PTS]
    w = int(round(CHECK_W * scale))
    d.line(pts, fill=CHECK, width=w, joint='curve')
    r = CHECK_W * scale / 2
    for (x, y) in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=CHECK)


def render(size_px, kind):
    """kind: 'legacy'(둥근 사각) | 'round'(원) | 'foreground'(투명 108dp 전경)"""
    k = 8  # 크게 그려 줄여서 가장자리를 부드럽게
    big = size_px * k
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    if kind == 'foreground':
        draw_art(img, big / 108)
    else:
        # 48dp 아이콘 = 108 전경의 가운데 72 단위(18–90)를 꽉 채운 모양
        scale = big / 72
        mask = Image.new('L', (big, big), 0)
        md = ImageDraw.Draw(mask)
        if kind == 'round':
            md.ellipse((0, 0, big - 1, big - 1), fill=255)
        else:
            md.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.18, fill=255)
        bg = Image.new('RGBA', (big, big), BG)
        draw_art(bg, scale, -18 * scale, -18 * scale)
        img.paste(bg, (0, 0), mask)
    return img.resize((size_px, size_px), Image.LANCZOS)


def vector_xml():
    x0, y0, x1, y1 = PAPER_BOX
    r = PAPER_R

    def rrect(a, b, c, e, rr):
        return (f'M{a + rr},{b} H{c - rr} A{rr},{rr} 0 0 1 {c},{b + rr} V{e - rr} A{rr},{rr} 0 0 1 {c - rr},{e} '
                f'H{a + rr} A{rr},{rr} 0 0 1 {a},{e - rr} V{b + rr} A{rr},{rr} 0 0 1 {a + rr},{b} Z')

    lines = ''.join(
        f'    <path android:fillColor="{LINE}" android:pathData="{rrect(a, b, c, e, 2)}" />\n' for (a, b, c, e) in LINES)
    p = CHECK_PTS
    check = f'M{p[0][0]},{p[0][1]} L{p[1][0]},{p[1][1]} L{p[2][0]},{p[2][1]}'
    return f'''<?xml version="1.0" encoding="utf-8"?>
<!-- WON 답지 아이콘 전경 (tools/woori_apk_icon.py 가 만든다 — 손으로 고치지 않는다). 흰 답안지 + 글줄 + 체크, 은행 로고·캐릭터 아님 -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="{PAPER}" android:pathData="{rrect(x0, y0, x1, y1, r)}" />
{lines}    <path android:strokeColor="{CHECK}" android:strokeWidth="{CHECK_W}" android:strokeLineCap="round"
        android:strokeLineJoin="round" android:fillColor="#00000000" android:pathData="{check}" />
</vector>
'''


ADAPTIVE = '''<?xml version="1.0" encoding="utf-8"?>
<!-- tools/woori_apk_icon.py 가 만든다 -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground_won"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground_won"/>
</adaptive-icon>
'''

SPLASH = '''<?xml version="1.0" encoding="utf-8"?>
<!-- 시작 화면 바탕 (흰색). tools/woori_apk_icon.py 가 만든다 — Capacitor 기본 스플래시 그림 대신 -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#FFFFFF" />
        </shape>
    </item>
</layer-list>
'''

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def main():
    if not os.path.isdir(RES):
        sys.exit(f'없음: {RES} (먼저 cd frontend && npx cap add android)')
    for name, f in DENSITIES.items():
        d = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(d, exist_ok=True)
        render(int(48 * f), 'legacy').save(os.path.join(d, 'ic_launcher.png'), optimize=True)
        render(int(48 * f), 'round').save(os.path.join(d, 'ic_launcher_round.png'), optimize=True)
        render(int(108 * f), 'foreground').save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)
    for fn in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        with open(os.path.join(RES, 'mipmap-anydpi-v26', fn), 'w', encoding='utf-8') as fh:
            fh.write(ADAPTIVE)
    os.makedirs(os.path.join(RES, 'drawable'), exist_ok=True)
    with open(os.path.join(RES, 'drawable', 'ic_launcher_foreground_won.xml'), 'w', encoding='utf-8') as fh:
        fh.write(vector_xml())
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8') as fh:
        fh.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')
    # Capacitor 기본 그림(로고 스플래시·전경 벡터·격자 바탕) 지우기
    for root, _dirs, files in os.walk(RES):
        for fn in files:
            if fn == 'splash.png' or (fn in ('ic_launcher_foreground.xml', 'ic_launcher_background.xml') and 'drawable' in root):
                os.remove(os.path.join(root, fn))
    for root, dirs, _files in os.walk(RES, topdown=False):
        for dn in dirs:
            p = os.path.join(root, dn)
            if not os.listdir(p):
                os.rmdir(p)
    with open(os.path.join(RES, 'drawable', 'splash.xml'), 'w', encoding='utf-8') as fh:
        fh.write(SPLASH)
    # 미리보기 (저장소 밖 tools/out)
    out = os.path.join(ROOT, 'tools', 'out', 'apk')
    os.makedirs(out, exist_ok=True)
    render(192, 'legacy').save(os.path.join(out, 'icon-preview.png'))
    print('ok', RES)


if __name__ == '__main__':
    main()
