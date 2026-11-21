# 화면녹화 타임라인 — 우리WON뱅킹 v1·v2 (프레임 단위)

같은 폰·같은 날 같은 앱(우리은행 '우리WON뱅킹' 안드로이드)을 두 번 나눠 찍은 영상 두 개다. **앱은 하나**를 만들고, 한쪽에만 나온 화면은 그 영상이,
두 영상에 다 나온 화면은 둘 다 기준이다(같은 상태면 픽셀이 같다 — 7절).

| 이름 | 파일 (git 제외) | 길이 | 크기 | 원본 프레임 | 상태바 시계 | 잔액 |
|---|---|---|---|---|---|---|
| **v1** (gzhk9p) | `tools/ref/video/v1.mp4` → 손잡이 지운 `v1-clean.mp4` | 200.483 s | 524x1280 | 7590장 #0–#7589 (VFR, 평균 37.9fps, 최소 간격 16.0ms) | 11:05–11:09 | 345원 → 1원 이체 → 344원 |
| **v2** (3k3eqy) | `tools/ref/video/v2.mp4` → `v2-clean.mp4` | 90.896 s (마지막 pts 90.880) | 524x1280 | 3441장 #0–#3440 (VFR, 평균 37.9fps) | 11:16–11:17 | 344원 → 2원 이체 → 342원 |

> **개인정보**: 사람 이름·계좌번호는 더미로만 적었다 — 이체 받는 분이자 거래 상대(표시 "농협정우진"·"카카정우진"·"토뱅/토스 정우진") **정우진**,
> 입금 +100,000원 상대 **한지호**, 내 WON 통장 **1002-123-456789**, 정우진의 지역농축협 계좌 **12345652789012**, 카카오뱅크 계좌 **3333123456789**.
> 금액·날짜·시각·회사/가맹점 이름은 영상 그대로. OS 메신저 알림의 보낸 사람·글은 적지 않는다. 키보드로 친 숫자·눌린 키 위치(계좌번호가 드러남)도 적지 않고 시각만 적는다.

## 0. 읽는 법

- **VFR**: 화면이 바뀔 때만 프레임이 기록된다(정지 화면에선 수백 ms 동안 프레임이 없다). **"시각 t 의 화면" = pts ≤ t 인 마지막 원본 프레임.**
  pts 는 `python3 tools/woori_video.py pts --video v1` 캐시.
- **#번호** = 원본(디코드 순서) 프레임 인덱스. `*-clean.mp4` 와 원본은 pts·프레임 순서가 같아 그대로 쓴다.
  기준 프레임: `python3 tools/woori_video.py ref --video v1 --i0 '#365' --i1 '#388' --out tools/ref/<group>/<state>.png` (구간 i0..i1 포함, 중앙값).
- **t0–t1**: t0 = 구간 첫 프레임 pts, t1 = **다음 구간 첫 프레임 pts**(그 직전까지 이 상태가 보임). **프레임 #i0–#i1** 은 둘 다 포함.
  구간은 빈틈없이 이어진다 — v1 #0–#7589 209구간, v2 #0–#3440 110구간. ms = t1 − t0.
- **종류**: HOLD = 앱 화면 정지(스피너·커서·OS 알림처럼 작은 부분만 움직이면 HOLD + 기준 프레임 마스크), CHANGE = 전환·스크롤·애니메이션·단계적 그리기.
- **화면 id / 상태 id** = 구현 기준 목록(inventory)의 이름 그대로: 화면 21개, 상태 `<화면>:<이름>`. 그룹 스펙(`spec/<group>.json`)의 상태 id 는
  그룹이 정하고, 그 기준 구간은 4절 표(생성물)에 모인다. **그룹** = 화면의 주인 그룹(launch · home · history · history-detail · send-a · send-b · done, `자름` = 앱 밖/보안 화면).
- **전환 id** = inventory 전환 목록(9절)의 id. "동작 `…`" = inventory 동작 id(스크롤·눌림·키보드·스피너 등 화면 안 동작). `—` = 해당 없음.
- **좌표** = frame px (524x1280, 화면 절대). 상태바 y 0–45.576 (기본 마스크 `0,0,524,46`), 3버튼 내비 바 y 1210.182–1280 (`0,1210,524,70`).
  세로 dp = px × 0.6875 (앱 안 = − 31.333), 가로 x_dp = 180 + (x_px − 262.02) / 1.45803.
- **1단계 측정(참고)** 열은 구간을 나눈 1단계 측정값(원본 영상, 같은 pts)이다. 이징 맞춤 일부(특히 v2)는 녹화 시각 ±8.5ms 흔들림을 허용해 rms 가 작게 나왔다 —
  **확정 곡선·길이는 각 그룹 스펙(`spec/<group>.md` 3절)이 clean 영상으로 흔들림 허용 없이 다시 잰 값을 쓴다(D8).** 이 표의 값은 길잡이다.
- 공통 로딩 스피너: 남색·하늘색 원호 2개, 68x68px, 중심 **(262,628)** (홈 위에서는 **(262,585)**), 페이드 없이 한 프레임에 나타나고 사라짐(10.2절).
  버튼 눌림: 파랑 `#2387F3`(`#2487F2`) → `#195CA5`.
- 1단계 전사에서 고친 글자(영상 확대로 확인): 조회조건 첫 칸 "이번달", "상세조건조회 ⌄", 거래 상세 "수표금액 0원", 배너 4 "환전주머니 채우면",
  배너 7 "가볍게 뽑아보세요", 배너 8 "CU에서 틴틴카드 쓰면", v2 이체 거래 표시 이름 "카카정우진"("카카" 접두어를 붙여 씀).

## 1. 한눈에 보기

### 1.1 v1 (gzhk9p, 200.483 s)

| 구간 (s) | 프레임 | 화면 | 그룹 | 사용 |
|---|---|---|---|---|
| 0.000–1.748 | #0–#51 | 런처 (앱 밖) | 자름 | 자름 |
| 1.748–2.841 | #52–#91 | 스플래시 | launch | 사용 (splash) |
| 2.841–7.395 | #92–#129 | 보안 검은 화면 (인증서 PIN 입력 추정) | 자름 | 자름 |
| 7.395–9.242 | #130–#231 | 우리WON인증서 PIN 완료 + 스피너 | launch | 사용 (cert-pin) |
| 9.242–11.633 | #232–#308 | 로그인 로딩(캐릭터) → 홈 단계적 그리기 | launch, home | 사용 (login-loading, home-loading; 캐릭터는 대체 그림) |
| 11.633–13.139 | #309–#364 | 홈 진입 프로모션 팝업(바텀시트) + 잔액 굴림 | home | 사용 (home-popup) |
| 13.139–30.683 | #365–#1197 | 홈 1차: 배너 자동/스와이프, 스크롤, 계좌 카드 탭 | home | 사용 (home) |
| 30.683–40.664 | #1198–#1627 | 거래내역 1차 로딩 + 전체 목록 스크롤 | history | 사용 (history-loading, history) |
| 40.664–58.962 | #1628–#2327 | 조회조건 시트 → 입금 목록 스크롤 2회 | history | 사용 (history-filter-sheet, history) |
| 58.962–82.414 | #2328–#3414 | 조회조건 → 출금 목록 긴 스크롤 | history | 사용 |
| 82.414–97.146 | #3415–#3773 | 조회조건 → 입금, 상세 ①(입금) | history, history-detail | 사용 (history-detail) |
| 97.146–106.196 | #3774–#3951 | 조회조건 → 출금, 상세 ②(출금), 뒤로 | history, history-detail | 사용 |
| 106.196–120.038 | #3952–#4531 | 홈 2차: 다시 그리기, 스크롤, 배너 › 넘김, 계좌 카드 탭 | home | 사용 (home 고유 상태 포함) |
| 120.038–125.103 | #4532–#4697 | 거래내역 2차 로딩 | history | 사용 (1차와 같은 순서 — 기준 프레임은 1차, 2차는 타이밍 교차 확인) |
| 125.103–157.534 | #4698–#6070 | 조회조건 → 입금, 아주 천천히 스크롤, 상세 ③, 맨 위로 | history, history-detail | 사용 (느린 스크롤 곡선) |
| 157.534–175.468 | #6071–#6914 | 조회조건 → 출금, 10월까지 긴 스크롤 후 맨 위로 | history | 사용 |
| 175.468–186.449 | #6915–#7162 | 이체: 보낼 곳 → 금액 1원 → 중복 경고 시트 | history, send-a, send-b | 사용 (send-*) |
| 186.449–189.586 | #7163–#7240 | 보안 검은 화면 + 비밀번호 시트 누출 | 자름, send-b | 검은 화면 186.449–188.273 **자름** · 188.273–188.674 비밀번호 시트는 **레이아웃 기준**(D3) · 188.674– 처리 중 사용 |
| 189.586–197.452 | #7241–#7523 | 이체 확인 → 이체 → 완료 | send-b, done | 사용 (send-confirm, send-done) |
| 197.452–200.483 | #7524–#7589 | 거래내역 (잔액 344원) | history | 사용 |

### 1.2 v2 (3k3eqy, 90.896 s)

| 구간 (s) | 프레임 | 화면 | 그룹 | 사용 |
|---|---|---|---|---|
| 0.000–0.515 | #0–#14 | 시작: 거래내역 (v1 끝 상태) → 홈으로 | history | 사용 (v2 녹화 시작 — v1 끝과 같은 데이터, 필터만 출금 · 7.1절) |
| 0.515–4.974 | #15–#114 | 홈 다시 그리기 · 잔액 굴림 · 배너 자동 넘김 · 계좌 카드 탭 | home | 사용 (home-loading, home; 캐릭터 그림은 대체) |
| 4.974–9.021 | #115–#211 | 거래내역 로딩 → 최상단 (3개월·전체) | history | 사용 (history-loading, history) |
| 9.021–11.438 | #212–#291 | 조회조건 시트 → 입금 | history | 사용 (history-filter-sheet) |
| 11.438–28.199 | #292–#1056 | 입금 목록 스크롤 (손가락 끌기 여러 번) | history | 사용 (history 스크롤 곡선) |
| 28.199–31.203 | #1057–#1133 | 조회조건 시트 → 출금 | history | 사용 |
| 31.203–60.306 | #1134–#2544 | 출금 목록 긴 스크롤 → 플링으로 맨 위 | history | 사용 (스크롤 곡선, 맨 위 복귀 검증) |
| 60.306–63.760 | #2545–#2594 | [이체] → 보낼 곳 “어디로 이체하시겠어요?” | history, send-a | 사용 (send-where) |
| 63.760–71.412 | #2595–#2738 | 계좌번호 직접 입력 (OS 노란 키보드) | send-a | 사용 (send-account-input; 키보드는 OS) |
| 71.412–74.214 | #2739–#2847 | 금융회사 선택 페이지 → 카카오뱅크 → 확인 | send-a | 사용 (send-bank-sheet) |
| 74.214–78.201 | #2848–#2969 | 금액 2원 입력 → 다음 | send-a, send-b | 사용 (send-amount) |
| 78.201–80.852 | #2970–#3021 | 보안: 검은 화면 + 비밀번호 시트 누출 | 자름, send-b | 검은 화면 78.201–80.453 **자름** · 80.453–80.852 비밀번호 시트는 **레이아웃 기준**(D3) |
| 80.852–84.096 | #3022–#3173 | 처리 → 이체 확인 “정우진 님에게 2원을 이체하시겠어요?” | send-b | 사용 (send-confirm) |
| 84.096–87.607 | #3174–#3347 | [이체] → 처리 → 완료 “이체했어요” | send-b, done | 사용 (send-done) |
| 87.607–90.896 | #3348–#3440 | 거래내역 다시 (342원) + OS 입금 알림 | history | 사용 (history; 알림은 OS 마스크) |

## 2. v1 구간표 (209구간, #0–#7589)

열: 시각 t0–t1 · 프레임 #i0–#i1 · 길이 · 종류 · 화면 id · 상태 id · 일어나는 일 · 전환 id · 1단계 측정(참고).

#### v1 0.000 – 1.748 · #0–#51 · 런처 (앱 밖) (자름)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 0.000–0.092 | #0–#2 | 92 | CHANGE | `launcher` | `launcher:keyboard` | 녹화 시작. 삼성 앱 검색(파인더) 화면 + OS 노란 키보드. #0–#2 미세 변화 | — |  |
| 0.092–0.259 | #3–#9 | 167 | CHANGE | `launcher` | `launcher:keyboard-close` | OS 키보드가 아래로 내려감(검색창이 아래로 이동) | — | OS 키보드 |
| 0.259–0.582 | #10–#23 | 323 | CHANGE | `launcher` | `launcher:settle` | 런처 배경 흐림 정리(프레임간 변화 ≤0.11%) | — |  |
| 0.582–1.748 | #24–#51 | 1166 | HOLD | `launcher` | `launcher:idle` | 앱 검색 화면 정지(추천 앱 첫 칸 우리WON뱅킹). 아이콘 탭의 눌림 효과는 녹화에 없음 | — |  |

#### v1 1.748 – 2.841 · #52–#91 · 스플래시 (launch)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 1.748–1.828 | #52–#54 | 80 | HOLD | `splash` | `splash:logo-start` | 앱 실행: 런처 → 스플래시로 한 프레임에 교체(실행 확대 애니메이션 없음). 흰 배경, WON 로고(남색 원이 회색 알약 왼쪽), iF 로고, 우리은행 | `launch-to-splash` |  |
| 1.828–2.110 | #55–#69 | 282 | CHANGE | `splash` | `splash:logo-anim` | WON 로고 애니메이션: 남색 원이 오른쪽으로 35.5px 이동, 지나간 자리가 하늘색 그라데이션으로 채워짐 | `splash-logo` | 원 중심 x 244.0→279.5; 259ms cubic-bezier(0.242,0.0,1.0,1.034) 시작 1.810 rms 0.6 · 이름 곡선 최적 md-accelerate(0.4,0,1,1) 281ms rms 0.77 |
| 2.110–2.841 | #70–#91 | 731 | HOLD | `splash` | `splash:logo-end` | 스플래시 끝 상태 정지 | — |  |

#### v1 2.841 – 7.395 · #92–#129 · 보안 검은 화면 (인증서 PIN 입력 추정) (자름)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 2.841–7.395 | #92–#129 | 4554 | HOLD | `secure-black` | `secure-black` | FLAG_SECURE 로 가려진 검은 화면 (우리WON인증서 PIN 키패드 입력 추정). 상태바·내비 바까지 검정, 우상단에 녹화 표시 점만 | `splash-to-cert` |  |

#### v1 7.395 – 9.242 · #130–#231 · 우리WON인증서 PIN 완료 + 스피너 (launch)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 7.395–8.765 | #130–#207 | 1370 | HOLD | `cert-pin` | `cert-pin:spinner` | 우리WON인증서 화면이 한 프레임에 표시: "6자리 비밀번호를 입력해 주세요", ●●●●●● 6개 모두 채움, ✓ 자동 로그인, 하단 "다른 방법으로 로그인". 가운데 2색 원호 스피너(중심 262,628) 회전 | 동작 `spinner` | 스피너 7.395–8.765 (#130–#207), 중심 [262, 628] |
| 8.765–9.242 | #208–#231 | 477 | HOLD | `cert-pin` | `cert-pin:filled` | 스피너가 페이드 없이 사라짐(8.765). 정지 | `cert-spinner-off` |  |

#### v1 9.242 – 11.633 · #232–#308 · 로그인 로딩(캐릭터) → 홈 단계적 그리기 (launch, home)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 9.242–9.319 | #232–#234 | 77 | HOLD | `login-loading` | `login-loading:blank` | 흰 화면 + 하단 탭바(상품·자산소비·홈·주식·혜택, 홈 선택)만 한 프레임에 표시 | `cert-to-login-loading` |  |
| 9.319–10.011 | #235–#271 | 692 | CHANGE | `login-loading` | `login-loading:character` | 가운데 캐릭터(마스코트) 로딩 애니메이션 x181–344 y532–650 — character: true, 대체 그림 + 비교 마스크 | — | 캐릭터 상자 [181, 532, 143, 118] (대체 그림·마스크) |
| 10.011–10.061 | #272–#273 | 50 | CHANGE | `home-loading` | `home-loading:spinner` | 캐릭터 → 2색 원호 스피너(중심 ≈262,585)로 교체 | 동작 `spinner` |  |
| 10.061–10.229 | #274–#275 | 168 | HOLD | `home-loading` | `home-loading:header-pill` | 좌상단 "일반홈\|쉬운" 토글 알약 표시, 스피너 계속(10.162 프레임은 변화 없음) | — |  |
| 10.229–11.471 | #276–#300 | 1242 | CHANGE | `home-loading` | `home-loading:render` | 홈이 단계적으로 그려짐 (steps 참고): 연파랑 배경·카드 → 헤더 아이콘 → 배너 → 공지카드 → 캐릭터 배너+계좌 스켈레톤 → 계좌 카드 → 잔액 "원" | `home-first-render` | 단계 10.229, 10.312, 10.479, 10.588, 10.647, 10.772, 11.065, 11.090, 11.106, 11.123, 11.173, 11.198, 11.233, 11.257 … |
| 11.471–11.529 | #301–#303 | 58 | HOLD | `home-loading` | `home-loading:nav-black` | 팝업 직전 OS 내비 바가 검정으로 바뀜(11.471). 앱 화면 정지 | — |  |
| 11.529–11.633 | #304–#308 | 104 | CHANGE | `home-loading` | `home-loading:balance-unit` | 잔액 자리 "원"·복사 아이콘·⋮ 가 한 프레임에 표시(11.529) → 공지 종 아이콘 흔들림(11.556–11.577, 2프레임) → 11.594 부터 정지(팝업 직전). [critic-1: 원래 nav-black HOLD 안에 있던 앱 변화를 따로 뗌] | `bell-wobble` | 단계 11.529, 11.556, 11.577 |

#### v1 11.633 – 13.139 · #309–#364 · 홈 진입 프로모션 팝업(바텀시트) + 잔액 굴림 (home)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 11.633–11.767 | #309–#315 | 134 | CHANGE | `home-popup` | `home-popup:open` | 프로모션 바텀시트(보라) 아래에서 올라옴 + 검정 딤 α 0→0.5 | `home-popup-open` `home-popup-behind` | 시트 윗변 최종 y866 (높이 344.2px), 첫 프레임 11.633 윗변 y976; 위치 346ms cubic-bezier(1.0,0.706,0.562,0.935) 시작 11.397 rms 0.69 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 174ms rms 1.47; 딤 최대 α≈0.50 (329ms cubic-bezier(1.0,0.895,0.472,0.933) 시작 11.432 rms 0.0 · 이름 곡선 최적 ease 178ms rms 0.0) |
| 11.767–11.876 | #316–#318 | 109 | CHANGE | `home-popup` | `home-popup:behind-update` | 딤 뒤 홈 갱신: 11.709 "다른 은행 계좌도 홈에서…" 카드 삽입(계좌 카드 194.9px 아래로), 11.783 46.5px 더, 11.809 은행 로고 4개 | `home-popup-behind` |  |
| 11.876–12.461 | #319–#339 | 585 | CHANGE | `home-popup` | `home-popup:balance-roll` | 잔액 숫자 굴림(세로 오도미터) "원" → 345원 (11.876–12.444). 시트 이미지 11.908 표시("해외에서도 놓칠 수 없는 혜택 / 가볍고 결제는 가볍게! …") | `balance-odometer` | 잔액 숫자 세로 굴림(오도미터): 첫 숫자 11.876, 멈춤 12.444 → 345원 |
| 12.461–12.578 | #340–#342 | 117 | HOLD | `home-popup` | `home-popup:idle` | 팝업 정지(하단 흰 띠 "오늘은 그만 보기 \| 닫기") | — |  |
| 12.578–12.687 | #343–#346 | 109 | HOLD | `home-popup` | `home-popup:close-pressed` | "닫기" 눌림: 글자 뒤 회색 사각 #B3B3B4 (12.578–12.687) | 동작 `press-feedback` | 눌림 #FEFEFE→#B3B3B4 |
| 12.687–12.729 | #347–#348 | 42 | HOLD | `home-popup` | `home-popup:close-released` | 손 뗌(회색 사라짐) → 2프레임 뒤 시트 내려가기 시작 | — |  |
| 12.729–12.971 | #349–#355 | 242 | CHANGE | `home-popup` | `home-popup:close` | 시트 내려감 + 딤 α 0.5→0 | `home-popup-close` | 시트 윗변 최종 y866 (높이 344.2px), 첫 프레임 12.712 윗변 y866; 위치 127ms cubic-bezier(0.0,0.588,1.0,0.279) 시작 12.728 rms 6.11 · 이름 곡선 최적 linear 161ms rms 11.96; 딤 최대 α≈0.50 (132ms cubic-bezier(0.0,0.614,0.612,0.122) 시작 12.728 rms 0.01 · 이름 곡선 최적 linear 159ms rms 0.01) |
| 12.971–13.139 | #356–#364 | 168 | CHANGE | `home` | `home:settle` | OS 내비 바 검정 → 홈 배경색(13.016), 탭바 위 경계 미세 변화 | — |  |

