# 해설지

`SPEC.md`(문제지)를 보고 직접 짜다가 막히면 여기서 해당 부분을 찾아보세요.
"무엇을"보다 **"왜 이렇게 했는지 / 어디서 틀리기 쉬운지"** 위주입니다.

## 폴더 구조

```
server/        index.mjs(Express API + 빌드된 화면 서빙) · db.mjs(SQLite 스키마/초기값) · banks.mjs(은행 목록)
src/
  config/      timing.ts(모든 애니메이션 타이밍)
  api/         types.ts(API 계약) · client.ts(fetch 래퍼) · useApi.ts(캐시) · endpoints.ts(주소 모음)
  dev-panel/   종 버튼 관리 패널 (모든 데이터 수정은 여기서만)
  profile/     접속할 때 프로필 고르기 (ProfilePicker, 아바타, sessionStorage)
  assets/      Asset 슬롯 + Fluent 기본 에셋, local/(실제 에셋, 커밋 안 됨)
  hooks/       useAsync, useTypewriter, useScrollTop, useStatusBar
  lib/         format.ts (금액 포맷, 날짜 그룹핑) · keypad.ts (키패드 입력 계산)
  components/  PhoneFrame, TxList, Icon, Sheet(시트·키패드·알림창), BankIcon, art(로고/일러스트/스피너 SVG)
  screens/     boot / home / account / history / tx / bank(다른 은행 계좌) / transfer(이체)
```

**타이밍을 한 파일에 모은 이유**: 영상과 비교하며 속도를 맞출 때 컴포넌트를 돌아다니지 않고
`timing.ts`만 고치면 되게. "매직 넘버를 흩뿌리지 않는다"의 실전 예.

---

## 1. 스플래시 — 단계(phase) 상태 하나로 애니메이션 전체를 지휘

`Splash.tsx`는 `phase: "launch" | "logo" | "brand"` 상태 하나만 갖고, 타이머로 단계를 넘깁니다.
실제 움직임은 전부 CSS가 `.splash--logo`, `.splash--brand` 클래스에 반응해서 처리합니다.

- **앱 실행 애니메이션**: `clip-path: inset(... round 48px)` → `inset(0 round 0)`.
  작은 둥근 사각형이 화면 전체로 펼쳐지는 효과를 요소 크기 변경 없이(리플로우 없이) 냄.
- **B가 작아지며 워드마크가 펼쳐짐**: B는 `transform: scale(2.2) → scale(1)`,
  워드마크는 `max-width: 0 → 200px`. 부모가 `justify-content: center`라서 워드마크 폭이
  늘어나면 **B가 자동으로 왼쪽으로 밀려남** — B 위치를 따로 계산할 필요가 없음.
- **흔한 버그**: `App`에서 `onDone={() => setBoot("loading")}`처럼 화살표 함수를 바로 넘기면
  App이 리렌더될 때마다 새 함수 → Splash의 `useEffect([onDone])`가 다시 돌아서 **타이머가 리셋**됨.
  그래서 `useCallback`으로 고정. (effect 의존성에 함수가 들어가면 항상 의심할 것)

## 2. 홈 — "두 번에 나눠 그리기"와 끼어드는 애니메이션

### 2단계 렌더
첫 진입 때만 `wave 1 → wave 2`. 모듈 변수 `booted`로 "이미 한 번 켜졌는지"를 기억해서
상세에서 뒤로 왔을 땐 처음부터 wave 2로 그림. (state는 언마운트되면 사라지므로 모듈 변수)

### 높이가 0에서 자연스럽게 펼쳐지는 애니메이션 (`Collapse`)
`height: auto`는 transition이 안 됩니다. 대신:

```css
.collapsible { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 320ms; }
.collapsible--closed { grid-template-rows: 0fr; }
.collapsible > * { overflow: hidden; min-height: 0; }
```

`0fr ↔ 1fr`은 애니메이션이 됩니다. 광고 등장, 광고 닫기(X), AI 목표적금 닫기, 카드 섹션 등장에 전부 재사용.
예전 방식인 `max-height: 500px` 트릭은 실제 높이와 차이만큼 타이밍이 어긋나서 덜 자연스러움.

### AI pill — 방문할 때마다 다음 문구
- **틀리기 쉬운 지점 ①**: 렌더 중에 `visits++` → 개발 모드 StrictMode는 컴포넌트를 **두 번 렌더**하므로 2씩 증가.
- **틀리기 쉬운 지점 ②**: `location.key`로 방문을 구분 → 뒤로가기는 **같은 히스토리 항목**으로 돌아가서 key가 똑같음.
  (실제로 이 버그가 났었음: 재방문해도 문구가 안 바뀜)
- **정답**: effect 안에서 증가 + `useRef` 가드. StrictMode는 effect를 "마운트→정리→마운트"로 두 번 돌리지만
  ref 값은 그 사이에 유지되므로 `if (counted.current) return`으로 한 번만 셈.
- 재방문 연출: `previous`(이전 문구) → `spinner` → `typing` 3단계 상태.

### 타이핑 효과 (`useTypewriter`)
`setInterval`로 보여줄 글자 수를 1씩 늘림. 문자열을 `Array.from(text)`로 쪼개는 이유:
`text.slice()`는 UTF-16 단위라 이모지 같은 문자가 반으로 잘림. (한글 완성형은 괜찮지만 습관으로)
`\n`이 포함된 문구는 CSS `white-space: pre-line`으로 줄바꿈.

### 이벤트 버블링
계좌 행 전체가 클릭 영역인데 안에 `이체` 버튼이 있음 → 버튼 `onClick`에서 `e.stopPropagation()`.
안 하면 이체 버튼을 눌러도 상세 페이지로 넘어감.

### 탭하면 스피너 → 이동
`setPressing(id)` 후 `setTimeout(navigate, 300)`. 사용자에게 "눌렸다"는 피드백을 먼저 주고 이동.

## 3. 로딩 UI — 서버 지연 + 스켈레톤

백엔드는 GET 응답을 일부러 `API_DELAY_MS`(기본 250ms)만큼 늦게 보냄. 화면은 "데이터는 늦게 온다"는
전제로 짜야 하고, 그래야 스켈레톤/스피너를 연습할 수 있음.

`useAsync`의 `cancelled` 플래그: 응답이 오기 전에 화면을 떠나면(뒤로가기 연타) 언마운트된
컴포넌트에 `setState` 하지 않도록. 요청 A가 늦게 오고 요청 B가 먼저 오는 **레이스 컨디션**도 같은 원리로 막힘.

스켈레톤의 반짝임: `linear-gradient` 배경을 `background-size: 200%`로 키우고 `background-position`을 이동.

## 4. 계좌 상세 — 스크롤 연동 효과

- `useScrollTop`이 스크롤 위치를 state로 줌. `requestAnimationFrame`으로 묶어서
  스크롤 이벤트(초당 수십~수백 번)마다 리렌더되는 걸 프레임당 1번으로 제한.
