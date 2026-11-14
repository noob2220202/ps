# toss (토스 / 토스뱅크): build plan (synthesis of infra · home · account · transfer · cert · assets)

App id **`toss`** with its own server and data: port **9117**, dev vite **5181** / API **8795**, data dir `server/data-toss/`, cookie `bank_sid_toss`.
The device is fixed to **Galaxy + dark**, with no switches and **no recording intro**.
This file is the single source of truth where the six area specs disagree. Read the area spec for screen detail (layout tables, ink boxes, colours) and this file for every cross-cutting decision.

**Privacy.** This file contains no value from the recordings. Seed values below are invented (홍길동-style). Placeholders such as `<NAME_A>` and `<ACCT_A>` only describe roles and formats. Frames and crops stay in `…/scratchpad/toss/frames/<area>/`. Never commit a frame. A crop is committed only after someone has looked at it.

**Units.** dp = screen coordinates of the 384 × 853.33 frame (0 = top of the status bar). Video px / 1.25 = dp. Times are real pts in seconds (A = first video, B = second video).

---

## 0. Decisions at a glance

1. **One PUSH curve for every screen push** (activity or WebView page):
   - New page: translateY +150 dp → 0, **400 ms, `cubic-bezier(.05,.7,.1,1)`**, opacity 0 → 1 over the first 50 ms. Old page: fades out in 60 ms.
   - Re-fit in this pass on three pushes (home→통장 A 14.134, 통장→거래내역 A 45.406, S1→S2 B 9.960). RMS 1.7 dp. §3.4
   - account.md's "+33 dp / 270 ms" is the same curve, measured from a late first frame.
   - infra.md's "60–80 ms cross-fade" is the old-page fade.
   - assets.md's "자산 → other-bank fades" is the same push (re-measured at B 161.27).
2. **One POP**:
   - Closing page: translateY 0 → +40 dp, 120 ms, ease-in, no fade.
   - Revealed page: shows only its background while the closing page moves, then its content appears at −5 dp and settles in 120 ms.
   - Re-measured at B 54.39–54.66.
3. **Status bar = transparent overlay. Every toss page paints its own 28 dp status band** (kakao2 pattern). This replaces infra.md's NH-style `useStatusBar` band. Evidence:
   - During every push the status area goes black, then fills back in as the new window slides up. It is a gap above the moving window, not a timed flash.
   - Under the bank-sheet scrim, the status band dims to #09080b while the clock and icons stay at full brightness (B 33.5: clock max luma 245).
4. **Nav band**: a 15 dp band at 838.33–853.33 with a handle, drawn as an **absolute overlay**. Pages stop at 838.33, except in scrim mode. It has 4 modes, verified on 4 fps scans of both videos:

   | mode | band | handle | where |
   |---|---|---|---|
   | `solid` | #171619 | #6b6a6d | default, every screen |
   | `kb` | #090909 | #616161 | under the Samsung keyboard |
   | `dim` | #050407 | #5e5d60 | under a sheet scrim |
   | `scrim` | rgba(0,0,0,.43) | #646366 | **소비 only**: content scrolls visibly under it (B 140.75–149.25) |

   home.md's "no band, tab bar under the handle" is wrong for scrolling pages. On home it looks the same, because the tab bar and the band are both #171619.
5. **Page background is #171619 everywhere.** Exceptions: home page #100f12, the 증명서 home page #100f12, 문서.pdf body #dddee3. The #17161b and #17171c readings are 1–2 levels of chroma noise; the dominant pixel colour flips between them inside a single frame.
6. **Tab bar centres x 50.0 / 120.4 / 190.4 / 260.8 / 331.2** (re-measured A 11.0). These follow home.md. infra.md's 5 × 76.8 equal tabs is wrong.
7. **Unbuilt controls use the repo convention** (SOLUTION 22: "기능 없는 다른 버튼들도 안내창 없이 무반응"): press feedback, then no-op. There is **no "준비 중이에요" toast**. Exceptions are listed in §1.6.
   - The tabs **혜택 / 쇼핑 / 증권** open one shared **placeholder tab screen** with the tab bar.
   - 전체 opens the invented 전체 메뉴.
8. **토스머니 is a real `accounts` row** (`role = 'money'`, bank toss). This keeps it in 내 계좌 / recipients as the recording shows, and transfers to it need no special code. **Points** get a small table. **Cards** get a table with an optional prepaid balance (토스유스카드).
9. **The spend total is one server function**, `tossSpendTotal(month)`, and it feeds both home "{M}월에 쓴 돈" and 소비. It uses assets.md's counted rule, which **includes transfers to other people**; home.md's card-only rule is replaced. The 🔔 `card_spend` override applies to both.
10. **Incoming counterparties need no new columns.** Other people use the repo's existing sender record (a `transfers` row whose `out_tx_id` points at the deposit; `SENT()` already excludes it). Own-account transfers get a toss-gated `in_tx_id` lookup.
11. **Post-transfer ad pages are shown.**
    - 옮겼어요 → 확인 opens the 5천원 coupon page.
    - 보냈어요 → 확인 opens the "30일 동안 매일 2,000원" page.
    - Both respect a per-profile snooze (`ad_snooze_until`), which "3일 동안 안보기" sets.
12. **Boot**: splash 1.2 s (the logo drops 8 dp at +0.6 s), then a 300 ms cross-fade to home. The lock screen is skipped (other clones skip password steps). The status bar uses a **toss-only 12-hour clock**. The recorder indicator shows only while ● 녹화 runs.

---

## 1. Screens, routes, transitions, back behaviour

### 1.1 Route map (`src/toss/routes.tsx`)

