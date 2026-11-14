# allone (NH올원뱅크): HOME, 전체메뉴, 통합검색 spec

Area: the home screen in full (C1 12.15–15.6, C2 0–9.0, C3 21.6–26.15 and 35.4–38.6), the 전체메뉴 (C3 38.6–39.85) and
통합검색 (C3 39.85–42.40). All times are real pts (ffprobe/ffmpeg `-ss`). Coordinates are in pt on the 393 × 852 device.
px = pt × 3.0025. Frames and tools live in `scratchpad/allone/frames/home/`:
`full/<clip>_<ms>.png` holds full-res frames. `long_full.png` is the stitched full-length home at full resolution, 1180 × 9072 px.
`tools/` holds `allsegs.py`, `px.py`, `colprof.py`, `stitchfull.py`, `fit2.py`, `tabtrack.py`, `scrollchain.py` and `cropcheck.py`.

The 정기점검 sheet, the loading dim/spinner levels, the bands and the status bar belong to `launch.md` and `infra.md`. This file only
names them where the home uses them.

**EXCLUDED and not specced:** the excluded ranges C3 ≈ 12–19 s and C3 33.4–34.4 (after the password sheet, which is the transfer area),
everything from C3 42.40 on, and the 4th clip.
In the clone, a home → 이체 / 잔액채우기 flow always succeeds.

---

## 0. Key findings (read first)

1. **The home page background is pure white `#ffffff`.** I sampled it at 10+ points over the whole 2 929 pt page.
   `infra.md` says `--ao-bg:#fafcfd`. That value is wrong for the home, so use `#fff` here.
2. **The header is fixed (web area 59–108) and never changes on scroll.** It has no shadow and no divider.
   The black "오늘 운세🍀" bubble hangs below it (100–138) and stays put while the content scrolls under it.
3. **The tab bar is an opaque white web element (743–818).** It **hides as soon as the page leaves scrollTop 0** and
   **comes back only at the two ends**. At the top it returns fully. At the bottom it comes back only to +14.33 pt.
   It does **not** reappear on a scroll-up in mid-page. The floating "내 자산 확인 ⌄" pill rides with it, but **only at the top**.
4. **The account cards are an infinite carousel.** Each card is 353 × 222 at x 20 with a 10 pt gap, so both neighbours peek 10 pt.
   The "‹ i | n ›" pager follows the carousel. A card that has not been seen before shows a loading body ("상품명을 조회 중이에요" /
   "조회 중입니다") for ≈ 0.4 s.
5. **The 오늘의 혜택 line is a typewriter ticker.** The 3 items rotate every 2.5 s: old text vanishes → icon fades in → characters appear one by one.
6. **Every navigation is a one-frame cut** behind the web loading dim + green spinner (infra §1.8). The one exception is the menu
   (≡): a spinner **without** dim for 0.32 s, then a cut with a 3-frame dim.
7. Labels differ from the rough timeline: the header toggle is **큰글** (not 관리), and the 4th tab is **포인트쌓기** (not 포인트받기).
   The last rail item visible in the menu is **올원사장님+**.
8. **Typeface.** The app's Korean face is a narrow gothic, a little narrower than Pretendard. Every size below is the **Pretendard
   size that reproduces the measured ink width and height** (from `fit2.py`), with a small negative letter-spacing.

---

## 1. Screen / state inventory

| id | screen / state | clip + pts |
|---|---|---|
| H0 | home mounted under the login dim (handoff, see launch.md S5/S6) | C1 11.950–12.150 |
| H1 | skeleton A: header, tabs row + pager, skeleton card, pill, tab bar; banner slot collapsed | C1 12.150–12.283; C3 22.246–≈22.40 |
| H2 | skeleton B: banner inserted (layout jumps down), card still skeleton | C1 12.300–12.483 |
| H3 | card filled; the sections below it not rendered yet | C1 12.500–12.683 |
| H4 | full home, top state (scrollTop 0, tab bar + pill shown) | C1 12.70→ (sheet over it 12.733–13.833, launch.md S7); clean C1 13.833–14.517; C2 4.60–8.99; C3 24.08–26.13; C3 36.35–38.02 sheet, 38.02–38.61 clean |
| H5 | scrolled, tab bar + pill hidden | C1 14.533–15.607 (stops at 14.77 and 15.43); C2 0.000–2.55; C2 3.10–3.94 |
| H6 | bottom of page, tab bar back at +14.33 pt, no pill | C2 2.358 (scroll end) → bar moves 2.395–2.82 → rest until 2.858 |
| H7 | back at the top: tab bar + pill slide in | C2 3.858 (top) → 3.94–4.60 |
| H8 | card swipe 1 → 2 (paging) | C2 4.441–4.791 |
| H9 | card 2 loading body | C2 4.541–4.841 (filled at 4.858) |
| H10 | card drag without paging (rubber-band back) | C3 24.963–25.513 |
| H11 | ticker change (typewriter) | C2 5.374 (→ 지금 핫한…), 7.874 (→ 매일 포인트…); C1 15.3–15.6 typing |
| H12 | ad carousel slide 1 → 2 | C2 0.72–0.86 |
| H13 | tap 거래내역 → dim + spinner → cut to 거래내역조회 (account area) | C2 9.008 → 9.96 |
| H14 | tap 이체 → dim + spinner → cut to 이체 (transfer area) | C3 26.146 → 26.56 |
| H15 | return to home through the dim (from the transfer flow) | C3 21.596 (dim fade-in 0.13 s) → spinner off 22.113 → dim off 22.246; C3 35.4 → spinner off 35.729 → dim off 35.896 |
| M0 | tap ≡ → spinner without dim | C3 38.629–38.929 |
| M1 | 전체메뉴 under a 3-frame dim (first frame unstyled, see M notes) | C3 38.946–38.979 |
| M2 | 전체메뉴, 최근 이용메뉴 still empty | C3 38.996–≈39.03 |
| M3 | 전체메뉴 complete (AI톡 tile pops in at 39.263) | C3 39.03–39.81 |
| M4 | tap search field → spinner 39.813, dim fades in 39.846–39.963 | C3 39.813–39.963 |
| S1 | 통합검색, 자동완성 off (the magnifier icon arrives 1 frame later, 40.046) | C3 39.979–40.546 |
| S2 | 자동완성 on | C3 40.563 → |
| S3 | field focused: caret, green border, iOS Korean keyboard slides up | C3 ≈41.11 caret; keyboard 41.16–41.40 |
| S4 | one syllable typed, no results yet | C3 ≈41.9–42.40 |
| — | **EXCLUDED** autocomplete results | C3 42.41–45.5 |

---

## 2. Screens

