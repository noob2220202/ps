# Toss clone — area spec: 토스뱅크 통장 · 거래내역 · 상세 내역 · 다른 은행 계좌 상세

Scope: the Toss Bank account ("토스뱅크 통장") screen incl. its long lower product menu, the 거래내역 list, the 상세 내역 detail, and the other-bank account detail (e.g. 영하나플러스 통장). Dark theme, Galaxy frame, fixed.

## 0. Conventions used in this spec

- Video px → dp: **1.25 px/dp**, screen **384 × 852.8 dp** (480 × 1066 px). Evidence: 채우기/보내기 buttons sit at x 25–235 / 245–455 px = 20–188 / 196–364 dp (20 dp gutters, 8 dp gap, 168 dp each), list text gutters 20/24 dp, page side padding consistent everywhere. Same mapping as the nh/kbank Galaxy recordings (SOLUTION.md: 480 px recording = 384 dp).
- **Screen-dp y** = measured from the very top of the screen (status bar included). Status bar = 0–~27.6 dp (infra spec owns it), app bar ends at **y 81.6 dp** on every screen in this area (app bar ≈ 54 dp).
- Measured text values are **ink boxes** (glyph pixels), not line boxes. Font sizes were fitted against Pretendard (in node_modules) by ink width; ±0.5 dp. Weights: R = 400, M = 500, SB = 600, B = 700.
- Colors are sampled from H.264 frames (±2 per channel; small coloured text is desaturated by chroma subsampling — use the suggested token, not the raw sample, for thin blue/green text).
- pts are real presentation timestamps (ffprobe/ffmpeg showinfo), seconds. VFR: many frames are duplicated/irregular, so durations are ±30 ms.
- Personal data is never written here; see §6 for placeholders. Anything in angle brackets (`<NAME_A>`, `<ACCT_TOSS>`, `<AMOUNT>`, `<DATE>`) is a placeholder.
- Samsung **Edge-panel handle** (grey translucent bar at the left edge, x 0–5 px, around y 150–300 px) and the WebView **scrollbar** (x 474–479 px, right edge, while scrolling) are OS/WebView chrome, not app UI. The scrollbar may be reproduced optionally (see §3.9); the edge handle must NOT be drawn and must be painted out of any crop that touches x < 7 px.
- OS heads-up notifications from other apps appear over these screens at B 4.0–4.6 s, B ~75.5–78 s and B ~128–131 s (a messenger preview and bank push messages containing personal data). **Do not reproduce them.**

### Suggested colour tokens (dark)

