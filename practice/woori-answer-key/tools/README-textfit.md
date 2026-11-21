# woori-textfit — 글자 맞춤 도구

기준 프레임(영상 중앙값 PNG, 524x1280 frame px)에서 **글자 한 줄의 잉크 상자와 문자열**을 받아, 같은 글자를 Chromium 으로 렌더해
`font-size`(0.25dp 단위) · `font-weight` · `letter-spacing` · 숫자 정렬(proportional/tabular) · 위치(`left`, line-height:1 일 때 `top`, 기준선)를 찾고
**fitError** 와 함께 JSON 으로 낸다. 스펙 작업(launch, home, history, history-detail, send-a, send-b, done)이 화면의 글자 크기·위치를 정할 때 쓴다.

- 글꼴: `frontend/public/fonts/woori-font.css` (Pretendard Variable, 앱과 같은 파일). 근거는 [spec/font.md](../spec/font.md).
- 단위: units.json (D1). 세로 1dp = 16/11 px, 가로 1dp = 1.45803 px (0.24% 비등방), 앱 뷰포트는 화면 31.333dp 아래부터.
- 실행: `NODE_PATH=/usr/local/lib/node_modules_global node tools/woori-textfit.cjs …` (Playwright Chromium). 글자 하나에 6–20초, CPU 1–2코어.

## 1. 빠른 사용

```bash
# 0) 기준 프레임 (clean 영상 중앙값, D2 규칙). 글꼴 표본은 tools/ref/font/ 에 있다 (git 제외 — 없으면 이렇게 만든다)
python3 tools/woori_video.py ref --video v1 --i0 '#1612' --i1 '#1627' --out tools/ref/font/hist.png

# 1) 잉크 상자(frame px, x,y,w,h)를 잰다: 글자 잉크가 닿는 가장 바깥 화소. 이웃 글자/아이콘이 들어가지 않게.
# 2) 맞춘다
NODE_PATH=/usr/local/lib/node_modules_global node tools/woori-textfit.cjs \
  --ref tools/ref/font/hist.png --box 198,71,126,23 --text 거래내역조회 --out tools/out/textfit/title.json
```

결과 요지 (`best` · `design` · `shot` · `place`, 약 7초):

```json
"best":   { "weight": 600, "fontSizeDp": 17, "letterSpacingEm": 0, "numeric": "proportional", "fitError": 0.2503, "advanceDp": 88.16, "leftDp": 135.95,
            "source": "design (video 경로로 찾은 값, fitError 는 shot 렌더 오차)", ... },
"design": { "fitError": 0.1014, "shotFitError": 0.2503, "rounded": {...}, "byWeight": {...}, ... },
"shot":   { "weight": 500, "fontSizeDp": 17.5, "letterSpacingEm": -0.025, "fitError": 0.197, ... },
"place":  { "css": { "position": "absolute", "left": 135.953125, "top": 18, "transform": "none", "fontSize": 17, "fontWeight": 600,
                     "letterSpacing": "0em", "lineHeight": 1, "fontVariantNumeric": "normal", "color": "#353536" },
            "fitError": 0.2503, "searchError": 0.2503, "baselineDpApp": 32, "baselineDpScreen": 63.333, "baselineFramePx": 92.12 }
```

→ 스펙에는 **17dp / 600 / 자간 0**, line-height:1 상자의 top = 앱 18dp(기준선 앱 32dp), 왼쪽 135.95dp 를 적는다
(가운데 정렬이면 135.95 + 88.16/2 = 180.03 ≈ 화면 가운데 180). 글자색은 tokens.md 의 `--woori-text`.

## 2. 두 렌더 경로 — 어떤 값을 스펙에 쓰나

| 경로 | 렌더 | 무엇과 같나 | 출력 |
|---|---|---|---|
| **design** (`--pipeline video`) | DSF 3 (1080 기기px)로 렌더 → 가로 1.45803 / 세로 16/11 px/dp 로 **면적 평균 축소** | 폰이 그리고 녹화가 줄인 경로 = 영상 | `design` |
| **shot** (`--pipeline shot`) | 뷰포트 360x880, **DSF 16/11**, 앱 셸 `translate(-0.2925px, 0.333px) scaleX(1.0023956)` 안 | 비교 도구(shot.cjs/compare.py)의 스크린샷 | `shot`, `place` |