### 2.1 Home: frame and scroll model
- The web area is 59–818. The status band (0–59) and bottom band (818–852) are native white (infra §1.1).
- **Page coordinates in this file** = screen y at scrollTop 0. Subtract 59 to get scroll-container coordinates.
- The fixed header covers 59–108. Content scrolls under it; whatever passes above 108 is hidden by the white header.
- **Scroll extent:** max scrollTop = **2170 pt** (±1). Content height in the container is 2170 + 759 = **2929 pt**
  (page y 59 → 2988). It was measured by stitching C3 25.75 + C1 14.767 + C2 0.408/1.208/1.608/2.008/2.208/2.408,
  with offsets 0 / 376.0 / 579.5 / 979.9 / 1294.3 / 1566.0 / 1922.7 / 2170.2 (px-refined, errors < 2 except an ad-carousel frame).
- Momentum scrolling is native iOS (C2 2.0–2.36: 53→34 pt/frame with deceleration). Use the browser's native overflow scroll.
- Horizontal page gutters are 20 pt everywhere (cards x 20–373 = 353 wide).

Vertical map (page y, top state):

| block | y | notes |
|---|---|---|
| header | 59–108 | fixed |
| promo banner | 134.9–227.1 | |
| tabs row "NH농협 · 다른금융" + pager | 256.5–279 | pager 258.8–278.8 |
| account carousel | card 293.0–515.0 | mint glow behind, 230–550 |
| ad (대법원) | 550–≈640 (content 554.5–627.8) | white block cuts the glow at 550 |
| "오늘의 혜택 >" | ink 677.4–695.4 | |
| ticker row | 725.7–761.7 | covered by the tab bar from 743 at the top state |
| quick-menu card | 812.3–988.2 | |
| "내 모임 >" | ink 1029.1–1047.1 | |
| 내 모임 card | 1064.0–1176.0 | |
| ad carousel | ink 1230.6–1314.2 | no card |
| "다가오는 금융일정" | ink 1374.2–1392.8 | |
| 금융일정 card | 1409.8–1507.7 | |
| "내 소비" | ink 1548.7–1566.7 | |
| 내 소비 card | 1584.0–1676.3 | |
| "내 자산" | ink 1717.2–1735.2 | |
| 내 자산 card | 1752.2–1949.0 | |
| "생활자산" | ink 1989.7–2008.0 | |
| 생활자산 cards (h-scroll) | 2025.0–2255.0 | |
| "NH금융그룹" | ink 2296.1–2313.7 | |
| 그룹 grid rows | 2330.7–2472.6 / ≈2481.5–2623.5 / ≈2632.5–2774.4 | |
| "홈 화면 설정" | ink 2827.0–2841.3 (underline 2840.3–2841.3) | |
| end of content | 2988 | 147 pt bottom padding after the link |

Shared rhythm: a section title's ink bottom sits **17 pt** above its card top (1047→1064, 1392.8→1409.8, 1566.7→1584, 1735.2→1752.2).
A card's bottom sits **≈41 pt** above the next title's ink top (988→1029, 1507.7→1548.7, 1676.3→1717.2, 1949→1989.7).

Section title style: Pretendard **Bold 20, ls −0.4**, #000, x 20.3. "다가오는 금융일정" fits Bold 20.5 / −0.7, so use one 20/−0.5 style.
Where a chevron "›" follows (오늘의 혜택, 내 모임): it is 7 × 12.4 pt, stroke ≈ 2, #000, and starts 10 pt after the text (x 117.6 / 83.9).
The other titles have no chevron.

White-card style (quick menu, 금융일정, 내 소비, 내 자산, 그룹 grid): bg #fff, **radius 16**, shadow ≈ `0 4px 14px rgba(0,0,0,.07)`.
Under the card the shadow reads #ecebee → white over 12 pt. Above it, faint #f9fefd over 4 pt.

### 2.2 Header (fixed, 59–108)
- **Name**: "<NAME_A>" Bold + "님" Regular, both #000, starting at x 20 (Hangul ink 75.3–91.6). The ink fits **Pretendard 18.5** (the 전체메뉴 header name fits 18.8), not 20.
  The underline is under the **name only**: x 20.0–65.6 (it ends where the name ends), y 93.9–95.3, 1.3 pt thick, #000.
  The whole name block is ink x 20–78.9.
- **오늘 운세 bubble**: black #020202, x 20.0–105.2, body y ≈106–137.9 (h 32), radius 8.
  It has an up-pointing arrow tip at y 99.9, centred x ≈ 63 (under the end of the name), ≈ 8 wide × 6 tall.
  The text "오늘 운세" is white, Medium 14 / ls −0.9 (ink x 32.0–78.6, y 115.6–128.6), with a white 1 pt underline under the text.
  It is followed by a 🍀 (x 80.3–92.6, ≈ 12 pt). Crop the clover from the video (§7) or use an inline SVG. A system emoji differs per OS.
- **큰글 toggle**: pill x 210.2–265.1 (55 × 24, radius 12), track #eeeeee, white knob Ø 20 at the left (off).
  Label "큰글" Medium 13.5 / −0.5, #343434, ink x 237.1–259.1, y 77.9–88.9. It is not tapped in the recording.