- 일러스트: `opacity = 1 - scrollTop / 160`, `translateY(scrollTop * 0.35)` → 스크롤보다 느리게 움직여 패럴랙스.
- **실제로 났던 버그**: 처음엔 `useScrollTop(ref)` + `useEffect(..., [ref])`로 짰는데, 로딩 중엔
  스켈레톤이 렌더돼서 `ref.current`가 null → 본문이 나중에 생겨도 ref 객체는 같아서 effect가 다시 안 돎
  → 스크롤 리스너가 영영 안 붙음. 해결: `useState`를 **콜백 ref**로 써서 요소 자체를 의존성으로.
  ```tsx
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const top = useScrollTop(el);
  return <div ref={setEl}>...
  ```
- 헤더는 `position: sticky`. 스크롤 40px 넘으면 배경색을 깔아서 내용이 비치지 않게.

## 5. 전체 내역 — 맨 위로 버튼, 누름 하이라이트

- `맨 위로`: `scrollTop > 320`일 때 클래스 토글 → `opacity`/`translateY` transition.
  `pointer-events: none`을 같이 줘야 안 보일 때 클릭이 안 먹힘. 누르면 `scrollTo({ top: 0, behavior: "smooth" })`.
- 행을 누르면 `activeId`로 160ms 회색 유지 후 이동. `:active`만 쓰면 손을 떼는 순간 사라져서
  영상처럼 "눌린 채로 넘어가는" 느낌이 안 남.

## 6. 거래 상세 — 미리 아는 데이터는 먼저 그리기

목록에서 이동할 때 `navigate(url, { state: { tx } })`로 요약 데이터를 같이 넘김.
상세 화면은 그걸로 **태그/제목을 즉시** 그리고, 나머지만 스피너 → 영상과 동일한 순서.
새로고침하면 state가 없으니 API 응답으로 그림(둘 다 대응).

행 목록은 `groups()` 함수가 배열로 만들고 `.filter(row => row.value)`로 없는 항목(주소 등)을 뺌 →
JSX에 `{d.address && ...}`를 반복하지 않아도 됨.

## 7. 데이터 — 저장하지 말고 계산하기

서버(`server/index.mjs`)는 "거래 후 잔액"을 저장하지 않고 현재 잔액에서 거꾸로 빼가며 계산.
잔액을 데이터마다 손으로 적으면 하나만 틀려도 전체가 어긋남. 계산 가능한 값은 계산.

## 8. 상태바 색 바꾸기 — Context

화면마다 상태바 색이 다름(홈=검정, 상세=라벤더, 이체=흰색). 각 화면이 `useStatusBar(bg, fg)`를
호출하면 Context를 통해 `PhoneFrame`의 상태바가 바뀜. 화면이 상태바 컴포넌트를 직접 알 필요가 없는 구조.

## 체크리스트

- [ ] effect 의존성에 함수가 있으면 `useCallback`으로 고정했는가
- [ ] `setTimeout`/`setInterval`/이벤트 리스너는 cleanup에서 해제했는가
- [ ] StrictMode에서 두 번 실행돼도 결과가 같은가 (카운터, API 호출)
- [ ] 나중에 생기는 DOM 요소에 리스너를 붙일 때 콜백 ref를 썼는가
- [ ] `height: auto` 애니메이션이 필요하면 grid `0fr ↔ 1fr`
- [ ] 클릭 영역 안의 버튼은 `stopPropagation`
- [ ] 비동기 응답이 언마운트 후에 와도 안전한가

---

## 9. 아이폰 버전 — 플랫폼 분기

### 분기를 한 곳에 모으기
`platform/platform.ts`가 OS를 한 번 정하고 `<html data-os="ios">`를 붙입니다.
- **CSS 차이**는 `[data-os="ios"] .bottom-nav { ... }`처럼 CSS에서 처리 → 컴포넌트 코드에 `if`가 안 늘어남
- **생김새 자체가 다른 것**(스피너, 뒤로 아이콘)만 `Spinner`, `BackButton` 같은 작은 컴포넌트 안에서 분기
- 화면 코드(`HomeScreen` 등)는 OS를 거의 모름 → 나중에 OS가 하나 더 생겨도 화면은 안 고침

`main.tsx`에서 platform을 **제일 먼저** import하는 이유: CSS가 적용되기 전에 `data-os`가 붙어 있어야
첫 화면이 안드로이드 모양으로 한 번 그려졌다가 바뀌는 깜빡임이 없음.

### 화면 전환: `<Routes>` 하나로는 안 되는 이유 (`ScreenStack.tsx`)
`<Routes>`는 현재 주소의 화면 **하나만** 그립니다. iOS push는 "나가는 화면"과 "들어오는 화면"이
동시에 움직여야 하므로, 방문 기록(`entries`)을 직접 들고 화면마다 `<Routes location={그 화면 주소}>`로 따로 그립니다.

핵심 트릭: 화면을 감싼 div의 `key`를 `location.key`로 둠 → 같은 화면은 배열에서 자리가 바뀌어도
**언마운트되지 않고 상태(스크롤 위치, 입력값)가 유지**됩니다. "들어오는 화면 → 다음 이동 때 나가는 화면"이 같은 인스턴스.

`useLayoutEffect`를 쓴 이유: 주소가 바뀐 직후 **화면에 그려지기 전에** 레이어 구성을 바꿔야
한 프레임 동안 엉뚱한 화면이 보이는 깜빡임이 없음. (`useEffect`는 그린 뒤에 실행됨)

### 스와이프로 뒤로가기
1. `pointerdown`이 왼쪽 24px 안에서 시작했을 때만 시작, `setPointerCapture`로 손가락이 화면 밖으로 나가도 계속 추적
2. 움직이는 동안: 위 화면은 `translateX(dx)`, 뒤 화면은 `-30% → 0%`로 비례 이동 (`transition: none`이어야 손가락에 딱 붙음)
3. 손 떼면 1/3 기준으로 확정/취소 → 이때만 `transition`을 켜서 마무리 애니메이션
4. 확정이면 애니메이션 끝난 뒤 `navigate(-1)`. 이미 화면을 밀어냈으니 pop 애니메이션은 `skipAnim`으로 건너뜀
5. **깜빡임 주의**: `navigate(-1)` 직후 바로 드래그 상태를 지우면, 주소가 실제로 바뀌기 전 한 프레임 동안
   밀려났던 화면이 제자리로 튀어나옴 → 드래그 상태는 주소가 바뀐 뒤(layout effect 안에서) 지움

`touch-action: pan-y`: 세로 스크롤은 브라우저가, 가로 움직임은 우리 코드가 받도록.

### 뒤에 깔린 화면 문제 → `LayerContext`
스와이프 중엔 뒤 화면(예: 홈)이 미리 마운트됩니다. 그 화면이 마운트되자마자
- 상태바 색을 바꿔버리거나(아직 위 화면이 보이는데 상태바만 검정),
- AI 배너 방문 횟수를 세버리면(스와이프 취소해도 문구가 넘어감) 안 됨.