#### v1 13.139 – 30.683 · #365–#1197 · 홈 1차: 배너 자동/스와이프, 스크롤, 계좌 카드 탭 (home)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 13.139–13.631 | #365–#388 | 492 | HOLD | `home` | `home:top-banner1` | 홈 최상단(scrollTop 0) 정지: 공지카드(이번 행운은…), 캐릭터 배너(점 1/5), 홈계좌설정·잔액숨김, 다른 은행 계좌 카드, WON 통장 345원(1002-123-456789), 전체계좌보기, 중간 배너 1/10 "오늘의 행운을 받아가세요" | — |  |
| 13.631–13.957 | #389–#405 | 326 | CHANGE | `home` | `home:banner-auto-2` | 중간 배너 자동 넘김 1/10 → 2/10 (배너 첫 표시 10.588 후 3.03s) | `banner-programmatic` | 가로 507px 왼쪽으로; 524ms cubic-bezier(1.0,-0.242,0.196,0.684) 시작 13.374 rms 1.8 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 342ms rms 2.7 |
| 13.957–14.451 | #406–#423 | 494 | HOLD | `home` | `home:top-banner2` | 배너 2/10 "첫 결제 5,000P +" 정지 | — |  |
| 14.451–15.144 | #424–#459 | 693 | CHANGE | `home` | `home:scroll-206` | 위로 끌어 짧은 스크롤 0 → 206px (공지카드가 헤더 밑으로) | 동작 `scroll-inertia` | scrollTop 0→206 (Δ+206px), 최고 ≈581px/s(50ms 창; 한 프레임 794), 표본 37개 |
| 15.144–16.732 | #460–#527 | 1588 | HOLD | `home` | `home:scrolled-206` | scrollTop 206 정지, 배너 2/10 | — |  |
| 16.732–17.100 | #528–#547 | 368 | CHANGE | `home` | `home:banner-swipe-3` | 배너 가로 넘김 2→3 (사용자 스와이프: 첫 4프레임 손가락 끌기 후 놓음) | `banner-swipe` | 가로 507px 왼쪽으로; 359ms cubic-bezier(0.685,0.176,0.301,0.745) 시작 16.680 rms 5.02 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 455ms rms 5.93 |
| 17.100–17.668 | #548–#565 | 568 | HOLD | `home` | `home:banner3` | 배너 3/10 "11월 한정 통신비 특가" | — |  |
| 17.668–18.070 | #566–#583 | 402 | CHANGE | `home` | `home:banner-swipe-4` | 배너 스와이프 3→4 | `banner-swipe` | 가로 507px 왼쪽으로; 503ms cubic-bezier(0.594,0.245,0.194,1.077) 시작 17.632 rms 3.95 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 470ms rms 5.03 |
| 18.070–18.403 | #584–#594 | 333 | HOLD | `home` | `home:banner4` | 배너 4/10 "환전주머니 채우면 eSIM 100%당첨" | — |  |
| 18.403–18.797 | #595–#613 | 394 | CHANGE | `home` | `home:banner-swipe-5` | 배너 스와이프 4→5 | `banner-swipe` | 가로 507px 왼쪽으로; 347ms cubic-bezier(0.0,0.109,0.0,0.862) 시작 18.402 rms 0.63 · 이름 곡선 최적 md-decelerate(0,0,0.2,1) 381ms rms 1.22 |
| 18.797–19.198 | #614–#626 | 401 | HOLD | `home` | `home:banner5` | 배너 5/10 "Fill Up to 1억 Pick Up the 꿀머니 이벤트" | — |  |
| 19.198–19.590 | #627–#648 | 392 | CHANGE | `home` | `home:banner-swipe-6` | 배너 스와이프 5→6 | `banner-swipe` | 가로 507px 왼쪽으로; 695ms cubic-bezier(0.464,0.439,0.0,1.149) 시작 19.162 rms 8.06 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 486ms rms 9.92 |
| 19.590–20.168 | #649–#666 | 578 | HOLD | `home` | `home:banner6` | 배너 6/10 "우리 함께 多多 이벤트" | — |  |
| 20.168–20.528 | #667–#684 | 360 | CHANGE | `home` | `home:banner-swipe-7` | 배너 스와이프 6→7 | `banner-swipe` | 가로 507px 왼쪽으로; 479ms cubic-bezier(0.86,0.493,0.067,1.056) 시작 20.129 rms 2.11 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 424ms rms 3.82 |
| 20.528–20.904 | #685–#697 | 376 | HOLD | `home` | `home:banner7` | 배너 7/10 "가볍게 뽑아보세요" | — |  |
| 20.904–21.288 | #698–#718 | 384 | CHANGE | `home` | `home:banner-swipe-8` | 배너 스와이프 7→8 | `banner-swipe` | 가로 507px 왼쪽으로; 714ms cubic-bezier(1.0,-0.232,0.542,0.711) 시작 20.514 rms 3.03 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 458ms rms 4.34 |
| 21.288–21.663 | #719–#738 | 375 | HOLD | `home` | `home:banner8` | 배너 8/10 "CU에서 틴틴카드 쓰면 CU포인트가 쏟아진다" | — |  |
| 21.663–22.032 | #739–#758 | 369 | CHANGE | `home` | `home:banner-swipe-9` | 배너 스와이프 8→9 | `banner-swipe` | 가로 507px 왼쪽으로; 594ms cubic-bezier(0.938,-0.178,0.479,0.691) 시작 21.369 rms 5.26 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 446ms rms 6.65 |
| 22.032–22.299 | #759–#767 | 267 | HOLD | `home` | `home:banner9` | 배너 9/10 "올해의 마지막 카운트다운" | — |  |
| 22.299–22.701 | #768–#788 | 402 | CHANGE | `home` | `home:banner-swipe-10` | 배너 스와이프 9→10 | `banner-swipe` | 가로 507px 왼쪽으로; 462ms cubic-bezier(0.213,0.065,0.0,1.041) 시작 22.267 rms 1.22 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 428ms rms 1.25 |
| 22.701–22.775 | #789–#792 | 74 | HOLD | `home` | `home:banner10` | 배너 10/10 "내 보험 맞춤 진단 신청하면 네이버페이 포인트 만원!" | — |  |
| 22.775–24.882 | #793–#908 | 2107 | CHANGE | `home` | `home:scroll` | 아래로(내용 위로) 스크롤 989px (scrollTop 206 → 1195), 최고 속도 ≈1298px/s(50ms 창; 한 프레임 값 1535), 끌기 2번(사이 멈춤 0.05–0.15s) | 동작 `scroll-inertia` | scrollTop 206→1194 (Δ+988px), 최고 ≈1298px/s(50ms 창; 한 프레임 1535), 표본 117개 |
| 24.882–26.714 | #909–#1005 | 1832 | CHANGE | `home` | `home:marquee` | 스크롤 정지 중 "우리금융그룹 서비스" 카드 줄이 왼쪽으로 일정 속도 자동 흐름(마키) — 정지 scrollTop 1195; 기타 국소 변화 97프레임 24.882–26.714 | `marquee` | scrollTop 1194 |
| 26.714–29.119 | #1006–#1136 | 2405 | CHANGE | `home` | `home:scroll` | 위로(내용 아래로) 스크롤 1117px (scrollTop 1195 → 78), 최고 속도 ≈1295px/s(50ms 창; 한 프레임 값 1395) | 동작 `scroll-inertia` | scrollTop 1194→78 (Δ-1116px), 최고 ≈1295px/s(50ms 창; 한 프레임 1395), 표본 132개 |
| 29.119–29.387 | #1137–#1152 | 268 | CHANGE | `home` | `home:banner-auto-2b` | 중간 배너 자동 넘김 1/10 → 2/10 (스크롤이 멈추자마자; 10→1 넘김은 화면 밖에서) | `banner-programmatic` | 가로 507px 왼쪽으로; 132ms cubic-bezier(0.0,0.781,0.0,0.981) 시작 29.222 rms 0.0 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 245ms rms 0.05 |
| 29.387–29.779 | #1153–#1173 | 392 | HOLD | `home` | `home:scrolled-78` | scrollTop 78 정지(공지카드 윗부분이 헤더 밑), 배너 2/10 | — |  |
| 29.779–30.683 | #1174–#1197 | 904 | CHANGE | `home` | `home:account-tap-spinner` | WON 통장 카드 탭 → 가운데 스피너(≈262,585) 회전, 프레임 드묾(앱 바쁨). 카드 눌림 표시는 거의 없음(카드 영역 평균 밝기 −1.5/255). 30.532 부터 스피너 없음 | `home-to-history` 동작 `spinner` | 스피너 29.779–30.532 (#1174–#1191), 중심 [262, 585] |

#### v1 30.683 – 40.664 · #1198–#1627 · 거래내역 1차 로딩 + 전체 목록 스크롤 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 30.683–31.736 | #1198–#1251 | 1053 | HOLD | `history-loading` | `history-loading:blank` | 흰 페이지 + 가운데 스피너(262,628)로 한 프레임에 교체(슬라이드 없음). OS 내비 바 흰색 | `home-to-history` | 스피너 30.683–33.404 (#1198–#1313), 중심 [262, 628] |
| 31.736–32.975 | #1252–#1293 | 1239 | CHANGE | `history-loading` | `history-loading:render` | 헤더 "거래내역조회 / 관리"(31.736) → ‹ + 스켈레톤(31.820) → 내용(32.572) → 잔액 표시 토글 켬(32.798, 중간 프레임 없음) → 검색·필터 아이콘, 계좌 ⌄·복사 아이콘(32.874) | `home-to-history` | 단계 31.736, 31.778, 31.820, 32.572, 32.798, 32.874 |
| 32.975–33.453 | #1294–#1314 | 478 | HOLD | `history` | `history:all-top-spinner` | 거래내역 최상단(3개월·전체·최신순, 2026.08.21~2026.11.21, 기간 내 합계, 2026년 11월 …) + 필터 줄 왼쪽 스피너(262,628) 33.404 까지 | `home-to-history` 동작 `spinner` |  |
| 33.453–34.062 | #1315–#1316 | 609 | HOLD | `history` | `history:all-top` | 최상단 정지(전체) | — |  |
| 34.062–38.025 | #1317–#1518 | 3963 | CHANGE | `history` | `history:all-scroll` | 아래로(내용 위로) 스크롤 4412px (scrollTop 0 → 4412), 최고 속도 ≈2981px/s(50ms 창; 한 프레임 값 3697) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→4412 (Δ+4412px), 최고 ≈2981px/s(50ms 창; 한 프레임 3697), 표본 203개 |
| 38.025–39.819 | #1519–#1611 | 1794 | CHANGE | `history` | `history:all-scroll` | 위로(내용 아래로) 스크롤 4412px (scrollTop 4412 → 0), 최고 속도 ≈4615px/s(50ms 창; 한 프레임 값 5508) | `history-scroll` 동작 `scroll-inertia` | scrollTop 4412→0 (Δ-4412px), 최고 ≈4615px/s(50ms 창; 한 프레임 5508), 표본 94개 |
| 39.819–40.664 | #1612–#1627 | 845 | HOLD | `history` | `history:all-top` | 정지 scrollTop 0 | — | scrollTop 0 |

#### v1 40.664 – 58.962 · #1628–#2327 · 조회조건 시트 → 입금 목록 스크롤 2회 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 40.664–40.914 | #1628–#1637 | 250 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 선택 시트 올라옴 + 딤 (돋보기 줄 필터 아이콘 탭) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 40.664 윗변 y929; 위치 213ms cubic-bezier(0.0,0.741,0.955,1.0) 시작 40.638 rms 7.88 · 이름 곡선 최적 md-decelerate(0,0,0.2,1) 278ms rms 9.08; 검정 딤 α 최종 0.564 (304ms cubic-bezier(0.0,-0.117,1.0,1.072) 시작 40.664 rms 0.02 · 이름 곡선 최적 linear 283ms rms 0.02) |
| 40.914–41.485 | #1638–#1653 | 571 | HOLD | `history-filter-sheet` | `history-filter-sheet:all` | 시트: 조회기간 이번달·3개월(선택)·6개월·1년·직접입력 / 거래구분 전체(선택)·입금·출금 / 상세조건조회 ⌄ / 초기화·적용하기 | — |  |
| 41.485–42.246 | #1654–#1655 | 761 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | "입금" 선택(한 프레임에 테두리 이동, 애니메이션 없음) | `filter-select` |  |
| 42.246–42.362 | #1656–#1659 | 116 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림(진한 파랑) 42.246–42.362 | 동작 `press-feedback` | 눌림 #2487F2→#195CA5 |
| 42.362–42.654 | #1660–#1675 | 292 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 42.362 윗변 y545; 위치 405ms cubic-bezier(0.553,0.353,0.058,0.969) 시작 42.426 rms 4.15 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 351ms rms 5.97; 검정 딤 α 최종 0.564 (487ms cubic-bezier(0.0,-0.088,1.0,2.136) 시작 42.379 rms 0.01 · 이름 곡선 최적 linear 269ms rms 0.01) |
| 42.654–42.897 | #1676–#1688 | 243 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너(262,628), 목록은 아직 이전 것 | `history-reload` 동작 `spinner` |  |
| 42.897–43.147 | #1689–#1697 | 250 | HOLD | `history` | `history:deposit-top` | 목록이 입금으로 교체(한 프레임), 필터 "3개월·입금·최신순" | — |  |
| 43.147–47.143 | #1698–#1906 | 3996 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 4017px (scrollTop 0 → 4017), 최고 속도 ≈3307px/s(50ms 창; 한 프레임 값 3851) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→4017 (Δ+4017px), 최고 ≈3307px/s(50ms 창; 한 프레임 3851), 표본 210개 |
| 47.143–49.801 | #1907–#2014 | 2658 | CHANGE | `history` | `history:deposit-scroll` | 위로(내용 아래로) 스크롤 4017px (scrollTop 4017 → 0), 최고 속도 ≈5787px/s(50ms 창; 한 프레임 값 8031) | `history-scroll` 동작 `scroll-inertia` | scrollTop 4017→0 (Δ-4017px), 최고 ≈5787px/s(50ms 창; 한 프레임 8031), 표본 109개 |
| 49.801–50.557 | #2015–#2035 | 756 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0 | — | scrollTop 0 |
| 50.557–55.625 | #2036–#2234 | 5068 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 3058px (scrollTop 0 → 3058), 최고 속도 ≈2009px/s(50ms 창; 한 프레임 값 3043), 끌기 4번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→3058 (Δ+3058px), 최고 ≈2009px/s(50ms 창; 한 프레임 3043), 표본 200개 |
| 55.625–55.765 | #2235–#2239 | 140 | CHANGE | `history` | `history:deposit-scroll` | 위로(내용 아래로) 스크롤 55px (scrollTop 3058 → 3003), 최고 속도 ≈725px/s(50ms 창; 한 프레임 값 833) | `history-scroll` 동작 `scroll-inertia` | scrollTop 3058→3003 (Δ-55px), 최고 ≈725px/s(50ms 창; 한 프레임 833), 표본 6개 |
| 55.765–56.952 | #2240–#2278 | 1187 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 1237px (scrollTop 3003 → 4240), 최고 속도 ≈2468px/s(50ms 창; 한 프레임 값 4397) | `history-scroll` 동작 `scroll-inertia` | scrollTop 3003→4240 (Δ+1237px), 최고 ≈2468px/s(50ms 창; 한 프레임 4397), 표본 40개 |
| 56.952–57.708 | #2279–#2306 | 756 | CHANGE | `history` | `history:deposit-scroll` | 위로(내용 아래로) 스크롤 4240px (scrollTop 4240 → 0), 최고 속도 ≈11857px/s(50ms 창; 한 프레임 값 12594) | `history-scroll` 동작 `scroll-inertia` | scrollTop 4240→0 (Δ-4240px), 최고 ≈11857px/s(50ms 창; 한 프레임 12594), 표본 29개 |
| 57.708–58.962 | #2307–#2327 | 1254 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0; 기타 국소 변화 3프레임 57.708–58.127 | — | scrollTop 0 |

#### v1 58.962 – 82.414 · #2328–#3414 · 조회조건 → 출금 목록 긴 스크롤 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 58.962–59.246 | #2328–#2343 | 284 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 올라옴 + 딤 (2번째) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 58.962 윗변 y980; 위치 272ms cubic-bezier(0.467,0.168,0.275,0.88) 시작 58.873 rms 5.04 · 이름 곡선 최적 ease 262ms rms 5.23; 검정 딤 α 최종 0.564 (290ms cubic-bezier(0.0,0.034,1.0,0.93) 시작 58.965 rms 0.0 · 이름 곡선 최적 linear 301ms rms 0.0) |
| 59.246–59.491 | #2344–#2347 | 245 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | 시트(입금 선택 상태) | — |  |
| 59.491–60.495 | #2348–#2351 | 1004 | HOLD | `history-filter-sheet` | `history-filter-sheet:withdraw` | "출금" 선택 | `filter-select` |  |
| 60.495–60.761 | #2352 | 266 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림 60.495–60.761 | 동작 `press-feedback` | 눌림 #2487F2→#195CA5 |
| 60.761–61.012 | #2353–#2366 | 251 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 60.761 윗변 y547; 위치 512ms cubic-bezier(0.613,0.001,0.349,2.968) 시작 60.751 rms 2.61 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 360ms rms 12.93; 검정 딤 α 최종 0.564 (271ms cubic-bezier(0.0,0.081,1.0,0.947) 시작 60.735 rms 0.0 · 이름 곡선 최적 linear 286ms rms 0.0) |
| 61.012–61.238 | #2367–#2377 | 226 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너 | `history-reload` 동작 `spinner` |  |
| 61.238–61.497 | #2378–#2386 | 259 | HOLD | `history` | `history:withdraw-top` | 목록이 출금으로 교체, 필터 "3개월·출금·최신순". 61.497–61.597 스피너 꼬리 | — |  |
| 61.497–61.714 | #2387–#2398 | 217 | HOLD | `history` | `history:withdraw-top` | 정지 scrollTop 0; 가운데 스피너 61.497–61.714 | — | scrollTop 0 |
| 61.714–74.445 | #2399–#3049 | 12731 | CHANGE | `history` | `history:withdraw-scroll` | 아래로(내용 위로) 스크롤 10195px (scrollTop 0 → 10195), 최고 속도 ≈3974px/s(50ms 창; 한 프레임 값 5157), 끌기 2번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→10195 (Δ+10195px), 최고 ≈3974px/s(50ms 창; 한 프레임 5157), 표본 652개 |
| 74.445–81.543 | #3050–#3387 | 7098 | CHANGE | `history` | `history:withdraw-scroll` | 위로(내용 아래로) 스크롤 10195px (scrollTop 10195 → 0), 최고 속도 ≈4000px/s(50ms 창; 한 프레임 값 4844) | `history-scroll` 동작 `scroll-inertia` | scrollTop 10195→0 (Δ-10195px), 최고 ≈4000px/s(50ms 창; 한 프레임 4844), 표본 339개 |
| 81.543–82.414 | #3388–#3414 | 871 | HOLD | `history` | `history:withdraw-top` | 정지 scrollTop 0; OS 알림 pill 변화 82.032–82.398 | — | scrollTop 0 |

#### v1 82.414 – 97.146 · #3415–#3773 · 조회조건 → 입금, 상세 ①(입금) (history, history-detail)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 82.414–82.749 | #3415–#3427 | 335 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 올라옴 + 딤 (3번째) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 82.435 윗변 y934; 위치 294ms cubic-bezier(0.38,0.546,0.399,1.051) 시작 82.363 rms 4.26 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 261ms rms 5.34; 검정 딤 α 최종 0.564 (547ms cubic-bezier(0.0,-0.267,1.0,2.358) 시작 82.414 rms 0.02 · 이름 곡선 최적 linear 280ms rms 0.02) |
| 82.749–83.461 | #3428–#3435 | 712 | HOLD | `history-filter-sheet` | `history-filter-sheet:withdraw` | 시트(출금 선택 상태). OS 메신저 알림 pill 표시 중 | — |  |
| 83.461–84.238 | #3436–#3437 | 777 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | "입금" 선택 | `filter-select` |  |
| 84.238–84.256 | #3438 | 18 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림(1프레임 84.238) | 동작 `press-feedback` | 눌림 #2487F2→#195CA5 |
| 84.256–84.547 | #3439–#3449 | 291 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 84.256 윗변 y546; 위치 679ms cubic-bezier(0.398,0.0,0.158,1.765) 시작 84.249 rms 6.32 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 406ms rms 7.84; 검정 딤 α 최종 0.564 (336ms cubic-bezier(0.0,-0.312,1.0,0.555) 시작 84.136 rms 0.02 · 이름 곡선 최적 ease-in 312ms rms 0.02) |
| 84.547–84.792 | #3450–#3457 | 245 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너 | `history-reload` 동작 `spinner` |  |
| 84.792–84.910 | #3458 | 118 | HOLD | `history` | `history:deposit-top` | 목록이 입금으로 교체. 84.975–85.243 스피너 꼬리, 85.27–85.52 OS 알림 pill 위로 사라짐 | — |  |
| 84.910–86.251 | #3459–#3494 | 1341 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0; 가운데 스피너 84.975–85.271; OS 알림 pill 변화 85.326–85.535; 기타 국소 변화 1프레임 85.271–85.326 | — | scrollTop 0 |
| 86.251–88.290 | #3495–#3585 | 2039 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 1002px (scrollTop 0 → 1002), 최고 속도 ≈1816px/s(50ms 창; 한 프레임 값 3288), 끌기 2번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→1002 (Δ+1002px), 최고 ≈1816px/s(50ms 창; 한 프레임 3288), 표본 92개 |
| 88.290–89.305 | #3586–#3630 | 1015 | CHANGE | `history` | `history:deposit-scroll` | 위로(내용 아래로) 스크롤 1002px (scrollTop 1002 → 0), 최고 속도 ≈3490px/s(50ms 창; 한 프레임 값 6233) | `history-scroll` 동작 `scroll-inertia` | scrollTop 1002→0 (Δ-1002px), 최고 ≈3490px/s(50ms 창; 한 프레임 6233), 표본 46개 |
| 89.305–91.367 | #3631–#3655 | 2062 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0; OS 알림 pill 변화 91.056–91.109; 기타 국소 변화 1프레임 89.325–89.348 | — | scrollTop 0 |
| 91.367–91.641 | #3656–#3670 | 274 | CHANGE | `history-detail` | `history-detail:open` | 입금 행 탭 → 거래내역 상세가 아래에서 살짝 올라오며 페이드 인(눌림 효과 없음) | `detail-open` | y 오프셋 68.2→0.0px, α 0.09→0.99; 이동 197ms cubic-bezier(0.126,0.614,0.875,1.047) 시작 91.404 rms 1.3 · 이름 곡선 최적 md-decelerate(0,0,0.2,1) 244ms rms 1.68; 페이드 238ms cubic-bezier(0.63,0.699,0.0,0.636) 시작 91.350 rms 0.01 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 308ms rms 0.02 |
| 91.641–95.699 | #3671–#3748 | 4058 | HOLD | `history-detail` | `history-detail:deposit` | 상세: "한지호 / +100,000원 / 메모입력 / 거래일시 2026.11.20 21:29:47 / 거래구분 · 거래 후 잔액 100,001원 · 의뢰인 · 수표금액 0원 · 관리점 / '한지호' 검색하기 / 공유·확인". OS 알림 pill 91.82–92.62, 95.08–95.27 | — |  |
| 95.699–95.867 | #3749–#3758 | 168 | CHANGE | `history-detail` | `history-detail:close` | OS 뒤로(◁) 눌림 물결(내비 바, OS) 95.460 부터 → 95.699 상세가 내려가며 페이드 아웃(물결은 95.9 까지 옅어짐) | `detail-close` | y 오프셋 11.9→102.3px, α 0.92→0.05; 이동 136ms cubic-bezier(0.0,0.503,1.0,1.508) 시작 95.697 rms 0.13 · 이름 곡선 최적 ease-out 101ms rms 1.88; 페이드 435ms cubic-bezier(0.158,1.153,0.0,0.891) 시작 95.694 rms 0.01 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 174ms rms 0.03 |
| 95.867–97.146 | #3759–#3773 | 1279 | HOLD | `history` | `history:deposit-top` | 입금 목록 최상단 | — |  |

#### v1 97.146 – 106.196 · #3774–#3951 · 조회조건 → 출금, 상세 ②(출금), 뒤로 (history, history-detail)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 97.146–97.422 | #3774–#3789 | 276 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 올라옴 + 딤 (4번째) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 97.146 윗변 y1031; 위치 279ms cubic-bezier(0.328,0.813,0.434,1.015) 시작 97.114 rms 3.59 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 256ms rms 4.16; 검정 딤 α 최종 0.564 (286ms cubic-bezier(0.0,0.062,1.0,0.931) 시작 97.154 rms 0.0 · 이름 곡선 최적 linear 298ms rms 0.0) |
| 97.422–98.493 | #3790–#3795 | 1071 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | 시트(입금) | — |  |
| 98.493–99.011 | #3796–#3797 | 518 | HOLD | `history-filter-sheet` | `history-filter-sheet:withdraw` | "출금" 선택 | `filter-select` |  |
| 99.011–99.037 | #3798 | 26 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림(1프레임 99.011) | 동작 `press-feedback` | 눌림 #2487F3→#195CA5 |
| 99.037–99.278 | #3799–#3812 | 241 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 99.037 윗변 y548; 위치 487ms cubic-bezier(0.605,-0.0,0.344,2.531) 시작 99.028 rms 1.33 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 371ms rms 7.43; 검정 딤 α 최종 0.564 (354ms cubic-bezier(0.096,-0.285,1.0,0.951) 시작 98.919 rms 0.0 · 이름 곡선 최적 ease-in 362ms rms 0.0) |
| 99.278–99.505 | #3813–#3824 | 227 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너 | `history-reload` 동작 `spinner` |  |
| 99.505–99.607 | #3825 | 102 | HOLD | `history` | `history:withdraw-top` | 출금 목록 (99.765–100.254 스피너 꼬리) | — |  |
| 99.607–100.510 | #3826–#3847 | 903 | HOLD | `history` | `history:withdraw-top` | 정지 scrollTop 0; 가운데 스피너 99.765–100.254 | — | scrollTop 0 |
| 100.510–101.086 | #3848–#3856 | 576 | CHANGE | `history` | `history:withdraw-scroll` | 아래로(내용 위로) 스크롤 64px (scrollTop 0 → 64), 최고 속도 ≈446px/s(50ms 창; 한 프레임 값 505) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→64 (Δ+64px), 최고 ≈446px/s(50ms 창; 한 프레임 505), 표본 10개 |
| 101.086–101.486 | #3857–#3860 | 400 | HOLD | `history` | `history:withdraw-scrolled-64` | 정지 scrollTop 64 | — | scrollTop 64 |
| 101.486–101.519 | #3861 | 33 | CHANGE | `history` | `history:row-tap-spinner` | 출금 행 탭 → 가운데 스피너 1프레임 | 동작 `spinner` |  |
| 101.519–101.871 | #3862–#3876 | 352 | CHANGE | `history-detail` | `history-detail:open` | 거래내역 상세 올라오며 페이드 인 | `detail-open` | y 오프셋 83.9→0.0px, α 0.06→1.00; 이동 201ms cubic-bezier(0.427,1.105,1.0,0.951) 시작 101.554 rms 0.03 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 250ms rms 0.08; 페이드 272ms cubic-bezier(0.582,0.406,0.0,0.523) 시작 101.502 rms 0.02 · 이름 곡선 최적 ease 335ms rms 0.03 |
| 101.871–104.531 | #3877–#3903 | 2660 | HOLD | `history-detail` | `history-detail:withdraw` | 상세: "정우진 / -1원 / 메모입력 / 거래일시 2026.11.21 11:02:40 / 받는 분 정우진 · 지역농축협 12345652789012 / 받는 분 통장표기 정우진 / 이체확인증 [보기] / 거래구분 모바일 / 거래후 잔액 345원 / 수표금액 0원 / 관리점 디지털영업부 / '정우진' 검색하기 / 공유·확인". 101.846–102.316 가운데 스피너(점 단계) 남아 있다 사라짐 | — |  |
| 104.531–104.697 | #3904–#3913 | 166 | CHANGE | `history-detail` | `history-detail:close` | 상세 닫힘(내려가며 페이드 아웃). 직전 눌림 표시 없음(✕ 탭 추정) | `detail-close` | y 오프셋 33.7→96.8px, α 0.77→0.06; 이동 77ms cubic-bezier(0.253,0.559,1.0,0.879) 시작 104.513 rms 0.0 · 이름 곡선 최적 linear 94ms rms 1.06; 페이드 161ms cubic-bezier(0.191,1.367,0.921,0.711) 시작 104.525 rms 0.01 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 190ms rms 0.04 |
| 104.697–105.520 | #3914–#3925 | 823 | HOLD | `history` | `history:withdraw-scrolled-64` | 출금 목록 scrollTop 64 — 상세 ② 닫힌 뒤 원래 위치(101.086 과 같은 화면: 회색 썸네일 평균차 0.5, 맨 위와는 15.5) [critic-1: 예전 라벨 withdraw-top] | — | scrollTop 64 |
| 105.520–106.196 | #3926–#3951 | 676 | HOLD | `history` | `history:back-spinner` | 가운데 스피너(105.520–106.140). 직전 눌림 표시 없음(헤더 ‹ 탭 추정) — 홈으로 돌아가는 중 | `history-to-home` 동작 `spinner` |  |