| path | screen | owner area | enters with | leaves (back) with |
|---|---|---|---|---|
| `/` | 홈 (tab 홈) | home | boot: splash cross-fade | Galaxy back on home = no-op (first history entry) |
| `/tab/benefit` · `/tab/shopping` · `/tab/stock` | placeholder tab screen (filled icon, centred grey text) | home | **CUT** (from home: push entry; tab→tab: replace) | back → `/` (CUT) |
| `/tab/all` | 전체 메뉴 (invented, assets.md §5.4) | home | CUT (as above) | back → `/` (CUT) |
| `/bank/:accountId` | 토스뱅크 통장 incl. long product menu | account | PUSH plus toast "토스뱅크로 이동했어요" (when coming from home or 전체) | POP |
| `/bank/:accountId/history` | 거래내역 | account | PUSH | POP |
| `/tx/:txId` | 상세 내역 | account | PUSH | POP |
| `/account/:accountId` | other-bank account detail (account.md S4) | account | PUSH | POP |
| `/send` (`?from=`) | S1 어디로 보낼까요? | transfer | **LOAD**, then PUSH (see §1.3) | POP |
| `/send/number` | S2 어떤 계좌로 보낼까요? (S3 bank sheet in-page, with its own history entry) | transfer | PUSH | sheet open: back closes the sheet; otherwise POP |
| `/send/amount` (`?bank=&number=` or `?to=<accountId>`) | S4 토스뱅크 송금 (amount; D1 dialog in-page) | transfer | PUSH | dialog open: back closes it; otherwise POP |
| `/send/confirm` | S5 옮길까요 / 보낼까요 | transfer | **CUT** (push entry) | CUT back to S4 |
| `/send/memo` | S6 받는 분에게 표시 | transfer | PUSH | POP (← discards; 완료 saves to flow state, then POP) |
| `/send/done` | S7 sending → S8 done (same route, internal phase) | transfer | **CUT, replace** of S5 | back during S7 is ignored; back on S8 = 확인 |
| `/ad/coupon` | 5천원 쿠폰이 발급됐어요 | home | **REVEAL** (replaces S8; S8 slides down over it) | back or 3일 동안 안보기 → **FADE** to the launcher |
| `/ad/payback` | 30일 동안 매일 2,000원 돌려받기 | home | PUSH (replaces S8) plus toast "토스로 이동했어요" | 닫기 or back → POP to the launcher |
| `/cert` | H 토스뱅크 증명서 발급하기 | cert | PUSH | POP |
| `/cert/transfer` | I 송금 확인증 intro | cert | PUSH | POP |
| `/cert/transfer/account` | A 어떤 계좌의 증명서를 발급할까요? | cert | CUT (blank 250 ms, then content) | CUT, selection reset |
| `/cert/transfer/items?account=` | L 어떤 내역을 발급할까요? | cert | CUT (blank 300 ms) | CUT, reset |
| `/cert/transfer/method?account=&ids=` | M 증명서를 어떻게 받을까요? | cert | CUT | CUT |
| `/cert/transfer/issuing?…` | W 잠시만 기다려주세요 (rings) | cert | CUT, then **replace** → D after 2.6 s | back = cancel → M (CUT) |
| `/cert/transfer/done?account=&ids=&at=` | D 송금 확인증을 발급했어요 | cert | CUT (replace of W) | CUT → M |
| `/cert/doc?account=&ids=&at=` | V 문서.pdf | cert | PUSH | POP |
| `/spend` (`?month=YYYY-MM`) | 소비 | assets | PUSH; band mode `scrim` while active | POP |
| `/assets` | 자산 | assets | PUSH (from the home footer, with the loading box if > 300 ms) | POP |
| `/assets/accounts` | 내 계좌 (the task's 계좌 편집) | assets | PUSH | POP |

Paths may overlap other apps' paths (only one app renders per server). Keep `/cert/doc` outside `/cert/transfer/` so "is a cert step" stays a prefix test.

### 1.2 Entry points (who navigates where)

| from | control | to |
|---|---|---|
| home | header "토스뱅크 ›", row 1 토스뱅크 통장 | `/bank/main` + toast |
| home | row 1 **송금** | toast "토스뱅크로 이동했어요", then LOAD → `/send?from=main` |
| home | row "{M}월에 쓴 돈" / **내역** | `/spend` |
| home | footer "계좌 · 카드 · 포인트 모두 보기" | `/assets` |
| home | 🔔 bell | DevPanel (관리 패널) |
| home | tab bar | `/tab/*` and `/` |
| 전체 메뉴 | 내 자산 / 소비 / 내 계좌 / 토스뱅크 통장 / 송금 / 증명서 발급 / 관리 패널 | `/assets` · `/spend` · `/assets/accounts` · `/bank/main` · `/send` · `/cert` · DevPanel |
| 통장 | mini-tx row, balance block | `/bank/:id/history` |
| 통장, 거래내역, S4 detail | **보내기** | LOAD → `/send?from=<id>` (S4 detail: only when the account is a toss account; otherwise no-op) |
| 거래내역 | row | `/tx/:txId` |
| 상세 | 증명서 발급하기 | `/cert` |
| 자산 / 내 계좌 | 토스뱅크 통장 row | `/bank/main` (no toast: already inside Toss) |
| 자산 / 내 계좌 | other-bank row | `/account/:id` |
| 자산 / 내 계좌 | 토스뱅크 통장 **송금** | LOAD → `/send?from=main`; 송금 on other rows: no-op |
| 자산 | "계좌 n개 전체보기" | `/assets/accounts` |
| S8 | 확인 | `sendFinish(kind)` (§1.5) |
| D | 확인했어요 | `history.go(-certDepth)` back to 상세, with POP |

### 1.3 Transition kinds (all toss-gated, `src/toss/nav.ts` + `nav.css`; measured values in §3.4)

| kind | when | what moves |
|---|---|---|
| **PUSH** | default for push navigations | new layer: +150 dp → 0 over 400 ms `(.05,.7,.1,1)`, opacity 0→1 in 50 ms. Old layer: content opacity 1→0 in 60 ms linear plus drift 0→−12 dp. **Its 28 dp band stays 95 ms, then hides.** The phone background (#000) shows in the gap, which reproduces the black status area (A 14.231–14.300, B 10.061–10.149) |
| **POP** | default for back | closing layer: 0 → +40 dp, 120 ms `cubic-bezier(.4,0,1,1)`, no fade, removed at the end. Revealed layer: background only (content `opacity:0`) until the exit ends, then content −5 dp → 0 over 120 ms `cubic-bezier(0,0,.2,1)` |
| **CUT** | tab switches, cert steps (both directions), S4→S5, S5→done, W→D | none |
| **LOAD** | 보내기 → S1 | the shared TossLoadingLayer (blank #171619 page with grey spinner) **cuts** in over the viewport below the status bar, for at least 400 ms or until recipients are prefetched. The PUSH to `/send` starts and the layer is removed in the frame the push begins |
| **REVEAL** | S8 확인 → coupon page (navigate with replace) | exiting layer (S8) runs the POP exit. The entering layer (coupon shell) is visible underneath from frame 0. Its content fades in 300 ms ease-out after 150 ms |
| **FADE** | coupon page dismissed (3일 동안 안보기, back) | top layer opacity 1→0 over 90 ms linear. The layer underneath (the launcher) is shown at once with no settle |
| **SHEET / DIALOG** | in-page components, not routes | §3.3 |

ScreenStack picks the kind with `tossAnimFor(navType, location, prevTop)`:
- An explicit `location.state.tossAnim` wins.
- Otherwise use path rules: cert-step pairs → CUT; `/tab/*` ↔ `/` → CUT; `/send/confirm` and `/send/done` → CUT.
- Otherwise PUSH for a push and POP for a pop.
- Popping off a layer whose state has `tossExit: "fade"` → FADE.

Layers are cleared on `animationend` (kbank/kakao2 lesson), with a fallback timer of ms + 300.

### 1.4 Back behaviour and history rules
- Galaxy back = `history.back()` everywhere (as kbank and ibk do). Open sheets, dialogs and the Korean or number keyboard close first. Each pushes one history entry while open (kbank `sendback.ts` / IBK `useIbkBackHandler` pattern, copied, not imported).
- **Depth counters** live in `location.state`:
  - `sendDepth`: entries since the launcher, incremented by each send push.
  - `certDepth`: entries since 상세.
  - Exits use `history.go(-depth)` (cert spec §4.3; hana 취소 precedent).
- **Double taps and taps mid-transition**: `useTossGo()` (copy of kbank `useKbankGo`).
  - Ignore taps on a layer that is exiting.
  - Lock navigation for 450 ms after a push or pop.
  - **Navigate 120 ms after release** (the recording's 0.46–1.7 s WebView dead time is compressed). The press highlight fades out over 170 ms meanwhile.
- When a non-home tab is the top entry, back returns to `/`. Tabs push from `/` and replace among themselves.
- Pages already in the stack are shown from cache when revealed. Home recomputes its values on reveal and runs the odometer only for values that changed. The B 131–138 cold reload is **not** reproduced.

### 1.5 Cross-area contracts (shared helpers in `src/toss/flow.ts`, owned by foundation)
Areas never import another area's internals. They call these helpers:
- `goBank(id, { toast })`: optional toast, then push `/bank/:id`.
- `goSend({ from, toastFromHome? })`: LOAD layer, prefetch recipients, then push `/send?from=`.
- `sendFinish(kind: "move" | "send")`:
  - Not snoozed → `navigate("/ad/coupon" | "/ad/payback", { replace: true, state: { tossAnim: kind === "move" ? "reveal" : "push", tossExit: "fade" | undefined, sendDepth } })`.
  - Snoozed → `history.go(-sendDepth)` with POP.
- `adDismiss({ snooze })`:
  - Optional `PATCH /api/profile { adSnoozeUntil: now + 3 days }`.
  - Then `history.go(-(sendDepth + 0))`, meaning the ad entry replaced S8, so the depth is unchanged.
  - The coupon page uses FADE; payback uses POP.
- `certExit()`: `history.go(-certDepth)`.
- After any successful transfer: `invalidate(paths.home)`, recipients, both accounts and their transactions, `toss/assets`, `toss/spend`.

### 1.6 Unbuilt controls, and the invented controls that do work
**Default for anything not listed below:** press feedback, then **no-op**. That covers Pay, the half cards, list rows, the ad card, 통장 gear, 내 자산 N개 ⌄, the header title ⌄, the interest row, 체크카드 / 비상금 / 자동이체 rows, 추천 rows, product menu rows, 유용한 정보, 간편홈, 의견, 카드, 관리, the 전체 ⌄ filter, search, 복사, underlined account values, S1 camera, S5 출금/입금 rows, 공유하기, the cert search icon, other cert rows, 언어, chips, 이메일, 팩스, V share, 분석, 소비 search / ⋯, 받기, 총 자산 ›, 자산 불러오기, + 내 자산 불러오기, 카드/포인트 n개 전체보기, card and point rows, 계좌 불러오기, 화면 편집하기, and 송금 on non-toss rows.

**Invented but working:**

| control | behaviour |
|---|---|
| home reward banner × and 통장 banner × | collapse animation (home.md §5; account.md §3.3 reversed). Home: `reward_dismissed = YYYY-MM` saved on the profile. 통장: hidden for the session (module memory) |
| 통장 "더 보기 1/2" | toggles to an invented page 2/2 of 추천 and back |
| S1 ★ | toggles favourite. Payees use `PATCH /api/payees/:id`; own rows use `PATCH /api/accounts/:id`. With at least one favourite, a "즐겨찾기" section appears above 최근 보낸 계좌 (transfer.md §5.1) |
| S1 tabs 연락처 / 해외 | the indicator slides 200 ms; the body is empty (grey "준비 중이에요" text in the page, not a toast) |
| S1 내 계좌 | expand / collapse (measured) |
| 상세 메모남기기 and S8 메모 남기기 | open an S6-style memo page (≤ 20 chars) → `PATCH /api/transactions/:id {memo}` |
| 소비 ◂ / ▸ | month navigation (▸ disabled on the current month) |
| 소비 filter tabs | recompute total, bar, strip and list per tab |
| 소비 ⌄ under the week strip | expand to a month calendar (250 ms) |
| 소비 tap on a strip date | scroll to that date's group |
| 소비 row | account transactions → `/tx/:txId`; card / pay transactions → no-op |
| 자산 tabs | tap smooth-scrolls; scroll-spy |
| 자산 | pull-to-refresh |
| 내 계좌 segmented control | the thumb slides; the 계좌 개설 body is empty |
| coupon page | 쿠폰 받기 = dismiss without snooze |
| payback page | 확인하기 = dismiss |
| cert | "모두 선택" toggles all |

**Tabs 혜택 / 쇼핑 / 증권** share `TabPlaceholder`:
- The page bg is #100f12 with the home header style. The title is the tab name (22 B).
- A centred grey line (15 R #97979c) reads "연습용 클론에서는 아직 없는 화면이에요".
- The tab bar shows the selected icon filled.

---

## 2. Data model and server

All server changes are **gated** (`APP === "toss"` or `db().app === "toss"`). Columns added by `migrate()` are nullable or defaulted, which is the repo practice. Other apps' JSON stays **byte-identical**: new fields are emitted only for toss. New toss code goes in new files `server/toss-seed.mjs` and `server/toss-api.mjs`. `index.mjs` and `db.mjs` gain only small gated hooks.

### 2.1 Schema (in `migrate()`; the column guards follow the existing `columns()` pattern)

| table | addition | used by |
|---|---|---|
| accounts | `role TEXT` (`'money'` for 토스머니, else NULL) | home row 2, 자산, 내 계좌, S1 sub "토스머니"; cert "사용중인 통장" excludes it |
| accounts | `favorite INTEGER NOT NULL DEFAULT 0` | S1 ★ on own rows |
| accounts | `opened_at TEXT` ('YYYY-MM-DD') | cert A "개설일 YY.MM.DD" |
| transactions | `category TEXT` | 소비 bar and legend, row icons |
| transactions | `channel TEXT` ('card' \| 'account' \| 'pay') | 소비 tabs. If NULL it is derived: `#체크카드` → card; `#이체` / `#자동이체` / `#예금이자` → account |
| transactions | `card_id TEXT` | card monthly amounts (자산), 소비 subtitle |
| transactions | `cancelled INTEGER NOT NULL DEFAULT 0` | 소비 strike-through, excluded from totals |
| transactions | `exclude INTEGER NOT NULL DEFAULT 0` | card-bill auto-debit and manual exclusions (grey amount) |
| profile | `point_chances INTEGER NOT NULL DEFAULT 3` | home "송금·결제 후 받는 포인트 N번" |
| profile | `reward_max INTEGER` (NULL hides the banner) | home banner "<given>님의 {M}월 최대 적립금 N원" |
| profile | `reward_dismissed TEXT` ('YYYY-MM') | banner × |
| profile | `ad_snooze_until TEXT` (ISO) | post-transfer ad pages |
| new `cards` (toss only, created in `migrate()` when `APP === "toss"`) | `id TEXT PK, name TEXT, bank_code TEXT, account_id TEXT NULL, art TEXT, kind TEXT ('check'\|'prepaid'), balance INTEGER NULL, last_used_at TEXT NULL, sort INTEGER` | 자산 카드, home 토스유스카드 row, 소비 subtitles |
| new `points` (toss only) | `id TEXT PK, name TEXT, balance INTEGER, icon TEXT, sort INTEGER` | 자산 포인트 |

No new transaction **tags** are added. 페이·기타 comes from `channel`, and the cashback medal comes from `category = '캐시백'`. `TAGS`, `TxTag` and the DevPanel tag chips stay as they are.

### 2.2 Derived rules (one implementation each, in `server/toss-api.mjs`)
- **own(tx)**: a `transfers` row exists with `in_tx_id = tx.id`, or with `out_tx_id = tx.id` whose (bank_code, number) is one of my accounts.
- **counted(tx)**: `amount < 0` and `!cancelled` and `!exclude` and `!own(tx)`. Transfers to other people count.
- **tossSpendTotal(month)**: `profile.card_spend ?? Σ|amount| of counted debits in month`. Used by `/api/home` (`monthlyCardSpend` and `toss.spend.total`) and by `/api/toss/spend`.
- **vsLastMonth**: total(M, day 1..today) − total(M−1, day 1..same day). The copy rules are in assets.md §4.1.
- **categories**: counted spend by `category ?? (tag #이체 ? '이체' : '카테고리 없음')`, top 3 plus 그 외. Colours: 이체 #2f7ff3, 카테고리 없음 #1e7055, 교육 #804b20 (measured); invented: 식비 #d9822b, 카페·간식 #b0703a, 편의점·마트 #c9a227, 쇼핑 #8a5cf5, 교통 #27a5a0, 문화·여가 #d6458f; 그 외 #3e3d40.
- **overspent(day)**: day expense > 2 × the month's average daily expense **and** ≥ 30,000원.
- **총 자산** = Σ balances of all accounts (토스머니 included) + Σ points. Cards are not assets.
- **card monthAmount** = Σ|amount| of this month's non-cancelled debits with that `card_id`.
- **interest accrued** (통장 "어제까지 쌓인 이자", computed client-side) = `floor(balance × 0.01 × (dayOfMonth − 1) / 365)`, which is 0원 on the 1st. The rate matches the product menu's "토스뱅크 통장 연 1%".
- **내 자산 N개** (통장 header) = number of accounts with `bank_code = 'toss'` (통장 + 토스머니). Its sheet is a no-op.
- **youth card "N개월 전"** = whole months since `last_used_at`; 0 → "이번 달".
- **given name** (banner) = `userName.length === 3 ? userName.slice(1) : userName`, computed client-side with no column.

### 2.3 Seed `seedTossExample(d, userName = "홍길동")` (all invented; `server/toss-seed.mjs`)
**Dates are relative to now.** Use the server's `nowIso()` clock.
- `c(n, "HH:MM")` = today − n days, clamped to the 1st of the current month 00:00+.
- `p(day, …)` = that day of the previous month; `q(day, …)` = that day two months back.

Any timestamp that would land after now (for example `c(0, "09:12")` when seeding at 08:00) is pulled back to now − (k + 1) minutes, where k is its rank among today's rows. This keeps the order stable and nothing in the future.

This keeps "{M}월에 쓴 돈", 소비 and 지난달 comparisons populated on any date, and avoids kbank's future-transaction trap.

**Profile:** `user_name` 홍길동, `card_last4` 1234, `card_spend` NULL, `cashback_count` 2, `point_chances` 3, `reward_max` 50000, `reward_dismissed` NULL, `ad_snooze_until` NULL.

**Accounts** (`id · kind · bank · name · number · balance · opened_at · role`):

| id | kind | bank | name | number (format) | balance | opened_at | role |
|---|---|---|---|---|---|---|---|
| main | main | toss | 토스뱅크 통장 | 1000-1234-5678 (4-4-4) | 1,250,000 | 2024-03-15 | |
| money | external | toss | 토스머니 | 1000-9999-0001 (internal, never displayed) | 3,200 | | money |
| hana | external | hana | 영하나플러스 통장 | 123-456789-01234 (3-6-5) | 84,500 | 2023-08-02 | |
| kakao | external | kakao | 입출금통장 | 3333-01-2345678 (4-2-7) | 15,300 | | |
| nh | external | nh | 자립예탁금 | 301-0123-4567-01 (3-4-4-2; S1 sub shows raw digits) | 52,000 | | |

The order (`sort`) is the 내 계좌 order: main, hana, kakao, nh, money.

**Cards:**

| id | name | bank | linked | kind | balance / last used |
|---|---|---|---|---|---|
| c-toss | 토스뱅크 체크카드 | toss | main | check | — |
| c-hana | Young Hana+ 체크카드 | hana | hana | check | — |
| c-kakao | 프렌즈 체크카드 | kakao | kakao | check | — |
| c-youth | 토스유스카드 | toss | — | prepaid | 15,000 / q(10, 14:00) |

**Points:** 토스포인트 1,280 · 하나머니 350.

**Payees** (all `favorite 0`, like the recording):
- **Starred:** nothing is starred by default. Every ★ in S1 is off in the recording (`#413f42`), and that is what reviewers compare.
- The starred path is still modelled: payees `favorite`, and accounts `favorite` for own rows.
- It is exercised by tapping ★ in S1 or 🔔 받는 분 ☆. That shows the invented 즐겨찾기 section.

| holder | bank | number |
|---|---|---|
| 김철수 | kb | 123456-01-234567 |
| 이영희 | kakao | 3333-02-3456789 |
| 박민수 | woori | 1002-345-678901 |
| 최지우 | hana | 456-789012-34567 |
| 정하늘 | ibk | 010-123456-01-012 |
| 오세라 | nh | 302-1234-5678-11 |
| (주)예시상사 | shinhan | 110-123-456789 |
| 윤다온 | toss | 1000-2345-6789 |
| 강예린 | woori | 1002-456-789012 |
| 서지호 | kb | 654321-02-765432 |

**Transfers sent from main.** Each row creates the out transaction, plus the deposit on the own account where the destination is mine. `memo_to` is NULL (defaults to the user name).
1. c(0, 09:12) → 최지우 15,000
2. c(1, 18:40) → **내 hana** 50,000
3. c(2, 12:05) → 김철수 32,000
4. c(3, 20:31) → 이영희 8,500
5. c(5, 13:10) → **내 kakao** 20,000
6. c(6, 19:22) → 박민수 120,000
7. p(25, 11:00) → 정하늘 45,000
8. p(18, 08:30) → 오세라 12,000
9. p(9, 21:15) → **내 money** 10,000
10. p(4, 10:45) → (주)예시상사 77,000
11. q(20, 16:20) → 윤다온 5,000
12. q(11, 09:05) → 강예린 9,900

This gives 최근 보낸 계좌 with own accounts mixed in, ≥ 4 sent transfers on ≥ 3 dates for the cert, and one to an own other-bank account.

**Own transfer into main:** c(8, 17:30) hana → main 100,000 (out on hana, in on main). This drives the 상세 credit case with 입금처 / 출금처.

**Incoming from other people** (deposit plus the existing sender record):
- c(4, 10:20) main +30,000 from 이영희 (kakao)
- p(15, 09:00) main +150,000 from (주)예시상사 (shinhan)
- c(2, 15:40) hana +20,000 from 김철수 (kb)

**Card, pay, interest, cashback and bill rows** (`account · when · merchant · amount · tag · channel · category · card · flags`):
```
main  c(0,08:05)  한빛편의점      -4,800   #체크카드 card 편의점·마트 c-toss
main  c(1,12:30)  소나무분식      -9,000   #체크카드 card 식비       c-toss
main  c(2,15:10)  하늘카페        -5,500   #체크카드 card 카페·간식  c-toss
main  c(3,16:45)  새싹문구       -12,000   #체크카드 card 교육       c-toss
main  c(3,21:02)  카드 캐시백        +50   #체크카드 card 캐시백     c-toss
main  c(5,19:40)  샘플쇼핑_PG    -32,900   #체크카드 pay  쇼핑       c-toss   (pay: two-line subtitle)
main  c(6,13:15)  예시마트       -68,000   #체크카드 card 편의점·마트 c-toss   (overspent day with transfer 6)
main  c(6,18:05)  별빛서점       -23,000   #체크카드 card 문화·여가  c-toss
main  c(7,23:40)  구름택시       -14,300   #체크카드 card 교통       c-toss
main  p(1,00:10)  통장 이자         +412   #예금이자 account 이자
main  p(3,12:00)  소나무분식      -8,000   #체크카드 card 식비       c-toss
main  p(7,08:40)  한빛편의점      -3,200   #체크카드 card 편의점·마트 c-toss
main  p(12,19:30) 하늘카페        -6,100   #체크카드 card 카페·간식  c-toss
main  p(20,14:20) 예시마트       -41,000   #체크카드 card 편의점·마트 c-toss
main  p(27,21:00) 카드 캐시백        +30   #체크카드 card 캐시백     c-toss
main  q(1,00:10)  통장 이자         +388   #예금이자 account 이자
main  q(6,13:00)  별빛서점       -15,000   #체크카드 card 문화·여가  c-toss
main  q(14,18:45) 소나무분식      -9,500   #체크카드 card 식비       c-toss
main  q(23,11:30) 구름택시       -11,800   #체크카드 card 교통       c-toss
hana  c(1,08:20)  한빛편의점      -2,300   #체크카드 card 편의점·마트 c-hana
hana  c(3,17:10)  샘플쇼핑_PG    -19,800   #체크카드 card 쇼핑       c-hana   cancelled=1
hana  c(4,16:00)  바른학원      -150,000   #체크카드 card 교육       c-hana
hana  c(5,07:00)  하나카드       -54,000   #자동이체 account (none)            exclude=1 (card bill)
hana  c(5,12:40)  하늘카페        -4,800   #체크카드 card 카페·간식  c-hana
hana  p(5,07:00)  하나카드       -61,000   #자동이체 account (none)            exclude=1
hana  p(9,13:30)  소나무분식      -7,500   #체크카드 card 식비       c-hana
hana  p(16,20:10) 예시마트       -22,000   #체크카드 card 편의점·마트 c-hana
kakao c(2,22:15)  앱마켓_PG       -1,100   #체크카드 pay  카테고리 없음 c-kakao
kakao c(4,12:10)  소나무분식      -7,000   #체크카드 card 식비       c-kakao
kakao p(11,19:00) 별빛서점        -9,000   #체크카드 card 문화·여가  c-kakao
kakao p(22,15:30) 한빛편의점      -2,700   #체크카드 card 편의점·마트 c-kakao
nh    p(2,10:00)  자립예탁금 이자    +95   #예금이자 account 이자
nh    q(9,14:00)  오세라          +20,000  #이체    account 이체           (sender record: 오세라, nh)
money c(3,11:11)  토스페이 결제    -2,400   #체크카드 pay  쇼핑
```
In total there are about 60 transactions over 3 months. Main gets ≥ 20 rows, which fill 거래내역 past one screen. Balances are the stored values above; `balanceAfter` is derived by the server as today.

**Empty seed** `seedTossEmpty(d, userName)`:
- Main 토스뱅크 통장 with balance 0 and 토스머니 0.
- No other accounts, cards or transactions.
- 토스포인트 0, `reward_max` NULL.

This exercises "출금할 수 있는 돈이 0원이에요", the empty lists and the empty cert state.

### 2.4 Endpoints

**Reuse unchanged:**
- `GET /api/banks`, `GET /api/profile`
- `GET /api/accounts/:id`, `GET /api/accounts/:id/transactions`
- `GET /api/transfer/lookup` (404 → D1 dialog)
- `POST /api/transfers` (`{fromAccountId, bankCode, number, amount, memoTo}`, **no `checkDuplicate`**)
- `GET /api/transfers?from=`, `GET /api/transfers/:id` (cert L / D / V)
- payees CRUD, `PATCH /api/payees/:id {favorite}`, `POST /api/reset`, profiles

**Shared endpoints, toss-gated additive changes (foundation):**

| endpoint | toss change |
|---|---|
| `GET /api/home` | `monthlyCardSpend = tossSpendTotal(month)` plus `toss: { spend:{month,total}, pointChances, reward:{month,max,dismissed}, youthCard:{name,balance,lastUsedAt}\|null, adSnoozeUntil }`. The kakao banners and other fields stay as they are; toss ignores them |
| `toAccount` | adds `openedAt`, `favorite`, `role` |
| `listTransactions` rows | add `category`, `channel` (derived when NULL), `cardId`, `cancelled`, `exclude`, `own` |
| `GET /api/transactions/:id` | adds `kindLabel` ('입금' / '출금') and `counterparty: {direction, own, accountName?, bank, number, holder}`. Sources, in order: `out_tx_id` (sent), `in_tx_id` → `from_account_id` (own incoming), the sender record (others incoming). `memoTo` stays as it is |
| `GET /api/transfer/recipients` | `recent` keeps own accounts (`APP === "toss" \|\| !myAccountByNumber(…)`) and attaches `accountId` for them. `mine` items add `role` and `favorite`. `mine` still excludes `from` (recording: "+4개" without the sending 통장) |
| `POST /api/accounts` | gate the "카카오뱅크 통장은 이미 있어요" line with `APP === "kakao"`. Default name: `bank.code === "toss" ? "토스뱅크 통장"`. Comment the bankCode = APP coincidence (infra §4) |
| `PATCH /api/accounts/:id` | toss also accepts `favorite`, `openedAt`, `sort`, `role` |
| `PATCH /api/profile` | toss also accepts `pointChances`, `rewardMax`, `rewardDismissed`, `adSnoozeUntil` |
| `POST /api/accounts/:id/transactions`, `PATCH /api/transactions/:id` | toss also accepts `category`, `channel`, `cardId`, `cancelled`, `exclude` |
| `DELETE /api/accounts/:id` message map | `toss: "토스뱅크 통장"` |

**New toss-only endpoints** (`server/toss-api.mjs`, mounted only when `APP === "toss"`):

| endpoint | returns |
|---|---|
| `GET /api/toss/spend?month=YYYY-MM&tab=all\|card\|account\|pay` | assets.md §4.2 shape: `{month,label,hasPrev,hasNext,total,vsLastMonth:{diff},categories[],days[],cashback,groups[{date,label,overspent,items[{id,txId,title,suffix?,subtitle,amount,tone,icon}]}]}`. Icons are keys (`transfer`, `store`, `cashback`, `interest`, `bank:<code>`, `cat:<category>`) |
| `GET /api/toss/assets` | `{total, accounts:{count,items[{id,bankCode,name,balance,isMain,role}]}, cards:{count,items[{id,name,bankCode,art,kind,monthAmount,balance?}]}, points:{count,items[{id,name,balance,icon}]}}`. 내 계좌 uses the same payload |
| `GET/POST /api/toss/cards`, `PATCH/DELETE /api/toss/cards/:id` | card CRUD for 🔔 |
| `GET/POST /api/toss/points`, `PATCH/DELETE /api/toss/points/:id` | point CRUD for 🔔 |

**Certificates** need no server work. The list is static. 발급번호 and 발급일자 are generated client-side, deterministically from (`ids`, `at`) carried in the URL (cert.md §4.1).

**Memo**: `transfers.memo_to` (S6, sent in `POST /api/transfers`) and `PATCH /api/transactions/:id {memo}` (메모 남기기).

**Favourites**: `PATCH /api/payees/:id` and `PATCH /api/accounts/:id` (toss).

Client types go in `src/toss/api.ts` (paths, fetchers, types for the toss blocks). Shared `src/api/types.ts` only gains optional fields (`openedAt?`, `favorite?`, `role?`, `category?`, …).

### 2.5 🔔 관리 패널 (DevPanel) for toss
Mount points in `DevPanel.tsx` are foundation-owned and gated `APP === "toss"`. The sections live in `src/toss/devpanel/*`, owned by the assets area. **What each edit changes:**

| panel field | effect on screens |
|---|---|
| 기본 → 이름 | banner given name, S5/S6 받는 분에게 표시 default, cert doc statement and 보낸사람 |
| 기기 / 테마 | hidden (DEVICE_LOCK android, THEME_LOCK dark) |
| 계좌 → 토스뱅크 계좌 추가 (OWN_BANK.toss) and 다른 은행 계좌 추가 (`AddBankAccount` with a 계좌 이름 field, `exclude=[]`) | home (main and money only), 자산, 내 계좌, S1 내 계좌, cert A sections |
| 계좌 → balance, name, number (toss accounts use free text; others use the kakao-style pattern formatter) | home, 통장, 거래내역, 자산, S4 잔액 and the error copy |
| 계좌 → 토스머니 balance (role money row) | home row 2, 자산, 내 계좌 |
| 계좌 → 개설일 (toss) | cert A |
| 카드 → 이번 달 쓴 돈 (`card_spend`, or auto) and 캐시백 N | home "{M}월에 쓴 돈" **and** the 소비 total; 소비 cashback row and S4-detail "캐시백 기회 N번" |
| 토스 → 포인트 기회 N번, 리워드 최대 적립금 (or hide), 리워드 배너 다시 보이기, 이체 뒤 광고 다시 보이기 (clear snooze) | home cards, banner, ad pages |
| 토스 → 카드 목록 (name, bank, linked account, kind, prepaid balance, last used) | 자산 카드, home 토스유스카드 row |
| 토스 → 포인트 목록 (name, balance) | 자산 포인트, 총 자산 |
| 거래 → existing fields + toss fields: 분류 (category select), 결제 수단 (card / account / pay), 카드, 취소됨, 소비에서 제외, 상대 정보 (existing) | 거래내역 icons, 상세, 소비 (tone, total, bar, strip) |
| 받는 분 → existing CRUD and ☆ | S1 최근 보낸 계좌 holder names, lookup |

After every save the panel calls `invalidate` on home, `toss/spend`, `toss/assets` and the affected account paths. Home and 자산 then roll changed numbers with the odometer.

---

## 3. Shared primitives and device chrome (each has one owner file; all owned by the foundation step)

### 3.1 Device chrome
| item | file | spec |
|---|---|---|
| Frame size | `src/styles/global.css` (add `html[data-app="toss"]` to the nh/hana rule) | 384 × 853.33 |
| Status bar overlay | `src/toss/StatusBar.tsx` + `toss.css` | `html[data-app="toss"] .phone > .statusbar` absolute, 28 dp, transparent, z 70, pointer-events none (kakao2 chrome.css pattern). One **384 × 28 SVG in dp** (infra §1.2): clock at x 28 (Pretendard 14/400 #f0f0f2, **12-hour `h:mm`, toss only**). The recorder indicator (corner brackets + camcorder, x 60–71.2, blink 1.0 s at 50 %) shows **only while ● 녹화 runs**. Right cluster: battery-protection, alarm, mute, Wi-Fi with arrows, 4-bar signal, `NN%`, charging battery, with infra §1.2 x positions. Battery % and clock come from `useDeviceStatus` / `useNow`. No third-party notification icons. No Edge-panel handle |
| Page-painted status band | `src/toss/ui/Page.tsx` | every toss page draws a 28 dp band in its `band` colour (default #171619; home #100f12; cert H #171619 over a #100f12 header) at y 0, moving with the layer |
| Inset for reused screens | `src/toss/Inset.tsx` | Login and ProfilePicker get a 28 dp #171619 band, then the screen (K2Inset pattern) |
| Nav band | `src/toss/band.ts` + `toss.css` | `html[data-app="toss"] .phone__navbar { position:absolute; left:0; right:0; bottom:0; height:15px }` with the 4 modes from §0.4 via `html[data-toss-band="kb"\|"dim"\|"scrim"]`. `useTossBand(mode)` sets the mode while a component is mounted and active. HanaKeyboard reuse: `[data-hana-kb]` also maps to `kb` for toss |
| Viewport | `toss.css` | pages are laid out 0–853.33 with `--toss-sb: 28px` on top and `--toss-nav: 15px` at the bottom. Content stops at 838.33, except the 소비 list, which extends under the band in scrim mode |
| Mobile ≤ 500 px | `toss.css` | hide the fake status-bar contents and the band and handle. `--toss-sb: env(safe-area-inset-top)`, `--toss-nav: env(safe-area-inset-bottom)` (kbank-like) |

### 3.2 Tokens (`src/toss/toss.css`, `:root[data-app="toss"]`; never redefine the global `--home-*`)
- **Surfaces:**
  - page `--toss-bg #171619`; home and cert H page `--toss-bg-deep #100f12`; 통장 section band `--toss-band-deep #101013`
  - home card `#19181b`; 자산 card `#201f22`; surface (toast, input box, sheet card, loading box) `#1f1e21`
  - fill (통장 tiles, 채우기/보내기 tiles, 복사) `#2c2c35`; fill-2 (chips, dialog card, segmented, floating pill, 메모 chip) `#2a2a34`
  - grey button `#292a2f` (home small button `#2a2b30`, pressed `#3b3c41`)
  - divider `#2a2a2f` (0.8 dp); skeleton `#232228` (통장) / `#1d1c1f` (소비 web skeleton)
- **Blue:**
  - `--toss-blue #3182f6`; pressed `#225eb5`; text-blue (thin labels) `#4593fc`
  - weak (채우기) `#1f2942` / text `#5399f8`; secondary (공유하기) `#18294a` / text `#4690f6`
  - disabled CTA `#1e355b` / text `#4d5e7c`
- **Other colours:** red `#f04452`; scrim `rgba(0,0,0,.61)`.
- **Text** (dark): t1 `#f0f0f3` (titles up to `#fafafc`), t2 `#c3c3c6`, t3 `#97979c`, t4 `#86858a`, t5 `#6e6e70`. Area specs give per-screen peaks; use those where listed.
- **Type:** Pretendard Variable, no extra import. Weights R 400 / M 500 / SB 600 / B 700. Use 650 only where transfer.md measured it. Sizes are the area specs' fitted values (11 · 12 · 13 · 14 · 15 · 16 · 17 · 19 · 22 · 24 · 26 · 28 · 30). `letter-spacing: 0`. `font-variant-numeric: tabular-nums` on the cert doc only.
- **Keyframes:** every toss `@keyframes` and class is prefixed `toss-` (kakao2 lesson: one bundle holds all apps' CSS).

### 3.3 Components (`src/toss/ui/`)
| file | component | spec source |
|---|---|---|
| `Page.tsx` | `TossPage` = band + header slot + scroll body + optional bottom dock; props: band colour, bg, `navMode` | §3.1 |
| `AppBar.tsx` | 53.6 dp header (28–81.6). ← arrow: ink x 18.4–38.4, y 45.6–64.0, 2 dp stroke, 48 dp hit area. Title left at x 72 (17 SB) or none. Right slots (gear, 완료, 자산 불러오기, segmented). Modes: `solid`, `transparent+blur` (통장, 20 px backdrop blur, title fades in by threshold), `scroll-linked` (거래내역: opacity = clamp((st − 40)/120, 0, 1)). Progress-bar slot | account §2.1, §3.4–3.5; transfer §2.0; cert §2.0 |
| `icons.tsx` | all line icons as SVG: back, chevrons › ⌄ ∧ ∨, ◂ ▸, close ×, search, gear outline and filled, card, share/upload, star, camera, shield, check, check-circle (outline / filled knocked out), plus, ⋯, keypad ←, ⓧ, bell + red dot, Pay brackets, Face-ID, tab icons (outline and filled) | area specs |
| `Pressable.tsx` | `TossPressable` with props `{inset, radius, color, scale, fadeIn=0–100, fadeOut=170}`, cancelled when the press turns into a scroll. Plus `useTossGo` (120 ms delayed navigation, lock) | home §3.2, account §3.7, transfer §2.1, assets §3.3, cert §2.0 |
| `Row.tsx` | simple flex row (icon slot, 1–2 text lines, right slot); used where geometry is generic. Areas may keep their own CSS for measured rows | — |
| `Button.tsx` | CTA: 56 dp, **radius 16**, x 20–364, label 17 SB. Variants primary / weak / grey / secondary / disabled. **Loading dots**: 3 × 6.4 dp, pitch 15 dp, 750 ms cycle, stagger 200 ms, opacity .3→1, scale .75→1. Pressed: ripple to `#225eb5` in 100 ms, scale .995, release 150 ms. Enable/disable cross-fade 180 ms. `BottomDock` (y 762–818, with an optional 40 dp fade gradient above it). Two-button and full-bleed `BarCTA` (S4 다음: 0–384, y 518–574, radius 0) variants | transfer §2.0, cert §2.0, account §2.5 |
| `Sheet.tsx` | floating sheet: x 11.2–372.8, radius 24, `#1f1e21`, grabber 42.4 × 4 `#363538`, 19–20 B title. Scrim covers the whole window (band and status band) at .61, with nav band mode `dim`. In: keyboard down 150 ms, scrim 230 ms, card +14 dp → 0 with fade 100 ms. Out: card +10 dp with fade, scrim out, 100 ms. Opening pushes a history entry | transfer §2.3, §3.1 |
| `Dialog.tsx` | **web-area** scrim (81.6–838.33 only; the app bar and status bar stay undimmed) .61. Card x 32.1–351.8, radius 24, `#2a2a34`. Title 20 B, body 15 M, right text button 17 B blue. In: fade + scale .96→1, 160 ms. Out: 130 ms | transfer §2.5 |
| `Toast.tsx` + `toast.ts` | "토스뱅크로 / 토스로 이동했어요" pill. **Geometry re-measured** (home.md values): bg `#1f1e21`, height 49.5, centre y 54.4, width hugs content ("토스뱅크…" 88.1–295.2), padding 19/20. Logo ≈ 18 dp, 4 dp gap, 16 SB text; "토스뱅크" / "토스" blue with a 1.6 dp underline. Enter: spring −14 dp → 0 (overshoot +5.5 dp at +240–330 ms, settled ≈800 ms) with opacity / blur ramp 180 ms. Hold ≥ 1450 ms and until `ready + 100 ms`. Exit 200 ms: up 13 dp and fade. One global layer in `TossOverlay` | home §2.7, §3.3 |
| `LoadingLayer.tsx` + `loading.ts` | LOAD page (blank #171619 + grey spinner ⌀30 at (192, 433), stroke 2.5 `#b5b6bb`, below the status bar) and the "잠시만 기다려주세요." box (x 10–374, y 418–496, radius 20, blue arc spinner ⌀20, 15 R). One owner (kakao2 `dim.ts` pattern): `showTossLoad()` / `cutTossLoad()` / `showTossWaitBox(afterMs = 300)` | transfer §2.0, home §2.8 |
| `Spinner.tsx` | grey indeterminate arc ⌀30 and blue arc ⌀20 | same |
| `ProgressBar.tsx` | 2.4 dp at y 80. Track `#4c4e55` fades in 200 ms. Fill `#3182f6` at opacity .75: jumps to 70 % in 80 ms, fills 70→100 % in 300 ms on ready, then fades out 400 ms (tune by overlay; the video desaturates the 2.4 dp line) | home §2.6, account §2.8, cert §2.0 |
| `Skeleton.tsx` | dark bars (`#232228` on #171619, radius 4–10) with a diagonal shimmer; a staggered fade-in helper | account §3.2, assets §2.1.7, cert §2.2 |
| `Odometer.tsx` | per-digit vertical roll through intermediate digits. Columns finish left→right with a 60–80 ms stagger, total 420–500 ms ease-out (home). The 자산 variant is 900 ms. Commas and 원 stay fixed. Runs only when the value differs from the last rendered value (module cache keyed by id) | home §3.6, assets §3.5 |
| `BankLogo.tsx` | squircle (radius ≈ 0.33 × size) with a per-bank fill plus the glyph `hana-bank-<code>.png` (toss: the toss symbol). Fills from assets.md §2.2.5 (toss #1f355e page / #283c68 card; hana #132225 / #1e2a29; kakao #363017 / #3d3a20; nh #112946). Others use `color-mix(in srgb, brand 20%, surface)`. Sizes 24 · 28 (cert tile) · 30 · 30.4 · 36 · 40. Variant `tile` for cert (fill #100f12) | transfer §2.1, assets §2.2.5, cert §2.3 |
| `format.ts` (`src/toss/`) | `won`, signed amounts, "+" rules (Toss lists: "+" on positive; other-bank list: none), date labels (`M.D`, `M월 D일`, `MM.DD`, `D일 요일`, `YYYY년 M월 D일 HH:mm`), particles 으로/로 and 을/를 (final-consonant rule, ㄹ → 로), bank short and full names | account §4, transfer §4.3 |
| `bank.ts` (`src/toss/`) | toss bank grid labels and order (33 banks + 29 securities, transfer.md §2.3), code map (교보SBI저축은행: no code, tile no-op), short names for list rows (하나, NH농협, 우리, KB국민, 카카오뱅크, IBK기업, …), full names for S4/S5 | transfer §2.3 |
| `api.ts`, `flow.ts`, `nav.ts`, `nav.css` | §2.4, §1.5, §1.3 | — |
| Number keyboard | reuse `src/hana/HanaKeyboard.tsx` as is (same device). Band mode `kb` | infra §6, transfer §2.2 |
| Korean keyboard | **transfer area** owns `src/toss/transfer/KoreanKeyboard.tsx` + `hangul.ts` (두벌식 composer). Physical keyboard input goes through a hidden `<input>` as well | transfer §2.8.1 |
| Amount keypad | **transfer area** owns `src/toss/transfer/AmountKeypad.tsx` (4 × 66 rows, 3 × 121.2 columns, 1–9 / 00 / 0 / ←, `applyKey` from `src/lib/keypad.ts`) | transfer §2.4 |

### 3.4 Motion constants (`src/toss/nav.ts`, measured)
| constant | value | evidence |
|---|---|---|
| PUSH new layer | 400 ms, translateY 150 → 0 dp, `cubic-bezier(.05,.7,.1,1)`, opacity 0→1 in 50 ms | fit RMS 1.66–1.72 dp on A 14.134, A 45.406, B 9.960 (this pass); cert T1/T3; assets 152.03 |
| PUSH old layer | content opacity → 0 in 60 ms linear, translateY −12 dp; band held 95 ms | A 14.134 (≈ 40 ms), A 45.406 (≈ 50 ms), B 9.960 (≈ 60–70 ms); status black from +97 ms |
| POP | exit +40 dp, 120 ms `(.4,0,1,1)`; revealed content −5 → 0 dp in 120 ms `(0,0,.2,1)` after the exit | B 54.39–54.66 (offsets +0.8 / 3.2 / 16.8 / 25.6 / 32 / 37.6 dp; revealed −4.8 → 0 over 54.541–54.661) |
| FADE | 90 ms linear | B 77.332–77.42 |
| Tap → navigate | 120 ms after release | compressed from 0.46–1.7 s |
| Press highlight out | 170 ms | A 13.479–13.646 |
| Boot | splash 1200 ms (logo +8 dp at 600 ms) → home cross-fade 300 ms ease-out | A 0.55–7.29, A 10.118–10.40 |
| Number keyboard | up 180 ms, starting 500 ms after the push settles; down 150 ms | B 10.81–10.99, 31.33–31.47 |
| Korean keyboard | up 240 ms, starting 400 ms after the page settles | B 101.56–101.80 |
| Sheet | scrim 230 ms; card 100 ms; close 100 ms | B 31.35–32.10, 36.83–36.93 |
| Dialog | 160 ms in, 130 ms out | B 49.72–49.88, 51.27–51.40 |
| Bank chips | 350 ms debounce, then 350 ms fade | B 16.18–16.53 |
| Expand (내 계좌) | height 200 ms, then rows fade 100 ms | A 117.64–118.03 |
| 다음 bar | slide up 130 ms | A 129.60–129.73 |
| Sending min | 1.4 s (coin loop ≈ 1.1 s) | B 66.708–68.108 |
| Check lottie | 650 ms after a 200 ms empty slot | B 68.30–68.95 |
| Toast | §3.3 | — |
| 통장 entry (clone) | toast 0–200 ms; bar 150 ms; skeleton step 850; balance 900; mini-list skeletons 1050; interest row 1150; all content 1300; banner expand 1800–2350 ms | account §3.2 |
| Recorder blink | 1000 ms, 50 % duty | infra §1.2 |

---

## 4. Build split

### 4.1 Foundation (sequential; must land before the parallel areas start)
The ordered checklist comes from infra.md §2–§3 plus the decisions above. Each item is gated, so the other 8 servers render byte-identically.

1. **Server plumbing**:
   - `db.mjs`: `APPS += "toss"`, the error text, the header comment.
   - `index.mjs`: port map `toss: 9117`, `<title>` "토스", DELETE message map.
   - `.gitignore`: `server/data-toss/`.
2. **Schema**: the `migrate()` columns and the toss tables (§2.1).
3. **Seeds**: `server/toss-seed.mjs` (`seedTossExample`, `seedTossEmpty`, relative-date helpers c/p/q) and `SEEDS.toss`. First boot must not crash.
4. **Shared endpoint gates** (§2.4 table): `/api/home` toss block, `toAccount` / `listTransactions` fields, `txDetailJson` counterparty, recipients `recent` and `mine`, `POST /api/accounts`, PATCH extensions.
5. **New endpoints**: `server/toss-api.mjs` (spend, assets, cards, points, shared `tossSpendTotal`), registered with one gated line.
6. **Client plumbing**:
   - `session.ts`: `AppName`, APP parse, `APP_NAME.toss = "토스"`, `TOSS`.
   - `vite-env.d.ts`, `.env.toss`.
   - `package.json`: `dev:toss`, `start:toss`.
   - `vite.config.ts` proxy `toss: 'http://localhost:8795'`.
7. **Locks**:
   - `platform.ts`: `DEVICE_LOCK … APP === "toss" ? "android"`.
   - `theme.ts`: `darkOnly`, `THEME_LOCK`, `THEME_CHOICE`.
   - `OsSwitch`: `!THEME_LOCK`.
   - DevPanel BasicForm: hide 기기 and 테마 for toss.
   - `ProfilePicker.enter()`: use `TOSS` for both `os` and `theme`, not `DEVICE_LOCK` (the kakao2 / ibk2 lesson).
8. **Device chrome** (§3.1):
   - `global.css` frame size.
   - PhoneFrame toss branch: `TossStatusBar`, nav band classes, 12-hour clock.
   - `src/toss/Inset.tsx` for Login and ProfilePicker.
   - Login / Picker status-bar bg `#171619` and `.login--toss` / `.picker--toss` CSS.
   - AppBrand `TossAppIcon`.
   - Mobile rules.
9. **ScreenStack toss branch**:
   - `TOSS_ANDROID`, `tossAnimFor`, `layer--toss-*` classes.
   - Keyframes in `src/toss/nav.css`: push and pop, including band hold and revealed-content settle; cut, fade, reveal.
   - `animationend` cleanup.
   - `NH_ANDROID` stays as it is for the others.
10. **App.tsx**:
    - `renderTossRoute` in ROUTES (`src/toss/routes.tsx`).
    - Overlay `toss: <TossOverlay/>` (LoadingLayer, Toast).
    - Splash chain: `APP === "toss" ? <TossSplash onDone={toReady}/>`. The stub is replaced by the home area.
11. **`src/toss` shared modules and `src/toss/ui/*`** (§3.3), plus `toss.css` tokens. `flow.ts` and `nav.ts` helpers.
12. **Shared assets** (§5.1): `toss-symbol.png`, `toss-app-icon.png`, `toss-symbol-grey` (or a CSS tint), and BankLogo fills.
13. **Stubs**: one stub component per route in its **area folder**, so routes.tsx type-checks and each area starts by replacing files it already owns. DevPanel mount points with stubs in `src/toss/devpanel/`.
14. **DevPanel generic bits**:
    - `OWN_BANK.toss`, `ownBank()` / `AddPayee` chains, `ownHint.toss`.
    - Both "토스뱅크 계좌 추가" and "다른 은행 계좌 추가" (with name, `exclude=[]`).
    - `CardEditor` for toss.
    - `.dev-panel--toss` CSS.
15. **Verify**:
    - `npx tsc -p tsconfig.app.json --noEmit` and `npm run build`.
    - `npm run dev:toss` boots, then splash stub, then home stub; API smoke on every endpoint in §2.4.
    - **Other 8 apps unchanged** (kakao2 method): a baseline worktree vs this tree; same requests diffed; screenshots of each app's home and one push frame at 60 / 150 / 300 ms.
    - grep for `APP ===`, `APP !==` and `[APP]` across the 11 files from infra §3.

### 4.2 Parallel areas (strict ownership; nobody edits another area's files or any foundation file)
| area | owns (create / edit freely) | routes | asset prefix / script | consumes |
|---|---|---|---|---|
| **A1 home** | `src/toss/home/**` (TossSplash, TossHome, TabBar, TabPlaceholder, AllMenu, AdCoupon, AdPayback, home css) | `/`, `/tab/*`, `/ad/*` | `src/assets/local/toss-home-*`, `scripts/toss-crops/home.py` | `/api/home` toss block, flow helpers, Toast, Odometer, LoadingLayer (wait box), BankLogo |
| **A2 account** | `src/toss/account/**` (BankScreen + product-menu data, History, TxDetail, OtherAccount, banners, entry timeline) | `/bank/*`, `/tx/:id`, `/account/:id` | `toss-acct-*`, `scripts/toss-crops/account.py` (uses the existing scratch manifests) | accounts / transactions / tx-detail endpoints, Toast, ProgressBar, Skeleton, `goSend` |
| **A3 transfer** | `src/toss/transfer/**` (S1–S8, BankSheet usage, AmountKeypad, KoreanKeyboard, hangul composer, coin and check animations) | `/send/*` | `toss-send-*`, `scripts/toss-crops/transfer.py` (optional: list squircle references only) | recipients, lookup, transfers, payees, accounts PATCH, Sheet, Dialog, Button, LoadingLayer, HanaKeyboard, `sendFinish` |
| **A4 cert** | `src/toss/cert/**` (H, I, A, L, M, W, D, V, `TransferCertDoc`, watermark, placeholder seal) | `/cert/**` | `toss-cert-*` (mostly SVG) | `/api/home`, `/api/transfers?from=`, Button, ProgressBar, Skeleton, BankLogo |
| **A5 assets + panel** | `src/toss/assets/**` (Spend, Assets, MyAccounts, PullToRefresh, category icons), `src/toss/devpanel/**` | `/spend`, `/assets`, `/assets/accounts` | `toss-assets-*`, `scripts/toss-crops/assets.py` | `/api/toss/spend`, `/api/toss/assets`, cards and points CRUD, Odometer, BankLogo, `useTossBand("scrim")` |

**Rules:**
- **Frozen files.** Shared files (`src/toss/*.ts(x)`, `src/toss/ui/**`, `toss.css`, `nav.css`, server files, DevPanel.tsx, PhoneFrame, ScreenStack, App.tsx) are frozen during the parallel phase.
  - If an area needs a change there, it adds a local wrapper in its own folder.
  - It also records a **change request** in its hand-off summary. The integrator applies change requests after the merge.
- **No cross-area imports.** Areas navigate by path and helpers only, never by importing another area's components.
- **Naming.** CSS classes and keyframes use area prefixes: `toss-home-`, `toss-acct-`, `toss-send-`, `toss-cert-`, `toss-assets-`.
- **Crop scripts** follow the repo pipeline:
  - frames from the videos, crop box, Real-ESRGAN ×4 (`scripts/ibk-crops/esrgan.py`, model `RealESRGAN_x4plus_anime_6B.pth`), key out the background, then downscale to 4 px/dp
  - respect `scripts/keep_assets.py` (no overwrite without `--force`)
  - **open every crop and check it before committing**
- **Data.** Areas do not change seeds or endpoints. If a screen needs data that is missing, the screen degrades gracefully and the gap goes into the change request.

### 4.3 Integration step (after the merge)
1. Apply the change requests.
2. Cross-flow runs (§7.6).
3. Fast-tap and mid-transition back stress (kbank / kakao2 checklist).
4. Profiles: example, empty, a new profile.
5. Mobile viewport.
6. Other-app regression again.
7. Docs: README "## 💙 토스 (toss)" and SOLUTION "## 26. 토스 (toss)" (infra §2.19), including the decisions in §0 and this pass's measurements.

---

## 5. Assets

All boxes are video px (x0, y0, x1, y1) on the 480 × 1066 frame at the given pts. "OK" means the box contains a logo, icon or generic art only. Every crop is still opened and inspected before commit.

### 5.1 Shared (foundation)
| asset | source | box | method | privacy |
|---|---|---|---|---|
| `toss-symbol.png`: 3-D blue Toss symbol (splash 124.8 × 115.2 dp; scaled down for the toast, account icon and BankLogo toss glyph) | A splash average 1.0–5.5 s (`frames/infra/splash_avg.png`) or A 3.750 | 156,454,324,610 | average, ESRGAN ×4, key out #171619, alpha PNG | OK (public brand mark) |
| `toss-app-icon.png` (Login, Picker, Admin) | composed: white rounded square with `toss-symbol` | — | script (no network). An App Store original via iTunes lookup is optional if network allows | OK |
| grey header Toss mark | CSS tint (`filter` / mask with a #878d94→#9aa0a8 gradient) of `toss-symbol` | ref A 10.698 28,54,62,84 | — | OK |
| bank glyphs | existing `src/assets/local/hana-bank-<code>.png` (all 61 codes) inside the `BankLogo` squircle | refs: transfer B 8.500 x 29–80 rows 526–578 / 696–748 / 782–834 / 867–919; B 88.750 440–492, 782–834; A 118.056 489–541; assets `crops/logo_*` | CSS squircle + glyph; crops are **references only** | OK |

### 5.2 Home (A1)
| asset | source | box | method | privacy |
|---|---|---|---|---|
| half-card illustrations (convenience store, iced coffee + barcode) | B 136.113 | 140,662,226,734 · 380,662,452,734 | ESRGAN ×4, key out card + glow | OK |
| list icons 계좌 개설 / 토스쇼핑 / 체크카드 혜택 추천 | B 136.113 | 38,766,74,800 · 38,826,74,860 · 38,888,74,924 | crop ×4, or SVG | OK |
| 오늘의 딜 teal mark | A 10.698 | 360,817,412,869 | crop ×4, or SVG | OK |
| calendar lottie key frames (+, ₩, flip) | B 128.650 / 129.251 / 127.990 | 176,232,338,406 | crop ×4; 1.9 s cross-fade loop | OK (the heads-up pill is outside the box) |
| coupon "5000" image | B 74.942 | 28,638,104,684 | crop ×4 | OK |
| **SVG**: points icon (P), Face-ID banner icon, Pay brackets, bell + dot, 방문한 서비스 ticket, tab icons (outline and filled), Toss toast logo (use the symbol) | — | — | draw | OK |
| **invent, never crop**: recently viewed product thumbnail, ad advertiser logo, ad disclosure line | A 10.698 362,666,410,716 / 398,934,446,976 | — | letter avatar or simple illustration | NOT OK to crop |

### 5.3 Account (A2)
| asset | source | box | privacy |
|---|---|---|---|
| T1 Toss Bank tile (prefer `toss-symbol` in a 30 dp tile) | A 25.970 | 24,340,64,380 | OK |
| T2 interest bolt circle (SVG preferred) | A 25.970 | 28,520,68,560 | OK |
| T3–T5 체크카드 / 비상금 / 자동이체 tiles | A 25.970 | 24,836,64,876 · 24,892,64,932 · 24,951,64,991 | OK |
| T6–T9 추천 icons | A 26.888 | 24,615,64,655 · 24,679,64,719 · 24,736,64,776 · 24,793,64,833 | OK |
| T10 promo "NEW" deposit book | A 28.251 | 28,493,150,616 | OK |
| T11–T12 유용한 정보 thumbnails | A 39.322 / 39.102 | 22,450,98,522 · 22,563,98,635 (key out the press tint) | OK |
| B1 banner art 자동이체 가져오기 (before its text appears) | A 23.439 | 0,102,480,328 (paint out x < 7, the Edge handle) | OK |
| B2 banner art 새로운 예금 | B 3.932 | 0,102,480,328 (paint out x < 7) | OK |
| T15–T18 거래내역 icons: transfer ₩, cashback medal, interest receipt, generic dots | A 51.047 (T15, T16) / A 53.9996 (T17, T18) | 28,580,82,634 · 28,692,82,746 · 28,138,82,192 · 28,358,82,412 | OK |
| T19 상세 증명서 doc icon | A 59.511 | 30,770,66,808 | OK |
| T20 other-bank cashback tile | B 164.003 | 28,312,78,362 | OK |
| L1–L67 product-menu icons (24 dp) | per `frames/account/icons/manifest.json` | 40 × 40 px each | OK. Key out the pressed or scrollbar tint on `tongjang_biz`, `refi_credit`, `fx_remit`, `check_kid`, `svc_miracle_morning` |
| **SVG**: back, gears, card icon, chevrons, ×, magnifier, ✓, spinner, "T", mailbox (or crop), underline, skeleton | — | — | OK |
| **never crop**: native ad logos, merchant brand logos → letter avatar or dots icon | — | — | NOT OK |

### 5.4 Transfer (A3)
- **CSS / SVG only:** back, camera, star (off #413f42 / on #ffc342), chevrons, ⓧ, blue shield, keypad ←, white check, loading spinner, 3-dot loader, the sending **coin** and the **drop→check** animations (not croppable at usable resolution), the Korean keyboard (same frame as HanaKeyboard).
- List and sheet logos come from `BankLogo` (§5.1).
- No crops are needed.

### 5.5 Cert (A4)
| asset | how | privacy |
|---|---|---|
| C1 / C2 account tiles | `BankLogo` variant `tile` (toss symbol / hana glyph); refs A 71.773 (28,290,69,330) and (28,444,69,485) | OK |
| C3 "toss bank" symbol + wordmark (black) in the document | **SVG redraw** (ref A 92.236, 32,738,102,754; too small to crop) | OK |
| placeholder seal | SVG: red `#e5484d` double ring ⌀30.6 with "연습용" | the real seal is never reproduced |
| watermark | CSS: "연습용 화면 · 실제 이체 아님", −30°, 3 × 2 per page, `rgba(240,68,82,.16)` | required |
| icons (search, share, check circle, chevrons), rings, progress bar, shimmer | SVG / CSS | OK |
| **never crop** from L, D or V frames (names, numbers, amounts) | — | — |

### 5.6 Assets area (A5)
| asset | how | privacy |
|---|---|---|
| bank squircles (toss, hana, kakao, nh) | `BankLogo` (§5.1); refs `frames/assets/crops/logo_*.png` | OK |
| card plates: 프렌즈 체크카드 (yellow), Young Hana+ 체크카드 (mint) | CSS (29.6 × 43.2, radius 2.4). The mint plate may use `crops/card_plate_mint.png` (asset_top px 38,660–77,717), ESRGAN ×4 | OK (product art, no number or name) |
| card plates for the invented cards (토스뱅크 체크카드, 토스유스카드) | CSS (invented colours) | OK |
| 소비 category icons (이체 ₩, cashback, store, invented categories), refresh blob, ◂ ▸, ⋯, plus | SVG (36 dp squircles) | OK |
| **never crop**: merchant brand logos in 소비 | category icons instead | NOT OK |

---

## 6. Contradictions resolved and open questions

### 6.1 Resolved contradictions
| # | topic | specs | resolution (evidence) |
|---|---|---|---|
| R1 | Nav band | infra: 15 dp band #171619 · home: no band, tab bar under the handle | **Band exists** (content always clipped at video y 1047, 4 fps scan of both videos). Four modes (§0.4), including a new **소비 scrim mode** no spec had (B 140.75–149.25: Hana-teal icon visible through the band at α .43) |
| R2 | Tab bar positions | infra: 5 × 76.8 equal · home: centres 50 / 120.4 / 190.4 / 261.2 / 331.6 | home.md (re-measured icons 50.0 / 120.0 / 190.4 / 260.8 / 331.2, labels 50.4 / 120.4 / 190.8 / 261.2 / 331.6) |
| R3 | Push curve | home 400 ms expo-out +150 · account +33 dp / 270 ms · transfer +160 / 450 ms easeOutExpo · cert 400 ms (.05,.7,.1,1) · assets 380 ms · infra 60–80 ms cross-fade | **one curve**: 400 ms (.05,.7,.1,1) from +150 dp (fit across 3 pushes, RMS 1.7 dp). account's +33 = late first frame. infra's cross-fade = the old-page fade. assets' "S4 fades in" = same push (B 161.33: +92 dp) |
| R4 | Pop | home: previous page appears at the end with no animation · account: with fade · transfer / cert / assets: no fade, revealed page −5.6 / −6.4 → 0 | no fade; revealed page shows background only, then content −5 → 0 over 120 ms (B 54.39–54.66) |
| R5 | Status-bar black during push | home / account / assets: optional system flash · infra: NH band via `useStatusBar` | it is the gap above the moving window → **overlay status bar plus page-painted band** reproduces it for free; scrims dim the band but not the text (B 33.5) |
| R6 | Page background | account `#17171c` · others `#171619` | `#171619` (#17161b readings are chroma noise; both appear within one frame) |
| R7 | Toast geometry | home: 207 × 49.5, text 16 SB · account: 200 × 48.8, text 17 SB | home.md (re-measured: pill x 88–295.2, y ≈ 28–79.2; blue logo 107.2–124.8 dp; "토스뱅크" 128.8–185.6; white text to 275.2) |
| R8 | Spend total | home: card / pay only · assets: counted incl. transfers to others | assets.md rule, one `tossSpendTotal` (§2.2) |
| R9 | 통장 row tap / label | brief: tx row → 상세, "이번 달 받은 이자" | account.md: mini-tx row → **거래내역**; label "**어제까지 쌓인 이자**" |
| R10 | "Long menu" location | brief: separate 전체 menu | part of the **통장** page (account.md, one continuous 4895 dp scroll). 전체 메뉴 is the 5th tab (invented) |
| R11 | CTA radius | transfer 14.4 · cert / account 16 | **16** (re-measured 15.0 on B 37.0 and 16.8 on B 64.5) |
| R12 | Disabled CTA | transfer `#1f355e` / `#4e5c79` · cert `#1e355b` / `#4c5f7e` | `#1e355b` / `#4d5e7c` |
| R13 | Progress bar colours | four different samples | one component: track `#4c4e55`, fill blue .75; tune by overlay (§3.3) |
| R14 | 3-dot loader | transfer 750 ms with scale · cert 900 ms opacity only | transfer.md values everywhere |
| R15 | Incoming counterparty storage | account: new `cp_*` columns | existing sender-record mechanism plus a toss `in_tx_id` lookup (§0.10) |
| R16 | 토스머니 | home: profile column · assets: synthetic account · transfer: needs a 내 계좌 row | real `accounts` row, `role = 'money'` (§0.8) |
| R17 | Unbuilt controls | home / account / transfer / assets: toast "준비 중이에요" · cert: no-op | repo convention: no-op; tabs → placeholder screen (§1.6) |
| R18 | Recorder icon | home: not cloned · infra: only while recording | only while ● 녹화 runs |
| R19 | Edge-panel handle | infra: optional · account / home / assets: never | not drawn |
| R20 | Ad pages after transfer | home: show · transfer: default none | show, with snooze (§0.11) |
| R21 | Status bar on cert H | cert: #171619 over a #100f12 page | kept: `TossPage band="#171619"`, header #100f12 |
| R22 | Lock screen | home: optional `?lock=1` | skipped, no flag |
| R23 | Splash length | recording 6.75 s + black 1.3 s | 1.2 s splash, 300 ms cross-fade; black (FLAG_SECURE) not reproduced |
| R24 | `mine` and the sender | infra: let the transfer spec decide | exclude `from` (recording "+4개") |
| R25 | Toast hold on 통장 entry | account: out at 900–1100 ms · home: ≥ 1.45 s | out at max(entry + 1450, ready + 100) |

### 6.2 Remaining open questions, each with the chosen default
| # | question | default |
|---|---|---|
| Q1 | Status-bar right cluster | fixed recording cluster (battery-protection, alarm, mute, Wi-Fi ↑↓, signal, %, charging), as one SVG |
| Q2 | 12-hour clock | toss only, `h:mm` without AM/PM |
| Q3 | ≤ 500 px phones | hide the fake bars; safe-area insets |
| Q4 | 페이·기타 | `channel = 'pay'`; no new tag |
| Q5 | Seed dates | relative with clamping (§2.3) |
| Q6 | Home content below the list card | invented card (내 신용점수 보기 / 자산 추가하기, both no-op) plus a 화면 편집하기 footer (no-op); filled tab icons for the placeholder screens |
| Q7 | Home ad card copy | layout kept; **copy invented** (e.g. "내 신용점수 30초 만에 확인" / "조회해도 점수 영향 없어요 · AD"); invented advertiser avatar; no disclosure name |
| Q8 | Which ad page | move → coupon (REVEAL, FADE out); send → payback (PUSH + "토스로 이동했어요" toast, POP out). One snooze for both |
| Q9 | WebView delays | compressed: 통장 entry 1.3 s, 거래내역 / 상세 content ≤ 500 ms, cert I 600 ms, W 2.6 s, LOAD ≥ 400 ms, 소비 skeleton ≥ 300 ms, 자산 cards +150 ms |
| Q10 | 통장 banner per visit | alternate per app session visit (1st 자동이체 가져오기, 2nd 새로운 예금, …); × hides for the session |
| Q11 | 통장 24 dp and 상세 28 dp font sizes | keep; confirm by overlay in acceptance |
| Q12 | WebView scrollbar | not drawn |
| Q13 | ★ on own rows | `accounts.favorite` |
| Q14 | 지역농협 vs NH농협 | always NH농협 / 농협 short names |
| Q15 | Korean keyboard | on-screen 두벌식 composer plus a hidden input for physical keys |
| Q16 | Auth after 보내기 | skipped (dots about 1.0 s, then S7) |
| Q17 | 교보SBI저축은행 | tile shown, tap no-op |
| Q18 | Other cert rows / search | no-op |
| Q19 | Cert safety | watermark on preview and viewer, placeholder seal, "연습용 문서 · 진위확인 불가", phone 0000-0000, dummy issue number, no download, no print |
| Q20 | Cert WebView quirks | +53.6 dp jump not reproduced; faint skeleton on I **kept** (Skeleton primitive) |
| Q21 | Cert selections on back | reset (as recorded). ScreenStack keeps layers mounted, so reset on `useLayerActive` re-activation |
| Q22 | 확인했어요 | `certExit()` → 상세 with POP |
| Q23 | Many cert rows | multi-select, 15 rows per document page, "p/n" footer, V stacks pages |
| Q24 | 내 계좌 송금 on other banks | no-op |
| Q25 | 자산 odometer | only for values changed since the last visit |
| Q26 | 전체 메뉴 content | assets.md §5.4 sections 자산 / 토스뱅크 / 설정, with links |
| Q27 | 혜택 / 쇼핑 / 증권 | placeholder tab screen |
| Q28 | Back to home from 토스뱅크 | no cold reload; recompute and roll changed values |
| Q29 | Home 송금 (row 1) | toast "토스뱅크로 이동했어요", then LOAD → S1 |
| Q30 | Interest accrued | formula in §2.2 |
| Q31 | "내 자산 N개" | count of toss-bank accounts (통장 + 토스머니) |
| Q32 | Lottie animations (coin, check, calendar) | CSS / SVG approximations (coin, check); calendar from 3 cropped key frames |
| Q33 | Black FLAG_SECURE stretches (A 7.31–8.55, A 79.08–80.90, B 112.13–113.92) | never reproduced |
| Q34 | Heads-up notifications from other apps | never reproduced |

---

## 7. Acceptance checks (the reviewer compares against the video)

**Method.**
- Run Playwright at viewport 384 × 853.33 with `deviceScaleFactor: 1.25`, so screenshots are 480 × 1066 like the video.
- Freeze the clock and battery to the recording's look (12-hour clock).
- Compare against the listed reference frames side by side and as a 50 % overlay or difference. **Mask regions that contain personal data in the reference.**
- Tolerances:
  - geometry ±1 dp (±0.5 dp for text baselines in headers)
  - colours ±3 per channel
  - durations ±1 frame of the 60 fps capture
- Motion is checked by capturing rAF-timed frames and comparing offsets with §3.4.
- Privacy: grep the diff for any non-UI string. Every committed PNG is opened and looked at, and none comes from an L, D, V or list frame.

### 7.1 Foundation
1. `tsc` and `npm run build` are clean. `dev:toss` boots. `server/data-toss/` is created. Both example and empty seeds load.
2. The other 8 apps are byte-identical: API responses for the 46 kakao2 regression requests, plus screenshots of home and of one push at 60, 150 and 300 ms.
3. Status bar against A 11.0 / B 8.5:
   - clock at x 28, 12-hour
   - right cluster x positions (infra §1.2)
   - overlay, so the clock stays bright under a sheet scrim (B 33.5)
4. Nav band colours in each mode (§0.4) and the handle 115.2 × 4.2 at y 843.7.
5. A stub push and pop match the §3.4 offsets at +16, +97, +192 and +293 ms (push) and +40, +90 and +130 ms (pop), including black in the status area at +100–150 ms.

### 7.2 Home (A1)
- Splash against A 3.750 (logo box 128.8–253.6 × 368–483.2 dp; 8 dp drop). Home cross-fade 300 ms.
- Home against **A 10.698** (header, banner, cards 1–4) and **B 136.113** (half cards, list card):
  - card x 12–371.5, radius ≈ 22.8, gaps 9.4
  - row pitch 52.8
  - small buttons 52.1 × 31.7
  - tab bar from 780 with centres R2
- Press state: row highlight `#2a2b30` with the button at `#3b3c41`; release fades in 170 ms; navigation at +120 ms.
- Toast against A 16.503 (§3.3 geometry) and its timing (enter spring, hold rule, exit 200 ms).
- Ad pages against **B 74.942** (coupon) and **B 129.251** (payback). Coupon content fades in 300 ms; dismiss FADE 90 ms. The payback calendar loops at 1.9 s.
- Banner × collapse. The odometer rolls only changed digits after a transfer (B 149.45–149.97 style).
- Tabs switch instantly; the placeholder screens show the filled icon; back returns home.

### 7.3 Account (A2)
- 통장 against **A 25.970** (with banner) and A 21.8–22.7 (no banner):
  - title row, account line with underline, balance 24 B, interest row, mini list pitch 32.4, 채우기 / 보내기 168 × 42
  - rows from 489.6, section band 628–644
- Product menu: section header offsets match account.md §2.4 brackets (±2 dp) against the stitched page (`frames/account/pageA.png`). Max scroll 4895 dp with the banner.
- Entry timeline (§3.4) and the banner reveal (expand 550–600 ms; title fades in centred, then moves up 18 dp).
- Header title fades in at threshold 186 / 367 dp.
- 거래내역 against **A 51.047**: balance 30 B, row pitch 58.4, date header +31.2, bottom bar 56 dp with a 40 dp fade. Scroll-linked header. ✓ transient for 1 s.
- 상세 against **A 57.75–60.9** (credit, own transfer: 입금처 / 출금처 rows) and **A 105.76** (debit: 받는 분 통장표시). Amount 28 B white.
- S4 other-bank against **B 163.5**: spinner then ✓, balance shimmer, row pitch 65.6, `MM.DD` dates, blue deposits without "+".

### 7.4 Transfer (A3)
- S1 against **B 8.500** (collapsed) and **A 118.056** (expanded):
  - sticky 28–212.1
  - rows 68 dp, squircle 40 r 14
  - "+N개 ∨"; expand 200 + 100 ms
  - own accounts mixed in 최근 보낸 계좌 with "내 …"
- S2 against B 11.111 (empty with keyboard), 14.678 (pill), 16.679 (chips), 29.936 (bank set, 확인 above the keyboard), 36.981 (keyboard hidden):
  - chip debounce 350 ms
  - keyboard up 180 ms after a 500 ms delay
  - band `kb` #090909
- S3 sheet against **B 32.202**: grid 99 × 85, pitch 93.7, exact bank order; scrim .61, band `dim`.
- S4 against **B 45.030 / 48.212** and **A 130.500** (red error "출금할 수 있는 돈이 0원이에요." with the empty seed): 다음 bar 518–574, slide 130 ms; keypad 4 × 66.
- D1 against **B 51.012**: web-area scrim only.
- S5 against **B 63.727** (옮길까요) and **97.514** (보낼까요); S6 against **B 104.140 / 105.761**; S7 against **B 115.801**; S8 against **B 69.609 / 118.211**:
  - 옮기다 / 보내다 wording rules
  - check lottie 650 ms after 200 ms
  - sending ≥ 1.4 s
- Motion: S1→S2 push against B 9.94–10.34; S4→S2 pop against B 54.40–54.66.
- Server effect: own transfers create the deposit; `recent` updates; the memo shows on the receiver's 상세.

### 7.5 Cert (A4)
- Screens: H against **A 62.677**, I against 68.449, A against 71.155 / 71.773, L against 74.167 / 74.767, M against 76.040, W against 77.7–83.3, D against 83.816 / 89.341, V against 92.236.
- Rings: r 0→184 dp over 2.0 s, a new ring every 1.28 s. Title shimmer 2.3 s.
- Document geometry at 4× scaled by 0.9348 (D) and 1.0 (V): title ink 37.6, 180.8 in D (±0.5).
- Transitions: H, I and V push / pop (T1 60.162, T4 95.34); steps CUT, with selections reset on back; W not in history.
- **Safety:** watermark visible on D and V, placeholder seal, dummy verify text and phone number, no download or print anywhere.

### 7.6 Assets (A5) and cross-flow
- 소비 against the **B 142.62–144.37 average** (summary, bar segments with 2.4 dp gaps, legend, week strip 51.2 columns, selected circle ⌀40 #100f12, rows 72.8). Sticky strip at 121.6–264 and scroll-spy switching (B 145.76, 146.95, 148.01). **Band `scrim`.** The total equals home "{M}월에 쓴 돈".
- 자산 against the **B 154.60–155.78 average**:
  - cards x 10.4–373.6, radius 22, gap 8.8
  - rows 57.6 / 58.4
  - indicator 96.8 sliding 250 ms; tabs sticky at 81.6–132.8
  - pull-to-refresh blob and header dim (B 157.30–158.62)
- 내 계좌 against the **B 168.60–170.95 average**: segmented 162.4 × 41.6, rows pitch 56.8, floating pill 336 × 51.2 at 751.2.
- 🔔: every row of §2.5 changes the listed screens after save.
- **Cross-flow runs:**
  - home → 통장 → 거래내역 → 상세 → 증명서 → doc → back to home
  - home 송금 / 통장 보내기 / 거래내역 보내기 / 자산 송금 → transfer, both move and send → ad pages → launcher
  - home → 소비 → back with the odometer
  - home → 자산 → other-bank → 내 계좌 → back
  - Galaxy back at every step closes sheets and keyboards first
  - double taps never stack duplicate entries

---

## Appendix: evidence gathered in this synthesis pass (scratch: `frames/plan/`)
- `band_A.raw` / `band_B.raw` (4 fps, rows 1036–1065): run list of band colours. Solid #171619 everywhere; #090909 during keyboard spans (B 11.0–31.25, 56.0–59.0, 101.75–104.75); #050407 under the sheet (B 31.5–36.75); **#0d0c0f translucent over content during 소비 (B 140.75–149.25)**; #08070a during the FLAG_SECURE blacks.
- `pushA14/`, `pushA45/`, `pushB10/`, `pushB161/`: back-arrow and first-bright-row tracking. The new page's offsets fit 400 ms `(.05,.7,.1,1)` from +150 dp. The old page is gone after 40–70 ms. The status area is black at +97–150 ms.
- `popB54/`: closing page offsets +0.8 → +37.6 dp over ≈ 130 ms, no black rows below the status bar; revealed page appears at −4.8 dp and settles by +120 ms.
- `misc/A00347_016.503.png`: toast pill and text extents (R7). `misc/A00175_011.013.png`: tab centres (R2). `misc/B01153_037.001.png` and `B02493_064.509.png`: CTA radius 15.0 / 16.8 (R11). `misc/B00981_033.502.png`: status text undimmed under the scrim (R5). `bg/`: page colours (R6).