| token | value | measured |
|---|---|---|
| `bg` page | `#17171c` | #17161b / #171719 everywhere |
| `bgDeep` section band | `#101013` | #101012 / #111113 |
| `fill` (weak button, icon tile, 복사, pills) | `#2c2c35` | #2b2b35, #2c2b33, #2a2b2f, #2b2c31 |
| `skeleton` | `#232228` | #222127–#26252b |
| `divider` (1 device px = 0.8 dp) | `#2a2a2f` (≈ rgba(255,255,255,.08)) | #2b2a2f, #252429; 상세 divider #353439 |
| `pressed` row bg | rgba(255,255,255,.08–.10) | #232228 (early), #2f2d38 (full) |
| `textStrong` | `#ffffff` | 상세 amount, back arrow |
| `text1` titles/balance | `#f0f0f3` | #efeef3, #f0eff4, #f2f1f6, 거래내역 balance #e8e8ea |
| `text2` list names / detail labels+values | `#c3c3c6` | #c0c0c2, #bfbec3, #c3c2c7 |
| `text3` 통장 mini-list names, account line | `#a5a4a9` | #a4a3a8, #a5a4a9 |
| `text4` captions/dates | `#86858a` | #848388, #86858a, #838288 |
| `text5` 거래내역 secondary (time, balance-after, date header, account line, header actions) | `#6e6e70` | #6b6b6d–#727274 |
| `chevron` | `#7a797e` (rows), `#67666b` (balance/interest) | |
| `blue` fill | `#3182f6` | #3182f7 exactly (보내기) |
| `blueText` | `#4593fc` (fallback #3182f6) | #3d82e7–#4a8efb on thin text, 채우기 label #5399f8 |
| `blueWeak` (채우기 bottom button, 받기 pill) | `#1f2942` / `#1b2943` | |
| `greenPillBg` / `greenPillText` | `#15332b` / `#5ac497` | text sampled #6e9e90 (desaturated) |

## 1. Screen inventory (with pts)

| # | Screen / state | Video A pts | Video B pts |
|---|---|---|---|
| S0 | Entry from Toss home → blank page + toast "토스뱅크로 이동했어요" + progress bar | 14.21–18.89 (toast fade-in 14.21–14.43, fade-out 19.01–19.22; progress 15.58–18.31) | — (B starts already inside) |
| S1a | 통장 progressive load: skeleton → content | 18.89 → 21.78 | 0.00 → 2.0 (already loading at start); after back-reload 79.14 → 82.97 |
| S1b | 통장 loaded, no banner | 21.78–22.70 | 2.0–3.03; 129.97–130.58 (cached re-show) |
| S1c | Banner expand (자동이체 가져오기 / 새로운 예금) | 22.70–23.33 | 3.03–3.57; 130.58–131.0 |
| S1d | Banner text reveal | 23.57–24.97 | 4.07–5.20; 130.9–131.2 |
| S1 | 통장 top, loaded with banner | 25.0–26.0, 41.7–45.25 | 5.2–6.9, 81.5–83.8 (no banner yet in that visit) |
| S1s | 통장 scrolled: header title fade-in, lower product menu (long list) | 26.0–40.5 (title in 26.86–27.35) | — |
| S1t | Fling back to top, title fade-out, overscroll | 40.5–41.73 | — |
| S1p | Press on a mini-tx row (highlight+scale) | 43.37–44.10 | — |
| P1 | Push 통장 → 거래내역 (old fades, new slides up) | 45.25–45.77 | — |
| S2a | 거래내역 loading (blank + progress, header actions later) | 45.50–49.05 | 75.0–77.1 (after transfer ad) |
| S2 | 거래내역 loaded (top) + transient blue ✓ | 49.05–51.9 (✓ 49.74–~50.5) | 77.1–79.0 (✓ 77.39–~77.8) ; A 111.0–112.7 |
| S2s | 거래내역 scrolled (header transparent → opaque) | 51.9–56.4, 102.8–110.3 | — |
| P2 | Push 거래내역 → 상세 | 56.40–56.80 (content 57.75) | — |
| S3 | 상세 내역 — incoming own-account transfer (credit) | 57.75–60.9, 101.3–102.7 | — |
| S3' | 상세 내역 — outgoing transfer to another person (debit) | 105.76–108.7 | — |
| P3 | Pop (상세 → 거래내역, 거래내역 → 통장) | 102.7, 108.8 | 79.01–79.24 |
| S4 | Other-bank account detail (영하나플러스 통장) incl. refresh state | — | 161.5 blank, 161.75 skeleton, 162.75 balance shimmer, 163.0 loaded, ✓ 163.9; back 164.9 |

Out of my area but adjacent: 증명서 발급 (A 60.9–101.3, entered from S3 "증명서 발급하기"), transfer flow (entered from 보내기, A 112.7 / B 6.9, 84.4), ad pages after transfer (B 71–75, 126–129.8), 자산 (B 150–175).

## 2. Layouts

### 2.1 Shared app bar (all screens here)

- Height 54 dp, bottom at y 81.6. Back arrow: white (#fff), ink x 18.4–38.4 dp, y 45.6–64.0 (20 × 18.4 ink → 24 dp icon box centred at x 28.4, y 54.8). Arrow = straight shaft + 2 strokes, ~2 dp stroke, square-ish caps — draw in SVG.
- 통장: right **gear outline** icon, ink x 336.8–358.4, y 43.2–66.4 (≈24 dp box ending at x 359.6), colour #cecdd2. Appears only once the page has loaded (A 21.78; B 130.6).
- Header background per screen: 통장 = transparent + backdrop blur (see §3.4); 거래내역 = scroll-linked opaque bg (§3.5); 상세/other-bank = opaque `bg`.

### 2.2 S1 — 토스뱅크 통장 (top block)

All y below are for **no banner, scrollTop 0**. With the banner, everything from the title row down moves +180.8 dp (banner occupies screen y 81.6–262.4 and the content "sheet" starts at 262.4 with 20 dp top corner radius).

| element | x (dp) | y (ink, dp) | style |
|---|---|---|---|
| Title row: product icon tile | 20–50 (30 dp tile, radius ≈9) | 93.6–123.2 (centre 108.4) | tile `fill` #2c2c35; Toss Bank logo (two blue rounded leaves, #1fa2fc→#005feb) ~20 dp inside — SVG or crop T1 |
| "토스뱅크 통장" | 62.4–153.6 | 100.0–116.0 | 17 B, text1 |
| "내 자산 2개" + chevron-down | text 286.4–343.2, chevron 349.6–358.4 (8.8 × 5.6 ink, ~14 dp icon) | 102.4–114.4 | 13 R, #838288; chevron #7b7a7f. Count = `<N>` |
| Divider under title row | full width, fades out over ~30 dp at both ends | 133.6 (1 device px) | centre #28272c, `linear-gradient(90deg, transparent, #28272c 10%, #28272c 90%, transparent)` |
| Account line "토스뱅크 `<ACCT_TOSS>`" | 20.0–170.4 | text 156.8–168.8, underline 171.2–172.0 | 13 R, text3 #a5a4a9; solid underline 1 device px, colour #67666c (≈ text at 60 %), offset ≈2.4 dp below glyph bottom |
| Balance "`<AMOUNT>`원" | from 20.8 | 182.4–204.0 (digit cap 18.4, 원 21.6) | **24 B**, text1 (#f0eff4) |
| Balance chevron › | 349.6–355.2 (≈16 dp icon box 344–360) | 178.4–188.8 (centre 183.6; vertically centred on the account+balance block) | #67666b |
| Interest row icon | circle ≈27–28 dp, x 25.6–52.0 | 240.0–267.2 (centre 253.6) | circle #9e9ea6 (grey600), lightning glyph dark #17171c — CSS circle + SVG bolt (or crop T2) |
| Interest caption "어제까지 쌓인 이자" | 66.4–160.8 | 235.2–247.2 | 13 R, text4 #8b8a90 |
| Interest value "`<AMOUNT>`원" | 66.4 | 253.6–268.8 | 17 B, text1 |
| Interest chevron | 345.6–351.2 | 248.0–258.4 | #69686d. Note: inset 4 dp more than the balance chevron → the interest row is a padded pressable box (x 16–356) |
| Mini tx list (latest 3) | date col centred at x 38.8; name x 66.4; amount right edge 359.2 | row ink tops 310.4 / 342.4 / 375.2 (pitch 32.4) | date 13 R #86858a (shown only on the first row of each date, format `M.D` without zero padding); name 15 R text3 #a4a3a8; amount 15: negative R #a6a5aa "-1,234원", positive **B #ffffff** "+1,234원" |
| 채우기 / 보내기 buttons | 20–188 / 196–364 | 415.2–456.8 (≈42 dp) | `fill` #2b2b35, radius 12, label 15 SB #cbcbd5 centred (label ink 428.0–442.4) |
| Divider | x 24 → right edge 384 | 472.8 | `divider` #2b2a2f |
| Row 체크카드 | tile 20.8–49.6 (30 dp, radius ≈9, `fill`), title x 62.4 | tile 489.6–519.2; title ink 496.8–512.0 | title 17 M #ecebf0; right: chevron only (x 355.2–360.8, #7a797e) |
| Row 비상금 | same | tile 536.8–565.6; title 542.4–558.4 | right "보관하기" 15 M blueText (ink x 292.0–343.2) + chevron |
| Row 자동이체 | same | tile 581.6–611.2; title 588.0–604.0 | right "등록하기" 15 M blueText + chevron |
| Section band | full width | 628.0–644.0 (16 dp) | `bgDeep` #101012 |
| "추천" caption | x 20 | 672.8–684.8 | 14 M, text4 #848388 |
| 추천 row 1 (two-line) | tile 20.8–49.6, text x 62.4 | tile 715.2–743.2; caption 711.2–723.2, title ~728–747 | caption "오늘 받을 수 있는 혜택" 13 R #8b8a90; title "최소 `<AMOUNT>` 보기" 17 SB white; chevron x 357.6–363.2 |
| 추천 rows 2–4 | tile 20.8–49.6 | 외화통장 766.4–794.4; 나눠모으기 통장 812.0–837.6; 굴비적금 ≈857–887 | title 17 M; chevron 355.2–360.8 |
| Divider | x 20–364 | ≈903 | `divider` |
| "더 보기 1/2" | centred (ink 155.2–228.8) | 920.8–935.2 | "더 보기" 14 R #a8a7ac + 6 dp gap + "1/2" 13 R #88878c |
| Section band | full width | ≈960–976 | `bgDeep` |
| Native ad row | logo 20–56.8 (36.8 dp rounded square, radius ≈10, white bg); text x 68 | logo 996.8–1034.4; title ink 999.2–1012.8; sub 1020.8–1032.8 | title 17 SB #d2d1d6 (Latin "THE BLUE SALE" in video — use invented ad); sub "… • AD" 13 R #a3a2a7 |
| Divider | x 20–364 | 1052.8 | `divider` |
| Promo card | image tile 24–119.2 (≈96 dp square, radius ≈20, `fill`), text x 135.2 | tile 1073.6–1168.8; title 1078.4–1095.2; body 1111.2–1123.2; link 1131.2–1143.2 | title "새로운 예금이 나왔어요" 17 B text1; body "1년 보관하면 연 3.8% 받아요. (세전)" 13 R #a3a2a7; link "더보기 ›" 13 M blueText |

Notes
- "어제까지 쌓인 이자" is the real label (the task brief's "이번 달 받은 이자" is not what the screen shows).
- Icons inside the 30 dp tiles are ~20–22 dp 3D Toss icons → crop (see §2.9) or redraw.

### 2.3 S1 — banner (top of the 통장 scroll content)

Banner area: screen y 81.6–262.4 (180.8 dp tall) **inside the scroll content** (scrolls away with the page), full bleed, dark navy art; the content sheet below overlaps it with a 20 dp top-corner radius (sheet bg `bg`). Two variants seen:

| | A (자동이체) | B (새로운 예금) |
|---|---|---|
| title (2 lines) | "자동이체 가져오기가 / 새로 나왔어요" | "토스뱅크에 / 새로운 예금이 나왔어요" |
| subtitle | "흩어진 자동이체를 한 번에 가져올 수 있어요." | "1년 보관하면 연 3.8% (세전)" |
| CTA | "보러가기" | "자세히 보기" |
| art | blurred keyboard keys + blue check tile (right) | pink/purple blobs + party popper (right) |

- Title: x 20, ink 112.8–158.4 (2 lines, ≈19 B, line height ≈26), colour light blue-white (#a8d1fd at the brightest pixel; use `#b4d6ff` or a white→#a8d1fd vertical gradient).
- Subtitle: x 20.8, ink 173.6–185.6, 13 R, #9ca2b8.
- CTA button: x 20–96 (A, hugs text with ~16 dp side padding), y 205.6–243.2 (≈38 dp), radius ≈10, bg #3182f6 with a subtle lighter top-left (#3484f7), label 15 SB white.
- Close X: circle 36 dp at x 328–364, y 101.6–137.6, bg rgba(255,255,255,.15) (#3e4150 on the art), × glyph ~14 dp #a7a5b0, stroke ~2 dp.
- Banner art = image asset (crop B1/B2, §2.9). Title/subtitle/CTA/X are live text/elements on top.

### 2.4 S1 — lower product menu (same screen, continues below the promo card)

**Decision: this long list is part of the 통장 screen, not a separate 전체 menu.** Evidence: (1) scroll-offset tracking over A 25.97–40.5 shows one continuous scroll of 6119 px (4895 dp) with no navigation transition; (2) the header stays "← · 토스뱅크 통장 ⌄ · ⚙" throughout; (3) the fling at 40.5–41.4 returns (−6126 px) straight to the banner/balance of the same page; (4) the stitched page (scratch `frames/account/pageA.png`) has no seams of a different layout.

Row rules (all sections):
- Section header: 19 B text1 (#fbfaff), x 20; optional right caption 11 R #818085 right-aligned at x 363.2 ("금리, 세전", "수익률, 세전", "제휴사상품 | 금리, 세전", "제휴카드 | 최대 기준"). Sub-headers "제휴사", "갈아타기": 17 SB grey #aeadb2.
- Product row: icon **24 dp bare (no tile)** at x 20.8–44.8; title 17 R/M text1 at x 56; right label 13 M blueText right-aligned at x 364 (or grey #87868b for non-rate labels "NH투자증권 · 제휴", "토스 서비스·광고", "노란우산"); no chevron.
- Heights: single-line row **48 dp**; row with a two-line right label (rate + grey "12개월 기준" 13 R #a3a1ac) **64 dp** (title stays vertically centred).
- Spacing: header ink-top → first row title ink-top 46.4 dp (54.4 if that row is two-line); last row title ink-top → next header ink-top ≈61 dp (section gap ≈ 24 dp padding-top + 28 dp header line + 8 dp).
- "새로 나온" pill (펀드 row): x 305.6–364.8, h ≈24, radius 12, `greenPillBg`, 13 SB `greenPillText`.

Section/rows in order (no-banner screen-dp of the header ink top in brackets; add 180.8 when the banner is present):

1. **통장** [1212.8] (금리, 세전): 토스뱅크 통장 연 1% · 나눠모으기 통장 연 1.4% · 개인사업자 통장 연 0.1% · 개인사업자 금고 연 1.4% · 모임통장 연 0.1% · 모임금고 연 1.4% · 아이 통장 연 0.1% · 이자 받는 저금통 연 1.4% · 게임 저금통 연 0.1% · 생계비보호 통장 연 0.1%
2. **예적금** [1750.4] (금리, 세전): 먼저 이자 받는 정기예금 연 3.6% / 12개월 기준 · 원하는 날 만기되는 정기예금 연 3.8% / 12개월 기준 · 키워봐요 31일적금 연 1% ~ 10% · 자유적금 연 3.25% ~ 3.75% / 12개월 기준 · 굴비적금 연 1.8% ~ 4.3% · 아이적금 연 2.5% ~ 5% · 태아적금 연 1% ~ 5%
3. **외화** [2195.2]: 외화통장 환율 100% 우대 · 외화 저금통 환율 100% 우대 · 해외송금 송금 수수료 혜택
4. **투자** [2399.2] (수익률, 세전): 펀드 [새로 나온] · MMF 연 3.3%
5. **제휴사** [2556.0, sub-header] (수익률, 세전): 채권·발행어음·RP 연 2.6% ~ 8.67% · 금 투자 NH투자증권 · 제휴 (grey) · 공모주 일정 (none) · 증권계좌 최대 3만원 혜택
6. **연금** [2805.6] (제휴사상품 | 금리, 세전): 내 국민연금 확인하기 · 연금 상품보기
7. **대출** [2960.0]: 내 최대 한도 알아보기 · 신용대출 연 4.58% ~ 15.00% · 비상금·마이너스통장 연 6.24% ~ 15.00% · 햇살론 연 4.58% ~ 12.50% · 주택담보대출 연 4.41% ~ 9.09% · 전월세보증금대출 연 4.17% ~ 7.16% · 개인사업자대출 연 1.57% ~ 15.00% · 개인사업자마이너스통장 연 5.66% ~ 15.00% · 전문직사업자대출 연 4.07% ~ 7.33% · 71개 금융사 대출 더보기 토스 서비스·광고 (grey)
8. **갈아타기** [3500.0, sub-header]: 신용대출 갈아타기 연 5.64% ~ 15.00% · 전월세보증금대출 갈아타기 연 4.13% ~ 7.16% · 개인사업자대출 갈아타기 연 4.01% ~ 14.68%
9. **신용카드** [3702.4] (제휴카드 | 최대 기준): 토스뱅크 하나카드 Day 생활비 10% 할인
10. **체크카드** [3809.6]: 토스뱅크 체크카드 · 아이 체크카드 만들기 · K-패스 체크카드 · 모임카드 · 개인사업자 체크카드
11. **서비스** [4109.6]: 쉬운 근로계약서 · 전세지킴보증 · 자동이체 · 자동이체 가져오기 · 세금·공과금 · 지금 이자 받기 · 외화 정기적으로 모으기 · 이자 달러로 모으기 · 외화 평균환율 계산기 · 개인사업자 소득공제 노란우산 (grey) · 내 사업소득 순위 알아보기 · 주택구입비용 계산기 · 1억 모으는 시간 계산기 · 미라클 모닝 도전하기 · 모임 정산 · 함께 쓰는 캘린더 · 아이와 용돈 미션 · 내 투자계좌 잔돈 찾기
12. **유용한 정보** [5030.4], right "더보기" pill (x 310.4–364, h 32, radius ≈10, `fill`, 13 M #c3c3c6). Two article rows: thumbnail 56 × 56 (x 19.2–76, radius ≈12, light illustrations) + title 17 R #e1e0e5 at x 86.4, row pitch 80.8 dp: "청년문화예술패스, 이달 말 신청 마감돼요", "퇴직금 계산, 기준부터 알아봐요".
13. **간편히 보기** row [text block 5260.0–5296.8]: "T" icon (blue serif T, ~20 dp) at x 26.4–45.6; caption "큰 글씨로 보고싶다면" 13 R #8b8a90 + title "간편홈 보기" 17 B white at x 60.
14. **의견** row [5335.2–5372.0] (pitch 75.2): mailbox icon (blue box + white lid, ~22 dp) at x 25.6–47.2; caption "의견을 알려주세요" + title "바뀐 토스뱅크 화면, 어떠셨나요?" 17 B white.
15. Bottom padding: at max scroll the last row sits at screen y ≈627–666, i.e. ≈187 dp of empty `bg` below it (page padding-bottom ≈150 dp + system inset).

Max scrollTop: 4895 dp with banner (4714 without). Exact rates/labels above are public product info shown in the app; keep them as static seed content.

### 2.5 S2 — 거래내역 (Toss Bank account transactions)

Screen-dp, scrollTop 0 (frame A 51.05 s). Side padding **24 dp** (not 20) except filter row.

| element | x | y (ink) | style |
|---|---|---|---|
| Header right: card icon + "카드" | icon 238.4–252.0 (vertical rounded card, filled), text 261.6–290.4 | 45.6–64.0 | icon+text #727274, text 16 R |
| Header right: gear (filled) + "관리" | icon 311.2–328.8, text 336.0–364.0 | 45.6–64.0 | #727274, 16 R |
| (no title; header actions appear only when loaded — A 48.2) | | | |
| Account line "토스뱅크 `<ACCT_TOSS>`" + underline | 24.0–174.4 | 116.8–129.6 (incl. underline) | 13 R #6d6d6f, underline same colour |
| Balance | 24.8–… | 140.8–167.2 (digit cap 23.2, 원 26.4) | **30 B** #e8e8ea |
| Interest icon (same bolt circle) | 25.6–52.0 | 214.4–240.8 | as 통장 |
| Interest caption / value | 66.4 | 209.6–221.6 / 228.0–243.2 | 13 R #707072 / 17 B text1 |
| Interest chevron | 353.6–359.2 | 222.4–232.8 | #555557 |
| Band | full width (starts at x≈40, fades in to the right) | 272.0–282.4 | `#1f1f22` with `linear-gradient(90deg, transparent 8%, #1f1f22 80%)` — static, present in every 거래내역 instance |
| Filter "전체 ⌄" | text 20.0–44.8, chevron 51.2–60.0 | 302.4–316.0 | 15 M #929294 |
| Transient ✓ | 307.2–323.2 | 305.6–316.0 | blueText, ~16 dp check (see §3.6) |
| Search button | circle 332–364 (32 dp), border 1 dp ≈#2c2c30, magnifier 16 dp #949496 | 295.2–326.4 | |
| "AD" caption | 24.0–41.6 | 343.2–352.8 | 13 R #959597 |
| Ad row | logo 23.2–61.6 (≈38 dp rounded square, radius ≈10); text x 72 | logo 372.0–410.4; title 375.2–391.2; sub 396.8–408.8 | title 17 SB #ccccce; sub "… • AD" 13 R #a2a2a4 |
| Date header "`M`월 `D`일" | 24.8 | first at 439.2–451.2 | 13 M #6c6c6e |
| Tx row | icon circle **40 dp** x 24–64; name/time x 76.8; amount/balance right edge 359.2 | icon 465.6–505.6; name 468.0–484.0; time 492.0–500.8; amount 468.0–485.6; balance-after 490.4–501.6 | name 17 SB #c0c0c2; time `HH:mm` 13 R #6e6e70; amount 17 SB: negative #c1c1c3 "-1,234원", positive blueText "+1,234원"; balance-after 13 R #6b6b6d "1,234원" |
| Rhythm | | row pitch **58.4 dp**; a date header adds **31.2 dp** (prev row icon top → date ink top 63.2; date ink top → next icon top 26.4) | |
| Bottom bar | 채우기 20–188, 보내기 196–364 | 762.4–819.2 (**56 dp**), radius **16** | 채우기 bg #1f2942 + label 17 SB #5399f8; 보내기 bg #3182f6 + label 17 SB white. Above the buttons the list fades out: gradient `bg` 0 → 100 % over ≈40 dp (y ≈722–762). Fixed (sticky) at the bottom; list scrolls under it. |

Row icon types (all 40 dp circles):
- transfer (to/from a person or own account): navy circle #1c3a6e with a white rounded "₩" badge (crop T15 or SVG),
- 카드 캐시백: gold medal on olive circle #6b5f3a (crop T16),
- 통장 이자: grey #4d4d52 circle with a receipt-₩ glyph (crop T17),
- merchant with no logo: grey #6b6b70 circle with white "···" (crop T18),
- merchants with brand logos (seen: a shopping-mall logo, an auction red "A.") → **do not copy brand logos**; use invented merchants with a letter avatar or the generic "···" icon.

### 2.6 S3 — 상세 내역

Opaque header with title **"상세 내역"** left-aligned at x 72.0–132.0 (17 SB white, ink 46.4–62.4). Content (screen-dp):

| element | x | y (ink) | style |
|---|---|---|---|
| Counterparty icon | 24–48 (24 dp circle; same navy ₩ as list) | 133.6–158.4 | |
| Counterparty name | 56.8 | 137.6–149.6/150.4 | 14 R #b6b9be |
| Amount "+`<AMOUNT>`원" / "-`<AMOUNT>`원" | from 24.8 | 166.4–194.4 (digit cap 22.4, 원 24.8) | **28 B #ffffff** for both signs (not blue) |
| 복사 button | 296–360 (64 dp) | 160–197.6 (≈37 dp), radius ≈10 | `fill` #2a2b2f, label "복사" 15 M #c1c2c6 |
| Rows (label left x 24.8, value right-aligned at 359.2) | | label ink tops: 적요 241.6 · 거래 유형 296.0 · 입금처 347.2 · 출금처 394.4 · 메모 445.6 · 일시 501.6 · 거래 후 잔액 556.0 · (debit only) 받는 분 통장표시 611.2 | all 16 R; label #bdbcc1, value #bfbec3 |
| 입금처 / 출금처 values | right-aligned, x ≥184 | | underlined (link style, same colour), e.g. "내 토스뱅크 `<ACCT_TOSS>`", "`<BANK>` `<ACCT_B>`" |
| 메모 value | "메모남기기" 266.4–339.2 + chevron 353.6–359.2 | | 16 R blueText; chevron #57565b |
| Divider | x 24 → 384 | credit ≈597, debit 652.8 | #353439 |
| "증명서 발급하기" row | doc icon 20 dp (x 27.2–47.2, cream page + orange seal; crop T19), text x 60, chevron 353.6–359.2 | credit 620–644 (text 622.4–638.4); debit 675.2–700 | 16 R #bebdc2 |

Value formats: 적요 = name shown in the list; 거래 유형 = "입금" / "출금"; 일시 = `YYYY년 M월 D일 HH:mm`; 거래 후 잔액 = `N원`; 받는 분 통장표시 = text printed on the receiver's passbook (sender's name by default).
Own accounts are prefixed with "내 " ("내 토스뱅크 …", "내 하나은행 …"); other people's accounts show "`<BANK>` `<ACCT>`" only. Account numbers are shown dashed per bank pattern (Toss 4-4-4, Hana 3-6-5 — already in server/banks.mjs).

### 2.7 S4 — other-bank account detail (영하나플러스 통장 at B 163–164.9)

Same skeleton as 거래내역 with these differences (screen-dp):
- Header: title = account product name, 17 SB white, x 72.0–190.4; right: refresh indicator at x 288–308.8 (spinner while refreshing → blue ✓ when done) and a **dim filled gear** x 336–357.6 (#58585a).
- Account line "`<BANK>` `<ACCT_HANA digits only, no dashes>`" x 24–173.6, ink 115.2–128.0, 13 R, **#e5e4e9** (brighter than Toss's), underlined.
- Balance ink 142.4–168.0, 28–30 B white; while refreshing it shows a left→right shimmer sweep over the digits (one sweep ≈1.3 s, B 162.9–164.2).
- Rate line "연 0.1%" x 24, ink 191.2–202.4, 13 R #c3c2c7.
- Cashback row: icon tile 36 dp (x 24.8–60, y 252.8–286.4, `fill`, blue circular-arrows ₩ icon, crop T20); text "캐시백 기회 `<N>`번 남음" x 72.8, 17 M #c2c1c6 with "`<N>`번" in blueText; pill "받기" x 307.2–360, y 253.6–285.6 (32 dp), radius ≈8, bg #1b2943, 15 M #5a9fec.
- Ad row (logo 23.2–61.6, y 308–346.4; title 17 SB, sub 13 R "… · AD").
- Filter "전체 ⌄" (378.4–392.8) + 32 dp search circle (332–363.2 / 369.6–401.6).
- List rows: **no icons**; date column `MM.DD` (e.g. "01.05", zero-padded month) 13 R #727176 at x 20.8–46.4, only on the first row of each date, aligned with the name line; name 17 SB #c3c2c7 at x 66.4; time `HH:mm` 13 R #706f74; amount 17 SB right at 364: deposits **blue without "+"** ("1,234원"), withdrawals #c2c1c6 "-1,234원"; balance-after 13 R #727176. Row pitch **65.6 dp** (name ink tops 424.8, 490.4, 556.0, 621.6, 687.2). Side padding 20 dp (right edge 364).
- Bottom bar identical to 거래내역 (56 dp, 채우기 weak-blue + 보내기 blue).

### 2.8 Toast S0 "토스뱅크로 이동했어요"

Pill centred horizontally, x 91.2–290.4 (≈200 dp, hugs content, padding ≈18 dp), y 29.6–78.4 (≈48 dp, radius 24), bg #1f1f22. Content: Toss Bank logo 20 dp + "토스뱅크" 17 SB blue (#3182f6) + "로 이동했어요" 17 SB white. Sits over the app-bar area (back arrow still visible at left). The reverse direction (Toss Bank → Toss) shows the same pill with "토스" in blue: "토스로 이동했어요" (B 127.6).
Progress bar under the app bar: y 80–82.4 dp (2 dp), track #5c5d62, fill blue (#3182f6 at ~60 % → #304469 sampled), full width.

### 2.9 Assets (crops already extracted to scratch)

Crops are in `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/toss/frames/account/icons/` (manifest: `manifest_top.json`, `manifest.json`; contact sheets `icons_top_sheet.png`, `icons_sheet.png`). Boxes are in video px (x0, y0, x1, y1) of the frame at the given pts. Native size is small (24 dp icon = 30 px); upscale ×2 (Lanczos) or redraw for the simple ones.

| id | what | source | box (px) | verdict |
|---|---|---|---|---|
| T1 | Toss Bank logo in 30 dp tile | A 25.970 | 24,340,64,380 | PRIVACY OK (public brand mark); prefer SVG |
| T2 | interest bolt circle | A 25.970 | 28,520,68,560 | OK; SVG easy |
| T3–T5 | 체크카드 / 비상금 / 자동이체 tiles | A 25.970 | 24,836,64,876 · 24,892,64,932 · 24,951,64,991 | OK |
| T6–T9 | 추천 icons (₩ coin, 외화통장, 나눠모으기, 굴비) | A 26.888 | 24,615,64,655 · 24,679,64,719 · 24,736,64,776 · 24,793,64,833 | OK |
| T10 | promo "NEW" deposit book tile | A 28.251 | 28,493,150,616 | OK |
| T11–T12 | 유용한 정보 thumbnails | A 39.322 / 39.102 | 22,450,98,522 · 22,563,98,635 | OK (public article art; T12 frame may show press tint at corners → key out to `bg`) |
| B1 | banner art 자동이체 (no text yet) | A 23.439 | 0,102,480,328 | OK; paint over x<7 (edge handle) |
| B2 | banner art 새로운 예금 (no text yet) | B 3.932 | 0,102,480,328 | OK (the OS notification is above y 102, excluded); paint over x<7 |
| T15–T18 | tx icons: transfer ₩, medal, interest receipt, generic "···" | A 51.047 (T15,T16), A 53.9996 (T17,T18) | 28,580,82,634 · 28,692,82,746 · 28,138,82,192 · 28,358,82,412 | OK (generic) |
| T19 | 증명서 doc icon | A 59.511 | 30,770,66,808 | OK |
| T20 | other-bank cashback tile | B 164.003 | 28,312,78,362 | OK |
| L1–L67 | product-menu 24 dp icons (names in manifest.json, e.g. `tongjang_tossbank`, `saving_gulbi`, `svc_100m_calc`) | A 26.9–39.3 (per manifest) | 40 × 40 px boxes per manifest | OK; a few (`tongjang_biz`, `refi_credit`, `fx_remit`, `check_kid`, `svc_miracle_morning`) carry a lighter pressed/scrollbar background → key to `bg` |
| — | ad logos (sportswear brand, gifticon "G"), merchant logos in tx list | — | — | **DO NOT CROP** (third-party brands tied to the recorder's activity) — use invented ads/merchants |

Draw in SVG/CSS (no crop needed): back arrow, gear (outline 통장 / filled 거래내역·other-bank), card icon, chevrons (›, ⌄), close ×, search magnifier, ✓, spinner, "T" icon, underline, skeleton bars.

## 3. Interactions & transitions

### 3.1 Page push/pop (all Toss Bank pages; Android activity-style)
- **Push** (통장→거래내역 A 45.25–45.77; 거래내역→상세 A 56.40–56.80; 자산→other-bank B 161.3–161.75): old page fades to `bg` in ≈100 ms (A 45.36→45.46); the new page then enters with **translateY +33 dp → 0** (41 px; ≈4 % of screen height) + opacity 0→1, decelerating, settles in ≈270 ms (A 45.50→45.77; positions 98→83→78→71→68→66→64→62→61→60→59→58→57 px). While the new page is offset the strip above it is black for ≈100 ms (status bar area) — optional.
- **Pop** (back button/gesture; B 79.01–79.24, A 108.8): top page translateY 0 → +38 dp (47 px) with fade, accelerating, ≈120 ms; the page below appears with a small 5 dp downward settle over ≈100 ms. Pages left in the stack are re-shown from cache instantly (A 101.3 상세, A 102.8 list); a destroyed page reloads (B 79.14→82.97 통장 skeleton again).
- Recommended clone: push 280 ms `cubic-bezier(0.05,0.7,0.1,1)` translateY(33dp→0) + opacity 0→1 in the first 100 ms; pop 150 ms `cubic-bezier(0.3,0,0.8,0.15)` translateY(0→38dp) + opacity →0.

### 3.2 S0 → S1 loading timeline (real → suggested clone)
| step | real (A) | clone |
|---|---|---|
| page enters (from home 토스뱅크 통장 tap) + toast fade-in 200 ms | 14.21–14.43 | 0–200 ms |
| blank page; progress bar appears at 70 % | 15.58 | 150 ms |
| progress 70→100 % (300 ms), hide | 17.41–17.71, hidden 18.31 | 500–800 ms |
| step 1: title row + 채우기/보내기 + divider; skeleton for the rest (bars `skeleton`, radius 4–8; rows = 30 dp tile + 100–130 dp bar + right 40 dp bar) | 18.89 | 850 ms |
| step 2: account line + balance | 18.99 | 900 ms |
| toast fade-out 200 ms | 19.01–19.22 | 900–1100 ms |
| step 3: mini-tx & 체크카드-row skeletons, "내 자산" skeleton bar | 20.36 | 1050 ms |
| step 4: interest row inserted (pushes content down, no animation) | 20.73 | 1150 ms |
| step 5: all content + gear | 21.78 | 1300 ms |
| banner expand (§3.3) | 22.70–23.33 | 1800–2350 ms |

Re-show from cache (B 129.97): content appears instantly with the **previous** balance/mini-list, then refreshes in place: balance updates at +200 ms (B 130.17), mini-list gets the new row at +400 ms (B 130.37), banner expands at +600 ms (B 130.58).

### 3.3 Banner reveal (per visit, if not closed)
1. Expand: banner height 0 → 180.8 dp, everything below pushed down; the art is anchored to the top (revealed by the moving sheet, it does not slide). Duration ≈550–600 ms, mild ease-in-out (progress 20 % @25 % time, 50 % @50 %, 78 % @75 %). A 22.70–23.33, B 3.03–3.57.
2. +250 ms: title fades in (≈400 ms) **vertically centred** in the banner (≈18 dp lower than final) with ≈5 dp upward drift (A 23.57–24.0).
3. +700 ms after step 2 start: title slides up ≈18 dp (≈330 ms, ease-in-out; A 24.29–24.62) while subtitle, CTA and × fade in (≈400 ms; A 24.55–24.97, B 4.78–5.20).
- × (invented, not tapped in video): collapse banner (reverse of 1, 350 ms) and remember dismissal for the session. CTA → toast "준비 중이에요" (or the matching product row page if one exists).

### 3.4 통장 scroll behaviour
- Header (status-bar below to y 81.6) is **transparent with backdrop blur** (≈20 px); content scrolls beneath and shows blurred (A 26.24: banner art visible through it). No tint (at scrollTop 0 it equals `bg`).
- **Header title** "토스뱅크 통장 ⌄" (17 B text1, centred, ink y 47.2–60.8, chevron #7b7a7f) fades in (pure opacity, no slide) when the interest row has scrolled completely under the header (threshold ≈ scrollTop 186 dp without banner / 367 dp with banner); observed 26.86–27.35 (≈90 % by +260 ms). Fades out when scrolled back above the threshold (41.40–41.73). Use 250 ms ease-out with ≈80 ms delay.
- Fling/overscroll: native momentum; at the top an Android stretch overscroll (content overshoots 9 px and settles, A 41.40–41.67) — browser default is fine.
- Nothing is sticky inside the 통장 content.

### 3.5 거래내역 scroll behaviour
- Header has no title. Its background is **scroll-linked**: fully transparent at scrollTop 0 (content visibly passes under the back arrow, A 52.06–52.20), then content under it is dimmed and fully hidden once scrolled ≈200 dp (A 52.29 partially dim, A 54.0 opaque). Implement `opacity = clamp((scrollTop − 40dp) / 120dp, 0, 1)` on a `bg` layer behind the header.
- Filter row is **not sticky**; bottom bar is fixed; list fades under it (≈40 dp gradient).
- Max scroll in the sample ≈ 890 dp for ~20 rows; nothing else sticks.

### 3.6 Transient ✓ next to search
Blue check (≈16 dp, blueText) appears right after the list finishes loading (A 49.74, B 77.39) and when the list is flung back to the top (A 111.09), visible ~0.1–1.0 s, then disappears. Clone: show 1.0 s after each (re)load, fade out 200 ms.

### 3.7 Pressed states
- Rows (통장 mini-tx row, product rows, 유용한 정보 rows, list rows): rounded highlight inset 4–8 dp horizontally, radius 8–12 dp, rgba(255,255,255,.08→.10) (#232228 at first frame → #2f2d38 full); row content scales to ≈0.98 (A 43.50: the date label shifted right 4 px, the amount left 4 px). Fade-in ≈100 ms on touch-down, fade-out ≈250 ms after release; a press that turns into a scroll cancels (A 39.32 highlight during scroll).
- Buttons (채우기/보내기/복사/pills): darken ≈8 % + scale 0.97 (not visible in video; standard Toss behaviour — invented).

### 3.8 Taps (observed → implement)
| tap | result in video | clone |
|---|---|---|
| Toss home "토스뱅크 통장" row | S0 toast → S1 (A 14.2) | same |
| 통장 mini-tx row (any) / balance block | 거래내역 S2 (A 43.4 press → 45.25 push; the 1.7 s gap is WebView latency) | push S2 after ≈150 ms |
| 통장 채우기 / 보내기 | 보내기 → transfer flow "어디로 보낼까요?" (B 6.9) | transfer area spec |
| 거래내역 row | 상세 S3 (A 56.4, 104.6) | push S3 |
| 거래내역 보내기 | spinner → transfer (A 112.7–113.0) | transfer area spec |
| 상세 "증명서 발급하기" | 토스뱅크 증명서 발급하기 (A 60.4–60.9) | certificate area spec |
| back (arrow / gesture) | pop | pop |
| 자산 → other-bank row | S4 (B 160.8 press → 161.5) | push S4; header spinner 1.2 s → ✓, balance shimmer during refresh |
| everything else (gear, 내 자산 N개, 이자 row, 체크카드/비상금/자동이체, 추천, 더 보기, product rows, ad, promo, 카드, 관리, 전체 filter, search, 복사, 메모남기기, account-link values, 받기) | not tapped | see §5 |

### 3.9 Optional chrome
WebView scrollbar: 3–4 dp wide at x 379–384, #6f6e73, ~60 dp tall thumb proportional, visible while scrolling and fades ≈1 s after the scroll ends. Purely cosmetic.

## 4. Data & server

Existing endpoints in `server/index.mjs` that already fit:
- `GET /api/accounts/:id` → account (name, number, balance, bank). Need `name` ("토스뱅크 통장" / "영하나플러스 통장"; column exists via migrate).
- `GET /api/accounts/:id/transactions` → rows already carry `date` (MM.DD), `time` (HH:mm), `merchant`, `amount`, `tag`, `balanceAfter`. Client derives: 통장 mini list = first 3; date label `M.D` (strip zero padding) on first row per date; 거래내역 date header `M월 D일` (add `YYYY년 ` when not current year — invented); other-bank list `MM.DD`.
- `GET /api/transactions/:id` (`txDetailJson`) → for toss add: `kindLabel` ("입금"/"출금"), `counterparty` {name, bankName, number, own: bool} for **both** directions (outgoing: from `transfers.out_tx_id`; incoming from own account: via `transfers.in_tx_id` + `from_account_id`; incoming from other people: needs new nullable columns e.g. `transactions.cp_bank`, `cp_number`, `cp_holder` seeded), `passbookText` (= `transfers.memo_to` or profile user name) for outgoing transfers, `transactedAt` → format `YYYY년 M월 D일 HH:mm` on the client.
- `PATCH /api/transactions/:id` (memo) → 메모 남기기.
- `GET /api/home` → toss variant should expose what the Toss home needs; for this area add (new toss-only endpoint suggested `GET /api/toss/bank`): `{ account, interestAccrued (어제까지 쌓인 이자, int 원), assetCount (내 자산 N개), recent: tx[3], banners: [ {id:'autotransfer', ...}, {id:'newdeposit', ...} ] (pick one per visit), recommendations: [...] (2 pages of 4), ad, promo }`. The product menu (§2.4) and 유용한 정보 are static client constants.
- Other-bank account: `rate` ("연 0.1%"), `cashbackChances` (profile `cashback_count` already exists), refresh = re-fetch.
- Tags → icons: `#이체` → transfer ₩; `#예금이자` → interest receipt ("통장 이자"); `#체크카드` → merchant ("···" or letter avatar); add toss-only `#캐시백` → medal ("카드 캐시백") (or reuse `kind`).
- Amount formatting: `toLocaleString('ko-KR') + '원'`; list sign: "+" for positive in Toss lists, none for positive in other-bank lists; detail amount always signed.

## 5. Not visible → invent (defaults)

- "내 자산 N개 ⌄" and header title "토스뱅크 통장 ⌄": bottom sheet listing the user's Toss Bank products (통장 + one 모으기 통장), selecting switches account. Minimal: sheet with 2 rows, close on select.
- Gear (통장) / 관리 / 카드 (거래내역): toast "준비 중이에요".
- Interest row: sheet "어제까지 쌓인 이자 `<AMOUNT>`원 · 지금 이자 받기" (or toast).
- 체크카드 / 비상금 보관하기 / 자동이체 등록하기 / 추천 rows / product rows / ad / promo / 유용한 정보 / 간편홈 / 의견: toast "준비 중이에요"; "더 보기 1/2" toggles to page 2/2 (4 more invented recommendations: 모임통장, 아이 통장, 자유적금, 먼저 이자 받는 정기예금) and back.
- 전체 ⌄ filter: bottom sheet 전체 / 입금 / 출금 (filters the list; label updates).
- Search: inline search field replacing the filter row; filters by name.
- 복사: copies "`<name>` `<amount>`원" and shows toast "복사했어요".
- 메모남기기: input sheet (max 20 chars), saves via PATCH; value then shows the memo text (grey→text2) instead of the blue link.
- Underlined 입금처/출금처 values: no-op (or copy account number + toast).
- 받기 (other-bank cashback): toast "캐시백을 받았어요", decrement N.
- Banner ×: collapse (350 ms) and hide for the session.
- Empty list: centred "거래내역이 없어요" 15 R text4 at ~y 520.
- Error/loading failure: keep skeleton and show toast "잠시 후 다시 시도해 주세요".
- Long names: single-line ellipsis; very large amounts: amount column never wraps, name truncates first.
- Timings: compress WebView latencies (see §3.2) — total entry ≈1.3 s, list/detail content ≈400–600 ms after push.

## 6. Personal data seen (role → placeholder)

| role | where | placeholder | format to keep |
|---|---|---|---|
| Recorder's own name | 거래내역/통장 rows for own-account transfers, 상세 적요 & counterparty line, 받는 분 통장표시 | `<NAME_A>` | 2–3 Hangul syllables |
| Other people (several counterparties) | 거래내역 rows, 상세 (debit), other-bank list | `<NAME_B>`, `<NAME_C>`, … | 3 Hangul syllables |
| Recorder's Toss Bank account number | 통장 account line, 거래내역 header, 상세 입금처/출금처 | `<ACCT_TOSS>` | 12 digits, 4-4-4 |
| Recorder's Hana account number | 상세 출금처 ("내 하나은행 …"), other-bank header (digits only) | `<ACCT_HANA>` | 14 digits, 3-6-5 dashed in Toss detail, undashed in S4 header |
| Counterparty's Hana account | 상세 입금처 (debit) | `<ACCT_B>` | 14 digits, 3-6-5 |
| Balances (Toss, other bank), interest, benefit amount ("최소 … 보기") | S1, S2, S4 | `<AMOUNT>` | integer 원 with thousands commas |
| Transaction amounts & balance-after | all lists, 상세 | `<AMOUNT>` | signed, commas |
| Transaction dates & times | lists (`M.D`, `M월 D일`, `MM.DD`, `HH:mm`), 상세 일시 | `<DATE>`, `<TIME>` | as listed |
| Merchants (recorder's spending: online shop, AI subscription, auction pay, card company, gift shop, a store) | 거래내역, S4 | `<MERCHANT_1..n>` | ≤ 12 chars, some with `_PG` suffix style |
| Counts tied to the user (내 자산 N개, 캐시백 기회 N번) | S1, S4 | `<N>` | 1-digit |
| Status-bar clock/battery/icons | all | device chrome (infra) | — |
| OS notifications (messenger preview, bank push with name+balance) | B 4.0–4.6, ~75.5–78, ~128–131 | **never reproduce** | — |

Seed suggestion (invented, 홍길동-style): `<NAME_A>` = 홍길동; counterparties 김철수, 이영희, 박민수; Toss acct `1000-1234-5678`; Hana own acct `123-456789-01234` (product "영하나플러스 통장", 연 0.1%); balances in the low tens of thousands; ~18 Toss transactions over 3 months mixing: own-account transfers in/out, person transfers, 카드 캐시백 (+tens of 원), 통장 이자 (+hundreds of 원), card merchants (예시마트, 샘플커피, 테스트쇼핑_PG). The product menu, rates, banner/ad copy and labels above are public UI content and can be used as-is (replace brand ads with invented ads).

## 7. Scratch artefacts (for builders/verification)

All under `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/toss/frames/account/` (contain personal data — never copy into the repo except the vetted icon crops):
- `A1/ A2/ B1/ B2/ B3/` all frames of A 10–61 s, A 84–113 s, B 0–9 s, B 68–86 s, B 118–175 s; `map.txt` = frame index → pts.
- `pageA.png` stitched full 통장 page (with banner, 480 × 7023 px; page px = frame px − 102 + scrollTop), `pageTx.png` stitched 거래내역.
- `scrollA1.txt`, `scrollA1_tx.txt` per-frame cumulative scroll offsets (px).
- Scripts: `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/toss/scripts/account/` (`seg.py`, `rows.py`, `lines.py`, `items.py`, `track.py`, `scroll.py`, `stitch.py`, `fit.py`, `icons.py`).