#### v1 106.196 – 120.038 · #3952–#4531 · 홈 2차: 다시 그리기, 스크롤, 배너 › 넘김, 계좌 카드 탭 (home)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 106.196–106.613 | #3952–#3958 | 417 | HOLD | `home` | `home:return-cached` | 홈으로 한 프레임에 교체(슬라이드 없음): 떠날 때 모습(scrollTop 78, 배너 2/10). 106.289·106.504 계좌 카드 위 스피너 흔적 | `history-to-home` |  |
| 106.613–109.012 | #3959–#4049 | 2399 | CHANGE | `home-loading` | `home-loading:refresh` | 홈 다시 그림 (steps): 106.613 맨 위로 + 다른 은행 카드 빠짐 → 106.756 계좌 스켈레톤 → 106.938 공지 → 107.0–107.97 카드·배너 재배치 → 108.117–108.761 카드 삽입·잔액 굴림 345원 | `balance-odometer` `history-to-home` | 단계 106.613, 106.756, 106.938, 107.039, 107.055, 107.080, 107.097, 107.114, 107.140, 107.172, 107.197, 107.214, 107.239, 107.256 … |
| 109.012–110.073 | #4050–#4089 | 1061 | HOLD | `home` | `home:top-banner3` | 홈 최상단 정지, 배너 3/10 | — |  |
| 110.073–110.775 | #4090–#4128 | 702 | CHANGE | `home` | `home:scroll` | 아래로(내용 위로) 스크롤 260px (scrollTop 0 → 260), 최고 속도 ≈724px/s(50ms 창; 한 프레임 값 1080) · 스크롤 중 중간 배너 자동 넘김 3→4 시작(카운터 4/10 먼저 110.591, 슬라이드 110.624–110.876 ease 298ms) [critic-1] | `banner-programmatic` 동작 `scroll-inertia` | scrollTop 0→260 (Δ+260px), 최고 ≈724px/s(50ms 창; 한 프레임 1080), 표본 40개 |
| 110.775–110.876 | #4129–#4134 | 101 | CHANGE | `home` | `home:banner-auto-4` | 중간 배너 자동 넘김 3→4 의 끝부분(110.591 카운터 4/10 → 110.624 슬라이드 시작, 스크롤 110.073–110.775 중에 시작). 110.876 정착 [critic-1: 원래 scrolled-260 HOLD 의 "기타 국소 변화"] | `banner-programmatic` | 가로 507px 왼쪽으로(끝부분); ease 298ms 시작 110.583 rms 0.49 (#4122–#4135) · md-standard 340ms rms 1.20 |
| 110.876–111.142 | #4135–#4146 | 266 | HOLD | `home` | `home:scrolled-260` | 정지 scrollTop 260, 배너 4/10 | — | scrollTop 260 |
| 111.142–111.453 | #4147–#4163 | 311 | CHANGE | `home` | `home:scroll` | 아래로(내용 위로) 스크롤 120px (scrollTop 260 → 380), 최고 속도 ≈688px/s(50ms 창; 한 프레임 값 820) | 동작 `scroll-inertia` | scrollTop 260→380 (Δ+120px), 최고 ≈688px/s(50ms 창; 한 프레임 820), 표본 18개 |
| 111.453–112.212 | #4164–#4196 | 759 | HOLD | `home` | `home:scrolled-380` | 정지 scrollTop 380 | — | scrollTop 380 |
| 112.212–112.573 | #4197–#4216 | 361 | CHANGE | `home` | `home:banner-next-5` | 배너 4→5 (카운터가 먼저 바뀌고 0.04s 뒤 슬라이드: › 버튼 탭으로 판단, 프로그램 곡선) | `banner-programmatic` | 가로 507px 왼쪽으로; 339ms cubic-bezier(0.541,0.08,0.19,1.016) 시작 112.171 rms 0.37 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 323ms rms 1.41 |
| 112.573–113.558 | #4217–#4252 | 985 | HOLD | `home` | `home:banner5` | 배너 5/10 | — |  |
| 113.558–113.859 | #4253–#4270 | 301 | CHANGE | `home` | `home:banner-next-6` | 배너 5→6 | `banner-programmatic` | 가로 507px 왼쪽으로; 301ms cubic-bezier(0.252,0.092,0.249,1.0) 시작 113.541 rms 0.44 · 이름 곡선 최적 ease 300ms rms 0.44 |
| 113.859–114.871 | #4271–#4310 | 1012 | HOLD | `home` | `home:banner6` | 배너 6/10 | — |  |
| 114.871–115.180 | #4311–#4328 | 309 | CHANGE | `home` | `home:banner-next-7` | 배너 6→7 | `banner-programmatic` | 가로 507px 왼쪽으로; 320ms cubic-bezier(0.242,0.0,0.26,1.012) 시작 114.846 rms 0.06 · 이름 곡선 최적 ease 313ms rms 0.46 |
| 115.180–115.941 | #4329–#4354 | 761 | HOLD | `home` | `home:banner7` | 배너 7/10 | — |  |
| 115.941–116.242 | #4355–#4370 | 301 | CHANGE | `home` | `home:banner-next-8` | 배너 7→8 | `banner-programmatic` | 가로 507px 왼쪽으로; 351ms cubic-bezier(0.506,-0.127,0.18,0.935) 시작 115.865 rms 2.87 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 325ms rms 4.75 |
| 116.242–116.994 | #4371–#4401 | 752 | HOLD | `home` | `home:banner8` | 배너 8/10 | — |  |
| 116.994–117.312 | #4402–#4419 | 318 | CHANGE | `home` | `home:banner-next-9` | 배너 8→9 | `banner-programmatic` | 가로 507px 왼쪽으로; 318ms cubic-bezier(0.403,-0.0,0.206,0.916) 시작 116.956 rms 3.31 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 347ms rms 3.61 |
| 117.312–117.931 | #4420–#4448 | 619 | HOLD | `home` | `home:banner9` | 배너 9/10 | — |  |
| 117.931–118.273 | #4449–#4466 | 342 | CHANGE | `home` | `home:banner-next-10` | 배너 9→10 | `banner-programmatic` | 가로 507px 왼쪽으로; 340ms cubic-bezier(0.513,-0.077,0.0,0.982) 시작 117.903 rms 3.22 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 300ms rms 4.37 |
| 118.273–119.235 | #4467–#4513 | 962 | HOLD | `home` | `home:banner10` | 배너 10/10 | — |  |
| 119.235–120.038 | #4514–#4531 | 803 | CHANGE | `home` | `home:account-tap-spinner` | WON 통장 카드 탭 → 가운데 스피너(≈262,585) [critic-1: 스피너 첫 프레임 #4514(119.235)로 경계 당김] | `home-to-history` 동작 `spinner` | 스피너 119.235–120.004 (#4514–#4531), 중심 [262, 585] |

#### v1 120.038 – 125.103 · #4532–#4697 · 거래내역 2차 로딩 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 120.038–120.774 | #4532–#4562 | 736 | HOLD | `history-loading` | `history-loading:blank` | 흰 페이지 + 가운데 스피너(262,628) | `home-to-history` | 스피너 120.038–122.688 (#4532–#4629), 중심 [262, 628] |
| 120.774–122.296 | #4563–#4612 | 1522 | CHANGE | `history-loading` | `history-loading:render` | 1차와 같은 순서로 그려짐: 헤더(120.774) → ‹+스켈레톤 → 내용(122.095) → 토글 켬 → 아이콘 | `home-to-history` | 단계 120.907, 120.924, 120.957, 120.999, 121.835, 122.095, 122.254 |
| 122.296–122.721 | #4613–#4630 | 425 | HOLD | `history` | `history:all-top-spinner` | 최상단 + 필터 줄 스피너(122.521–122.721) | `home-to-history` 동작 `spinner` |  |
| 122.721–123.550 | #4631–#4634 | 829 | HOLD | `history` | `history:all-top` | 최상단 정지(전체) | — |  |
| 123.550–124.635 | #4635–#4691 | 1085 | CHANGE | `history` | `history:all-scroll` | 아래로(내용 위로) 스크롤 102px (scrollTop 0 → 102), 최고 속도 ≈213px/s(50ms 창; 한 프레임 값 238), 끌기 2번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→102 (Δ+102px), 최고 ≈213px/s(50ms 창; 한 프레임 238), 표본 58개 |
| 124.635–125.103 | #4692–#4697 | 468 | HOLD | `history` | `history:all-scrolled-102` | 정지 scrollTop 102 | — | scrollTop 102 |

#### v1 125.103 – 157.534 · #4698–#6070 · 조회조건 → 입금, 아주 천천히 스크롤, 상세 ③, 맨 위로 (history, history-detail)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 125.103–125.379 | #4698–#4712 | 276 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 올라옴 + 딤 (5번째) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 125.103 윗변 y1029; 위치 228ms cubic-bezier(0.397,1.092,0.843,0.974) 시작 125.077 rms 1.51 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 250ms rms 1.84; 검정 딤 α 최종 0.564 (296ms cubic-bezier(0.0,0.031,1.0,0.998) 시작 125.110 rms 0.0 · 이름 곡선 최적 linear 300ms rms 0.0) |
| 125.379–125.539 | #4713–#4721 | 160 | HOLD | `history-filter-sheet` | `history-filter-sheet:all` | 시트(전체) | — |  |
| 125.539–126.486 | #4722–#4725 | 947 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | "입금" 선택 | `filter-select` |  |
| 126.486–126.710 | #4726 | 224 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림 126.486–126.710 | 동작 `press-feedback` | 눌림 #2487F3→#195CA5 |
| 126.710–126.977 | #4727–#4741 | 267 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 126.710 윗변 y548; 위치 479ms cubic-bezier(0.595,-0.0,0.362,2.458) 시작 126.702 rms 1.43 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 358ms rms 12.37; 검정 딤 α 최종 0.564 (328ms cubic-bezier(0.155,0.0,1.0,1.052) 시작 126.651 rms 0.0 · 이름 곡선 최적 linear 300ms rms 0.0) |
| 126.977–127.237 | #4742–#4752 | 260 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너 | `history-reload` 동작 `spinner` |  |
| 127.237–127.254 | #4753 | 17 | HOLD | `history` | `history:deposit-top` | 입금 목록 | — |  |
| 127.254–127.696 | #4754–#4778 | 442 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0; 가운데 스피너 127.412–127.662 | — | scrollTop 0 |
| 127.696–136.232 | #4779–#5169 | 8536 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 1991px (scrollTop 0 → 1991), 최고 속도 ≈728px/s(50ms 창; 한 프레임 값 1406), 끌기 3번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→1991 (Δ+1991px), 최고 ≈728px/s(50ms 창; 한 프레임 1406), 표본 392개 |
| 136.232–136.490 | #5170–#5172 | 258 | HOLD | `history` | `history:deposit-scrolled-1991` | 정지 scrollTop 1991 | — | scrollTop 1991 |
| 136.490–139.015 | #5173–#5309 | 2525 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 385px (scrollTop 1991 → 2376), 최고 속도 ≈340px/s(50ms 창; 한 프레임 값 470) | `history-scroll` 동작 `scroll-inertia` | scrollTop 1991→2376 (Δ+386px), 최고 ≈340px/s(50ms 창; 한 프레임 470), 표본 138개 |
| 139.015–139.233 | #5310 | 218 | HOLD | `history` | `history:deposit-scrolled-2376` | 정지 scrollTop 2376 | — | scrollTop 2376 |
| 139.233–146.204 | #5311–#5657 | 6971 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 1405px (scrollTop 2376 → 3781), 최고 속도 ≈924px/s(50ms 창; 한 프레임 값 1283) | `history-scroll` 동작 `scroll-inertia` | scrollTop 2376→3781 (Δ+1405px), 최고 ≈924px/s(50ms 창; 한 프레임 1283), 표본 348개 |
| 146.204–146.472 | #5658–#5660 | 268 | HOLD | `history` | `history:deposit-scrolled-3781` | 정지 scrollTop 3781 | — | scrollTop 3781 |
| 146.472–150.009 | #5661–#5851 | 3537 | CHANGE | `history` | `history:deposit-scroll` | 아래로(내용 위로) 스크롤 689px (scrollTop 3781 → 4470), 최고 속도 787px/s | `history-scroll` 동작 `scroll-inertia` | scrollTop 3781→4470 (Δ+689px), 최고 ≈773px/s(50ms 창; 한 프레임 786), 표본 192개 |
| 150.009–153.042 | #5852–#5999 | 3033 | CHANGE | `history` | `history:deposit-scroll` | 위로(내용 아래로) 스크롤 4470px (scrollTop 4470 → 0), 최고 속도 ≈7484px/s(50ms 창; 한 프레임 값 8586), 끌기 2번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 4470→0 (Δ-4470px), 최고 ≈7484px/s(50ms 창; 한 프레임 8586), 표본 149개 |
| 153.042–154.314 | #6000–#6021 | 1272 | HOLD | `history` | `history:deposit-top` | 정지 scrollTop 0. 153.042–153.469 목록 전체에 옅은 변화 5프레임(최대 \|차\|78→42) = 빠른 플링 뒤 코덱 화질 보정(앱 변화 아님, 기준 구간은 153.469 부터) [critic-1] | — | scrollTop 0 |
| 154.314–154.589 | #6022–#6037 | 275 | CHANGE | `history-detail` | `history-detail:open` | 입금 행(한지호 +100,000원) 탭 → 상세 올라오며 페이드 인 | `detail-open` | y 오프셋 75.7→0.0px, α 0.10→0.99; 이동 200ms cubic-bezier(0.429,0.982,0.704,0.927) 시작 154.346 rms 0.5 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 239ms rms 0.58; 페이드 294ms cubic-bezier(0.584,0.435,0.08,0.888) 시작 154.282 rms 0.01 · 이름 곡선 최적 md-standard(0.4,0,0.2,1) 300ms rms 0.02 |
| 154.589–156.237 | #6038–#6048 | 1648 | HOLD | `history-detail` | `history-detail:deposit` | 상세(91.641 과 같은 화면) | — |  |
| 156.237–156.273 | #6049 | 36 | CHANGE | `history-detail` | `history-detail:confirm-pressed` | 하단 "확인" 눌림(1프레임 156.237) | 동작 `press-feedback` | 눌림 #2387F3→#195CA5 |
| 156.273–156.521 | #6050–#6062 | 248 | CHANGE | `history-detail` | `history-detail:close` | 상세 닫힘(내려가며 페이드 아웃) | `detail-close` | y 오프셋 33.7→107.4px, α 0.80→0.04; 이동 1531ms cubic-bezier(0.0,0.932,0.0,1.95) 시작 156.271 rms 1.53 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 141ms rms 2.15; 페이드 291ms cubic-bezier(0.124,1.125,0.0,0.676) 시작 156.267 rms 0.02 · 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 278ms rms 0.08 |
| 156.521–157.534 | #6063–#6070 | 1013 | HOLD | `history` | `history:deposit-top` | 입금 목록 최상단 | — |  |

#### v1 157.534 – 175.468 · #6071–#6914 · 조회조건 → 출금, 10월까지 긴 스크롤 후 맨 위로 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 157.534–157.809 | #6071–#6086 | 275 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 올라옴 + 딤 (6번째) | `filter-sheet-open` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 157.534 윗변 y980; 위치 429ms cubic-bezier(0.662,0.0,0.408,1.032) 시작 157.336 rms 1.36 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 417ms rms 4.04; 검정 딤 α 최종 0.564 (297ms cubic-bezier(0.0,0.017,1.0,0.998) 시작 157.538 rms 0.0 · 이름 곡선 최적 linear 300ms rms 0.0) |
| 157.809–158.497 | #6087–#6092 | 688 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | 시트(입금) | — |  |
| 158.497–158.663 | #6093 | 166 | HOLD | `history-filter-sheet` | `history-filter-sheet:withdraw` | "출금" 선택 | `filter-select` |  |
| 158.663–159.141 | #6094 | 478 | CHANGE | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | "적용하기" 눌림 158.663–159.141 | 동작 `press-feedback` | 눌림 #2487F3→#195CA5 |
| 159.141–159.373 | #6095–#6107 | 232 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 내려감 + 딤 사라짐 | `filter-sheet-close` | 시트 윗변 최종 y545 (높이 665.2px), 첫 프레임 159.141 윗변 y551; 위치 530ms cubic-bezier(0.542,-0.007,0.271,2.145) 시작 159.118 rms 1.19 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 371ms rms 6.74; 검정 딤 α 최종 0.564 (306ms cubic-bezier(0.222,-0.0,1.0,1.125) 시작 159.075 rms 0.0 · 이름 곡선 최적 linear 263ms rms 0.0) |
| 159.373–159.617 | #6108–#6121 | 244 | HOLD | `history` | `history:reload-spinner` | 가운데 스피너 | `history-reload` 동작 `spinner` |  |
| 159.617–159.726 | #6122 | 109 | HOLD | `history` | `history:withdraw-top` | 출금 목록 (159.851–160.093 스피너 꼬리) | — |  |
| 159.726–160.110 | #6123–#6143 | 384 | HOLD | `history` | `history:withdraw-top` | 정지 scrollTop 0; 가운데 스피너 159.851–160.110; 기타 국소 변화 1프레임 160.027–160.043 | — | scrollTop 0 |
| 160.110–173.118 | #6144–#6811 | 13008 | CHANGE | `history` | `history:withdraw-scroll` | 아래로(내용 위로) 스크롤 9184px (scrollTop 0 → 9184), 최고 속도 ≈2628px/s(50ms 창; 한 프레임 값 3120), 끌기 2번(사이 멈춤 0.05–0.15s) | `history-scroll` 동작 `scroll-inertia` | scrollTop 0→9184 (Δ+9184px), 최고 ≈2628px/s(50ms 창; 한 프레임 3120), 표본 669개 |
| 173.118–174.614 | #6812–#6896 | 1496 | CHANGE | `history` | `history:withdraw-scroll` | 위로(내용 아래로) 스크롤 9184px (scrollTop 9184 → 0), 최고 속도 ≈10834px/s(50ms 창; 한 프레임 값 14898) | `history-scroll` 동작 `scroll-inertia` | scrollTop 9184→0 (Δ-9184px), 최고 ≈10834px/s(50ms 창; 한 프레임 14898), 표본 86개 |
| 174.614–175.468 | #6897–#6914 | 854 | HOLD | `history` | `history:withdraw-top` | 정지 scrollTop 0; 기타 국소 변화 3프레임 174.614–175.117 | — | scrollTop 0 |

#### v1 175.468 – 186.449 · #6915–#7162 · 이체: 보낼 곳 → 금액 1원 → 중복 경고 시트 (history, send-a, send-b)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 175.468–175.560 | #6915–#6919 | 92 | CHANGE | `history` | `history:transfer-pressed` | 계좌 카드 "이체" 눌림(진한 파랑) + 필터 줄 스피너 | `history-to-send` 동작 `press-feedback` | 눌림 #2487F2→#195CA5 |
| 175.560–176.489 | #6920–#6922 | 929 | HOLD | `history` | `history:transfer-wait` | 버튼 원래 색, 가운데 스피너(262,628) 계속(175.484–176.448, 정지 프레임 3장 모두 스피너 — 기준 프레임은 mask) → 176.489 흰 페이지 [critic-1] | `history-to-send` |  |
| 176.489–177.493 | #6923–#6933 | 1004 | HOLD | `send-loading` | `send-loading:blank` | 흰 페이지로 한 프레임에 교체 + 가운데 스피너(176.816–177.238) | `history-to-send` |  |
| 177.493–178.095 | #6934–#6951 | 602 | CHANGE | `send-where` | `send-where:render` | "어디로 이체하시겠어요?" 단계적 표시: 제목·계좌번호 입력·탭(추천/자주/내계좌)(177.493) → 최근입금계좌 스켈레톤+스피너(177.669) → 카메라 아이콘·"+ 연락처로 이체하기"(177.762) → 행 "정우진 2026.11.21 지역농축협 12345652789012"(178.054) → 은행 로고(178.079) | `history-to-send` | 단계 177.493, 177.552, 177.569, 177.585, 177.603, 177.620, 177.652, 177.669, 177.711, 177.727, 177.762, 177.794, 177.819, 177.886 … |
| 178.095–180.302 | #6952–#6960 | 2207 | HOLD | `send-where` | `send-where:idle` | 보낼 곳 화면 정지 | — |  |
| 180.302–181.801 | #6961–#7018 | 1499 | HOLD | `send-where` | `send-where:row-tap-spinner` | 최근입금계좌 행 탭 → 가운데 스피너 180.302–181.717 (행 눌림 효과 없음) | `send-amount-enter` 동작 `spinner` |  |
| 181.801–182.077 | #7019–#7023 | 276 | HOLD | `send-amount` | `send-amount:blank` | 흰 페이지 + 스피너 (181.801–182.077) | `send-amount-enter` |  |
| 182.077–182.536 | #7024–#7030 | 459 | CHANGE | `send-amount` | `send-amount:render` | "우리은행 계좌에서 ⌄ / WON통장 1002-123-456789 / 정우진 님 계좌로 ⌄ / 지역농축협 12345652789012 / 얼마를 이체하시겠어요? / 출금가능금액 345 원"(182.077) → 앱 키패드(+1만 +5만 +10만 +100만 전액 / 1–9 / 00 0 ← / 확인 비활성)(182.456) | `send-amount-enter` |  |
| 182.536–183.456 | #7031–#7041 | 920 | HOLD | `send-amount` | `send-amount:keypad` | 금액 입력 대기. 183.314 오른쪽 끝 스크롤바 흔적 | 동작 `amount-keypad` |  |
| 183.456–183.530 | #7042–#7045 | 74 | HOLD | `send-amount` | `send-amount:1won` | "1" → 금액 "1원", "1원 · 출금가능금액 345 원", 확인 활성(파랑). 키 눌림 표시는 녹화에 없음 | 동작 `amount-keypad` |  |
| 183.530–183.882 | #7046–#7051 | 352 | CHANGE | `send-amount` | `send-amount:confirm-pressed` | "확인" 눌림(진한 파랑) 183.530–183.882 | 동작 `press-feedback` | 눌림 #086FF3→#195CA5 |
| 183.882–183.974 | #7052–#7054 | 92 | CHANGE | `send-amount` | `send-amount:keypad-hide` | 키패드 한 프레임에 사라짐 → 1원 폼(183.957) | `amount-fields-in` |  |
| 183.974–184.175 | #7055 | 201 | HOLD | `send-amount` | `send-amount:1won-form` | 1원 입력 폼 | — |  |
| 184.175–184.592 | #7056–#7078 | 417 | CHANGE | `send-amount` | `send-amount:fields-in` | "받는 분 통장표기 / 내 통장표기 / 더보기 ⌄ / 이체 유의사항 및 안내" 줄이 아래에서 올라오며 나타남 | `amount-fields-in` | y 오프셋 57.2→0; 524ms cubic-bezier(0.143,0.192,0.274,1.065) 시작 184.174 rms 0.57 · 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 521ms rms 0.64 |
| 184.592–184.709 | #7079–#7085 | 117 | CHANGE | `send-amount` | `send-amount:next-pressed` | "다음" 눌림(진한 파랑 #185BA4) 184.592 부터 — 눌림 색은 184.784(#7090)까지 유지되고 184.809(#7091)에 원래 파랑 #2286F2 로 돌아감 [critic-1 재측정] | 동작 `press-feedback` | 눌림 #2487F2→#185BA4 (#7079–#7090), 손 뗌 184.809 |
| 184.709–184.928 | #7086–#7097 | 219 | HOLD | `send-amount` | `send-amount:next-spinner` | 가운데 스피너(184.726 부터, 점 단계) + [다음] 눌림 색 유지 → 184.809(#7091) 원래 파랑. 기준 프레임은 #7091–#7097 만 [critic-1] | 동작 `spinner` |  |
| 184.928–185.270 | #7098–#7113 | 342 | CHANGE | `send-dup-warning` | `send-dup-warning:open` | 딤 + "오늘 같은 내용으로 보냈어요! 한 번 더 보낼까요?" 시트 올라옴 (⚠ 아이콘, "6분 전", 아니요 / 네, 보낼게요) | `dup-warning-open` | 시트 윗변 최종 y590 (높이 620.2px), 첫 프레임 184.968 윗변 y948; 위치 363ms cubic-bezier(0.635,-0.315,0.322,1.0) 시작 184.787 rms 0.38 · 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 352ms rms 0.61; 검정 딤 α 최종 0.564 (302ms cubic-bezier(0.0,0.06,1.0,1.031) 시작 184.938 rms 0.01 · 이름 곡선 최적 linear 303ms rms 0.01) |
| 185.270–185.973 | #7114–#7151 | 703 | HOLD | `send-dup-warning` | `send-dup-warning:idle` | 중복 경고 시트 정지 | — |  |
| 185.973–186.449 | #7152–#7162 | 476 | CHANGE | `send-dup-warning` | `send-dup-warning:yes-pressed` | "네, 보낼게요" 눌림(진한 파랑) 185.973–186.449 | `dup-yes-to-password` 동작 `press-feedback` | 눌림 #2487F2→#195CA5 |

