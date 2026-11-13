# allone (NH올원뱅크): build plan (synthesis of infra · launch · home · account · transfer)

App id **`allone`** = NH올원뱅크 (NH농협은행's app; **not** NH 콕뱅크, which is app id `nh`). Own server and data: port **9119**, dev vite **5182** / API **8796**,
data dir `server/data-allone/`, cookie `bank_sid_allone`, `APP_NAME` "올원뱅크". The device is fixed to **iPhone + light** (no device or theme switch, like kakao2),
**with a recording intro** (iPhone home screen → tap the all one icon → app opens).

This file is the single source of truth where the five area specs disagree. Read the area spec for screen detail (layout tables, ink boxes, colours)
and this file for every cross-cutting decision. Area specs: `specs/infra.md`, `specs/launch.md`, `specs/home.md`, `specs/account.md`, `specs/transfer.md`
(all in `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/allone/specs/`).

**Privacy.** No value from the recordings is in this file. Seed values in §2.3 are invented (홍길동 style). `<NAME_A>`, `<ACCT_A>`, `<AMT_2>` and similar
placeholders describe only a role and a format. Frames stay under `…/scratchpad/allone/frames/<area>/`. Never commit a frame. A crop is committed only after
someone has opened and looked at it. The home-screen wallpaper (album artwork), the other installed apps and the notification badges are never reused.

**Excluded, never specced or built:** the withdrawal-block notice and its code (C3 ≈ 12.7–19.5 s and its second appearance ≈ 33.2–34.0 s),
everything about 이의제기 (C3 ≥ 42.4 s search results and all of C4), and the iOS paste-permission dialog (C1 ≈ 2.28–3.37 s). They are skipped.
In the clone, 잔액채우기 and transfers simply succeed.

**Units.** pt = CSS px of the 393 × 852 frame (0 = top of the status bar). Clips are 1180 × 2556 px.
- x pt = px / 3.0025 (all specs agree; the 1180th column is encoder padding).
- y pt = px / **3.000** (2556 / 852 exact). infra.md and transfer.md use this. **launch.md, home.md and account.md divided y by 3.0025**, so their y values read
  low by y × 0.00083 (≈ +0.35 pt at mid-screen, +0.68 pt at the bottom). That is why launch says the web view ends at 817.3 and infra says 818.0: same pixel row.
  Use their values as given (inside the ±1 pt tolerance) except for the frame anchors, which are **59 / 818** everywhere.
- Times are real pts (ffprobe). C1 = `…_1_3.mp4`, C2 = `…_1_4.mp4`, C3 = `…_2.mp4`. C4 is excluded.

---

## 0. Decisions at a glance

1. **Own server with an intro.** Add `INTRO_APPS = ["allone"]` in `server/db.mjs` and derive `APP` from `VARIANTS` only, so kbank2/ibk2/kakao2 are unchanged
   (infra §2.1). Client `HAS_INTRO` needs no change. `ALLONE = APP === "allone"` in `session.ts`.
2. **Band model (WebView in a native shell).** Native white status band 0–59, web view **59–818**, native white bottom band 818–852, no home indicator in-app.
   `.phone__viewport` is inset 59 / 34. Every screen lays out in the 759-pt web view (web y = screen y − 59). This replaces kakao2's page-painted 54-pt band.
3. **Two dim families.** The **web loading dim** `rgba(55,55,55,.68)` plus the green all-one spinner covers only 59–818 and appears and leaves in one frame
   (verified this pass, §8). **Native dims** (금액 입력 sheet ≈ black .765, 계좌 비밀번호 sheet ≈ black .733) cover the whole window including the status band,
   but never the island, the red dot or the status glyphs.
4. **Every screen change is a CUT**, usually behind the web loading dim with a measured hold (§1.4). No iOS push animation and **no edge-swipe back**.
   Only sheets, the keypad panel and the keyboard move.
5. **Recording intro is drawn, not a video.** A DOM/SVG iPhone home scene (generated gradient wallpaper, neutral placeholder icons, the all one icon),
   a one-frame press, then a **250 ms uniform dissolve to white** (not a zoom; verified this pass), then the boot chain. Nothing from C1 0–1.15 s is shipped.
6. **Boot chain:** white launch → splash (cropped image, fade 267 ms, hold 2.383 s) → **PIN screen (visual only; any 6 digits; nothing stored, logged or sent)** →
   login loading 2.233 s → home (skeleton) → 정기점검 sheet at +583 ms. Timings are the recording's, with the paste dialog removed.
7. **PIN and account password are fake.** Component state only, cleared on unmount. Auth stays the existing cookie session.
8. **Main account** = `NH페이모아통장(비대면실명확인)` (home card 1, small 4-digit balance). Second NH account `NH X 카카오페이통장(비대면실명확인)` has a 1-digit
   balance, so the recorded "출금가능금액 부족 → 잔액채우기" path is reachable by typing two digits. KB and 케이뱅크 accounts are the 잔액채우기 sources.
9. **한도제한 is an allone-gated `accounts.limited` column**, not `badge` (`migrate()` clears the main account's badge on every DB open, `db.mjs:172`). Display only.
10. **잔액채우기 = `POST /api/transfers`** from a registered own account to the NH account, `memoTo = memoMe = "잔액채우기"`. 1회 한도 5,000,000 and
    1일 잔여한도 1,000,000 − today's top-ups from that source are display constants with client checks. No server limit, no withdrawal block.
11. **Server stays almost untouched.** Gated additive changes only (§2.4): `limited`, notice fields on the profile, a tiny `ao` block on the tx detail,
    `favorite` on `POST /api/payees`, and a `recent_hidden` table for 삭제하기. Filters and paging on 거래내역 are client-side (the list endpoint returns ≤ 500 rows).
12. **Unbuilt controls are silent no-ops** (repo convention, SOLUTION 22). No "준비 중" toasts. Tabs 금융상품 / 내 자산 / 포인트쌓기 / 생활혜택 are no-ops,
    홈 scrolls to top. The 🔔 **bell in the home header opens the DevPanel**.
13. **Fonts:** Pretendard for everything (kakao2 rule), with the area specs' fitted sizes. **Roboto** (`@fontsource/roboto`, already a dependency) only on
    `.ao-num`: the big amount, the amount keypads, the chips and the 금액 입력 digits.
14. **Keyboard is a foundation primitive** (`AoKeyboard`: iOS 26 Korean 두벌식 + number pad, in the native layer). Search, memo, 계좌번호 and 통장 표시 inputs use it.
15. **Bank tiles are crops** for the seven banks the recording shows (전북 `jb`, 신한, 카카오뱅크, 하나, KB, 케이뱅크, NH: clean logo-only squircles, verified).
    Other banks get a colour tile with the `hana-bank-<code>` glyph as a mask, or the short name.
16. **Names and prefixes:** CSS `ao-` (areas `ao-ln-`, `ao-home-`, `ao-acct-`, `ao-send-`), keyframes `ao-…`, assets `allone-…`.
    Never `nh-`, `bank-` or `k2-`. Never set `data-kakao2` for allone.

---

## 1. Screens, routes, boot chain

### 1.1 Boot chain (clone timeline; t = first recorded frame when ● 녹화 runs with the intro on)

| t (s) | event | owner | source |
|---|---|---|---|
| 0.000 | drawn iPhone home scene covers the whole phone; status glyphs white; red dot starts enlarged and settles by 0.55 (optional) | launch | launch §2.1, §2.3 |
| 0.650 | press: all one icon palette swap in one frame (#0C8F2D → #034913, wordmark white → #919291), no scale | launch | C1 0.650 |
| 0.900 = **D** | release (icon un-darkens 100 ms ease-out) and the scene dissolves to white over **250 ms** `linear(0,.004,.008,.039,.077,.129,.203,.285,.387,.49,.602,.713,.817,.902,.962,1)`. `RESTART_EVENT "start"` is dispatched at D so `AlloneSplash` is already mounted (white) underneath. `aoSetLaunchAt(D)` | launch + foundation glue | C1 0.900–1.150 |
| D+33 → D+283 | status glyphs white → black, same curve | foundation `statusFg` | launch §2.2 |
| D+250 → D+1100 | home indicator 140 × 5 at y 839–844, opacity table §3.4 | foundation | C1 1.15–2.00 |
| D+1450 = 2.350 | splash artwork fades in 267 ms `linear(0,.188,.308,.422,.529,.624,.694,.756,.809,.855,.893,.92,.942,.964,.975,.983,1)` | launch | C1 3.400 (−1.050 for the removed dialog) |
| 5.000 → 5.167 | splash → PIN crossfade 167 ms `linear(0,.026,.108,.236,.395,.541,.692,.82,.911,.96,1)` | launch | C1 6.050 |
| 5.283 | PIN secure keypad pops in (one frame); links row jumps 769.4 → 460.9 | launch | C1 6.333 |
| user | 6 digits → +67 ms keypad off + web dim + spinner (same frame) | launch | C1 9.850 → 9.917 |
| +2.033 | home mounts under the dim (skeleton state H1); `/api/home` was prefetched during the dim | launch → home | C1 11.950 |
| +2.183 / +2.233 | spinner off / dim off | foundation loading | C1 12.100 / 12.150 |
| dim off +0 / +150 / +350 / +550 | skeleton steps H1 → H2 (banner) → H3 (card) → H4 (lower sections) | home | C1 12.15–12.70 |
| dim off +583 | 정기점검 sheet pops in, scrim fades in 300 ms `ease` | home | C1 12.733 |

- **Intro off** (normal launch, profile pick, refresh, ● 녹화 with intro off): `D = mount − 250 ms`, so the white launch holds 1.20 s, then the same splash → PIN → loading.
  The recorder's existing "off → black 600 ms → start" path is kept for intro off.
- `?skip` (dev only, existing warm start) jumps straight to home.
- PIN appears on every cold start (boot "splash"), never after in-app navigation. 로그아웃 in 전체메뉴 is a no-op (§1.7).

### 1.2 Route map (`src/allone/routes.tsx`; every transition is a CUT)

| path | screen | area | enters with (loading profile §1.4) | leaves with |
|---|---|---|---|---|
| — (boot) | intro scene, white launch, splash, PIN, login loading | launch | boot state "splash" in App.tsx | `onDone` → ScreenStack at `/` |
| `/` | 홈 (+ 정기점검 sheet, in-page) | home | boot handoff; **fresh re-entry** via `goHomeFresh()` | root. Browser back on `/` does nothing |
| `/menu` | 전체메뉴 | home | `menu` (spinner without dim 300 ms, then 50 ms dim) | × or home icon → pop (CUT, home not refreshed) |
| `/search` | 통합검색 | home | `search` (167 ms) | × → pop to `/menu` |
| `/history/:accountId` | 거래내역조회 | account | `history` (1000 ms) from a home card; `menuLink` (300 ms) from the menu | ‹ → pop; home icon → `goHome()` (pop to `/`, no refresh); menu icon → `/menu` |
| `/tx/:txId` | 거래내역 상세 | account | `txIn` (184 ms) or `txOut` (1100 ms), both with deepen | × or 확인 → pop, list scroll kept, no list refetch unless memo or ☆ changed |
| `/send?from=<id>` | 누구에게 보낼까요? (T1) | transfer | `sendFromList` (1050) / `sendFromHome` (417) / `menuLink` (300) | ‹ → pop; 취소 → `goHomeFresh()` |
| `/send/amount?from=&bank=&number=&holder=` | 얼마를 보낼까요? (T2) + native keypad panel + T3 password sheet | transfer | from a T1 최근/자주/내계좌 row: **instant CUT, no loading**; from T1 다음: `lookup` (417); from 거래내역 상세 다시보내기: `resend` (1000, **replace**) | ‹ → pop (panel slides out); 취소 → `goHomeFresh()` |
| `/send/confirm` | 이체 확인 (invented) | transfer | after the 4th password digit: `password` (483) | ‹ → pop to T2 (panel slides in); 취소 → `goHomeFresh()` |
| `/send/done` | 이체 완료 (invented) | transfer | 보내기: `send` (max(api, 1000)), **replace** of confirm | 확인 → `sendFinish()` |
| `/topup?to=<id>&from=<id?>&origin=amount\|menu\|card` | 잔액채우기 (T5) + T6 sheet + T7 native sheet | transfer | from the T2 link: `topupLink` sequence; from the menu or a 다른금융 card: `menuLink` (300) | × → pop. After success see §1.5 |

Paths only need to be unique inside this server (one app per server).

### 1.3 In-page layers (not routes; no history entries)

| layer | kind | owner | opened by | closes |
|---|---|---|---|---|
| 정기점검 안내 | web sheet, **pops in without sliding**, scrim .30 fades 300 ms | home | fresh home entry | 닫기 / 1일동안 안보기 → sheet and scrim gone in one frame |
| 계좌 선택, 조회 조건 (invented) | web sheet, rise 291 ms | account | account block ▾ / filter row | × or apply → slide down 150 ms |
| 출금계좌 선택 (T6) | web sheet, rise 291 ms `cubic-bezier(0,.11,.17,.87)` | transfer | auto on T5 entry without `from`, or the 출금계좌 field | row tap → removed in one frame under the dim; × → slide down 150 ms |
| T2 출금계좌 sheet, 은행 선택 sheet, 통장 표시 input sheet (invented) | web sheet | transfer | T2 account row ▾, T1 은행 field, confirm rows | slide down 150 ms |
| T2 keypad panel | **native** accessory panel y 435–818, not dimmed by the web dim | transfer | T2 mount (+33–50 ms after the cut) | slides out 153 ms on ‹, 취소, 다음, 잔액채우기 link |
| 계좌 비밀번호 입력 (T3) | **native** sheet, appears in one frame with dim .733, status glyphs stay black | transfer | T2 다음 | 4th digit → +50 ms gone; × → gone in one frame, panel slides in |
| 금액 입력 (T7) | **native** sheet, dim .765, rise 357 ms, status glyphs turn white | transfer | auto after a 출금계좌 is chosen; 금액 field tap | × / 확인 → slide down ≈ 145 ms, dim lingers 370 ms |
| iOS keyboard | native, slide 290 ms (foundation re-measure) | foundation (`AoKeyboard`) | focus in a text field | ✓ / tap outside / navigation |
| toast | overlay | foundation | `aoToast()` | 2.0 s hold, 200 ms fade |

Sheets push no history entry. Browser back while a sheet is open pops the route and the sheet unmounts with it.

### 1.4 Loading profiles (one table in `src/allone/nav.ts`, measured unless marked)

All times are ms from the tap release. "cut" = the frame the new route renders under the dim (invisible). The spinner leaves 33 ms before the dim unless noted.
Each hold is `max(api, hold)`: data is prefetched during the dim (`prefetch()` from `api/useApi`).

| profile | trigger | dim on | cut | dim off | extras | evidence |
|---|---|---|---|---|---|---|
| `login` | 6th PIN digit | +67 | 2033 | 2233 | spinner off 2183; keypad off in the dim's first frame | C1 9.850–12.150 |
| `history` | home card 거래내역 | 0 (spinner may lead 1 frame) | 967 | 1000 | — | C2 8.991–9.991 |
| `txIn` | 거래내역 row (입금) | 0 | 167 | 184 | **deepen**: a second `rgba(0,0,0,.22)` layer fades in 280 ms ease-out from +17 | C2 14.274–14.458 |
| `txOut` | 거래내역 row (출금) | 0 | 1083 | 1100 | deepen as above | C2 16.558–17.658 |
| `sendFromList` | 거래내역조회 이체 (pressed #EAFEEE ≈ 50 ms first) | 0 | 717 | 1050 | — | C2 20.091–21.141 |
| `sendFromHome` | home card 이체 | 0 | 284 | 417 | — | C3 26.146–26.563 |
| `lookup` (invented) | T1 다음 | 0 | 384 | 417 | 404 → no cut, helper turns red | — |
| `password` | 4th 계좌 비밀번호 digit +50 | 0 | 450 | 483 | — | C3 32.729–33.213 |
| `send` (invented) | confirm 보내기 | 0 | 967 | 1000 | `POST /api/transfers` | — |
| `topupLink` | T2 잔액채우기 link | 0 + panel slides out | 367 | 1433 | deepen 300 ms ease-out right away; the cut resets to the base dim; T6 starts rising at +983 under the dim (scrim fades in behind it); at 1433 dim + spinner leave, scrim stays | C3 1.896–3.329 |
| `topupRow` | T6 row | 0 (over the sheet too) | 284 (T6 removed, T5 shows the account) | 384 | T7 native dim on in the same frame as the web dim leaves, T7 rises from +64 | C3 5.179–5.643 |
| `topupSubmit` | 잔액채우기 button (pressed #12A434 ≈ 100 ms first) | 0 | 534 | 567 | success (§1.5) | C3 12.029–12.146 + invented end |
| `cancelHome` | 취소 (T1, T2, confirm) | 0 + panel slides out | 383 | 650 | spinner off at 517 | C3 21.596–22.246, 35.229–35.896 |
| `finish` (invented) | done 확인 | 0 | 383 | 650 | as `cancelHome` | — |
| `menu` | home ≡ | spinner only 0–317, then dim | 317 | 367 | spinner centre unchanged | C3 38.629–38.996 |
| `search` | 전체메뉴 search row | spinner 0, dim from +33 fading in over 120 ms to the deepened level | 167 | 167 | — | C3 39.813–39.979 |
| `menuLink` (invented) | menu or search result link, 다른금융 잔액채우기 | 0 | 267 | 300 | — | — |
| `resend` (invented) | 거래내역 상세 다시보내기 | 0 | 967 | 1000 | navigate with replace | — |

The spinner is centred on the **screen** at (196.5, 425.8), not on the web view, and restarts at the coin face on every onset (phase-locked).

### 1.5 Back behaviour, depth and the fresh home
- **Depth.** Every push carries `location.state.aoDepth` (+1 per push; replace keeps it). `goHome()` = `history.go(-aoDepth)`. A deep link with depth 0 navigates
  to `/` with replace (kakao2 `useK2Back` pattern).
- **Fresh home.** The home layer stays mounted. `goHomeFresh()` runs `cancelHome`, pops to `/` under the dim and emits `aoHomeFresh`. Home listens
  (`useAoHomeFresh`) and replays the skeleton steps and the 정기점검 sheet after the dim leaves. A plain pop to home (‹ from 거래내역조회, × from 전체메뉴,
  home icon) shows home as it was: no skeleton, no sheet.
- **sendFinish().** Origin is stored at `goSend` (`state.aoOrigin = "home" | "history"`). It runs `finish`, pops `sendDepth` entries and invalidates home,
  accounts, transactions and recipients. Origin home → fresh home. Origin history → the list refetches and the new 올원이체 row is on top.
- **잔액채우기 success** (`topupSubmit` then): origin `amount` → T5 is popped (CUT), T2 shows the panel sliding in, the account row balance is updated, the error
  line becomes the caption, toast "잔액을 채웠어요" (bottom 16 above the panel). Origin `menu` or `card` → stay on T5, reset the amount, refetch, the same toast above the footer.
- **Double taps.** `useAoGo()` ignores taps on an inactive layer and locks navigation for 450 ms (copy of `useK2Once` / `useKbankGo`). Navigation fires
  on release with no extra delay; the loading profile is the delay.
- **ScreenStack.** One allone branch: no enter or exit animation, no drag, no edge swipe (`canSwipe` gated `!ALLONE`).

### 1.6 Entry points

| from | control | to |
|---|---|---|
| home card (NH농협 tab) | 거래내역 / 이체 / 한도해제 | `/history/:id` (`history`) / `/send?from=:id` (`sendFromHome`) / no-op |
| home card (다른금융 tab, invented) | 잔액채우기 / 거래내역 | `/topup?to=main&from=:id&origin=card` / `/history/:id` |
| home header | wallet, 큰글, 오늘 운세, name / **bell** / ≡ | no-op (큰글 knob animates only) / **DevPanel** / `/menu` |
| home | 복사 / 숨김 / pager ‹ › / 내 자산 확인 pill / tab 홈 | copy + toast / hide balance / page ±1 / smooth-scroll to 내 자산 / scroll to top |
| 전체메뉴 | search row / 전체계좌조회, 거래내역조회, 이체내역 / 계좌이체 / 잔액채우기 / × or home | `/search` / `/history/main` / `/send?from=main` / `/topup?to=main&origin=menu` / pop |
| 통합검색 | result rows (invented) / 인기 검색어 | same links as the menu / fill the field and show results |
| 거래내역조회 | row / 이체 / account block / filter row / 계좌관리 | `/tx/:id` / `/send?from=:id` / 계좌 선택 sheet / 조회 조건 sheet / no-op |
| 거래내역 상세 | ☆ / 다시보내기 / memo / 자동이체 등록 | toggle favourite / `/send/amount?…` (replace) / save memo / no-op |
| T1 | 최근, 자주, 내계좌 row / 다음 / ☆ / 삭제하기 | `/send/amount` (instant) / lookup → `/send/amount` / favourite / edit mode |
| T2 | 잔액채우기 link / 다음 / account row ▾ | `/topup?to=:from&origin=amount` / T3 → confirm / 출금계좌 sheet |

### 1.7 Unbuilt controls and invented controls that work
**Silent no-op (press feedback where the recording has one):** tabs 금융상품 / 내 자산 / 포인트쌓기 / 생활혜택, wallet, 오늘 운세, name, 한도해제, ⋮, banner,
ads, 내 모임, 금융일정, 내 소비, 내 자산 chips, 생활자산, NH금융그룹, 홈 화면 설정, 전체메뉴 unlinked rows, pins, globe, gear, name ›, **로그아웃**, AI톡,
quick icons, 계좌관리, 자동이체 등록, 농협 계좌등록 / 타행 계좌등록, 연락처 tab (grey empty text in the page), PIN globe / menu / 로그인 방식 변경하기 /
간편비밀번호 재등록 / 자동로그인 (visual toggle only).

**Invented and working:** 다른금융 tab; 숨김 / 보기; 복사 + toast; card pager arrows; 내 자산 확인 pill; ad carousel auto 4 s + pause; notice pages 2–5,
auto-advance 4 s, pause; 1일동안 안보기; 전체메뉴 links, scroll-spy rail and 최근 이용메뉴 (last 3 built screens visited, default 거래내역조회 · 계좌이체 · 잔액채우기);
통합검색 results; 계좌 선택 and 조회 조건 sheets; 잔액 숨기기; memo; ☆; 다시보내기; T1 number input + bank auto-fill + bank sheet; 삭제하기;
T2 chips, 전액, account sheet, copy of the recipient number; T3 ×, ↻, ⌫; confirm and done pages; 잔액채우기 success and its client errors.

---

## 2. Data model and server

Every server change is gated (`APP === "allone"` / `db().app === "allone"`), so the other 9 servers return byte-identical JSON.
New allone code goes in **`server/allone-seed.mjs`** (imports nothing from `db.mjs`, toss-seed precedent). `index.mjs` and `db.mjs` get small gated hooks.

### 2.1 Plumbing (infra §2.1–§2.4, unchanged)
`APPS += "allone"`; `INTRO_APPS` and the APP/INTRO decoupling; error text and header comment; port map `allone: 9119`; `<title>` "올원뱅크 클론 연습";
DELETE message map `allone: "대표계좌"`; `POST /api/accounts` default bank `allone → "nh"`, do not reject 카카오뱅크 accounts for allone, default name
`bank.code === "nh" ? "입출금통장" : null`; `.gitignore` `server/data-allone/`; `SEEDS.allone = { example, empty }` (a missing key crashes first boot, new profile and reset).
`auth.mjs` and `banks.mjs` need no change. **Never test `APP === "nh"` for allone; NH농협은행 rows use `bank_code = 'nh'`.**

### 2.2 Schema (in `migrate()`, created only when `APP === "allone"`)

| table | addition | used by |
|---|---|---|
| accounts | `limited INTEGER NOT NULL DEFAULT 0` | 한도제한 tag (home card, T2 account row); DevPanel toggle |
| profile | `notice_on INTEGER NOT NULL DEFAULT 1` | 정기점검 sheet visibility |
| profile | `notice_items TEXT` (JSON `[{title, when}]`, NULL = computed defaults) | sheet page 1 items |
| new `recent_hidden` | `bank_code TEXT, number TEXT, hidden_at TEXT, PRIMARY KEY (bank_code, number)` | T1 최근 삭제하기 |

The shared `UPDATE accounts SET badge = NULL WHERE kind = 'main'` is left alone. No new transaction tags.

### 2.3 Seed `seedAlloneExample(d, userName = "홍길동")` (all invented)
**Dates are relative to now:** `ago(n, "HH:MM:SS")` = today − n days at that time (n ≥ 1, so nothing lands in the future). The default "1개월" filter
therefore always has rows. Every `at` has seconds (the list shows `HH:mm:ss`).

**Profile:** `user_name` 홍길동, `notice_on` 1, `notice_items` NULL.

**Accounts** (`id · kind · bank_code · name · number · balance · limited · sort`):

| id | kind | bank | name | number | balance | limited | sort |
|---|---|---|---|---|---|---|---|
| main | main | nh | NH페이모아통장(비대면실명확인) | 302-1234-5678-91 | 4,638 | 1 | 0 |
| kpay | external | nh | NH X 카카오페이통장(비대면실명확인) | 302-8765-4321-01 | 7 | 1 | 1 |
| kb | external | kb | KB나라사랑우대통장 | 123456-78-901234 | 245,000 | 0 | 2 |
| kbank | external | kbank | MY 입출금통장 | 100-123-456789 | 58,300 | 0 | 3 |

NH carousel = `bank.code === "nh"` in sort order (main, kpay). 다른금융 = the rest. T6 lists all my accounts except the target, other banks first (KB, 케이뱅크, NH).

**Payees** (`holder · bank · number · favorite`): 김민지 · kakao · 3333012345678 · **1**; 최유나 · hana · 39191012345607 · **1**; 박하늘 · jb · 1021012345678 · 0;
윤하람 · shinhan · 110345678901 · 0; 이서준 · woori · 1002456789012 · 0; 정다은 · kb · 65432102765432 · 0.
최근 (newest first) = 김민지, 최유나, 박하늘, 윤하람 (카카오뱅크, 하나, 전북, 신한: the recording's bank mix, 4 rows). 자주 = 김민지, 최유나.

**Transactions** (40 rows; `account · when · merchant · amount · tag`; "→ X" = a `transfers` row to that payee, "own" = a transfer between my accounts with the
in-transaction on the other account, merchant 잔액채우기 on both sides). Chains were validated: opening balances 120,000 / 0 / 520,000 / 70,000, never negative.
```
main  ago(84,10:02:31)  잔액채우기     +300,000 #이체     own: kb → main
main  ago(81,12:41:07)  한빛편의점      -4,800  #체크카드
main  ago(77,19:20:45)  김민지        -50,000  #이체     → 김민지
main  ago(73,08:10:00)  NH농협카드     -63,200  #자동이체
main  ago(70,13:33:12)  이서준        +25,000  #이체
main  ago(66,21:05:51)  하늘카페        -5,500  #체크카드
main  ago(62,18:44:03)  박하늘        -40,000  #이체     → 박하늘
main  ago(58,11:12:40)  소나무분식      -9,000  #체크카드
main  ago(55,03:00:00)  결산이자          +38  #예금이자
main  ago(49,12:20:18)  예시마트       -32,400  #체크카드
main  ago(45,19:02:33)  최유나        -30,000  #이체     → 최유나
main  ago(43,08:10:00)  NH농협카드     -71,500  #자동이체
main  ago(40,15:47:09)  정다은        +15,000  #이체
main  ago(36,20:11:56)  별빛서점      -16,000  #체크카드
main  ago(33,09:40:27)  김민지        -20,000  #이체     → 김민지
main  ago(29,13:05:44)  구름택시      -12,300  #체크카드
main  ago(23,12:00:41)  잔액채우기     +20,000  #이체     own: kbank → main
main  ago(21,08:10:00)  NH농협카드     -68,900  #자동이체
main  ago(18,19:55:21)  이서준        +30,000  #이체
main  ago(15,12:31:09)  소나무분식      -8,000  #체크카드
main  ago(12,20:14:37)  박하늘        -35,000  #이체     → 박하늘   memo "모임 회비"
main  ago(9,17:22:48)   최유나        -12,000  #이체     → 최유나
main  ago(6,13:10:05)   한빛편의점      -3,200  #체크카드
main  ago(4,21:40:16)   윤하람         +5,000  #이체
main  ago(2,18:02:55)   하늘카페        -6,100  #체크카드
main  ago(1,10:41:30)   김민지        -22,500  #이체     → 김민지
kpay  ago(70,09:12:10)  정다은        +50,000  #이체
kpay  ago(69,09:30:02)  카카오페이     -50,000  #자동이체
kpay  ago(40,14:02:33)  이서준        +30,007  #이체
kpay  ago(39,08:00:00)  카카오페이     -30,000  #자동이체
kpay  ago(27,16:48:20)  최유나       +150,000  #이체
kpay  ago(26,11:05:09)  김민지       -120,000  #이체     → 김민지
kpay  ago(24,19:31:47)  윤하람        -30,000  #이체     → 윤하람
kb    ago(84,10:02:31)  잔액채우기    -300,000  #이체     own (out side)
kb    ago(60,09:00:00)  (주)예시상사   +250,000  #이체
kb    ago(35,18:20:12)  예시전자     -180,000  #체크카드
kb    ago(10,12:44:51)  소나무마트     -45,000  #체크카드
kbank ago(50,22:10:30)  구름택시       -9,700  #체크카드
kbank ago(23,12:00:41)  잔액채우기     -20,000  #이체     own (out side)
kbank ago(8,10:15:00)   이서준        +18,000  #이체
```
Effects: main has 26 rows (11 in the last month, so 거래내역조회 scrolls and 3개월 needs a second page of 20). **kpay has exactly 3 rows in the last month
(입금 then two 출금 올원이체)**, the recorded structure, so the list's max scroll of 43 pt can be compared. 1일 잔여한도 shows 100만 on any day (no top-up today).

**Empty seed** `seedAlloneEmpty(d, userName)`: main only (NH페이모아통장, balance 0, limited 1), no other accounts, transactions, payees or hidden recents;
notice on. Both seeds clear `recent_hidden`.

### 2.4 Endpoints
**Reuse unchanged:** `GET /api/banks`, `GET/PATCH /api/profile` (name), `GET /api/accounts/:id`, `GET /api/accounts/:id/transactions?limit=500`
(filters, sort and paging client-side, after `balanceAfter` is computed), `PATCH /api/transactions/:id {memo}` (≤ 20, matches "메모 입력 (최대 20자)"),
payees CRUD and `PATCH /api/payees/:id {favorite}`, `GET /api/transfer/recipients?from=` (`recent` already excludes own accounts; `favorites`; `mine` excludes `from`),
`GET /api/transfer/lookup`, `POST /api/transfers` (transfers **and** top-ups; already writes out tx, in tx for own accounts and the transfers row atomically;
400 INSUFFICIENT_BALANCE is pre-checked on the client), `GET /api/transfers?from=` (today's top-ups for 1일 잔여한도), `POST /api/reset`, profiles.
`API_DELAY_MS` 250 sits inside every loading hold.

**Gated additive changes (foundation):**

| endpoint | allone change |
|---|---|
| `toAccount` | adds `limited: boolean` |
| `PATCH /api/accounts/:id` | also accepts `limited` (boolean) |
| `GET /api/home` | adds `ao: { notice: { on: boolean, items: [{title, when}] \| null } }` |
| `PATCH /api/profile` | also accepts `noticeOn` (boolean) and `noticeItems` (array of ≤ 5 `{title ≤ 30, when ≤ 40}` or null) |
| `GET /api/transactions/:id` | adds `ao: { accountId, payee: {id, favorite} \| null }` (payee = the payees row matching `transfer.bank.code + transfer.number`) |
| `POST /api/payees` | also accepts `favorite: true` |
| `GET /api/transfer/recipients` | `recent` drops rows whose `last_at <= recent_hidden.hidden_at`; a new transfer brings a row back |
| **new** `DELETE /api/transfer/recent?bank=&number=` | upserts `hidden_at = nowIso()`, returns 204 |

Not needed (decided): no `in_tx_id` lookup (the recorded 입금 detail shows no account rows, §6 R14), no new transaction query params (R15), no server limit
for 한도제한 or top-ups, no new tags. `KIND_BY_TAG` stays; "올원이체" is a client label.

### 2.5 Client-side rules (`src/allone/format.ts`, `api.ts`)
- **Type label:** `#이체` and amount < 0 → `올원이체`; `#이체` and amount > 0 → none (as recorded); `#체크카드` → `체크카드`; `#자동이체` → `자동이체`; `#예금이자` → `결산이자`.
- **Bank display name:** `nh` → `NH농협은행`, `kb` → `국민은행`; others = `BANKS.name`. Picker labels and order in `src/allone/bank.ts` (BANKS order with nh first).
- **Number formats:** own NH accounts hyphenated 3-4-4-2 on cards, the account block, T3, T5; raw digits in T1 rows, the T2 recipient line and the detail's 입금계좌;
  `NH농협은행(<LAST4>)` on T2.
- **Amount reading** (T2 caption, T7 caption): `N원` under 10,000, `N만 N,NNN원`, `N억 N,NNN만 N,NNN원`, zero parts dropped (`500만원`, `1만원`).
- **Validation:** T2 다음 enabled iff 0 < amount ≤ from balance and ≤ 5,000,000. T5: amount > 0, ≤ 출금가능금액, ≤ 5,000,000, ≤ 1일 잔여한도
  (1,000,000 − today's 잔액채우기 out-transactions from that source).
- **Range line:** 1주일 = −7 d; 1개월 / 3개월 / 6개월 = same day N months back, clamped to the month end; `to` = today.

### 2.6 🔔 관리 패널 (DevPanel) for allone
Generic bits are foundation (DevPanel.tsx, infra §2.18). The notice section is owned by the home area as `src/allone/home/NoticePanel.tsx`, mounted by
foundation in the 기본 tab under `ALLONE`.

| panel field | effect |
|---|---|
| 기본 → 이름 | home header `<NAME>님`, 전체메뉴 header, confirm "받는 분 통장 표시" default. 기기 and 테마 rows hidden |
| 기본 → 정기점검 안내: 보이기, page-1 items (2 × 제목 + 일시), 날짜 자동, 1일동안 안보기 지우기 | sheet visibility and copy (`PATCH /api/profile`); the snooze is a per-viewer localStorage value |
| 계좌 → 농협 계좌 추가 (`OWN_BANK.allone`: NH농협은행, placeholder NH페이모아통장, 13자리) | NH carousel, T1 내계좌, T6 |
| 계좌 → 다른 은행 계좌 추가 (`AddBankAccount exclude=[] withName`) | 다른금융 tab, T6 sources |
| 계좌 → 이름 (상품명), 번호, 잔액, **한도제한 표시** (`limited`), 삭제 (main protected: "대표계좌는 지울 수 없어요") | cards, lists, T2, T5 |
| 거래 → existing editor (거래처, 금액, 태그, 날짜, 메모) | 거래내역 rows, labels, detail, memo |
| 받는 분 → existing CRUD + ☆ | T1 최근 names, 자주, ☆, lookup |
| 되돌리기 → 예시 / 빈 상태 | both seeds |

After each save the panel invalidates `/api/home`, the affected account paths and recipients. `.dev-panel--allone` uses green #0c8f2d / pressed #0a7524.

---

## 3. Shared primitives and device chrome (foundation-owned; one owner file each)

### 3.1 Device chrome and z-order

| item | file | spec |
|---|---|---|
| frame 393 × 852, radius 55, Pretendard body | `src/styles/global.css` (add `html[data-app="allone"]` to the kakao2 rules) | infra §2.12 |
| bands + inset viewport | `PhoneFrame.tsx` + `src/allone/allone.css` | `.ao-band--top` 0–59 and `.ao-band--bottom` 818–852, white, z 1. `.phone__viewport { position:absolute; inset: var(--ao-top) 0 var(--ao-bottom) }` with `--ao-top: 59px; --ao-bottom: 34px` (safe-area insets at ≤ 500 px) |
| island + red dot | import `K2Island` as is | 107.2–279.4 × 11.0–48.3, dot Ø 12 at (125.7, 29.6), pulse 1500 ms (`BLINK_MS` gate). Optional: start-of-recording dot scale 1.31 → 1 over 550 ms (`ao-rec-start`) |
| status bar | `src/allone/StatusBar.tsx` (copy-adapt of `K2StatusBar`) | one 393 × 54 SVG at z 70. Clock "H:MM" Pretendard 600 16.2, **ink centred at x 60.0**, no indicator. Dual-SIM signal (4 columns × 3 wide at x 292.09 / 297.09 / 302.08 / 307.08; bars bottom 30.64, tops 26.64 / 25.98 / 24.31 / 22.65; dots 3 × 3.67 at y 31.97–35.64). LTE ink 316.07–334.39 × 24.98–34.30. Battery body 340.72–364.36 × 22.65–35.64, fill level/100, empty part fill-opacity .333, cap 365.36–366.69, number knocked out centred 352.54. Default battery 50 (`deviceStatus.ts`) |
| status fg override | `src/allone/statusFg.ts` | `setAoStatusFg(fg \| null, {iconsDelay, clockDelay, clockMs, easing})`. Default fg dark. Intro: light, then dark with the dissolve curve at D+33. T7: icons flip after 600 ms in one frame, clock after 667 ms over 100 ms; back to dark in one frame on close. T3: stays dark |
| home indicator | `src/allone/HomeIndicator.tsx` + `launch.ts` | 140 × 5, x 126.5–266.5, y 839–844, #000, r 2.5, only after launch (§3.4 table), keyed to `aoLaunchAt` |
| overlay (native layer) | `src/allone/Overlay.tsx` (`AlloneOverlay`, passed as PhoneFrame `overlay`) | z order inside `.phone`: viewport 0 · bands 1 · **web loading dim 51** (absolute 59–818) · native panel host 53 · toast 54 · native dims + sheets 55 · keyboard 56 · intro scene 57 · home indicator 58 · island 60 · status glyphs 70. Hosts `#ao-native` (`AoNativePortal`), the loading layer, the toast layer and the intro scene slot. Cuts dims, sheets, keyboard and toasts on restart and logout (toss Overlay pattern) |
| app icon + wordmark | `src/allone/ui/AppIcon.tsx`, `Wordmark.tsx` | green #0C8F2D continuous-corner squircle (radius 22.5 %), white "all NH one" wordmark from the `allone-wordmark.png` alpha mask via CSS `mask-image`; `pressed` palette #034913 / #919291. Used by AppBrand (Login, Picker, Admin), the intro scene and the spinner |
| Login / ProfilePicker | existing branches | white bg, green login button, status bg #ffffff; no Inset wrapper (the viewport is already inset) |

### 3.2 Tokens (`src/allone/allone.css`, `:root[data-app="allone"]`; never redefine global `--home-*`)
- **Surfaces:** `--ao-bg #ffffff` (home, lists, detail, transfer pages; infra's #fafcfd is wrong, R4), `--ao-line #eeeeee`, `--ao-line-2 #dcdcdc`,
  `--ao-line-3 #f5f5f5` (chips, tab base), `--ao-disabled #f5f5f5`, skeleton bars `#fcfbfe`.
- **Green:** `--ao-green #0c8f2d`; pressed `--ao-green-dark #004511` (detail 확인), `--ao-green-light #12a434` (web 잔액채우기 and T5/T1 web CTAs),
  `--ao-green-native #003e0e` (T2 다음, T7 확인); outlined pressed bg `--ao-green-tint #eafeee`; chip hash `#00831a`; notice title green `#008b1e`, dates `#00821f`;
  page dot `#0a902b`; spinner face `#1ac66d`, ring `#16b758`.
- **Other colours:** NH blue `#0052b3`; 출금 red `#e93535`; 입금 blue `#1a5dd9`; error `#ff0000`; 한도제한 `#e94848`; link `#555555`; star outline `#8f8f8f`,
  filled `#ffc31a`.
- **Text:** `#000`, `#141414`, `#3c3c3c`, `#4e4e4e`, `#4c4c4c`, `#666666`/`#686868`, `#808080`, `#898989`, `#9e9e9e`, `#bcbcbc` (amount placeholder).
- **Dims:** web loading `rgba(55,55,55,.68)`; deepen layer `rgba(0,0,0,.22)`; web sheet scrim `rgba(0,0,0,.30)`; native T7 `rgba(0,0,0,.765)`; native T3 `rgba(0,0,0,.733)`.
- **Type:** Pretendard Variable, weights 400/500/600/700/800, the area specs' fitted sizes and letter-spacing (they are Pretendard fits of a narrower face;
  do not round). `.ao-num { font-family: Roboto, Pretendard }` (400/500/700 via `@fontsource/roboto`).

### 3.3 Components (`src/allone/ui/`, re-exported from `src/allone/ui/index.ts`)

| file | export | spec source |
|---|---|---|
| `Page.tsx` | `AoPage` {header, footer, bodyRef, onScroll, bg}: white page in the web view, fixed header slot (50 pt, web y 0–50), scroll body, fixed footer slot | home §2.1, account §2.1, transfer §2.5 |
| `Header.tsx` | `AoHeader` variants: `nav` (‹ 9×16 stroke 1.4, centred title 16/700, home + menu-search icons; 거래내역조회), `close` (left title 16/600 at x 24, ×; 상세), `flow` (‹ 11.7×20.7 stroke 2, 취소 14.5/400 #838383; T1/T2/confirm), `modal` (centred title + ×; 잔액채우기 17.6/500, 통합검색 700 17.5). Home and 전체메뉴 headers are area-owned | account §2.1–2.2, transfer §2.1, §2.5, home §2.19 |
| `icons.tsx` | back chevrons (stroke prop), ×, ▾ (two sizes), ›, home, menu-search, globe, gear, bell, wallet, magnifier, ☆/★, ↻, ⌫ (pentagon and tag variants), keypad ←, check-circle, push-pin, NH symbol (ring + V), tab icons (outline and filled 홈) | all specs |
| `Button.tsx` | `AoButton` {variant: primary \| outline \| outlineGreen, disabled, pressed: dark \| light \| native, radius, height, size}. Disabled = #f5f5f5 fill (label colour per spec) | account §2.2, transfer §2.0 |
| `Sheet.tsx` | `AoSheet` (web, in-page): top radius 24, white, scrim .30 fading 300 ms `ease`; `enter: "rise" \| "pop"` (rise 291 ms `cubic-bezier(0,.11,.17,.87)`); `exit: "slide" \| "cut"` (150 ms); title + × slots | launch §2.10, transfer §2.6, §3.11 |
| `NativeSheet.tsx` | `AoNativeSheet` (portal to `#ao-native`): full-window dim `level: "amount" \| "password"`, `enter: "rise" \| "instant"` (357 ms `cubic-bezier(.19,.52,.23,1)`), exit slide ≈ 145 ms `cubic-bezier(.29,.19,.54,.75)` then dim lingers 370 ms (or instant), radius 24 / 20, `statusFg` option | transfer §2.4, §2.7, §3.13–3.14 |
| `NativePortal.tsx` | `AoNativePortal` (also used by the T2 keypad panel and the splash) | infra §1.4 |
| `Spinner.tsx` | `AoSpinner` {size = 61}: SVG glass coin (radial #1ac66d, ring #16b758, rim highlight, white wordmark mask 63 % of Ø) + CSS `rotateY` loop 1467 ms, `steps()` at 30 fps (keyframes launch §2.8) | launch §2.8 |
| `Loading.tsx` + `loading.ts` | the single owner of the web dim + spinner: `aoLoad(profile)` drives §1.4 (show, deepen, cut callback, spinner-first hide), `useAoLoadingVisible()`, `onAoLoadingHidden(cb)`, `cutAoLoading()` | launch §2.8, account §3, transfer §3 |
| `Keyboard.tsx` + `hangul.ts` (copy of `toss/transfer/hangul.ts`) | `AoKeyboard` {open, kind: "ko" \| "num", value, onChange, maxLength, onDone}: iOS 26 Korean 두벌식 (home §2.19 geometry, accessory bar ∧ ∨ ✓) and number pad (transfer §5.4), slide 290 ms `cubic-bezier(.2,.4,.2,1)` (`AO_KEYBOARD`; re-measured frame by frame, the first fit was 240 ms `cubic-bezier(.2,.8,.2,1)`), panel top 545 at rest, covers the bottom band, the web view does not resize; physical keys through a hidden `<input>` | home §2.19, transfer §5.4 |
| `BankLogo.tsx` | `AoBankLogo` {code, size = 36, radius?}: crop tile `allone-bank-<code>.png` for jb, shinhan, kakao, hana, kb, kbank, nh; others colour tile (BANKS colour) + `hana-bank-<code>` glyph as a white mask, else the short name. NH at 32 (home card) and 40 (account block) as SVG #0052b3 + white "NH": the measured 32 / 40 tiles are the same superellipse as the 36 one, so callers **omit `radius`** (it only exists to force a plain rounded rect) | infra §8, transfer §7, home §2.4, account §2.1 |
| `Toast.tsx` + `toast.ts` | `aoToast(text, {bottom})`: pill rgba(0,0,0,.80), white Pretendard 400 14.3, padding 12 × 20, r 22, centred, fade 200 ms, hold 2000 ms | transfer §5.3 (one style for every toast) |
| `Switch.tsx` | `AoSwitch` {size: "sm" 28×18 (잔액 숨기기) \| "lg" 52×30.6 (자동완성)}, off #6d6d6d / on #0c8f2d, knob slide 150 / 250 ms | account §2.1, home §2.19 |
| `Skeleton.tsx` | bars `#fcfbfe` radius 8 (home only uses it; foundation owns the primitive) | home §2.17 |
| `AppIcon.tsx`, `Wordmark.tsx` | §3.1 | launch §2.1 |

Top-level modules in `src/allone/`: `routes.tsx`, `nav.ts` (`useAoGo`, `useAoBack`, `goHome`, depth helpers, `LOAD` table §1.4), `flow.ts` (§3.5), `api.ts`
(types `AoAccount`, `AoHome`, `AoTxDetail`; paths and fetchers), `format.ts` (§2.5), `bank.ts`, `prefs.ts` (per-profile localStorage with try/catch, kbank pattern:
notice snooze, hidden balances, recent menus, 자동완성, 잔액 숨기기, 큰글), `statusFg.ts`, `launch.ts`, `intro.ts` (glue called by `recorder.ts`), `StatusBar.tsx`,
`HomeIndicator.tsx`, `Overlay.tsx`, `allone.css`.

### 3.4 Motion constants (`src/allone/motion.ts`, measured unless marked)

| constant | value | evidence |
|---|---|---|
| press (intro) | palette swap in one frame; release un-darken 100 ms ease-out | C1 0.650, 0.917 |
| dissolve | 250 ms, `linear()` §1.1; status glyphs +33 ms same curve | C1 0.900–1.183 |
| home indicator opacity (from D) | +250 .41 · +300 .45 · +350 .49 · +400 .60 · +450 .72 · +500 .85 · +550 .88 · +600 .91 · +650 .94 · +700 .97 · +750–850 1 · +900 .85 · +950 .64 · +1000 .40 · +1050 .19 · +1100 0 | C1 1.15–2.00 |
| white launch hold | 1.20 s after the dissolve (splash fade at D + 1450) | C1 (dialog removed) |
| splash fade / hold | 267 ms `linear()` §1.1 / 2383 ms | C1 3.400–6.050 |
| splash → PIN | 167 ms crossfade, keypad +117 ms | C1 6.050–6.333 |
| PIN digit | dot replaces bar in one frame; 6th → +67 ms loading | C1 7.617–9.917 |
| spinner loop | 1467 ms at 30 fps, phase-locked to onset | C1 9.95–11.42 |
| web dim | one frame on and off; spinner off 33 ms earlier (517 → 650 on `cancelHome`) | §8 |
| deepen | +.22 black, 280 ms (detail) / 300 ms (topup link) ease-out | C2 14.29, C3 1.896 |
| web sheet | scrim 300 ms `ease`; rise 291 ms `cubic-bezier(0,.11,.17,.87)`; slide down 150 ms (invented) | C3 2.879–3.196 |
| notice sheet | pop (no slide) with the scrim's first frame, +583 ms after dim off; close in one frame | C1 12.733, 13.833 |
| T2 panel in / out | 150 ms `cubic-bezier(.31,.18,.55,.89)` starting 33–50 ms after the cut / 153 ms `cubic-bezier(.39,.03,.70,.92)` | C3 28.988–29.146, 1.892–2.046 |
| T7 | rise 357 ms `cubic-bezier(.19,.52,.23,1)` from +64 after dim; close ≈ 145 ms `cubic-bezier(.29,.19,.54,.75)`; dim lingers 370 ms; digit roll −30 pt → 0, opacity .1 → .3, 250 ms linear, then solid | C3 5.643–8.246, 10.746–11.03 |
| T3 | appears and leaves in one frame; 4th digit +50 ms | C3 31.129, 32.729 |
| keyboard | in 290 ms `cubic-bezier(.2,.4,.2,1)` (rms 2 pt per frame), out 250 ms (invented); panel top 545 at rest | C3 41.146–41.513, rest C3 41.80 |
| tab bar | hide on the first frame off the top, 440 ms ease-in-out to +135; show at the top after 80 ms, 650 ms `cubic-bezier(.2,.9,.3,1)`; at the bottom after a 200 ms debounce, 300 ms ease-out to **+14** | C1 14.533, C2 3.94–4.60, 2.558–2.858 |
| card carousel | snap ≈ 250 ms ease-out (350 total with the flick); unseen-card loading body 420 ms; rubber-band 450 ms | C2 4.441–4.858, C3 24.96–25.51 |
| ticker | period 2500; old text off in one frame; icon fade 150; first char +217; then one non-space char per 67 ms | C2 5.374–6.124 |
| ad carousel | 4000 ms (invented interval), slide 180 ms ease-out | C2 0.72–0.86 |
| skeleton | +0 / +150 / +350 / +550 after dim off | C1 12.15–12.70 |
| switches | 자동완성 colour in one frame, knob 250 ms; 큰글 knob 200 ms (invented) | C3 40.563–40.81 |
| toast | fade 200, hold 2000 | invented |

### 3.5 Cross-area contracts (`src/allone/flow.ts`, `nav.ts`, `loading.ts`, `prefs.ts`)
Areas never import another area's files. They call:
- `useAoFlow()` → `goHistory(accountId, via?)`, `goTx(txId, direction)`, `goSend({from, origin, via})`, `goAmount({from, to:{bankCode, number, holder}, replace?, via})`,
  `goTopup({to, from?, origin})`, `goMenu()`, `goSearch()`, `goHome()`, `goHomeFresh()`, `sendFinish()`. `via` names the §1.4 profile.
- `useAoHomeFresh(cb)` (home subscribes), `onAoLoadingHidden(cb)` (notice timing), `aoVisit(menuKey)` (screens record visits for 최근 이용메뉴).
- `setAoStatusFg()`, `aoToast()`, `AoNativePortal`, `AoKeyboard`.
- `launch/intro.ts` (launch area) must export `showAlloneScene(): void` and `playAlloneIntro(opts: { onStart(): void }): Promise<void>`;
  `launch/AlloneSplash.tsx` exports `AlloneSplash({ onDone })`. Foundation creates stubs with these signatures.
- After any successful transfer or top-up: `invalidate` home, both accounts, their transactions, recipients and `/api/transfers?from=`.

---

## 4. Build split

### 4.1 Foundation (sequential; lands before the areas start)
Each item is gated so the other 9 servers render and respond byte-identically. Order:
1. **Server plumbing** (§2.1): `db.mjs` APPS / INTRO_APPS / error text; `index.mjs` port, title, DELETE map, `POST /api/accounts` lines; `.gitignore`.
2. **Schema** (§2.2) and **seeds** (`server/allone-seed.mjs`, §2.3, with `ago()`), `SEEDS.allone`. First boot, new profile and reset must not crash.
3. **Gated endpoint changes** (§2.4 table) including `DELETE /api/transfer/recent`.
4. **Client plumbing:** `session.ts` (`AppName`, parse, `APP_NAME.allone = "올원뱅크"`, `ALLONE`), `vite-env.d.ts`, `.env.allone` (`VITE_APP=allone`, `VITE_INTRO=1`),
   `package.json` `dev:allone` / `start:allone`, `vite.config.ts` proxy `allone: 'http://localhost:8796'`.
5. **Locks:** `platform.ts` DEVICE_LOCK ios; `theme.ts` light (`lightOnly`, `THEME_LOCK`, `THEME_CHOICE`); `intro.ts` `INTRO_OS` ios and `BLINK_MS` 1500;
   `deviceStatus.ts` battery 50; `ProfilePicker` os/theme lock with `KAKAO2 || TOSS || ALLONE`; DevPanel 기기 row hidden.
6. **Device chrome** (§3.1): global.css frame/radius/font/mobile; PhoneFrame island, `AlloneStatusBar`, bands, inset viewport, `AlloneHomeIndicator`;
   Login/Picker bg and `.login--allone` / `.picker--allone` CSS; AppBrand → `AlloneAppIcon`.
7. **ScreenStack** allone branch (no animation, no drag, `canSwipe` off).
8. **App.tsx:** `renderAlloneRoute` in ROUTES, overlay `allone: <AlloneOverlay/>`, splash chain `APP === "allone" ? <AlloneSplash onDone={toReady}/>`,
   launch anchor at boot "splash".
9. **Intro wiring (no video asset):** `recorder.ts` line 193 snap `|| ALLONE`; a drawn-intro branch next to `playIbkIntro`: on RESTART "off" call `showAlloneScene()`
   and wait a frame so the first recorded frame is the scene; after `started` + one frame start `keepCapturing(target)`, `syncBlink`, then
   `await playAlloneIntro({ onStart: () => dispatch RESTART "start" })`. Wait for fonts and the wordmark mask before `recorder.start()`.
   The video `IntroCfg` path stays untouched.
10. **Intro asset pipeline:** `scripts/allone-crops/shared.py` builds `allone-wordmark.png` (white alpha mask: average C1 3.75–6.00 s, wordmark box §5.2,
    ESRGAN ×4, colour-key the green and blue letters, 4 px/pt) and the seven `allone-bank-<code>.png` tiles. The scene itself is CSS/SVG (launch area).
    Add a check to the verify step: the intro scene loads no raster except `allone-wordmark.png`.
11. **Shared modules and `ui/*`** (§3.3), `allone.css` tokens and `ao-` keyframes, `motion.ts`, `nav.ts`, `flow.ts`, `loading.ts`, `statusFg.ts`, `prefs.ts`, `api.ts`.
12. **Stubs:** one stub per route and per contract export in the owning area folder (`launch/AlloneSplash.tsx`, `launch/intro.ts`, `home/Home.tsx`, `home/Menu.tsx`,
    `home/Search.tsx`, `home/NoticePanel.tsx`, `account/History.tsx`, `account/TxDetail.tsx`, `transfer/SendWho.tsx`, `SendAmount.tsx`, `SendConfirm.tsx`,
    `SendDone.tsx`, `Topup.tsx`), so `routes.tsx` type-checks. A `/dev/ui` gallery of the primitives is allowed (toss precedent).
13. **DevPanel generic bits** (§2.6): `OWN_BANK.allone`, `ownBank()` / AddPayee chains, both add forms, `ownHint` / `freeNumber`, 한도제한 toggle, NoticePanel mount,
    `.dev-panel--allone`.
14. **Verify:** `npx tsc -p tsconfig.app.json --noEmit`, `npm run build` (into a scratch outDir), oxlint vs baseline. Boot allone on scratch ports (suggested API 8951,
    web 5351): profile → splash stub → home stub; API smoke on every §2.4 row; ● 녹화 with the intro stub. **Other 9 apps unchanged**: baseline worktree at the
    current HEAD, the kakao2 46-request API diff for all server ids, and screenshots of each app's home. grep `APP ===`, `APP !==`, `[APP]`, `KAKAO2 ||`, `TOSS ?`
    across `src/` and `server/` for missed chains (infra §3).

### 4.2 Parallel areas (strict ownership)

| area | owns (create and edit freely) | routes / exports | class / asset prefix, script | consumes |
|---|---|---|---|---|
| **A1 launch** | `src/allone/launch/**`: drawn iPhone home scene, intro timeline, `AlloneSplash` (white → splash → PIN), PIN page + shuffled secure keypad, login loading call | boot chain; `showAlloneScene`, `playAlloneIntro`, `AlloneSplash` | `ao-ln-`; `allone-launch-*`; `scripts/allone-crops/launch.py` | `AppIcon`, `Spinner`/`loading` (`login` profile), `statusFg`, `launch.ts`, `AoNativePortal`, `prefetch(/api/home)` |
| **A2 home** | `src/allone/home/**`: Home (header, banner, NH농협/다른금융 tabs, carousel + cards, ad, ticker, quick menu, sections, tab bar, 내 자산 확인 pill, skeleton), 정기점검 sheet, 전체메뉴, 통합검색, `content.ts` (static copy, menu catalog, 인기 검색어), `NoticePanel.tsx` | `/`, `/menu`, `/search` | `ao-home-`; `allone-home-*`; `scripts/allone-crops/home.py` | `/api/home` (+ `ao.notice`), `PATCH /api/profile`, flow helpers, `AoSheet`, `AoKeyboard`, `AoBankLogo`, `aoToast`, `prefs`, `useAoHomeFresh`, `onAoLoadingHidden` |
| **A3 account** | `src/allone/account/**`: 거래내역조회 (sticky block, filter row, range + 잔액 숨기기, rows, client filter/sort/paging), 계좌 선택 and 조회 조건 sheets, 거래내역 상세 (memo, ☆, 다시보내기) | `/history/:accountId`, `/tx/:txId` | `ao-acct-`; no crops | accounts, transactions, tx detail `ao`, memo PATCH, payees PATCH/POST, `AoHeader`, `AoSheet`, `AoKeyboard`, `AoSwitch`, `AoButton`, `goSend`, `goAmount` |
| **A4 transfer** | `src/allone/transfer/**`: T1 (tabs, rows, ☆, 삭제하기, number input, bank sheet), T2 (amount, native panel, chips, validation, account sheet), T3 password sheet, confirm, done, T5 잔액채우기, T6, T7 (digit roll) | `/send`, `/send/amount`, `/send/confirm`, `/send/done`, `/topup` | `ao-send-`; none (bank tiles are foundation) | recipients, lookup, transfers, payees, recent hide, `/api/home`, `/api/transfers?from=`, `AoNativeSheet`, `AoNativePortal`, `AoSheet`, `AoKeyboard`, `AoBankLogo`, `aoToast`, `statusFg`, `sendFinish`, `goHomeFresh` |

**Rules:**
- **Frozen during the parallel phase:** `src/allone/*.ts(x)`, `src/allone/ui/**`, `allone.css`, `motion.ts`, all server files, `DevPanel.tsx`, `PhoneFrame`, `ScreenStack`,
  `App.tsx`, `recorder.ts`, `global.css`, `session.ts` and the lock files. An area that needs a change wraps locally and lists a **change request** in its hand-off.
- **No cross-area imports.** Navigate by path and `flow.ts` helpers only.
- **Naming:** classes and keyframes use the area prefix; assets use the area's `allone-` prefix. Keypads are area-owned (PIN in A1; amount panel, T7 and T3 pads in A4)
  and share only `applyKey` from `src/lib/keypad.ts` and an inline Fisher–Yates shuffle.
- **Data:** areas do not change seeds or endpoints. Missing data → degrade gracefully and record a change request.
- **Crops:** `scripts/allone-crops/*.py` import `keep_assets` (no overwrite without `--force`), use `--out` to a scratch folder first, and every crop is opened
  and inspected before it is moved into `src/assets/local/`.
- **Verify ports** (suggested): A1 8952/5352, A2 8953/5353, A3 8954/5354, A4 8955/5355. Stop servers when done.

### 4.3 Integration step (after the merge)
1. Apply change requests. 2. Cross-flow runs (§7.6). 3. Fast-tap and mid-loading stress (double pushes, back during a dim, restart during a native sheet).
4. Profiles: example, empty, new. 5. Mobile viewport (≤ 500 px: bands = safe-area insets, fake chrome hidden). 6. Other-app regression again.
7. Docs: README "## 🍀 NH올원뱅크 allone (아이폰 · 녹화 인트로)" plus the dev, VPS, port, data-folder and switch-row lines; SOLUTION.md section after toss
   (INTRO_APPS, app id vs bank code, the 59/34 band model and the two dim families, status-fg override, why the intro is drawn, cuts + loading profiles, measured chrome).
8. Privacy pass (§7 method). Nothing is committed by the build agents.

---

## 5. Assets

### 5.1 Method
- Frames: `ffmpeg -ss <pts> -i <clip> -frames:v 1` (first frame with pts ≥ t) or an average over a static range (median-filtered, toss `averaged()` pattern).
- Upscale: Real-ESRGAN ×4 via `scripts/ibk-crops/esrgan.py` with `RealESRGAN_x4plus_anime_6B.pth` (a copy is at
  `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/esrgan/RealESRGAN_x4plus_anime_6B.pth`; torch 2.15 CPU is installed),
  back-project, key out the background, mask squircles, downscale to **4 px/pt**. Source density is 3 px/pt.
- Full-screen photographic art (the splash) is **not** upscaled: averaged frame saved at native 3 px/pt as WebP q90.
- Names: `allone-<area>-<thing>.(png|webp)`. Outputs print their ink box in pt so the CSS can place them.

### 5.2 Foundation (`scripts/allone-crops/shared.py`)

| asset | clip @ pts | px box (x0, y0, x1, y1) | method | privacy |
|---|---|---|---|---|
| `allone-wordmark.png` (white alpha mask "all NH one") | C1 avg 3.75–6.00 | 410, 704, 770, 968 (ink 138.9–254.5 × 235.8–321.1 pt) | ESRGAN ×4, colour-key letters off white, union mask | OK (public brand mark; splash centre) |
| `allone-bank-jb`, `-shinhan`, `-kakao`, `-hana` (36 pt squircles) | C3 27.500 | x 72–180; y 1710–1818 / 1900–2008 / 2088–2196 / 2278–2386 | ESRGAN ×4, squircle mask r ≈ 11 pt, 144 px | OK: logo only, text starts at px 212 (checked this pass) |
| `allone-bank-kb`, `-kbank`, `-nh` | C3 4.500 | x 72–180; y 1582–1690 / 1771–1879 / 1960–2068 | same | OK (checked this pass) |
| app icon | — | — | `AppIcon.tsx` (CSS squircle + wordmark mask); no App Store download | OK |
| spinner | — | — | SVG + CSS (no sprite) | OK |
| dual-SIM glyph, status bar, home indicator | — | — | SVG / CSS | OK |

### 5.3 Launch (A1, `scripts/allone-crops/launch.py`)

| asset | clip @ pts | px box | method | privacy |
|---|---|---|---|---|
| `allone-launch-splash.webp` | C1 avg 3.75–6.00 (135 frames) | 0, 177, 1180, 2556 (59–852 pt) | average, WebP q90 at 3 px/pt, placed at y 59 in the native layer (it covers the bottom band) | OK: status band excluded, no personal content |
| `allone-launch-pin-title.png` ("NH올원뱅크" logotype, white mask) | C1 avg 6.40–7.50 | 430, 214, 750, 287 | un-premultiply over #0C8F2D, ESRGAN ×4, 4 px/pt | OK |
| drawn: wallpaper gradient, folder/app/dock icons, search pill, dock glass, globe, menu-search, check-circle, ↻, ⌫ | — | — | CSS / SVG (launch §2.1, §2.7) | OK: nothing from C1 0–1.15 s |

### 5.4 Home (A2, `scripts/allone-crops/home.py`; boxes are x, y, w, h px as in home §7)

| asset | clip @ pts | box | privacy |
|---|---|---|---|
| banner heart + P coins | C3 @25.750 | 850, 450, 231, 198 | OK |
| ticker flame / P-coin hand / money bag | C1 @14.767 / C1 @15.433 / C2 @3.624 | 132,1042,99,123 / 129,435,105,117 / 132,1036,99,129 | OK |
| quick menu × 8 | C1 @14.767 | row 1 y 1360 h 99, x 168 / 417 / 667 / 916 (w 99 / 99 / 102 / 102); row 2 y 1606, same x | OK |
| 내 모임 passbook | C2 @0.408 | 787, 1459, 318, 330 | OK |
| ad slide 2 hand + money | C2 @1.208 | 775, 730, 300, 213 | OK |
| 금융일정 calendar / 내 소비 mart | C2 @1.208 | 799,1309,270,258 / 871,1826,192,258 | OK |
| 내 자산 money bag | C2 @1.608 | 871, 1417, 180, 183 | OK |
| 생활자산 car tile / insurance tile | C2 @2.008 | 210,1597,204,204 / 742,1597,204,204 (squircle mask) | OK |
| NH금융그룹 × 6 | C2 @2.408 | 402,754,114,111 / 949,766,114,84 / 402,1204,114,114 / 952,1204,108,114 / 402,1657,111,114 / 949,1666,114,96 | OK |
| 전체메뉴 NH지갑 / 인증·보안 / 고객센터 / 이벤트 | C3 @39.750 | 162,558,87,93 / 423,558,90,93 / 688,558,93,93 / 952,558,99,93 | OK |
| 전체메뉴 AI톡 tile | C3 @39.750 | 970, 345, 156, 156 | OK |
| 🍀 in the 오늘 운세 bubble | C3 @25.750 | 241, 343, 39, 50 | OK |
| 정기점검 bell | C1 avg 12.80–13.80 | 880, 1880, 210, 210 | OK (opaque white sheet) |
| **invented, drawn:** ad slide 1 (replaces the celebrity card), slide 3, 생활자산 card 3 (헬스케어), the ad block under the cards (replaces the 대법원 ad, same geometry), 메뉴설정 dashed +, all header/tab/menu icons, pill, glow | — | — | OK |

### 5.5 Account (A3) and transfer (A4)
No crops. Everything is SVG/CSS (account §2.3, transfer §7). Bank tiles come from `AoBankLogo`. The NH symbol for the T3 dummy keys is SVG (#D4D4D8, 19 × 18).

### 5.6 Never crop
Anything from C1 0–1.15 s (home screen: wallpaper, apps, badges); the status band of any frame; header names; account cards, numbers, balances; list rows,
detail cards, T1 rows' text, T2/T3/T5/T6/T7 text; 최근 이용메뉴 rows; the celebrity ad slide; frames under a dim (for the spinner); anything in an excluded range.

---

## 6. Contradictions resolved and open questions

### 6.1 Resolved contradictions

| # | topic | specs | resolution (evidence) |
|---|---|---|---|
| R1 | App open | infra: white window zooms from the icon in 233 ms · launch: uniform dissolve 250 ms | **dissolve**. This pass: per-block white alpha over a 6 × 4 grid is uniform at C1 0.950 (.04), 1.000 (.19–.24), 1.050 (.45–.57), 1.100 (.77–.93); a zoom would show a rect at 1 and the rest at 0 |
| R2 | Web loading dim | account: rgba(0,0,0,.53) · launch: rgba(55,55,55,.68) · infra: rgba(56,56,59,.70) | **rgba(55,55,55,.68)**. This pass: C2 8.800 → 9.500 grey 141 → 82 and white 255 → 118 (k .316, c 37.4); C1 10.600 PIN green → (45, 80, 55). Black .53 would give 141 → 66 and green → (6, 67, 21) |
| R3 | Detail deepen | account: .53 → .61–.64 · infra: luma → 90–96 | same thing: a second rgba(0,0,0,.22) layer, 280 ms ease-out |
| R4 | Page background | infra --ao-bg #fafcfd · home #fff | **#fff** (this pass: C2 7.000 at 7 points = 255; #f8fefd only inside the mint glow) |
| R5 | Bottom of the web view | launch 817.3 · infra 818.0 | same pixel row (y-conversion convention); **818** |
| R6 | Header band | account: status 0–54, nav 54–114 | **header 59–109** (web y 0–50, centre 84); the 거래내역조회 sticky block runs 59–203 |
| R7 | Dim on 취소 → home | home: fades in 130 ms · transfer/launch: one frame | **one frame** (this pass: C3 21.613 page point 255 → 119 in one frame; the slower point was under the native panel sliding away) |
| R8 | Labels | brief: 관리, 포인트받기, 공과금·세금, 올원사랑나눔+ | home.md: **큰글**, **포인트쌓기**, **공과금/채권**, **올원사장님+**, 이체/출금 (this pass: crops of the tab bar, header right and rail) |
| R9 | Clock centre | infra 60.2 · launch 59.8 | **60.0** (different digits per frame) |
| R10 | Home indicator | infra 139.6 × 5 at 839–844, fade-out by +1066 · launch 140.2 × 5 at 838.3–843.3, table | 140 × 5 at 839–844 with launch's opacity table (both fade to 0 at ≈ 2.0 s) |
| R11 | White launch hold | infra 1.1 s · launch 1.20 s | **1.20 s** (splash showed 67 ms after the removed dialog) |
| R12 | Recorder wiring | infra: `keepCapturing` · launch: not needed | keep `keepCapturing` (static scene; kakao2 lesson) and wait for fonts and the mask before recording |
| R13 | 한도제한 storage | home: seed `badge` is enough · infra: migrate clears it | **gated `limited` column** (`db.mjs:172` clears `badge` for kind main on every DB open; checked) |
| R14 | Detail server fields | infra: `in_tx_id` lookup · account: `fromAccount`, `payee`, `canResend` | **`ao: {accountId, payee}`** only. 출금계좌 = the owning account (client), canResend = client, the recorded 입금 detail shows no account rows |
| R15 | List filters | account: new query params | **client-side** (endpoint returns ≤ 500 rows, `balanceAfter` already correct) |
| R16 | "준비 중인 서비스예요" toasts | account, transfer | **silent no-op** (SOLUTION 22; toss R17) |
| R17 | Green pressed colour | #004511 (detail 확인) · #12A434 (web 잔액채우기) · #003E0E (native) | all three kept, per instance (`AoButton pressed`) |
| R18 | Keyboard owner | home (search), transfer (inputs), account (memo) | **foundation `AoKeyboard`** |
| R19 | Spinner | account 60 at (196, 425) · launch Ø 61 at (196.5, 425.8) | **Ø 61 at (196.5, 425.8)**, screen-centred |
| R20 | Loading holds | per spec | one table (§1.4), `max(api, hold)` |
| R21 | Which account is main | account: 카카오페이통장 · transfer: "main small, 페이모아 moderate" · home: card 1 페이모아 | **main = 페이모아 (card 1, small 4-digit)**, kpay second with 1 digit (§2.3) |
| R22 | Digit fonts | launch PIN digits Pretendard 500 · transfer amounts Roboto | both as measured; Roboto only via `.ao-num` |
| R23 | Bank tiles | infra: hana glyph recolour · transfer: crops | **crops** for the 7 seen banks (clean, checked), recolour fallback for the rest |
| R24 | Toast styles | home r 8 · account pill · transfer pill r 22 | one style (transfer) |
| R25 | Notice timing | launch 500 ms · home +583 | **+583 ms** after dim off (login), same rule on fresh re-entries |
| R26 | Sheet scrim | infra .30–.35 · launch/transfer .30 | **.30** |
| R27 | 다른금융 거래내역 | home: no-op | open `/history/:id` (built screen) |
| R28 | Menu ≡ loading | home: spinner without dim | kept as `menu` profile |
| R29 | 올원이체 label | infra: client or server | client mapping (§2.5) |
| R30 | Title | — | "올원뱅크 클론 연습" (matches APP_NAME) |
| R31 | Intro dot | launch: enlarged at start | optional `ao-rec-start` (foundation CSS) |

### 6.2 Open questions, each with the chosen default (no questions to the user)

| # | question | default |
|---|---|---|
| Q1 | Intro timing (infra Q1) | recorded: idle 0.65 s, press 0.25 s, dissolve 0.25 s, white 1.20 s (splash at 2.35 s) |
| Q2 | Edge swipe-back (infra Q2) | disabled |
| Q3 | Scene filler icons (infra Q3, launch Q3) | neutral own SVGs: a folder "금융" (pastel mini tiles, no logos), two generic apps labelled "메모장" and "날씨", four unlabelled dock glyphs (handset, bubble, compass, note); no badges, no repo clone icons |
| Q4 | Page title (infra Q4) | "올원뱅크 클론 연습" |
| Q5 | 한도제한 / 1회 한도 / 1일 잔여한도 (infra Q5, transfer Q1–Q2) | display constants + client checks; tag display-only; no `NH_DAILY_LIMIT` reuse |
| Q6 | 올원이체 (infra Q6) | client mapping |
| Q7 | Font (infra Q7, transfer Q5) | Pretendard; Roboto on `.ao-num` |
| Q8 | Blue faceted bank mark | 전북은행 `jb` (row text per transfer.md; tile checked) |
| Q9 | Spinner fidelity (launch Q2) | SVG coin + CSS rotateY; no sprite |
| Q10 | Notice pages 2–5, auto-advance (launch Q4) | invented neutral notices (앱 업데이트 안내, 고객센터 운영시간 안내, 개인정보처리방침 개정 안내, 이벤트 안내) with the same bell; 4 s auto-advance, 300 ms slide, swipe, pause ↔ play |
| Q11 | Notice trigger (launch Q5) | every fresh spinner-loaded home entry (login, `goHomeFresh`, `sendFinish` to home); never on a plain pop; not while snoozed or off |
| Q12 | Band model (launch Q6) | adopted: 59 / 34 white bands (§0.2) |
| Q13 | Login loading minimum (launch Q7) | always 2.233 s |
| Q14 | PIN after 로그아웃 (launch Q8, home Q4) | 로그아웃 is a no-op; PIN only on cold start |
| Q15 | Tab bar +14 at the bottom (home Q2) | reproduce |
| Q16 | 대법원 ad (home Q3) | replace with an invented NH promo of the same geometry (no third-party or government ad in the clone) |
| Q17 | 다른금융 content (home Q5) | other-bank accounts in the card layout with 잔액채우기 / 거래내역; empty card "다른 금융기관 계좌를 연결해 보세요" + 계좌등록 (no-op) |
| Q18 | 32 pt first-paint jump on 거래내역조회 (account Q1) | not reproduced (WebView artefact, like the C1 6.183 / 6.200 glitch frames) |
| Q19 | Loading holds (account Q2) | recorded values with `max(api, hold)` |
| Q20 | Type labels beyond the recording (account Q3) | §2.5 mapping |
| Q21 | 잔액 숨기기 scope (account Q4) | per-row balance lines only; rows become 95 tall |
| Q22 | VARIANT of nh vs new APP (account Q5) | new APP (task decision) |
| Q23 | Filled star, 다시보내기 target (account Q6) | #FFC31A fill + stroke; 다시보내기 → T2 prefilled (replace), back → list |
| Q24 | 삭제하기 storage (transfer Q3) | server `recent_hidden` (cleared by reset) |
| Q25 | Order after 다음 (transfer Q4) | password → loading 483 → 이체 확인 → 보내기 → 완료 (the recording shows the password right after 다음) |
| Q26 | Notice text editing | server profile fields (§2.2) edited in the DevPanel; snooze stays per viewer |
| Q27 | 계좌관리 sheet (account §5.6) | no-op (only 복사 would work; not worth an invented sheet) |
| Q28 | Paging footer | client paging 20 rows; footer spinner (AoSpinner 28) for 300 ms when a page is appended |

---

## 7. Acceptance checks (the reviewer compares against the clips)

**Method.**
- Playwright, viewport 393 × 852, `deviceScaleFactor: 3` → 1179 × 2556 screenshots (ignore the clip's 1180th column). Clock and battery frozen to a look-alike
  (battery 50). Use the example seed.
- Compare against the listed frames side by side and as a 50 % overlay or difference. **Mask every region that holds personal data in the reference**
  (names, numbers, balances, amounts, dates, the status-bar clock digits, the home-screen scene content).
- Tolerances: geometry ±1 pt (±0.5 pt for text baselines in headers and the status bar); colours ±3 per channel (±5 on saturated greens, which the video compresses);
  durations ±1 frame (16.7 ms) for measured motion, ±1 frame for loading holds (with the 250 ms API delay inside the hold).
- Motion is checked with rAF-timed captures against §1.4 / §3.4.
- **Privacy:** grep the diff and every new text file for non-UI strings; open every committed PNG/WebP; confirm none comes from §5.6; confirm no excluded
  screen, copy or error code exists anywhere (`grep -r "이의제기\|통신사기피해" src server` must stay empty for allone files).

### 7.1 Foundation
1. tsc, build and lint clean; `dev:allone` boots; `server/data-allone/` appears; example and empty seeds load; reset works; new profile works.
2. Other 9 servers byte-identical (API diff, home screenshots).
3. Bands: C2 9.500 under the dim: web view luma 118 ±3, rows 0–176 and 2454–2555 px stay 255. Under T7 (C3 6.5): the whole window ≈ 60 incl. the status band,
   red dot unaffected.
4. Status bar vs C1 7.333 (mask the digits): clock ink centre x 60.0 ±0.5, signal/LTE/battery x positions §3.1 ±0.3, battery fill = level / 100.
5. Island and dot vs C1 0–9.8: geometry ±0.5, pulse 1500 ms.
6. Dim levels: white → 118, green #0C8F2D → (45, 80, 55) ±4; deepen white → 92 ±4 after 280 ms; scrim white → 178 ±3; T7 dim luma 60, T3 68.
7. Spinner centre (196.5, 425.8) ±1, Ø 61, loop 1467 ms, face at onset.
8. Status-fg flip under T7: icons at +600 ms in one frame, clock +667 → +767 (C3 5.579 / 6.179 / 6.246–6.346).
9. Keyboard vs C3 41.80 (at rest; at 41.40 the panel is still settling at ≈ 547.7): panel top 545, key rows §home 2.19 ±1, slide 290 ms `cubic-bezier(.2,.4,.2,1)` (41.146–41.513).
10. Recording with ● 녹화 (intro on): the first frame is the drawn scene (no black), width stays 393 pt (no 392/394 jitter), no raster in the scene except the wordmark.

### 7.2 Launch (A1)
- Scene geometry vs C1 0.600 (positions only; content masked): icons 64 at x 28.7 / 119.6 / 210.5 / 301.4, top 80.0; labels ink 150.5–160.9; search pill
  167.9–225.1 × 682.1–711.4; dock 12.0–380.3 × 730.0–838.6 r 40; dock icons top 752.7, lefts 34.6 + 86.9·i.
- Press at +650 (one frame, palette #034913 / #919291, no scale). Dissolve +900 → +1150 against the alpha list (±.03 per frame, uniform over the screen).
  Status glyphs +33 ms behind. Home indicator table ±.05.
- Splash vs the C1 3.75–6.00 average below y 59: mean abs diff < 4 levels; fade curve at clone 2.350–2.617 (±.03); hold to 5.000.
- Crossfade 5.000–5.167; keypad pops at 5.283 with the links row jumping 769.4 → 460.9.
- PIN page vs C1 7.333 (mask dots and digits): bands, title mask, prompt, slots (25.6 × 1.33 at y 261.8, pitch 30), 자동로그인, links, keypad grid (columns 131,
  rows 543.8 / 621.7 / 699.4 / 777.5), ↻ / ⌫ ink boxes. Keypad permutation fixed between presses; ↻ reshuffles; no pressed state; dot replaces bar in one frame.
- 6th digit → +67 ms dim + spinner, keypad gone in the same frame; home under the dim at +2.033; spinner off +2.183; dim off +2.233.
- **Safety:** nothing about the PIN reaches the network, storage or console (Playwright request log + storage dump after entering 6 digits).

### 7.3 Home (A2)
- Top state vs **C2 7.000** (mask name, number, balance): header 59–108 (큰글 pill, icons), bubble, banner 134.9–227.1, tabs + pager, card 293–515
  (anatomy home §2.4), ad block, 오늘의 혜택, ticker, tab bar 743–818, pill 685.3–725.3.
- Full page vs `frames/home/long_full.png`: section y map (home §2.1) ±1, content height 2929, max scrollTop 2170 ±2.
- Tab bar: hide starts on the first scroll frame (C1 14.533), 440 ms to +135; top return 650 ms (C2 3.94–4.60); bottom rest +14 (C2 2.558–2.858), no pill there;
  no return on a mid-page scroll-up.
- Carousel: swipe 1 → 2 (C2 4.441–4.791), pager updates at the snap start, unseen card shows "상품명을 조회 중이에요 / 조회 중입니다" ≈ 420 ms; loops both ways.
- Ticker: C2 5.374 swap, icon fade 150 ms, first char +217 ms, 67 ms per non-space char (9 steps for the first item).
- Skeleton after login: C1 12.150 / 12.300 / 12.500 / 12.700 states; notice at C1 12.733: sheet top 490.6, r 24, title 25 pt with green "정기점검",
  items, bell, page indicator, buttons; 닫기 removes sheet and scrim in one frame.
- Fresh re-entry after 취소 (C3 21.596 → 22.246 → sheet ≈ 22.6–22.9) vs plain pop (no skeleton, no sheet).
- 전체메뉴 vs **C3 39.750** (mask name and 최근 rows): header, search row, AI톡 tile at +0.32 s, quick icons, rail 124 wide with green selected row (50-pt rows),
  right list pitch 52, pins; opened with the `menu` profile (C3 38.629–38.996).
- 통합검색 vs **C3 40.546** (자동완성 off) and **40.81** (on); field focus border #0c8f2d; keyboard (C3 41.40). Results are invented (menu catalog matches).
- Bell opens the DevPanel; DevPanel notice edits change the sheet.

### 7.4 Account (A3)
- Use the **kpay** account (3 rows in 1개월, like the recording). List vs **C2 11.341** (mask text values): header 59–109, sticky block to 203, 잔액 row,
  계좌관리 / 이체 buttons, filter row, range + toggle row, separators at 456.6 + 121·i, row lines, colours. Max scroll **43 ±1** with 3 rows; scroll kept after
  a detail closes.
- Loading: home 거래내역 → list in 1000 ms (C2 8.991–9.991); row → 입금 detail 184 ms, 출금 detail 1100 ms, both with the deepen ramp (C2 14.274, 16.558).
- 입금 detail vs **C2 14.991**, 출금 detail vs **C2 18.324** (mask values): title left, ×, name row (☆ + 다시보내기 on 출금 only), memo field 54 tall r 12,
  info card rows (37 pitch, +42 after 거래시간), 출금계좌 hyphenated, 입금계좌 raw digits, 자동이체 등록 ›, 확인 at 730.7, pressed #004511 (C2 19.208).
- 이체 pressed #EAFEEE (C2 20.024) → T1 in 1050 ms (C2 21.141).
- Invented checks: memo saves (≤ 20) and shows on reopen; ☆ toggles and feeds T1 자주; 잔액 숨기기 hides row balances; 1주일/3개월/6개월 filters, 입금/출금,
  과거순; 3개월 on main pages at 20 rows.

### 7.5 Transfer (A4)
- T1 vs **C3 27.500** and **C2 21.200** (mask names and numbers): title, two fields 54 tall r 12, helper, 다음 disabled, tabs (active underline 2 pt),
  삭제하기, rows from 570 at pitch 63.33 with 36-pt tiles and ☆.
- T1 최근 row → T2 instant (C3 28.963), panel slides 150 ms (C3 28.988–29.146, curve ±1 pt per frame).
- T2 vs **C3 29.2** (placeholder), **C2 26.0** (error line "출금가능금액 부족 | 잔액채우기", reproduced on kpay by typing two digits), **C3 30.7** (caption,
  다음 enabled), **C3 31.05** (panel out, closed layout). Digits Roboto 500 36, "원" 33. Validation rule §2.5.
- T3 vs **C3 32.5** (mask the account line): one-frame appear with dim 68, sheet top 368 r 20, dots Ø 20.3 pitch 22, 4-column grid with 2 dummy NH keys,
  ↻ / ⌫ / OK row; 4th digit → +50 ms off → 483 ms loading → confirm page.
- 잔액채우기 sequence vs C3 1.896–3.329 (cut +367, T6 rise 2.879–3.196 under the dim, dim off +1433), T6 vs **C3 4.500** (rows KB, 케이뱅크, NH),
  T6 row → T7 (C3 5.179 → 5.643, rise 357 ms), T7 vs **C3 6.5**, close + dim linger (C3 7.729–8.246), T5 selected vs **C3 8.5**, scrolled 66 vs **C3 9.2**,
  digit roll (C3 10.746–11.03), T5 filled vs **C3 11.9**, pressed #12A434 (C3 12.029).
- Success (invented): the KB/케이뱅크 balance drops, the NH balance rises, T2 shows the caption and enabled 다음, toast "잔액을 채웠어요"; the KB account's 거래내역 shows
  the 잔액채우기 출금 row; 1일 잔여한도 drops by the amount.
- 취소 → home: C3 21.596 → cut 21.979 → dim off 22.246, then the fresh home sequence.
- Transfer end-to-end: confirm → 보내기 → done → 확인 returns to the origin; the new row shows 올원이체 in 거래내역조회 and the recipient tops 최근.

### 7.6 Cross-flow runs (integration)
- Cold start with the intro (● 녹화) → PIN → home → notice 닫기.
- Home card 2 거래내역 → 상세 (입금, 출금) → 이체 → T1 → 최근 row → T2 two digits → 잔액채우기 → T6 → T7 → 잔액채우기 → back on T2 → 다음 → T3 → confirm → done → list.
- Home card 1 이체 → T2 → 취소 → fresh home + notice.
- ≡ → 전체메뉴 → search → result → screen; menu 잔액채우기 (origin menu); 다른금융 card 잔액채우기 (origin card).
- Double taps on every navigating control never stack routes; back during a dim is ignored or cuts the dim; restart during T7 clears the native layer and
  restores the dark status glyphs.
- Empty seed: home with one card at 0원, T2 with any amount shows 출금가능금액 부족, T6 empty state (only the two 계좌등록 buttons), 거래내역 empty state.

---

## 8. Evidence gathered in this synthesis pass (scratch: `frames/plan/`, script `frames/plan/alpha.py`)
- **Dissolve vs zoom (R1):** `c1_0.600 … c1_1.100.png`; white alpha medians per 6 × 4 block listed in R1 (only the icon block differs, because the icon un-darkens).
- **Dim colour (R2):** `c2_8.800` vs `c2_9.500`, `c1_8.000` vs `c1_10.600` (sampled patches; values in R2).
- **Home background (R4):** `c2_7.000.png`, 8 sample points.
- **취소 dim (R7):** frame-by-frame luma C3 21.563–21.796 at two points; C3 26.113–26.196 for the home 이체 dim (one frame, 248 → 111).
- **Labels (R8):** `rail.png` (C3 39.750, rail only), `tab_hdr.png` (C2 7.000, tab bar + header right only).
- **Bank tiles (§5.2):** `tiles.png` (C3 27.500 and 4.500, tile boxes only; logo-only content confirmed).
- **Seed chains (§2.3):** validated with a script: opening balances 120,000 / 0 / 520,000 / 70,000, minimum balances 4,638 / 0 / 220,000 / 40,300, 40 rows,
  11 / 3 / 1 / 2 rows within 30 days.
- **Code facts:** `db.mjs:172` clears the main badge on every open; `GET /api/accounts/:id/transactions` caps `limit` at 500 (default 200);
  `POST /api/transfers` defaults `memoTo` to the user name and `memoMe` to the holder; `recent` already drops own accounts; PhoneFrame renders `overlay` last
  inside `.phone` (so z 50–58 sits under the island at 60); `useLayerActive` lives in `src/platform/LayerContext`; the ESRGAN model is in the scratchpad and torch is installed;
  no vector tracer is installed (hence the wordmark is an alpha mask, not an SVG path).
