# 픽셀 비교 하네스 (tools/)

화면녹화 영상(우리WON뱅킹 v1·v2)과 우리 앱을 겹쳐서, 어디가 몇 **dp** (그리고 영상 몇 px) 어긋났는지 숫자와 그림으로 보여 주는 도구 모음.
하나원큐 답지(`answer-key/tools`)의 하네스를 우리 영상 단위로 옮긴 것이다 (코드는 공유하지 않고 복사해서 고쳤다).

## 단위 — dp 와 frame px (D1)

| | 크기 | 쓰는 곳 |
|---|---|---|
| **dp** (= CSS px) | 폰 뷰포트 **360 x 880** (1080x2640 기기px, 밀도 3.0) | 앱 코드 (CSS/TSX), `spec/dp/*.json`, `WooriArtbox.ts`, 뷰어 읽기 |
| **frame px** | 영상 **524 x 1280** | 영상·기준 프레임 (`tools/ref`), `spec/*.json` 원본, 마스크, compare.py 그림 |

**가로와 세로 배율이 다르다** (영상 가로가 0.24% 더 크다, 1단계 units.json 이 정본). 스칼라 하나로 바꾸지 않는다:

| | dp → frame px | frame px → dp |
|---|---|---|
| 가로 위치 | `x_px = 262.02 + 1.45803·(x_dp − 180)` | `x_dp = 180 + (x_px − 262.02) / 1.45803` |
| 폭·가로 이동 | `w_px = 1.45803·w_dp` | `w_dp = w_px / 1.45803` |
| 세로 위치 (화면 위끝 기준) | `y_px = 16/11·y_dp` | `y_dp = 0.6875·y_px` (앱 안 y = y_dp − 31.333) |
| 높이·세로 이동, 방향 없는 길이 (반지름·글자 크기·선 굵기) | `× 16/11` | `× 0.6875` |

가로에 0.6875 를 쓰면 화면 가장자리에서 0.4–0.8 px 어긋난다. 코드는 `woori-units.cjs` 의 `xDp/xPx · wDp/wPx · yDp/yPx · hDp/hPx · lenDp/lenPx · boxDp/boxPx` 를 쓴다
(파이썬 도구는 같은 상수를 따로 갖고 있고 selftest 가 같은 값인지 대조한다).

자주 쓰는 값: 좌우 여백 20dp = x 28.735 / 495.305 px, 16dp = 22.903 / 501.137 px, 폭 320dp = 466.57 px, 48dp 높이 = 69.818 px.

세로 띠: 상태바 0–45.576 px (0–31.333 dp, 94 기기px) · 앱 뷰포트 45.576–1210.182 px (31.333–832 dp, 높이 800.667 dp) ·
3버튼 내비 바 1210.182–1280 px (832–880 dp, 48 dp).

스크린샷은 뷰포트 360x880 을 **deviceScaleFactor 16/11** 로 찍어서 524x1280 PNG 가 되고 (360 × 16/11 = 523.64 를 올려 524),
`?frame=1` 이면 앱이 아래 구성으로 영상과 같은 자리에 그려 기준 프레임과 픽셀 1:1 로 겹친다. 오프셋은 frame px 와 dp 를 둘 다 보여 준다.

```
#sb   위 31dp 스페이서 (상태바 자리)
#app  앱 셸 360 x 800.667dp — 문서는 스크롤하지 않고 안쪽 컨테이너가 스크롤, position:fixed 를 쓰지 않음
      transform-origin: 0 0; transform: translate(-0.2925px, 0.333px) scaleX(1.0023956)
        · 0.333 = 상태바 94 기기px(31.333dp) − 31dp 스페이서 (레이아웃 위치는 정수 dp 로 반올림되고 transform 은 반올림되지 않는다)
        · scaleX 1.0023956 = 1.45803 ÷ 16/11, translateX −0.2925 = (262.02 − 1.45803·180) ÷ 16/11
#nav  아래 48dp 스페이서 (내비 바 자리), position:relative; z-index:1 (변형된 셸 위에 그림)
html/body 에는 transform 을 걸지 않는다 (position:fixed 가 그 요소 기준이 되어 문서 스크롤과 함께 움직인다)
```
selftest 가 이 구성을 정적 페이지로 찍어 확인한다: 상태바 경계 45.571 px(−0.004) · 내비 경계 1210.143 px(−0.039),
1dp 가로선 y=100/400/700 오차 +0.076/−0.038/−0.006 px, 세로선 x=16/20/100/260/340/344 오차 ≤ 0.05 px, 상자 가장자리 ≤ 0.003 px (units.md 6.3절과 같은 값).