그래서 각 레이어에 `active`(맨 위인지)를 Context로 내려주고, `useStatusBar`와 `AiPill`은 `active`일 때만 동작.
스와이프가 확정되면 같은 인스턴스가 `active=true`로 바뀌면서 그때 실행됩니다.

### Liquid Glass 탭바
- 유리 질감 = `background: rgba(...)` 반투명 + `backdrop-filter: blur() saturate()` + 위쪽 1px 흰 하이라이트(`inset box-shadow`)
- 스크롤 방향 감지: 이전 `scrollTop`과 비교. 6px 미만 움직임은 무시(안 그러면 손떨림에 탭바가 깜빡거림)
- 축소: 탭바 `width` transition + 선택 안 된 탭은 `flex: 0; opacity: 0`

### 안전영역(safe area)
실제 아이폰에서 열면 `env(safe-area-inset-top/bottom)`으로 노치·홈 인디케이터 영역을 피합니다.
`index.html`의 `viewport-fit=cover`가 있어야 `env()` 값이 0이 아니게 나옵니다.
하단 고정 버튼은 `bottom: max(18px, calc(var(--safe-bottom) + 4px))`로 두 OS 모두 대응.

---

## 10. 부드럽게 만들기 (성능)

### 측정부터
Chrome DevTools 프로토콜로 상호작용 1번 동안의 스크립트 시간과 25ms 넘는 프레임(끊김) 수를 쟀습니다.
폰을 흉내 내려고 CPU를 6배 느리게 한 결과:

| 상황 | 수정 전 | 수정 후 |
|---|---|---|
| 홈 스크롤 | 평균 43ms/프레임, 끊김 41 | 17ms, 끊김 2 |
| 내역 스크롤 | 54ms, 끊김 54 | 17ms, 끊김 1 |
| 계좌 상세 스크롤 | 25ms, 끊김 24 | 17ms, 끊김 1 |
| 스와이프 뒤로가기 | 32ms, 끊김 37 | 19ms, 끊김 2 |

60fps = 프레임당 16.7ms 안에 끝나야 합니다.

### 원인 1: 매 프레임 setState
스크롤 위치를 state로 들고 있으면 스크롤할 때마다(초당 60번+) 화면 **전체**가 다시 렌더링됩니다.
- 매 프레임 바뀌는 값(패럴랙스 위치) → `ref`로 DOM 스타일을 직접 바꿈 (`useScrollFrame`)
- 켜짐/꺼짐 값(맨 위로 버튼, 탭바 축소) → 바뀌는 순간에만 setState. 같은 값으로 setState 하면 React가 리렌더를 건너뜀
- 스와이프 손가락 위치도 ref + `requestAnimationFrame`으로 프레임당 한 번만 DOM에 반영

### 원인 2: 한 글자마다 화면 전체 리렌더
타이핑 효과(`useTypewriter`)를 화면 컴포넌트에서 바로 쓰면 글자 하나마다 화면 전체가 다시 그려짐.
→ `<TypedText>`라는 작은 컴포넌트로 분리해서 그 `<span>`만 다시 그리게. **state는 필요한 곳에 최대한 가깝게(아래로).**

### 원인 3: 전환 중 화면 내용까지 리렌더
`ScreenStack`이 리렌더될 때 각 화면도 같이 다시 계산되던 것 → `LayerContent`를 `memo`로 감싸서
주소와 active가 같으면 건너뜀.

### 원인 4: 레이아웃/페인트를 부르는 애니메이션
브라우저는 `transform`과 `opacity`만 바뀌면 GPU **합성(composite)** 단계만 다시 하면 되지만,
`width`·`max-width`·`filter`·`background-position`이 바뀌면 레이아웃이나 다시 칠하기(paint)가 매 프레임 일어남.
- 스플래시 워드마크 `max-width` 펼치기 → 최종 위치에 미리 배치하고 `transform`으로만 이동
- 이전 화면 어둡게 `filter: brightness()` → 검은 막(`.layer__dim`)의 `opacity`
- 스켈레톤 반짝임 `background-position` → 빛줄기(`::after`)를 `transform`으로 이동
- 움직이는 동안만 `will-change: transform` (항상 켜두면 GPU 메모리 낭비)

### 녹화 영상이 끊겨 보였던 이유 (앱과 별개)
이전 영상은 Playwright 녹화 기능(약 25fps 제한)으로 찍었고, 스크롤도 50px씩 뚝뚝 움직였습니다.
이번엔 가상 디스플레이에 실제 브라우저를 띄워 ffmpeg로 60fps 캡처했고, 스크롤은 손가락으로 튕기듯
감속 곡선으로 움직였습니다. 컨테이너에 GPU가 없어서 녹화할 때만 페이지 시간을 3배 느리게 흘려 찍은 뒤
3배속으로 되돌렸습니다(앱 코드는 그대로). 큰 움직임 구간에서 58~60fps가 나옵니다.

---

## 11. 이미지 에셋 다루기 (직접 그리지 않기)

실무에서 아이콘·로고·사진은 코드로 그리지 않고 **디자이너가 준 파일을 넣습니다.**
이 프로젝트도 그렇게 바꿨고, 공개 저장소라는 제약 때문에 두 단계로 나눴습니다.

### 슬롯(자리) 구조 — `src/assets/Asset.tsx`
화면엔 `<Asset slot="bank-nh" />`처럼 **자리 이름만** 둡니다. 실제 파일은 이 순서로 찾습니다.
1. `src/assets/local/bank-nh.light.png` — 지금 테마 전용 실제 이미지
2. `src/assets/local/bank-nh.png` — 테마 공통 실제 이미지
3. 기본 에셋 — 저장소에 포함된 Microsoft Fluent 3D 이모지 (MIT 라이선스라 공개해도 됨)

`local/`은 `.gitignore` 처리돼 있어서 브랜드 로고·광고 사진이 공개 저장소에 올라가지 않습니다.

### `import.meta.glob` — "있는 파일만" 빌드할 때 고르기
```ts
const files = import.meta.glob<string>("./local/*.{png,jpg,webp}", { eager: true, import: "default" });
```
Vite가 **빌드할 때** 폴더를 훑어서 있는 파일만 번들에 넣고 URL을 줍니다.
- `<img src="/local/x.png" onError={...}>` 방식(예전 광고 사진)은 파일이 없으면 404 요청이 나가고,
  대체 이미지로 바뀌는 순간 **깜빡**입니다. glob은 둘 다 없음.
- 대신 파일을 추가/삭제하면 `npm run build`를 다시 해야 반영 (개발 서버는 자동)

### 테마마다 배경이 다른 아이콘
손 아이콘은 라이트에선 연회색 원, 다크에선 진회색 원 위에 있습니다. 방법 두 가지:
- **테마별 파일** (`ai-saving.light.png` / `ai-saving.dark.png`): 원 색 자체가 디자인일 때
- **배경을 투명하게 따기** (`colorkey`): 손·티머니·별은 회색 배경을 투명하게 만들어 파일 하나로 두 테마에 씀.
  원 배경은 CSS(`background: var(--home-icon-bg)`)가 그림