기본(`--pipeline both`)은 둘 다 한다: design 으로 크기·굵기·자간을 찾고, **그 값으로** shot 경로에서 위치를 찾아(`place`) 그때의 shot 오차를 `best.fitError` 로 낸다.
shot 경로만의 최적값(`shot`)도 함께 낸다.

**규칙: 스펙의 CSS 값은 `best`(= design 값 + shot 위치)를 쓴다.** 이유:
- design 값은 거의 늘 둥근 값이다(17/600/0, 22/700/0, 25/500, 16/600/0, 15/600/0, 14/500/0). 원래 앱의 CSS 값이고, 같은 요소를 v1·v2 에서 재면 같은 값이 나온다(자체 검증 5절).
- shot 최적값은 DSF 16/11 의 작은 렌더에서 Chromium 이 글자를 약 10% 진하게 그리는 것을 크기·굵기·자간으로 메운 값이다(예: 17/600 → 17.5/500/−0.025em). 22dp 이상 큰 글자에서는 두 값이 같다.
- 차이의 값: design 값을 shot 으로 그리면 shot 최적보다 오차가 0–0.09 크다(22dp 이상·14dp 는 0, 15–17dp·25dp·흰 글자는 0.02–0.09: 예 [적용하기] 흰 글자 0.305 / 0.212, '6분 전' 0.315 / 0.241). 사용자는 영상을 자기 화면(DPR 1–2)에 겹쳐 보므로 실제 앱 값이 더 오래 맞는다. 비교 도구의 화면 전체 점수에서 글자 몇 줄의 이 차이는 작다.
- `design.rounded` 는 **`design` 과 같은 굵기·숫자 정렬**에서 크기 0.5dp·자간 0.01em 단위로 떨어지는 값 중 최선이다(도구가 최적 둘레의 둥근 값 — 크기 0.5dp 위/아래 × 자간 0.01em 위/아래·0 — 을 직접 렌더해 본다). `design` 과 다르면 두 오차를 보고 고른다(차이가 0.01 안이면 rounded).
  긴 문자열은 둥근 값보다 자간 +0.0025em 이 크게 나을 수 있다(예: '6자리 비밀번호를 입력해 주세요.' 15dp/500: 자간 0 → 0.189, +0.0025em → 0.118 — 18자에서 약 1px 차이). 그때는 `design`(= `best`) 값을 쓴다.

## 3. 출력 필드

| 필드 | 뜻 |
|---|---|
| `color.text` / `color.bg` | 렌더에 쓴 글자색(기본: 잉크 상자의 가장 진한 4% 평균 = 코어) / 배경(상자 바깥 고리의 중앙값) |
| `best` | 권장값. `weight`, `fontSizeDp`, `letterSpacingEm`/`Dp`, `numeric`, `fitError`(shot 렌더 오차), `inkScale`, `advanceDp`(글자 상자 폭 = 글자 advance 합, 끝 자간 포함), `leftDp`(앱 x), `topDpApprox`, `baselineOffsetDp`(line-height:1 상자 위끝 → 기준선, 레이아웃 값) |
| `design` | 폰 경로 최적값과 그 오차(`fitError`), `shotFitError`, `rounded`, 굵기별 최적(`byWeight` — "이 글자가 500 이냐 600 이냐" 볼 때), `alternatives` 상위 6 |
| `shot` | 스크린샷 경로 최적값 (참고) |
| `place.css` | ?frame=1 구조(위 31dp + 셸 transform)에서 **실제로 렌더해 확인한** CSS: `position:absolute; left; top(정수 dp); transform: translateY(…) 또는 none; line-height:1` |
| `place.fitError` / `searchError` | 셸 안에서 그 CSS 로 그린 오차 / 탐색 때 오차. 같아야 정상(다르면 `note`) |
| `place.baselineDpApp` / `baselineDpScreen` / `baselineFramePx` | 기준선 위치: 앱 dp / 화면 dp(+31.333) / frame px |
| `inkScale` | Σ(영상 잉크·렌더 잉크)/Σ(렌더 잉크²). 1 이면 진하기 같음. < 0.95 면 렌더가 진하다(굵기 한 단계 아래 확인), > 1.08 면 글자색이 옅게 잡혔을 수 있다 → `--color` |
| `warning` | 요청한 글꼴로 렌더되지 않았을 때 |

