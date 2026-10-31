#!/usr/bin/env python3
"""i-ONE Bank 앱 아이콘을 App Store 원본(1024px)에서 받아 갤럭시 아이콘 모양으로 잘라 src/assets/local/ibk-app-icon.png (464px) 로.

  python3 scripts/ibk-crops/appicon.py

녹화(앱 서랍 58dp)보다 훨씬 선명. 모양은 녹화 앱 서랍에서 잰 갤럭시 아이콘 모서리(초타원 n=2.7, crops.py 의 squircle 과 같음).
iTunes 조회 API(id 1460543865 = 'i-ONE Bank - 개인고객용')로 지금 올라와 있는 아이콘 주소를 얻음. 필요: numpy, Pillow, 인터넷
IBK CI 심볼(ibk-ci-symbol.svg, 이체확인증 로고)은 companieslogo.com 의 Industrial Bank of Korea 로고 SVG 를 그대로 씀.
IBK 원 로고(ibk-logo-ibk.svg, 홈 '기업은행' 탭·받는 분·출금계좌 등)는 그 심볼 경로를 녹화의 원 크기에 맞춰 원으로 자른 벡터 (업스케일보다 선명).
"""
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local/ibk-app-icon.png"
info = json.load(urllib.request.urlopen("https://itunes.apple.com/lookup?id=1460543865&country=kr"))["results"][0]
url = info["artworkUrl512"].replace("512x512bb.jpg", "1024x1024bb.png")
im = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB").resize((464, 464), Image.LANCZOS)
a = np.asarray(im).astype(np.float64)
h, w, _ = a.shape
yy, xx = np.mgrid[0:h, 0:w]
r0 = min(h, w) / 2
r = ((np.abs(xx - (w - 1) / 2) / r0) ** 2.7 + (np.abs(yy - (h - 1) / 2) / r0) ** 2.7) ** (1 / 2.7)
alpha = np.clip((1 - r) * r0 + 0.5, 0, 1) * 255
Image.fromarray(np.dstack([a, alpha]).round().astype(np.uint8), "RGBA").save(OUT, optimize=True)
print("saved", OUT.name, im.size)
