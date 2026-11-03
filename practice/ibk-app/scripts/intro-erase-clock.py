# ibk2 인트로 영상의 상태바 시계(10:00) 자리를 장면마다 주변 색으로 메움 → 그 위에 앱이 지금 시각을 그림
# (python3 scripts/intro-erase-clock.py 원본.mp4 src/assets/intro/ibk-open-intro.mp4 — 원본은 시계를 지우기 전 영상, git 기록 d73d023 의 같은 파일)
import subprocess, sys, numpy as np
src, dst = sys.argv[1], sys.argv[2]
X0, X1, Y0, Y1 = 22, 62, 7, 22  # 메울 칸 (포함), 시계 잉크 x 25~59 · y 10~20
raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 832, 384, 3).copy()
for f in fr:
    lum = f.astype(int).mean(2)
    L, R = f[:, X0 - 1].astype(float), f[:, X1 + 1].astype(float)
    top = f[Y0 - 1].astype(float)
    for x in range(X0, X1 + 1):
        col = lum[:40, x]
        # 올라오는 흰 카드 위끝: 17행부터 아래로 6줄 이상 밝음 (흰 시계 글자는 20행에서 끝나서 걸리지 않음)
        yc = next((y for y in range(17, 30) if (col[y:y + 6] > 180).all()), 99)
        w = (x - (X0 - 1)) / (X1 + 1 - (X0 - 1))
        for y in range(Y0, Y1 + 1):
            if y >= yc:
                f[y, x] = f[yc + 3, x]  # 카드 몸통 색
            elif lum[y, X0 - 1] > 180 or lum[y, X1 + 1] > 180:
                f[y, x] = top[x]
            else:
                f[y, x] = (L[y] * (1 - w) + R[y] * w).round()
enc = subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','384x832','-r','30','-i','-',
    '-an','-pix_fmt','yuv420p','-c:v','libx264','-profile:v','high','-bf','0','-crf','16','-movflags','+faststart',dst], input=fr.tobytes())
print('frames', len(fr), 'rc', enc.returncode)
