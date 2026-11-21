# 우리WON뱅킹 답지 — 프론트엔드

Vite 8 + React 19 + TypeScript 6 + react-router-dom 7 + ESLint 9 (하나원큐 답지 `answer-key/frontend` 와 같은 구성·버전, 코드는 복사해서 고쳤다 — import 없음).
화면은 **dp(= CSS px)** 로 만든다. 폰 화면 **360 x 880dp** (1080x2640 기기px, 밀도 3.0), 앱 뷰포트(웹뷰) **31.333–832dp, 높이 800.667dp**.

지금은 **뼈대**다: 프레임·셸·페이지 스택·전환·공용 부품(스피너·시트·로딩 페이지·API·테마)과 화면 자리표시(`Woori<Screen>.tsx`).
화면 내용은 화면별 작업이 스펙(`spec/<group>.md·json`)을 보고 채운다 (아래 '화면 작업이 할 일').

## 실행

```bash
npm install
npm run dev        # http://localhost:5273 (strictPort, host 공개). /api → http://localhost:4100 프록시
npm run typecheck  # tsc -b — tsconfig.app.json(src, 브라우저) + tsconfig.node.json(vite.config.ts). 맨 `tsc --noEmit` 은 0 개 파일을 보고 통과하니 쓰지 말 것
npm run lint       # ESLint 9 (typescript-eslint + react-hooks(React Compiler 규칙) + react-refresh)
npm run lint:fix
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 (4273, /api 프록시 동일)
```

루트(`woori-answer-key/`)에서는 `npm run dev:woori`(백엔드 4100 + 이 Vite 5273), `npm run build`(이 빌드 + `tools/check-dist.cjs`),
`npm run lint`(이 lint + 백엔드·도구 문법), `npm run check`, `npm run selftest` 를 쓴다 (tools/README.md).

| 변수 | 기본 | 뜻 |
|---|---|---|
| `WOORI_WEB_PORT` | 5273 | 이 Vite 서버 (사용 중이면 실패) |
| `WOORI_API_PORT` | 4100 | 백엔드. `/api` 프록시 대상 (vite.config.ts) |

```bash
WOORI_WEB_PORT=5291 WOORI_API_PORT=4191 WOORI_DB_PATH=/tmp/w.db bash ../tools/serve.sh   # 백엔드+Vite 한 쌍
WOORI_WEB_PORT=5291 WOORI_API_PORT=4191 bash ../tools/stop.sh
```

`src/` 는 브라우저 코드다 (Node 타입 없음): `process.env`·`Buffer` 를 쓰면 `tsc -b` 가 잡는다. 환경 값은 `import.meta.env.VITE_*`.
TypeScript 는 6.0 (typescript-eslint 8 이 6.0 까지 지원).

CSS 애니메이션은 이름 있는 단축 속성이나 **롱핸드**로 쓴다. 이름 없는 단축 속성(`animation: 1s linear infinite both` + `animation-name` 따로)은
프로덕션 CSS 압축(lightningcss)이 `animation:none` 으로 바꿔 빌드에서만 사라진다 (하나 답지 사고). `var()` 가 든 animation 단축 속성도 피하고 롱핸드로 쓴다.
루트 `npm run build` 가 `tools/check-dist.cjs` 로 소스·빌드의 애니메이션 뜻을 비교한다.

## 파일 (src/ 평면 구조, 모두 Woori 접두사)

| 파일 | 내용 |
|---|---|
| `main.tsx` | 진입점: 프레임 모드·테마·shot 모드 초기화, `window.wooriDebug`, 렌더 |
| `App.tsx` | 라우트 표 + 페이지 레이어(스택) + 프레임(스페이서·셸) |
| `WooriNav.ts` | 이동 방식(전환) 상수 `WOORI_MOTION`, 페이지 스택, `useWooriNavigate`·`useBackTo`·`useArrivedByPop`·`useWooriLayer`, `readShot`·`isFrameMode` |
| `WooriShot.ts` | `?shot=` 약속: `useShotState`(화면별 등록) · `useShotReady`/`markShotReady`(→ `__WOORI_READY__`) |
| `WooriTheme.ts` | 토큰(spec/tokens.json → `--woori-*`), 라이트/다크, 프레임 띠 색 `useWooriBands` |
| `WooriLayout.ts` | 렌더 규칙 도우미: 스크롤 컨테이너 기기 화소 맞춤(`useWooriScrollFix`·`wooriScrollTo`), `wooriPlace`, `WOORI_BOTTOM_FIX`, 키가 다른 화면의 아래끝 기준 자리 `wooriBottomTop`·`wooriPlaceBottom` (아래 렌더 규칙 7) |
| `WooriSpinner.tsx` | 남색·하늘색 원호 스피너 (영상 원호 표본 키프레임) |
| `WooriSheet.tsx` | 딤 + 아래에서 올라오는 시트 (`sheet`·`popup`), `WooriOverlay`(겹침 자리 포털) |
| `WooriLoadingPage.tsx` | 흰 페이지 + 스피너 (`WooriLoadingPage`), 단계 시계 `useWooriStages` |
| `WooriApi.ts` | 백엔드 타입 클라이언트 `wooriApi` (backend/README.md 'API') |
| `WooriArt.ts`·`WooriArtbox.ts` | **생성물** (`node tools/gen-from-spec.cjs`) — 에셋 표·영상 박스(dp). 손으로 고치지 않는다 |
| `woori.css` | 전역 스타일 + 뼈대(프레임·셸·레이어·전환·베일·스피너·시트·로딩 페이지) |
| `Woori<Screen>.tsx` | 화면 자리표시 (아래 라우트 표). `WooriPlaceholder.tsx` 를 쓴다 |
| `WooriDevFrame.tsx` | `/dev/frame` 뼈대 확인 화면 (기하·스크롤·스피너·시트 shot) |
| `WooriEnv.ts` | 빌드·실행 플래그: `WOORI_LOCAL`(로컬 빌드) · `wooriIsNative()`(APK 안) · `wooriUsesSystemKeyboard()` · `WOORI_BACK_EVENT`(폰 뒤로 버튼) + 실제 앱 몫(프레임·shot 모드에서는 아무것도 안 함): 뒤로 처리 스택 `useWooriBack` · 토스트 `wooriToast`/`wooriTodo` · 복사 `wooriCopy`(클립보드 + 토스트) · 화면 맞춤 `installWooriFit` (확대·축소, 레이아웃 높이 640dp 바닥 — 아래 'APK') |
| `WooriLocal.ts` · `WooriLocalMenu.tsx`(+`.css`) · `WooriLocalExpress.cjs` · `WooriLocalCors.cjs` · `WooriLocalModules.d.ts` · `WooriLocalExpress.d.cts` | **로컬 모드**(서버 없는 APK) — 아래 'APK' |

화면 CSS 는 `woori-<그룹>.css` (`.woori-<그룹>__…` BEM), 에셋은 `public/woori/<그룹>/`, 글꼴은 `public/fonts/` (글꼴 작업 소관 — 고치지 않는다).

## 단위: dp 와 영상 frame px (D1)

