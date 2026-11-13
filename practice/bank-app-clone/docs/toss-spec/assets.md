# toss: area spec. 소비 · 자산 · 내 계좌 (계좌 편집) · 전체 tab

Area: video B ≈ 140–174.5 s. Covers the 소비 screen (reached from home "{M}월에 쓴 돈"), the 자산 screen (reached from home
"계좌 · 카드 · 포인트 모두 보기"), the 내 계좌 page (the task calls it 계좌 편집; reached from 자산 "계좌 n개 전체보기"),
the pull-to-refresh on 자산, and the 전체 tab. Dark theme, Galaxy frame, fixed.

Privacy: this file has **no** values from the recording: no names, balances, amounts, merchants, dates or counts.
Placeholders are in `<ANGLE_BRACKETS>`. §6 maps each role to a placeholder. Product names, bank names and UI labels are kept.
Scratch evidence is in `…/scratchpad/toss/frames/assets/`: `spend_top.png` (11-frame average B 142.62–144.37),
`asset_top.png` (13-frame average B 154.60–155.78), `edit_avg.png` (133-frame average B 168.60–170.95), `full/B_<pts>.png`, `crops/`.
The tools are in `…/scratchpad/toss/tools/assets/`.

## 0. Conventions

- **1.25 px/dp, frame 384 × 853.33 dp**, the same as infra.md §1. Screen y is measured from the top of the status bar.
  The app viewport is 28–838.33 dp and the nav band is 838.33–853.33.
- Values are **ink boxes** (glyph pixels), not line boxes. Font sizes were fitted to Pretendard by ink width and checked against ink height, ±0.5 dp.
  The Toss font draws Hangul ≈ 8 % taller than Pretendard at the same width, so trust the size, not the ink height.
  Weights: R 400, M 500, SB 600, B 700.
- Colours were sampled from frame averages. Thin coloured text loses saturation to chroma subsampling, so for thin blue/red text use the token, not the raw sample.
- pts are real presentation timestamps from ffprobe. The video is VFR: static stretches have frame gaps of up to ~330 ms, so durations are ±20 ms.
- **Ignore OS chrome.** The Samsung Edge-panel handle (left edge, y ≈ 119–237 dp) and the Samsung back-gesture arrow (right edge, B 171.0–171.4) are not app UI.
  So is the black status-bar flash during pushes (see §3.1).
- The shared tokens and transitions in **home.md §2.0 / §3.4** and **account.md §0** apply. This spec only adds what is new or measured here.