### 영상/스크린샷에서 잘라내기 — `scripts/extract-assets.sh`
ffmpeg만으로: 자르기(`crop`) → 확대(`lanczos`) → 원형 마스크(`geq`로 원 밖 alpha=0) /
배경 투명화(`colorkey`) / 가장자리 페이드. 좌표를 원본 폭 대비 비율로 계산하므로 더 큰 해상도의
같은 화면에도 그대로 동작합니다. 스크린샷(720px)이 영상(480px)보다 선명해서 홈 아이콘은 스크린샷에서 땁니다.

### 실제 이미지와 기본 이미지의 "모양 차이" 흡수
잘라낸 캐릭터 일러스트는 말풍선 바로 위에서 잘려 있지만, 기본 에셋(이모지 3개)은 말풍선과 많이 겹쳐야 자연스럽습니다.
`.asset--local` 클래스로 어떤 게 들어왔는지 CSS가 알 수 있게 해서 겹침 정도를 다르게 줬습니다.

---

## 12. 백엔드 — Express + SQLite (`server/`)

### 구조
```
화면 ──useApi("/api/home")──▶ fetch (+헤더 X-Profile) ──▶ Express (server/index.mjs) ──▶ SQLite (server/data/profiles/<id>.db)
🔔 패널 ──api.addBankAccount()──▶ POST /api/accounts ──▶ 201 Created
```
- 개발: `npm run dev` = API 서버(8787) + Vite(5173) 동시 실행. Vite가 `/api`를 8787로 넘겨줌(`vite.config.ts`의 proxy)
- 배포: `npm run build` 후 `npm start` → **서버 하나(9101)** 가 `/api`와 `dist/` 화면을 같이 줌.
  화면 주소(`/account/main` 등)로 바로 들어와도 `index.html`을 돌려줘서 새로고침이 안 깨짐(SPA fallback)
- DB는 Node 22에 들어있는 `node:sqlite` 사용 → 설치할 네이티브 모듈 없음. 비어 있으면 홍길동 예시 데이터로 자동 채움

### 테이블
```
profile      (id=1, user_name, card_last4)
accounts     (id, kind: main|external, bank_code, number, balance, badge, safebox, sort)
transactions (id, account_id → accounts ON DELETE CASCADE, at, merchant, amount, tag)
payees       (id, bank_code, number, holder, favorite, UNIQUE(bank_code, number))
transfers    (id, from_account_id → accounts CASCADE, bank_code, number, holder, amount, memo_to, memo_me, at,
              out_tx_id → transactions SET NULL, in_tx_id → transactions SET NULL)
```
- **CASCADE**: 다른 은행 계좌를 지우면 그 계좌의 거래도 DB가 알아서 같이 지움
- **트랜잭션**: 거래 추가 = "거래 INSERT + 잔액 UPDATE" 두 문장. `transaction(fn)`으로 묶어서 둘 중 하나만 되는 일이 없게
- **은행별 규칙**은 `banks.mjs` 한 곳에: 이름, 대표색, 계좌번호 자릿수 패턴(신한 3-3-6, 국민 6-2-6 …).
  서버는 숫자만 받아서 패턴대로 `-`를 넣어 저장 → 화면은 형식 걱정 없음

### API 목록
| 메서드 | 주소 | 하는 일 | 대표 응답 |
|---|---|---|---|
| GET | `/api/home` | 홈 화면 데이터 한 번에 | 200 |
| GET | `/api/banks` | 추가할 수 있는 은행 목록 | 200 |
| GET / PATCH | `/api/profile` | 이름·카드 끝 4자리 | 200, 400(형식 오류) |
| POST | `/api/accounts` | 다른 은행 계좌 추가 `{bankCode, number, balance}` | **201**, 400(자릿수), 409(중복) |
| GET / PATCH | `/api/accounts/:id` | 계좌 조회 / 잔액·계좌번호 수정 | 200, 404 |
| DELETE | `/api/accounts/:id` | 다른 은행 계좌 삭제 (카카오뱅크 통장은 거부) | **204**, 400, 404 |
| GET | `/api/accounts/:id/transactions` | 거래내역 (`?limit=`) | 200 |
| POST | `/api/accounts/:id/transactions` | 입금/출금 만들기 | **201**, 400, 400(잔액 부족) |
| GET / DELETE | `/api/transactions/:id` | 거래 상세 / 삭제(잔액 되돌림) | 200, **204**, 404 |
| GET / POST | `/api/payees` | 받는 분 목록 / 등록 `{bankCode, number, holder}` | 200, **201**, 400, 409(중복·내 계좌) |
| PATCH / DELETE | `/api/payees/:id` | 이름·번호·☆ 수정 / 삭제 | 200, **204** |
| GET | `/api/transfer/recipients?from=` | 이체 첫 화면: 내 계좌 + 최근 이체 | 200 |
| GET | `/api/transfer/lookup?bank=&number=` | 예금주 조회 | 200, **404**(ACCOUNT_NOT_FOUND) |
| POST | `/api/transfers` | 이체 `{fromAccountId, bankCode, number, amount, memoTo?, memoMe?}` | **201**, 400(잔액 부족·한도 초과) |
| POST | `/api/reset` | 초기 데이터로 | 204 |

에러는 항상 `{ code, message, fields? }` 모양 → 패널이 `message`를 그대로 토스트로 띄움.

### 연습 포인트
- **상태코드 의미**: 만들기 성공은 201, 지워서 돌려줄 게 없으면 204, 입력 잘못은 400, 없으면 404, 이미 있으면 409
- **서버 검증**: 패널에서 막아도 서버가 다시 검사 (금액 0, 1천만원 초과, 잔액 부족, 계좌번호 자릿수, 중복 계좌…)
  → `curl`로 직접 이상한 값을 보내보면 왜 필요한지 보임
- **파생 데이터**: "거래 후 잔액"은 저장하지 않고 조회할 때 계산 → 거래를 지우거나 잔액을 바꿔도 내역이 항상 맞음
- **캐시 무효화**: POST/PATCH/DELETE 성공 → `invalidate()` → `useApi`를 쓰는 모든 화면이 자동으로 다시 요청
  (React Query의 `invalidateQueries`, SWR의 `mutate`가 하는 일과 같음)
- **stale-while-revalidate**: 한 번 받은 데이터는 캐시에서 즉시 보여주고 뒤에서 새로 받음.
  스플래시 동안 `prefetch("/api/home")` 해 두어서 홈은 처음부터 바로 뜸