**fitError** = Σ|Y영상 − Y렌더| / Σ|Y영상 − Y배경| (비교 영역 = 잉크 상자 + margin, 휘도만. YUV 4:2:0 이라 색차는 쓰지 않는다).
0 이면 완전 일치. 같은 글꼴·같은 값: design 0.05–0.15, shot 0.11–0.32 (작고 얇은 글자, 회색 바탕 위 15dp 글자일수록 크다). 다른 글꼴이면 대개 0.2 이상.

## 4. 옵션

| 옵션 | 기본 | 설명 |
|---|---|---|
| `--ref PNG` | (필수) | 기준 프레임. 상대 경로는 현재 폴더, 없으면 저장소 기준 |
| `--box x,y,w,h` | (필수) | 잉크 상자 (frame px) |
| `--text 문자열` | (필수) | 화면에 보이는 그대로 (공백·기호 포함). 개인정보(이름·계좌)는 스펙 문서에 더미로 적되, **도구에는 영상에 보이는 글자**를 줘야 맞는다 — 그런 결과 JSON 은 tools/out(git 제외)에만 둔다 |
| `--weights` | `400,500,600,700` | 목록 또는 `300:800:50` |
| `--size` | 잉크 높이로 자동 ±10% | 고정 `17` 또는 범위 `16:19:0.25` |
| `--ls` | `-0.06:0.04:0.01` 후 ±0.005 다듬기 | 자간(em). 한 값만 주면 고정 |
| `--numeric` | `proportional` | `tabular` 또는 `both`(둘 다 보고 고름). 숫자가 들어간 글자는 `both` 권장 |
| `--color` / `--bg` | `auto` | `#rrggbb`. 얇은 글자(14dp 이하)는 tokens.md 의 색을 주면 굵기 판정이 정확해진다 |
| `--margin` | `4` | 비교 영역 = 상자 + margin. 이웃 글자가 가까우면 2 |
| `--mask x,y,w,h;…` | – | 비교에서 뺄 사각형 (frame px) |
| `--region x,y,w,h` | – | 비교 영역을 직접 지정 |
| `--pipeline` | `both` | `both` / `video`(design 만, 빠름, 위치 없음) / `shot` |
| `--family` / `--font-css` | `Pretendard Variable` / `frontend/public/fonts/woori-font.css` | 다른 글꼴 비교용 (spec/font.md 식별에 썼다) |
| `--no-place` | – | place 생략 |
| `--debug-png out.png` | – | 기준 \| 렌더 \| 차이(128=같음) 를 4배로 저장 — 눈으로 꼭 본다 |
| `--out file.json` / `--quiet` | – | JSON 저장 / 화면 출력 줄임 |
| `--batch samples.json` | – | `[{id,ref,box,text,…}]` 또는 `{"defaults":{…},"samples":[…]}`. 브라우저를 한 번만 띄운다 |
| `--selftest` | – | 5절 |

## 5. 위치 규칙 (Chromium, DSF 16/11 에서 잰 것)

- **세로: 글자 기준선은 기기 px 정수 행에 붙는다.** `top`·`translateY` 의 소수는 반올림되어 같은 행이 된다. 그래서 영상(폰은 1/3dp 단위)과 최대 0.5px 차이는 렌더러 한계다.
  `place` 는 top 을 정수 dp 로, 필요하면 `translateY(±0.25/0.5px)` 를 붙여 영상과 같은 행을 찾는다(같은 렌더면 translateY 없는 쪽).
- **가로: 글자마다 1/4 기기 px 로 양자화된다.** 글자 원점의 소수 위치가 바뀌면 뒤쪽 글자가 다른 1/4 칸으로 넘어가므로, 도구는 원점을 1/16 px 간격으로 바꿔 보고 `left` 를 소수 그대로(0.0001dp) 낸다.
  스펙에 정수 dp 로 반올림해 적으면 렌더가 조금 바뀐다(대개 오차 +0.01–0.03).