### Tokens seen in this area (dark)
| token | value | where |
|---|---|---|
| page | `#171619` | 소비, 자산, 내 계좌 page and status bar (measured exactly 23,22,25) |
| card (자산) | `#201f22` | 자산 section cards (32,31,34) |
| btn-grey on page | `#27282d` / `#292a2f` | 분석 button, 내 계좌 송금 |
| btn-grey on card | `#303135` | 자산 송금 |
| btn-full on card | `#2b2a2d` | "계좌/카드/포인트 n개 전체보기" |
| btn-full pressed | `#373b3f` | measured 55,59,63 |
| row pressed (on page) | `#27282d` (≈ white α .07) | 소비 list row |
| row pressed (on card) | `#303136` (≈ white α .07) | 자산 account row |
| circle (selected day) | `#100f12` | 소비 week strip (same as home page bg) |
| segmented bg / floating bar | `#2a2a34` | 내 계좌 page |
| segmented thumb | `#3b3b47` | 내 계좌 page |
| divider under tabs | `#2f2e31` (소비) / `#403f42` (자산), 1 device px = 0.8 dp | |
| text-1 | `#f0f0f3` (titles peak #f9f8fa, amounts #dcdadd–#e4e3e8) | |
| text-tab-on | `#dbdade` | selected tab |
| text-2 | `#b5b4b7` | 자산 불러오기, 총 자산 amount, 자산 row labels (#b3b2b6) |
| text-3 | `#8a898c` | inactive tabs, day names, date headers (#807f83), legend, chevrons |
| text-4 | `#6b6a6e` | 소비 row subtitles, grey (excluded) amounts, non-selected dates (#6d6c71) |
| text-5 | `#7c7c86` | 내 계좌 row labels (bluish grey) |
| blue | `#3182f6` | bar segment 이체, 받기 fill (#2f80f5 measured), "주계좌" text (#3278e2 measured), income amounts |
| red | `#f04452` (measured #cd2845 / #be2b45 on thin text) | "N만원" in 지난달보다…, "평소보다 많이 씀" |

---

## 1. Screen inventory (video B; video A has none of these screens)

| # | Screen / state | pts (s) | Notes |
|---|---|---|---|
| — | Home, "{M}월에 쓴 돈" row pressed | 140.242–140.449 | home.md row 17 |
| C0 | Push home → 소비 (slide-up) | 140.470 → ~140.85 | home fades out in ~35 ms (gone by 140.505). New page is blank `#171619`, no header yet |
| C0b | Status bar goes black (system, optional) | 140.575–140.707 | |
| C1 | 소비 **skeleton** (generic web skeleton) | blocks fade in 140.64–141.06, static to 142.11 | §2.1.7 |
| C2 | 소비 first paint: header (title only), tabs, summary with **stale** total, list, **no week strip** | 142.177 | One-frame swap, no fade |
| C3 | Week strip inserted (list pushed down); header ◂ ▸, search and ⋯ appear | 142.212 | |
| C4 | Fresh data: total, "N만원", bar split and day amounts update | 142.378 → 142.607 (VFR gap) | Instant swap |
| C5 | **소비 top, loaded** | 142.607–144.33 | `spend_top.png` |
| C6 | Row press highlight (touch-down that becomes a scroll) | 144.509 (rect 7.2 dp inset) → 144.543 (full width) → fades out 144.64–144.73 | |
| C7 | Scroll: summary scrolls away, **week strip sticks** under the tabs | 144.38–145.01 (sticks ≈ 144.50) | |
| C8 | Scroll spy: selected day follows the top date group | changes at 145.764, 146.945, 148.012 | 3 more flings 145.41–146.04, 146.38–147.13, 147.36–148.08 |
| C9 | 소비 scrolled, idle | 148.08–149.10 | |
| C10 | Pop 소비 → home (system back) | 149.10–149.22 slide down; home at 149.241 | home odometer = home.md row 18 |
| — | Home footer "계좌 · 카드 · 포인트 모두 보기" pressed, loading box | 150.989–151.44, box 151.98–152.03 | home.md rows 19–20 |
| A0 | Push home → 자산 (slide-up, back arrow visible from the first frame) | 152.031 → 152.382 | Status bar black 152.109–152.232 |
| A1 | 자산 shell: header + "총 자산 <stale> " + tab labels (no indicator) | 152.253–153.30 | |
| A2 | Tab indicator + 총 자산 "›" appear | 153.315 | |
| A3 | Section cards fade in (stale amounts, stale order) | 153.372 → 153.404 (~35 ms) | |
| A4 | Odometer roll of 총 자산 and every amount to fresh values; card rows re-sort | 153.404–154.34 | |
| A5 | **자산 top, loaded** | 154.34–155.78 | `asset_top.png` |
| A6 | Fling up: 총 자산 row scrolls away, **tabs stick** under the header; page hits the end | 155.787–156.10 | |
| A7 | End-of-scroll spy: indicator 계좌 → 카드 → 포인트 | 156.05–156.39 | |
| A8 | Drag back down: indicator 포인트 → 카드 → 계좌, tabs un-stick | 157.05–157.57 (un-stick 157.27–157.30) | |
| A9 | **Pull-to-refresh**: overscroll, blob indicator, header dims | pull 157.30–157.72, hold/refresh 157.72–158.22, finish 158.24–158.62, glow fades by ~159.3 | §2.2.6 |
| A10 | Row pressed (other-bank account, 2nd row) | 160.604–161.267 | |
| A11 | Push → other-bank account detail (영하나플러스 통장) | 161.267 → … 164.77 | **account.md S4** |
| A12 | Pop back to 자산 | 164.77–165.04 | account.md P3 |
| A13 | "계좌 n개 전체보기" pressed | 165.868–166.10 (fill fades back to 166.15) | |
| E0 | Push → blank page (back arrow only; status bar black) | 166.49 → ~166.85; blank to 168.0 | |
| E1 | Web progress bar appears at ≈70 % | 168.004 | |
| E2 | 내 계좌 page paints: segmented control, 입출금 + total, 1st logo | 168.320 | |
| E3 | **내 계좌 page, loaded** (all account rows + floating bar) | 168.487–171.54 | `edit_avg.png` |
| E4 | Progress bar creeps 70 → 80 %, jumps to 100 %, hides | 168.6–170.0, 170.9–171.38, hidden 171.539 | |
| E5 | Pop 내 계좌 → 자산 (system back gesture) | slide down 171.539–171.658; 자산 at 171.681 from −6.4 dp, settles by 171.811 | |
| A14 | 자산 idle until the end of the video | 171.81–174.54 | |
| T | **전체 tab** | visible only as a tab-bar item on home (A 10.4–13.2, B 133.5–152.0) | **Never opened**; §5.4 invents it |

---

## 2. Layouts

### 2.1 소비 (spending) screen

Page `#171619`. The status bar uses the same colour. No bottom bar.

#### 2.1.1 Header (fixed), 28–81.6 dp
| element | geometry (dp) | style |
|---|---|---|
| back "←" | ink x 18.4–38.4, y 46.4–64.8 | stroke ≈ 2, `#e1e0e3` |
| ◂ (prev month) | filled triangle, ink x 153.6–160.8, y 49.6–62.4 (7.2 × 12.8) | `#8e8d90` (enabled) |
| month title `{M}월` | ink x 179.2–205.6, y 48.8–63.2 | **16 M, grey `#89898d`** (not white). The group ◂ title ▸ is centred on x 192 |
| ▸ (next month) | ink x 223.2–230.4 | `#3a393c` = **disabled**, because the current month is the latest |
| search | magnifier outline, ink x 301.6–322.4, y 45.6–67.2 | stroke ≈ 2, `#8f8e91` |
| more "⋯" | 3 dots, ink x 350.4–369.6, y 54.4–58.4 (dot Ø ≈ 4, pitch ≈ 7.6) | `#8f8e91` |

#### 2.1.2 Filter tabs (fixed), 81.6–121.6 dp
- Labels **전체 / 카드 / 입·출금 / 페이·기타**, 16 dp. Selected: SB `#dbdade`. Others: M `#8a898c`.
  Ink y 96.0–110.4. Ink x: 40.0–64.8 / 103.2–128.8 / 160.8–207.2 / 231.2–290.4 (centres 52.4 / 116 / 184 / 260.8).
  The tabs are left-aligned inline, **not** equal widths. Place them by these centres.
- Indicator under the selected tab: x 32.8–72.8 (label + ~8 dp each side), y 119.2–121.6 (≈ 2.4), `#e0dfe2`, square ends.
- Full-width divider: 0.8 dp at y 120.8–121.6, `#2f2e31`. The indicator overlaps it.

#### 2.1.3 Summary (scrolls away), natural 121.6–248 dp
- **Total** `-<SPEND_TOTAL>원`: 22 B `#dbd9df`, ink x 24.0, digits ink y 147.2–163.2. The leading minus is part of the text.
- Line 2, ink y 171.2–184.0, 13 R `#808084`: `지난달보다 ` + **`<SPEND_DIFF>만원`** in red `#f04452` + ` 더 쓰는 중`.
- **분석** button: x 307.2–360.0, y 148.0–180.0 (52.8 × 32), fill `#27282d`, radius 8, label 13 M `#babdc4`.
- **Category bar**: x 24–360 (336), y 198.4–211.2 (≈ 12.8; draw 12). Segments are separate rounded rects (radius ≈ 3) with a **2.4 dp gap**.
  Width is proportional to each category's share. Observed order and colours:
  1. 이체 `#2f7ff3`
  2. 카테고리 없음 `#1e7055`
  3. 교육 `#804b20`
  4. 그 외 `#3e3d40`

  The smallest segment observed is ≈ 21.6 wide, so clamp each segment to a minimum of 16.
- **Legend**, ink y 222.4–232.8: square dots 8 × 8 (radius 2) in the segment colour, 3.2 gap, label 12 R `#8a898c`, 6.4 gap to the next dot.
  Dot x: 24.0 / 59.2 / 132.8 / 168.0.

#### 2.1.4 Week strip (sticky), natural 248.0–390.4, sticky 121.6–264.0 (142.4 tall)
- 7 columns of **51.2 dp** from x 12.8 (centres 38.4 + 51.2·i), **Sunday first**: 일 월 화 수 목 금 토. Shows the week containing the selected day.
- Day names: 12 R `#85868b`, ink y 263.2–273.6 (natural).
- Dates: 16 M `#6d6c71`, ink y 292.8–304.8. **The selected date** is `#f8f7fa` SB inside a **Ø 40 circle `#100f12`**, centre (col centre, 298.4).
  Every other date is the same grey, future dates included.
- Per-day amounts, two lines centred in the column:
  - Income, line 1, ink y 326.4–336.0: `+<IN>원`, blue (`#3182f6`; samples #2a5599–#415e99).
  - Expense, line 2, ink y 339.2–349.6: `-<OUT>원`, `#8a898c`.
  - **Font 10.5 R, shrink-to-fit inside ~42 dp** (short strings render at 10.5, long ones down to ~8.5). Days without values show nothing.
- Expand chevron "⌄": ink x 184.0–200.8, y 375.2–381.6 (16.8 × 6.4), stroke ≈ 2, `#8c8d92`.
- No divider or shadow under the sticky strip. Rows simply clip at its bottom edge (sticky y 264.0).

#### 2.1.5 List
- **Date header**: `D일 요일` 13 R `#807f83`, ink x 24.8, ink y = group top + 31.2 (natural first header 421.6–434.4).
  Optional tag **`평소보다 많이 씀`**: 13 R red `#f04452`, ≈ 4 dp after the label.
  The header block is ≈ 52 dp: 31 above the ink, 8 below it before the first row.
- **Cashback row** (first row of today's group only): 66.8 tall.
  - Icon: 36 squircle `#2f6ad0`, white circular arrows around a "₩".
  - Title `<N>건` 17 SB `#f9f8fa`.
  - Subtitle `캐시백 가능한 내역` 15 R, **brighter `#868588`**.
  - **받기** button: x 307.2–360, y ±16.4 around the row centre (52.8 × 32.8), fill `#3182f6`, radius 8, label 13 SB `#ffffff`.
- **Transaction row**: **72.8 tall**, full width, padding 0 24. Offsets below are from the row top:
  - Icon: 36 × 36 squircle (radius ≈ 12) at x 24, y +17.6. It is top-aligned, not centred.
  - Title: 17 SB `#f9f8fa`, ink x 72.8, ink y +23.2 → +39.2.
  - Subtitle: 15 R `#6b6a6e`, ink y +48.8 → +61.6. Single line normally. Pay rows wrap to **2 lines** and the row grows by ≈ 20.
  - Amount: right-aligned to x 360, 17 B, ink y +23.2 → +38.4. Colour by tone:
    - **spend** (counted in the total): `-N원` `#d9d8db`
    - **excluded** (own-account transfer, card-bill payment): `-N원` / `N원` (no "+") `#6a696c`
    - **income from others**: `+N원` blue `#3182f6`
    - **cancelled**: grey `#6f6e71` with a **strike-through**. The title gets a suffix: ` | ` (`#d7d6d9`) + `취소` (17 R `#767578`).
- **Subtitle rules seen**:
  - card spend → the card product name, e.g. `Young Hana+ 체크카드`, `프렌즈 체크카드_MC_비교통_라이언`
  - transfer from/to another person → `내 토스뱅크 통장` / `내 카카오뱅크 계좌` / `내 하나은행 계좌` (the account it touched)
  - own transfer → `<from bank> → <to bank>`, e.g. `토스뱅크 → 하나은행`. When the source label is a person's name it is `<NAME_A> → 하나은행`
  - pay → `<card name> · <merchant detail>` (wraps)
- **Titles**: counterparty name for person-to-person, `내 계좌 이체` for own transfers, the merchant name for card/pay,
  the card company (e.g. `하나카드`) for a card-bill auto-debit.
- **Icons seen** (36 squircle):
  - 이체: blue `#3182f6` square, white Ø ≈ 22 circle, blue "₩" with a bar.
  - 편의점: yellow `#ffc21a` square, white awning stripes over a pale-yellow (`#ffdc58`) storefront with a door.
  - Card company: a full-colour bank-logo squircle (Hana green square with the white Hana symbol).
  - Merchants: some use **merchant brand logos**. Do not reproduce these; see §7.

#### 2.1.6 Scroll
- The header and tabs are fixed. The summary (126.4 dp) scrolls under them. The week strip then sticks at y 121.6.
  Its sticky threshold is scroll offset 126.4.
- **Scroll spy**: the selected day is the **last date group whose header top ≤ sticky bottom (264) + ~40 dp**. Measured: the switch happens while the next header ink is at ≈ 300–305 dp.
  The circle **jumps** to the new column with no animation. If the selected day is in another week, the strip shows that week (invented).
- The list in the video covers several days of the current month. The end of the list was not reached; see §5.

#### 2.1.7 Skeleton (C1)
Generic web skeleton on `#171619`. Bars are `#1d1c1f` (title bars) and `#1a191c` (row bars). There is a faint diagonal shimmer.
- Bar 1: x 24–135.2, y 72.0–93.6, radius ≈ 8.
- Bar 2: x 24–192, y 105.6–136.0, radius ≈ 8.
- Rows: circle Ø 40 at x 24, y 188.8, plus bar x 78.4–358.4, y 188.0–230.4 (radius ≈ 10). A second row at y ≈ 263–304.
- Blocks fade in staggered over ≈ 200 ms each (bar 1 at +170 ms, bar 2 at +270 ms, rows at +520 ms after the push).

### 2.2 자산 (assets) screen

Page `#171619`.

#### 2.2.1 Header (fixed), 28–81.6
- Back "←": ink x 17.6–38.4, y 44.8–64.0, white.
- **자산 불러오기**: right-aligned text link, 15 M `#b5b4b7`, ink x 279.2–358.4, y 48.0–63.2.
- No title, not even when scrolled.

#### 2.2.2 총 자산 row (scrolls away), natural 81.6–136
- `총 자산`: 17 B `#f1f1f3`, ink x 23.2–71.2, y 108.8–128.0.
- ` <TOTAL_ASSETS>원`: 17 M `#b5b4b7`, ink x 76.8 →.
- Chevron "›": 7.2 × 12, stroke ≈ 1.8, `#8a898c`, 9.6 after the amount.

#### 2.2.3 Section tabs (sticky), natural 136–187.2, sticky 81.6–132.8
- **계좌 / 카드 / 포인트**: 3 equal tabs across x 20–364 (114.67 each), 17 dp. Selected: SB `#dbdade`. Others: M `#8c8b8e`. Ink y 153.6–169.6 (natural).
- Indicator: **96.8 wide** (tab width − 2 × 8.9), x 28.8–125.6 under 계좌, y 184.8–187.2, `#dedde0`.
  It **slides** between tabs, ≈ 250 ms decelerate.
- Divider: full width, 0.8 dp at y 186.4, `#403f42`.

#### 2.2.4 Section cards
All three cards: x 10.4–373.6 (363.2 wide), fill `#201f22`, **radius 22**, gap 8.8 between cards. The first card starts at y 199.2 (12 below the divider).
Inside: padding-top 7.2, padding-left/right 20. The rows come first, then a full-width button with a 7.2 top margin.
The button is 40 tall, fill `#2b2a2d`, radius 10, label 15 SB `#f8f7f9` centred. Padding-bottom 20.8.

| card | rows | button |
|---|---|---|
| 계좌 (y 199.2–446.4) | up to **3** rows of 57.6 | `계좌 <n>개 전체보기` |
| 카드 (y 455.2–647.2) | up to **2** rows of 58.4 | `카드 <n>개 전체보기` |
| 포인트 (y 656.0–789.6) | up to **1** row of 57.6 | `포인트 <n>개 전체보기` |

- **Account row** (57.6):
  - Logo: 30.4 squircle (radius ≈ 10) at x 30.4, vertically centred.
  - Line 1: `<BAL>원` 17 B `#dcdadd`, ink x 72.8, ink top = row top + 12.8.
  - Line 2: the product name, 13 R `#b3b2b6`, ink top = row top + 35.2.
  - The main account adds ` · ` (`#575659`) + **`주계좌`** 13 M blue `#3182f6`.
  - **송금** button: x 300.8–353.6, 52.8 × 32, centred; fill `#303135`, radius 8, label 13 SB `#c5c6c9`.
  - Example labels: `토스뱅크 통장 · 주계좌`, `영하나플러스 통장` (하나), `입출금통장` (카카오뱅크).
- **Card row** (58.4): a vertical **card-plate thumbnail** 29.6 × 43.2 (radius ≈ 2.4) at x 31.2, centred.
  - Line 1: `<CARD_AMT>원` 17 B.
  - Line 2: the card product name, 13 R `#b3b2b6`.
  - No button.
- **Point row** (57.6): Toss logo squircle. Line 1 `<POINT>원` 17 B. Line 2 `토스포인트` 13 R. No button.
- Below the cards: **`+ 내 자산 불러오기`**.
  - Plus: 16 × 16, stroke 1.8, `#8a898c`, at x 28–44.
  - Text: 17 M `#b5b4b7`, ink x 60.8–166.4, ink y 819.2–836.8.
  - Row ≈ 48 tall, then ≈ 60 dp bottom padding. The total scroll range in the video is **68 dp**.

#### 2.2.5 Logo squircles (자산 / 내 계좌)
Brand colour at low alpha over the surface, with the brand glyph on top. Measured fills:

| bank | on page `#171619` | on card `#201f22` | glyph |
|---|---|---|---|
| 토스뱅크 / 토스머니 / 토스포인트 | `#1f355e` | `#283c68` | blue Toss symbol (two-tone `#1a95ff` / `#0064ff`) |
| 하나 | `#132225` | `#1e2a29` | Hana symbol: green figure + red dot `#db211e` |
| 카카오뱅크 | `#363017` | `#3d3a20` | yellow "B" `#f7e64f` |
| NH | `#112946` | — | "NH" bold letters `#0493df` |

The general formula is `background: color-mix(in srgb, <brand> 12–30%, <surface>)`.
Toss blue fits at ~31 %, Kakao yellow at ~13 % and Hana green at ~10 %, so use the table values directly.

#### 2.2.6 Pull-to-refresh (A9)
- Only at scroll top. Content (tabs and cards) translates down with the finger, ≈ 1:1 at first, damped later. The max pull seen is **+134 dp** (card top 200.8 → 334.4).
- **Blob indicator**: a thin ring, stroke ≈ 1.6, `#3a393d` with a soft glow, on the page bg. Centre x 192, y ≈ 227, in the gap above the first card.
  - Pulling: Ø 20 → **37** (157.40 → 157.49).
  - Refreshing: it morphs **circle ↔ teardrop pointing down**, period ≈ 450 ms (drop at 157.64 / 158.11, round at 157.89).
  - CSS: a square rotated 45° whose border-radius animates 50% ↔ "50% 50% 0 50%".
- **Header dims while pulling**: ← and 자산 불러오기 fade to ~50 % (255 → 132 luma, 157.30–157.49). They fade back 158.42–158.62.
- **Release** → refreshing: content springs to **+80 dp** and stays there (157.72 → 157.95).
- **Finish**:
  - At ≈ 158.24 the blob scales to Ø 43 while moving up 14 dp and fades (≈ 150 ms).
  - Content springs back to 0 (≈ 350 ms, slight overshoot).
  - A **very faint whole-screen brightening** (radial from the blob; bg 23 → 34 luma, white α ≈ .045) peaks at 158.37–158.44 and fades by ≈ 159.3. This is optional.

### 2.3 내 계좌 page (the task calls it 계좌 편집)

Reached from **계좌 n개 전체보기**. Page `#171619`.
- **Header** 28–80:
  - ← at ink x 18.4–38.4, y 45.6–64.0.
  - **Segmented control**, centred on x 191.6:
    - Container: x 110.4–272.8, y 33.6–75.2 (162.4 × 41.6), radius 20.8, `#2a2a34`.
    - Thumb: inset 4 dp (x 115.2–189.6, y 37.6–71.2; 74.4 × 33.6), radius 16.8, `#3b3b47`, with a 1 px lighter top edge (`#4a4953`).
    - Labels 15 dp: **`내 계좌`** SB `#f9f8fb` (selected) and **`계좌 개설`** M `#858591`.
- **Web progress bar** y 80.0–82.4: fill blue at ~45 % alpha (`#2b4775`, brighter `#3064b0` at 100 %), track `#5c5f68`.
  It is the same component as home.md §2.6 / account.md S0.
- Section label **`입출금`**: 15 R `#b8b7bb`, ink x 24, y 108.8–123.2.
- Section total **`<TOTAL_DEPOSIT>원`**: 24 B `#fbfbfc`, ink y 137.6–160.0.
- Rows: pitch **56.8**, first row centre y 199.2.
  - Logo: 30.4 squircle at **x 24**.
  - Line 1: `<BAL>원` 17 B `#e4e3e8`, ink x 65.6.
  - Line 2: label 13 R **`#7c7c86`** (dimmer than on 자산). `· 주계좌` as on 자산.
  - 송금 button: x 308–360 (52 × 32), fill `#292a2f`, radius 8, label 13 SB `#b6bbc6`.
- Row order in the video, all in one 입출금 section (<n> rows):
  1. 토스뱅크 통장 · 주계좌
  2. 영하나플러스 통장 (하나)
  3. 입출금통장 (카카오뱅크)
  4. 자립예탁금 (NH)
  5. 토스머니 (Toss logo)
- **Floating bottom bar**:
  - Pill x 24–360, y 751.2–802.4 (336 × 51.2), radius 25.6, `#2a2a34`. It sits 36 dp above the nav band and stays fixed.
  - Labels 15 SB `#dfdee3`: **`화면 편집하기`** (ink x 87.2–167.2, centre 127.2) and **`계좌 불러오기`** (ink x 240.0–319.2, centre 279.6).
    The centres are **not** in the middle of each half. Keep the measured positions.
  - Divider: 0.8 × 20 at x 191.2–192.0, y 766.4–786.4, `#4c4c56`.

### 2.4 전체 tab (tab bar)
The geometry is measured in **home.md §2.5**: 5th item, three horizontal lines 18.4 wide at 6.4 pitch, label `전체` 11 M.
It was never opened in either video. §5.4 has the invented 전체 메뉴.

---

## 3. Interactions & transitions

### 3.1 Push (home → 소비, home → 자산, 자산 → other-bank detail, 자산 → 내 계좌)
This is the slide-up push in **home.md §3.4**, confirmed here.
- **자산 (152.03)**: the back-arrow offset at each frame was 144 / 118 / 90 / 66 / 50 / 38 / 31 / 25 / 20 / 16 / 13 / 11 / 9 / 6 / 5 / 2 / 1 / 0 dp
  over 152.031 → 152.382, i.e. **+150 → 0, ≈ 380 ms, expo-out**.
  The new page fades in within ~50 ms. The old page fades out in ~60 ms while drifting up 2–4 dp.
- **Status bar turns `#000`** for ≈ 130 ms, starting ≈ 80–100 ms after the push (140.575–140.707, 152.109–152.232, 166.6).
  This is a system artefact. Optional; if kept, gate it to toss.
- **Navigation latency**: home row release → push 20 ms. Footer: release → push ≈ 600 ms with the home loading box. 자산 row release → push ≈ 0–30 ms.
  "계좌 n개 전체보기" release → push ≈ 400 ms. Clone: navigate ~100 ms after release.
- 자산 → other-bank account detail (161.267) **fades** (the 자산 content fades out in ~90 ms, 161.27→161.36) instead of sliding.
  Use the account.md S4 entry.

### 3.2 Pop
- 소비 → home (149.10): the closing page goes `translateY 0 → +37 dp` in ≈ 120 ms ease-in (samples +0.8 / +2.4 / +8 / +25 / +32 / +37 dp). Then cut to home.
- 내 계좌 → 자산 (171.539):
  - Closing page `0 → +32 dp` in ≈ 120 ms ease-in.
  - Then the **previous page appears at −6.4 dp and settles to 0 in ≈ 130 ms** (decelerate). This is the reverse of the push drift; apply it to every toss pop.
  - The status bar flashes black for 2 frames.

### 3.3 Press states
- **소비 list row**: on pointer-down a highlight `#27282d` appears. It is a full-row rect (72.8 tall) that **starts at scale ≈ 0.96 (inset 7.2 dp) and grows to full width within ≈ 35 ms**.
  If the touch becomes a scroll, the highlight fades out in ≈ 170 ms.
- **자산 account row**: highlight `#303136` across the full card width, row-tall (57.6), radius ≈ 8. Fades in over ≈ 50 ms.
  The 송금 label inside brightens slightly. Holding it shows no scale.
- **"n개 전체보기" button**: fill `#2b2a2d` → **`#373b3f`** while pressed. After release it fades back over ≈ 150 ms. No scale was measurable.
- Not seen pressed: 분석, 받기, tabs, 송금, 자산 불러오기, segmented control, bottom-bar buttons.
  Use the same "lighten by white α .08" rule with a 150 ms fade.

### 3.4 소비 loading
1. Skeleton (§2.1.7). Real: 1.5 s.
2. Content swaps in on a single frame.

Real stages (C2 → C3 → C4) are a stale total first, then the week strip inserting 35 ms later, then fresh numbers 400 ms later.
**Clone**: show the skeleton for at least ~300 ms (or until `/api/toss/spend` resolves), then render the final state in one frame, without fade.
The home card value must equal the 소비 total, so no stale/fresh swap is needed.

### 3.5 자산 loading
The shell (header, 총 자산, tab labels) slides up with the push. The indicator appears at +1.3 s. Cards fade in over 35 ms at +1.34 s.
After that, every amount **rolls (odometer, ≈ 900 ms)** from its cached to its fresh value (153.40–154.34). The roll is the home.md §3.6 odometer.
**Clone**: render the cards ~150 ms after the push settles (or when data arrives) with a 100 ms fade.
Run the odometer only when a value changed since the last visit (keep the last values in memory). Otherwise no roll.

### 3.6 Scroll-linked behaviour
- **소비**: sticky week strip + scroll-spy day (§2.1.6).
- **자산**: sticky tabs once scroll ≥ 54.4. The indicator follows the section whose card top is nearest under the sticky bar.
  **At max scroll the last section (포인트) is forced**, which explains the jump 계좌 → 카드 → 포인트 at the end.
  Tapping a tab (not seen) should smooth-scroll so the section card top lands 8 dp under the sticky bar. Clamp at max scroll.
- **내 계좌**: not scrolled in the video. Content would scroll under the fixed floating bar, so add bottom padding 100.

### 3.7 Back
The system back (gesture/key) and the header ← both pop (§3.2). 소비 pops to home, where home.md §3.6 runs the spend odometer.

### 3.8 Keyboard / validation / errors
None in this area.

---

## 4. Data & server

### 4.1 What each screen needs

**소비** (per month M, per filter tab):

| field | rule |
|---|---|
| `total` | Σ\|amount\| over **counted** debits in month M. Counted = `amount < 0` AND not cancelled AND not an own-account transfer AND not a card-bill payment AND not manually excluded. **Transfers to other people count** (이체 is the biggest category in the video). Shown as `-N원` |
| `vsLastMonth` | `total(M, day 1..today) − total(M−1, day 1..same day)`. Text: `지난달보다 {X}만원 더 쓰는 중` (red) when > 0. X = round(\|diff\| / 10 000); if < 10 000 show `{diff}원`. Invented for the other cases: `덜 쓰는 중` in blue `#3182f6`, and `지난달과 비슷해요` in grey when \|diff\| < 1 000 |
| `categories` | counted spend grouped by `category`, sorted desc, top 3 + `그 외`. Colours: §2.1.3 for 이체 / 카테고리 없음 / 교육; invented for others (식비 `#d9822b`, 편의점·마트 `#c9a227`, 쇼핑 `#8a5cf5`, 교통 `#27a5a0`, 문화 `#d6458f`). `그 외` is always `#3e3d40` |
| `days[]` | for each date of M: `income` = Σ amount > 0 excluding own transfers; `expense` = Σ counted \|amount\|. The strip shows the week of the selected day |
| `groups[]` | days with ≥ 1 tx, newest first. Label `D일 요일` (일/월/화/수/목/금/토 + 요일). `overspent` = day expense > 2 × the month's average daily expense **and** ≥ 30 000원 (invented threshold) |
| `cashback` | `profile.cashback_count` (existing column). Row shown in **today's** group when > 0 |
| item | `{ id, title, suffix?, subtitle, amount, tone, icon }`. `tone` ∈ spend / excluded / income / cancelled (§2.1.5). `title` / `subtitle` rules are in §2.1.5 |

- Filter tabs: **카드** = `channel = 'card'`. **입·출금** = `channel = 'account'` (transfers, interest, auto-debits). **페이·기타** = `channel = 'pay'` or other.
  The total, bar, strip and list are recomputed for the filter.
- **One shared function** `spendTotal(month)` must feed both `/api/home` `spend.total` (home.md §4) and `/api/toss/spend`.
  The 🔔 override `profile.card_spend` (existing) replaces `total` in both when set.
  Note: home.md §4 proposes "card/pay tagged only". The recording shows the home value equal to the 소비 total, **transfers included**, so use the counted rule above.

**자산**:
- `total` (총 자산) = Σ balances of all accounts in 내 계좌 (토스머니 included) + Σ point balances. **Cards are not assets.**
  This matches the recording, where 총 자산 − 입출금 total = the points.
- `accounts` = the same ordered list as 내 계좌. The 자산 card shows the first 3. `count` drives "계좌 n개 전체보기".
- `cards[]` = `{ id, name, bankCode, art, monthAmount }`. `monthAmount` = Σ\|amount\| of this month's non-cancelled debits with `card_id = id`.
  Sorted by `monthAmount` desc; the card shows the first 2. `count` drives "카드 n개 전체보기".
- `points[]` = `{ id, name, balance, icon }` in sort order; the card shows the first 1.

**내 계좌**: one section `입출금` with `total` = Σ balances (토스머니 included) and every account in order, the main one flagged `isMain`.
Add more sections later (예적금, 투자) only if seeded.

### 4.2 Existing vs new server pieces
Existing, reusable:
- `accounts` (`kind` main/external, `bank_code`, `name`, `balance`, `sort`)
- `transactions` (`account_id`, `at`, `merchant`, `amount`, `tag`, `kind`)
- `transfers` (`in_tx_id` / `out_tx_id` link own transfers)
- `profile.card_spend`, `profile.cashback_count`
- `GET /api/accounts/:id` (+ `/transactions`) for the other-bank detail (account.md)
- `POST /api/transfers` for 송금

New (all gated to `APP === "toss"`; columns via `migrate()`, nullable, harmless for other apps):
- `transactions` + `category TEXT`, `channel TEXT` ('card' | 'account' | 'pay'), `card_id TEXT`, `cancelled INTEGER DEFAULT 0`, `exclude INTEGER DEFAULT 0`.
  "Own transfer" is derived as: the tx is linked from `transfers` where both sides are my accounts, or the counterparty number is one of my accounts.
- `CREATE TABLE cards (id TEXT PK, name TEXT, bank_code TEXT, kind TEXT, account_id TEXT, art TEXT, sort INTEGER)`.
- `CREATE TABLE points (id TEXT PK, name TEXT, balance INTEGER, icon TEXT, sort INTEGER)`.
- `profile.toss_money INTEGER` (home.md). 토스머니 is returned as a **synthetic account** `{ id: "money", bankCode: "toss", name: "토스머니" }` in 자산 and 내 계좌.
  It is not stored in `accounts`, so it does not leak into recipients or DevPanel account lists.
- `GET /api/toss/spend?month=YYYY-MM&tab=all|card|account|pay`
  → `{ month, label, hasPrev, hasNext, total, vsLastMonth:{diff}, categories:[{key,label,color,amount}], days:[{date,dow,income,expense}], cashback:{count}|null, groups:[{date,label,overspent,items:[…]}] }`.
- `GET /api/toss/assets` → `{ total, accounts:{count,items}, cards:{count,items}, points:{count,items} }`.
- `GET /api/toss/my-accounts` → `{ sections:[{key:"deposit",label:"입출금",total,items}] }`. This can share code with assets.
- (Optional, for the invented 화면 편집하기) `PATCH /api/toss/my-accounts` `{ order: id[] }`. It writes `accounts.sort`; 토스머니 position is stored on the profile.
- DevPanel (🔔): edit the tx `category` / `channel` / `cancelled` / `exclude`, card/point CRUD, `toss_money`.

### 4.3 Seed (invented, `seedTossExample`)
Generate timestamps **relative to now** (infra.md §2.1) so the current month always has data. Include today and ≥ 6 earlier days, plus ≥ 8 transactions in the previous month.
- Accounts, all fictional numbers:
  - main 토스뱅크 통장
  - hana 영하나플러스 통장
  - kakao 입출금통장
  - nh 자립예탁금
  - 토스머니 (profile)
- Cards (product names are fine):
  - `Young Hana+ 체크카드` (hana), linked to the hana account
  - `프렌즈 체크카드` (kakao), linked to the kakao account
  - two more, e.g. `토스뱅크 체크카드` and `토스유스카드`, to give `카드 4개` (any count works)
- Points: `토스포인트` and `하나머니` (any count ≥ 1).
- Transactions:
  - card spend at **invented** shops (e.g. `한빛편의점` 편의점, `소나무분식` 식비, `새싹문구` 교육)
  - one cancelled card tx
  - transfers to invented people (이체 → counted)
  - own transfers in both directions (excluded)
  - one card-bill auto-debit `하나카드` (excluded)
  - incomes from invented people (+, blue)
  - a 카드 캐시백 income
  - one pay tx with a two-line subtitle
  - one day with 3× normal spend, to show `평소보다 많이 씀`

---

## 5. Not visible, invented defaults

1. **소비**:
   - ◂ goes to the previous month: same layout, strip on the last week of that month, `hasNext` true. ▸ is disabled on the current month.
   - Month title tap: month picker sheet (or nothing).
   - 분석: "준비 중이에요" snackbar (home.md §5).
   - search / ⋯: snackbar.
   - 받기: snackbar "캐시백을 받았어요", then the row disappears and `cashback_count = 0`.
   - Row tap: account.md 상세 내역 for account txs; snackbar for card/pay txs.
   - ⌄ expands the strip into a **month calendar** (5–6 week rows, same cell style, chevron flips ⌃, 250 ms height animation).
   - Tabs: instant switch, the list scrolls to top.
   - Empty month/filter: centred 15 R `#8a898c` "내역이 없어요".
   - End of list: 40 dp padding.
   - Days of an adjacent month in the strip: date in `#3a393c`, not tappable. Tapping a date in the strip scrolls to its group (no group → nothing).
2. **자산**:
   - 총 자산 ›, 자산 불러오기, + 내 자산 불러오기, 카드/포인트 n개 전체보기, card/point rows: snackbar "준비 중이에요".
   - 송금 on 토스뱅크 통장: transfer flow (transfer.md). 송금 on other accounts: the same flow with that account as source if the transfer spec supports it, else a snackbar.
   - Row tap: 토스뱅크 통장 → 통장 screen (account.md); other bank → other-bank detail (account.md S4); 토스머니 → snackbar.
   - Pull-to-refresh refetches `/api/toss/assets`, then plays the finish animation. Minimum refresh time 600 ms.
3. **내 계좌**:
   - 계좌 개설 segment: the thumb slides (200 ms) to a simple list of products (토스뱅크 통장 / 모으기 통장 / 외화통장, rows with a blue "+" squircle). A snackbar is acceptable.
   - 화면 편집하기 enters edit mode: drag handles "≡" replace the 송금 buttons and the bar becomes one button "완료". Saving uses `PATCH`.
   - 계좌 불러오기: snackbar. 송금 and row taps behave as on 자산.
4. **전체 메뉴** (5th tab; not in either video):
   - Same page bg `#171619` and the home tab bar with 전체 selected (filled icon). Tab switch is instant.
   - Header: title `전체` 22 B at x 24, a search icon and a ⚙ at right.
   - Then list sections, each a section title 15 SB `#8a898c` followed by 56-dp rows (36 squircle icon, 17 M label, ›):
     - **자산**: `내 자산` → 자산, `소비` → 소비, `내 계좌` → 내 계좌
     - **토스뱅크**: `토스뱅크 통장` → 통장, `송금` → transfer, `증명서 발급` → cert flow
     - **설정**: `관리 패널` → 🔔 panel
   - Everything else gets the snackbar.
5. The home `내역` button opens 소비 (home.md). The 소비 back arrow pops to home.

---

## 6. Personal data seen (role → placeholder). Replace with seed values; never copy

| role | placeholder | format seen | where |
|---|---|---|---|
| month spend total (stale and fresh) | `<SPEND_TOTAL>` | 6 digits, "NNN,NNN원", leading "-" | 소비 summary |
| difference vs last month | `<SPEND_DIFF>` | 2 digits + "만원" | 소비 summary |
| per-day income / expense | `<DAY_IN_d>`, `<DAY_OUT_d>` | 3–6 digits with "+"/"-" | week strip |
| category shares | `<CAT_SHARE_i>` | bar widths | 소비 bar |
| cashback count | `<N>` | 1 digit + "건" | cashback row |
| counterparties (people) | `<NAME_B>` … `<NAME_F>` | 3-syllable Korean names | 소비 row titles |
| the recorder's name (as account label) | `<NAME_A>` | 3 syllables | own-transfer subtitle "<NAME_A> → 하나은행" |
| merchants | `<MERCHANT_1>` … `<MERCHANT_6>` | a convenience-store operator, a gift service, a ride service, an app store, a pay merchant with product detail, a mart | 소비 rows |
| tx amounts | `<AMOUNT>` | 1–6 digits | 소비 rows |
| dates / weekdays of the recording | `<TODAY>`, `<D>` | "D일 요일" | strip, date headers |
| account balances | `<BAL_TOSS>`, `<BAL_HANA>`, `<BAL_KAKAO>`, `<BAL_NH>`, `<BAL_MONEY>` | 1–6 digits | 자산, 내 계좌 |
| total assets / 입출금 total | `<TOTAL_ASSETS>`, `<TOTAL_DEPOSIT>` | 6 digits | 자산 header, 내 계좌 |
| card monthly amounts (stale and fresh) | `<CARD_AMT_1>`, `<CARD_AMT_2>` | 5–7 digits | 자산 card section |
| point balance | `<POINT>` | 2 digits | 자산 point section |
| counts of accounts / cards / points | `<n>` | 1 digit | "n개 전체보기" |
| other-bank account number | (account.md) | | S4 |

Not personal, OK to reuse as UI text:
- product names: 토스뱅크 통장, 토스머니, 토스포인트, 영하나플러스 통장, 입출금통장, 자립예탁금, Young Hana+ 체크카드, 프렌즈 체크카드_MC_비교통_라이언
- category labels: 이체, 카테고리 없음, 교육, 그 외
- UI labels: 평소보다 많이 씀, 캐시백 가능한 내역, and every button label

---

## 7. Assets

| asset | approach | crop (scratch, already saved) | PRIVACY verdict |
|---|---|---|---|
| Toss symbol on a navy squircle (토스뱅크 / 토스머니 / 토스포인트) | Reuse repo `src/assets/local/bank-toss.png` glyph (transparent, 150 px) at ~60 % of a 30.4 squircle with the §2.2.5 fill | `crops/logo_toss_page.png` (edit_avg, px 29,229–69,269), `crops/logo_toss_card.png` (asset_top, px 37,275–77,315) | OK: public brand mark |
| Hana logo (colour) on dark green | The repo `bank-hana.png` is a white figure on teal, so not this. Draw it in SVG (green figure + red dot) or use the crop | `crops/logo_hana_page.png` (edit_avg px 29,300–69,340) | OK: public brand mark |
| KakaoBank "B" on olive | SVG: yellow `#f7e64f` rounded "B" (the repo `bank-kakao.png` glyph recoloured also works) | `crops/logo_kakao_page.png` (edit_avg px 29,371–69,411) | OK: public brand mark |
| NH wordmark on navy | SVG text "NH", 800 weight, `#0493df` | `crops/logo_nh_page.png` (edit_avg px 29,442–69,482) | OK: public brand mark |
| Card plate: 프렌즈 체크카드 (yellow, black "B" tile) | CSS: 29.6 × 43.2 rect, radius 2.4, `#f9df02`, black rounded square with a yellow "B" at the centre-left | `crops/card_plate_yellow.png` (asset_top px 38,587–77,645) | OK: public product art, no card number |
| Card plate: Young Hana+ 체크카드 (mint, small marketing text) | CSS: gradient `#c9fcf3` → `#9cf8de`, two grey 1-dp text lines and a tiny pink wordmark; or use the crop as is | `crops/card_plate_mint.png` (asset_top px 38,660–77,717) | OK: product art only (marketing copy, no number or name) |
| 소비 category icons (이체 ₩, cashback ₩ + arrows, 편의점 store) | Draw in SVG, 36 squircle | reference only: `spend_top.png` px 28,573–78,625 / 28,656–78,708 / 28,930–78,982 | Icons are OK |
| Merchant brand logos in 소비 rows | **Do not crop.** Which merchants appear is the recorder's data. Use category icons for the invented merchants | — | **NOT OK** |
| Refresh blob, chevrons, triangles, search, ⋯, plus | SVG/CSS | — | n/a |
| Bank-logo squircle for card-bill rows (Hana full colour) | Solid brand bg (`#009490`) + white symbol (repo `bank-hana.png` works as is) | — | OK |

Crops are at only 1.25 px/dp. Use them as colour/shape references, or as a 1× fallback; SVG is preferred for every glyph.