```
tools/
  woori-units.cjs  D1 단위 (x/y 함수, 360x880, DSF 16/11, 상태바 31.333dp, 내비 48dp, 기본 마스크, ?frame=1 보정 값)
  woori_video.py   공용 영상 읽기 (clean 영상, VFR pts, 인덱스 구간, 중앙값 기준 프레임) · woori_edge.py 엣지 패널 손잡이 지우기
  shot.cjs         앱 스크린샷 (360x880 @16/11 → 524x1280) → tools/out/<group>/<state>/ + 자동 비교
  compare.py       shot vs ref → overlay/onion/diff/edges/side(+elements) 그림 + JSON 지표 + (dx,dy) px/dp
  viewer.cjs/html  실시간 오버레이 뷰어 (앱 iframe 위에 clean 영상을 반투명/차이 모드로 겹침, v1/v2, 시각·프레임 #, dp 자)  ← 사람이 쓰기 좋음
  ref.py           영상 구간 → 노이즈 없는 기준 프레임 (tools/ref/<group>/<state>.png, woori_video.median_ref 규칙)
  scan.py          영상 전체 정지/변화 구간 (spec/timeline.md 작성용)
  shots.json       상태 레지스트리 (생성물: gen-from-spec.cjs --shots). 손으로 고치지 않는다
  shots.d/         화면별 덧붙임/덮어쓰기 (<group>.json). 화면 담당자가 고치는 곳 (없어도 된다)
  shots-lib.cjs    shots.json + shots.d 병합, 시나리오 이름 (shot.cjs·viewer.cjs·gen 공용. ref.py 도 같은 규칙)
  gen-from-spec.cjs  spec/*.assets.json → frontend/src/WooriArt.ts·WooriArtbox.ts(dp), --shots 면 shots.json + spec/timeline.md 기준 구간 표
  spec-to-dp.cjs   spec/*.json (frame px) → spec/dp/*.json (dp, D1 축별) + 자체 검사 + 설계 dp 검사
  serve.sh / stop.sh   백엔드 + Vite 백그라운드 실행/종료 (포트·DB 를 환경 변수로)
  dev-woori.cjs    npm run dev:woori — 백엔드 + Vite 를 한 터미널 앞에서 (Ctrl+C 로 둘 다 종료). --install 은 npm run setup 의 한 단계
  lint.cjs         npm run lint — 프론트 lint + 백엔드/도구 문법 검사 + JSON (npm·셸 없이 node 로, OS 무관)
  check-dist.cjs   npm run check:dist — 빌드(압축) CSS 의 애니메이션·트랜지션 뜻이 소스와 같은지 (루트 npm run build 끝에 자동)
  selftest.cjs     하네스 자체 검증 (앱·스펙 없이, 고정 표본)
  woori-textfit.cjs  글꼴 맞추기 (설명은 따로: tools/README-textfit.md)
  build-apk.sh     APK (WON 답지, 서버 없는 로컬 모드) → tools/out/apk/WON-answer-key-debug.apk (frontend/README.md 'APK')
  woori-local-check.cjs  로컬 모드 웹 빌드(frontend/dist-apk)를 서버 없이 Chromium 으로 확인 + 실제 backend 와 응답 대조
  woori_apk_icon.py  APK 아이콘·스플래시 (도형만 쓴 새 그림) → frontend/android/app/src/main/res
  ref/  out/       생성물 (git 에 안 올라감: 실제 개인정보가 담긴 영상 프레임이므로). 영상은 tools/ref/video/<v>.mp4 · <v>-clean.mp4
```
`record.cjs` (실제 UI 를 원본 타임라인대로 조작해 녹화) 는 화면이 생긴 뒤에 옮긴다.

필요한 것: python3 + opencv(cv2)/numpy, ffmpeg/ffprobe, node 22, Playwright(Chromium).
- **Playwright**: 루트 `package.json` 의 devDependency(`playwright` 1.63.0 고정)다. `npm run setup` 이 루트 `npm install` 로 설치하고
  `npx playwright install chromium` 으로 브라우저까지 내려받는다. 루트 node_modules 에 없으면 shot.cjs 는 `NODE_PATH` 의 전역 설치를 찾는다
  (이 컨테이너는 `NODE_PATH=/usr/local/lib/node_modules_global`, `PLAYWRIGHT_BROWSERS_PATH` 가 잡혀 있어 setup 없이 돈다).
- **Python**: `python3 -m pip install opencv-python-headless numpy`. 명령은 그냥 `python3 …` 이다 — `python3 -I` 는 사용자 site-packages 를 꺼서
  `pip install --user` 로 깐 cv2/numpy 를 못 찾는다 (shot.cjs·selftest.cjs 도 `-I` 없이 부른다).
- **영상**: 기본은 손잡이를 지운 `tools/ref/video/v1-clean.mp4`, `v2-clean.mp4` (원본 pts 그대로). 다른 곳에 있으면 `WOORI_V1=/path/v1.mp4`
  (`WOORI_V2`) 또는 도구의 `--video`. 원본 mp4 를 주면 프레임마다 `woori_edge.clean_bgr` 를 거친다.

## 빠른 시작

```bash
cd woori-answer-key
npm run setup                                  # 루트(playwright)·backend/·frontend/ npm install(없는 쪽은 건너뜀) + Chromium (처음 한 번)
python3 -m pip install opencv-python-headless numpy   # 비교·기준 프레임용 (처음 한 번)
npm run dev:woori                              # 백엔드 4100 + Vite 5273 를 이 터미널에서 (Ctrl+C 종료)

# 또는 백그라운드로
bash tools/serve.sh                            # 이미 떠 있으면 그대로

# 1) 기준 프레임 만들기 (구간은 spec 상태의 video·i0·i1 = tools/shots.json)
python3 tools/ref.py --name home/top-banner1 --video v1 --i0 '#365' --i1 '#388'
python3 tools/ref.py --all                     # shots.json(+shots.d) 전부 (이미 있는 건 건너뜀, --force 로 재생성)

# 2) 앱 찍고 비교
node tools/shot.cjs --url "/home?frame=1&shot=top-banner1" --name home/top-banner1
#   -> tools/out/home/top-banner1/{shot,overlay,onion,diff,edges,side}.png + metrics.json + boxes.json
#   --ref 를 생략해도 tools/ref/home/top-banner1.png 가 있으면 자동 비교

# 3) 등록된 모든 상태를 한 번에
npm run shots                                  # = node tools/shot.cjs --full
node tools/shot.cjs --full --only home/,done/  # 일부만 (이름 앞부분, 쉼표로 여러 개, 끝에 $ 면 정확히 그 이름)
#   -> tools/out/summary.md (표: px + dp), tools/out/index.html (갤러리)

bash tools/stop.sh
```
화면·스펙이 아직 없을 때도 도구는 오류 없이 돈다: 빈 shots.json 이면 `--full` 은 빈 요약, gen/spec-to-dp 는 "할 일 없음",
serve.sh·dev-woori 는 없는 backend/·frontend/ 를 건너뛰고 알린다.

## 포트 · DB (여러 쌍 동시 실행)

| 환경 변수 | 기본 | 쓰는 곳 |
|---|---|---|
| `WOORI_WEB_PORT` | 5273 | Vite 포트. shot.cjs 기본 주소 `http://localhost:$WOORI_WEB_PORT`, viewer 기본 앱 주소 |
| `WOORI_API_PORT` | 4100 | 백엔드 포트. Vite 의 `/api` 프록시 대상 (vite.config 가 읽음) |
| `WOORI_DB_PATH` | backend/woori.db | 백엔드 SQLite 파일 (없으면 시드로 채움) |
| `WOORI_VIEWER_PORT` | 5298 | 오버레이 뷰어 |
| `SELFTEST_PORT` | 5299 | selftest 의 시험 페이지 서버 (사용 중이면 빈 포트) |