#### v1 186.449 – 189.586 · #7163–#7240 · 보안 검은 화면 + 비밀번호 시트 누출 (자름, send-b)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 186.449–188.273 | #7163–#7190 | 1824 | HOLD | `secure-black` | `secure-black` | FLAG_SECURE 검은 화면(계좌 비밀번호 키패드 추정), 상태바·내비 바까지 검정 | `dup-yes-to-password` |  |
| 188.273–188.523 | #7191–#7200 | 250 | HOLD | `send-password` | `send-password:leak` | 보안이 풀린 계좌 비밀번호 시트가 새어 나옴: 딤 + "계좌 비밀번호 ✕ / ●●●● / 비밀번호가 기억나지 않아요 / 섞인 숫자패드" — 민감 화면, 재현 안 함 | `dup-yes-to-password` 동작 `shuffled-pin-keypad` |  |
| 188.523–188.674 | #7201–#7208 | 151 | HOLD | `send-password` | `send-password:leak-spinner` | 같은 시트 + 비밀번호 칸 위 스피너 | `dup-yes-to-password` 동작 `spinner` 동작 `shuffled-pin-keypad` |  |
| 188.674–189.586 | #7209–#7240 | 912 | CHANGE | `send-amount` | `send-amount:processing` | 비밀번호 시트·딤 한 프레임에 사라짐(188.674) → 금액 폼 + 가운데 스피너 | — |  |

#### v1 189.586 – 197.452 · #7241–#7523 · 이체 확인 → 이체 → 완료 (send-b, done)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 189.586–190.999 | #7241–#7299 | 1413 | CHANGE | `send-confirm` | `send-confirm:render` | 흰 페이지+스피너(189.711) → 금액 폼 잔상(189.962) → 확인 화면으로 전환(190.163–190.857: 위쪽 계좌 줄이 줄어들며 로고 "→" 헤더로, 본문 페이드) → 이체 버튼 활성(190.898) | `confirm-morph` | 단계 189.711, 189.962, 190.029, 190.204, 190.238, 190.254, 190.280, 190.296, 190.313, 190.329, 190.346, 190.372, 190.388, 190.405 … |
| 190.999–191.441 | #7300–#7324 | 442 | HOLD | `send-confirm` | `send-confirm:idle` | "정우진 님에게 / 1원을 이체하시겠어요? / 지역농축협 12345652789012 계좌로 보냅니다. / 수수료 면제 · 받는 분 통장표기 정우진 · 내 통장표기 정우진 / 인증서 비밀번호 입력 없이 바로 이체됩니다. / [이체]" | — |  |
| 191.441–191.567 | #7325–#7329 | 126 | CHANGE | `send-confirm` | `send-confirm:transfer-pressed` | "이체" 눌림(진한 파랑) 191.441–191.533 → 비활성(연파랑) | `transfer-processing` 동작 `press-feedback` | 눌림 #2387F3→#195CA5 |
| 191.567–193.407 | #7330–#7428 | 1840 | HOLD | `send-confirm` | `send-confirm:processing` | 버튼 비활성 + 스피너(192.086–193.290, 통장표기 줄 근처·가운데) | `transfer-processing` |  |
| 193.407–194.201 | #7429–#7457 | 794 | CHANGE | `send-done` | `send-done:render` | 흰 페이지+스피너(193.407) → 완료 본문(193.641) → 파란 원 커짐(193.70–193.90) → 체크 그려짐(193.95–194.18) | `done-enter` 동작 `done-check` | 파란 원 반지름 4@193.700 → 31@193.775 → 44@193.800 → 44@193.850 → 42@193.875 → 41@193.905 → 41@193.928 → 41@193.950 |
| 194.201–196.120 | #7458–#7483 | 1919 | HOLD | `send-done` | `send-done:idle` | "정우진 님에게 이체했어요" + 받는 계좌·이체금액 1원·메모·이체확인증 / 더보기 / 광고 카드 / 공유·확인 | — |  |
| 196.120–196.944 | #7484–#7521 | 824 | CHANGE | `send-done` | `send-done:os-headsup` | OS 헤드업 알림(입출금 알림 …, 앱 아님) 위에서 내려옴 196.120–196.432. "확인" 눌림 196.228–196.369(#2387F3→#195CA5) → 가운데 스피너(262,628) 196.348–197.251(#7495–#7523) [critic-1: 시작 196.449→196.348] | `done-to-history` | os-headsup; 눌림 #2387F3→#195CA6 |
| 196.944–197.452 | #7522–#7523 | 508 | HOLD | `send-done` | `send-done:idle-headsup` | 완료 화면 + OS 알림 + 스피너(다음 화면 대기) | `done-to-history` |  |

#### v1 197.452 – 200.483 · #7524–#7589 · 거래내역 (잔액 344원) (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 197.452–199.631 | #7524–#7583 | 2179 | CHANGE | `history-loading` | `history-loading:render` | 거래내역 스켈레톤으로 한 프레임에 교체(197.452) → 스피너(197.719–198.532) → 내용 344원(198.625, 토글 꺼짐) → 토글 켬(198.923) → 아이콘(199.040) → OS 알림 위로 사라짐(199.400–199.603) | `done-to-history` | 단계 197.452, 197.869, 198.625, 198.923, 199.040, 199.199, 199.400, 199.418, 199.435, 199.468, 199.485, 199.502, 199.518, 199.535 … |
| 199.631–200.483 | #7584–#7589 | 852 | HOLD | `history` | `history:top-344` | 거래내역 최상단: 잔액 344원 / 출금가능금액 344원, 첫 행 "11월 21일 11:09:11 정우진 -1원 잔액 344원" | — |  |

## 3. v2 구간표 (110구간, #0–#3440)

열은 2절과 같다. 측정값 열의 `mask x,y,w,h` = 그 정지 구간을 기준 프레임으로 쓸 때 뺄 곳(스피너·커서·캐릭터 배너·OS 겹침).

#### v2 0.000 – 0.515 · #0–#14 · 시작: 거래내역 (v1 끝 상태) → 홈으로 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 0.000–0.195 | #0–#6 | 195 | HOLD | `history` | `history:top-344-withdraw` | 녹화 시작. 거래내역조회 최상단: 한도제한 · WON 통장 1002-123-456789 · 344원 · 출금가능금액 344원 · [모으기][이체] · 검색/“3개월·출금·최신순” · 2026.08.21 ~ 2026.11.21 · 잔액 표시(켬) · 기간 내 합계 · 2026년 11월 · 첫 행 “11월 21일 11:09:11 농협정우진 -1원 잔액 344원” (v1 마지막 상태와 같음). 0.135(#6) OS 내비 아이콘 3개가 한꺼번에 진해짐(OS) | `history-to-home` |  |
| 0.195–0.515 | #7–#14 | 320 | HOLD | `history` | `history:leave-spinner` | 가운데 스피너(262,628) 0.195–0.442 — 다음 화면(홈) 불러오는 중. 무엇을 눌렀는지는 화면에 안 보임(헤더 ‹ 눌림 효과 없음, 0.135 OS 내비 아이콘 변화 → OS 뒤로 가기 추정) | `history-to-home` 동작 `spinner` | 스피너 · mask `224,590,76,76` |

#### v2 0.515 – 4.974 · #15–#114 · 홈 다시 그리기 · 잔액 굴림 · 배너 자동 넘김 · 계좌 카드 탭 (home)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 0.515–0.695 | #15 | 180 | CHANGE | `home-loading` | `home-loading:blank` | 거래내역이 한 프레임에 사라지고 홈 바탕만(앱·상태바·내비 바 모두 #F0F1F4) — 전환 애니메이션 없음 | `history-to-home` |  |
| 0.695–0.885 | #16–#19 | 190 | HOLD | `home` | `home:cached` | 홈(이전 내용 그대로) 한 프레임에 나타남. 바탕: 위쪽 하늘색 패널 #E5F3FF → 아래 흰색(#FBFCFF), 상태바·내비 바 #F0F1F4 계열. [일반홈\|쉬운] · 지갑·AI·알림·☰ / 공지카드 “이번 행운은 내차례일지도.. 우리두근두근행운적금 만나러가기” + 캐릭터 그림(점 1/5) / 홈계좌설정 · 잔액숨김 / “다른 은행 계좌도 홈에서…” 카드(은행 로고 줄 + [+ 다른 은행 계좌 추가]) / WON 통장 카드(1002-123-456789, 한도제한, 344원, [이체], 파란 띠 “첫 급여받으면 NpayP 100% 드림”) / 전체계좌보기 / 중간 배너 2/10 “첫 결제 5,000P + 최대 5.3% 적립” / 하단 탭(상품·자산·소비·홈·주식·혜택). 0.797(#18) 헤더 둘째 아이콘(말풍선) 안에 “AI” 글자 표시 + 캐릭터 그림 움직임 시작 | `history-to-home` | mask `110,230,272,166` |
| 0.885–1.169 | #20 | 284 | CHANGE | `home-loading` | `home-loading:drop-other-bank` | “다른 은행 계좌” 카드가 한 프레임에 빠지고 WON 통장 카드 이하가 그만큼 위로 붙음(애니메이션 없음) | `history-to-home` | mask `110,230,272,166` |
| 1.169–1.471 | #21–#26 | 301 | HOLD | `home-loading` | `home-loading:no-account` | WON 통장 카드도 한 프레임에 빠짐 → 공지카드 바로 아래 [전체계좌보기], 중간 배너, “추천서비스”(우리WON모바일·환전주머니 …) 보임 | `history-to-home` | mask `110,230,272,166` |
| 1.471–1.571 | #27 | 101 | CHANGE | `home-loading` | `home-loading:panel-shrink` | 홈 위쪽 하늘색 바탕 패널(#E5F3FF, 계좌 카드 묶음 뒤 배경)이 짧아짐 — y≈700 아래가 흰색(#FFFFFF)으로(1.471). 1.838 패널 다시 길어짐 | `history-to-home` | mask `110,230,272,166` |
| 1.571–2.055 | #28–#32 | 484 | CHANGE | `home-loading` | `home-loading:skeleton` | 계좌 자리에 회색 스켈레톤 카드 2개가 한 프레임에 들어와 아래를 밀어냄(1.571). 1.838 캐릭터만 움직임 | `history-to-home` | mask `110,230,272,166` |
| 2.055–2.683 | #33–#44 | 627 | CHANGE | `home-loading` | `home-loading:account-no-balance` | 첫 스켈레톤 → WON 통장 카드(1002-123-456789 · 한도제한 · [이체], 잔액 자리 비어 있음)(2.055) → 두 번째 스켈레톤 사라짐(2.274) → 아래 줄 다시 그림(2.373) → 잔액 자리에 “원” 글자만(2.448) | `history-to-home` | mask `110,230,272,166` |
| 2.683–2.959 | #45–#48 | 277 | CHANGE | `home-loading` | `home-loading:other-bank-back` | “다른 은행 계좌” 카드가 다시 한 프레임에 들어옴(로고 줄 없이, 2.683) → 카드 안 은행 로고 줄 표시로 카드가 46px 커짐(2.792). 모두 즉시(애니메이션 없음) | `history-to-home` | mask `110,230,272,166` |
| 2.959–3.577 | #49–#72 | 618 | CHANGE | `home` | `home:balance-roll` | 잔액 숫자 굴림(오도미터): 2.959 옅은 회색 숫자 “5 55”가 나타나며 진해짐(2.959–3.067) → 3.084 세 자리가 세로로 굴러 “9 00”→“0 11”→“122”(3.226)→“233”(3.295)→“344”(3.410, 아래쪽) → 3.427–3.561 위로 올라오며 기준선에 자리잡음(3.561 정지 = 홈 완성). 3.084–3.117 카드 아래 파란 띠(“첫 급여받으면 NpayP 100% 드림”)가 카드 밑에서 내려오며 나타남(옅게→진하게) | `balance-odometer` `history-to-home` | 잔액 굴림 2.959–3.561 · mask `110,230,272,166` |
| 3.577–3.878 | #73–#87 | 301 | CHANGE | `home` | `home:banner-2to3` | 중간 배너 자동 넘김: “첫 결제 5,000P” 카드가 왼쪽으로 나가고 “11월 한정 통신비 특가” 카드가 오른쪽에서 들어옴 (카드 폭 480px, 사이 26px, 피치 506px) | `banner-programmatic` | 들어오는 카드 오프셋 506.0→0.0px: 이름 곡선 최적 ease 301ms (시작 3.552, rms 0.93px) · 자유 cubic-bezier(0.257, 0.094, 0.241, 0.971) 294ms rms 0.68px · mask `110,230,272,166` |
| 3.878–4.204 | #88–#99 | 325 | HOLD | `home` | `home:banner-3` | 홈 정지, 중간 배너 3/10 “11월 한정 통신비 특가”. 캐릭터 그림만 계속 움직임 (공지카드 캐릭터 배너는 0.695–4.974 동안 넘어가지 않음, 점 1/5 유지) | — | mask `110,230,272,166` |
| 4.204–4.974 | #100–#114 | 770 | HOLD | `home` | `home:account-tap-spinner` | WON 통장 카드(또는 잔액) 탭 → 홈 위 스피너(중심 262,585 = 하단 탭 위 영역 가운데) 4.204–4.847. 카드 눌림 효과 없음 | `home-to-history` 동작 `spinner` | 스피너 · mask `224,546,76,78;110,230,272,166` |

#### v2 4.974 – 9.021 · #115–#211 · 거래내역 로딩 → 최상단 (3개월·전체) (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 4.974–5.501 | #115–#136 | 527 | CHANGE | `history-loading` | `history-loading:blank` | 홈이 한 프레임에 흰 페이지(상태바·내비 바 흰색)로 바뀜 + 가운데 스피너(262,628). 밀려 들어오는 애니메이션 없음 | `home-to-history` | 스피너 · mask `224,590,76,76` |
| 5.501–5.626 | #137–#139 | 125 | CHANGE | `history-loading` | `history-loading:title` | 헤더 제목 “거래내역조회”와 “관리”만 먼저(5.501) | `home-to-history` | mask `224,590,76,76` |
| 5.626–6.462 | #140–#178 | 836 | HOLD | `history-loading` | `history-loading:skeleton` | 헤더 ‹ + 스켈레톤(계좌 카드·버튼·목록 회색 막대) + 스피너 | `home-to-history` | mask `224,590,76,76` |
| 6.462–7.215 | #179–#203 | 752 | CHANGE | `history` | `history:render` | 내용 한 프레임에 표시(6.462): 1002-123-456789 344원·[모으기][이체]·필터 줄 “3개월·전체·최신순”·기간·잔액 표시·기간 내 합계·11월 목록. 아이콘 일부 빈칸, 잔액 표시 토글은 회색(#818589, 손잡이 x443–462 왼쪽) → 6.638 토글 파랑(#2789F6)·손잡이 조금 커짐(x444–467) → 6.730 손잡이 오른쪽(x466–489, 중간 프레임 없음) + 검색·필터·⌄·복사 아이콘 표시. 스피너는 7.190 까지 | `home-to-history` | mask `224,590,76,76` |
| 7.215–7.231 | #204 | 16 | CHANGE | `history` | `history:spinner-off` | 스피너 사라짐(7.215, 페이드 없음) | `home-to-history` 동작 `spinner` |  |
| 7.231–9.021 | #205–#211 | 1790 | HOLD | `history` | `history:top-344-all` | 거래내역조회 최상단 정지 (3개월·전체·최신순) | — |  |

#### v2 9.021 – 11.438 · #212–#291 · 조회조건 시트 → 입금 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 9.021–9.364 | #212–#228 | 343 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | (필터 줄 탭, 눌림 효과 없음) 조회조건 바텀시트가 아래에서 올라옴(9.021 첫 프레임에 윗변이 y≈1200 으로 막 보임) + 딤(검정, α 0→0.556, 선형 약 300ms). 시트 윗변 1210→544.5px | `filter-sheet-open` | 시트 윗변 1210.2→544.5px: 이름 곡선 최적 easeOutQuad(0.5,1,0.89,1) 249ms (시작 8.996, 28.152, rms 1.19px) · 자유 cubic-bezier(0.47, 1.02, 0.928, 0.994) 249ms rms 0.99px; 딤 α 0.0→0.556: 이름 곡선 최적 linear 304ms (시작 28.211, rms 0.01) · 자유 cubic-bezier(0.0, -0.08, 1.0, 1.013) 314ms rms 0.01 |
| 9.364–9.480 | #229–#235 | 116 | HOLD | `history-filter-sheet` | `history-filter-sheet:all` | 시트: “조회조건 선택 ✕ / 조회기간 [이번달\|3개월\|6개월\|1년\|직접입력] / 거래구분 [전체\|입금\|출금] / 상세조건조회 ⌄ / [초기화][적용하기]”, 3개월·전체 선택. 딤 α 0.56(흰 255→111) | — |  |
| 9.480–10.210 | #236–#237 | 730 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | [입금] 탭 → 선택 테두리가 [전체]에서 [입금]으로 한 프레임에 옮겨감(눌림 단계 없음) | `filter-select` |  |
| 10.210–10.493 | #238–#241 | 282 | HOLD | `history-filter-sheet` | `history-filter-sheet:apply-pressed` | [적용하기] 눌림: #2387F3 → #195CA5 (10.210–10.526, 닫히기 시작 뒤 2프레임까지) | 동작 `press-feedback` | 눌림 #2387F3 → #195CA5 (10.21–) |
| 10.493–10.776 | #242–#258 | 284 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트가 아래로 내려가며 닫힘(easeInCubic 약 250ms) + 딤 선형 페이드 아웃(약 293ms). 닫히기 시작하는 프레임(10.493)에 뒤 화면이 바뀜: 필터 줄 글자 “3개월·입금·최신순”, 기간 줄·기간 내 합계·목록이 비워짐(흰 바탕) + 가운데 스피너. 시트는 10.726 에 화면 밖, 딤은 10.760 에 0 | `filter-sheet-close` | 시트 윗변 544.5→1210.2px: 이름 곡선 최적 easeInCubic(0.32,0,0.67,0) 252ms (시작 10.462, rms 0.88px) · 자유 cubic-bezier(0.418, -0.002, 0.702, 0.195) 233ms rms 0.65px; 딤 α 0.557→0.0: 이름 곡선 최적 linear 293ms (시작 10.471, rms 0.0) · 자유 cubic-bezier(0.0, 0.045, 1.0, 0.953) 284ms rms 0.0 · mask `224,590,76,76` |
| 10.776–10.944 | #259–#267 | 168 | HOLD | `history` | `history:reload-spinner` | 거래내역: 계좌 카드·버튼·필터 줄(3개월·입금·최신순)만, 그 아래 비어 있음 + 스피너 | `history-reload` 동작 `spinner` | mask `224,590,76,76` |
| 10.944–11.413 | #268–#290 | 469 | HOLD | `history` | `history:filter-deposit-spinner` | 기간 줄·기간 내 합계·입금 목록이 한 프레임에 채워짐(10.944): 필터 “3개월·입금·최신순”, 첫 행 “11월 20일 21:29:47 한지호 +100,000원 잔액 100,001원”. 스피너 11.396 까지 | `history-reload` 동작 `spinner` | mask `224,590,76,76` |
| 11.413–11.438 | #291 | 25 | HOLD | `history` | `history:filter-deposit-top` | 입금 목록 최상단(스피너 없음) | — |  |

#### v2 11.438 – 28.199 · #292–#1056 · 입금 목록 스크롤 (손가락 끌기 여러 번) (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 11.438–12.315 | #292–#335 | 877 | CHANGE | `history` | `history:deposit-scroll:drag1` | 스크롤 1: scrollTop 0.0 → 318.1px (+318.1px) | `history-scroll` 동작 `scroll-inertia` | 885ms, 최고 속도 886.6px/s @11.931, 감속 τ≈112.9ms · mask `512,46,12,1164` |
| 12.315–12.441 | #336–#337 | 126 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 318.1px) | `history-scroll` | mask `512,46,12,1164` |
| 12.441–13.251 | #338–#374 | 810 | CHANGE | `history` | `history:deposit-scroll:drag2` | 스크롤 2: scrollTop 318.1 → 471.8px (+153.7px) | `history-scroll` 동작 `scroll-inertia` | 818ms, 최고 속도 413.2px/s @12.666, 감속 τ≈485.3ms · mask `512,46,12,1164` |
| 13.251–13.454 | #375–#376 | 203 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 471.8px) | `history-scroll` | mask `512,46,12,1164` |
| 13.454–20.106 | #377–#686 | 6652 | CHANGE | `history` | `history:deposit-scroll:drag3` | 스크롤 3: scrollTop 471.8 → 1594.2px (+1122.4px) | `history-scroll` 동작 `scroll-inertia` | 6670ms, 최고 속도 539.8px/s @17.992 · mask `512,46,12,1164` |
| 20.106–20.201 | #687–#688 | 95 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 1594.2px) | `history-scroll` | mask `512,46,12,1164` |
| 20.201–21.027 | #689–#726 | 826 | CHANGE | `history` | `history:deposit-scroll:drag4` | 스크롤 4: scrollTop 1594.2 → 1751.5px (+157.3px) | `history-scroll` 동작 `scroll-inertia` | 886ms, 최고 속도 413.7px/s @20.416, 감속 τ≈455.4ms · mask `512,46,12,1164` |
| 21.027–21.203 | #727–#728 | 176 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 1751.4px) | `history-scroll` | mask `512,46,12,1164` |
| 21.203–23.367 | #729–#838 | 2164 | CHANGE | `history` | `history:deposit-scroll:drag5` | 스크롤 5: scrollTop 1751.4 → 2348.3px (+596.9px) | `history-scroll` 동작 `scroll-inertia` | 2307ms, 최고 속도 774.6px/s @22.824, 감속 τ≈240.2ms · mask `512,46,12,1164` |
| 23.367–23.444 | #839–#840 | 77 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 2348.3px) | `history-scroll` | mask `512,46,12,1164` |
| 23.444–26.319 | #841–#978 | 2875 | CHANGE | `history` | `history:deposit-scroll:drag6` | 스크롤 6: scrollTop 2348.3 → 3220.5px (+872.3px) | `history-scroll` 동작 `scroll-inertia` | 2883ms, 최고 속도 724.5px/s @23.693 · mask `512,46,12,1164` |
| 26.319–26.460 | #979–#980 | 141 | HOLD | `history` | `history:deposit-scroll:pause` | 스크롤 멈춤 (scrollTop 3220.5px) | `history-scroll` | mask `512,46,12,1164` |
| 26.460–27.824 | #981–#1055 | 1364 | CHANGE | `history` | `history:deposit-scroll:drag7` | 스크롤 7: scrollTop 3220.5 → 3728.7px (+508.2px) | `history-scroll` 동작 `scroll-inertia` | 1387ms, 최고 속도 879.7px/s @26.895, 감속 τ≈1218.8ms · mask `512,46,12,1164` |
| 27.824–28.199 | #1056 | 375 | HOLD | `history` | `history:deposit-scrolled` | 입금 목록 스크롤된 상태(scrollTop ≈3728.7px) | — | mask `512,46,12,1164` |

