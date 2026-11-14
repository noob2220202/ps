# kakao2 인트로 영상: 녹화 IMG_5438 의 첫 25장(0.000~0.400초, 60fps — 앱 보관함 → 금융 폴더 B 아이콘을 눌렀다 뗌)만 잘라
# 상태바 시계 + 달(집중 모드) · 배터리 자리를 주변 색으로 메움 → 그 위에 앱이 지금 시각 · 달 · 정해 둔 배터리 값을 그림 (chrome.css [data-intro-play])
# 0.458초부터는 커지는 앱 창 속에 실제 이름 · 잔액이 보이므로 절대 더 길게 자르지 않음 (그 뒤 장면은 앱이 직접 그림, src/kakao2/Launch.tsx)
# python3 scripts/kakao-intro-erase.py 원본.MP4 src/assets/intro/kakao-open-intro  → kakao-open-intro.mp4 (H.264) + .webm (VP9)
# 원본 = HEVC 1180 × 2556, 꽉 찬 범위(pc) bt709. 2배(786 × 1704)로 줄이고 bt709 tv 범위 yuv420p 로 직접 바꿔 넘김
# (ffmpeg 에 RGB 를 넘기면 tv 범위 · 색 행렬 변환에서 회색이 1~2, 노란 B 가 3~10 단계 어긋났음)
import subprocess, sys, numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
W, H, N = 1180, 2556, 25  # 25장 = 0.4167초 (첫 25장은 1/60초 간격 그대로)
OW, OH = 786, 1704
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-frames:v', str(N), '-fps_mode', 'passthrough',
                      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()
assert len(fr) == N, len(fr)
# 메울 칸 (원본 px, x0 x1 y0 y1 포함 = pt × 3.0025): 시계 '10:47' + 달 27.5~91.5 × 20~39pt, 배터리(몸통 · 꼭지 · '51') 337.5~367.5 × 20.5~38pt.
# 바탕은 평평한 회색 #868386 → 줄마다 칸 바깥 왼쪽 · 오른쪽 세 칸 평균 색을 직선으로 이음 (한 칸만 쓰면 압축 잡음이 가로 줄무늬로 남음).
# 신호 · LTE · 아일랜드(빨간 점)는 앱 화면과 같아서 그대로 둠
RECTS = [(82, 275, 60, 117), (1013, 1104, 61, 114)]
for f in fr:
    for X0, X1, Y0, Y1 in RECTS:
        L = f[Y0:Y1 + 1, X0 - 4:X0 - 1].astype(float).mean(1)
        R = f[Y0:Y1 + 1, X1 + 2:X1 + 5].astype(float).mean(1)
        w = (np.arange(X0, X1 + 1) - (X0 - 2)) / ((X1 + 2) - (X0 - 2))
        f[Y0:Y1 + 1, X0:X1 + 1] = (L[:, None, :] * (1 - w)[None, :, None] + R[:, None, :] * w[None, :, None]).round().astype(np.uint8)


# RGB → bt709 tv 범위 yuv420p (색차는 2 × 2 평균)
def yuv420(rgb):
    r, g, b = (rgb[..., i].astype(np.float64) / 255 for i in range(3))
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    cb = (b - y) / 1.8556
    cr = (r - y) / 1.5748
    Y = np.clip(np.round(16 + 219 * y), 0, 255).astype(np.uint8)
    sub = lambda c: (c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]) / 4
    U = np.clip(np.round(128 + 224 * sub(cb)), 0, 255).astype(np.uint8)
    V = np.clip(np.round(128 + 224 * sub(cr)), 0, 255).astype(np.uint8)
    return Y.tobytes() + U.tobytes() + V.tobytes()


small = [np.asarray(Image.fromarray(f).resize((OW, OH), Image.LANCZOS)) for f in fr]
data = b''.join(yuv420(f) for f in small)
common = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{OW}x{OH}', '-r', '60', '-i', '-', '-an',
          '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
# mp4: H.264 High 4.2 (avc1.64002A, 786 × 1704 · 60fps), B 프레임 없이(-bf 0 — 있으면 편집 목록 때문에 브라우저 시작 시각이 밀림, recorder.ts)
r1 = subprocess.run(common + ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-bf', '0', '-crf', '18', '-movflags', '+faststart',
                              out + '.mp4'], input=data)
# webm: H.264 를 못 트는 브라우저(오픈소스 Chromium 등)용 VP9
r2 = subprocess.run(common + ['-c:v', 'libvpx-vp9', '-crf', '24', '-b:v', '0', '-row-mt', '1', out + '.webm'], input=data)
print('frames', len(fr), 'rc', r1.returncode, r2.returncode)