```bash
WOORI_WEB_PORT=5292 WOORI_API_PORT=4112 WOORI_DB_PATH=/tmp/a.db bash tools/serve.sh
WOORI_WEB_PORT=5292 node tools/shot.cjs --full --only home/
WOORI_WEB_PORT=5292 WOORI_API_PORT=4112 bash tools/stop.sh      # 같은 env 로 끈다 (그 쌍만)
```
로그·PID: `tools/out/logs/{backend-<API포트>,frontend-<WEB포트>}.{log,pid}`. 두 프로세스는 새 프로세스 그룹으로 띄워서 stop.sh 가 자식까지 같이 끈다
(util-linux `setsid`, 없으면 — macOS 등 — perl `setpgrp` 이나 python3 `os.setsid`). 어느 OS 에서나 되는 길은 앞에서 도는 `npm run dev:woori`.
`WOORI_NOW`, `WOORI_DISABLE_DEV` 는 두 방법 모두 백엔드로 그대로 전달된다.

## 앱 쪽 약속 (화면 담당자)

| 약속 | 내용 |
|---|---|
| `?frame=1` | 위 31dp 스페이서 + 앱 셸 보정 transform + 아래 48dp 스페이서 (위 '단위' 절) → 524x1280 스크린샷이 영상 프레임과 1:1 |
| `?shot=<상태 id>` | 고정 데이터로 그 상태를 결정적으로 그린 뒤 `window.__WOORI_READY__ = true`. shot= 이 있으면 shot.cjs 는 READY 를 최대 15초 기다린다 |
| `?theme=light\|dark` | 테마. `--dark` 로 찍으면 `theme=dark` 가 붙는다 |
| 애니메이션 | **CSS 애니메이션/트랜지션 또는 WAAPI(`element.animate`) 만** — rAF 로 JS 트위닝하면 `--t` 로 멈출 수 없다 |
| `data-ref="이름"` | (선택) 이 속성이 있는 요소는 영상 대비 (dx,dy) 를 따로 계산 → `elements.png`. boxes.json 에 frame px · D1 dp · CSS px |
| 스크롤 컨테이너 | Chromium 은 스크롤 내용의 화면 위치를 정수 기기 화소로 반올림한다. ?frame=1 셸 원점이 소수 px 라 그대로면 안의 내용이 (+0.43, +0.42)px 밀린다 → 앱이 맞춘다 (frontend/README '렌더 규칙', `/dev/frame?frame=1&shot=geometry·nested·scrolled` 로 확인) |
| `window.__WOORI_SHOT__` | shot.cjs 가 페이지 스크립트보다 먼저 `true` 로 설정. `--t` 가 있으면 `window.__WOORI_SHOT_T__` = t(ms) |
| `POST /api/dev/reset {scenario}` | 백엔드 시나리오 리셋 (`v1-start` · `v2-start` · `v2-end`, 아래). shot.cjs·뷰어가 찍기 전에 부른다 |

엣지 패널 손잡이는 영상에서 지웠으므로 앱도 그리지 않는다. 상태바·내비 바·OS 알림·런처는 앱이 아니다 (비교 마스크).

## shot.cjs

```bash
node tools/shot.cjs --url <URL 또는 /경로> --name <group>/<state> [옵션]
node tools/shot.cjs --full [shots 파일] [--only <prefix,…>] [옵션]
```

| 옵션 | 뜻 |
|---|---|
| `--base URL` | `/` 로 시작하는 URL 앞에 붙일 주소. 기본 `http://localhost:$WOORI_WEB_PORT` (없으면 shots 파일의 base, 그다음 5273) |
| `--t <ms>` (항목 `"t"`) | 애니메이션 위상: `__WOORI_READY__` 가 truthy 가 되는 순간 `document.getAnimations()` 전부 `pause()` + `currentTime = t`, 찍기 직전 한 번 더 |
| `--freeze-after-steps` (항목 `"freezeAfterSteps": true`) | steps 로 시작한 전환을 찍을 때: steps 가 끝나는 **즉시** t 에 멈추고 찍을 때까지 매 프레임 새로 생기는 애니메이션도 t 에 세운다 (`t` 필요) |
| `--scenario v1-start\|v2-start\|v2-end` (항목 `"scenario"`) | 찍기 전 `POST <origin>/api/dev/reset {scenario}`. 기본 `v1-start`. 별칭 `v1`·`v2`·`v1-end` 는 정식 이름으로 바꿔 보낸다. `--no-reset` 으로 끔 |
| `--mask x,y,w,h` 또는 `--mask <이름>` (항목 `"mask"`) | 비교 제외 (frame px, 여러 번). 이름: `keyboard` · `imeAppearing` · `rightColumnIso` · `edgePanelRawOnly` |
| `--no-default-mask` (항목 `"noDefaultMask"`) | 기본 마스크(상태바 0,0,524,46 · 내비 바 0,1210,524,70)를 끔 |
| `--dark` | `?theme=dark` + 다크 colorScheme 으로 찍기만 (영상은 라이트뿐이라 비교 없음). 출력 `tools/out/dark/` |
| `--keep-anim` / `--wait-ms N` / `--no-compare` / `--ref PNG` / `--out DIR` / `--quiet` / `--no-images` / `--headed` | 그대로 |
| `--click/--type/--press/--wait/--steps` | 조작 (아래 steps) |
| `--no-shots-d` / `--shots-d DIR` / `--no-merge` | shots.d 병합 끄기 / 다른 폴더 / `--full --only` 의 요약 합치기 끄기 |

기본 동작: ko-KR / Asia/Seoul, 라이트 모드, networkidle → `document.fonts.ready` → 모든 `<img>` decode → `__WOORI_READY__` →
`--wait-ms`(기본 400) → 촬영. `--t`/`--keep-anim` 이 없으면 Playwright `animations:'disabled'`(유한 애니메이션은 끝 상태, 무한은 처음 상태).
캐럿 숨김, 데스크톱 스크롤바 숨김(안드로이드는 오버레이 스크롤바라 정지 화면에 안 보임). URL 에 `frame=1` 이 없는데 비교하면 경고한다.