### 🔔 관리 패널 — "버튼과 숫자 입력만"
화면(홈, 계좌, 거래 상세)은 **보기 전용**이고, 바꾸는 건 전부 종 버튼 패널에서 합니다.
- **기본**: 지금 프로필·프로필 바꾸기, Galaxy/iPhone, 시스템/라이트/다크, 이름·카드 끝 4자리, 빈 상태로/예시 데이터로
- **계좌**: 계좌를 눌러 펼치면 잔액 수정, 다른 은행이면 계좌번호 수정·삭제. 은행선택 목록(이체 화면과 같은 컴포넌트)에서 골라 새 계좌 추가
- **받는 분**: 이체 때 계좌번호로 찾을 상대 계좌(은행·번호·예금주) 관리
- **거래**: 계좌 칩 → 금액(+1천/+5천/+1만/+5만) → 거래처 칩 → 종류 → 입금하기/출금하기. 최근 거래 ✕로 삭제

입력칸이 숫자만 받고 자동으로 `-`·`,`를 넣는 이유: "형식 맞추기"를 사용자에게 시키지 않기.
같은 패턴 배열(`[3,3,6]`)로 서버는 저장 형식을, 화면은 입력 중 표시를 만든다.

### 수정 폼에서 effect로 값 채우지 않기
"데이터가 오면 `useEffect`에서 `setForm(data)`"은 흔하지만, 렌더가 한 번 더 일어나고 재요청 때 입력 중인 값을
덮어쓸 수 있습니다. 대신 `draft` state를 `null`로 두고 `draft ?? account.balance`를 보여줌 →
안 건드렸으면 서버 값, 건드리면 입력값. 저장하면 `setDraft(null)`.

## 13. 새 영상 디테일 구현 방법

### 글자 위를 지나가는 색 띠 (`.cashback__sweep`)
```css
background: linear-gradient(90deg, 글자색 0 22%, 노랑, 초록, 하늘, 파랑, 하늘, 초록, 노랑, 글자색 78% 100%);
background-size: 400% 100%;      /* 그라데이션을 글자 폭의 4배로 */
-webkit-background-clip: text;   /* 배경을 글자 모양으로 오려냄 */
color: transparent;
animation: cash-sweep 10s linear infinite;  /* 0~24%(2.4초)만 100%→0%로 이동, 나머지는 멈춤 */
```
양 끝이 원래 글자색이라 멈춰 있을 땐 그냥 검은 글씨. 다크 모드에선 `var(--home-text)`가 흰색이라 그대로 동작.

### 무한 루프 캐러셀
`[마지막 복제, 1, 2, 3, 첫 번째 복제]`로 깔고, 복제본에 도착하면 `transitionend`에서 애니메이션을 끈 채
진짜 위치로 순간이동. 자동 넘김 타이머는 `index`가 바뀔 때마다 새로 걸어서, 손으로 넘긴 직후 바로 또 넘어가지 않게.
드래그 중엔 리렌더 없이 DOM transform만 직접 바꿈 (10번 성능 해설과 같은 원리).

### 흰 배경 이미지 녹이기 + 함정
배너 이미지는 흰 배경째 잘려 있습니다. `mix-blend-mode: multiply`는 흰색을 투명처럼 만들어 주는데,
**부모에 `will-change: transform`이 있으면 독립 레이어(투명 배경)가 생겨서 섞일 대상이 없어 효과가 사라집니다.**
레이어에 배경색을 깔아서 해결. (결국 실제 앱 배경이 흰색이라 지금은 자연스럽게 맞음)

## 14. 이체 — 예금주 조회와 "전부 아니면 전무" (`screens/transfer/`, `server/index.mjs`)

### 화면 흐름 (영상 2026-10-28)
```
홈 [이체] ─▶ /transfer?from=main        내 계좌 / 최근 이체 / [+ 계좌번호 직접입력]
              └ 시트: 은행선택 → 계좌번호(키패드) → GET /api/transfer/lookup → 예금주 이름
           ─▶ /transfer/amount (state: {from, to})   금액 키패드 → [다음] → 표기 2줄 → [다음] → 확인 시트
           ─▶ POST /api/transfers ─▶ /transfer/done (replace)   [확인] = navigate(-2) → 홈
```
- **받는 분 정보는 주소가 아니라 `location.state`로** 넘김: 이름·은행·번호 묶음이라 URL에 넣기 번거롭고,
  ScreenStack이 화면마다 자기 location을 들고 있어서 뒤로 갔다 와도 그대로 남음.
  새로고침하면 state가 없으니 홈으로 돌려보냄
- **완료 화면은 replace**: 완료 후 뒤로가기로 금액 화면에 돌아가 "한 번 더 보내기"가 되면 안 되니까.
  기록이 [홈, 이체, 완료]가 되므로 확인 = `navigate(-2)`
- **시트는 항상 DOM에 두고 transform으로만 올리고 내림** (`components/Sheet.tsx`) → 닫힐 때도 애니메이션.
  시트가 열리면 `useStatusBar("#808080")`로 상태바까지 어둡게 (영상처럼)
- **키패드 입력 계산은 순수 함수 하나**(`lib/keypad.ts`의 `applyKey`): 앞자리 0, 최대 길이, 지우기를 한 곳에서.
  금액 화면(00 있음)과 계좌번호 시트(빈칸)가 같은 함수를 씀
- **금액이 위아래로 안 움직이게**: "일 200,000원" 안내 줄이 사라져도 빈 줄로 자리를 남겨 둠

### 예금주 조회를 어떻게 흉내 냈나
진짜 은행은 계좌번호를 넣으면 금융결제원 망으로 상대 은행에 "이 계좌 주인 누구야?"를 물어봅니다.
여기선 그 상대 은행 역할을 `payees` 표가 합니다. 🔔 패널에서 미리 등록한 계좌만 이름이 나오고,
없으면 404 `ACCOUNT_NOT_FOUND` → "입력하신 계좌정보를 확인해 주세요". 내 계좌(카카오뱅크 통장·추가한 다른 은행)는 등록 없이 찾아짐.

### 서버에서 꼭 다시 검사하는 것
- 받는 분은 **화면이 보낸 이름을 믿지 않고** 서버가 (은행, 번호)로 다시 찾는다 → 이름 위조 불가
- 잔액 부족, 같은 계좌로 보내기, 1천만원 초과
- 출금 거래 + (내 계좌면) 입금 거래 + 잔액 두 군데 + 이체 기록 → **`transaction()` 하나로 묶음**.
  중간에 하나라도 실패하면 전부 ROLLBACK → "돈은 빠졌는데 안 들어갔다"가 생길 수 없음
- 통장에 찍히는 이름: 내 통장엔 `나에게 표기`(없으면 받는 분 이름), 받는 통장엔 `받는 분에게 표기`(없으면 내 이름)

### 최근 이체 = 계산
"최근 이체 목록"을 따로 저장하지 않고 `transfers`를 (은행, 번호)로 GROUP BY 해서 마지막 시각순으로 뽑음.
☆는 받는 분(`payees.favorite`)에 저장 → 받는 분 등록이 지워진 상대는 별을 못 누름.

