# allone (NH올원뱅크) — 거래내역조회 · 거래내역 상세 spec

Area owner: account. Source: **C2** (`c0997302-…_1_4.mp4`), pts 8.9–21.2 s. Device: iPhone 1180×2556 px = 393×852 pt, **1 pt = 3.0025 px**. All coordinates below are **pt from the top-left of the screen** (= CSS px in the clone's 393×852 iPhone frame).

Timing method: real pts from `ffprobe -show_entries frame=pts_time`. C2 starts at pts 0.0243 with a steady ~16.67 ms step (no VFR gaps in this range). Every time in this spec is the pts of the first frame that shows the change. Colours were sampled from full-res frames and are the median of the darkest ink or a flat area. Font sizes come from fitting rendered **Pretendard** (repo `node_modules/pretendard`) to the measured ink width. Weights come from comparing stroke coverage.

Font note: the app's face looks Pretendard-like, but at the same width its Hangul ink is about 4–5 % taller than Pretendard's. It is probably the system Apple SD Gothic Neo or a custom NH face. The clone uses Pretendard at the sizes below, which match widths within about 0.5 pt.

Privacy: no personal values appear in this file. Names, account numbers, amounts, balances and dates are placeholders (see §6).

---

## 1. Screen inventory (C2)

| # | Screen / state | pts range | Notes |
|---|---|---|---|
| A0 | Home, tap on account card **거래내역** | 8.991 | spinner at 8.991, dim at 9.008 (no visible pressed state on the button) |
| A1 | Loading: dim 0.53 + all-one spinner over **home** | 9.008 – 9.974 | at 9.958 the list is already painted under the dim (one frame without its nav row; ignore) |
| L0 | **거래내역조회**, first paint (an extra 32 pt blank sits under the buttons) | 9.991 – 10.191 | dim removed in one frame. No slide, no fade |
| L1 | 거래내역조회, settled layout (blank collapsed) | 10.208 – 11.424 | everything below the buttons jumps up 32 pt in one frame |
| L2 | 거래내역조회, user drag-scroll | 11.441 – 12.074 | two drags. The content ends at max scroll = **43 pt** |
| L3 | 거래내역조회, scrolled 43 pt (잔액 row hidden under the sticky account block) | 12.091 – 14.258 | |
| D1 | Tap on row 3 (**입금** row), loading dim + spinner over the list | 14.274 (spinner) / 14.291 (dim) – 14.441 | dim deepens 0.54 → 0.61 |
| T-IN | **거래내역 상세, 입금** (incoming) | 14.458 – 15.791 | instant full-screen swap |
| C1 | 확인 → back to list (instant, scroll kept at 43 pt) | 15.808 | no dim, no pressed frame captured (quick tap) |
| D2 | Tap on row 2 (**출금** row), loading | 16.558 (spinner) / 16.574 (dim) – 17.641 | dim 0.54 → 0.64 (reaches 0.64 at about 16.86) |
| T-OUT | **거래내역 상세, 출금** (outgoing) | 17.658 – 19.191 | |
| C2p | 확인 pressed (fill #004511) | 19.208 – 19.224 | |
| C2 | back to list (instant, scroll kept) | 19.241 | |
| P | **이체** (outlined) pressed (fill #EAFEEE) | 20.024 – 20.058 | released at 20.074 |
| D3 | Loading dim 0.53 + spinner over the list | 20.074 (spinner) / 20.091 (dim) – 21.124 | transfer page painted under the dim at 20.808 |
| X | **누구에게 보낼까요?** (transfer area, not specified here) | 21.141 → | dim removed in one frame |

Loading durations (tap → content visible): 거래내역 **1.000 s**, 상세(입금) **0.184 s**, 상세(출금) **1.100 s**, 이체 **1.067 s**.

Not in the recording (invented, §5): account-select sheet, filter sheet, 계좌관리, 잔액 숨기기 ON, empty state, paging, memo typing and save, filled star, 다시보내기 target, 자동이체 등록, back from the list.

---

## 2. Layout

### Shared tokens (measured)

| token | value |
|---|---|
| bg | `#FFFFFF` (status bar band, nav, sticky block and the whole page are white; no dividers or shadows under the nav or sticky block, even when scrolled) |
| text-1 | `#000000` (names, values, titles) |
| text-2 | `#3C3C3C` (labels, date line, filter text; measured #373737–#3E3E3E) |
| text-3 | `#666666`–`#686868` (account sub-line, per-row 잔액) |
| placeholder | `#898989` |
| red (출금) | `#E93535` (measured #EA3535 / #E8383A) |
| blue (입금) | `#1A5DD9` (measured #195DD9 / #1C5DD9) |
| green (brand) | `#0C8F2D` (button fill, 이체 border and text) |
| green pressed (filled) | `#004511` |
| green pressed (outlined) | bg `#EAFEEE` |
| line-1 | `#EEEEEE` 1 pt (row separators, memo field, detail card) |
| line-2 | `#DCDCDC` 1 pt (계좌관리 and 다시보내기 borders) |
| hairline | `#ECECEC` (the 1 px bar between time and 올원이체) |
| toggle off track | `#6D6D6D`, knob `#FFF` |
| NH blue | `#0052B3` |
| loading dim | `rgba(0,0,0,0.53)` |
| page side padding | 24 (separators and buttons run x 24 → 369) |
| status bar | 0–54 (shared overlay, other area) |
| nav row | 54–114 (60 tall, centre line y = 84) |
| bottom safe area | 818–852, white, **no home indicator drawn**. Scroll content is clipped at y = 818 |

### 2.1 거래내역조회 (list) — frame C2 pts 11.341 (settled, unscrolled)

**Fixed (sticky) part 0 → 202.8.** It never scrolls. Content scrolls underneath it, and its bottom edge clips the content at y = 202.8.

- **Nav row 54–114**
  - Back `‹`: glyph 9×16 at x 31–40, y 75.9–91.9. Thin chevron, stroke about 1.4, round caps, #000. Hit area 44×44 (x 13–57).
  - Title **거래내역조회**: centred (ink x 156.2–235.8), ink y 76.6–90.9. **16 px / 700**, #000.
  - Home icon: 18.7×18.7 at x 311.7, y 74.6. House outline (5-sided, rounded peak and corners), stroke 1.7. A short horizontal "door" bar inside the bottom: x ≈ 315.5–325.5, y ≈ 89.4. SVG.
  - Menu+search icon: 20.4×16 at x 347, y 75.9. Three 2-pt round-cap lines at y 76.9 / 83.9 / 90.9. The top line is full width (347 → 366). The middle and bottom lines are short (347 → ~353). A magnifier circle (r ≈ 4.5, centre ≈ 359.5, 84.5) has a handle to the bottom-right (≈ 366, 91.5). SVG.
- **Account block 114–202.8** (tappable as a whole → account sheet, §5)
  - NH logo: **40×40 at x 24, y 135.9**. iOS-squircle (corner fit r ≈ 15.5; use `border-radius: 15px` or a superellipse SVG), fill #0052B3. White **"NH"** about 18.5 px / 700, letter-spacing −0.3, centred (cap height 13.1). SVG/CSS, no crop needed.
  - Text column at x 72.9 (logo + 9 gap), max-width to 340, single line with ellipsis:
    - Line 1: product name (e.g. `NH X 카카오페이통장(비대면실명확인)`), **15.5 px / 500**, #000. Ink y 137.9–154.2, line box 22 (≈ 135–157).
    - Line 2: `NH농협은행` + 9 pt gap + `<ACCT_A>` (format `NNN-NNNN-NNNN-NN`), **13 px / 400**, #666666. Ink y 161.5–173.9, line box 18 (≈ 158.7–176.7).
  - `▾` chevron: 12.3×6.7 at x 350.7, y 141.5 (centred on line 1). Stroke 1.6, #000. SVG.

**Scroll content** (viewport 202.8 → 818). Positions are for scroll 0, settled.

1. **잔액 row** (scrolls; hidden under the sticky block once scrolled ≥ 22 pt): `잔액` **14.5 px / 400** #3C3C3C at x 28.3, ink y 209.8–223.2. Balance `<BALANCE>` (`N,NNN원`) **20 px / 700** #000, right edge x 363.7, ink y 207.8–225.1 (centre 216.5). The row has 4–5 pt extra inner padding on both sides (x 28 → 364).
2. **Button row**: top 254.5, height 42.5.
   - **계좌관리**: x 24–192.8 (168.8 wide), r 10, 1 pt #DCDCDC border, white. Label **16 px / 500** #000 centred (ink y 269.1–283.1).
   - Gap 7.7 (use 8).
   - **이체**: x 200.5–369, r 10, 1 pt #0C8F2D border, white. Label **16 px / 500** #0C8F2D. Pressed: bg #EAFEEE.
3. *(L0 only: a 32 pt empty spacer here, removed 0.217 s after first paint. Optional fidelity, see §3.)*
4. **Filter row**: `1개월 · 전체 · 최신순` (middle dots with spaces), **12.5 px / 400** #3C3C3C, right-aligned ending at x 337.1, ink y 352.4–363.7 (centre 358). `▾` 10×6 at x 352–362, y 355.7–361.7, stroke 1.7 #000. Tap target is the whole text + chevron → filter sheet (§5).
5. **Range + toggle row** (centre y 402.7):
   - Left: `<RANGE>` (`YYYY.MM.DD ~ YYYY.MM.DD`), **13 px / 400** #3E3E3E at x 25.
   - Right: `잔액 숨기기` **12 px / 500** #000 (ink x 276.1–328.7), then a 9 pt gap and the **toggle 28×18 at x 341, y 393.7** (pill). Off: track #6D6D6D, knob 14 Ø white, 2 pt inset, knob on the left.
6. **Separator**: y 456.6, 1 pt #EEEEEE, x 24–369.
7. **Transaction rows**: each row is **120 tall + 1 pt separator** (pitch 121). Separators sit at 456.6, 577.5, 698.4, 819.3… One also follows the last row. Use row padding 22.5 top/bottom with three 25-tall line boxes. Line centres sit at +35 / +60 / +85 from the separator bottom.
   - Left column (x 25):
     - Line 1: `YYYY.MM.DD` · 7.7 gap · `HH:mm:ss`, **13 px / 400** #3D3D3D (digit cap 9.3, ink y 486.3–495.9 in row 1). For **outgoing transfers** this is followed by a hairline bar (1 px wide, 10 tall, #ECECEC, at 8.3 after the time, ink y 486.3–496.3), then 5.3 gap and the type label `올원이체` (13 px / 400 #3D3D3D). The **incoming** row in the recording has **no bar and no label**.
     - Line 2: counterparty name `<NAME_x>`, **18 px / 500** #000 (ink ≈ 508.5–526.9).
   - Right column (right edge x 368, right-aligned):
     - Line 1: `출금` / `입금`, **14 px / 400**, red / blue (ink 486.3–498.6).
     - Line 2: amount `N,NNN원` (unsigned), **18 px / 600**, red / blue (digit cap 13.0, ink 509.6–522.6).
     - Line 3: `잔액 N,NNN원`, **13 px / 400** #686868 (ink 536.2–548.9). This is the balance after this transaction.
   - No pressed state on rows (white → dim in one frame).
8. **After the last separator**: about 40 pt bottom padding, then the end of the content. With 3 rows, max scroll = 43 (measured).

**Scroll behaviour**: native vertical scroll with iOS bounce. The nav row and account block stay fixed. Nothing changes in the header when scrolled (no title change, no shadow). The list scroll position is **kept** when a detail opens and closes (it was 43 pt on both returns).

### 2.2 거래내역 상세 (detail) — frames C2 pts 18.324 (출금) and 14.991 (입금)

Full-screen white page, no tab bar. It replaces the list instantly (§3). Nothing scrolls (content fits). The 확인 button is fixed at the bottom.

- **Header 54–114**:
  - Title `거래내역 상세` **left-aligned at x 24**, **16 px / 600** #000, ink y 76.6–90.9.
  - `×`: 16.7×16.7 at x 348.7, y 75.6. Two diagonal strokes, 1.7 wide, round caps, #000. Hit area 44×44. Tap = same as 확인.
- **Name row** (top 124.9):
  - **출금**: name `<NAME_C>` **18 px / 700** #000 at x 24, ink y 131.6–147.5 (centre 139.5). Then 9 pt gap and **☆** outline 5-point star 14×14 at x 78.6, y 132.9, stroke 1.3 #000, round joins (SVG). Right side: **다시보내기** button at x 288.4–369 (80.6×30), y 124.9–154.9, r 8, 1 pt #DCDCDC border, white, label **13 px / 400** #000 centred. Row height 30.
  - **입금**: name only (no ☆, no 다시보내기). Line box 26 (124.9–150.9), ink y 129.6–145.5. The row is 4 pt shorter, so everything below moves up 4.
- **Memo field**: 32 below the name row (top 186.8 출금 / 182.8 입금). x 24–369, **height 54**, r 12, 1 pt #EEEEEE border, white. Placeholder `메모 입력 (최대 20자)` **17.5 px / 400** #898989, padding-left 20 (+1 border; ink starts x 45.3–46), vertically centred. Typed text: 17.5 px / 400 #000 (invented).
- **Info card**: 16 below the memo field (top 256.8 출금 / 252.8 입금). x 24–369, r 16, 1 pt #EEEEEE border, white. Height 278.8 (출금) / 162.9 (입금). Padding 20 on all sides (+1 border).
  - Labels at x 45.3: **14.5 px / 400** #373737.
  - Values right-aligned to x 348: **15 px / 500** #000 (digit cap 10.7–11.0).
  - Row line box 21, row pitch 37 (gap 16).
  - **Extra gap after 거래시간: the next row starts 62.9 below** (use margin-top 42).

  | row | ink top (출금) | value |
  |---|---|---|
  | 거래시간 | 281.8 | `YYYY.MM.DD` · 9.3 gap · `HH:mm:ss` |
  | 거래금액 | 344.7 | `N,NNN원` **15 px / 600**, red (출금) / blue (입금) |
  | 거래 후 잔액 | 381.7 | `N,NNN원` #000 |
  | 출금계좌 *(출금 only)* | 418.7 | 2 lines, right-aligned. Line 1 `NH농협은행` (14.5 px / 500). Line 2 `<ACCT_A>` hyphenated `NNN-NNNN-NNNN-NN` (15.5 px / 500, ink 440.3–452; line spacing 21.6) |
  | 입금계좌 *(출금 only)* | 476.6 | 2 lines. Line 1 counterparty bank name (e.g. `카카오뱅크`). Line 2 `<ACCT_C>` **raw digits, no hyphens** (ink 498.3–509.9) |

  The 입금 card ends after 거래 후 잔액 (bottom 415.7).
- **자동이체 등록 >** (출금 only): 13 below the card (ink y 552.2–564.9). Right-aligned: text **13.5 px / 400** #3C3C3C (x 277.4–350.7), then 7.7 gap and a `>` chevron 5.3×9.3 at x 358.4 (stroke 1.3 #000). The right edge is 363.7, about 5 inside the card edge.
- **확인**: fixed. x 24–369, **top 730.7, height 56** (bottom 787.3 → 30.7 above the safe area at 818). r 12, fill #0C8F2D, label `확인` **18 px / 600** #FFF centred. Pressed: fill #004511.

**출금 vs 입금 differences**: ☆ and 다시보내기 only on 출금. Amount colour red vs blue. 출금계좌 and 입금계좌 rows and the 자동이체 등록 link only on 출금. On 입금 the name row is 4 pt shorter, so the memo and card sit 4 pt higher.

### 2.3 Icons and crops

All icons are **SVG** (back, home, menu+search, ▾ ×2, ☆ and its filled state, ×, >, toggle) or **CSS** (NH squircle logo with "NH" text). No crops are required for this area.

- Optional NH logo reference crop: C2 pts 11.341, px box (72, 408)–(192, 528). Contents: brand mark only. **PRIVACY: SAFE**, but prefer SVG.
- **Do NOT crop** the account block text, any list row, the 잔액 row or any part of the detail card. They contain the recorder's account number, counterparties' names, amounts and dates.
- The all-one spinner is shared with the loading spec. Do not crop it from these C2 frames, because it sits on a 0.53 dim; use the C1 loading frames (other area).

---

## 3. Interactions and transitions (measured)

**The whole app swaps pages instantly.** No iOS push and no modal slide; every transition here completes in one frame. In the clone, use a "none" transition in the ScreenStack for these routes, not kakao2's bottom-up sheet. The edge-swipe back gesture was not observed; disable it to stay consistent with instant swaps.

| trigger | sequence (pts) | clone implementation |
|---|---|---|
| Home card **거래내역** | 8.991 spinner → 9.008 dim 0.53 (instant, constant) → 9.991 dim off, list shown | `LoadingDim` (rgba(0,0,0,.53) + 60 pt spinner centred at (196, 425)) for **1000 ms**, then mount the list and remove the dim in the same frame |
| List first paint | 9.991 painted with a 32 pt spacer under the buttons → 10.208 spacer removed (one-frame jump up of 32 pt) | optional: render the spacer and remove it 217 ms after mount (no animation). It can be dropped if judged ugly |
| Drag list | 11.441–12.074; max scroll 43 with 3 rows | native `overflow-y: auto` with momentum; clip at 202.8 / 818 |
| Tap a row | spinner, +17 ms dim 0.54, which then **ramps to 0.61–0.64 over ≈ 280 ms (ease-out)** → detail swaps in | two layers: loading dim .53 at once + a second `rgba(0,0,0,.23)` fading in over 280 ms. Hold time = recorded **184 ms (입금) / 1100 ms (출금)**, or `max(api latency, 180 ms)` for 입금 and 1100 ms for 출금 transfers |
| Detail **확인** or **×** | pressed fill #004511 (2 frames seen) → list back in one frame | instant pop, **no dim**, list scroll kept, no list refetch (but re-render if the memo or star changed) |
| List **이체** (outlined) | 20.024 pressed bg #EAFEEE (3 frames) → 20.074 released + spinner → 20.091 dim 0.53 → 21.141 transfer page **누구에게 보낼까요?** | `:active` bg #EAFEEE; loading **1067 ms**; push the transfer start screen with **출금 account preset to the list's account** |
| Detail **다시보내기** | not recorded | press: bg #F2F2F2 (invented). Loading 1000 ms → **얼마를 보낼까요?** with the recipient (bank, number, holder) and this account prefilled. The detail is replaced, so back goes to the list |
| ☆ | not recorded | toggles at once (no loading). Filled star `#FFC31A` fill + stroke (invented). Optimistic update, then API call (§4) |
| Memo field | not recorded | tap focuses the input and opens the keyboard (reuse the clone's on-screen Korean keyboard if one exists, else native). maxLength 20 (count characters; extra input is ignored). Save on blur / Return / 확인 with PATCH only when changed. On save failure show toast `메모를 저장하지 못했어요` |
| 자동이체 등록 > | not recorded | toast `준비 중인 서비스예요` (invented), no navigation |
| Back `‹` / home icon | not recorded | instant pop to home (no dim). The home icon pops to root |
| Menu+search icon | not recorded | instant push to 전체메뉴 (other area) |
| Account block | not recorded | opens the account sheet (§5) |
| Filter row | not recorded | opens the filter sheet (§5) |
| 잔액 숨기기 | not recorded | knob slides 150 ms ease. ON track #0C8F2D, knob on the right |

The spinner, observed here and shared with the loading spec: 60×60 green disc with white "all one", centred at (196, 425). It does a Y-axis coin flip: first flip ≈ 0.20–0.37 s after appearing, second ≈ 0.47–0.84 s, then a loop. The spinner appears one frame (17 ms) before the dim; showing both together is fine.

Error handling (invented): if the list or detail fetch fails, remove the dim and show a centred alert `일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.` with a green `확인` button. Stay on the current screen.

---

## 4. Data and server

### 거래내역조회
- **Account**: `id`, product name (`name`, e.g. `NH X 카카오페이통장(비대면실명확인)`), bank (`NH농협은행`), formatted `number`, `balance`. Existing **GET `/api/accounts/:id`** (`toAccount` → `label` = `row.name`). Seed the product name into `accounts.name`.
- **Rows**: existing **GET `/api/accounts/:id/transactions?limit=`** returns `id, at, merchant, amount (signed), tag, balanceAfter`, newest first. `balanceAfter` is computed over the full history, which is correct for "잔액 N원". Client formats:
  - `at` → `YYYY.MM.DD` + `HH:mm:ss` (seconds required; seed `at` with seconds).
  - `amount<0` → 출금, red. `>0` → 입금, blue.
  - Type label: `#이체 && amount<0` → `올원이체`. `#이체 && amount>0` → none (as recorded). `#체크카드` → `체크카드`, `#자동이체` → `자동이체`, `#예금이자` → `결산이자` (invented mapping).
- **New query params (allone only, non-breaking)** on the same endpoint:
  - `from`, `to` (`YYYY-MM-DD`, inclusive)
  - `type=all|in|out`
  - `order=desc|asc`
  - `offset` (with `limit`, default 20) for paging
  - Filter **after** `listTransactions()` so `balanceAfter` stays correct.
  - Return `{ items, hasMore }`, or keep the array and let the client stop when a page has fewer than `limit` rows.
- **Range line**: from the filter. `to` = today. `from` = today minus the period (1개월 → same day of the previous month, clamped to month end; 1주일 → −7 d; 3/6개월 likewise).

### 거래내역 상세
- Existing **GET `/api/transactions/:id`** (`txDetailJson`) gives `merchant`, `amount`, `balanceAfter`, `transactedAt` (`YYYY.MM.DD HH:mm:ss`), `memo`, and `transfer {bank, number, holder}` for outgoing transfers. Client splits `transactedAt` into date and time spans.
- **Add for allone**:
  - `fromAccount: { bankName, number }` (the owning account, formatted).
  - `payee: { id, favorite } | null`: the payee row matching `transfer.bank.code + transfer.number`, for ☆.
  - `canResend: true` when `transfer` exists and the amount is negative.
  - 입금계좌 shows `transfer.bank.name` and `transfer.number` as raw digits. 출금계좌 shows `fromAccount`.
- **Memo**: existing **PATCH `/api/transactions/:id` `{ memo }`** (≤ 20 chars, empty clears). Already returns the refreshed detail.
- **☆**: existing **PATCH `/api/payees/:id` `{ favorite }`** when `payee` exists. Otherwise **POST `/api/payees`** `{ bankCode, number, holder, favorite: true }`. Small change: POST currently ignores `favorite`; accept it. This makes the star feed the transfer area's 자주 tab and the ☆ on its recent rows.
- **다시보내기 / 이체**: existing **GET `/api/transfer/lookup`** and **POST `/api/transfers`** (transfer area). Pass `fromAccountId` = the list's account.
- **Accounts for the account sheet**: existing **GET `/api/home`** (or an accounts list) for the user's own accounts.

---

## 5. Not visible in the recording → invent (defaults)

1. **Account select sheet** (account block / ▾). Reuse the bottom-sheet component of 잔액채우기 `출금계좌 선택` (C3 ≈ 4–6 s): white, top radius ≈ 24, title left at x 24 **18 px / 600**, × right, slides up about 300 ms over `rgba(0,0,0,.4)`.
   - Title `계좌 선택`.
   - Rows (height ≈ 64): bank logo circle 36, product name 15/500 #000, `은행명 번호` 13/400 #898989, green check ✓ #0C8F2D on the selected row.
   - Tap a row → sheet closes → loading dim 600 ms → list reloads for that account (block, balance, rows). Scroll resets to top and the filter resets.
2. **Filter sheet `조회 조건`**, same sheet style:
   - `조회기간` chips `1주일 / 1개월 / 3개월 / 6개월 / 직접입력`. Selected chip: 1 pt #0C8F2D border, #0C8F2D text, bg #EAFEEE; others 1 pt #DCDCDC, #000. Chips are 36 tall, r 8.
   - `직접입력` shows two date fields (`시작일` / `종료일`, max 1 year, end ≤ today).
   - `거래구분` `전체 / 입금 / 출금`.
   - `정렬` `최신순 / 과거순`.
   - Green full-width `조회` (56 tall, r 12).
   - Applying closes the sheet, shows the loading dim for 600 ms, and updates the summary text (e.g. `3개월 · 입금 · 과거순`), the range line and the rows.
   - Default: `1개월 · 전체 · 최신순`.
3. **잔액 숨기기 ON**: hides line 3 (`잔액 N,NNN원`) of every row. Rows become 95 tall (two lines). The top 잔액 row is unaffected. Persist in `localStorage` per viewer (`allone.hideTxBalance`, wrapped in try/catch).
4. **Empty state** (no rows in range): under the first separator, centred text `조회 기간 내 거래내역이 없어요` **15 px / 400** #898989, 80 pt below the separator. No bottom separator.
5. **Paging**: 20 rows per page. When the scroll comes within 200 pt of the end, fetch the next page. While loading, show a footer row (60 tall) with the all-one spinner scaled to 28 pt. Stop when a page returns fewer than 20.
6. **계좌관리**: bottom sheet `계좌관리` with `계좌번호 복사`, which works and shows toast `계좌번호가 복사되었어요`, plus `통장사본 보기` and `계좌 별명 변경`, which show toast `준비 중인 서비스예요`. Pressed bg #F2F2F2. Toast: dark pill rgba(0,0,0,.8), white 14 px, 2 s, 100 pt above the bottom.
7. **Memo saved state**: the field shows the memo in #000. The list does not show memos (unchanged rows).
8. **☆ filled**: #FFC31A fill and stroke. Tapping again unfavourites.
9. **Detail for non-transfer rows** (체크카드, 자동이체, 예금이자): 입금-style layout (name, memo, card with 거래시간 / 거래금액 / 거래 후 잔액). No ☆, 다시보내기 or account rows.
10. **After a transfer done from 이체 / 다시보내기**: when the transfer flow's 완료 → 확인 returns here, pop back to the list, refetch, and show the new 출금 row on top with `올원이체`.

---

## 6. Personal data seen → placeholders (formats only)

| role (where) | placeholder | format |
|---|---|---|
| Account holder (not shown in this area's screens; header on home) | `<NAME_A>` | Hangul name |
| Outgoing recipient, list row 1 | `<NAME_B>` | 3-syllable Hangul name |
| Outgoing recipient, list row 2 and 출금 detail | `<NAME_C>` | 3-syllable Hangul name |
| Incoming sender, list row 3 and 입금 detail | `<NAME_D>` | 3-syllable Hangul name |
| Own NH account number (account block, 출금계좌) | `<ACCT_A>` | `NNN-NNNN-NNNN-NN` (13 digits, NH 3-4-4-2) |
| Recipient's account (출금 detail 입금계좌; other bank) | `<ACCT_C>` | 13 raw digits, no hyphens |
| Account balance (잔액 row) | `<BALANCE>` | `N원` / `N,NNN원` |
| Transaction amounts (rows, 거래금액) | `<AMOUNT_1..3>` | `NNN,NNN원` (6-digit) |
| Balance after each transaction (row line 3, 거래 후 잔액) | `<BAL_1..3>` | `N,NNN원` |
| Transaction date-times (rows, 거래시간) | `<DT_1..3>` | `YYYY.MM.DD  HH:mm:ss` |
| Query range line | `<RANGE>` | `YYYY.MM.DD ~ YYYY.MM.DD` |
| Status bar time and battery | (status-bar area) | — |

**Seed proposal (invented, 홍길동 profile; do not reuse any recorded value).**

Main account `NH X 카카오페이통장(비대면실명확인)`, NH `302-0000-0000-00`. Rows within the last month, all with seconds:

- 입금 `이서준` 500,000, `#이체`
- 출금 `김민지` 120,000 → 카카오뱅크 `3333000000001`, `#이체` with a transfers row → 출금 detail shows 입금계좌
- 출금 `박하늘(샘플마트)` 35,000 → NH `3560000000033`, `#이체`

Add 1–2 older months of mixed rows so the 3/6개월 filters and paging have data. The balance chain is computed by the server.