#### v2 28.199 – 31.203 · #1057–#1133 · 조회조건 시트 → 출금 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 28.199–28.527 | #1057–#1075 | 327 | CHANGE | `history-filter-sheet` | `history-filter-sheet:open` | 조회조건 시트 다시 열림(1차와 같은 곡선, 가장 깨끗한 표본: easeOutCubic 약 260ms) + 딤 0→0.556 선형 약 300ms | `filter-sheet-open` | 시트 윗변 1210.2→544.5px: 이름 곡선 최적 easeOutCubic(0.33,1,0.68,1) 260ms (시작 28.178, rms 0.41px) · 자유 cubic-bezier(0.335, 0.861, 0.622, 0.989) 239ms rms 0.34px; 딤 α 0.0→0.556: 이름 곡선 최적 linear 304ms (시작 28.211, rms 0.01) · 자유 cubic-bezier(0.0, -0.08, 1.0, 1.013) 314ms rms 0.01 |
| 28.527–29.212 | #1076–#1077 | 686 | HOLD | `history-filter-sheet` | `history-filter-sheet:deposit` | 시트(3개월·입금 선택) | — |  |
| 29.212–29.455 | #1078–#1080 | 243 | HOLD | `history-filter-sheet` | `history-filter-sheet:withdraw` | [출금] 탭 → 선택 테두리 [출금]으로 | `filter-select` |  |
| 29.455–29.707 | #1081 | 252 | HOLD | `history-filter-sheet` | `history-filter-sheet:apply-pressed-top` | [적용하기] 눌림(#195CA5, 29.455–29.707) + 시트 뒤 목록이 한 프레임에 맨 위(계좌 카드 보임)로 돌아감 | 동작 `press-feedback` | 눌림 #2387F3 → #195CA5 (29.455–) |
| 29.707–29.973 | #1082–#1096 | 267 | CHANGE | `history-filter-sheet` | `history-filter-sheet:close` | 시트 닫힘(1차와 같은 곡선) + 딤 페이드 아웃. 닫히기 시작 프레임(29.707)에 필터 줄 “3개월·출금·최신순”, 그 아래 목록 비워짐 + 스피너 | `filter-sheet-close` | 시트 윗변 544.5→1210.2px: 이름 곡선 최적 easeInCubic(0.32,0,0.67,0) 258ms (시작 10.460, 29.671, rms 0.97px) · 자유 cubic-bezier(0.253, 0.016, 0.651, 0.013) 235ms rms 0.85px; 딤 α 0.557→0.0: 이름 곡선 최적 linear 293ms (시작 10.471, rms 0.0) · 자유 cubic-bezier(0.0, 0.045, 1.0, 0.953) 284ms rms 0.0 · mask `224,590,76,76` |
| 29.973–30.221 | #1097–#1109 | 248 | HOLD | `history` | `history:reload-spinner` | 거래내역 최상단: 계좌 카드·버튼·필터 줄(3개월·출금·최신순)만, 그 아래 비어 있음 + 스피너 | `history-reload` 동작 `spinner` | mask `224,590,76,76` |
| 30.221–30.692 | #1110–#1128 | 471 | HOLD | `history` | `history:filter-withdraw-spinner` | 기간 줄·기간 내 합계·출금 목록이 채워짐(30.221): “3개월·출금·최신순”, 첫 행 “11월 21일 11:09:11 농협정우진 -1원 잔액 344원”. 오른쪽 스크롤바 잠깐(30.221). 스피너 30.676 까지 | `history-reload` 동작 `spinner` | mask `224,590,76,76;512,46,12,1164` |
| 30.692–31.203 | #1129–#1133 | 511 | HOLD | `history` | `history:top-344-withdraw` | 출금 목록 최상단 (0.000 의 첫 화면과 같은 상태) | — |  |

#### v2 31.203 – 60.306 · #1134–#2544 · 출금 목록 긴 스크롤 → 플링으로 맨 위 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 31.203–33.192 | #1134–#1229 | 1989 | CHANGE | `history` | `history:withdraw-scroll:drag1` | 스크롤 1: scrollTop 0.0 → 328.7px (+328.7px) | `history-scroll` 동작 `scroll-inertia` | 2039ms, 최고 속도 380.8px/s @31.244 · mask `512,46,12,1164` |
| 33.192–33.610 | #1230–#1234 | 418 | HOLD | `history` | `history:withdraw-scroll:pause` | 스크롤 멈춤 (scrollTop 328.7px) | `history-scroll` | mask `512,46,12,1164` |
| 33.610–35.182 | #1235–#1322 | 1572 | CHANGE | `history` | `history:withdraw-scroll:drag2` | 스크롤 2: scrollTop 328.7 → 737.9px (+409.2px) | `history-scroll` 동작 `scroll-inertia` | 1578ms, 최고 속도 574.5px/s @34.263, 감속 τ≈1231.4ms · mask `512,46,12,1164` |
| 35.182–35.442 | #1323–#1325 | 260 | HOLD | `history` | `history:withdraw-scroll:pause` | 스크롤 멈춤 (scrollTop 738.0px) | `history-scroll` | mask `512,46,12,1164` |
| 35.442–36.302 | #1326–#1376 | 860 | CHANGE | `history` | `history:withdraw-scroll:drag3` | 스크롤 3: scrollTop 738.0 → 911.5px (+173.6px) | `history-scroll` 동작 `scroll-inertia` | 869ms, 최고 속도 345.2px/s @35.458, 감속 τ≈2014.5ms · mask `512,46,12,1164` |
| 36.302–36.444 | #1377–#1378 | 142 | HOLD | `history` | `history:withdraw-scroll:pause` | 스크롤 멈춤 (scrollTop 911.5px) | `history-scroll` | mask `512,46,12,1164` |
| 36.444–37.215 | #1379–#1416 | 771 | CHANGE | `history` | `history:withdraw-scroll:drag4` | 스크롤 4: scrollTop 911.5 → 1041.0px (+129.5px) | `history-scroll` 동작 `scroll-inertia` | 735ms, 최고 속도 281.6px/s @36.611, 감속 τ≈498.0ms · mask `512,46,12,1164` |
| 37.215–37.457 | #1417–#1418 | 242 | HOLD | `history` | `history:withdraw-scroll:pause` | 스크롤 멈춤 (scrollTop 1041.0px) | `history-scroll` | mask `512,46,12,1164` |
| 37.457–46.336 | #1419–#1877 | 8879 | CHANGE | `history` | `history:withdraw-scroll:drag5` | 스크롤 5: scrollTop 1041.0 → 4055.1px (+3014.1px) | `history-scroll` 동작 `scroll-inertia` | 8894ms, 최고 속도 1374.0px/s @41.539 · mask `512,46,12,1164` |
| 46.336–46.420 | #1878–#1879 | 84 | HOLD | `history` | `history:withdraw-scroll:pause` | 스크롤 멈춤 (scrollTop 4055.1px) | `history-scroll` | mask `512,46,12,1164` |
| 46.420–52.824 | #1880–#2182 | 6404 | CHANGE | `history` | `history:withdraw-scroll:drag6` | 스크롤 6: scrollTop 4055.1 → 6565.2px (+2510.1px) | `history-scroll` 동작 `scroll-inertia` | 6436ms, 최고 속도 1358.8px/s @50.148 · mask `512,46,12,1164` |
| 52.824–59.679 | #2183–#2529 | 6855 | CHANGE | `history` | `history:withdraw-scroll:drag7` | 스크롤 7: scrollTop 6565.2 → -2.5px (-6567.7px) — 위로(맨 위 복귀) | `history-scroll` 동작 `scroll-inertia` | 6832ms, 최고 속도 -3583.0px/s @59.528 · mask `512,46,12,1164` |
| 59.679–60.306 | #2530–#2544 | 627 | HOLD | `history` | `history:top-344-withdraw` | 출금 목록 최상단 정지(30.710 과 픽셀 같음). 오른쪽 오버레이 스크롤바(x517–523, y58–144)가 59.68–60.28 사이 흐려지며 사라짐 | — | mask `512,46,12,1164` |

#### v2 60.306 – 63.760 · #2545–#2594 · [이체] → 보낼 곳 “어디로 이체하시겠어요?” (history, send-a)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 60.306–60.490 | #2545–#2550 | 184 | HOLD | `history` | `history:transfer-pressed` | [이체] 눌림 #2487F5 → #195CA5 (60.306–60.473) + 가운데 스피너(60.306–60.566) | `history-to-send` 동작 `press-feedback` | 눌림 #2387F3 → #195CA5 (60.306–) · mask `224,590,76,76` |
| 60.490–60.951 | #2551–#2555 | 461 | HOLD | `history` | `history:transfer-spinner` | [이체] 원래 색(#2387F3)으로 + 스피너 | `history-to-send` 동작 `spinner` | mask `224,590,76,76` |
| 60.951–61.921 | #2556–#2567 | 971 | CHANGE | `send-loading` | `send-loading:blank` | 흰 페이지로 한 프레임에 바뀜(60.951) → 스피너 61.352–62.389 | `history-to-send` | mask `224,590,76,76` |
| 61.921–62.406 | #2568–#2587 | 485 | CHANGE | `send-where` | `send-where:render` | “어디로 이체하시겠어요?” 단계적 표시: 제목·계좌번호 입력·탭[추천\|자주\|내계좌](61.921, 헤더 ‹ 없음) → “연락처로 이체하기” 가운데에 옅게 나타나 위로(y≈1154→1140) 올라오며 진해짐(61.946–62.205) → 최근입금계좌·편집 + 스켈레톤 3줄(62.029) → 헤더 ‹ · 카메라 아이콘 · “+ 연락처로 이체하기” 왼쪽 정렬(62.138) → 행 “정우진 2026.11.21 / 지역농축협 12345652789012”(62.238) → 아바타(노란 원)·☆(62.389). 스피너 62.389 까지 | `history-to-send` | mask `224,590,76,76` |
| 62.406–63.760 | #2588–#2594 | 1354 | HOLD | `send-where` | `send-where:idle` | 보낼 곳 화면 정지 | — |  |

#### v2 63.760 – 71.412 · #2595–#2738 · 계좌번호 직접 입력 (OS 노란 키보드) (send-a)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 63.760–64.053 | #2595–#2610 | 293 | CHANGE | `send-account-input` | `send-account-input:push` | (계좌번호 입력 칸 탭) “계좌번호를 입력해 주세요” 페이지가 오른쪽에서 밀려 들어옴(524→0px), 아래 페이지는 제자리에서 흰 베일로 덮임(α 0→0.44+). 헤더 ✕ 는 63.945 에 나타남 | `push-account-input` | 새 페이지 왼끝 x 524.0→0.0px: 이름 곡선 최적 md-decelerate(0,0,0.2,1) 260ms (시작 63.753, 71.557, rms 0.69px) · 자유 cubic-bezier(0.0, 0.122, 0.253, 1.0) 255ms rms 0.64px |
| 64.053–64.120 | #2611–#2613 | 67 | HOLD | `send-account-input` | `send-account-input:empty` | “계좌번호를 입력해 주세요 ✕ / 입력 / 은행/증권사 선택 ⌄”, 밑줄 연회색(#E7EBEF) | — | mask `27,240,6,43` |
| 64.120–64.520 | #2614–#2635 | 400 | CHANGE | `send-account-input` | `send-account-input:focus` | 입력칸 밑줄이 가운데(x262)에서 양쪽으로 펴지며 진해짐(#46474C, 2px, x28–495, easeInOutCubic 약 410ms). 커서 깜빡임(x28–31) | `input-underline` | 밑줄 폭 0.0→468.0px: 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 408ms (시작 64.103, rms 0.63px) · 자유 cubic-bezier(0.66, -0.01, 0.343, 1.008) 420ms rms 0.6px · mask `27,240,6,43` |
| 64.520–64.672 | #2636–#2641 | 152 | HOLD | `send-account-input` | `send-account-input:focused` | 포커스 상태(커서 깜빡임) | — | mask `27,240,6,43` |
| 64.672–65.023 | #2642–#2656 | 351 | CHANGE | `send-account-input` | `send-account-input:keyboard-up` | OS 숫자 키보드(노란 테마)가 올라옴: 64.672–64.688 화면 아래 회색(240) 띠 → 툴바 위끝 1210→738.95px(critic-1: 정착 위치는 units 508dp = 738.95. 표본 추적은 −0.25px 치우침) (약 350ms 감속) | `keyboard-up` 동작 `system-keyboard` | 키보드 윗변 1210.18→738.95px(맞춤 to 는 738.45 기준): 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 355ms (시작 64.660, rms 2.27px) · 자유 cubic-bezier(0.163, -0.013, 0.0, 1.041) 368ms rms 2.14px · mask `0,738,524,542` |
| 65.023–65.207 | #2657–#2659 | 183 | HOLD | `send-account-input` | `send-account-input:keyboard` | 빈 입력칸 + 키보드. 보이는 앱 영역 45.6–738.95px | 동작 `system-keyboard` | mask `0,738,524,542;27,240,6,43` |
| 65.207–70.460 | #2660–#2734 | 5253 | CHANGE | `send-account-input` | `send-account-input:typing` | 계좌번호 13자리(3333123456789) 한 자씩 입력. 첫 글자와 함께 지우기 ⓧ(x468–493) 표시. 67.348 부터 입력칸 아래 추천 은행 칩 줄(예: 카카오뱅크·우리·농협…)이 나타나 숫자에 따라 바뀜(67.348, 67.415, 67.732, 67.785, 68.001, 69.523, 69.824, 70.008, 70.409). 키 눌림 강조는 OS 키보드(회색 칸) | 동작 `typing-and-chips` | 글자 표시 65.423, 65.762, 66.271, 67.215, 67.650, 67.933, 68.218, 68.639, 69.107, 69.472, 69.709, 69.943, 70.327 · mask `0,738,524,542;27,240,6,43` |
| 70.460–71.412 | #2735–#2738 | 952 | HOLD | `send-account-input` | `send-account-input:typed` | 13자리 입력 완료 + 추천 칩 + 키보드 | — | mask `0,738,524,542;27,240,6,43` |

#### v2 71.412 – 74.214 · #2739–#2847 · 금융회사 선택 페이지 → 카카오뱅크 → 확인 (send-a)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 71.412–71.965 | #2739–#2764 | 553 | CHANGE | `send-bank-sheet` | `send-bank-sheet:open` | (은행/증권사 선택 탭) 입력칸 밑줄 포커스 풀림(71.412) → 키보드 내려감(71.428–71.547) → 계좌번호 페이지가 흰 베일 α≈0.84 로 덮임(71.572) → “금융회사를 선택해 주세요” 페이지가 오른쪽에서 밀려 들어옴(71.588–71.732, 계좌번호 입력과 같은 곡선) → 71.732–71.872 x=38.8 에서 멈춤(앱 jank) → 71.890 31.6 → 71.939 0. 헤더 ✕ 71.890. 바텀시트·딤 아님(전체 페이지) | `keyboard-down` `push-bank-page` | 새 페이지 왼끝 x 524.0→0.0px: 이름 곡선 최적 md-decelerate(0,0,0.2,1) 260ms (시작 63.753, 71.557, rms 0.69px) · 자유 cubic-bezier(0.0, 0.122, 0.253, 1.0) 255ms rms 0.64px |
| 71.965–72.207 | #2765–#2771 | 243 | CHANGE | `send-bank-sheet` | `send-bank-sheet:render` | 탭[은행\|증권사] + 3열 은행 그리드(로고 원 + 이름)(71.965) → 로고 그림 단계적 로딩(72.023, 72.040, 72.073, 72.098, 72.144) | `bank-render` |  |
| 72.207–72.467 | #2772–#2773 | 259 | HOLD | `send-bank-sheet` | `send-bank-sheet:idle` | 금융회사 선택 페이지 정지 | — |  |
| 72.467–73.177 | #2774–#2799 | 710 | CHANGE | `send-account-input` | `send-account-input:bank-selected` | (카카오뱅크 탭, 눌림 효과 없음) 한 프레임에 계좌번호 페이지로 돌아옴: 은행 칸 “(카카오뱅크 로고) 카카오뱅크 ⌄”, 추천 칩, 하단 [확인](#2387F3), 키보드 없음 → 72.749–73.150 은행 칸 밑줄이 가운데에서 펴짐(입력칸과 같은 곡선) | `input-underline` `bank-selected` | 밑줄 폭 0.0→468.0px: 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 400ms (시작 72.746, rms 0.69px) · 자유 cubic-bezier(0.655, 0.015, 0.353, 1.01) 404ms rms 0.44px |
| 73.177–73.201 | #2800 | 25 | HOLD | `send-account-input` | `send-account-input:ready` | [확인] 활성 상태 | — |  |
| 73.201–73.368 | #2801–#2804 | 167 | HOLD | `send-account-input` | `send-account-input:confirm-pressed` | [확인] 눌림 #2387F3 → #195CA7 (73.201–73.351) + 스피너(73.319~) | `account-confirm-reveal` 동작 `press-feedback` | 눌림 #2387F3 → #195CA7 (73.201–) · mask `224,590,76,76` |
| 73.368–74.214 | #2805–#2847 | 846 | HOLD | `send-account-input` | `send-account-input:confirm-spinner` | [확인] 원래 색 + 스피너 | `account-confirm-reveal` 동작 `spinner` | mask `224,590,76,76` |

#### v2 74.214 – 78.201 · #2848–#2969 · 금액 2원 입력 → 다음 (send-a, send-b)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 74.214–74.723 | #2848–#2866 | 509 | CHANGE | `send-where` | `send-where:reveal` | 계좌번호 페이지가 한 프레임에 사라지고(74.214) 아래 “어디로 이체” 페이지가 흰 베일 α 0.80 으로 보임 → 74.439–74.706 베일이 선형으로 걷힘(약 300ms). 스피너 계속 | `account-confirm-reveal` | 흰 베일 α 0.8→0.0: 이름 곡선 최적 linear 307ms (시작 74.432, rms 0.01) · 자유 cubic-bezier(0.0, -0.055, 1.0, 1.598) 430ms rms 0.01 · mask `224,590,76,76` |
| 74.723–74.916 | #2867–#2871 | 193 | CHANGE | `send-amount` | `send-amount:blank` | 흰 페이지 한 프레임 교체(74.723): 헤더 ‹ · 취소 + 스피너 | `send-amount-enter` | mask `224,590,76,76` |
| 74.916–75.217 | #2872–#2874 | 301 | CHANGE | `send-amount` | `send-amount:render` | 본문 표시(74.916): “(우리 로고) 우리은행 계좌에서 ⌄ / WON통장 1002-123-456789 / (카카오 로고) 정우진 님 계좌로 ⌄ / 카카오뱅크 3333123456789 / 분홍 칩 [🚨 처음 보내는 계좌예요. 사기의심조회 ›] / 얼마를 이체하시겠어요? / 출금가능금액 344 원” → 75.042 로고 아이콘. 스피너 계속 | `send-amount-enter` | mask `224,590,76,76` |
| 75.217–76.086 | #2875–#2882 | 868 | HOLD | `send-amount` | `send-amount:keypad` | 앱 키패드 한 프레임에 표시(75.217): +1만 +5만 +10만 +100만 전액 / 1–9 / 00 0 ← / [확인] 비활성(연회색). 스피너 75.275 에 사라짐, 75.335 오른쪽 스크롤바 표시 | `send-amount-enter` 동작 `amount-keypad` | mask `512,46,12,1164` |
| 76.086–76.455 | #2883–#2899 | 370 | HOLD | `send-amount` | `send-amount:2won` | “2” 탭 → 금액 “2원” / “2원 · 출금가능금액 344 원”, [확인] 활성(#096EF3). 키 눌림 표시 없음 | 동작 `amount-keypad` | mask `512,46,12,1164` |
| 76.455–76.738 | #2900–#2905 | 283 | HOLD | `send-amount` | `send-amount:confirm-pressed` | [확인] 눌림 #096EF3 → #175DA5 → 점점 진해짐(#135291, 76.689) | 동작 `press-feedback` | 눌림 #096EF3 → #175DA5 (76.455–) |
| 76.738–77.608 | #2906–#2945 | 870 | CHANGE | `send-amount` | `send-amount:fields-in` | 키패드 한 프레임에 사라짐(76.738) → [추가이체][다음]·“이체 유의사항 및 안내” 표시 → 77.007–77.608 “받는 분 통장표기 정우진 › / 내 통장표기 정우진 › / 더보기 ⌄” 묶음이 아래(+65px)에서 올라오며 페이드 인 | `amount-fields-in` | y 오프셋 65.0→0.0px: 이름 곡선 최적 easeOutQuart(0.25,1,0.5,1) 749ms (시작 76.994, rms 0.09px) · 자유 cubic-bezier(0.245, 0.985, 0.49, 1.006) 751ms rms 0.08px; α 0.0→1.0: 이름 곡선 최적 fast-out-slow-in-emph(0.2,0,0,1) 793ms (시작 76.946, rms 0.02) |
| 77.608–77.818 | #2946–#2957 | 210 | HOLD | `send-amount` | `send-amount:form` | 2원 입력 폼 정지 | — |  |
| 77.818–78.201 | #2958–#2969 | 383 | HOLD | `send-amount` | `send-amount:next-pressed` | [다음] 눌림 #2388F3 → #195CA7 (77.818–78.126) + 스피너 78.059–78.126 | `dup-yes-to-password` 동작 `press-feedback` | 눌림 #2388F3 → #1A5CA5 (77.818–) · mask `224,590,76,76` |

#### v2 78.201 – 80.852 · #2970–#3021 · 보안: 검은 화면 + 비밀번호 시트 누출 (자름, send-b)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 78.201–80.453 | #2970–#3001 | 2252 | HOLD | `secure-black` | `secure-black` | 보안 화면(FLAG_SECURE): 앱 창 검정(0), 상태바·내비 바도 검정 바탕에 OS 아이콘만. 계좌 비밀번호 입력 구간 — 녹화 안 됨 | `dup-yes-to-password` | mask `0,0,524,1280` |
| 80.453–80.852 | #3002–#3021 | 399 | HOLD | `send-password` | `send-password:leak` | 계좌 비밀번호 시트가 풀린 채 보임: 딤 + “계좌 비밀번호 ✕ / ●●●● (4자리 다 참) / 비밀번호가 기억나지 않아요 / 섞인 숫자 키패드 / 전체삭제 ←” + 스피너(80.519~). 민감 정보 화면 | `dup-yes-to-password` 동작 `shuffled-pin-keypad` | mask `224,590,76,76` |

#### v2 80.852 – 84.096 · #3022–#3173 · 처리 → 이체 확인 “정우진 님에게 2원을 이체하시겠어요?” (send-b)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 80.852–81.706 | #3022–#3050 | 854 | HOLD | `send-amount` | `send-amount:processing` | 시트·딤이 한 프레임에 사라짐(80.852) → 2원 폼 + 스피너 | — | mask `224,590,76,76` |
| 81.706–81.907 | #3051–#3058 | 201 | CHANGE | `send-confirm` | `send-confirm:blank` | 흰 페이지(헤더 ‹ · 취소) + 스피너(81.706) | `confirm-morph` | mask `224,590,76,76` |
| 81.907–82.834 | #3059–#3106 | 928 | CHANGE | `send-confirm` | `send-confirm:render` | 하단 [이체] 비활성(연파랑)(81.907) → 계좌 줄 “우리은행 계좌에서 ⌄ / WON통장 1002-123-456789 / 카카오뱅크 계좌로 ⌄ / 카카오뱅크 3333123456789”(81.965) → 82.09–82.83 전환: 위 계좌 줄이 줄어들며 은행 로고 2개 + “→” 헤더로 모이고(글자 페이드 아웃), 본문 “정우진 님에게 / 2원을 이체하시겠어요?(정우진·2원 파랑) / 카카오뱅크 3333123456789 계좌로 보냅니다. / 수수료 면제 · 받는 분 통장표기 정우진 · 내 통장표기 정우진” 가 아래에서 올라오며 페이드 인 → 82.834 [이체] 활성 + “인증서 비밀번호 입력 없이 바로 이체됩니다.” 스피너는 82.325–82.559 잠깐 사라졌다 83.319 까지 | `confirm-morph` `confirm-arrow-loop` | 본문 y 오프셋 119.6→0.0px: 이름 곡선 최적 ease 503ms (시작 82.316, rms 0.14px) · 자유 cubic-bezier(0.248, 0.112, 0.265, 1.0) 502ms rms 0.12px; α 0.0→1.0: 이름 곡선 최적 easeInOutCubic(0.65,0,0.35,1) 820ms (시작 82.035, rms 0.01) · 자유 cubic-bezier(0.85, -0.283, 0.413, 1.0) 1210ms rms 0.01 · mask `224,590,76,76` |
| 82.834–84.096 | #3107–#3173 | 1262 | HOLD | `send-confirm` | `send-confirm:idle` | 이체 확인 정지. 로고 사이 “→” 가 반복 애니메이션(약 0.83s 주기: 82.77 사라짐 → 83.15 왼쪽에서 나타나 진해지며 자리 → 83.42 완전 → 83.58 사라짐 → 84.00 다시). 스피너 83.319 까지 | `confirm-arrow-loop` | “→” 반복 주기 약 0.83s · mask `224,590,76,76;96,190,60,24` |

