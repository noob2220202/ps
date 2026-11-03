"""고친 에셋을 예전 자르기 스크립트가 덮어쓰지 않게 하는 안전장치.

2026-11 에셋 검수에서 src/assets/local 의 그림 대부분을 다시 만들고(잉크 상자로 자름 · 벡터로 다시 그림) CSS 자리도 그에 맞췄음.
예전 스크립트를 다시 돌리면 옛 그림(여백 · 번진 테두리)이 같은 이름으로 덮여 자리까지 어긋나므로,
이 모듈을 불러온 스크립트는 이미 있는 파일을 건너뜀. 정말 덮어쓰려면 --force (또는 FORCE=1).
"""
import os
import sys
from pathlib import Path

from PIL import Image

LOCAL = (Path(__file__).resolve().parents[1] / "src/assets/local").resolve()
FORCE = os.environ.get("FORCE") == "1" or "--force" in sys.argv
if "--force" in sys.argv:
    sys.argv.remove("--force")  # argparse 가 모르는 인자로 멈추지 않게

_save = Image.Image.save


def _guarded(self, fp, *args, **kwargs):
    if not FORCE and isinstance(fp, (str, os.PathLike)):
        p = Path(fp).resolve()
        if p.parent == LOCAL and p.exists():
            print(f"건너뜀 (이미 있음 — 덮어쓰려면 --force): {p.name}", file=sys.stderr)
            return None
    return _save(self, fp, *args, **kwargs)


Image.Image.save = _guarded