**boxes.json**: `data-ref` 요소의 `getBoundingClientRect`(transform 반영) → `x,y,w,h` = CSS px × 16/11 (frame px), `dp` = 그 frame px 의 D1 dp,
`css` = CSS px 그대로. `?frame=1` 이면 `dp` 가 앱 레이아웃 dp 와 같다 (보정 transform 이 D1 의 역이므로 — selftest 에서 20/231.333/320/48 확인).

**요약 표 (`--full`)**: `<out>/summary.{json,md}` + `index.html`. `--only` 로 일부만 찍으면 이번에 안 찍은 상태 줄은 같은 `<out>` 의
이전 `summary.json` 값을 그대로 두고(`previous: true`, 비고 `이전 실행`) 등록 순서로 합친다. `--no-merge` 면 찍은 줄만 쓴다.
`tools/out/` 은 git 에 안 올라가는 이 컴퓨터의 마지막 표이므로, 고치기 전후 비교용 실험은 `--out <다른 폴더>` 로 찍는다.

> **주의 — 중간 위상을 화면이 직접 고르는 shot.** `animations:'disabled'` 는 `pause()` 로 멈춰 둔 유한 CSS 애니메이션도 **끝으로 보낸다.**
> shot id 하나가 애니메이션 중간 모습이라면 (1) shots 항목에 `"t"` 를 주거나 (2) 화면이 `currentTime` 을 고른 뒤 `pause()` 대신
> `playbackRate = 0` 으로 세운다 (속도 0 인 애니메이션은 끝으로 보내지 않는다). 둘 다 아니면 끝 상태가 찍힌다.

조작이 필요한 상태는 steps 로:
```bash
node tools/shot.cjs --url "/send/account?frame=1" --name send-a/x \
  --steps '[{"click":"text=직접 입력"},{"waitMs":300},{"type":["input","3333123456789"]},{"press":"Enter"}]'
```
steps 종류: `click`, `tap:[x,y]`(D1 dp, 화면 기준 — ?frame=1 셸에서 그 dp 자리), `tapPx:[x,y]`(frame px), `tapCss:[x,y]`(CSS px),
`type:[selector,text]`, `fill:[selector,text]`, `press`, `wait`(selector), `waitMs`, `eval`, `scroll:[selector,dy]`, `goto`.

**steps 로 시작하는 전환**: steps 가 있으면 shot.cjs 는 steps 뒤에 networkidle → 글꼴·이미지 → `waitMs`(기본 400) 를 기다린 **다음에** t 로 멈춘다.
그보다 짧은 전환은 그 사이 끝나 레이어가 사라진 뒤라 t 를 줄 애니메이션이 없다. 이때 `"freezeAfterSteps": true` 를 준다
(selftest: 클릭 30ms 뒤 시작해 330ms 에 요소를 지우는 전환을 150ms 에 잡음 — 옵션 없이는 요소가 이미 사라져 있음).
멈춘 동안에도 타이머·fetch 는 돈다.

## shots.json · shots.d · scenario · t