영상은 524 x 1280 frame px, **가로·세로 배율이 다르다** (1단계 units.json, `tools/woori-units.cjs`):

| | dp → frame px | frame px → dp |
|---|---|---|
| 가로 위치 | `x_px = 262.02 + 1.45803·(x_dp − 180)` | `x_dp = 180 + (x_px − 262.02) / 1.45803` |
| 폭 | `w_px = 1.45803·w_dp` | `w_dp = w_px / 1.45803` |
| 세로 위치 (화면 위끝 기준) | `y_px = 16/11·y_dp` | `y_dp = 0.6875·y_px` (앱 안 y = y_dp − 31.333) |
| 높이·방향 없는 길이 | `× 16/11` | `× 0.6875` |

- `spec/*.json` 은 frame px(화면 절대), `spec/dp/*.json` 이 D1 로 바꾼 dp(화면 기준 y). 스펙 요소의 `"dp"` 는 **설계 dp**(앱 뷰포트 기준 y = CSS top) — 그 값을 쓴다.
- 세로 띠: 상태바 0–31.333dp (45.576px) · 앱 뷰포트 31.333–832dp · 3버튼 내비 바 832–880dp (48dp, 1210.182px~).
- 자주 쓰는 값: 좌우 여백 20dp = x 28.735 / 495.305px, 16dp = 22.903 / 501.137px. 하단 큰 버튼(bottom 18·높이 56) = y 1102.55–1184.0px.

## 약속 (tools/shot.cjs · viewer 와)