#### v2 84.096 – 87.607 · #3174–#3347 · [이체] → 처리 → 완료 “이체했어요” (send-b, done)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 84.096–84.196 | #3174–#3179 | 100 | HOLD | `send-confirm` | `send-confirm:transfer-pressed` | [이체] 눌림 #2387F3 → #185DA4 (84.096–84.180) | `transfer-processing` 동작 `press-feedback` | 눌림 #2387F3 → #185DA4 (84.096–) |
| 84.196–86.237 | #3180–#3290 | 2040 | HOLD | `send-confirm` | `send-confirm:processing` | [이체] 비활성(#C1DCFA) + 버튼 안 작은 흰 스피너(x221–249, y1130–1157, 84.214–84.489) → 가운데 큰 스피너 84.640–86.930 (86.32–86.45 프레임 멈춤 = jank) | `transfer-processing` | mask `224,590,76,76;215,1125,40,38` |
| 86.237–86.454 | #3291–#3298 | 217 | CHANGE | `send-done` | `send-done:blank` | 흰 페이지 + 스피너(86.237) | `done-enter` | mask `224,590,76,76` |
| 86.454–86.947 | #3299–#3319 | 493 | CHANGE | `send-done` | `send-done:render` | 완료 본문 한 프레임에 표시(86.454): “정우진 님에게 / 이체했어요” · 받는 계좌 3333123456789 ☆(86.498 에 앞에 “카카오뱅크” 글자 추가) · 이체금액 2원 · 메모(내용을 입력할 수 있어요 ›) · 이체확인증 [보기] · 더보기 ⌄ · 광고 카드 “빌려준 돈, 차용증은 쓰셨나요?” · [공유][확인]. 파란 원(#2387F3) 4px 점(86.454) → 62px(86.498) → 92px(86.538, 넘침) → 82px(86.648) → 88px(86.746 자리) + 흰 체크 획이 그려짐(86.671–86.906, 원 안 흰 픽셀 49→437). 카드 안 작은 스피너 86.930 까지 | `done-enter` 동작 `done-check` | 원 지름 4→62→92(넘침)→82→88px, 체크 획 86.671–86.906 · mask `224,590,76,76` |
| 86.947–87.214 | #3320–#3330 | 267 | HOLD | `send-done` | `send-done:idle` | 완료 화면 정지 | — |  |
| 87.214–87.440 | #3331–#3338 | 225 | HOLD | `send-done` | `send-done:confirm-pressed` | [확인] 눌림 #2387F3 → #195CA5 (87.214–87.415) + 스피너 87.356–87.591 | `done-to-history` 동작 `press-feedback` | 눌림 #2387F3 → #195CA5 (87.214–) · mask `224,590,76,76` |
| 87.440–87.607 | #3339–#3347 | 167 | HOLD | `send-done` | `send-done:leaving` | [확인] 원래 색 + 스피너 | `done-to-history` | mask `224,590,76,76` |

#### v2 87.607 – 90.896 · #3348–#3440 · 거래내역 다시 (342원) + OS 입금 알림 (history)

| t0–t1 (s) | 프레임 | ms | 종류 | 화면 | 상태 id | 일어나는 일 | 전환 id | 1단계 측정(참고) |
|---|---|---|---|---|---|---|---|---|
| 87.607–88.419 | #3348–#3354 | 812 | HOLD | `history-loading` | `history-loading:blank` | 흰 페이지(87.607) → 스피너 88.212~ | `done-to-history` | mask `224,590,76,76` |
| 88.419–89.382 | #3355–#3387 | 963 | CHANGE | `history-loading` | `history-loading:skeleton` | 헤더 제목 “거래내역조회 관리” + 스켈레톤(88.419) → 헤더 ‹ (88.553). 스피너 계속 | `done-to-history` | mask `224,590,76,76` |
| 89.382–90.038 | #3388–#3410 | 656 | CHANGE | `history` | `history:render-342` | 내용 표시(89.382): 1002-123-456789 **342원** · 출금가능금액 342원 · 3개월·전체·최신순 · 첫 행 “11월 21일 11:17:39 카카정우진 -2원 잔액 342원”, 둘째 행 “11:09:11 농협정우진 -1원” → 89.481 잔액 표시 토글 회색→파랑 → 89.599 손잡이 오른쪽 + 아이콘들(6.462–6.730 과 같은 순서). 스피너 90.009 까지 | `done-to-history` | mask `224,590,76,76` |
| 90.038–90.232 | #3411 | 195 | HOLD | `history` | `history:top-342-all` | 거래내역 최상단(342원) 정지 | — |  |
| 90.232–90.896 | #3412–#3440 | 664 | HOLD | `history` | `history:top-342-headsup` | OS 헤드업 알림 pill(“입금 2원 정우진 → 입출금통장(6789)” 류)이 위에서 내려옴(90.232–90.599, 아래끝 y59→113) → 글자 흐름(90.6–90.88). 앱 아님 — 마스크 | — | OS 알림 아래끝 y 59(90.232) → 113(90.599) · mask `70,52,384,64` |

## 4. 기준 구간 표 (생성물 — gen-from-spec 이 채운다)

상태 이름과 기준 구간의 원본은 `tools/shots.json` 이다 (`spec/*.json` 의 `states` 에서 `node tools/gen-from-spec.cjs --shots` = `npm run gen` 이 만든다).
아래 표시 줄 사이는 그 값을 그대로 옮긴 표라 **손으로 고치지 않는다** (`npm run check` 가 같은지 검사한다). 그룹 스펙이 들어오기 전에는 비어 있다.
기준 프레임은 `python3 -I tools/ref.py --all` 로 다시 만든다(이미 있는 건 건너뜀, `--force`). 애니메이션 위상 shot(`t`)과 화면 담당이 덧붙인 상태는
`tools/shots.d/<group>.json` 에 있다(여기 표에는 없음). scenario 는 6절 규칙.

<!-- gen-from-spec:shots-table — 손으로 고치지 말 것: node tools/gen-from-spec.cjs --shots 가 tools/shots.json 과 같은 값으로 다시 쓴다 -->
| 상태 (shots.json name = tools/ref/<name>.png) | 영상 | 기준 프레임 (포함) | 시각 t0–t1 (s) | scenario |
|---|---|---|---|---|
| `done/blank` | v1 | #7429–#7439 | 193.407–193.624 | v2-start |
| `done/render` | v1 | #7440–#7440 | 193.641–193.641 | v2-start |
| `done/idle` | v1 | #7467–#7483 | 194.461–195.73 | v2-start |
| `done/os-headsup` | v1 | #7484–#7489 | 196.12–196.21 | v2-start |
| `done/idle-headsup` | v1 | #7522–#7523 | 196.944–197.251 | v2-start |
| `done/confirm-pressed` | v2 | #3331–#3332 | 87.214–87.306 | v2-end |
| `done/leaving` | v2 | #3346–#3347 | 87.574–87.591 | v2-end |
| `history-detail/deposit` | v1 | #6038–#6048 | 154.589–155.502 | v1-start |
| `history-detail/deposit-first` | v1 | #3697–#3748 | 92.179–95.676 | v1-start |
| `history-detail/withdraw` | v1 | #3893–#3903 | 102.215–104.497 | v1-start |
| `history-detail/confirm-pressed` | v1 | #6049–#6049 | 156.237–156.237 | v1-start |
| `history/loading-blank` | v1 | #1204–#1251 | 30.844–31.714 | v1-start |
| `history/loading-title` | v2 | #137–#137 | 5.501–5.501 | v2-start |
| `history/loading-skeleton` | v2 | #158–#178 | 6.044–6.422 | v2-start |
| `history/render` | v2 | #179–#180 | 6.462–6.613 | v2-start |
| `history/render-toggle` | v2 | #181–#182 | 6.638–6.713 | v2-start |
| `history/all-top-spinner` | v1 | #4613–#4630 | 122.296–122.688 | v1-start |
| `history/spinner-off` | v2 | #204–#204 | 7.215–7.215 | v2-start |
| `history/top-344-all` | v2 | #205–#211 | 7.231–8.865 | v2-start |
| `history/top-344` | v1 | #7584–#7589 | 199.631–200.457 | v2-start |
| `history/all-top` | v1 | #4631–#4634 | 122.721–123.5 | v1-start |
| `history/reload-spinner` | v1 | #1678–#1688 | 42.687–42.863 | v1-start |
| `history/reload-spinner-withdraw` | v1 | #2370–#2377 | 61.061–61.187 | v1-start |
| `history/deposit-top` | v1 | #3766–#3773 | 95.984–96.515 | v1-start |
| `history/filter-deposit-spinner` | v2 | #268–#290 | 10.944–11.396 | v2-start |
| `history/filter-deposit-top` | v2 | #291–#291 | 11.413–11.413 | v2-start |
| `history/withdraw-top` | v1 | #3826–#3847 | 99.607–100.469 | v1-start |
| `history/filter-withdraw-spinner` | v2 | #1110–#1128 | 30.221–30.676 | v2-start |
| `history/top-344-withdraw` | v2 | #1129–#1133 | 30.692–31.136 | v2-start |
| `history/leave-spinner` | v2 | #7–#14 | 0.195–0.442 | v2-start |
| `history/row-tap-spinner` | v1 | #3861–#3861 | 101.486–101.486 | v1-start |
| `history/back-spinner` | v1 | #3926–#3951 | 105.52–106.175 | v1-start |
| `history/transfer-pressed` | v2 | #2545–#2547 | 60.306–60.424 | v2-start |
| `history/transfer-wait` | v1 | #6920–#6922 | 175.56–176.448 | v1-start |
| `history/transfer-spinner` | v2 | #2553–#2555 | 60.523–60.566 | v2-start |
| `history/render-342` | v2 | #3388–#3390 | 89.382–89.448 | v2-end |
| `history/top-342-all` | v2 | #3411–#3411 | 90.038–90.038 | v2-end |
| `history/sheet-all` | v1 | #1641–#1653 | 40.973–41.45 | v1-start |
| `history/sheet-deposit` | v1 | #6090–#6092 | 157.859–158.457 | v1-start |
| `history/sheet-withdraw` | v1 | #2348–#2351 | 59.491–60.453 | v1-start |
| `history/sheet-apply-pressed` | v2 | #241–#241 | 10.459–10.459 | v2-start |
| `history/sheet-apply-pressed-top` | v2 | #1081–#1081 | 29.455–29.455 | v2-start |
| `history/all-scroll` | v1 | #1400–#1400 | 35.758–35.758 | v1-start |
| `history/all-scrolled-102` | v1 | #4692–#4696 | 124.635–125.061 | v1-start |
| `history/deposit-scroll` | v1 | #2200–#2200 | 54.726–54.726 | v1-start |
| `history/deposit-scrolled-1991` | v1 | #5170–#5172 | 136.232–136.457 | v1-start |
| `history/deposit-scrolled-2376` | v1 | #5310–#5310 | 139.015–139.015 | v1-start |
| `history/deposit-scrolled-3781` | v1 | #5658–#5660 | 146.204–146.448 | v1-start |
| `history/deposit-scrolled-4471` | v1 | #5851–#5851 | 149.991–149.991 | v1-start |
| `history/withdraw-scroll` | v1 | #2900–#2900 | 71.511–71.511 | v1-start |
| `history/withdraw-scrolled-64` | v1 | #3920–#3925 | 104.805–105.478 | v1-start |
| `history/withdraw-scrolled-10194` | v1 | #3048–#3049 | 74.412–74.428 | v1-start |
| `history/deposit-scroll-drag1` | v2 | #315–#315 | 11.964–11.964 | v2-start |
| `history/deposit-scroll-pause-318` | v2 | #336–#337 | 12.315–12.416 | v2-start |
| `history/deposit-scroll-drag2` | v2 | #360–#360 | 12.992–12.992 | v2-start |
| `history/deposit-scroll-pause-472` | v2 | #375–#376 | 13.251–13.42 | v2-start |
| `history/deposit-scroll-drag3` | v2 | #500–#500 | 16.437–16.437 | v2-start |
| `history/deposit-scroll-pause-1594` | v2 | #687–#688 | 20.106–20.124 | v2-start |
| `history/deposit-scroll-drag4` | v2 | #710–#710 | 20.734–20.734 | v2-start |
| `history/deposit-scroll-pause-1754` | v2 | #727–#728 | 21.027–21.043 | v2-start |
| `history/deposit-scroll-drag5` | v2 | #780–#780 | 22.231–22.231 | v2-start |
| `history/deposit-scroll-pause-2351` | v2 | #839–#840 | 23.367–23.419 | v2-start |
| `history/deposit-scroll-drag6` | v2 | #900–#900 | 24.579–24.579 | v2-start |
| `history/deposit-scroll-pause-3223` | v2 | #979–#980 | 26.319–26.419 | v2-start |
| `history/deposit-scroll-drag7` | v2 | #1030–#1030 | 27.389–27.389 | v2-start |
| `history/deposit-scrolled` | v2 | #1056–#1056 | 27.824–27.824 | v2-start |
| `history/withdraw-scroll-drag1` | v2 | #1180–#1180 | 32.004–32.004 | v2-start |
| `history/withdraw-scroll-pause-329` | v2 | #1230–#1234 | 33.192–33.587 | v2-start |
| `history/withdraw-scroll-drag2` | v2 | #1280–#1280 | 34.38–34.38 | v2-start |
| `history/withdraw-scroll-pause-738` | v2 | #1323–#1325 | 35.182–35.417 | v2-start |
| `history/withdraw-scroll-drag3` | v2 | #1350–#1350 | 35.842–35.842 | v2-start |
| `history/withdraw-scroll-pause-911` | v2 | #1377–#1378 | 36.302–36.421 | v2-start |
| `history/withdraw-scroll-drag4` | v2 | #1400–#1400 | 36.863–36.863 | v2-start |
| `history/withdraw-scroll-pause-1041` | v2 | #1417–#1418 | 37.215–37.424 | v2-start |
| `history/withdraw-scroll-drag5` | v2 | #1600–#1600 | 40.942–40.942 | v2-start |
| `history/withdraw-scroll-pause-4058` | v2 | #1878–#1879 | 46.336–46.371 | v2-start |
| `history/withdraw-scroll-drag6` | v2 | #2000–#2000 | 48.785–48.785 | v2-start |
| `history/withdraw-scroll-drag7` | v2 | #2450–#2450 | 58.099–58.099 | v2-start |
| `history/top-342-headsup` | v2 | #3421–#3440 | 90.462–90.88 | v2-end |
| `home/loading-spinner` | v1 | #272–#273 | 10.011–10.036 | v1-start |
| `home/loading-header-pill` | v1 | #274–#275 | 10.061–10.162 | v1-start |
| `home/loading-render` | v1 | #283–#283 | 10.772–10.772 | v1-start |
| `home/loading-nav-black` | v1 | #301–#303 | 11.471–11.511 | v1-start |
| `home/loading-balance-unit` | v1 | #307–#308 | 11.594–11.616 | v1-start |
| `home/loading-refresh` | v1 | #3959–#3959 | 106.613–106.613 | v1-start |
| `home/loading-blank` | v2 | #15–#15 | 0.515–0.515 | v2-start |
| `home/loading-drop-other-bank` | v2 | #20–#20 | 0.885–0.885 | v2-start |
| `home/loading-no-account` | v2 | #21–#26 | 1.169–1.429 | v2-start |
| `home/loading-panel-shrink` | v2 | #27–#27 | 1.471–1.471 | v2-start |
| `home/loading-skeleton` | v2 | #28–#30 | 1.571–1.78 | v2-start |
| `home/loading-account-no-balance` | v2 | #38–#44 | 2.448–2.666 | v2-start |
| `home/loading-other-bank-back` | v2 | #48–#48 | 2.792–2.792 | v2-start |
| `home/popup-open` | v1 | #311–#311 | 11.674–11.674 | v1-start |
| `home/popup-behind-update` | v1 | #318–#318 | 11.809–11.809 | v1-start |
| `home/popup-balance-roll` | v1 | #325–#325 | 12.059–12.059 | v1-start |
| `home/popup-idle` | v1 | #340–#342 | 12.461–12.553 | v1-start |
| `home/popup-close-pressed` | v1 | #343–#346 | 12.578–12.661 | v1-start |
| `home/popup-close-released` | v1 | #347–#348 | 12.687–12.712 | v1-start |
| `home/popup-close` | v1 | #351–#351 | 12.795–12.795 | v1-start |
| `home/settle` | v1 | #358–#364 | 13.016–13.123 | v1-start |
| `home/top-banner1` | v1 | #365–#388 | 13.139–13.614 | v1-start |
| `home/banner-auto-2` | v1 | #389–#405 | 13.631–13.933 | v1-start |
| `home/top-banner2` | v1 | #406–#423 | 13.957–14.434 | v1-start |
| `home/banner-auto-2b` | v1 | #1137–#1152 | 29.119–29.37 | v1-start |
| `home/return-cached` | v1 | #3952–#3958 | 106.196–106.504 | v1-start |
| `home/top-banner3` | v1 | #4073–#4089 | 109.522–110.048 | v1-start |
| `home/banner-auto-4` | v1 | #4129–#4134 | 110.775–110.858 | v1-start |
| `home/cached` | v2 | #18–#19 | 0.797–0.819 | v2-start |
| `home/balance-roll` | v2 | #61–#62 | 3.295–3.326 | v2-start |
| `home/banner-2to3` | v2 | #73–#87 | 3.577–3.862 | v2-start |
| `home/banner-3` | v2 | #88–#99 | 3.878–4.161 | v2-start |
| `home/account-tap-spinner` | v2 | #100–#114 | 4.204–4.847 | v2-start |
| `home/scroll-206` | v1 | #441–#441 | 14.768–14.768 | v1-start |
| `home/scrolled-206` | v1 | #500–#527 | 15.972–16.699 | v1-start |
| `home/banner-swipe-3` | v1 | #534–#534 | 16.857–16.857 | v1-start |
| `home/banner3` | v1 | #558–#565 | 17.401–17.635 | v1-start |
| `home/banner-swipe-4` | v1 | #573–#573 | 17.827–17.827 | v1-start |
| `home/banner4` | v1 | #590–#594 | 18.228–18.37 | v1-start |
| `home/banner-swipe-5` | v1 | #601–#601 | 18.537–18.537 | v1-start |
| `home/banner-swipe-6` | v1 | #635–#635 | 19.341–19.341 | v1-start |
| `home/banner-swipe-7` | v1 | #672–#672 | 20.276–20.276 | v1-start |
| `home/banner-swipe-8` | v1 | #705–#705 | 21.053–21.053 | v1-start |
| `home/banner-swipe-9` | v1 | #745–#745 | 21.789–21.789 | v1-start |
| `home/banner-swipe-10` | v1 | #775–#775 | 22.442–22.442 | v1-start |
| `home/scroll` | v1 | #848–#848 | 23.753–23.753 | v1-start |
| `home/marquee` | v1 | #945–#1005 | 25.56–26.68 | v1-start |
| `home/scrolled-78` | v1 | #1172–#1173 | 29.746–29.763 | v1-start |
| `home/account-tap-spinner-s78` | v1 | #1174–#1190 | 29.779–30.482 | v1-start |
| `home/scrolled-260` | v1 | #4143–#4146 | 111.042–111.109 | v1-start |
| `home/scrolled-380` | v1 | #4192–#4195 | 112.078–112.137 | v1-start |
| `home/banner-next-5` | v1 | #4201–#4201 | 112.279–112.279 | v1-start |
| `home/banner5` | v1 | #4235–#4251 | 113.033–113.5 | v1-start |
| `home/banner-next-6` | v1 | #4257–#4257 | 113.625–113.625 | v1-start |
| `home/banner6` | v1 | #4276–#4303 | 113.978–114.629 | v1-start |
| `home/banner-next-7` | v1 | #4315–#4315 | 114.946–114.946 | v1-start |
| `home/banner7` | v1 | #4329–#4353 | 115.18–115.832 | v1-start |
| `home/banner-next-8` | v1 | #4359–#4359 | 116.017–116.017 | v1-start |
| `home/banner8` | v1 | #4377–#4389 | 116.435–116.728 | v1-start |
| `home/banner-next-9` | v1 | #4406–#4406 | 117.069–117.069 | v1-start |
| `home/banner9` | v1 | #4425–#4448 | 117.404–117.906 | v1-start |
| `home/banner-next-10` | v1 | #4454–#4454 | 118.039–118.039 | v1-start |
| `home/banner10` | v1 | #4491–#4513 | 118.733–119.185 | v1-start |
| `home/account-tap-spinner-s380` | v1 | #4514–#4530 | 119.235–119.979 | v1-start |
| `launch/splash-logo-start` | v1 | #52–#54 | 1.748–1.793 | v1-start |
| `launch/splash-logo-end` | v1 | #70–#91 | 2.11–2.822 | v1-start |
| `launch/cert-pin-spinner` | v1 | #130–#207 | 7.395–8.748 | v1-start |
| `launch/cert-pin-filled` | v1 | #208–#231 | 8.765–9.226 | v1-start |
| `launch/login-loading-blank` | v1 | #232–#234 | 9.242–9.301 | v1-start |
| `launch/login-loading-character` | v1 | #235–#271 | 9.319–9.994 | v1-start |
| `send-a/loading-blank` | v1 | #6923–#6933 | 176.489–177.444 | v1-start |
| `send-a/where-render` | v2 | #2580–#2583 | 62.155–62.205 | v2-start |
| `send-a/where-idle` | v1 | #6952–#6960 | 178.095–180.235 | v1-start |
| `send-a/where-row-tap-spinner` | v1 | #6961–#7018 | 180.302–181.784 | v1-start |
| `send-a/where-reveal` | v2 | #2848–#2850 | 74.214–74.414 | v2-start |
| `send-a/account-push` | v2 | #2600–#2600 | 63.852–63.852 | v2-start |
| `send-a/account-empty` | v2 | #2613–#2613 | 64.086–64.086 | v2-start |
| `send-a/account-focus` | v2 | #2622–#2622 | 64.261–64.261 | v2-start |
| `send-a/account-focused` | v2 | #2640–#2641 | 64.598–64.655 | v2-start |
| `send-a/account-keyboard-up` | v2 | #2647–#2647 | 64.773–64.773 | v2-start |
| `send-a/account-keyboard` | v2 | #2658–#2659 | 65.047–65.089 | v2-start |
| `send-a/account-typing` | v2 | #2698–#2700 | 68.001–68.084 | v2-start |
| `send-a/account-typed` | v2 | #2735–#2738 | 70.46–71.356 | v2-start |
| `send-a/account-bank-selected` | v2 | #2775–#2776 | 72.716–72.749 | v2-start |
| `send-a/account-ready` | v2 | #2800–#2800 | 73.177–73.177 | v2-start |
| `send-a/account-confirm-pressed` | v2 | #2801–#2801 | 73.201–73.201 | v2-start |
| `send-a/account-confirm-spinner` | v2 | #2805–#2847 | 73.368–74.189 | v2-start |
| `send-a/bank-open` | v2 | #2751–#2751 | 71.655–71.655 | v2-start |
| `send-a/bank-render` | v2 | #2765–#2765 | 71.965–71.965 | v2-start |
| `send-a/bank-idle` | v2 | #2772–#2773 | 72.207–72.426 | v2-start |
| `send-b/amount-blank` | v1 | #7019–#7022 | 181.801–181.943 | v1-start |
| `send-b/amount-render` | v1 | #7026–#7027 | 182.244–182.311 | v1-start |
| `send-b/amount-keypad` | v1 | #7031–#7033 | 182.536–183.266 | v1-start |
| `send-b/amount-1won` | v1 | #7043–#7045 | 183.472–183.513 | v1-start |
| `send-b/amount-confirm-pressed` | v1 | #7046–#7046 | 183.53–183.53 | v1-start |
| `send-b/amount-keypad-hide` | v1 | #7052–#7053 | 183.882–183.898 | v1-start |
| `send-b/amount-1won-form` | v1 | #7054–#7055 | 183.957–183.974 | v1-start |
| `send-b/amount-fields-in` | v2 | #2916–#2916 | 77.106–77.106 | v2-start |
| `send-b/amount-next-pressed` | v1 | #7088–#7089 | 184.751–184.768 | v1-start |
| `send-b/amount-next-spinner` | v1 | #7091–#7092 | 184.809–184.826 | v1-start |
| `send-b/amount-processing` | v1 | #7210–#7240 | 188.715–189.485 | v1-start |
| `send-b/amount-2won` | v2 | #2883–#2899 | 76.086–76.422 | v2-start |
| `send-b/amount-form` | v2 | #2946–#2957 | 77.608–77.793 | v2-start |
| `send-b/dup-open` | v1 | #7103–#7103 | 185.052–185.052 | v1-start |
| `send-b/dup-idle` | v1 | #7150–#7151 | 185.939–185.956 | v1-start |
| `send-b/dup-yes-pressed` | v1 | #7161–#7162 | 186.348–186.381 | v1-start |
| `send-b/password-leak` | v1 | #7192–#7192 | 188.357–188.357 | v1-start |
| `send-b/password-leak-spinner` | v1 | #7193–#7208 | 188.38–188.65 | v1-start |
| `send-b/confirm-blank` | v1 | #7244–#7250 | 189.711–189.845 | v1-start |
| `send-b/confirm-render` | v1 | #7254–#7257 | 190.029–190.137 | v1-start |
| `send-b/confirm-idle` | v1 | #7314–#7324 | 191.259–191.424 | v1-start |
| `send-b/confirm-transfer-pressed` | v1 | #7325–#7325 | 191.441–191.441 | v1-start |
| `send-b/confirm-processing` | v1 | #7330–#7357 | 191.567–192.052 | v1-start |
<!-- /gen-from-spec:shots-table -->