### 예전 DB 고치기 (마이그레이션)
mini를 없애고 세이프박스를 추가하면서 테이블 모양이 바뀌었습니다. `CREATE TABLE IF NOT EXISTS`는 표가 이미 있으면
아무것도 안 하므로, VPS에 있던 bank.db는 `db.mjs` 맨 위에서 `PRAGMA table_info`로 컬럼을 확인하고
`ALTER TABLE ... ADD COLUMN safebox` / `DROP COLUMN mini_account_no` + mini 계좌 삭제(CASCADE로 거래도 정리)를 직접 실행합니다.
진짜 서비스에선 이걸 번호 붙은 마이그레이션 파일(001_..., 002_...)로 관리합니다.

## 15. 프로필 — 넷플릭스처럼 고르고, 프로필마다 따로 저장 (`src/profile/`, `server/db.mjs`)

### 데이터를 어떻게 나눴나: 프로필마다 DB 파일 하나
```
server/data/app.db               profiles(id, name, avatar, color, os, theme, created_at)
server/data/profiles/p1a2b3c4.db  그 프로필의 profile/accounts/transactions/payees/transfers
```
- 다른 방법은 모든 표에 `profile_id` 칸을 넣는 것. 그러면 **모든 쿼리에 `WHERE profile_id = ?`를 빠짐없이** 붙여야 하고,
  하나라도 빼먹으면 다른 프로필 데이터가 보임. 파일을 나누면 기존 쿼리를 그대로 쓸 수 있고, 삭제도 파일 지우기로 끝
- 대신 프로필끼리 데이터를 합쳐 보는 기능(전체 통계 등)은 어려워짐 → 이 앱엔 필요 없어서 파일 분리를 택함

### 요청마다 "어느 DB?" — 헤더 + AsyncLocalStorage
- 화면은 모든 요청에 `X-Profile: <id>` 헤더를 붙임 (`api/client.ts`)
- 서버 미들웨어가 헤더로 그 프로필 DB를 열고 `runWithDb(그 DB, next)`로 나머지 처리를 감쌈.
  그 안에서 불리는 함수들은 그냥 `db()`만 부르면 지금 요청의 DB가 나옴 (Node의 `AsyncLocalStorage`:
  요청 하나의 흐름을 따라다니는 "보이지 않는 인자". `setTimeout`으로 미뤄도 따라감)
- **id가 파일 이름이 되므로 형식 검사 필수**: `/^p[0-9a-f]{8}$/`. 안 하면 `X-Profile: ../../server/x` 같은 값으로
  엉뚱한 파일을 열 수 있음 (경로 조작 공격)
- DB 연결은 `Map`에 열어 두고 재사용. 프로필을 지울 때는 연결을 닫은 뒤 `-wal`, `-shm` 파일까지 지움

### 화면 쪽: 언제 다시 고르게 하나
- 고른 프로필 id는 **sessionStorage**: 탭을 닫으면 사라짐 → 다음에 들어오면 다시 고르기(넷플릭스처럼).
  새로고침은 같은 세션이라 유지됨
- 기기/테마는 앱이 켜질 때 한 번 정해지는 값(`OS`, `THEME` 상수)이라, 프로필 설정이 지금과 다르면
  `/?os=…&theme=…`로 **다시 불러와서** 적용. 켜질 때마다 지금 설정을 그 프로필에 PATCH 해 두므로
  스위치나 🔔에서 바꾼 것도 자동으로 그 프로필에 저장됨
- 쓰던 프로필이 다른 창에서 지워졌으면 그 PATCH가 404 → 프로필 고르기로 돌려보냄

## 16. 화질과 누끼 — 원본이 전부다

- 화면 녹화는 폭 480px(= 화면 1dp당 1.33px)이라, 34dp 아이콘이 45px밖에 안 됨. 2배 화면(레티나)에선 68px가 필요해서 흐림.
  **스크린샷(720px, 1dp당 2px)** 에서 자르면 딱 2배 화면에 맞는 선명도. 업스케일은 흐린 걸 크게 할 뿐 선명해지지 않음
- **누끼(배경 빼기)**: 흰 배경을 그냥 `colorkey`로 지우면 그림 안의 흰 부분(카드 무늬)까지 구멍이 남.
  → 테두리에서부터 배경색을 따라 들어가는 **flood fill**로 "바깥과 이어진 흰색"만 지움 (`scripts/extract-screenshots.py`)
- **흰 테두리(halo) 없애기**: 경계 픽셀은 그림 색과 흰 배경이 섞여 있어서, 투명하게만 하면 다크 모드에서 하얀 테두리가 보임.
  섞인 색 = 원래색·α + 흰색·(1-α) 를 거꾸로 풀어 원래색과 α를 되찾음 (`(c - (1-α)·255) / α`). 포토샵의 "Defringe"와 같은 원리
- 동그라미 아이콘은 4배 크기로 원을 그린 뒤 줄여서 마스크로 → 가장자리가 계단 없이 부드러움. 1px 안쪽까지만 잘라 흰 테두리 방지
- 특수 글자체 로고(AND2BLE)는 글꼴로 흉내 내지 말고 이미지로. 노란 배경의 검은 글자라 초록 채널 밝기로 투명도를 계산
  (노랑 G≈222, 검정 G≈0) → 글자 가장자리의 반투명까지 살아 있음

## 17. 캡쳐모드 — CSS 속성 하나로 켜고 끄기

`<html data-capture="on">`만 붙이면 CSS가 폰 테두리·그림자·둥근 모서리·아래 스위치를 숨기고 화면을 가운데에 둠.
React 상태가 아니라 DOM 속성이라 **새로고침 없이** 바로 바뀌고, localStorage에 기억해서 다시 열어도 유지
(`src/platform/capture.ts`). 기기·테마도 같은 방식(`data-os`, `data-theme`)이라 규칙을 맞춤.

## 18. 화면 녹화 — 탭 화면 받아서 폰만 자르기 (`src/platform/recorder.ts`)

1. `navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })` → 사용자가 "이 탭"을 허락하면 탭 화면 영상(MediaStream)
   - 버튼 클릭 안에서 바로 불러야 함(보안상 사용자 동작 필요). 크기를 안 정하면 720p 정도로 낮춰 주므로 `width/height: { ideal: 큰 값 }`
2. 폰 부분만 자르기
   - 크롬/엣지 **Region Capture**: `CropTarget.fromElement(폰)` → `track.cropTo()` — 브라우저가 잘라 줘서 가장 선명하고 가벼움
   - 그 밖의 브라우저: `<video>`로 받아 매 프레임 `<canvas>`에 폰 영역만 `drawImage` → `canvas.captureStream(60)`
3. `MediaRecorder`로 녹화. `isTypeSupported`로 mp4(h264) → 안 되면 webm. 멈추면 Blob → `<a download>`로 저장
   - 브라우저의 "공유 중지"로 멈춰도 `track`의 `ended` 이벤트에서 저장