- `left`/`top` 은 **앱 좌표(dp)** 다: 셸 안 절대 위치. 화면 y(dp) = 앱 y + 31.333, frame px = 화면 dp × 16/11. 가로 frame px = 262.02 + 1.45803·(x − 180).
- 가운데/오른쪽 정렬 글자는 `left + advanceDp/2` / `left + advanceDp` 를 쓴다(advance 는 끝 자간 포함).
- flex·padding 으로 놓는 글자는 `baselineDpApp`(또는 line-height:1 상자의 top)에 맞춰 여백을 정한다. line-height 가 1 이 아니면 반(half-leading)만큼 상자 위끝이 위로 간다.

## 6. 함정

1. **한 줄이 여러 요소로 나뉜 경우**: '11월 21일 · 11:02:40' 처럼 가운데 점·간격이 따로 놓인 줄은 한 문자열로 맞추면 오차가 크다(0.33). 덩어리마다 따로 잰다(날짜 0.147, 시각 0.151).
2. **숫자 정렬**: 대부분 proportional. 거래 상세 값 열은 tabular(spec/font.md 5절). 숫자가 있으면 `--numeric both`.
3. **잉크 상자에 이웃이 들어감**: 아이콘·밑줄·다른 글자가 상자나 margin 에 들어가면 오차가 커지고 크기가 틀린다. `--margin 2`, `--mask`.
4. **흰 글자·색 배경**: 자동으로 처리된다(코어 = 가장 밝은 쪽). 딤 위 글자는 딤 낀 배경색이 그대로 `bg` 가 된다.
5. **얇은 글자 색**: 코어가 옅게 잡혀 굵기가 한 단계 굵게 나올 수 있다. `inkScale` 이 1.08 보다 크면 `--color`(tokens.md) 로 다시.
6. 결과는 반드시 `--debug-png` 로 눈으로 본다. 글자 하나가 다르면(오독) 오차가 0.3 이상으로 튄다.
7. 스피너·알림이 겹친 프레임은 피하거나 `--mask`.

## 7. 자체 검증 (`--selftest`)

`node tools/woori-textfit.cjs --selftest` — 기준 프레임이 없으면 `woori_video.py ref` 로 만든다. 결과 `tools/out/textfit/selftest.json`.

- **합성 3개**: 알려진 CSS(굵기·크기·자간·숫자·left·top)로 ?frame=1 구조에 그려 찍은 그림을 shot 경로로 맞춰 **값이 그대로 나오는지**(오차 < 0.01, top 같음, left ±0.2dp) 본다 — 도구 자체 검사.
- **영상 14개**: 두 영상·7개 화면의 글자. 기대 굵기·크기(±0.25dp), 셸 안 렌더 = 탐색 렌더(±0.002), design 오차 < 0.2, 같은 요소의 v1·v2 결과가 같은지(크기·굵기·top·left).

결과 (2026-11-21, 17개 모두 통과):