기준 구간을 고를 때(D2): 화면이 완전히 멈춘 프레임만 쓰고, 빠른 스크롤 직후 정지 구간의 첫 0.3–0.4초(코덱 화질 회복, 예: v1 153.042–153.469)는 뺀다.
스피너가 도는 구간은 스피너 상자(`224,590,76,76`, 홈 위 `224,546,76,78`)를 마스크하고, OS 겹침(5.3절)도 마스크한다. 한 상태에 정지 프레임이 1–2장뿐이면 그 장을 쓰고 그룹 md 에 적는다.

## 5. 잘라낸 구간 (D3) · OS 겹침

### 5.1 시간 비교에서 자르는 구간

| 영상 | 구간 (s) | 프레임 | 무엇 | 처리 |
|---|---|---|---|---|
| v1 | 0.000–1.748 | #0–#51 | 런처(삼성 앱 검색 + OS 노란 키보드 내려감) — 앱 밖 | **자름.** 앱은 스플래시(`/`)부터. v1 녹화 0 = 영상 1.748 |
| v1 | 2.841–7.395 | #92–#129 | FLAG_SECURE 검은 화면 — 우리WON인증서 6자리 PIN 입력 중(키패드가 녹화된 적 없음) | **자름.** 앱은 스플래시 끝에 PIN 화면을 띄우고 녹화는 컷 안에서 6자리를 눌러 7.395 에 "6점 다 참 + 스피너"가 오게 한다. PIN 키패드는 계좌 비밀번호 키패드 모양을 따른 **설계값(영상에 없음)** — launch 스펙 |
| v1 | 186.449–188.273 | #7163–#7190 | FLAG_SECURE 검은 화면 — 계좌 비밀번호 4자리 입력 중 | **자름.** 앱은 비밀번호 시트(섞인 키패드)를 띄우고 녹화가 컷 안에서 4자리를 눌러 마지막 점 + 스피너가 188.273 에 오게 |
| v2 | 78.201–80.453 | #2970–#3001 | FLAG_SECURE 검은 화면 — 계좌 비밀번호 입력 중 | **자름.** v1 과 같은 처리 (80.453 에 맞춤) |

### 5.2 자르지 않지만 비교 방법이 다른 구간

| 영상 | 구간 (s) | 프레임 | 무엇 | 처리 |
|---|---|---|---|---|
| v1 | 188.273–188.674 | #7191–#7208 | 보안이 풀린 계좌 비밀번호 시트가 그대로 보임(딤 + "계좌 비밀번호 ✕ / ●●●● / 비밀번호가 기억나지 않아요 / 섞인 숫자패드", 188.523– 스피너) | **계좌 비밀번호 시트 레이아웃 기준**(send-b). 점만 보이고 누른 키는 드러나지 않아 개인정보 아님. 숫자 배치는 매번 무작위 → 키 숫자 칸은 비교 마스크 |
| v2 | 80.453–80.852 | #3002–#3021 | 같은 비밀번호 시트 | 같은 처리 (v1 과 시트·제목·점 같음, 숫자 배치만 다름 — 7절 `send-password-leak`) |
| v2 | 0.000–0.515 | #0–#14 | v2 녹화 시작: v1 끝과 같은 데이터의 거래내역(출금 필터) → 스피너 | 자르지 않음 — v2 녹화 시작 상태(`/history?type=out`, scenario `v2-start`). 7.1절 |
| v1 | 105.520–106.196 | #3926–#3951 | 뒤로 처리 중 스피너만 | 자르지 않음 (타이밍 재현 대상) |
| v1 | 120.038–123.550 | #4532–#4634 | 거래내역 2차 로딩 — 1차(30.683–34.062)와 같은 순서·같은 화면 | 자르지 않음. 기준 프레임은 1차, 2차는 타이밍 교차 확인 |
| v1 | 154.314–156.521 | #6022–#6062 | 상세 ③ = 상세 ①과 같은 화면(닫힘만 [확인]) | 자르지 않음. 상세 ①(91.641–95.699)은 OS 알림 pill 이 제목 줄을 가려서 **상세 ③(154.589–156.237)을 입금 상세 기준**으로 |

### 5.3 OS 겹침 (앱이 아니다 — 재현하지 않거나(알림) 재현해도(키보드) 비교 때 마스크)

| 영상 | 구간 (s) | 프레임 | 무엇 (앱 아님) | 비교 마스크 x,y,w,h |
|---|---|---|---|---|
| v1 | 51.032–53.379 | #2042–#2135 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 54.218–57.573 | #2177–#2300 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 79.776–81.299 | #3310–#3376 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 82.119–85.455 | #3400–#3482 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 86.897–87.775 | #3527–#3561 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 88.599–91.056 | #3599–#3650 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 91.874–95.205 | #3682–#3732 | OS 메신저 알림 pill (위쪽 가운데, 메신저 아이콘 + 보낸 사람 + 짧은 글) | `150,38,230,80` |
| v1 | 196.177–199.518 | #7487–#7577 | OS 입출금 헤드업 알림 (위쪽 전체 폭) | `24,38,476,90` |
| v2 | 0.135–0.195 | #6–#6 | OS 내비 아이콘(\|\|\| ○ <) 진하기 변화 (0.135 부터 진함) — OS | `0,1210,524,70` |
| v2 | 64.672–71.572 | #2642–#2746 | OS 삼성 키보드(노란 테마) — 앱이 그리지 않는 OS UI | `0,738,524,542` |
| v2 | 90.232–90.896 | #3412–#3440 | OS 헤드업 알림 pill(입금 2원) | `70,52,384,64` |