4. 녹화 상태는 React 바깥 모듈 변수 + `useSyncExternalStore` → 패널(시작)과 위쪽 막대(정지)가 따로 떨어져 있어도 같은 상태를 봄
5. "녹화 중" 막대는 폰 바깥 `position: fixed` → 잘린 영역 밖이라 영상에 안 찍힘. 녹화하는 동안 캡쳐모드로 테두리도 숨김

폰 브라우저는 `getDisplayMedia`가 없어서 녹화 불가 → 버튼 대신 "폰 자체 화면녹화를 쓰세요" 안내.

## 19. 두 번째 앱 (NH 콕뱅크) — 같은 코드, 서버(포트)만 따로 (`src/nh/`, `server/db.mjs`)

### 서버 하나 = 앱 하나
처음엔 프로필 화면에서 앱을 고르고 `X-App` 헤더로 DB를 나눴는데, 두 앱을 **포트로 완전히 분리**하는 쪽으로 바꿨습니다.
`APP=nh`(또는 `--app nh`)로 띄우면 그 서버는 콕뱅크만: 데이터 폴더가 `server/data-nh/`라서 프로필 목록부터 따로.
**API 코드는 그대로** — `/api/home`, `/api/transfers`가 두 앱에서 똑같이 동작하고 데이터만 다릅니다.
앱마다 다른 것만 `db().app === "nh"`로 분기(1일 송금 한도, 받는 분 목록의 `dailyRemaining`).
`SEEDS = { kakao: {...}, nh: {...} }` — 새 프로필, 되돌리기(`/api/reset`), 첫 실행 예시 데이터가 앱에 맞게.

### 화면은 빌드 하나 — 어느 앱인지는 서버가 HTML에 끼워 줌
`npm run build` 결과(dist)는 두 서버가 같이 씁니다. 서버가 `index.html`을 줄 때
`<script>window.__BANK_APP__ = "nh"</script>`를 넣고(`express.static(..., { index: false })`로 `/`도 직접 처리),
화면은 `session.ts`의 `APP` 상수로 읽습니다. 개발 서버(Vite)엔 이 단계가 없어서 `npm run dev:nh`가 `VITE_APP=nh`를 넣어 줍니다.
포트가 다르면 브라우저 입장에선 **다른 사이트(origin)** 라서 sessionStorage·localStorage(고른 프로필, 기기, 테마)도 저절로 따로.

### 화면: 라우트 묶음을 통째로 바꾸기
`App.tsx`는 `APP`에 따라 `ScreenStack`에 다른 `render` 함수(`renderRoute` / `renderNhRoute`)를 줍니다.
주소(`/send`, `/history/:id`)는 겹쳐도 됩니다 — 한 서버에선 한 앱만 그려지니까.

### 한 화면이 단계별로 바뀌는 송금 (`NhSend`)
카카오뱅크 이체는 화면마다 주소가 달랐지만, 콕뱅크 영상은 **같은 화면의 위쪽이 바뀌고 시트가 올라오는** 구조라
`stage: "who" | "amount" | "memo"` 상태 하나로 그렸습니다. 뒤로가기(←)도 단계를 하나씩 되돌립니다.
확인 화면부터는 다시 주소(`/send/confirm` → `/send/done`은 `replace`)로 나눠서 브라우저 뒤로가기와 맞춥니다.

### "6개월간 보낸 적 없는 분" 판단
서버가 최근송금 목록에 마지막으로 보낸 시각 `lastAt`을 같이 주고, 화면이 `Date.now() - lastAt < 183일`인지 계산.
내 계좌로 보내는 건 확인 시트를 건너뜁니다. (저장하지 말고 계산하기 — 7번과 같은 원칙)

### 거래메모 = 자동 저장
`PATCH /api/transactions/:id {memo}`. 입력이 0.5초 멈추면 저장(디바운스: effect 안의 `setTimeout` + cleanup에서 `clearTimeout`).
송금 확인 화면에서 쓴 메모는 송금 응답의 `outTxId`(내 통장 출금 거래 id)로 바로 저장합니다.

### 함정: 짧은 클래스 이름 충돌
완료 화면의 체크 아이콘 뒤에 흰 네모가 생겼는데, 카카오뱅크 완료 화면 CSS의 `.done { background: #fff }`가
콕뱅크의 `className="done"`에도 걸린 것. CSS는 전역이라 **`done`, `on` 같은 짧은 이름은 BEM 수식어(`nh-done__mark--done`)로**.

### 이미지: 사각형 자르기 vs 누끼
콕뱅크는 다크 화면 하나뿐이라 그림이 놓이는 바탕색이 정해져 있어서 대부분 **사각형 그대로** 자르고 CSS 바탕색을 같은 색으로 맞췄습니다.
단, 지식콕·금융콕 카드는 바탕이 위→아래 살짝 그라데이션이고 둥근 모서리가 걸려서 테두리가 보였음 →
`cutout_on(..., also=[페이지색])`으로 카드색과 페이지색을 둘 다 투명하게 (`scripts/extract-nh.py`).

### 버튼 누르면 "어둡게 + 점 3개" (`src/nh/loading.ts`)
콕뱅크는 메뉴를 누르면 바로 넘어가지 않고 화면 전체가 어두워진 채 점 3개가 잠깐 돈 뒤에 다음 화면이 뜹니다.
화면마다 상태를 두지 않고 **작은 전역 저장소**(`count` + 구독 함수들)를 만들어 `useSyncExternalStore`로 읽고,
`App`이 그 위에 덮개(`NhLoadingLayer`) 한 장만 그립니다. 화면에선 `navigate` 대신 `useNhGo()`의 `go(주소)`를 쓰면
`withNhLoading` → 최소 0.55초 보여준 뒤 이동. 서버 요청도 `withNhLoading(() => api.xxx())`로 감싸면 같은 모양.
녹화를 프레임 단위로 보면 **화면은 덮개 아래에서 바뀌고**, 덮개는 새 화면이 한 번 그려진 뒤에 걷힙니다
(`navigate` → 90ms → `requestAnimationFrame` 두 번 → `count--`). 그래서 덮개가 걷히는 순간 이미 다음 화면이 보임.

### 은행 로고 흰 테두리
은행 아이콘은 카카오뱅크(흰 화면)에서 잘라 와서 가장자리에 흰 픽셀이 남아 있었고, `BankIcon`이 흰 바탕+옅은 테두리까지 깔아서
어두운 콕뱅크 화면에선 흰 링이 보였음 → 콕뱅크 전용 `NhBankIcon`: 동그라미로 자르고(`overflow: hidden; border-radius: 50%`)
그림을 1.1배 키워서 가장자리를 원 밖으로 밀어냄. 농협은 콕뱅크 목록의 노란 동그라미(`nh-bank.png`)를 따로 잘라 씀.