`tools/shots.json` 은 `node tools/gen-from-spec.cjs --shots`(= `npm run gen`) 가 spec/*.json 의 `states` 에서 만든다 (name = `<group>/<spec 상태 id>`).
**손으로 고치지 않는다.** 화면마다 바꾸거나 더할 것은 `tools/shots.d/<group>.json` 에 쓴다:

```json
[
  { "name": "done/idle", "maskAdd": ["224,590,76,76"] },
  { "name": "done/check-t300", "url": "/send/done?frame=1&shot=render", "t": 300, "scenario": "v2-start",
    "video": "v1", "i0": 7445, "i1": 7445, "note": "체크 애니메이션 300ms 위상" }
]
```
- 같은 name → 필드 덮어쓰기 (얕은 병합, `mask` 는 통째로), `maskAdd` 는 덧붙이기. 새 name → 추가 (`url` 필수). 파일은 이름순 적용. `_` 로 시작하는 필드는 무시.
- 항목 필드: `name`, `url`, `video`(v1|v2), `i0`/`i1`(기준 프레임 원본 인덱스, 포함), `t0`/`t1`(그 pts, 정보용), `mask`, `scenario`, `t`(애니메이션 위상 ms),
  `noDefaultMask`, `steps`, `freezeAfterSteps`, `waitMs`, `keepAnim`, `noCompare`, `ref`, `refMask`(기준 프레임 안정성 검사에만), `boxesSelector`, `note`.
- `ref.py --all` 도 shots.d 를 읽어서 새 상태의 기준 프레임을 만든다 (`t` 는 애니메이션 위상이라 영상 시각이 아니다).
- **scenario** (backend/seed.js 와 같은 이름): `v1-start` v1 녹화 시작, 잔액 345원 (기본) · `v2-start` v1 의 1원 이체 뒤 = v2 시작, 344원 ·
  `v2-end` v2 의 2원 이체 뒤, 342원. 생성 규칙: 상태(또는 스펙)의 `"scenario"` > 영상 시각 — v1 은 완료 화면 첫 프레임 193.407s(#7429)부터
  `v2-start`, v2 는 86.237s(#3291)부터 `v2-end`, 그 전은 각각 `v1-start` / `v2-start` (`shots-lib.cjs` `SCENARIO_SWITCH`).
- gen-from-spec 이 다시 만들 때 손으로 넣은 `steps/freezeAfterSteps/waitMs/keepAnim/t/noDefaultMask/boxesSelector/refMask` 는 유지된다
  (`url` 은 `keepUrl:true`, `note` 는 `keepNote:true`, `scenario` 는 `keepScenario:true` 일 때만).

## 결과 읽는 법

compare.py 가 stdout 에 JSON, stderr 에 요약을 출력한다:
```
[compare] meanAbsDiff 34.65  pctPixelsOver24 32.31%  signedRGB [0.47, 0.22, 0.22]
          globalOffset (+3.0,+5.0)px = (+2.06,+3.44)dp score 0.999 (0,0)→0.609 phase(+3.0,+5.0)
          band y= 912- 960px (dp 627-660, 앱 595.7-628.7)  mad  42.49  >24  39.81%  offset (+3.0,+5.0)px = (+2.06,+3.44)dp score 1.000 (0,0)→0.482
          elements 3개 중 어긋남/불확실 3개
            title: box [28, 140, 232, 38]px = [19.496, 96.25, 159.119, 26.125]dp  offset (+3.0,+5.0)px = (+2.06,+3.44)dp ...
```

| 지표 | 뜻 |
|---|---|
| `meanAbsDiff` | 마스크 밖 픽셀의 채널 평균 \|shot−ref\| (0–255). 같은 화면이라도 영상 압축 때문에 0.5–2 정도는 남음 |
| `pctPixelsOver24` | 채널 최대 차이 > 24 인 픽셀 비율(%) — 글자/선이 어긋난 정도를 가장 잘 보여 줌 |
| `meanSignedRGB` | 평균 (shot − ref) [R,G,B]. 넓은 배경색이 몇 단계 밝은지/어두운지 |
| `bands[]` | y=0,48,96… 48px(33dp) 가로 띠별 지표 (`y0Dp/y1Dp` 화면 dp). side.png 오른쪽 막대 그래프와 같음 |
| `worstBands[].offset` | 차이가 큰 띠의 (dx,dy) 추정 (4행 이상 비교하는 띠만). `dx/dy` frame px, `dxDp = dx ÷ 1.45803`, `dyDp = dy × 0.6875`. `score` 는 정규화 상관(1=완벽), `scoreAtZero` 는 지금 위치(0,0)의 상관 |
| `globalOffset` | 화면 전체 기준 (dx,dy) |
| `elements[]` | `data-ref` 요소별 (dx,dy). `box` frame px, `boxDp` D1 dp |

**부호 규칙: offset (dx,dy) = 앱(shot) 위치 − 영상(ref) 위치.**
`(+3,+5)px = (+2.06,+3.44)dp` = 앱 쪽 내용이 오른쪽으로 2.06dp, 아래로 3.44dp 밀려 있음 → CSS 에서 왼쪽 2.06, 위로 3.44 옮기면 맞음.
가로와 세로의 px→dp 배율이 달라서 같은 3px 이라도 가로 2.058dp, 세로 2.063dp 다.
`note: flat` 은 무늬가 없어 추정 불가, `ambiguous` 는 반복 패턴, `at-search-limit` 는 ±24px(`--search`) 밖일 수 있음,
`low-confidence`(score<0.5) 는 내용 자체가 달라서 숫자가 의미 없음 — 이런 추정은 `reliable: false` 이고 요약표에는 `?` 로 나온다.
먼저 내용/색을 맞춘 다음 오프셋을 보자.

| 이미지 | 용도 |
|---|---|
| `edges.png` | **위치 확인에 제일 좋음.** 빨강=영상 윤곽, 청록=앱 윤곽, 흰색=일치. 빨강·청록이 나란히 두 줄이면 그만큼 어긋난 것 |
| `diff.png` | 차이 히트맵(x4 증폭). 사선 무늬 = 비교 제외(마스크) 영역 |
| `onion.png` | 앱 위에 영상 40% — 사람이 눈으로 맞춰 보는 반투명 겹치기와 같음 |
| `overlay.png` | 50/50 블렌드 |
| `side.png` | 영상 / 앱 / edges / diff 나란히 + 띠별 %>24 막대와 최악 띠 오프셋 |
| `elements.png` | data-ref 요소: 청록=앱 위치, 빨강=영상에서 찾은 위치 |

compare.py 옵션: `--mask x,y,w,h|<이름>`(여러 번), `--region x,y,w,h`(이 영역만), `--no-mask-statusbar`, `--no-mask-navbar`,
`--no-default-mask`(둘 다), `--band 48`, `--thresh 24`, `--search 24`, `--worst 6`, `--boxes boxes.json`, `--print-units`. 마스크·영역 좌표는 frame px.

## 사람이 직접 겹쳐 보기 (오버레이 뷰어)

```bash
node tools/viewer.cjs              # http://localhost:5298/  (앱 기본값 http://localhost:$WOORI_WEB_PORT)
node tools/viewer.cjs --app http://localhost:5274 --v1 ~/v1.mp4   # 다른 앱/영상
```

- 무대는 **360x880 dp** 다. 앱은 그 크기의 iframe 그대로, 그 위에 **손잡이를 지운 clean 영상**(v1/v2 고르기) 또는 tools/ref PNG 를 겹친다.
- **배치**: `?frame=1` 앱(가로 보정됨)이면 영상을 1:1 로 (CSS 폭 524 × 11/16 = 360.25), 보정 없는 앱이면 영상을 dp 에 맞춰
  (폭 359.39dp, 왼쪽 0.29dp — D1 의 x 식). URL 에 `frame=1` 이 있는지로 자동으로 고르고, 바꿀 수도 있다.
- **시각 · 프레임 #**: VFR 이라 프레임 번호가 기준이다 (`/pts/vN.json` = tools/ref/video/vN-pts.json, 없으면 woori_video.py 로 만든다).
  시각 t 를 넣으면 그 시각에 보이던 프레임(pts ≤ t 인 마지막), `#` 칸에 원본 인덱스. `←`/`→` 원본 프레임 하나씩, `Shift`+방향키 1초.
- 왼쪽 위 **dp 읽기**: 커서 아래 영상 픽셀의 `x · y dp` (D1: x 는 262.02 가운데 식, y 는 × 0.6875), 앱 내용 기준 y(− 31.333dp), frame px, 영상 색 hex.
  좌표는 영상 픽셀의 왼쪽 위 모서리라 가로 0.686dp · 세로 0.6875dp 단위로 움직인다. 소수 dp 를 잴 때는 배율을 1.4545(= 16/11, 영상 1px = 화면 1px) 이상으로.
- **측정 모드(`M`)** 에서 끌면 **자**(사각형)가 생겨 `x y w h` 를 dp 로 (frame px 도) 보여 준다 — 폭은 px ÷ 1.45803, 높이는 px × 0.6875 (비등방). `Esc` 로 지움.
- 상태 목록(shots.json)에서 고르면 그 상태의 `scenario` 로 백엔드를 리셋하고(뷰어 서버가 `<앱>/api/dev/reset` 으로 전달) 앱 URL·영상(video)·
  프레임(i0–i1 가운데)·ref 를 맞춘다.
- 불투명도(`↑`/`↓`), **차이 모드(`D`)**: 같으면 검게, 어긋난 곳만 밝게. `G` 10dp/50dp 격자(화면/앱 내용 기준, D1 눈금), `H` 십자선,
  `Space` 오버레이 숨기기. 오버레이는 클릭을 통과시키므로 겹친 채로 앱을 조작할 수 있다.

직접 만든 앱을 같은 방식으로 수치 비교하려면:
1. 개발자도구 기기 크기 **360 x 880, DPR 1.4545 (16/11)** 로 맞추고 `?frame=1` 구성(위 31dp · 셸 보정 transform · 아래 48dp)으로 찍는다 → 524x1280 PNG.
   (또는 `node tools/shot.cjs --url http://localhost:<내 포트>/... --name mine/home` 으로 바로)
2. `python3 tools/ref.py --name home/top-banner1 --video v1 --i0 '#365' --i1 '#388'` 로 같은 순간의 기준을 만든다.
3. `python3 tools/compare.py 내스크린샷.png tools/ref/home/top-banner1.png out/mine-home` → `edges.png` 와 요약의 (dx,dy) px/dp 를 본다.

## 기준 프레임 (ref.py)

```bash
python3 tools/ref.py --name <group>/<state> --video v1|v2 --i0 '#a' --i1 '#b' [--mask x,y,w,h] [--max-frames 90] [--strict]
python3 tools/ref.py --name <group>/<state> --video v2 --i '#2735'      # 한 프레임
python3 tools/ref.py --info --video v1 --i0 13.1 --i1 13.7               # 구간에 드는 원본 프레임만
python3 tools/ref.py --all [--only home/] [--force]                      # shots.json(+shots.d) 의 video·i0·i1
```
규칙 — 스펙 작업과 이 도구가 똑같이 만든다 (`woori_video.py` 머리말):
- 영상은 늘 **`*-clean.mp4`** (손잡이를 지운 것). 손잡이 자리는 마스크하지 않는다.
- 구간은 **원본 프레임 인덱스 i0..i1 (둘 다 포함)** 로 고른다. 초로 주면 i = 그 시각에 보이던 프레임 (pts ≤ t 인 마지막, VFR).
  초 단위 t1 의 뜻이 문서마다 달랐으므로(마지막 프레임 pts / 다음 변화 시작) 레지스트리는 늘 i0/i1 이다.
- 그림 = 그 프레임들(많으면 균등하게 `--max-frames` 장, 기본 90)의 **채널별 중앙값** (`woori_video.median_ref`). selftest 가 ref.py 출력이
  median_ref 와 화소까지 같은지 확인한다.
- **빠른 스크롤 직후 정지 구간의 첫 0.3–0.4초**(코덱이 화질을 끌어올리는 프레임)는 구간에서 뺀다. **스피너가 도는 구간은 마스크**한다.
- OS 화면 요소(메신저 알림 pill, 입출금 헤드업 알림, 런처, 시스템 키보드 비교 시)는 앱이 아니다 → 마스크.
- 보안 검은 화면(v1 2.841–7.395, 186.449–188.273 · v2 78.201–80.453)과 v1 0–1.748 런처는 기준으로 쓰지 않는다.
- 옆 `.json`: 영상·구간·pts·쓴 프레임 수·마스크·안정성(프레임마다 중앙값과 비교, 앱 뷰포트에서 24 넘게 차이 나는 픽셀이 0.3% 넘으면 경고).
  gen-from-spec 은 이 파일이 있으면 spec 구간과 같은지 보고 다르면 `--force` 로 다시 만들라고 알린다.

## 영상 구간 찾기 (scan.py)

```bash
python3 tools/scan.py --video v1 --json tools/out/scan/v1-segments.json --csv tools/out/scan/v1-frames.csv --contact tools/out/scan/v1-sheet.png
python3 tools/scan.py --video v2 --from 60 --to 75 --mask keyboard
```
원본 프레임마다 직전 프레임 대비 변화(앱 뷰포트 y 46–1209 의 %픽셀>24, bbox)를 계산해 HOLD(정지)/CHANGE(전환) 구간을 `#i0–#i1` 과 시각으로 출력하고,
`--contact` 면 정지 구간 가운데 프레임을 모은 접촉 시트를 만든다 (한 장씩 읽어 메모리를 적게 쓴다). 결과에는 실제 화면이 담기므로 tools/out 이나 스크래치에만 둔다.

## 생성기 (spec → 코드)

```bash
node tools/spec-to-dp.cjs                 # spec/*.json → spec/dp/*.json (D1 축별) + 자체 검사, --check 는 검사만 (npm run spec:dp)
node tools/gen-from-spec.cjs              # spec/*.assets.json → frontend/src/WooriArt.ts, WooriArtbox.ts (dp)
node tools/gen-from-spec.cjs --shots      # + tools/shots.json, spec/timeline.md 기준 구간 표 (같은 값) (npm run gen)
node tools/gen-from-spec.cjs --check      # 쓰지 않고 검사: 에셋 누락·크기, 생성 파일이 최신인지, 박스 dp = D1(frame px)
npm run check                             # 위 두 --check + check-dist 자체 검사 (빌드 없이)
```

**스펙 json** (하나 답지 spec/*.json 형식 + 상태 구간): 요소 좌표는 frame px(화면 절대) 그대로 적고, 요소마다 설계 dp 를 `"dp"` 로 함께 적는다.
```json
{ "group": "home", "route": "/home",
  "states": [
    { "id": "top-banner1", "video": "v1", "i0": 365, "i1": 388, "t0": 13.139, "t1": 13.614,
      "mask": ["228,594,68,68"], "refFrame": "tools/ref/home/top-banner1.png", "scenario": "v1-start", "route": "/home",
      "elements": [ { "name": "transfer-btn", "box": { "x": 28.735, "y": 1102.55, "w": 466.57, "h": 81.43 },
                      "dp": { "x": 20, "y": 726.667, "w": 320, "h": 56 }, "radius": 17.45, "font": { "sizePx": 21.8, "weight": 600 } } ] } ] }
```
- `dp` 는 **설계 dp** (정수/0.5 단위로 해석한 값, y 는 **앱 뷰포트 기준** = CSS top. 화면 기준으로 쓰려면 스펙이나 요소에 `"dpOrigin": "screen"`).
  spec-to-dp 가 box 를 D1 로 바꾼 값과 비교해 **0.5dp 넘게 다르면 실패**한다 (의도한 차이면 그 요소에 `"dpLoose": true`).
- spec-to-dp 는 숫자마다 키 이름으로 축을 정한다: 가로 위치(`x, left, right, x0, x1, cx, centerX, columnsX …`), 폭(`w, width, dx, translateX, paddingX, gapX …`),
  세로(`y, top, y0, cy, baselineY, h, height, dy, scrollTop, rowPitch …`), 방향 없는 길이(`r, radius, strokeWidth, borderWidth, fontSizePx, sizePx …`),
  배열 `box/inkBox/frameBox = [x,y,w,h]`, `inkExt/bbox = [x0,y0,x1,y1]`, `points = [[x,y],…]`, `samplesY = [t, y]`.
  그대로: 시간·프레임 번호(`i0, i1, t0, t1, durationMs …`)·굵기·em·불투명도·오차값·문자열(mask 등), `dp`·`keep` 아래 전부.
  **표에 없는 숫자 키는 경로와 함께 실패**한다 — 새 키는 `spec-to-dp.cjs` 표에 축과 함께 넣는다. 결과 y 는 화면 기준 dp (앱 안 y = y − 31.333).
- states 가 없는 json(tokens.json, banks.json 등)과 `*.assets.json` 은 건너뛴다.

**에셋 표** (`spec/<group>.assets.json`): `{ "name", "file": "woori/<그룹>/<이름>.png|svg", "frameBox": {x,y,w,h} 또는 [x,y,w,h] (frame px),
"state", "scale": 3, "notes", "usedIn": [{state, element, frameBox}], "color", "referenceOnly": "<이유>", "character": true }`.
PNG 는 frontend/public/woori/… 에 frame 박스 × scale 크기로 둔다. 이름 = `<그룹>.<name>`.
`"character": true` = 캐릭터(마스코트) 자리의 **독창적 대체 그림** — gen 이 그 박스(바깥으로 둥근)를 그 상태 shots 항목의 비교 마스크로 넣는다.
`WooriArtbox.ts`: `artBox(name)` / `artBoxIn(name, state, element?)` 는 앱 내용 기준(y − 31.333dp) dp style 을, `getArtRect` 는 화면 기준 dp 박스를,
`getArtFrameRect` 는 같은 박스의 frame px 를 준다 (도구용). 표의 `frame: [x,y,w,h]` 가 원본 frame px 박스다.
레이아웃 위치(top/left)는 그릴 때 정수 dp 로 반올림되므로 소수 dp 는 스펙의 설계 dp 로 맞춘다.

**shots.json 생성**: 상태마다 name `<group>/<id>`, url `<route>?frame=1&shot=<id>` (route = 상태 `route` > 스펙 `route` > 그룹 기본:
launch `/` · home `/home` · history·history-detail `/history` · send-a `/send` · send-b `/send/amount` · done `/send/done`), video·i0·i1·t0·t1,
mask(상태 mask + 캐릭터 박스, 이름 마스크는 값으로), scenario(위 규칙). refFrame 이 `<id>.png` 가 아닌 상태(다른 상태 ref 재사용)와
video·i0·i1 이 없는 상태는 넣지 않는다 (경고). `spec/timeline.md` 에 표시 줄이 있으면 그 사이를 기준 구간 표로 다시 쓴다:
```
<!-- gen-from-spec:shots-table -->
<!-- /gen-from-spec:shots-table -->
```
frontend/src 가 아직 없으면 TS 두 파일은 건너뛴다 (`--check` 도 그 줄은 SKIP).

## 서버 (serve.sh / stop.sh / dev-woori.cjs)

`bash tools/serve.sh [backend|frontend]` — 포트가 이미 응답하면 건드리지 않고, 아니면 `node_modules` 가 없을 때 `npm install` 후
백엔드 `WOORI_API_PORT=… WOORI_DB_PATH=… node server.js`, 프론트 `WOORI_WEB_PORT=… WOORI_API_PORT=… vite --port $WOORI_WEB_PORT --strictPort` 를
새 프로세스 그룹으로 띄우고 두 포트가 응답할 때까지 기다린다(기본 90초, `SERVE_TIMEOUT`). 2초가 지나도 PID 파일이 없거나 프로세스가 이미 끝났으면
기다리지 않고 로그 끝을 보여 주고 실패한다. `backend/`·`frontend/` 에 package.json 이 아직 없으면 그 쪽은 건너뛴다 (종료 코드 0).
서버 프로세스는 처음부터 표준 입출력이 로그 파일이라, 출력을 파이프로 받는 셸(`bash tools/serve.sh | cat`, CI, 에이전트 도구)에서도 바로 돌아온다.
`bash tools/stop.sh [backend|frontend]` 는 같은 env 의 PID 파일로 프로세스 그룹을 끄고, 남은 게 있으면 그 포트에서 듣는 프로세스만 정리한다
(리눅스 `fuser`, 없으면 `lsof -sTCP:LISTEN`).
`npm run dev:woori`(dev-woori.cjs, node 만 씀)는 OS 와 상관없이 같은 두 서버를 이 터미널 앞에서 띄운다 (Ctrl+C 종료, 하나가 죽으면 둘 다).
`node tools/dev-woori.cjs --install` 은 있는 패키지에만 npm install (npm run setup 이 부른다).

## 빌드 CSS 검사 (check-dist.cjs)

```bash
npm run build          # = frontend 빌드 && node tools/check-dist.cjs
npm run check:dist     # 이미 빌드한 frontend/dist 만 검사 (--src DIR --dist DIR 로 다른 트리, --selftest 는 자체 검사만)
```
하나원큐 답지 때 Vite 8 의 CSS 압축(lightningcss 1.33)이 이름 없는 animation 단축 속성(`animation: 10.28s linear infinite both`, 명세상 이름 none)을
`animation:none` 으로 줄여 길이·반복·채움을 지운 사고가 있었다 (dev 서버는 압축하지 않고 shot 도 dev 로 찍어서 프로덕션 빌드 녹화에서만 깨짐).
같은 스택이라 빌드 뒤 이 검사가 소스와 빌드를 따로 읽어 뜻을 비교한다 (lightningcss 는 압축하지 않아도 같은 `animation: none` 을 내므로 비교 기준은 자체 파서):
- 규칙마다 (@media 문맥, 선택자 하나) animation-*·transition-* 롱핸드 값 — 단축 속성은 명세 순서 규칙으로 풀고 시간 ms·곡선 정식형·목록 반복으로 맞춘다.
  var() 가 든 단축 속성은 글자로. 한쪽에만 있는 규칙·롱핸드도 어긋남.
- 빌드의 `animation:none`·`animation-name:none` 은 소스의 같은 규칙에 글자 그대로 있어야 한다 (reduced-motion 규칙 등).
- @keyframes (이름·오프셋·속성·값), @property (syntax·inherits·initial-value). 소스 CSS 가 빌드보다 새로우면 비교하지 않고 실패 (먼저 다시 빌드).
- 자체 검사(늘 먼저, `npm run check` 도 부름): 손으로 쓴 '압축 출력'(같은 뜻 통과 · 사고 규칙 `…__morph-layer{animation:none}` · 바꾼 트랜지션/키프레임/@property 를 잡음)은
  늘 돌고, frontend/node_modules(없으면 NODE_PATH)에 lightningcss 가 있으면 Vite 와 같은 옵션으로 실제 압축 출력도 확인한다 (없으면 그 묶음만 SKIP).
- frontend/ 가 아직 없으면 SKIP (종료 코드 0). 어긋나면 종료 코드 1 과 `선택자  롱핸드: 소스 값 (파일:줄) ≠ 빌드 값` 목록 → 소스를 압축기가 같은 뜻으로 옮기는 꼴(롱핸드)로 바꾼다.

## 자체 검증

```bash
node tools/selftest.cjs        # npm run selftest   (--no-browser · --no-video · --keep)
```
앱·스펙 없이 고정 표본으로 (지금 81개 검사, 약 40초):
1. **단위**: D1 식 = units.md 실측값(여백 20/16dp, 상태바 45.576, 내비 1210.182, 키보드 738.95 …), 왕복, ?frame=1 보정 값(kx·translate) 유도,
   compare.py/ref.py/scan.py/woori_video.py 상수 = woori-units.cjs, 시나리오 규칙과 backend/seed.js 이름·별칭.
2. **비교**: 합성 이미지(524x1280, 고정 난수)로 차이 0, (3,5)px = (2.06,3.44)dp (전역·띠·요소), 띠마다 다른 밀기 (−2,0)/(0,+4), 기본 마스크·`--no-default-mask`·이름 마스크.
3. **레지스트리 병합**: shots-lib.cjs 와 ref.py `--list` 가 같은 결과 (덮어쓰기·maskAdd·파일 이름순·추가·`_` 필드·url 없는 새 항목 오류), `--only` 규칙.
4. **생성기**: 가짜 스펙 1개(+ PNG/SVG 에셋)로 spec-to-dp 축별 변환 24개 값·`--check`·모르는 키·설계 dp 검사(dpLoose·dpOrigin),
   gen-from-spec shots(url·route·scenario 규칙·캐릭터 마스크·손으로 넣은 필드 유지·재사용/구간 없는 상태 제외)·WooriArt/WooriArtbox·timeline 표·`--check`
   (손으로 고친 TS·남는 public 파일·참고용 사용을 잡음), 빈 트리, 생성 TS 타입 검사(전역 typescript, 프론트 tsconfig 와 같은 엄격함), check-dist.
5. **브라우저** (포트 5299 시험 페이지, shot.cjs): ?frame=1 구성 → 524x1280, 경계·1dp 선·상자 가장자리가 D1 식 ±0.1px(상자 ±0.15px),
   boxes.json dp = 레이아웃 dp, 합성 이미지 1:1 차이 0, transform (3,5)px 밀기, `--t 500` CSS·WAAPI 50% 정지, `--freeze-after-steps`,
   늦은 READY(1.2초 뒤에 켜는 페이지를 READY 까지 기다렸다 찍음 — 판정 함수가 async 면 Playwright 가 바로 끝내 안 기다리던 것을 잡음), 리셋 순서(별칭 정규화),
   `--full` + shots.d(덮어쓰기·추가·maskAdd·이름 마스크)·noDefaultMask·`--only`·요약 합치기·빈 레지스트리.
6. **영상** (tools/ref/video/v1-clean.mp4 가 있을 때): ref.py 그림 = `median_ref`(화소까지), `median_ref_stack` = `median_ref`, `iter_frames` = `read_frames`,
   `--info`·`--all`, scan.py 짧은 구간. 이때 만든 그림(tools/ref/_selftest)은 실제 화면이라 끝나면 지운다 (`--keep` 이면 남김).

## 개인정보

영상에는 실명과 실제 계좌번호가 나온다. 원본 프레임이 담긴 파일(기준 프레임, 크롭, 비교 그림, 접촉 시트, 영상)은 `tools/ref`, `tools/out`(git 제외)이나
스크래치에만 둔다. 저장소에 들어가는 파일(스펙·shots·문서)에는 더미 이름·계좌만 쓴다. 이 도구들은 숫자(pts·구간·좌표)만 저장소 파일에 쓴다.