- **Icons** (SVG, stroke ≈ 2, #000; 24 pt boxes centred at y 84; centres x 289 / 324.7 / 361.2):
  - wallet: rounded rect with a flap and a clasp dot; ink 278.1–300.1 × 75.9–92.9
  - bell: with top knob and bottom clapper; ink 315.7–333.7 × 73.9–94.6
  - menu-search: 3 lines + magnifier at the lower right; ink 351.0–371.4 × 75.9–91.9. Same shape as the 거래내역조회 and PIN instances (4 pt to the right): the bottom line is 1.9 longer than the middle one (`AoMenuSearchIcon`)
- Header bg #fff. It has no shadow when scrolled (C2 0.0: content is cut at 108 with no line).

### 2.3 Promo banner (133–227)
- Box x 20–373 (353 × 94, y 133–227 measured in y px / 3; the first reading 134.9–227.1 used px / 3.0025), radius ≈ 20, bg **#fffae2**, no border or shadow.
- Line 1 "두근두근, 나도 포인트 부자?": Regular 13.5 / 0, #333 (ink x 40.3–188.2, Hangul y 160.5–173.9).
- Line 2 "1분만 투자해도 쌓여가는 포인트": Bold 16.5 / −0.6, #000 (ink x 42.3–235.5, y 184.8–199.5). Left padding 20.
- Art: a 3D heart with a smiley face and a stack of P coins, on a soft dotted halo, at x 283–360 × 150–216. **Crop** it (§7).
- The banner only appears in the recording, so it is static. Tap → no-op.

### 2.4 Account section (230–550)
**Background glow:** a soft mint area behind the tabs row and the cards. It runs from #f9fefd at y 240 to #f0fdfd at 285 to #e8fdf9 around 520–548, with a maximum near x 250.
Along y 540 it reads white at x < 60, then #f7fefd at 72, #e7fbfa at 260 and #f4fdfe at 384.
It is cut sharply at **y 550** by the white ad block. Suggested CSS: on the section (230–550),
`radial-gradient(ellipse 230px 320px at 62% 92%, #e4faf6 0%, rgba(228,250,246,0) 100%)`.

**Tabs row**:
- "NH농협": Bold 18 / −0.3, #000, ink x 21.0–≈72, y 256.5–277.1.
  A selected-tab green dot sits at its top right: Ø 6, #0d8f2e, x 76.0–82.0, y 256.3–262.3.
- "다른금융": Medium 18 / −0.3, #323134, ink x 95.9–155.5, y 261.1–277.1. That is a 14 pt gap after the dot.
- Not tapped in the recording. Tapping one sets the selected state: Bold + dot on the selected tab, Medium #333 on the other.
- **Pager pill**: x 308.1–373.0 (65 × 20), radius 10, bg ≈ `rgba(0,0,0,.45)` (reads #8b8f91 over the glow).
  Content (white): "‹" chevron, the current index (white, Medium ≈13), a thin divider "|" (≈ 1 × 7, white 80 %), the total (white 70 %), "›".
  The index and total are 1-based, for example "1 | 2" and "2 | 2".
- **Carousel**: cards are 353 × 222 at x 20 when at rest, with a 10 pt gap, so the previous and next cards show 0–10 and 383–393.
  It loops: with 2 cards, card 2 is visible on both sides of card 1 and the other way round.
  Swipe: snap paging. Measured 4.441 → 4.791. From the finger release (4.507) the settle is **305 ms cubic-bezier(.3,.43,.3,1)** (rms 1.1 pt on the card-2 tile);
  the rubber-band back (C3 25.192–25.433) is the same 305 ms curve (rms .24 pt). The first reading (≈ 250 / 450 ms) included the drag time.
  Pager arrows: invented, page ±1 with a 300 ms ease-out.
- **Card**: y 293.0–515.0, bg #fff, radius ≈ 16. Mint-tinted shadow: #cee4e2 right under the card, fading to the glow
  colour over ≈ 30 pt. The gap between cards reads #d6ecea, and the line above the card #ebf6f4.
  Use ≈ `0 6px 18px rgba(0,80,70,.16)`.
  - NH logo tile: x 39.0–71.3, y 322.4–354.7 (32 × 32), radius ≈ 8, **#0052b3**, white bold "NH" wordmark (≈ 12 pt).
    Draw it as SVG/CSS (public brand mark). Infra uses a 36 pt NH tile in lists, but this one is 32.
  - Product name: x 79.9, ink y 321.7–336.7, **SemiBold 15 / −0.3**, #000. Single line with an ellipsis, max right ≈ 297 (max-width 217).
    Example: card 2 reads "NH X 카카오페이통장(비대면실명확…".
  - Number line: "NH농협은행 <ACCT_A>" Regular 14, **#666** (bank name ls −0.4, digits ls −0.2; ink y 343.4–355.7). Then "복사" **#333** with a 1 pt underline
    (#323232, y 356.67–357.67), 4 pt after the number. The line ends at x ≈ 296.
  - ⋮ menu: 3 dots Ø 2.7, #414141, x 348.7–351.4, y 322.4–337.1 (6 pt pitch).
  - 한도제한 tag (**만들지 않음** — 사용자 요청으로 '한도제한' 표시는 앱에서 뺐음, 아래는 녹화 기록): box **48.6 × 23.3 at x 79.3, y 366** (y px / 3), radius 4, bg ≈ #fffaf8 (barely visible).
    Text "한도제한" Medium 11 / −0.3, **#e94143** (glyph core (233, 64, 66); `--ao-limited`), ink x 85.3–121.9.
  - Balance: "<AMOUNT_A>원" at x 80.6, #000. The digits are **tabular figures**: ink 15.7 tall at y 401.3–417.0, pitch 13.9 → **Pretendard 700 22,
    `tabular-nums`, ls −0.5**; "원" is **SemiBold 20** (not Bold 28).
  - 숨김 pill: **42 × 26 at y 397–423** (radius 13), white, border 1 pt #eeeeee. Text "숨김" Regular 12.5 / −0.6, #000.
    It sits 4 pt after the balance.
  - Buttons ATM출금 / 거래내역 / 이체: y 451.6–493.6 (h 42), x 39.0–138.6 / 146.9–246.1 / 254.5–354.0 (99.5 wide, gap 8.3).
    Radius 10, white, border 1 pt **#dcdcdc**. Text Regular 15.5 / −0.6, #000, centred (ink y 465.6–478.9).
  - Padding: 19 left and right (39 = 20 + 19), top 29 to the logo, bottom 21.4 under the buttons.
- **Card loading body** (H9, first view of a card): the name line becomes "상품명을 조회 중이에요" (same SemiBold 15, #000).
  The number line + 복사 stay. The tag, balance and buttons are replaced by "조회 중입니다", Regular ≈ 23, **#808080**, ink x 79.6–195.8,
  y 395.0–414.7. The card height stays 222. It lasts ≈ 0.42 s after the swipe starts (4.441 → filled at 4.858, one-frame swap).

### 2.5 Ad block (550–≈640)
- A white block that covers the glow. It has no visible border.
- The content is **centred horizontally** as one 245 pt group, x 72.6–317.7:
  - "대법원" logo row: x 72.6–99.6, y 557.5–568.2
  - illustration: x 72.6–153.2, y 571.5–627.8 (80.6 × 56, radius ≈ 6)
  - title "증언 하러가기 무서워요..": SemiBold 13.5 / −0.2, #000, x 164.2, ink y 579.2–591.2
  - subtitle "대법원 [증인지원제도]가 지켜드려요": Regular 11, #505050, ink y 598.2–609.2
- Info badge: Ø 15 circle #c0c0c0 with a white "i", x 354.0–369.0, y 554.5–569.5.
- Third-party public-service ad. It is in §7 as a crop. If you would rather not reuse it, keep the same geometry with an invented
  NH promo. Tap → no-op.

### 2.6 오늘의 혜택 and the typewriter ticker
- Title "오늘의 혜택 ›" (§2.1 style), ink 677.4–695.4.
- Ticker row 725.7–761.7: icon box x 44.3–76.6 (≈ 32 × 36), text x 92.3, **Medium 18 / 0**, #000
  (for example, "지금 핫한 이벤트 보기" ink x 92.3–242.5, Hangul y 736.4–752.7).
- Items, cycled in this order (the C1 → C2 order is confirmed):
  1. 🔥 3D flame → "지금 핫한 이벤트 보기"
  2. orange P coin over a hand with a purple sleeve → "매일 포인트 응모 받기"
  3. blue ₩ money bag with yellow sparkles → "쓸수록 돈 되는 생활혜택 모음"
- **Animation** (C2 5.200–6.800, real pts):
  - the old item disappears in one frame (5.374)
  - the new icon fades in 5.408 → 5.558 (≈ 150 ms, linear)
  - the first character appears at 5.591 (+217 ms)
  - then **one non-space character every ≈ 67 ms** (4 frames), each fading in over ≈ 1–2 frames
  - spaces cost nothing: 9 steps for "지금 핫한 이벤트 보기", 5.591 → 6.124
- Period: **2.5 s** from one swap to the next (5.374 → 7.874).
- At the top state the row is half under the tab bar (743). That is correct; do not move it.

### 2.7 Quick-menu card (812.3–988.2)
- White card (§2.1 style), x 20–373, h 176.
- 4 × 2 grid: columns 83 pt wide, from x 30.7 (10.7 inner padding left and right); column centres x 72.2 / 155.0 / 239.0 / 321.5.
- Rows: icons 28 × 28 at y 831.3–859.3 and 913.2–940.9. Labels at ink 869.9–881.3 and 951.9–963.2 (10.6 below the icon). Row pitch 82.
  Top padding 19 above the icons, bottom padding 25.8 under the labels.
- Labels: Regular 13 / −0.5, #303030, centred.
- Items:
  - 계좌등록 (card with a green +)
  - 전체계좌 (pale-blue tile, 3 lines)
  - 공과금납부 (blue receipt + dark → badge)
  - 이체한도변경 (yellow ₩ coin with red ↑ and blue ↓)
  - 올원사장님+ (person in a blue suit + yellow ₩ coin)
  - 올원룰렛 (green-ring roulette with a pin)
  - 캐시백쿠폰몰 (green ticket + yellow ₩ coin)
  - 메뉴설정 (dashed grey rounded square with +, #c9c9c9)
- All icons are crops (§7). 메뉴설정 can be SVG.

### 2.8 내 모임 (1029–1176)
- Title "내 모임 ›".
- Card x 20–373, y 1064.0–1176.0 (h 112), radius 16, **bg #f4e8fd**, shadow below fades to white by 1187.
- Text at x 40:
  - "모임을 더 쉽고 편리하게": Regular 14.5 / −0.7, #353535, ink y 1085.4–1098.1
  - "투명한 회비관리, 함께해요" / "NH올원모임으로 시작하기": **SemiBold 18 / −0.3**, #000, ink y 1109.4–1125.4 and 1135.4–1151.4 (line pitch 26)
- Art: a blue passbook with 3 cartoon heads, x 262–368 × 1068–1172 (crop). Tap → no-op.

### 2.9 Ad carousel (≈1215–1320, no card)
- 3 slides that auto-advance with a **horizontal slide** (C2 0.72 → 0.86, ≈ 150–200 ms).
- Text at x 40:
  - small line Regular 14.5 / −0.5, #2e2e2e, ink y 1236.3–1249.0
  - 2 bold lines SemiBold 18 / −0.3, #000, ink y 1260.3–1276.3 and 1286.3–1302.2
- Art on the right: x 262–356 × 1225–1300.
- Pager pill: x 264.1–329.4 × 1294.9–1314.2, same style as §2.4 ("‹ 2 | 3 ›"). Next to it a pause button, a Ø 20 circle in the same
  translucent grey with a white "❚❚", x 333.1–353.0.
- Slides seen:
  1. a card ad with a **real celebrity photo and name**, "<CELEB_AD>" (copy "zgm 저장체크카드 신청하기 / <celebrity> / 내 카드속에 저장").
     **Do not crop or reuse it.** Replace it with an invented slide, for example "NH농협카드 / 체크카드 새로 만들고 / 캐시백 받아가기" + an SVG card.
  2. "NH투자증권 채권서비스 OPEN" / "투자도 더 다양하게" / "채권 상품 보러가기", with a hand holding banknotes and coins (crop).
  3. not seen; invent one.
- The interval cannot be measured: the slide changed 0.72 s into C2, and C1/C2 are cut. Use 4 s.
  Pause toggles autoplay (❚❚ ↔ ▶). Swipe works too.

### 2.10 다가오는 금융일정 / 내 소비
- 금융일정 card 1409.8–1507.7 (h 98): text lines "마이데이터 연결하고" / "모든 금융일정 모아 보기", SemiBold 18 / −0.3, #000, x 41,
  ink y 1437.5–1453.5 and 1463.4–1479.4. Art: a calendar with a ₩ coin and a floating wallet/card, x 266–356 × 1427–1490 (crop).
- 내 소비 card 1584.0–1676.3 (h 92): "교통카드, 카페, 마트" / "흩어진 소비 한번에 관리하기", same style (ink y 1608.7–1650.6).
  Art: a MART storefront with a coffee cup and bags, x 294–350 × 1606.7–1656.6 (crop).
- Both are tap → no-op.

### 2.11 내 자산 (1717–1949)
- Card 1752.2–1949.0 (h 197).
- Text "놓칠 수 없는 내 자산 관리" / "NH올원뱅크가 함께 합니다", SemiBold 18, #000, x 40, ink y ≈1776.5–1818.8.
- Art: a blue money bag with $ and coins, x 295.4–344.0 × 1771.5–1822.5 (crop).
- Chips: rows at ink-box y 1828.1–1854.1, 1863.1–1889.1 and 1898.1–1924.1 (h 26, pitch 35), x from 40, gap 4.3.
  - Each chip: radius 13, white, border 1 pt **#dadada**, text Regular 14 / −0.5, #000, horizontal padding ≈ 11.
  - The leading "#" is **#00831a**, slightly bolder.
  - Chips: "#모든 금융기관 대출", "#투자 포트폴리오" / "#입출금 계좌 관리", "#부동산 시세" / "#자산 변동 내역".
- This section is the target of the "내 자산 확인" pill (§2.15).

### 2.12 생활자산 (1990–2255)
- Horizontal scroller (scroll-snap, padding 20, gap 9.6). Cards are 167.2 × 230 at y 2025.0–2255.0, radius ≈ 16.
- Card colours:
  1. **#6185ff** "모빌리티"
  2. **#4589fe** "보험"
  3. **#059d8c**, label starts with "ㅎ…". Not seen in full; invent "헬스케어" with the lines "자산처럼 챙기는 / 건강 관리 시작하기".
- Contents (white):
  - title fits Pretendard **16** at x +13.3, ink y 2050.3–2064.6
  - chevron "›" ≈ 5 × 9 at right −23
  - centred image tile: white squircle 64 × 64 (radius ≈ 22) at y 2099.9–2163.9, holding a car photo / a medicine bottle + dumbbell (crop the tiles)
  - 2 lines Bold, fit **15.8**, line pitch 26, ink y 2187.8–2202.5 and 2213.8–2228.5: "내 자동차 지금 / 시세는 얼마?", "내 가입보험 / 한눈에 확인하려면?"
- Tap → no-op.

### 2.13 NH금융그룹 (2296–2774)
- 2 × 3 grid. Columns x 20–191 and 202.5–373 (≈ 171 wide, gap 11.5). Rows h 142, pitch ≈ 151 (gap 9).
- White card (§2.1 style), radius ≈ 16.
- Inside, padding 21 left and 19 top:
  - title Medium / −0.3, #000 (ink h 14.3), fits **16**
  - 2-line description Regular / −0.4, #2f2f2f (line pitch ≈ 19.5), fits **14**
  - 34 × 34 icon at the bottom right (right 21, bottom ≈ 16)
- Cards, in order:
  - NH투자증권: 다양한 투자상품과 / 리서치 (blue + red candlesticks)
  - NH농협카드: 일상 속 혜택을 / 더욱 풍성하게 (green NH card)
  - NH농협생명: 든든한 보장과 함께 / 준비하는 미래 (sprout)
  - NH농협손해보험: 일상 속 위험을 / 지켜주는 맞춤형 보장 (yellow umbrella + heart)
  - NH농협캐피탈: 대출이 필요할 때, / 언제나 든든한 (document + ₩ coin)
  - NH저축은행: 간편하게 대출 신청 / 합리적인 예금조회 (red ₩ pouch + coins)
- All icons are crops. Tap → no-op.

### 2.14 홈 화면 설정
- "홈 화면 설정": Regular 14.5 / −0.4, #343336, centred (ink x 163.9–229.1), with a 1 pt underline #373b3d.
- Tap → no-op.
- Then 147 pt of empty white to the end of the content.

### 2.15 Floating "내 자산 확인 ⌄" pill
- x 128.0–265.5 (137.5 × 40), y **685.3–725.3** at rest, radius 20. That is 18 pt above the tab bar top.
- `linear-gradient(90deg, #0f8a4f 0%, #127e73 30%, #186ea3 60%, #1b5fd6 100%)`.
  Sampled every 10 pt: #0f8a4f, #14875d, #128266, #127e73, #14797e, #16768a, #157195, #186ea3, #176baf, #1867bc, #1a62c8, #1b5fd6.
- Text "내 자산 확인": Bold 16, white, ink x 148.6–220.6. Then a white **animated double chevron** (two "⌄", ≈ 14 × 8, stroke 2, at x ≈ 236–250)
  on a 3000 ms loop with 7.6 pt of travel. The group is centred.
- No shadow.
- Visible **only at the top state** (H4/H7). It moves with the tab bar (§2.16).
- Tap is not seen. Invented: smooth-scroll so that the "내 자산" title sits 20 pt under the header. Leaving the top then hides the bar and the pill.

### 2.16 Tab bar (743–818, web)
- Opaque **#fff**, top corners radius ≈ 16, very faint shadow above (#fafcfc over ≈ 6 pt, so ≈ `0 -2px 8px rgba(0,0,0,.04)`). No blur or translucency.
- Its lower part runs into the native white band (818–852). No home indicator.
- 5 equal columns, 72.2 wide, from x 16 (icon centres 52.0 / 124.4 / 196.4 / 268.6 / 341.0).
- Icons are 24 × 24 at y 756.4–780.3 (13.4 below the bar top). Labels: Regular 12.5 / −0.7, **#000** for every tab, ink y 784.7–795.3.
- Icons (SVG, stroke ≈ 1.8, #000):
  - **홈**: selected, a filled black house (pentagon, rounded) with a white horizontal bar near the bottom
  - **금융상품**: outline shopping bag with a smile
  - **내 자산**: outline rounded square with bold "MY"
  - **포인트쌓기**: outline circle with a bold "P"
  - **생활혜택**: outline gift box with a bow
- The only selected state is the filled icon. Label colour does not change.
- **Hide and show rule (re-measured frame by frame; bar = home-icon row, pill = its top edge; `AO_TABBAR`):**
  The bar and the pill move **separately**: the pill drops faster and passes behind the bar (the bar is drawn above it).
  - **Hide** from the scroll event (C1 14.517–15.0): bar **490 ms cubic-bezier(.4,0,.2,1) to +75** (its own height, so it ends under the
    818 band; starts one frame early, rms .5 pt); pill **620 ms cubic-bezier(.2,.05,.1,1) to +135** (rms .9 pt).
  - It stays hidden while scrolling and while resting in mid-page (C1 14.77–15.17 rest, C2 3.16 rest, C2 3.0–3.86 scroll-up).
  - **Show at the top**: scrollTop reaches 0 at C2 3.858 → motion from 3.903: bar **952 ms cubic-bezier(.22,-.12,.03,1)** (rms .1 pt),
    pill **731 ms cubic-bezier(.16,.29,.07,1)** (rms .4 pt). About 38–45 ms after reaching the top = 8 ms CSS delay + one commit frame.
  - **Show at the bottom**: scroll end at C2 2.358 → motion from ≈ 2.395, no debounce: the bar follows the start of the top curve and stops at
    **+14.33** = **424 ms `linear(0, 0, 0, .041, .125, .244, .368, .479, .575, .656, .726, .787, .841, .888, .93, .967, 1)`** (rms .2 pt).
    **The pill does not appear.** Implement it as a "bottom-reached" state with its own offset.
  The first reading (one 440 ms ease-in-out to +135, 650 ms return, 200 ms debounce + 300 ms to +14) only read the visible part of each motion.
- Taps: **홈** scrolls to the top (invented). **금융상품 / 내 자산 / 포인트쌓기 / 생활혜택** are no-ops, following the precedent `const soon = () => {}`
  (ibk/hana/toss). Do not build placeholder pages.

### 2.17 Home skeleton (fresh load: H1 → H4)
Each fresh mount of the home (after login, or after a dim-loaded return) runs this sequence. Times are relative to the dim going off
(launch.md fixes the handoff):
- **+0 ms (H1)**:
  - the header renders, then the tabs row ("NH농협 · 다른금융" + pager, ink ≈ 162–183) directly under the header (banner slot collapsed)
  - a skeleton card at y ≈ 198.8–440.3 (h ≈ 241.5) with three bars in #fcfbfe: x 39–354, y 259.8–328.7 (r 8), 337.7–361.7 and 391.7–415.7
  - the mint glow and the tab bar are present; an empty white card shell shows at +566 below the account section top (H1–H3)
- **+33 ms**: the 내 자산 확인 pill appears (C1 12.183).
- **+117 ms (H2)**: the banner is inserted at 133 and everything below jumps down in one frame (no animation) (C1 12.267). Its art (an animated
  Lottie in the app) appears only at **+850 ms** after login; on later fresh entries it is there at once.
- **+350 ms (H3)**: the card fills (the skeleton bars become the real card in one frame).
- **+550 ms (H4)**: the ad + 오늘의 혜택 + all lower sections appear in one frame. After +583 ms the 정기점검 sheet comes up (launch.md).
  Frame diffs (C1): dim off 12.150, pill 12.183, banner 12.267, card 12.500, lower 12.700, notice 12.733 (`AO_SKELETON_STEPS` [0, 33, 117, 350, 550]).
  On a **fresh re-entry** (취소 → home, C3 22.68–22.95) the 정기점검 sheet **rises over ≈ 270 ms** instead of popping in (after login, C1, it pops).
- Drive it from `/api/home` + fixed minimum delays so it looks the same every time.

### 2.18 전체메뉴 (C3 38.946–39.85, full screen in the web area, no tab bar)
- **Header row** (y 70.9–96.9):
  - "<NAME_A>" Bold 20 + "님" Regular 20 (ink x 21.0–82.6, y 75.9–92.6), then "›" 7 × 12 at x 91.3
  - **로그아웃** pill: x 114.6–182.8 (68 × 26), radius 13, border 1 pt #d9d9d9, text Regular 14, #111
  - icons, ≈ 20 pt, stroke 1.8, #000, centres x 241 / 281 / 321 / 361, y ≈ 84:
    - globe: 230.5–251.5
    - gear: 270.8–291.1
    - home: outline house with a bar, 311.7–330.4
    - ×: 352.7–369.4
- **Search row** (116.9–164.9):
  - magnifier 16.7 pt (stroke 2, #000) at x 31.6–48.3, y 132.6–149.2
  - placeholder "검색으로 더 많은 정보를 찾아보세요.": Regular 15.5 / −0.2, **#808080**, x 57.0–272.1
  - no box or underline
  - **AI톡** tile at the right: 48 × 48, x 325.1–373.0, y 116.9–164.9. A blue squircle with the white label "AI톡" and a green mascot holding a magnifier.
    It appears **0.32 s after the menu opens** (39.263, one frame). Crop it (§7). Tap → no-op.
- **Quick icons** (4 columns of 88.25 from x 20; centres 68.5 / 156.0 / 244.6 / 333.2):
  - icons ≈ 24–26 pt at y 188.5–214.8, labels Regular 14.5 / −0.4, #111, ink y 225.1–239.5
  - **NH지갑** (green wallet), **인증/보안** (purple shield ✓), **고객센터** (blue headset), **이벤트** (yellow/red gift)
  - icons are crops; taps are no-ops
- Divider: y 265, full width, 1 px #f3f3f3.
- **Left rail** (x 0–124, bg #fff, no divider):
  - rows 50 pt from y 266
  - selected row: bg **#0c8f2d**, text white Bold 15.5
  - other rows: Regular, **#4f4f4f**, x 24.6, ink tops 334.7, 384.7, 434.6 … (pitch 50). The rail text fits **14.6 / ls −0.2** (not 15.5 / −0.9)
  - visible: 최근 · 조회 · 이체/출금 · 가입상품관리 · 금융상품 · 외환 · 퇴직연금 · 공과금/채권 · 내 자산 · 금융편의 · 올원사장님+
  - continues off-screen (invented): 이벤트/혜택 · 고객센터 · 설정
- **Right list** (x 125–393, scrolls; the rail is a scroll-spy):
  - Section header: green bar 2.3 × 10.3 (#0c8f2d) at x 135.9, then the title at x 144.5, **Bold 15.5**, #000 (ink h 14).
  - Items: x 147.2, Regular, #000, pitch **52**, fit **15.6 / ls −0.15** (not 16.5 / −0.8). The first item's ink top is 55 below the header's ink top.
  - Next section header: ink top ≈ 70 below the last item's ink top.
  - **Pin icon** (only in 최근 이용메뉴): an outline push-pin tilted 45°, 16.7 × 16.7, stroke 1.5, #171717, at x 353.0–369.7, vertically centred on the item.
  - Measured: 최근 header ink 283.8–297.8; items at 339.1, 391.0, 443.0; 조회 header at 513.6; items at 571.2, 623.1, 674.8, 727.1, 779.0.
- **Content of 최근 이용메뉴**: the recording shows the recorder's own recent menus. Do not copy them.
  Fill it from the clone's own history: the last 3 built screens visited, stored per profile. Default: 거래내역조회 · 계좌이체 · 잔액채우기.
  At first render the section is empty for one frame and the items are inserted at +50 ms (38.996 → 39.03).
- **Full menu.** Entries seen in the video are marked (v). Everything else is invented and plausible for 올원뱅크. Links → built screens:

| section | items |
|---|---|
| 조회 | 전체계좌조회 (v) → **account history** (first NH account) · 거래내역조회 → **account history** · 이체내역 (v) → **account history** · 계좌통합조회 (v) · 해지계좌조회 (v) · 거래중지계좌조회 (v) · 숨은자산찾기 (v) |
| 이체/출금 | 계좌이체 (v) → **transfer** · 잔액채우기 → **top-up** · 자동이체 등록/조회 · 예약이체 · 이체한도 조회/변경 · 지연이체서비스 |
| 가입상품관리 | 예금/적금 관리 · 계좌 비밀번호 변경 · 계좌해지 · 통장사본 |
| 금융상품 | 예금 · 적금 · 대출 · 펀드 · 카드 |
| 외환 | 환전 · 해외송금 · 환율조회 |
| 퇴직연금 | 퇴직연금 가입정보 · 적립금 조회 |
| 공과금/채권 | 지로/공과금 납부 · 국세/지방세 · 제로페이모바일상품권 |
| 내 자산 | 내 자산 확인 · 마이데이터 연결 |
| 금융편의 | 만보기 · 디깅퀴즈 · 포인트 |
| 올원사장님+ | 매출 조회 · 사업자 계좌 관리 |

  Rows with a link → web dim + spinner (≈ 0.3 s) → cut. Other rows and pins → no-op.
- **Header actions**:
  - **×** and **home** → back to home. A plain pop/cut, no spinner, home not remounted (no skeleton, no sheet).
  - **globe**, **gear**, **name ›** → no-op.
  - **로그아웃** → no-op. Optionally, the app's existing logout; it is not shown in the recording, so the default is no-op.
  - **search row** → 통합검색 (§3).
- **First-frame note**: at 38.946 the list is drawn unstyled for one frame under the dim (left-aligned, no green bars).
  This is a WebView artefact. Do not reproduce it.

### 2.19 통합검색 (C3 39.979 →, full screen, no tab bar)
- **Title bar**: "통합검색" Bold 17.5, centred (ink x 166.5–225.8, y 76.6–92.3). "×" 16.7 pt, stroke 1.5, #000, at x 348.7–365.4. No back arrow.
- **Field**: x 24–369, y 136.9–190.8 (345 × 54), radius 12, border 1 pt **#eeeeee**, which becomes **#0c8f2d** when focused.
  - placeholder "검색어를 입력해 주세요": Regular, #8a8a8a, at x ≈ 46. The field text fits **18.6** (not 17). The placeholder **stays visible while the
    field is focused**, with the caret before it (C3 41.10–41.60); it goes when the first character is typed
  - typed text: Regular 18.6, #000, at x 46.3; caret blue (iOS tint), ≈ 2 × 28 pt
  - right side: a Ø 18 clear button (#616161 circle with a white ×) at x 293.1–311.1, shown only when there is text
  - a 20 pt magnifier (stroke 2, #000) at x 328.1–348.0, y 153.9–173.9. It renders one frame after the page (40.046).
- **자동완성 row**:
  - label "자동완성": Regular 14.5, #4e4e4e, at x 24.6 (ink y 208.2–220.8)
  - switch: x 86.9–139.2, y 200.5–231.1 (52 × 30.6, radius 15.3). Off: track **#6e6e6e**, white knob at the left. On: track **#0c8f2d**, knob at the right.
  - colour changes in one frame (40.563); the knob slides ≈ 250 ms (40.563–40.81)
- **인기 검색어**:
  - heading Bold 17.5 / −0.1, #000, at x 25 (ink 273.4–289.1)
  - list items: number "n." **right-aligned** (its ink ends at x 48.63), text at x 53.3, Regular 16.5 / 0, #111, row pitch **58**, first ink top 320.1
  - 1. 제로페이모바일상품권 · 2. 카드 · 3. 자동이체 · 4. 포인트 · 5. 만보기 · 6. 환전 · 7. 통장사본 · 8. 디깅퀴즈 · 9. 대출
- **Results** (invented; the recording's results are EXCLUDED):
  - When the query is non-empty and 자동완성 is on, show a list under the field (replacing 인기 검색어).
    It holds the menu-catalog entries (§2.18) whose name contains the query, up to 10.
  - Row h 52, x 24, Regular 16.5, with the matched substring in **#0c8f2d**.
  - Tap → the same links as the menu. No match → "검색 결과가 없어요" (Regular 15, #808080, centred, 40 pt below the field).
  - Tapping a 인기 검색어 fills the field and shows the results.
  - Enter or the magnifier with 자동완성 off shows the same list.
- **Keyboard** (native layer `#ao-native`, infra §2.13): the iOS 26 Korean 2-beolsik keyboard. It slides up 41.16 → 41.40 (≈ 240 ms) with the iOS curve.
  - The web view does not resize; the keyboard covers the list.
  - Accessory bar above it on white: "∧" (x ≈ 38–50) and "∨" (≈ 93–104) in grey #a9a9a9 (inactive), and a black "✓" (≈ 350–362), at y ≈ 505–525. "✓" blurs the field.
  - Container: light glass **#edeef1–#f0f1f4**, top corners radius ≈ 26, bottom corners following the device corners, top at y ≈ 541.
  - Keys: white, radius ≈ 6, h 43, no shadow.
    - row 1: y 568.5–611.5, 10 keys of 32.5 wide, pitch 38.6, from x 6.7: ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ
    - row 2: y 623.1–664.8, 9 keys from x 25.9: ㅁㄴㅇㄹㅎㅗㅓㅏㅣ
    - row 3: y 676.4–719.4: ⇧ (6.7–50.6), ㅋㅌㅊㅍㅠㅜㅡ (from 64.3), ⌫ (342.4–386.7)
    - row 4: y 730.4–773.4: "123" (6.7–48.6), 😀 (54.6–96.9), space (102.9–290.1, with a grey "한" at the right), ↵ (296.1–386.7)
    - bottom: 🌐 at x ≈ 30–56 and a mic at ≈ 345–365, y ≈ 790–820, with no key backgrounds
  - Glyphs ≈ 22 pt, #000. A pressed key is **#c9c8cb** with no pop-up preview.
  - If the transfer spec already builds this keyboard (메모), share that component.

---

## 3. Interactions and transitions (measured)

| trigger | effect, with measured timing |
|---|---|
| scroll down from top | from the scroll event: bar 490 ms to +75, pill 620 ms to +135 (separate curves, §2.16) |
| reach top | after 8 ms (+ one frame): bar 952 ms, pill 731 ms (§2.16) |
| reach bottom | bar only, no debounce: 424 ms `linear()` to +14.33, no pill (§2.16) |
| swipe card | snap page, loops; 305 ms `cubic-bezier(.3,.43,.3,1)` from the release; pager updates when the snap starts (4.508); a card not seen before shows the loading body for ≈ 0.4 s |
| drag card < half | rubber-band back: 13 pt drag, then the same 305 ms curve from the release (C3 25.192–25.433) |
| pager ‹ › | invented: page ±1, 300 ms |
| tap **거래내역** | no pressed state. In the same frame (C2 9.008) the web dim (luma ≈ 114) + spinner appear. Cut to 거래내역조회 at ≈ 9.96 (≈ 0.95 s; the account spec owns the target) |
| tap **이체** | dim + spinner at C3 26.146 → cut ≈ 26.56 (0.41 s) → transfer "누구에게 보낼까요?" with this card as the 출금 account |
| tap **ATM출금** (no press colour either), ⋮, 오늘 운세, name, 큰글, wallet | no-op (큰글 animates its knob 200 ms as an invented nicety, no effect) |
| tap **숨김** | invented: balance → "잔액 숨김" (Regular 17, #808080) and the pill text → "보기". Stored per account in localStorage |
| tap **복사** | invented: copy "NH농협은행 <number>" + toast "계좌번호가 복사되었어요" (black 80 %, radius 8, white Regular 14, 2 s, 16 pt above the tab bar or the bottom edge) |
| tap **bell** | opens the DevPanel (the clone's 관리 패널 convention, README "🔔 관리 패널") |
| tap **≡ (menu)** | spinner **without dim** C3 38.629–38.93 (0.30 s) → cut to 전체메뉴 at 38.946 with the dim (luma 114) + spinner for 3 frames → clean 38.996 |
| tap **menu search row** | spinner at 39.813 → dim fades in from 39.846 (luma 112 → 99 over 120 ms) → cut to 통합검색 at 39.979 (0.17 s) |
| 통합검색 × | invented: cut back to 전체메뉴 |
| ticker | every 2.5 s, typewriter (§2.6) |
| ad carousel | auto 4 s, slide ≈ 180 ms ease-out; pause toggles |
| return to home through a flow's 취소/완료 | dim fades in 0.13 s + spinner (C3 21.596 → 21.729), spinner off at +0.52 s, dim off +0.13 s later → skeleton sequence (§2.17) → 정기점검 sheet (launch.md) |
| plain back to an already-mounted home | no reload, no skeleton, no sheet (launch.md rule) |

Double-tap guard: use the `nav.ts` once-lock (infra §2.14) on 거래내역, 이체, ≡ and the menu links.

---

## 4. Data and server

**GET `/api/home`** (exists) already returns `profile.userName` and `accounts[]`, built by `toAccount`: id, kind, label, balance, badge, number, bank.
The home needs:
- **NH carousel**: accounts with `bank.code === 'nh'` (infra: allone NH accounts are stored with `bank_code='nh'`), in `sort` order.
  - Fields: `label` (the product name, stored in `accounts.name`), `number` (format **NNN-NNNN-NNNN-NN**, 13 digits), `balance` (integer won),
    `badge` (the string "한도제한" → shows the tag).
  - **No server change** is needed if the seed writes `name` and `badge`.
- **다른금융 tab** (invented): accounts whose bank is not `nh` (the KB / 케이뱅크 accounts that the 잔액채우기 sheet uses), in the same card layout.
  - Use the bank's squircle tile (`allone-bank-<code>.png`, infra) instead of the NH tile, and no 한도제한 tag.
  - Buttons: **잔액채우기** (→ top-up, with this account as 출금계좌) | **거래내역** (no-op).
  - Empty: one card with "다른 금융기관 계좌를 연결해 보세요" (Regular 15, #808080, centred) + a "계좌등록" outline button (no-op).
- **Static content** stays client-side in `src/allone/home/content.ts`, as kakao2 does: banner, ad, ticker items, quick menu, 내 모임,
  ad slides, 금융일정, 내 소비, 내 자산 chips, 생활자산, 그룹, the menu catalog, 인기 검색어. No new endpoint.
- **Per-profile client prefs** (localStorage via `kbank/prefs.ts` pattern): hidden balances, the 최근 이용메뉴 list, the 큰글 knob, the 자동완성 switch.
- Balance formatting: `toLocaleString('ko-KR') + '원'`. Copy text: `NH농협은행 ${number}`.
- Seed (server/infra owns it). Use invented 홍길동-style data:
  - 2 NH accounts: `NH페이모아통장(비대면실명확인)` and `NH X 카카오페이통장(비대면실명확인)`, both badged 한도제한, with invented numbers and balances
  - the other-bank accounts are those the top-up spec needs
- Search is client-side substring matching over the menu catalog.

---

## 5. Not visible in the recording: invented defaults

- 다른금융 tab content (§4). Pager arrows (§3).
- 숨김 / 보기 and 복사 + toast (§3). The ⋮ menu is a no-op.
- What the "내 자산 확인" pill does: scroll to 내 자산.
- Ad carousel slide 1 replacement and slide 3, plus the interval (4 s). 생활자산 card 3 (헬스케어).
- The rest of the 전체메뉴 rail and list beyond what is visible (§2.18), the 최근 이용메뉴 contents, and the scroll-spy.
- 통합검색 results, the empty state, the ✓ / × behaviour.
- Tab taps (no-op; 홈 scrolls to top).
- 큰글 (visual only).
- **Do not** port the kakao clone's practice popup (README, 🔔 계좌 section) to allone. Nothing from the excluded ranges is built.

---

## 6. Personal data seen (never write the values)

| role | where | placeholder | format only |
|---|---|---|---|
| recorder's name | home header, 전체메뉴 header | `<NAME_A>` | 3 Hangul syllables + "님" |
| account 1 number (페이모아) | card 1 | `<ACCT_A>` | NNN-NNNN-NNNN-NN |
| account 2 number (카카오페이통장) | card 2 | `<ACCT_B>` | NNN-NNNN-NNNN-NN |
| account 1 balance | card 1 | `<AMOUNT_A>` | 4-digit amount with a comma + 원 |
| account 2 balance | card 2 | `<AMOUNT_B>` | 1 digit + 원 |
| recorder's recent menus | 전체메뉴 최근 이용메뉴 | `<RECENT_1..3>` | loan-related menu names; derive from clone usage instead |
| celebrity name and photo in an ad | ad carousel slide 1 | `<CELEB_AD>` | do not reuse |
| status-bar clock and battery | everywhere | infra.md | — |

No counterparty names, phone numbers or codes appear in this area. The 정기점검 dates are a public notice (launch.md).

---

## 7. Assets

**Crops** come from the full-res frames, `ffmpeg -ss <pts> -i <clip> -frames:v 1` (first frame with pts ≥ the time).
Boxes are x, y, w, h in px of the 1180 × 2556 frame. They were checked visually in `frames/home/v_crops.png`.
Upscale ×4 as for kakao2/ibk if needed. Name them with the `allone-` prefix.

| asset | clip @ pts | px box (x, y, w, h) | privacy verdict |
|---|---|---|---|
| banner heart + coins | C3 @25.750 | 850, 450, 231, 198 | OK: art only |
| 대법원 ad (logo + illustration) | C3 @25.750 | 210, 1657, 258, 234 | OK: no personal data; third-party public ad (or replace, §2.5) |
| ticker flame | C1 @14.767 | 132, 1042, 99, 123 | OK |
| ticker P-coin hand | C1 @15.433 | 129, 435, 105, 117 | OK (the bubble ends above it in this frame) |
| ticker money bag | C2 @3.624 | 132, 1036, 99, 129 | OK (scrolling frame, sharp) |
| quick menu ×8 | C1 @14.767 | row 1 y 1360 h 99: x 168 / 417 / 667 / 916 (w 99/99/102/102); row 2 y 1606 h 99, same x | OK |
| 내 모임 art | C2 @0.408 | 787, 1459, 318, 330 (lavender bg included) | OK: cartoon |
| ad slide 2 hand + money | C2 @1.208 | 775, 730, 300, 213 (keep above the pager) | OK |
| **ad slide 1 (celebrity card)** | — | **do not crop** | **NO: real person's likeness and name** |
| 금융일정 calendar | C2 @1.208 | 799, 1309, 270, 258 | OK |
| 내 소비 mart | C2 @1.208 | 871, 1826, 192, 258 | OK |
| 내 자산 money bag | C2 @1.608 | 871, 1417, 180, 183 | OK |
| 생활자산 car tile | C2 @2.008 | 210, 1597, 204, 204 (mask to the squircle) | OK: stock vehicle photo, no plate visible |
| 생활자산 insurance tile | C2 @2.008 | 742, 1597, 204, 204 | OK |
| 그룹: 투자 / 카드 / 생명 / 손보 / 캐피탈 / 저축 | C2 @2.408 | 402,754,114,111 / 949,766,114,84 / 402,1204,114,114 / 952,1204,108,114 / 402,1657,111,114 / 949,1666,114,96 | OK |
| menu NH지갑 / 인증·보안 / 고객센터 / 이벤트 | C3 @39.750 | 162,558,87,93 / 423,558,90,93 / 688,558,93,93 / 952,558,99,93 | OK |
| menu AI톡 tile | C3 @39.750 | 970, 345, 156, 156 | OK: brand mascot |
| 🍀 in the bubble | C3 @25.750 | 241, 343, 39, 50 (on black) | OK |

**SVG / CSS (draw, no crop)**: header wallet / bell / menu-search icons; 큰글 switch; NH logo tile; pager pill + chevrons; ⋮; tab bar 5 icons;
the "내 자산 확인" pill + chevron; section chevrons; the 메뉴설정 dashed-plus icon; the menu globe / gear / home / ×, push-pin, magnifier;
the 통합검색 ×, clear button and magnifier; the 자동완성 switch; the keyboard (glyph text + SVG ⇧ ⌫ ↵ 🌐 mic).

**Never crop**: anything showing the name, the account numbers or the balances; the account cards themselves (rebuild them in DOM);
the 최근 이용메뉴 rows; the celebrity slide.

---

## 8. Open questions

1. The home bg is #fff, but infra's `--ao-bg` is #fafcfd. Use #fff on the home, or fix the token?
2. The tab bar rests at +14 pt at the bottom end. Reproduce that quirk, or simplify to 0?
3. Keep the 대법원 public-service ad as a crop, or swap it for an invented NH promo with the same geometry?
4. Should 로그아웃 in 전체메뉴 really log out (the app's existing logout), or stay a no-op?