| 약속 | 내용 |
|---|---|
| `?frame=1` | 위 31dp 스페이서 + 앱 셸(360 x 800.667dp, `transform: translate(-0.2925px, 0.333px) scaleX(1.0023956)`) + 아래 48dp 스페이서. 뷰포트 360x880 을 DSF 16/11 로 찍으면 524x1280 = 영상 1:1. 세션 동안 유지(`sessionStorage 'woori.frame'`), `?frame=0` 으로 끔. 실제 앱(프레임 아님)에서는 셸이 화면을 채운다 (레이아웃 폭은 늘 360dp — 360dp 가 아닌 화면·640dp 보다 낮은 화면은 `installWooriFit` 이 셸을 확대·축소: 폰은 폭을 꽉, 태블릿·키 작은 화면은 폰 비율 기둥, 양옆 #e9ebee. 레이아웃 높이 640dp 바닥. 아래 'APK' 화면 맞춤) |
| `?shot=<상태 id>` | 화면이 등록한 shot 상태를 바로 그린다 (`useShotState`). 준비되면 글꼴(`fonts.ready` + `fonts.load`) → `<img>` decode → 2 프레임 뒤 `window.__WOORI_READY__ = true`. 모르는 id 면 `console.error` + READY 안 켬 (shot.cjs 가 15초 뒤 'READY 없음') |
| `?theme=light\|dark\|auto` | 테마 (`sessionStorage 'woori.theme'`). 다크는 지금 구조만 (토큰 덮어쓰기 표가 비어 있음) |
| 애니메이션 | **CSS 애니메이션/트랜지션 또는 WAAPI 만** (shot.cjs `--t` 가 `document.getAnimations()` 로 멈춘다). shot 모드(`html[data-shot]`)에서 CSS 트랜지션은 0s, 캐럿 숨김, 스피너는 0 위상 정지(`--woori-spinner-shot-delay`) |
| 중간 위상 shot | 화면이 위상을 직접 고를 때는 `pause()` 대신 `playbackRate = 0` (Playwright `animations:'disabled'` 가 멈춘 유한 애니메이션을 끝으로 보낸다) |
| `data-ref="이름"` | (선택) 영상 대비 요소별 (dx,dy) — boxes.json |
| 백엔드 시나리오 | shot.cjs·뷰어가 찍기 전에 `POST /api/dev/reset {scenario}` (`v1-start`·`v2-start`·`v2-end`) |
| `window.wooriDebug` | 도구용: `navigate(to, transition, {replace})` · `shots()`(화면별 등록 id) · `bands()` · `theme()`/`setThemeOverride` · `markShotReady` · `motion` · `tokenSource` |

## 렌더 규칙 (?frame=1, DSF 16/11 스크린샷)

`/dev/frame?frame=1&shot=geometry|nested|scrolled|bottom` 을 `tools/shot.cjs` 로 찍어 선·상자 가장자리를 D1 식과 비교해 확인한 규칙이다
(측정: selftest 의 ?frame=1 측정 코드와 같다. 아래 '검증').

1. **레이아웃 위치(top/left/width/height)는 그리기 전에 절대 좌표 기준 정수 dp 로 반올림되고, transform 은 반올림되지 않는다** (units.md 6.2절).
   셸은 레이아웃 위치가 (0, 31) 정수이고 소수(0.333 · 가로 보정)는 transform 이라, 셸 안의 정수 dp 위치는 정확히 D1 자리에 그려진다 (선 ±0.08px, 상자 ±0.003px).
   - 소수 dp 위치는 `wooriPlace(x, y)` — 정수 left/top + 소수는 `translate` 속성 (예: `wooriPlace(20.5, 100.25)` → 실측 29.463/191.392px, 기대 29.464/191.394).
   - 부모 상자의 소수 위치도 같이 반올림된다 → 부모도 정수 dp 로.
2. **아래에 붙는 상자**: 앱 뷰포트가 800.667dp 라 `bottom + height` 가 정수인 상자의 위끝은 x.667 이 되어 0.333dp(0.48px) **아래로** 반올림된다
   (bottom 18 · 높이 56 → 1103.03px, 영상 1102.55px). style 에 `...WOORI_BOTTOM_FIX` (`translate: 0 var(--woori-bottom-fix)`, 프레임 모드 −0.333px)
   → 1102.545 / 1184.0px. `bottom + height` 가 정수가 아니면(위끝이 정수 dp) 쓰지 않는다. 시트 패널도 마찬가지 (`<WooriSheet style={…}>`).
3. **스크롤 컨테이너 — 기기 화소 반올림**: Chromium 은 스크롤 컨테이너 안 내용의 화면 위치(컨테이너 원점 − 스크롤 위치)를 **정수 기기 화소로 반올림**한다
   (합성 스크롤이거나, 스크롤 위치가 0 이 아니거나, `overscroll-behavior: contain` 이면). DSF 16/11 에서 기기 화소 = 영상 frame px 이고 셸 원점은
   기기 (−0.4255, 45.5753)px 라서, 그대로 두면 **페이지 안의 모든 것이 (+0.43, +0.42)px 밀린다** (실측 — 셸 바로 아래에 그리면 정확, 스크롤 컨테이너 안이면 밀림).
   - 페이지 스크롤 컨테이너(`.woori-layer__scroll`)는 woori.css 가 맞춘다: 컨테이너를 (+0.2918, +0.2920)dp 옮겨 원점을 정수 기기 화소 (0, 46) 에 두고,
     안쪽 내용 상자(`.woori-layer__content`)를 같은 만큼 되돌린다 → 반올림이 있든 없든 내용이 D1 자리 (geometry: 전부 ±0.08px).
     잃는 것: 컨테이너 위끝이 46px 이라 화면 45 행(상태바 마스크 안) 의 앱 몫 0.42px 는 페이지 바탕으로 그려진다.
   - **스크롤 위치**도 기기 화소(11/16dp) 단위로 저장된다 (scrollTop 을 읽으면 CSS px 로 반올림된 값이 나와 믿을 수 없다).
     shot 에서 스크롤 위치를 놓을 때는 `wooriScrollTo(컨테이너, dp)` — 가장 가까운 기기 화소 배수로 두고 나머지는 `--woori-scroll-residual` 로 내용 상자가 옮긴다
     (scrolled: 100dp → 99.6875 + 0.3125, 전부 ±0.08px. 그냥 `scrollTop = 100` 이면 +0.45px). 사용자가 스크롤하면 나머지를 지운다.
   - **화면 안의 스크롤 컨테이너**(가로 배너, 자기 목록 스크롤 등)는 `useWooriScrollFix(ref)` + 클래스 `woori-scroll-fix` / 안쪽 `woori-scroll-fix__content`
     (nested: 맞춤 없이 +0.43/−0.12px → 맞춤 뒤 전부 ±0.08px). 원점을 재서 같은 방식으로 맞추고, 크기·조상 스크롤이 바뀌면 다시 잰다.
   - 손으로 하는 스크롤·녹화 재생 중에는 매 프레임 최대 ±0.5px 흔들릴 수 있다 (정지 화면 비교만 정확하면 된다).
4. **`position: fixed` 를 쓰지 않는다**: 페이지 내용 상자에 transform 이 있어 fixed 가 내용 상자 기준이 되고 내용과 같이 스크롤된다.
   스크롤과 상관없이 고정된 헤더·하단 버튼은 (a) 화면 루트를 `height: 100%` 로 두고 자기 스크롤 영역(`useWooriScrollFix`) 밖에 `position: absolute`,
   또는 (b) `WooriOverlay` 로 레이어 겹침 자리에 그린다. html/body 에 transform 을 걸지 않는다 (units.md 6.2절 5).
5. 셸·페이지 상자는 `overflow: clip` (스크롤 컨테이너가 아니라 포커스·scrollIntoView 가 몰래 스크롤하지 못한다).
6. 1dp 선은 1.4545px 잉크(2~3행에 나뉨). 선 중심 = (top + 0.5)·16/11. 글자 크기·위치는 `tools/woori-textfit.cjs` 로 맞춘다 (spec/font.md).
7. **키가 다른 화면 (APK)**: 실제 폰 웹뷰는 상태바·내비 바를 뺀 높이라 셸이 대개 640–780dp 다 (영상 800.667, 화면 맞춤이 640 아래로는 내리지 않는다).
   영상에서 아래쪽에 붙어 있던 것(키패드·[확인]·[이체]·아래 단추 줄)은 **아래끝 기준**으로 놓는다: `top: calc(var(--woori-page-h) - (800.667 − y)px)`
   (`wooriBottomTop(y)` · `wooriPlaceBottom(x, y)`, CSS 는 같은 식). `--woori-page-h` = 실제 앱 `100%` · 프레임 모드 `800.667px` → 프레임 모드에서는 `top: y` 와
   같은 값이라 영상 비교 화소가 그대로다. 담는 상자가 페이지 높이인 절대 위치 상자에만 쓴다.
   키 작은 폰에서만 넘치는 목록·내용은 **실제 앱에서만** 자기 스크롤 상자로 (`:root:not([data-frame='1'])` 또는 `useWooriScrollFix` 로 프레임 화소가 같음을 확인) —
   보기: 이체 최근입금계좌 행 목록, 금융회사 그리드, 이체 완료 위 내용, 거래 상세, 계좌번호 페이지(시스템 키보드로 셸이 400dp 아래면 페이지 높이 바닥 400dp → 레이어 스크롤).

## 라우트와 페이지 전환 (WooriNav)

| 경로 | 화면 (자리표시) | 그룹 · 메모 |
|---|---|---|
| `/` | `WooriSplash` | launch — 스플래시 → `/cert`. 키가 다른 화면: 로고 묶음은 셸 가운데, iF·MA·우리은행 글자는 셸 아래끝 기준 (프레임 모드 영상 그대로) |
| `/cert` | `WooriCert` | launch — 우리WON인증서 6자리 (키패드는 영상에 없음 → 설계). 키패드·[다른 방법으로 로그인] 아래끝 기준 |
| `/home` | `WooriHome` | home. 설계(실제 앱만): 계좌번호 복사 = 클립보드(`wooriCopy`, '우리은행 1002-…' — 은행 이름 + 번호, 거래내역과 같은 글자), ⋮ = 토스트, 첫 진입 팝업 '오늘은 그만 보기' = 서울 날짜 바뀔 때까지 안 띄움(`localStorage 'woori.popup.home'`), 로그인 첫 진입은 늘 맨 위·배너 1(이전 `woori.home.cache` 무시), 계좌 탭 스피너 동안 다른 누름 무시, 오버레이 스크롤바는 잰 스크롤 상자 높이로, 돌아올 때 되돌린 스크롤 위치에는 스크롤바를 띄우지 않음(손가락 스크롤만) |
| `/notice` | `WooriNotice` | 설계 — 홈 머리 종에서 연다. 알림 목록 + 편집(여러 개 골라 삭제), 읽음·지움은 `localStorage 'woori.notice.v1'` (실제 앱만, 시나리오 되돌리기가 지움). 제목·본문은 낱말 안에서 줄을 바꾸지 않는다(`keep-all`) |
| `/history?type=all\|in\|out&period=3m` | `WooriHistory` | history — 조회조건 시트는 화면 상태 (같은 페이지 안 이동은 인스턴스 유지). 조회기간 이번달·3개월·6개월·1년·직접입력(type=date 시작일·종료일), 상세조건조회 ⌄ = 정렬 최신순·과거순, [초기화] = 3개월·전체·최신순 (영상은 3개월·최신순뿐 — 나머지 설계값, 기본 모양은 영상 그대로). URL `period`·`order`·`from`·`to` 도 읽는다. 직접입력 날짜는 오늘까지. 계좌번호 복사 = `wooriCopy`('우리은행 1002-…', 홈과 같은 글자). 실제 앱만: 문서 높이는 내용 끝까지(빈·짧은 목록은 흰 칸으로 스크롤되지 않음 — 프레임·shot 은 800.667 바닥 그대로), 긴 이름(통장표기)은 200dp 에서 말줄임. ‹·[이체] 대기 중에 행·조회조건을 누르면 기다리던 이동은 취소(마지막 누름이 이긴다) |
| `/history/:txId` | `WooriHistoryDetail` | history-detail — 목록 위 오버레이: `rise` 로 열면 목록이 아래에 마운트된 채 남고, 뒤로(`sink`) 하면 같은 인스턴스·스크롤로 드러난다. 아래 단추 줄은 아래끝 기준, 내용은 셸 높이에 맞춰 스크롤. 실제 앱만: 긴 제목(320dp)·검색 줄의 이름(› 와 '검색하기' 가 보이게)·받는 분 통장표기 값은 말줄임 |
| `/send` | `WooriSend` | send-a — 어디로 이체하시겠어요? 설계(실제 앱만): **편집** → 그 자리 편집 모드('완료' 파랑, 행 ☆ 자리에 [삭제] 알약 → 바로 `DELETE /api/recipients/:id`, 자주 탭에서는 자주에서 빼기, 완료·‹·폰 뒤로·탭 바꿈·입력 줄 탭이 편집부터 끝냄, 다 지우면 저절로 끝 · 줄을 빼는 누름([삭제]·자주 탭 ☆ 끔)은 350ms 안 연타를 한 번만 받음 · 저장 실패 = 토스트 + 그 줄을 제자리로 되돌리고 다시 불러옴(다시 불러오기도 실패하면 지금 행 유지) · 읽어 주기: [삭제]·☆ 라벨에 이름·은행·계좌번호, 자주 탭 [삭제] = '자주 쓰는 계좌에서 빼기', 편집 중 행 단추는 disabled) · **☆** = 즐겨찾기(`POST …/favorite`, 채운 별 `--woori-primary`, 자주 탭 = 즐겨찾기한 계좌) · 내계좌 탭은 ☆·편집 없음, 출금계좌 줄 탭 = 토스트 · 탭별 머리말·빈 목록 안내 · 행 목록은 자기 스크롤 상자 · 행 탭 스피너 동안 다른 누름 무시, ‹·폰 뒤로는 기다리던 이동 취소 · 카메라·＋연락처 = 토스트. 최근입금계좌 줄을 지우면 자주에서도 빠진다(같은 행). 시나리오 되돌리기가 삭제·즐겨찾기를 되돌린다 |
| `/send/account` | `WooriSendAccount` | send-a — `push` + 아래 페이지 흰 베일. 설계: 조회 중 ✕·폰 뒤로 = 조회를 버리고 닫기, 계좌번호 16자리까지(백엔드 6–16, 영상은 13자리에서 멈춤) · 조회 오류 글자: 번호 탓(400 `INVALID_ACCOUNT_NUMBER` — 6자리 미만·빈 값·형식, 404 없는 계좌) = '계좌번호를 다시 확인해 주세요', 그 밖 = '잠시 후 다시 시도해 주세요' · 시스템 키보드로 셸이 400dp 보다 낮으면(실제 앱만) 페이지 높이 바닥 400dp — [확인](top 328 이상)이 추천 칩·오류 글자를 덮지 않고 페이지 스크롤로 닿는다 |
| `/send/account/bank` | `WooriSendBank` | send-a — `push` (바텀시트 아님). 고르면 `go(-1)` instant. 그리드는 실제 앱에서 탭 아래 자기 스크롤(설계 — 프레임 모드는 영상처럼 스크롤 없음) |
| `/send/amount` | `WooriSendAmount` | send-b — 중복 경고·비밀번호 시트는 화면 상태. 키패드·폼 단추 층 아래끝 기준(`.woori-amt__layer--bottom`), 셸이 낮으면 키패드를 눌러 담는다(keypadSqueeze). 설계: 금액 줄 탭 = 키패드로, 통장표기 › = 편집 시트(10자, 코드 포인트 — 시스템 키보드가 떠도 뒤 폼은 키보드 전 높이 기준 자리, 값은 실제 앱에서 말줄임), 오류 = 안내 시트(`WooriSendAlert`, 네이티브 alert 아님), 없는 `?to=` = 토스트 + `/send`. 확인 화면에서 뒤로 = 채운 폼(금액·통장표기, `sessionStorage 'woori.send.draft'`, 비밀번호는 [다음] 으로 다시 — 새로 들어오면·[이체] 성공·취소면 지움). [다음] 검사·비밀번호 확인 중에는 금액 줄 탭·비밀번호 시트 ✕/뒤로 무시 |
| `/send/confirm` | `WooriSendConfirm` | send-b — 안내·[이체] 아래끝 기준. 처리 중에는 ‹·취소·폰 뒤로 무시. [이체] 오류 = 안내 시트(4xx 면 [확인] 뒤 금액 화면). ‹·폰 뒤로 = 채운 금액 폼으로(금액 화면이 남긴 `woori.send.draft`), [이체] 성공·취소면 지움. 통장표기 값은 실제 앱에서 말줄임 |
| `/send/done` | `WooriDone` | done — [공유][확인] 아래끝 기준, 위 내용은 실제 앱에서 자기 스크롤 영역 |
| `/dev/keyboard` · `/dev/keypad` | `WooriDevKeyboard` · `WooriDevKeypad` | 개발용 단독 확인 (삼성 키보드 · 섞인 키패드) |
| `/dev/frame` | `WooriDevFrame` | 뼈대 확인 (shot: geometry · nested · nested-nofix · scrolled · bottom · spinner · sheet · popup, shot 없으면 [시트][팝업] 단추) |
| 그 밖 | → `/home` (replace) | |

### 이동 방식 (`WOORI_MOTION` 기본값 — 1단계 타임라인 맞춤값, 화면 스펙이 다시 재서 덮어쓴다)

| 종류 | 무엇 | 기본값 | 영상 |
|---|---|---|---|
| `instant` | 한 프레임 교체 (기본) | — | 페이지 이동 대부분 (+ 흰 페이지·스피너·단계적 그리기는 화면 몫) |
| `push` | 새 페이지가 오른쪽에서 밀려 들어옴, 아래 페이지는 제자리 + 흰 베일 | md-decelerate(0,0,0.2,1) 260ms · 베일 0→0.8 linear 260ms | v2 63.760 · 71.588 (rms 0.69px). 베일 0→≈0.44(보이는 동안)…0.8–0.84 → 근사 |
| `pop` | push 의 반대 (나가는 페이지가 오른쪽으로, 드러나는 페이지 베일이 걷힘) | md-accelerate(0.4,0,1,1) 260ms | 영상에 없음 — 브라우저 뒤로 대비 설계값 |
| `reveal` | 지금 페이지가 한 프레임에 사라지고 아래 페이지 베일 0.8 유지 → 걷힘 | 유지 200ms → linear 307ms | v2 74.214–74.723 (rms 0.01) 계좌번호 [확인] |
| `rise` | 새 페이지가 아래에서 올라오며 페이드 인 | dy 82.5dp md-decelerate 250ms + 페이드 md-standard 308ms | v1 91.367 · 101.519 · 154.314 (거래 상세) |
| `sink` | rise 의 반대 | dy 68.75dp ease-out 120ms + 페이드 (0.2,0,0,1) 190ms | v1 95.699 · 104.531 · 156.273 (흩어짐 — 근사) |
| 시트 `sheet` | 딤 + 시트 (화면 상태, `WooriSheet`) | 열림 easeOutCubic 260ms + 딤 0→0.5686 linear 300ms(25ms 늦게) · 닫힘 easeInCubic 255ms + 딤 linear 293ms | 조회조건 시트 v2 (rms 0.41) |
| 팝업 `popup` | 홈 프로모션 팝업 | 열림 easeOutCubic 300ms + 딤 0→0.5098 ease 178ms · 닫힘 150ms · 내비 띠 검정 | v1 11.633–12.971 (프레임이 드물어 맞춤 나쁨 — 스펙에서) |

딤 불투명도는 토큰 `--woori-dim-sheet-alpha`(정지 프레임 0.5686 — 타임라인 곡선 맞춤의 0.556–0.564 는 근사)·`--woori-dim-popup-alpha`(0.5098).
전환은 전부 CSS 애니메이션(`.woori-tr-*`, `.woori-layer__veil`, `.woori-sheet--*`)이라 `shot.cjs --t` 로 위상을 고를 수 있다.

```ts
const go = useWooriNavigate()
go('/send/account', { transition: 'push' })
go('/send/account', { transition: { kind: 'push', duration: 255, easing: 'cubic-bezier(0, 0.122, 0.253, 1)' } })  // 스펙 값으로 덮어쓰기
go(-1, { transition: 'reveal' })                 // 계좌번호 [확인]
go('/history?type=all', { replace: true })        // 같은 페이지면 인스턴스 유지
const close = useBackTo('/history', 'sink')       // 기록 속 /history 까지 한 번에 뒤로 (없으면 replace)
```

- **페이지 스택**: 라우트 패턴 하나 = 페이지 하나. `push`·`rise` 로 들어온 페이지 아래의 페이지는 마운트된 채 남는다 (덮인 동안 `visibility:hidden` + `inert`).
  `instant` push 는 아래 페이지를 내린다 (돌아오면 새로 마운트 — 화면이 자기 캐시로 '떠날 때 모습'을 그린다. 영상의 홈 복귀가 그렇다).
  같은 패턴 안의 이동(검색어만 바뀜)은 인스턴스를 그대로 두고 위치만 바뀐다.
- **브라우저 뒤로/앞으로**: 기록 칸마다 들어온 전환을 적어 둔다 (`sessionStorage 'woori.nav.arrivals'`). 뒤로 = 그 반대(push→pop, rise→sink, 그 밖 instant),
  앞으로 = 같은 전환. `go(-n, { transition })` 으로 준 전환이 우선이다.
- 전환 중에는 모든 레이어가 `inert` (연타가 아래 페이지를 누르지 않게). 한 기록 칸에서는 한 번만 떠난다 (연타 막기, 1초).
- 레이어 안에서는 `useNavigationType()` 이 늘 'POP' 이다 → 도착 방식은 `useArrivedByPop()`.
- 하나 답지의 '바로 시작하는 뒤로가기'·'누른 순간에 맞춘 push'(지연 보정)는 옮기지 않았다 — 녹화 비교에서 필요해지면 화면 작업과 함께 옮긴다.

## 프레임 띠 색 (위·아래 스페이서)

스페이서 색은 화면·상태마다 다르다 (units.md 5.3절: 대부분 흰색 255, 홈·스플래시 회색 241, 홈 팝업 때 내비 검정, 키보드 때 키보드 색). 화면이 바란다:

```ts
useWooriBands({ statusbar: 'var(--woori-bg-gray)', navbar: 'var(--woori-bg-gray)' })   // 마운트된 동안
useWooriBands(keyboardUp ? { navbar: KEYBOARD_NAV_COLOR } : null)
```

맨 위 페이지 레이어의 요청만 쓴다 (덮인 페이지의 요청은 새지 않는다). 한 레이어 안에서는 나중에 마운트된 요청이 이긴다 (팝업 시트가 내비만 검정으로).
스페이서와 셸 사이 31–31.333dp 는 상태바 띠 색이다. 시트 딤은 셸(앱 뷰포트)만 덮는다 (영상: 상태바·내비 바는 딤 없이 흰색 — sheet 실측 255→110, popup 255→125).
프레임 모드가 아니면 상태바 색이 `<meta name="theme-color">` 가 된다.

## 공용 부품

- **WooriSpinner** `<WooriSpinner />`(페이지 가운데 = 앱 뷰포트 정중앙 (180, 400.333)dp = 영상 (262.02, 627.88)px, 실측 262.07/627.97) ·
  `<WooriSpinner at="home" />`((180, 370.854)dp = 영상 (262, 585)px — 탭바 위 가운데로 보임, 홈 스펙에서 확정) · `at={{ x, y }}` (앱 뷰포트 기준 dp).
  상자 48dp, 원호 r 20 · 굵기 6 · 둥근 끝 (실측 잉크 r 24.9–33.3px). 색 토큰 `spinnerArcDark`·`spinnerArcLight`. 반 주기 0.798s(두 원호가 자리를 바꿈),
  한 주기 1.596s — 키프레임은 v2 #3203–#3290 원호 머리·꼬리 각도 표본 그대로(rms 1.9°). 페이드 없이 나타나고 사라진다 (조건부 렌더).
  위치는 transform 이라 소수 중심이 정확하다. `phaseMs` 로 시작 위상.
- **WooriSheet** `open` · `variant` · `motion`(곡선 덮어쓰기) · `dim` · `navbar`/`statusbar`(떠 있는 동안 띠) · `appear` · `onOpened`/`onClosed` · `onDimClick` · `className`/`style`(패널).
  레이어 겹침 자리로 포털 → 페이지와 같이 움직이고 딤은 앱 뷰포트만. 단계 opening → open → closing → closed(언마운트). shot 상태는 `appear={false}` 로 바로 열린 모습.
  **WooriOverlay**: 같은 자리에 그냥 그린다 (스크롤 밖 고정 요소).
- **WooriLoadingPage** 흰 페이지(+스피너)로 레이어 페이지를 덮는다. **useWooriStages(times, { start, shotStage, startAt })** 단계 번호 —
  영상의 단계적 그리기는 애니메이션이 아니라 한 프레임 교체라 타이머다 (`--t` 로 못 멈춤 → shot 은 `shotStage` 로 단계를 고른다).
- **WooriApi** `wooriApi.getAccounts()` · `getTransactions(id, { type, period, cursor })` · `getTransaction(id)` · `getRecipients(tab)` · `getBanks()` ·
  `suggestBanks(digits)` · `lookup(bank, acct)` · `checkTransfer(req)` · `verifyPassword(ticket, pin)` · `executeTransfer(ticket)` · `getDone(txId)` · `devReset(scenario, now)`.
  타입은 backend/README.md 와 실제 응답 키를 대조했다. 오류는 `WooriApiError(status, message, body, code)`.
- **WooriTheme** 토큰: `spec/tokens.json` 이 있으면 그 값(`import.meta.glob` — 없으면 빈 표라 빌드가 깨지지 않고 자리표시 값을 쓴다), 이름은
  camelCase → `--woori-kebab` (`primaryPressed` → `--woori-primary-pressed`, 별칭 `--woori-primary-keypad`), 딤은 색 + `-alpha` 숫자.
  지금 출처는 `wooriDebug.tokenSource`. 다크는 `WOORI_DARK_OVERRIDES`(비어 있음)를 채우면 된다. 요소별 정확한 색은 화면 스펙이 우선이다.
- **글꼴** (spec/font.md 8절 그대로): `index.html` 이 `/fonts/PretendardVariable.woff2` preload + `/fonts/woori-font.css`. 스택 `--woori-font`, 자간 0,
  숫자 proportional (상세 값 열만 tabular-nums — 화면 몫), `font-display: block`.

## 화면 작업이 할 일

1. `Woori<Screen>.tsx` 의 `<WooriPlaceholder …/>` 를 지우고 화면을 그린다. CSS 는 `woori-<그룹>.css`.
2. shot 상태 표를 모듈 상수로 두고 `const shot = useShotState('<화면>', SHOTS)` → 그 모습으로 바로 그린 뒤 `useShotReady(데이터가 다 그려졌는지)`.
   shot id = `spec/<group>.json` 상태 id (`tools/shots.json` 의 url `…?frame=1&shot=<id>`).
3. 띠 색 `useWooriBands`, 이동 `useWooriNavigate` + 스펙에서 잰 전환 값, 시트 `WooriSheet`(+ 스펙 곡선), 로딩 `WooriLoadingPage`/`useWooriStages`, 스피너 `WooriSpinner`.
4. 렌더 규칙: 정수 dp + 소수는 `wooriPlace`, 아래에 붙는 상자 `WOORI_BOTTOM_FIX`, 자기 스크롤 컨테이너 `useWooriScrollFix`, shot 의 스크롤 위치 `wooriScrollTo`, `position: fixed` 금지.
5. 에셋은 `node tools/gen-from-spec.cjs` 가 만드는 `WooriArt.ts`·`WooriArtbox.ts` 로 (`artBox(name)` 등). 캐릭터는 독창적 대체 그림 (BRIEF D4).
6. 찍고 비교: `node tools/shot.cjs --url "/<route>?frame=1&shot=<id>" --name <group>/<id>` (기준 프레임이 있으면 자동 비교) · `npm run shots`.

## 검증 (뼈대, 2026-11-21)

| 명령 | 결과 |
|---|---|
| `npm run typecheck` (`tsc -b`) · `npm run lint` · `npm run build` | 통과 |
| 루트 `npm run build` (빌드 + check-dist) | 통과 — 애니메이션/트랜지션 규칙·@keyframes 소스 = 빌드 |
| `shot.cjs` `/home?frame=1&shot=blank` 등 자리표시 14 경로 | 524x1280, READY 켜짐, 콘솔 오류 없음 |
| `/dev/frame?frame=1&shot=geometry` (dev · preview 빌드 같음, 최대 차 1 레벨) | 상태바 경계 45.5px(−0.08) · 내비 경계 1210.21px(+0.03) · 1dp 가로선 y=100/400/700 +0.076/−0.038/−0.006px · 세로선 x=16…344 ≤0.05px · 상자 20–340·16–344 ≤0.003px · boxes.json dp (20, 231.333, 320, 48) |
| `nested` / `scrolled` / `bottom` | 같은 기준 전부 통과 (맞춤 없는 `nested-nofix` 는 +0.43/−0.12px 로 실패 — 맞춤이 필요한 이유) |
| `sheet` · `popup` | 딤 255→110 · 255→125 (토큰 0.5686 · 0.5098, 영상 실측과 같음), 상태바 흰색 그대로, 팝업 내비 띠 검정 |
| 아래 스페이서 끝 (`popup`) | 1210 행 49 (영상 46) · 1279 행 0 (영상 1). 48px 스페이서는 셸 높이 800.65625(레이아웃 단위 1/64)라 879.656 에서 멈춰 1279 행이 20 이었다 → 49px + `.woori-frame` clip (woori.css) |
| 페이지 스택 (Playwright) | rise·sink(브라우저 뒤로)·앞으로·push+베일·pop·reveal(0.8 유지 200ms → 0)·같은 페이지 인스턴스 유지·모르는 경로 → /home·시트 단계·띠·토큰(`#2286f2`)·글꼴 로드·`?frame=0` 셸 360x880·`?theme=dark` |

## APK — 서버 없는 로컬 모드 (BRIEF D14)

사용자 요구 "백엔드 없이 기기에 다 저장되도록, 서버 필요 없이": APK 는 서버·PC·네트워크 없이 폰 혼자 돈다. 웹 답지(Express 백엔드 + `dist/`)는 그대로다.

```bash
bash ../tools/build-apk.sh                 # (루트 npm run apk) VITE_WOORI_LOCAL=1 vite build → dist-apk → cap sync → gradle assembleDebug
                                           # → ../tools/out/apk/WON-answer-key-debug.apk (gitignore)
node ../tools/woori-local-check.cjs        # (루트 npm run check:local) dist-apk 를 서버 없이 Chromium 으로 확인 + 실제 backend 와 응답 대조 (WOORI_LOCAL_DIST=<폴더> 로 다른 빌드, 포트는 늘 빈 포트)
```

| | |
|---|---|
| 앱 | 이름 **WON 답지**, 패키지 `dev.answerkey.won` (은행 앱과 무관, 연습용·배포 안 함), 아이콘 = 초록 바탕 흰 답안지 + 체크 (도형만, `tools/woori_apk_icon.py`) |
| 스택 | Capacitor 8.6.0 (`@capacitor/core`·`cli`·`android`) + `@capacitor/app` 8.1.2 + `sql.js` 1.15.2 — 버전 고정. Android 프로젝트 `frontend/android/` (compileSdk·targetSdk 36, minSdk 24, AGP 8.13, Gradle 8.14.3) |
| 빌드 도구 | JDK 21, Android SDK `platforms;android-36` · `build-tools;35.0.0` (라이선스 수락), `ANDROID_HOME`(기본 `/opt/android-sdk`). 이 컨테이너는 cmdline-tools 로 `/opt/android-sdk` 에 깔았다 |
| 데이터 | **backend 와 같은 스키마·SQL·업무 로직**: `backend/schema.js`(SCHEMA·withTransaction) + `app.js` → `routes/*` · `repo.js` · `transfer.js` · `seed.js` · `banks.js` · `clock.js` · `util.js` 를 그대로 번들 (별칭 `woori-backend/…`). DB 는 sql.js(SQLite wasm) 위에 node:sqlite `DatabaseSync` 모양 껍데기(`WooriLocalDb`), `express`·`cors` 는 로컬 빌드에서만 `WooriLocalExpress.cjs`·`WooriLocalCors.cjs` 로 바꾼다 (Express 4 라우팅 규칙: 대소문자 무시·끝 '/'·`:param`·use 접두사·4인자 오류 처리기·body-parser strict) |
| 전송 | `window.fetch` 를 감싸 같은 출처 `/api/…` 만 앱 안 backend 로 → 라우트가 만든 JSON·상태 코드 그대로 `Response`. `WooriApi.ts` 는 그대로 |
| 저장 | 요청이 DB 를 바꾸면(`total_changes`) DB 바이트 전체를 **IndexedDB**(`woori-answer-key` / `local-db`)에 쓴 **뒤에** 응답 → 앱을 껐다 켜도 잔액·거래내역·이체 결과가 남는다. 처음 실행(저장본 없음) = `ensureSeeded` → **v1-start (345원)**. 스키마가 바뀐 저장본·깨진 저장본은 버리고 새로 채운다. 앱 데이터 지우기 = 처음 상태. 쓰기가 실패하면(저장 공간 부족 등) 메모리 DB 를 마지막 저장본으로 되돌리고 507 `STORAGE_FAILED`(한국어 안내) → 화면은 오류 안내, 다시 켜도 같은 상태 |
| 시계 | backend 와 같다 (덮어쓰기 → 실제 시각 Asia/Seoul). 처음 설치는 실제 시각이라 영상 시드 거래(2026-09 ~ 2026-11-21)는 2027-02-21 무렵부터 기본 조회 3개월 밖으로 빠진다(거래내역 '조회된 거래내역이 없어요', 6개월·1년에는 보임) — 숨은 메뉴 되돌리기(시계 영상 시각 고정, 기본 켬)로 다시 보인다. `process.env` 는 빌드가 `{}` 로 바꿔 WOORI_* 기본값 (비밀번호 1234 등) |
| 숨은 메뉴 | 화면 **맨 위 가운데(제목 자리, 앱 x 130–230dp · y 0–44dp)를 1.5초 안에 5번** 탭 → '시나리오 되돌리기': v1 시작 345원 · v2 시작 344원 · v2 끝 342원 + '시계를 영상 시각에 고정' 체크 상자(기본 켬, `POST /api/dev/reset {now:'video'}`). 고르면 `sessionStorage`·`localStorage` 의 `woori.` 로 시작하는 값(알림 읽음·지움, 홈 팝업 '오늘은 그만 보기', 홈 캐시, 이체 폼 초안 `woori.send.draft` …)을 지우고(테마 `woori.theme`·프레임 `woori.frame` 은 남김) `/` 부터 다시 연다. 두 번째 탭부터는 앱에 넘기지 않는다. 대화상자에 **계좌 비밀번호 1234 · 인증서 비밀번호는 아무 6자리** 안내. (예전 왼쪽 위 32x32 는 머리 ‹ 와 겹쳐 첫 탭이 뒤로 갔다 — 제목 자리에는 동작 있는 단추가 없다) |
| 폰 화면 | 프레임 모드 끔 (`?frame` 없음), `viewport-fit=cover` 를 빼서(로컬 빌드만) Capacitor SystemBars(`insetsHandling: native`)가 웹뷰를 **진짜 상태바·내비 바 사이**에 둔다. 두 바 뒤 색 = 화면의 띠 색(`useWooriBands` → 네이티브 `WooriBars` 플러그인, 어두우면 아이콘 밝게). 키보드가 뜨면 웹뷰가 그 위로 줄어든다. 밝은 테마 고정(강제 다크 끔) |
| 뒤로 버튼 | `@capacitor/app` backButton → window 에 취소 가능한 `WOORI_BACK_EVENT`('woori-back') → `WooriEnv` 뒤로 처리 스택이 하나만 받는다: 숨은 메뉴(dialog) > 맨 위 페이지의 열린 시트·팝업(`WooriSheet onBack`: 조회조건 시트 · 홈 프로모션 팝업 · 중복 경고 · 계좌 비밀번호) > 페이지 뒤로(`WooriHeader` 의 ‹/✕ 와 같은 동작이 자동 등록, 계좌번호·금융회사 ✕, 거래내역 = ‹(홈), 이체 완료 = [확인] — 불러오는 중·[확인] 뒤 떠나는 150ms 동안은 받아서 버림, 불러오기 오류 화면이면 [확인] 과 같이 거래내역). 아무도 안 받으면 처음 화면(`/` 스플래시 · `/cert` 인증서·로그인 로딩 · `/home`)이면 토스트 '뒤로 버튼을 한 번 더 누르면 종료됩니다' → 2초 안에 또 누르면 `exitApp`, 그 밖은 기록이 있으면 `history.back()`, 없으면 홈. 브라우저 확인용 `wooriDebug.pressBack()` (로컬 빌드) |
| 화면 맞춤 | 프레임 모드가 아니면 `installWooriFit`(main.tsx): 앱 레이아웃은 360dp 폭 그대로, 셸을 `transform: scale(k)` (위끝 가운데), **셸 레이아웃 높이는 640dp 바닥**. 폰 모양(폭을 채워도 높이 640dp 이상)은 k = 폭/360 → 폭을 꽉 채움 (360x800 · 412x915 · 384x854 → 1 · 1.144 · 1.067, 글자 크게 보기로 좁아진 320x690 → 0.889 — 줄여서 360dp 를 다 보인다), 그 밖(높이가 모자란 폰·태블릿)은 k = min(폭/360, max(높이/800, min(한도, 높이/640))) → 폰 비율 기둥. 한도 = max(1, min(폭/360, 2.5 − 폭/360)): 폰 폭(450dp 까지)은 k = 높이/640 (레이아웃 640 바닥만큼 키운다 — 폰 모양과 이어져 1dp 차이로 튀지 않음: 412x733 → 1.144, 412x732 → 1.144, 412x700 → 1.094, 411x659 → 1.030, 360x600 → 0.9375, 320x568 → 0.8875), 450–540dp 는 1 까지 차츰, 그 위(태블릿)는 1 (800x1280 → 1.6, 1280x800 → 1). k ≠ 1 이면 `data-woori-fit="scale"`. 입력칸에 포커스가 있을 때만(시스템 키보드는 그때만 뜬다) k 를 그 폭에서 본 가장 큰 높이로 정해 키보드가 떠도 바뀌지 않는다 (셸 높이만 줄어 [확인] 이 키보드 위). 입력칸 없이 높이가 줄면(화면 분할·팝업 창) 처음 연 것처럼 다시 맞춘다. 입력칸에서 빠진 뒤 1초는 키보드가 닫히는 중으로 본다. 기둥이 화면보다 좁으면 `<html data-woori-side="1">` → 양옆 `--woori-side-bg`(#e9ebee)+옅은 그림자, APK 상태바·내비 바는 한쪽 틈이 8dp 이상일 때만 그 색 (360x638 같은 1dp 남짓 틈은 화면 띠 색) |
| 토스트 | 영상에 없어 동작이 없는 단추·메뉴(공유·메모·☆(이체 완료 화면)·더보기·관리·모으기·🔍·카메라·＋연락처로 이체하기·추가이체·금액 화면 ⌄ 줄·사기의심조회·'비밀번호가 기억나지 않아요'·완료 화면 광고·홈 ⋮·홈 머리 아이콘(종 빼고)·공지·카드·배너 그림·추천·[다른 방법으로 로그인]·탭바 홈 외 탭 …)는 '답지에는 없는 화면이에요' (`wooriTodo`). 탭바 '홈' = 맨 위로. **프레임 모드·shot 모드에서는 토스트를 만들지 않는다** (화면 모양·shot 그대로). 실제로 동작하게 만든 것(설계): 이체 편집·☆, 알림(종) 편집, 홈·거래내역 계좌번호 복사(`wooriCopy` '우리은행 1002-123-456789' → '계좌번호가 복사되었어요'), 통장표기 편집. 토스트는 한 줄 최대 312dp, 낱말 안에서 줄을 바꾸지 않는다(`keep-all`) |
| 누름 · 선택 | 길게 눌러도 글자가 선택되지 않는다 (`body` `user-select: none` · `-webkit-touch-callout: none`, 입력칸·textarea·contenteditable 은 다시 켬). dvh 를 모르는 옛 웹뷰는 `--woori-shell-h` 가 `100vh` 로 |
| 키보드 | 삼성 키보드 재현은 끄고 진짜 시스템 키보드: 화면은 `wooriUsesSystemKeyboard()`(로컬 빌드 + 프레임 아님)일 때 재현 키보드를 그리지 않는다 (화면 몫) |
| 화면 방향 | 세로 고정 (`android:screenOrientation="portrait"`). 가로로 돌리면 셸이 360dp 남짓으로 낮아져 인증서 키패드가 화면 밖으로 나가 로그인이 안 되던 것. 큰 화면(sw600dp 이상)은 Android 16 이 방향 고정을 무시하지만 '큰 화면' 맞춤이 받는다 |
| 글꼴 크기 | 시스템 글꼴 크기를 따르지 않는다: `MainActivity` 가 웹뷰 `setTextZoom(100)` (기본은 100 × fontScale — 절대 위치 + px 줄 높이 레이아웃이라 글자만 커지면 겹친다). `configChanges` 에 `fontScale` · `fontWeightAdjustment`(굵은 글꼴, Android 12+) 가 있어 글꼴 크기·굵은 글꼴을 바꿔도 앱이 처음 화면으로 돌아가지 않는다 |
| 서명 · 버전 | 저장소의 고정 연습용 키 `frontend/android/app/woori-debug.keystore` (비밀번호 `android`, 안드로이드 기본 디버그 키와 같은 성격 — 비밀 아님)로 서명, versionCode = HEAD 커밋 시각의 2025-01-01 UTC 부터 분 (`build-apk.sh` 가 `git log -1 --format=%ct` 로 재서 `-PwooriVersionCode` — 얕은 클론 깊이와 무관, git 없으면 지금 시각, 넘기지 않은 gradle 빌드도 지금 시각. 예: 993343). 새 APK 가 이전 설치 위에 덮어 깔려 폰에 저장된 잔액·거래내역이 남는다. 이 키 이전(컨테이너마다 새 디버그 키)으로 깐 APK 는 한 번만 지우고 깔아야 한다 |
| 상태바 · 내비 바 | `WooriBars` 플러그인이 DecorView 배경을 띠 색 Drawable 로 둔다. SystemBars 가 시작·설정 변경 때 배경을 흰색으로 바꿔 버리므로 칠할 때마다 다시 달고, 시작·설정 변경 때는 SystemBars 다음 차례로 다시 건다. Android 14 이하(edge-to-edge 아님)는 `window.setStatusBarColor` · `setNavigationBarColor` 도 같이. Android 7.x(API 24–25)는 내비 단추를 어둡게 못 바꿔 밝은 내비 띠를 검정으로 칠한다 |
| 테마 아이콘 | Android 13+ 테마(단색) 아이콘은 단색 층의 알파만 쓰므로 따로 그린 `ic_launcher_monochrome_won.xml`(종이 테두리 + 글줄 + 체크)을 쓴다 (`tools/woori_apk_icon.py`) |

- 웹 빌드(플래그 없음)는 바뀌지 않는다: `main.tsx` 의 `import.meta.env.VITE_WOORI_LOCAL === '1'` 분기가 접혀 로컬 코드·sql.js 가 번들에 없다. vite.config 는 별칭 `woori-backend` 하나만 더한다.
- 로컬 모드는 **빌드로만** 돈다 (`vite dev` 는 backend 의 CommonJS 를 브라우저로 옮기지 않는다). 브라우저에서 보려면 `VITE_WOORI_LOCAL=1 npx vite build` 뒤 `dist-apk` 를 아무 정적 서버(SPA 대체)로.
- 웹뷰 디버깅: 디버그 APK 는 `webContentsDebuggingEnabled` — PC Chrome `chrome://inspect`.

### 검증 (2026-11-21)

| 명령 | 결과 |
|---|---|
| `bash tools/build-apk.sh` | APK 16 MB (debug), `aapt2 dump badging`: `dev.answerkey.won` · 'WON 답지' · target 36, 자산에 sql wasm · `viewport-fit` 없음 |
| `node tools/woori-local-check.cjs` (Chromium, 백엔드 서버 없음) | 처음 실행 345원(홈 화면 글자 포함) → fetch 로 이체 1원 201 · 344원 → 새로고침·브라우저 다시 열기 뒤 344원 · 거래 +1 → 숨은 메뉴(맨 위 가운데) 5탭 → 비밀번호 안내 → v1 시작 → 345원·거래 수 원래대로 · 시계 11:09:11 고정 · 네트워크 `/api` 0건 · **실제 backend(Express+node:sqlite)와 68쌍 응답 같음** (GET 25종 × 2 시나리오 · 오류 400/404 · 이체 흐름 · 커서) · 저장 실패 흉내(IndexedDB put 던짐) → 이체 507 `STORAGE_FAILED` · 메모리 잔액 그대로 → 되살리면 같은 ticket 201 |
| 전체 흐름 (Playwright, dist-apk, 360x800 DPR 2.625 터치 · 412x915 · 384x854 · 태블릿 800x1280 · 1280x800) | 스플래시 → 인증서 → 로그인 로딩 → 홈(팝업 뒤로 닫기) → 거래내역 → 기간 이번달·6개월·1년(입금)·3개월 · 직접입력+과거순 · 초기화 각각 적용(필터 줄·기간 줄) → 상세 → 뒤로 → 홈 → 이체 1원(중복 경고·비밀번호 1234, 시트마다 뒤로 닫기) → 완료 → 거래내역 새 -1원 → 홈 344원 · 계좌번호 직접 입력(높이 480 = 키보드, [확인] 보임) · 홈 뒤로 2번 = 종료 · 콘솔 오류 0 (41/41). 프레임 shot 7개(home/top-banner1 · popup-idle · history/all-top · sheet-all · send-b/amount-keypad · dup-idle · send-a/account-typed) 고치기 전·후 화소 같음 |

## 하나 답지와 다른 점

| | 하나 | 우리 |
|---|---|---|
| 뷰포트 / DSF | 384x853 / 1.25 (등방) | 360x880 / 16/11, 가로 보정 scaleX 1.0024 (셸 transform) |
| 프레임 모드 | `position: fixed` 앱 + 레이어마다 상태바·제스처 띠 | 문서 스크롤·fixed 없는 셸 + 전역 스페이서(띠 색은 맨 위 레이어 요청) |
| 스크롤 | 기본 스크롤 컨테이너 | 기기 화소 반올림 맞춤 (원점 0.42px 소수 — 하나는 원점이 정수 35px 라 필요 없었다) |
| 전환 | push·pop·slide-up·fade·instant | instant·push(+베일)·pop·reveal·rise·sink + 시트·팝업 (영상이 다르다) |
| 덮는 전환 아래 페이지 | 전환 동안만 2장 | 스택에 남음 (상세 ↔ 목록, 이체 단계) |
| 글꼴 | npm `pretendard` 동적 서브셋 | `public/fonts` 전체 파일 (앱·textfit 같은 파일, spec/font.md) |
| 포트 | 5173 / 4000 | 5273 / 4100 (preview 4273) |