| 표본 | 기준 프레임 | 기대 | design (굵기/크기/자간, 오차) | shot 오차: design 값 / shot 최적 (그 값) | place (top, left dp) |
|---|---|---|---|---|---|
| 합성 거래내역조회 | 합성 | 600/17/0, top 18, left 135.75 | – | **0** (600/17/0) | 18, 135.73 (같은 렌더) |
| 합성 345원 | 합성 | 700/25/−0.01, top 260, left 220.5 | – | **0** (700/25/−0.01) | 260, 220.47 |
| 합성 2026.11.21 (tabular) | 합성 | 500/14/0 tabular, top 455, left 113 | – | **0** (500/14/0 tabular) | 455, 113 |
| 거래내역조회 v1 | v1 #1612–#1627 | 600/17 | 600/17/0, 0.101 | 0.250 / 0.197 (500/17.5/−0.025) | 18, 135.95 |
| 거래내역조회 v2 | v2 #205–#211 | 600/17, = v1 | 600/17/0, 0.087 | 0.242 / 0.188 | 18, 135.95 (v1 과 같음) |
| 어디로 이체하시겠어요? v1 | v1 #6952–#6960 | 700/22 | 700/22/0, 0.073 | 0.105 / 0.105 (같은 값) | 72, 20.03 |
| 어디로 이체하시겠어요? v2 | v2 #2588–#2594 | 700/22, = v1 | 700/22/0, 0.072 | 0.104 / 0.104 | 72, 20.03 (v1 과 같음) |
| 금융회사를 선택해 주세요 | v2 #2772–#2773 | 700/22 | 700/22/0, 0.075 | 0.109 / 0.109 | 72, 20.02 |
| 오늘 같은 내용으로 보냈어요! | v1 #7116–#7132 | 600/22 | 600/22/0, 0.081 | 0.112 / 0.112 | 532, 54.86 |
| 키패드 4 v2 | v2 #2879–#2882 | 500/25 | 500/25, 0.058 | 0.152 / 0.130 (500/25.25) | 573, 51.83 |
| 키패드 4 v1 | v1 #7031–#7033 | 500/25, = v2 | 500/25, 0.053 | 0.145 / 0.124 | 573, 51.83 (v2 와 같음) |
| 345원 (거래내역 잔액) | v1 #1612–#1627 | 700/25 | 700/25/0, 0.079 | 0.175 / 0.125 (700/24.5/+0.0125) | 179, 270.38 |
| 2026.08.21 ~ 2026.11.21 | v1 #1612–#1627 | 600/15 | 600/15/0, 0.144 | 0.276 / 0.239 (600/15.25/−0.0075) | 427, 19.92 |
| 2026.11.21 (최근입금계좌) | v1 #6952–#6960 | 500/14 | 500/14/0, 0.151 | 0.179 / 0.179 | 308, 134.52 |
| 이체 (흰 글자/파랑) | v1 #1612–#1627 | 600/17 | 600/17/−0.0025, 0.106 | 0.173 / 0.156 (600/16.75/+0.005) | 277, 247.39 |
| 빌려준 돈, 차용증은 쓰셨나요? | v1 #7458–#7483 | 600/16 | 600/16/0, 0.080 | 0.143 / 0.142 | 581, 44.00 |
| 2026.11.20 (거래 상세, both) | v1 #6038–#6048 | tabular | 500/14.75/−0.025 **tabular**, 0.113 | 0.167 / 0.167 | 235, 198.33 |

읽는 법:
- 합성 3개가 오차 0 으로 원래 값(굵기·크기·자간·숫자·top)을 되찾는다 → 탐색·위치 규칙(1/64dp 위치 격자, 1/4px 글자 양자화, 정수 행 기준선)이 Chromium 과 맞다. left 의 0.02–0.03dp 차이는 같은 렌더(오차 0)다.
- 같은 요소를 두 영상에서 재면 크기·굵기·top·left 가 같다. 모든 표본에서 셸 안 렌더 오차 = 탐색 오차(±0.002).
- left 값이 20.02–20.03(좌우 여백 20dp), 135.95 + 88.16/2 ≈ 180(가운데), 44.00(카드 안 24dp + 카드 20dp) 처럼 레이아웃 값으로 떨어진다 → 가로 비등방 보정(scaleX 1.0023956)이 맞다.
- design 값을 shot 으로 그리면 22dp 이상·14dp 는 shot 최적과 같고, 15–17dp·25dp 는 0.02–0.05 크다(2절). 회색 바탕(surface) 위 15dp 회색 글자는 0.08–0.09 까지 크다(재검증 '이체금액' 0.313 / 0.222, '수수료' 0.258 / 0.179) — 대부분 세로 0.45px 행 차이다.
- 독립 재검증(critic-font): 새 표본 6개(두 영상, 14–25dp, 500/600/700)의 `place.css` 를 앱과 같은 구조의 별도 페이지(spec/font.md 8절 전역 CSS, http 로 글꼴 로드)에 그려 기준과 겹치면 최적 이동량이 가로 ≤ 0.05px, 세로 ≤ 0.45px 였다(spec/font.md 10절).
