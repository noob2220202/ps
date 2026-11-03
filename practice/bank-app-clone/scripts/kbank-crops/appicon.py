#!/usr/bin/env python3
"""케이뱅크 앱 아이콘을 App Store 원본(1024px)에서 받아 갤럭시 아이콘 모양으로 잘라 src/assets/local/kbank-app-icon.png (464px) 로.

  python3 scripts/kbank-crops/appicon.py

녹화(금융 폴더 속 아이콘)보다 훨씬 선명. 모양은 녹화 앱 서랍에서 잰 갤럭시 아이콘 모서리(초타원 n=2.7, crops.py 의 squircle 과 같음).
iTunes 조회 API(id 1178872627 = 케이뱅크)로 지금 올라와 있는 아이콘 주소를 얻음. 필요: numpy, Pillow, 인터넷
"""
import sys as _sys, pathlib as _pl  # noqa: E401
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))
import keep_assets  # noqa: E402,F401  이미 있는 에셋은 덮어쓰지 않음 (--force 로 풂)
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "src/assets/local/kbank-app-icon.png"
info = json.load(urllib.request.urlopen("https://itunes.apple.com/lookup?id=1178872627&country=kr"))["results"][0]
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