- 그 밖에 늘 빼는 것: 상태바 `0,0,524,46`·내비 바 `0,1210,524,70`(기본 마스크), 스크롤 중·직후 오른쪽 오버레이 스크롤바 `512,46,12,1164`, 가운데 스피너 `224,590,76,76`(홈 위 `224,546,76,78`).
- 왼쪽 엣지 패널 손잡이(x 0–7, y 149–320)는 clean 영상에서 지웠으므로 마스크하지 않는다. 앱도 그리지 않는다.
- 상태바 시계의 분이 바뀌는 프레임(v1 1.935 #60 → 11:06, 61.772 #2402 → 11:07, 121.743 #4605 → 11:08, 181.767 #7017 → 11:09 · v2 46.336 → 11:17)은 상태바만 다르다.

### 5.4 앱 흐름과 겹쳐 보기 시계

- **v1 녹화**: 앱은 스플래시(`/`)부터 — 녹화 0 = 영상 1.748. 컷 A(2.841–7.395, 4.554 s) 뒤 시계는 "6점 다 참 + 스피너" 첫 프레임 = 7.395 로 다시 맞춘다.
  컷 B(186.449–188.273) 뒤 비밀번호 시트(4점 + 스피너) = 188.273, 시트 사라짐 = 188.674.
- **v2 녹화**: `/history?type=out` (scenario `v2-start`) 에서 시작 — 녹화 0 = 영상 0.000. 컷(78.201–80.453)은 v1 컷 B 와 같은 처리, 시트 사라짐 = 80.852.
- 겹쳐 보기 mp4 는 원본 시계를 따른다: 컷 동안 앱 그림을 그대로 두고(원본은 검정), 컷 뒤 앱 t = 영상 t + 오프셋. 런처 0–1.748 동안은 앱 첫 그림(스플래시) 또는 검정.

## 6. 시나리오 — 잔액 345 → 344 → 342

두 영상의 데이터는 이어진다. 백엔드 시나리오(`POST /api/dev/reset {"scenario": …}`, `backend/seed.js` · `tools/shots-lib.cjs` 같은 이름)로 고른다.

| scenario | 잔액 | 거래 데이터 (seed) | seed 시계 (녹화 시작 · 이체 시각) | 쓰는 영상 구간 |
|---|---|---|---|---|
| `v1-start` (기본) | **345원** | 맨 위 11/21 11:02:40 농협정우진 −1원 잔액 345원(녹화 전 이체). 11:09:11·11:17:39 행 없음 | 녹화 시작 11:05:58 ≈ v1 0 s, 이체 시각 11:09:11 | v1 0 – 193.407 미만 |
| `v2-start` | **344원** | + 11/21 11:09:11 농협정우진 −1원 잔액 344원 (v1 의 1원 이체) | 녹화 시작 11:16:14 ≈ v2 0 s, 이체 시각 11:17:39 | v1 193.407 부터 끝까지, v2 0 – 86.237 미만 |
| `v2-end` | **342원** | + 11/21 11:17:39 카카정우진 −2원 잔액 342원 (v2 의 2원 이체) | (v2 시계) | v2 86.237 부터 끝까지 |

- **SCENARIO_SWITCH** (`tools/shots-lib.cjs`): 영상 속 이체가 화면에 반영되는 시각 = 완료 화면 첫 프레임.
  `v1: t 193.407 (#7429) 전 v1-start / 그 뒤 v2-start` · `v2: t 86.237 (#3291) 전 v2-start / 그 뒤 v2-end`.
- 상태의 scenario 는 **상태(또는 스펙)의 `"scenario"` > 기준 구간 t0 로 SCENARIO_SWITCH** 순서로 정해진다(4절 표의 scenario 열). 별칭(백엔드도 받음):
  `v1` → `v1-start`, `v1-end` → `v2-start`, `v2` → `v2-start`. 레지스트리에는 정식 이름을 쓴다.
- v1-start 에서 영상과 같은 이체(정우진·지역농축협 12345652789012·1원)를 하면 v2-start 와, v2-start 에서 영상과 같은 이체(정우진·카카오뱅크 3333123456789·2원)를
  하면 v2-end 와 API 결과가 같다(backend 테스트).
- 화면에 잔액이 보이는 곳: v1 345원 — 홈 잔액 굴림 끝 12.444, 거래내역 32.572 · v1 344원 — 거래내역 198.625 · v2 344원 — 0.000(거래내역), 홈 굴림 3.410–3.561 ·
  v2 342원 — 거래내역 89.382.
- 중복 이체 경고 "6분 전"(v1 185.270–185.973)은 지금 시각에 달려 있다(11:09:03 − 11:02:40, 내림) → 녹화·shot 모두 같은 시계(`WOORI_NOW`)를 쓴다.

## 7. 두 영상이 이어지는 점

### 7.1 v2 0–0.515 = v1 끝 (데이터·배치는 같고 필터 글자만 다름)

- v1 끝 `history:top-344` (199.631–200.483, #7584–#7589): 이체 완료 → 거래내역, **3개월 · 전체 · 최신순**, 344원 / 출금가능금액 344원, 첫 행 "11월 21일 11:09:11 농협정우진 −1원 잔액 344원", 둘째 행 11:02:40 −1원.
- v2 시작 `history:top-344-withdraw` (0.000–0.195, #0–#6) → `history:leave-spinner` (0.195–0.515, #7–#14): 같은 계좌·같은 잔액·같은 두 행(둘 다 출금이라 보이는 범위가 같다), 필터 줄만
  **3개월 · 출금 · 최신순**. 두 녹화 사이(11:09 → 11:16) 화면 밖에서 필터를 출금으로 바꾼 상태다 — 앱은 v2 녹화를 `/history?type=out` + scenario `v2-start` 로 시작한다.
- 중앙값 기준 프레임 비교(이 문서 작성 때 잼, 기본 마스크): v1 #7584–#7589 ↔ v2 #0–#6 mad 2.09, >24 0.89 %, max 243 — 필터 글자 자리(y≈603–624)와 **화면 전체 글자 가장자리**.
  v2 #0–#6 ↔ 같은 v2 상태의 뒤쪽 #1129–#1133(30.692–31.203) 도 mad 1.99 / max 93 으로 같은 무늬 → 필터 글자 말고는 **v2 녹화 첫 프레임들의 화질(가장자리 링잉)** 차이다.
  그래서 `history:top-344-withdraw` 기준 프레임은 v2 #0–#6 이 아니라 **30.692–31.203 (#1129–#1133)** 또는 59.679–60.306 (#2530–#2544, 스크롤바 마스크)에서 만든다.
- 같은 화면 같은 필터(전체) 비교는 깨끗하다: v1 끝 `history:top-344` ↔ v2 `history:top-344-all` (7.231–9.021, #205–#211) mad 0.374, max 23 = **same**.
- v2 0.135(#6)에 OS 내비 아이콘 3개가 함께 진해짐 → OS 뒤로 → 스피너(0.195–0.442) → 홈(캐시 모습 → 다시 그리기). 브라우저 기록에 홈이 없으므로 앱은 `/home` 으로 replace 하고 "돌아온 홈" 모드로 그린다.

### 7.2 두 영상에 같이 나오는 상태 (median 픽셀 비교)

각 영상 기준 구간을 clean 영상에서 디코드해 프레임 ≤15장 화소별 중앙값 → |v1 − v2|(기본 마스크 + 표의 마스크 제외). mad = 평균 |차이|(채널 평균), >24 = 채널 최대 차이 24 넘는 화소 %.
판정: **same** = 코덱 잡음 수준 · **data** = 잔액·행·로고·금액 글자만 다름 · **background** = 시트는 같고 딤 뒤 스크롤 위치가 다름 · **layout** = 데이터 때문에 배치가 바뀜(처음 보내는 계좌 칩 +52px, 긴 계좌 두 줄 꺾임 +33px) · **keys** = 섞인 키 배치만 다름.

| 비교 | v1 상태 · 구간 | v2 상태 · 구간 | 마스크(기본 외) | mad | >24 % | 판정 | 무엇이 다른가 |
|---|---|---|---|---|---|---|---|
| history-top-344-all | `history:top-344` 199.631–200.457 #7584–#7589 | `history:top-344-all` 7.231–9.021 #205–#211 | – | 0.374 | 0.0 | **same** | 같음 — 코덱 잡음 수준(max 23). 같은 상태 = 같은 픽셀 확인 |
| history-all-top-345vs344 | `history:all-top` 39.819–40.480 #1612–#1627 | `history:top-344-all` 7.231–9.021 #205–#211 | – | 1.444 | 0.953 | **data** | 데이터 차이만: 잔액 345→344(y307·363), 맨 위에 11:09:11 행이 들어와 목록이 같은 날짜 행 간격(170.5px)만큼 내려감, v1 오른쪽 오버레이 스크롤바 흔적(x515 y56–116). 레이아웃 같음 |
| history-withdraw-top-345vs344 | `history:withdraw-top` 99.607–100.469 #3826–#3847 | `history:top-344-withdraw` 30.692–31.203 #1129–#1133 | 224,590,76,76 | 1.137 | 0.914 | **data** | 데이터 차이만(잔액·첫 행 추가). v1 기준은 99.607–100.469 (104.739–105.478 은 라벨과 달리 scrollTop 64 — 10.3절) |
| history-deposit-top | `history:deposit-top` 95.867–96.515 #3759–#3773 | `history:filter-deposit-spinner` 10.944–11.413 #268–#290 | 224,590,76,76 | 0.818 | 0.203 | **data** | 잔액 345/344 숫자만 다름. 입금 목록·필터 줄·버튼 같음 |
| v2-deposit-top-1frame-vs-spinner(v2 안) | `history:deposit-top` 95.867–96.515 #3759–#3773 | `history:filter-deposit-top` 11.413–11.438 #291–#291 | 224,590,76,76 | 0.836 | 0.203 | **data** | v2 11.413 한 프레임(#291)도 같은 결과(0.836) — i0/i1 로 고르면 깨끗하다 |
| history-filter-sheet-all | `history-filter-sheet:all` 40.914–41.450 #1638–#1653 | `history-filter-sheet:all` 9.364–9.480 #229–#235 | – | 0.551 | 0.126 | **data** | 시트 같음. 딤 뒤 잔액 숫자만 다름 |
| history-filter-sheet-deposit | `history-filter-sheet:deposit` 97.422–98.460 #3790–#3795 | `history-filter-sheet:deposit` 28.527–29.212 #1076–#1077 | – | 3.686 | 5.495 | **background** | 시트 부분 같음. 딤 뒤 화면이 다름: v2 는 목록을 3728.7px 내린 채로 시트를 열어 고정된 필터·기간 줄과 목록 중간이 보임(v1 은 맨 위). 레이아웃 차이 아님 |
| history-filter-sheet-withdraw | `history-filter-sheet:withdraw` 59.491–60.453 #2348–#2351 | `history-filter-sheet:withdraw` 29.212–29.455 #1078–#1080 | – | 3.65 | 5.512 | **background** | 위와 같음(배경 스크롤 위치 차이) |
| history-reload-spinner-deposit | `history:reload-spinner` 42.687–42.863 #1678–#1688 | `history:reload-spinner` 10.776–10.944 #259–#267 | 224,590,76,76 | 0.485 | 0.199 | **data** | 잔액 숫자만 |
| history-reload-spinner-withdraw | `history:reload-spinner` 61.061–61.187 #2370–#2377 | `history:reload-spinner` 29.973–30.221 #1097–#1109 | 224,590,76,76 | 0.479 | 0.201 | **data** | 잔액 숫자만 |
| history-loading-blank | `history-loading:blank` 30.683–31.714 #1198–#1251 | `history-loading:blank` 87.607–88.419 #3348–#3354 | 224,590,76,76 | 0.28 | 0.0 | **same** | 같음 |
| history-loading-skeleton | `history-loading:render` 31.830–32.550 #1255–#1289 | `history-loading:skeleton` 5.626–6.462 #140–#178 | 224,590,76,76 | 0.251 | 0.0 | **same** | 같음 (스켈레톤 막대 위치 일치) |
| history-transfer-wait | `history:transfer-wait` 175.560–176.448 #6920–#6922 | `history:transfer-spinner` 60.523–60.951 #2553–#2555 | 224,590,76,76 | 1.241 | 0.913 | **data** | 잔액·첫 행 데이터 차이만 |
| home-banner3 | `home:top-banner3` 109.522–110.048 #4073–#4089 | `home:banner-3` 3.878–4.204 #88–#99 | 110,230,272,166 | 1.52 | 0.108 | **data** | 잔액 345/344(x155 y802) + 헤더 AI 아이콘 위상(x349 y75)만. 캐릭터 배너는 마스크. 레이아웃 같음 |
| home-banner2-top | `home:top-banner2` 13.957–14.434 #406–#423 | `home:cached` 0.797–0.885 #18–#19 | 110,230,272,166 | 1.728 | 0.11 | **data** | 잔액 + AI 아이콘 위상만. 홈 맨 위(다른 은행 카드 있음) 레이아웃 같음 |
| send-loading-blank | `send-loading:blank` 176.489–177.444 #6923–#6933 | `send-loading:blank` 60.951–61.300 #2557–#2558 | 224,590,76,76 | 0.088 | 0.0 | **same** | 같음 |
| send-where-idle | `send-where:idle` 178.095–180.235 #6952–#6960 | `send-where:idle` 62.406–63.760 #2588–#2594 | – | 0.232 | 0.0 | **same** | 같음 (최근입금계좌 행도 같음) |
| send-amount-keypad | `send-amount:keypad` 182.536–183.266 #7031–#7033 | `send-amount:keypad` 75.335–76.086 #2879–#2882 | 512,46,12,1164 | 3.142 | 2.777 | **layout** | 레이아웃 차이(데이터 때문): v2 에 "처음 보내는 계좌예요. 사기의심조회 ›" 분홍 칩이 받는 계좌 줄 아래 들어가 "얼마를 이체하시겠어요?"·출금가능금액이 52px(≈35.75dp) 아래로. 받는 은행 로고·계좌 글자·잔액 데이터 차이. 키패드·[확인]은 아래 고정이라 같음 |
| send-amount-1won-vs-2won | `send-amount:1won` 183.456–183.513 #7042–#7045 | `send-amount:2won` 76.086–76.455 #2883–#2899 | 512,46,12,1164 | 2.294 | 1.67 | **layout** | 위와 같음 (+52px) + 금액 1원/2원 |
| send-amount-form | `send-amount:next-spinner` 184.709–184.910 #7086–#7096 | `send-amount:form` 77.775–77.818 #2956–#2957 | 224,590,76,76 | 3.136 | 3.051 | **layout** | 금액 묶음 +52px. 통장표기 묶음·[추가이체][다음]은 같은 자리. 버튼 색 차이는 v1 쪽 [다음] 눌림 프레임 섞임 |
| send-amount-processing | `send-amount:processing` 188.700–189.550 #7210–#7240 | `send-amount:processing` 80.852–81.706 #3022–#3050 | 224,590,76,76 | 2.151 | 1.659 | **layout** | 금액 묶음 +52px (칩) |
| send-password-leak | `send-password:leak` 188.273–188.506 #7192–#7200 | `send-password:leak` 80.453–80.500 #3002–#3002 | 224,590,76,76 | 1.322 | 1.13 | **keys** | 시트·제목·점 4개·"비밀번호가 기억나지 않아요" 같음. 섞인 숫자 배치만 다름(무작위) — 키 숫자 칸은 비교 마스크 |
| send-confirm-idle | `send-confirm:idle` 190.999–191.199 #7300–#7311 | `send-confirm:idle` 82.868–84.096 #3108–#3173 | 224,590,76,76 · 96,190,60,24 | 2.341 | 1.968 | **data** | 데이터 차이만: 받는 은행 로고(농협/카카오뱅크), 1원/2원, "… 계좌로 보냅니다." 줄. 레이아웃 같음 |
| send-confirm-processing | `send-confirm:processing` 191.567–192.052 #7330–#7357 | `send-confirm:processing` 86.003–86.237 #3278–#3290 | 224,590,76,76 · 215,1125,40,38 | 2.174 | 2.026 | **data** | 위와 같음 |
| send-done-idle | `send-done:idle` 194.201–195.730 #7458–#7483 | `send-done:idle` 87.065–87.214 #3327–#3330 | – | 5.248 | 4.16 | **layout** | 레이아웃 차이(데이터 때문): v1 받는 계좌 "지역농축협 / 12345652789012" 가 두 줄로 꺾여 카드가 ≈32–33px(≈22.5dp) 커지고 아래 항목·더보기·광고 카드가 그만큼 내려감. v2 는 "카카오뱅크 3333123456789" 한 줄. 체크·제목·하단 버튼 같은 자리 |

결론: 같은 상태는 두 영상에서 픽셀이 같다(코덱 잡음 수준). 화면 크기·배치가 영상 사이에 바뀌지 않았으므로 한쪽 영상 기준을 다른 쪽 같은 상태에 그대로 쓸 수 있고,
배치 차이는 모두 데이터가 원인이다 → 앱이 같은 규칙으로 그리면 둘 다 맞는다.

## 8. 녹화 재현 대본 요약 (record)

t = 영상 시각(s). 위치는 frame px 대략(그룹 스펙의 버튼 상자 가운데로 바꾼다). press = 누름 시작 ~ 뗌(눌림 색이 보이는 구간), tap = 누름·뗌 한 묶음(눌림 효과 없음),
drag = 1단계 `scrolls[n].samples`(프레임별 scrollTop 곡선) 재생, swipe = 배너 가로 끌기, auto = 앱이 스스로 함(대본 동작 없음, 확인용), cut = 녹화 컷.

### 8.1 v1 — 시작 `/` (scenario `v1-start`, 345원) · 녹화 0 = 영상 1.748 (런처 컷) · 시계 11:05:58 ≈ v1 0 s, 이체 11:09:11

| t (s) | 동작 | 무엇 | 위치 px (대략) | 메모 |
|---|---|---|---|---|
| 1.748 | launch | 앱 열기 / (스플래시) | – | 런처 0–1.748 컷 |
| 1.828 | auto | 스플래시 로고 애니메이션 | – | –2.110 |
| 2.841 | cut | 보안 검은 화면: PIN 6자리 입력(녹화는 컷 안에서 6번 탭) | – | –7.395. 7.395 에 6점 다 참 + 스피너 |
| 9.242 | auto | 로그인 로딩 → 캐릭터 → 홈 첫 그리기 | – | 10.229–11.471 단계 |
| 11.633 | auto | 프로모션 시트 올라옴 + 잔액 굴림 | – |  |
| 12.578 | press | 팝업 "닫기" 누름 → 12.687 뗌 | 484,1176 | 회색 사각 눌림 |
| 13.631 | auto | 배너 자동 1→2 | – |  |
| 14.451 | drag | 홈 스크롤 0→206 | – | scrolls[0] 14.451–15.144 |
| 16.732 | swipe | 배너 스와이프 2→3 (×8: 16.732, 17.668, 18.403, 19.198, 20.168, 20.904, 21.663, 22.299) | 420,940 | 각 회차 시작은 맞춤 시작 16.680…22.267, 끌기 첫 3–4프레임 |
| 22.775 | drag | 홈 스크롤 206→1194 (끌기 2번) | – | scrolls[1] |
| 24.882 | auto | 마키 흐름(스크롤 정지) | – | –26.714 |
| 26.714 | drag | 홈 스크롤 1194→78 | – | scrolls[2] |
| 29.119 | auto | 배너 자동 1→2 | – |  |
| 29.779 | tap | WON 통장 카드 탭 → 스피너 → 거래내역 | 200,700 | 눌림 효과 없음, 정확한 탭 위치 모름 |
| 34.062 | drag | 거래내역(전체) 0→4412 → 38.025 위로 0 | – | scrolls[3–4] |
| 40.664 | tap | 필터(조절) 아이콘 → 조회조건 시트 | 480,614 |  |
| 41.485 | tap | [입금] | 262,910 |  |
| 42.246 | press | [적용하기] 누름 → 42.362 뗌 | 342,1142 |  |
| 43.147 | drag | 입금 0→4017 → 0 → 3058 → 3003 → 4240 → 0 (6구간) | – | scrolls[5–10] 43.147–57.708 |
| 58.962 | tap | 필터 아이콘 | 480,614 |  |
| 59.491 | tap | [출금] | 420,910 |  |
| 60.495 | press | [적용하기] 누름 → 60.761 뗌 | 342,1142 |  |
| 61.714 | drag | 출금 0→10195 (끌기 2번) → 74.445 위로 0 | – | scrolls[11–12] –81.543 |
| 82.414 | tap | 필터 아이콘 | 480,614 |  |
| 83.461 | tap | [입금] | 262,910 |  |
| 84.238 | tap | [적용하기] (1프레임 눌림) | 342,1142 |  |
| 86.251 | drag | 입금 0→1002 → 88.290 위로 0 | – | scrolls[13–14] |
| 91.367 | tap | 입금 첫 행(한지호 +100,000원) → 상세 | 200,1010 | 눌림 효과 없음 |
| 95.460 | back | OS 뒤로(◁) → 95.699 상세 닫힘 | – | 브라우저 뒤로 |
| 97.146 | tap | 필터 아이콘 | 480,614 |  |
| 98.493 | tap | [출금] | 420,910 |  |
| 99.011 | tap | [적용하기] (1프레임) | 342,1142 |  |
| 100.510 | drag | 출금 0→64 | – | scrolls[15] |
| 101.486 | tap | 출금 행(11:02:40 농협정우진 -1원) → 스피너 1프레임 → 상세 | 200,950 |  |
| 104.531 | tap | 상세 ✕ → 닫힘 | 482,82 | 눌림 효과 없음 |
| 105.520 | tap | 헤더 ‹ → 스피너 → 홈(캐시) → 다시 그리기 | 40,83 | 눌림 효과 없음(‹ 로 추정) |
| 110.073 | drag | 홈 0→260 → 111.142 →380 | – | scrolls[16–17]; 스크롤 끝 무렵 배너 3→4 자동(카운터 110.591, 슬라이드 110.624–110.876, ease 298ms) |
| 112.130 | tap | 배너 › ×6 (4→5 … 9→10): 슬라이드 시작 112.17, 113.51, 114.83, 115.89, 116.95, 117.91 의 ≈0.04s 앞 | 416,824 | scrollTop 380 기준 › 위치 |
| 119.235 | tap | WON 통장 카드 → 거래내역(2차) | 200,400 | scrollTop 380 (카드 y≈276–530) · critic-1: 스피너 첫 프레임 #4514(119.235) — 탭 시각을 여기로 |
| 123.550 | drag | 전체 0→102 (천천히) | – | scrolls[18] |
| 125.103 | tap | 필터 아이콘 | 480,614 |  |
| 125.539 | tap | [입금] | 262,910 |  |
| 126.486 | press | [적용하기] 누름 → 126.710 뗌 | 342,1142 |  |
| 127.696 | drag | 입금 0→1991→2376→3781→4470 (아주 천천히) → 150.009 위로 0 | – | scrolls[19–23] –153.042 |
| 154.314 | tap | 입금 첫 행 → 상세 | 200,1010 |  |
| 156.237 | tap | 상세 [확인] (1프레임 눌림) → 닫힘 | 342,1142 |  |
| 157.534 | tap | 필터 아이콘 | 480,614 |  |
| 158.497 | tap | [출금] | 420,910 |  |
| 158.663 | press | [적용하기] 누름 → 159.141 뗌 | 342,1142 |  |
| 160.110 | drag | 출금 0→9184 → 173.118 위로 0 | – | scrolls[24–25] –174.614 |
| 175.468 | press | [이체] 누름 → ≈175.535 뗌 → 대기 → 이체 페이지 | 380,458 |  |
| 180.302 | tap | 최근입금계좌 행(정우진 · 지역농축협) → 스피너 → 금액 | 200,518 |  |
| 183.456 | tap | 키패드 "1" | 86,820 | 키 눌림 효과 없음 |
| 183.530 | press | [확인] 누름 → 183.882 뗌(키패드 사라짐) | 262,1142 |  |
| 184.592 | press | [다음] 누름 → 184.709 뗌 → 스피너 → 중복 경고 시트 | 384,1142 |  |
| 185.973 | press | "네, 보낼게요" 누름 → 186.449 뗌 | 342,1142 |  |
| 186.449 | cut | 보안 검은 화면: 계좌 비밀번호 4자리(컷 안에서 탭) | – | –188.273, 누출 188.273–188.674 = 앱 시트(4점+스피너) |
| 188.674 | auto | 시트 사라짐 → 처리 → 확인 화면 모핑 | – | 189.586–190.999 |
| 191.441 | press | [이체] 누름 → 191.533 뗌 → 처리 → 완료 | 262,1142 |  |
| 196.228 | press | 완료 [확인] 누름 → 196.369 뗌 → 거래내역(344원) | 342,1142 | 196.12–199.60 OS 헤드업 알림은 마스크 |
| 200.483 | end | 끝 | – |  |

### 8.2 v2 — 시작 `/history?type=out` (scenario `v2-start`, 344원) · 녹화 0 = 영상 0.000 · 시계 11:16:14 ≈ v2 0 s, 이체 11:17:39

| t (s) | 동작 | 무엇 | 위치 px (대략) | 메모 |
|---|---|---|---|---|
| 0.000 | start | 거래내역(출금·344원) 맨 위 | – | v1 끝 + 출금 필터 |
| 0.135 | back | OS 뒤로 → 스피너 → 홈 바탕 → 캐시 홈 → 다시 그리기 → 잔액 굴림 | – | 기록에 홈 없음 → 홈으로 (replace) |
| 3.577 | auto | 배너 자동 2→3 | – |  |
| 4.204 | tap | WON 통장 카드 → 홈 위 스피너 → 거래내역 | 200,780 | 눌림 효과 없음 |
| 9.021 | tap | 필터 아이콘 → 시트 | 480,614 |  |
| 9.480 | tap | [입금] | 262,910 |  |
| 10.210 | press | [적용하기] 누름 → 닫힘 시작(10.493)까지 누름 유지 | 342,1142 |  |
| 11.438 | drag | 입금 목록 끌기 25번 0→3728.7 | – | timeline-v2 scrolls[0] 11.413–27.824 |
| 28.199 | tap | 필터 아이콘 | 480,614 | 목록 3728.7 내린 채 |
| 29.212 | tap | [출금] | 420,910 |  |
| 29.455 | press | [적용하기] 누름 → 29.707 닫힘 시작 | 342,1142 | 시트 뒤 목록 맨 위로 |
| 31.203 | drag | 출금 끌기 32번 0→6565.2, 52.824 부터 위로 튕김 13번 → 59.679 맨 위 | – | timeline-v2 scrolls[1] 30.221–60.115 |
| 60.306 | press | [이체] 누름 → 60.473 뗌 → 이체 페이지 | 380,458 |  |
| 63.740 | tap | 계좌번호 입력칸 → push(63.753) | 200,248 | touch 탭(리드 다름) |
| 64.672 | auto | 키보드 올라옴 | – |  |
| 65.207 | type | 계좌번호 13자리(더미 3333123456789) — keyHighlightOn/Off 시각대로 키 누름 | – | timeline-v2.json typing.events; 칩 바뀜은 ledger 11절 |
| 71.412 | tap | 은행/증권사 선택 → 키보드 내려감 → 금융회사 페이지 | 262,358 |  |
| 72.467 | tap | 카카오뱅크 | 104,494 | 눌림 효과 없음 |
| 73.201 | press | [확인] 누름 → 73.351 뗌 → 스피너 → 베일 걷힘 → 금액 | 262,1142 |  |
| 76.086 | tap | 키패드 "2" | 262,820 |  |
| 76.455 | press | [확인] 누름 → 76.738 키패드 사라짐까지 | 262,1142 |  |
| 77.818 | press | [다음] 누름 → 78.126 뗌 | 384,1142 | 중복 경고 없음 |
| 78.201 | cut | 보안 검은 화면: 비밀번호 4자리 | – | –80.453, 누출 80.453–80.852 |
| 80.852 | auto | 처리 → 확인 화면 모핑(82.09–82.83) → 화살표 반복 | – |  |
| 84.096 | press | [이체] 누름 → 84.180 뗌 → 버튼 안 스피너 → 처리 → 완료 | 262,1142 |  |
| 87.214 | press | 완료 [확인] 누름 → 87.415 뗌 → 거래내역(342원) | 342,1142 |  |
| 90.232 | auto | OS 카카오뱅크 알림(마스크) | – |  |
| 90.896 | end | 끝 | – |  |

- v2 계좌번호 13자리(더미 3333123456789) 글자가 화면에 나타나는 시각: 65.423 #2663, 65.762 #2669, 66.271 #2674, 67.215 #2682, 67.650 #2691, 67.933 #2697,
  68.218 #2701, 68.639 #2708, 69.107 #2711, 69.472 #2718, 69.709 #2722, 69.943 #2726, 70.327 #2732. 키 강조는 더미 숫자의 키 자리로 재생되므로(원본과 다른 칸) 키보드는 비교 마스크.

## 9. 전환 id 목록 (inventory)

| 전환 id | 어디서 → 어디로 | 종류 | 영상 구간 (s) | 그룹 |
|---|---|---|---|---|
| `launch-to-splash` | 런처(앱 밖) → splash | instant | v1 1.748 | launch |
| `splash-logo` | splash:logo-start → splash:logo-end | move | v1 1.828–2.110 | launch |
| `splash-to-cert` | splash → cert-pin | instant+cut | v1 2.841–7.395 | launch |
| `cert-spinner-off` | cert-pin:spinner → cert-pin:filled | instant | v1 8.765 | launch |
| `cert-to-login-loading` | cert-pin → login-loading | instant | v1 9.242–9.319 | launch |
| `home-first-render` | home-loading → home | steps | v1 10.229–11.471 | home |
| `home-popup-open` | home → home-popup | sheet-up+dim | v1 11.633–11.767 | home |
| `home-popup-behind` | home(딤 뒤) → home | instant-steps | v1 11.709–11.876 | home |
| `home-popup-close` | home-popup → home | sheet-down+dim | v1 12.729–12.971 | home |
| `balance-odometer` | 잔액 "원" → 잔액 n원 | odometer | v1 11.876–12.444, v1 108.117–108.761, v2 2.959–3.561 | home |
| `banner-programmatic` | 배너 n/10 → 배너 n+1/10 | slide-x | v1 13.631–13.957, v1 29.119–29.387, v1 110.575–110.876, v1 112.212–118.273, v2 3.577–3.878 | home |
| `banner-swipe` | 배너 n/10 → 배너 n+1/10 | drag+settle | v1 16.732–22.701 | home |
| `ai-icon-cycle` | AI → 빈 말풍선 → ≡ → 빈 말풍선 → AI | loop | v1 13.139–14.968, v1 21.004–22.976, v1 29.003–30.532, v1 108.927–110.758, v1 116.786–118.692 | home |
| `bell-wobble` | 종 아이콘 → 종 아이콘 | once | v1 11.556–11.577 | home |
| `marquee` | 우리금융그룹 서비스 줄 (반복) | loop | v1 24.882–26.714 | home |
| `home-to-history` | home → history-loading | instant+steps | v1 29.779–33.453, v1 119.235–122.721, v2 4.204–7.231 | home → history |
| `filter-sheet-open` | history → history-filter-sheet | sheet-up+dim | v1 40.664–40.914, v2 9.021–9.364, v2 28.199–28.527 | history |
| `filter-select` | history-filter-sheet:all → history-filter-sheet:deposit | instant | v1 41.485, v2 9.480 | history |
| `filter-sheet-close` | history-filter-sheet → history | sheet-down+dim | v2 10.493–10.776, v2 29.707–29.973, v1 42.362–42.654 | history |
| `history-reload` | history(필터 바뀜) → history | instant | v2 10.776–11.413, v1 42.654–42.897 | history |
| `history-scroll` | history → history | scroll | v1 34.062–39.819, v2 11.438–27.824, v2 31.203–59.679 | history |
| `detail-open` | history → history-detail | slide-up+fade | v1 91.367–91.641, v1 101.519–101.871, v1 154.314–154.589 | history-detail |
| `detail-close` | history-detail → history | slide-down+fade | v1 95.699–95.867, v1 104.531–104.697, v1 156.273–156.521 | history-detail |
| `history-to-home` | history → home | instant+steps | v1 105.520–109.012, v2 0.135–3.577 | history → home |
| `history-to-send` | history → send-where | instant+steps | v1 175.468–178.095, v2 60.306–62.406 | history → send-a |
| `push-account-input` | send-where → send-account-input | push+veil | v2 63.760–64.053 | send-a |
| `input-underline` | 밑줄 연회색 → 밑줄 진함 | scale-x | v2 64.120–64.520, v2 72.749–73.150 | send-a |
| `keyboard-up` | 키보드 없음 → 시스템 키보드 | slide-up | v2 64.672–65.023 | send-a |
| `keyboard-down` | 시스템 키보드 → 키보드 없음 | slide-down | v2 71.428–71.547 | send-a |
| `push-bank-page` | send-account-input → send-bank-sheet | push+veil | v2 71.412–71.965 | send-a |
| `bank-render` | send-bank-sheet → send-bank-sheet:idle | steps | v2 71.965–72.207 | send-a |
| `bank-selected` | send-bank-sheet → send-account-input | instant | v2 72.467–73.177 | send-a |
| `account-confirm-reveal` | send-account-input → send-where | instant+veil-fade | v2 73.201–74.723 | send-a |
| `send-amount-enter` | send-where → send-amount | instant+steps | v1 180.302–182.536, v2 74.723–75.335 | send-a → send-b |
| `amount-fields-in` | send-amount:keypad → send-amount:form | instant+slide-up+fade | v1 183.882–184.592, v2 76.738–77.608 | send-b |
| `dup-warning-open` | send-amount:form → send-dup-warning | sheet-up+dim | v1 184.928–185.270 | send-b |
| `dup-yes-to-password` | send-dup-warning → send-password | cut | v1 185.973–188.674, v2 77.818–80.852 | send-b |
| `confirm-morph` | send-amount:processing → send-confirm:idle | morph | v1 189.586–190.999, v2 81.706–82.834 | send-b |
| `confirm-arrow-loop` | (반복) | loop | v2 82.770–84.100 | send-b |
| `transfer-processing` | send-confirm:idle → send-confirm:processing | instant | v1 191.441–193.407, v2 84.096–86.237 | send-b |
| `done-enter` | send-confirm → send-done | instant+check | v1 193.407–194.201, v2 86.237–86.947 | send-b → done |
| `done-to-history` | send-done → history | instant+steps | v1 196.228–199.631, v2 87.214–90.038 | done → history |
| `spinner` | (반복) | loop | v1 7.395–8.765, v2 84.640–86.930 | 공통 (모양 확인 history) |

동작 id (inventory behaviors[].id, 구간표에서 "동작 `…`"): `scroll-inertia`, `collapsing-header`, `floating-pill`, `bottom-sheet`, `system-keyboard`, `shuffled-pin-keypad`, `amount-keypad`, `toggles`, `press-feedback`, `skeleton`, `spinner`, `dup-warning`, `first-time-chip`, `back`, `banner-carousel`, `ai-icon`, `marquee`, `odometer`, `notice-carousel`, `typing-and-chips`, `confirm-morph`, `done-check`, `text-wrap`, `nav-bar-color`.

## 10. 관찰 메모 (화면 담당 참고)

### 10.1 움직임

- **페이지 이동은 거의 다 한 프레임 교체** + 흰 페이지/스피너 + 단계적 그리기다(홈→거래내역, 거래내역→홈, 거래내역→이체, 이체 단계들). 슬라이드 push 는
  v2 계좌번호·금융회사 페이지(push + 아래 페이지 흰 베일)뿐. 움직이는 전환: 바텀시트(홈 팝업·조회조건·중복 경고) + 검정 딤, 거래 상세 slide-up+fade, 배너,
  입력 밑줄, 키보드(OS), 이체 확인 헤더 모핑, 완료 체크 원.
- 시트·전환 **첫 프레임이 이미 진행된 경우가 많다**(홈 팝업 첫 프레임 68 %, 조회조건 시트 30–45 %): 앱이 전환 직후 프레임을 늦게 그림(jank). 이징 맞춤의 시작 시각이
  첫 프레임보다 앞에 나오는 이유. 앱은 매끈한 곡선으로 구현하고 녹화 비교에선 첫 1–2프레임 차이를 리드로 맞춘다.
- 딤: 시트 딤 α 0.5686 (`#00000091`), 팝업 딤 α 0.5098 (`#00000082`) — 정지 화면에서 잰 값(spec/tokens.md, D11). 1단계 표의 0.50·0.556–0.564 는 페이드 맞춤값이라 쓰지 않는다.
- 배너 자동 넘김: 정지 뒤 ≈3.05 s 에 다음 장(사용자 조작 뒤 타이머 다시 시작), 넘김 ≈300 ms — 가장 깨끗한 회차(v1 113.541 6→7, 114.846 7→8)가 ease(0.25,0.1,0.25,1) 300–320 ms.
  v1 1차 방문 2→3…9→10 은 사용자 스와이프(첫 3–4프레임 느린 끌기), 2차 방문 4→5…9→10 은 › 탭(카운터가 슬라이드보다 ≈0.04 s 먼저 바뀜).
- 반복 애니메이션: 홈 헤더 AI 아이콘 주기 ≈7.99 s, 우리금융그룹 서비스 마키 ≈47 px/s, 이체 확인 "→" ≈0.83 s, 스피너 ≈0.81 s, 커서 깜빡임, 오버레이 스크롤바 멈춘 뒤 ≈0.6 s 흐려짐.
- OS 내비 바 색은 화면 배경을 따른다: 홈 ≈(239) 연회색, 흰 페이지(거래내역·이체) 252, 홈 팝업(11.471–13.016)·보안 화면 검정. 바뀌는 순간이 화면 교체와 같은 프레임(하네스 `#nav` 자리 색).

### 10.2 스피너 보이는 구간 (색 기준, 전 프레임)

| 영상 | 중심 px | 보이는 구간 (첫 프레임 – 사라진 첫 프레임, s) | 프레임 | 장수 |
|---|---|---|---|---|
| v1 | 262,628 | 7.395–8.765 | #130–#207 | 78 |
| v1 | 262,585 | 10.011–11.257 | #272–#291 | 20 |
| v1 | 262,585 | 29.779–30.532 | #1174–#1191 | 18 |
| v1 | 262,628 | 30.683–33.404 | #1198–#1313 | 116 |
| v1 | 262,628 | 42.362–43.373 | #1660–#1710 | 51 |
| v1 | 262,628 | 60.761–61.697 | #2353–#2397 | 45 |
| v1 | 262,628 | 84.238–85.271 | #3438–#3474 | 37 |
| v1 | 262,628 | 99.011–99.998 | #3798–#3844 | 47 |
| v1 | 262,628 | 101.486–102.215 | #3861–#3892 | 32 |
| v1 | 262,628 | 105.520–106.196 | #3926–#3951 | 26 |
| v1 | 262,585 | 119.235–120.038 | #4514–#4531 | 18 |
| v1 | 262,628 | 120.038–122.688 | #4532–#4629 | 98 |
| v1 | 262,628 | 126.486–127.646 | #4726–#4775 | 50 |
| v1 | 262,628 | 158.663–160.093 | #6094–#6142 | 49 |
| v1 | 262,628 | 175.484–176.489 | #6916–#6922 | 7 |
| v1 | 262,628 | 176.783–178.054 | #6926–#6949 | 24 |
| v1 | 262,628 | 180.302–182.456 | #6961–#7027 | 67 |
| v1 | 262,628 | 184.726–185.254 | #7087–#7112 | 26 |
| v1 | 262,628 | 188.380–190.372 | #7193–#7267 | 75 |
| v1 | 262,628 | 190.673–191.390 | #7283–#7321 | 39 |
| v1 | 262,628 | 192.069–194.201 | #7358–#7457 | 100 |
| v1 | 262,628 | 196.348–197.452 | #7495–#7523 | 29 |
| v1 | 262,628 | 197.668–199.603 | #7528–#7582 | 55 |
| v2 | 262,628 | 0.195–0.515 | #7–#14 | 8 |
| v2 | 262,584 | 4.204–4.974 | #100–#114 | 15 |
| v2 | 262,628 | 4.974–7.215 | #115–#203 | 103 |
| v2 | 262,628 | 10.493–11.413 | #242–#290 | 49 |
| v2 | 262,628 | 29.707–30.692 | #1082–#1128 | 47 |
| v2 | 262,628 | 60.306–60.951 | #2545–#2555 | 11 |
| v2 | 262,628 | 61.352–62.406 | #2559–#2587 | 29 |
| v2 | 262,628 | 73.319–75.275 | #2802–#2877 | 76 |
| v2 | 262,628 | 78.059–78.201 | #2965–#2969 | 5 |
| v2 | 262,628 | 80.519–82.325 | #3003–#3077 | 75 |
| v2 | 262,628 | 82.576–83.336 | #3092–#3135 | 44 |
| v2 | 262,628 | 84.640–86.947 | #3203–#3319 | 117 |
| v2 | 262,628 | 87.356–87.607 | #3335–#3347 | 13 |
| v2 | 262,628 | 88.212–90.038 | #3351–#3410 | 60 |

- v2 84.214–84.489: 이체 확인 [이체] 버튼 안 작은 흰 스피너(x221–249, y1130–1157) — 위 표(색 고리 기준)에는 없음. v2 82.325–82.559 는 확인 화면 전환 중이라 잠깐 안 보임(같은 로딩).

### 10.3 눌림과 데이터

- 눌림 색(버튼 안쪽 띠 중앙값): 파란 버튼(적용하기·이체·확인·다음·네 보낼게요) `#2387F3`/`#2487F2` → `#195CA5`, 금액 [확인] v1 `#086FF3` → `#155292`…`#195CA5`(진해지는 6프레임) / v2 `#096EF3` → `#175DA5`,
  홈 팝업 "닫기" `#FEFEFE` → `#B3B3B4` 회색 사각. 눌림 효과가 녹화에 없는 것: 계좌 카드, 거래 행, 조회조건 칩, 금액 키패드 숫자, 금융회사 그리드, 헤더 ‹·✕.
- 이체 확인 [이체] 눌림 뒤 비활성 `#C1DCFA` + 버튼 안 흰 스피너.
- 거래내역 v1 `history:withdraw-scrolled-64`(101.086–101.486, 104.697–105.520)는 scrollTop 64 다(맨 위 아님). 출금 맨 위 기준은 v1 99.607–100.510 / v2 30.692–31.203.
- 금액 화면: v2 에만 "처음 보내는 계좌예요. 사기의심조회 ›" 분홍 칩 → 아래 묶음 +52 px. 완료 화면: v1 받는 계좌 "지역농축협 12345652789012" 가 두 줄로 꺾여 카드가 ≈33 px 커짐.
- 캐릭터(D4): 로그인 로딩 캐릭터(v1 9.319–10.011, 상자 181,532,143,118), 홈 상단 캐릭터 배너, 중간 배너 4 그림, 탭바 '혜택' 아이콘 → 자르거나 따라 그리지 않고 독창적 대체 그림 + 비교 마스크.