### 숨은 함정: 세로 flex 안의 `overflow: auto`
거래내역 칩 줄에 아래 여백을 늘렸는데 화면에 안 바뀜. 화면이 `flex-direction: column`이고 칩 줄이 `overflow-x: auto`라
**min-height가 0**이 되어서, 내용이 화면보다 길면 칩 줄이 세로로 눌려 줄어든 것. `.screen.nh > * { flex-shrink: 0 }`.

### 픽셀 단위로 맞추기 (스크린샷·녹화와 겹쳐 보기)
- **기준 크기부터**: 스크린샷 폭 720px, 녹화 480px → 같은 화면이 384dp가 되는 비율(1.875, 1.25)이라 폰 폭은 384dp.
  콕뱅크일 때만 `<html data-app="nh">`로 프레임을 384 × 853.33으로 바꿈 (카카오뱅크 412는 그대로).
- **글꼴**: 글자 모양을 비교해 Pretendard로 확인. 자간 -0.01em, 굵기 400/500/600만 씀.
- **0.5dp 선**: 크롬은 1px보다 얇은 `border`를 1 CSS px로 올려 그려서 두꺼워짐 →
  `box-shadow: inset 0 0 0 0.5333px 색`으로 그리면 얇은 선이 그대로 나옴.
- **소수점 위치**: `top`/`left`/`height`는 CSS px 단위로 반올림돼 그려지는 경우가 있어서, 0.3px 같은 미세 조정은
  `translate`로 (예: 헤더 제목 `translate: 0 -1.4px`).
- **움직임**: 녹화를 0.25초(필요하면 프레임마다) 잘라서 위치·불투명도를 재고 곡선을 맞춤.
  안드로이드 화면 전환은 80ms(들어올 때)/100ms(나갈 때) 직선 페이드, 키패드 시트는 열림 410ms `cubic-bezier(.2,1,.4,1)`,
  닫힘은 끝까지 내려가지 않고 176dp만 내려가며 200ms 동안 투명해짐.
- **확인 → 뒤로**: 확인 화면에서 X를 누르면 송금 화면이 처음이 아니라 **방금 단계(메모 입력)** 로 돌아옴.
  이동하기 직전에 지금 단계를 `navigate(같은 주소, { replace: true, state: { restore } })`로 기록해 두고 다시 그릴 때 꺼냄
  (`src/nh/nhSendRestore.ts`). "받는 분을 다시 입력할게요."만 처음 단계부터.
- 비교는 `overlay`(두 그림 반씩 섞기)와 가장자리(edge) 비교로. 남는 차이는 가짜 이름·번호 글자와 상태바 시계뿐.

### 일반 홈 (청소년 홈이 아니라) — 공식 사진 + 녹화로 다시 만들기
처음 만든 홈은 알고 보니 **청소년 모드** 홈이었습니다. 콕뱅크는 모드(일반·청소년·큰글…)마다 홈이 달라서,
앱스토어 공식 스크린샷(밝은 모드, 계좌 여러 개)으로 구조를 보고 사용자가 보내 준 다크모드 녹화로 크기·색을 맞췄습니다.
- **긴 화면 재기**: 스크롤하는 녹화 프레임끼리 겹치는 부분을 찾아(밝기 차가 가장 작은 세로 이동량) 한 장의 긴 페이지 그림으로 이어 붙인 뒤
  그 위에서 위치를 잼. 위에 붙어 있는 헤더(접힌 계좌 카드) 아래만 비교해야 맞음.
- **둥근 모서리 함정**: 카드 위·아래 끝을 카드 왼쪽 끝 가까이(x 30)에서 재면 모서리 곡선 때문에 4~5dp 안쪽으로 잡힘 → 카드 가운데 쪽에서 재기.
- **가운데 카드만 큰 가로 목록**(콕추천): 카드 상자는 모두 같은 높이(116.4)로 두고 흰 바탕을 `clip-path: inset(5.9px 0 round 20px)`로
  깎았다가 가운데 카드만 0 으로 → 글자 위치는 그대로고 바탕만 커짐.
- **접히는 위 영역**: 스크롤이 140dp 를 넘으면 위에 작은 카드(번호 ⌄ / 잔액 [송금])를 따로 그려 붙이고, 탭바는 아래로 숨기고 ↑ 버튼을 보임.
- **글자 위치 공식**: Pretendard 는 `line-height: 1` 일 때 한글 잉크 가운데가 top + 0.54em → 녹화에서 잰 잉크 가운데로 top 을 바로 계산.
- **흰 카드 안 그림 자르기**: 카드가 흰색이라 바탕을 투명하게 할 필요 없이 사각형으로 자르되, 그림 옆 글자는 지움
  (무채색 어두운 픽셀 = 검정·회색 글자, 분류 글자는 그 색과 흰색 사이 색) — 화면에서 진짜 글자를 그 위에 다시 그림.
- **`.nh button { color: inherit }`(공용)**이 `.클래스` 하나짜리 글자색보다 우선이라 버튼 글자색이 안 바뀜 → 버튼 규칙 앞에 `.nh-gh-wrap`.

### 라이트모드 — "요소마다 같은 자리 색 재기" 도구
라이트 화면을 새로 그리지 않고 **같은 레이아웃에 색만** 바꿨습니다 (`src/nh/nh-light.css`, `html[data-theme="light"]` 아래).
1. 내 화면(다크)을 녹화와 같은 상태로 띄워, 보이는 요소마다 위치·배경색·글자색·선색을 뽑음 (Playwright + `getComputedStyle`)
2. 라이트 녹화의 같은 자리에서 배경 = 가장 많은 색, 글자/선 = 배경과 가장 다른 픽셀들의 가운데 값을 잼
3. "다크 색 → 라이트 색" 표가 나오면 공용 색 토큰(`--nh-text`, `--nh-field` …)부터 바꾸고, 하드코딩된 색은 규칙을 덮어씀
- **우선순위 함정**: `html[data-theme=light] .nh-as__value { color: 회색 }`가 `.nh-as__value.error { 빨강 }`보다 셀렉터가 세서
  잔액 부족 빨간 글씨가 회색이 됨 → 라이트 규칙은 `:not(.filled)`처럼 상태를 빼고 씀.
- **녹화가 검정인 화면**: 라이트 녹화에서 로딩·금액 키패드 시트 때 화면 전체가 새까맸는데, 같은 날 다크 녹화도 그랬고 전날 다크 녹화는 반투명 막.
  보안 화면(키패드)을 화면 녹화기가 가린 것으로 보고 실제 화면처럼 반투명 막(0.6) 그대로 둠.
- **다크에서 자른 그림**(완료 동전·메시지 타일·방패 등)은 바탕이 어두운 사각형 → 픽셀마다 가장 가까운 다크 바탕색과의 거리로
  덮인 정도를 어림해 라이트 바탕 위에 다시 섞음 (`scripts/nh-crops/light-variants.py`, `nhPic()`이 `-light` 그림을 고름).
- 상태바는 화면마다 `useNhStatusBar(다크색, { dim, black })` 하나로: 라이트면 흰 바탕 + 어두운 글자.

