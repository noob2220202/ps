# Toss clone: launch, system bars, HOME, home→토스뱅크 transition, post-transfer ad pages

Area owner: home. Sources are two Galaxy recordings (dark mode). Each is 480×1066 px with variable frame rate. All times below are real pts in seconds (ffprobe `pts_time`), not frame index.
- **A** = `591c4ee0-…_175407_Toss.mp4` (132.4 s)
- **B** = `68897750-…_175809_Toss.mp4` (174.6 s)

**Geometry.** The recordings are 480×1066.67 px. The device is 1080×2400 at 2.8125 px/dp, so the recordings scale at **1.25 px/dp**. The phone is **384 × 853.33 dp**, the same Galaxy class as nh/hana (`--frame-w:384px; --frame-h:853.33px`). Every dp value below is `px / 1.25`, measured from the top-left of the screen. Edges are taken at the half-intensity crossing, so they have sub-pixel accuracy (±0.3 dp).

**Font.** Toss uses Toss Product Sans. The clone uses Pretendard, like the other apps. The sizes below are Pretendard sizes **fitted to the measured ink width**, so text widths match. Ink heights point to Toss glyphs being about 3 % narrower and about 0.5 dp taller. Weights come from ink-coverage fitting: R = 400, M = 500, SB = 600, B = 700.

Measuring scripts (scratch only) are in `scratchpad/toss/scripts/`:
- `xf.py`: extract frames by pts
- `edges.py`: sub-pixel edges
- `blobs.py`, `ink.py`: ink boxes
- `fit.py`: Pretendard size fit
- `weight.py`: weight fit
- `radius.py`: corner radius

Frames used are in `scratchpad/toss/frames/home/`.

---

## 1. Screen / state inventory (my area)

| # | Screen / state | Video | pts (s) | Notes |
|---|---|---|---|---|
| 0 | Samsung app drawer (launcher), tap on 토스 icon | A | 0.000–0.400 | **Not cloned** (system UI, shows installed apps). |
| 1 | Launch window-open zoom | A | 0.400→0.62 | Captured frames start at 0.547, where the window is already ~95 % size with rounded corners. The logo bbox grows from x170→162 px and is final at 0.624. |
| 2 | System splash (logo centred) | A | 0.547–5.622 | bg `#171619`. Logo 124.8×115.2 dp at x128.8–253.6, y368.0–483.2 (centre 191.2, 425.6). Static, no logo animation. |
| 3 | App splash (handoff) | A | 5.642–7.286 | Same logo **8 dp lower** (y376–491.2). A one-frame layout jump. |
| 4 | Black (biometric prompt, FLAG_SECURE) | A | 7.307–8.550 | **Not cloneable**: the recorder shows black. |
| 5 | Lock screen 잠금 해제 (logo + 2 buttons) | A | 8.574–9.969 | Logo at y375.2–490.4. Buttons: 생체인식으로 잠금 해제 / 비밀번호로 잠금 해제. |
| 6 | Lock screen, buttons gone (unlocked) | A | 9.992–10.118 | Logo only. |
| 7 | Lock → Home cross-fade | A | 10.118–10.40 | ~300 ms. The 포인트 row expands 10.31–10.40. |
| 8 | **HOME** (final, top of scroll) | A | 10.40–13.169 | Never scrolled in either video. |
| 9 | Home row pressed (토스뱅크 통장) | A | 13.247–13.479, fade 13.479–13.646 | Highlight `#2a2b30`. |
| 10 | Dead time before navigation | A | 13.646–14.107 | ~460 ms with no visual change. |
| 11 | Push → blank 토스뱅크 page (back arrow) | A | 14.134–14.50 | Slide-up, see §3.4. |
| 12 | Toast **"토스뱅크로 이동했어요"** | A | in 14.23→~15.06 (spring); hold; out 18.99–19.19 | Pill centred in the header line. |
| 13 | Web-view progress bar under header | A | 15.528 jump→70 %; 17.41–17.71 fill→100 %; hidden ~18.31 | y 80–82.4 dp. |
| 14 | 통장 content appears (skeleton first) | A | 18.893 | Hand-off to the 통장 spec. |
| 15 | Home cold reload after back from 토스뱅크 | B | 131.153 black; 133.465 tab bar; 134.79 header + faint skeleton; 135.93–136.05 cached content fades in | Cached layout = no banner, no 포인트 row, no 오늘의 딜/ad (§2.10). |
| 16 | Home "refresh re-layout" + number roll | B | 137.66–138.46 | Banner slot opens, rows/cards insert, amounts roll (odometer). |
| 17 | Home row pressed (11월에 쓴 돈) → push 소비 | B | press 140.242–140.449; push 140.470 | Hand-off to the 소비 spec. |
| 18 | Back to home from 소비 (pop) + spent-amount odometer | B | 149.33 pop; roll 149.45–149.97 | |
| 19 | Footer "계좌 · 카드 · 포인트 모두 보기" pressed | B | 150.989–151.44 | bg lighten + text scale 0.97. |
| 20 | Loading box "잠시만 기다려주세요." | B | 151.980–152.031 | Then push → 자산 at 152.031. |
| 21 | Transfer done (옮겼어요) closes (pop down) | B | 70.441–70.576 | |
| 22 | Blank coupon page (back arrow only) | B | 70.576–72.129 | |
| 23 | **Coupon ad page "5천원 쿠폰이 발급됐어요"** | B | fade-in 72.147–~72.55; idle to 77.25 | |
| 24 | "3일 동안 안보기" pressed → page fades out | B | press 77.25–77.32; fade 77.332–77.42 | Reveals the 통장 page. |
| 25 | After 보냈어요 확인: blank page #1 (push) | B | 120.351–120.71 slide; bar 121.50–122.13; bar hidden 122.70 | Redirect pages. |
| 26 | Blank page #2 (push) | B | 122.81–123.18 slide; bar 123.90–126.02 | |
| 27 | Page #3 push + toast **"토스로 이동했어요"** | B | push 126.04; toast in 126.23→~126.84; content 126.734; toast out 127.69–127.75 | |
| 28 | **Ad page "30일 동안 / 매일 2,000원 돌려받기"** | B | 126.734 (low layout); 127.587 content jumps up ~49 dp; × before 닫기 appears 128.58 | Lottie calendar loops (~1.9 s). |
| 29 | Ad page closed via 닫기 (pop down) | B | 129.607–129.734 | Reveals 통장. |
| — | Heads-up notifications from **other apps** (pill at top) | B | 76.2–79.1, 127.55–131.0 | **Not Toss UI, do not clone.** They carry another bank app's icon. One of them shows a counterparty name, an amount, a balance and a time. |

---

## 2. Layouts

### 2.0 Global tokens (sampled; "measured peak → suggested CSS")

| Token | Value | Where |
|---|---|---|
| `--toss-page` | `#100f12` (16,15,18) | Home page bg; status-bar area on home |
| `--toss-surface` | `#171619` (23,22,25) | Splash, lock, pushed pages (통장 / ad / coupon), tab bar, reward banner |
| `--toss-card` | `#19181b` (25,24,27) | Home cards |
| `--toss-btn` | `#2a2b30` (42,43,48) | Small grey buttons (송금 / 받기 / 내역 / 충전). Also the **pressed-row** bg |
| `--toss-btn-on-pressed` | `#3b3c41` (59,60,65) | Small button while its row is pressed (≈ white α 0.075 over the row) |
| `--toss-divider-full` | `#252427`, 1 px@480 (≈0.8 dp) | Card-1 full-width divider |
| `--toss-divider-inset` | `#2b2a2d`, ~1.2 dp | Card-3 inset divider (x 27.8–355.4) |
| `--toss-blue` | `#3182f6` (measured `#2e7df1` / `#2f80f5` / `#3181f7`) | Primary buttons, toast link text, spinner |
| `--toss-red-dot` | `#f04452` (measured `#d12b44`, too small to saturate) | Bell badge |
| `--toss-text-1` | `#fafafc` (titles, measured peak `#faf9fc`) | Titles, spend amount, ad title (`#ffffff`) |
| `--toss-text-amount` | `#e4e3e6` | Balances in the accounts card (measured, dimmer than titles, also for non-zero values) |
| `--toss-text-2` | measured `#babac0` → suggest `#c4c5cb` | Account names (토스뱅크 통장, 토스머니), footer (`#b3b4b9`→`#c0c1c7`), small-button text (`#bbbcc3`) |
| `--toss-text-3` | measured `#8b8b8f`..`#8d8e92` → suggest `#97979c` | 13 dp subtitles (포인트 desc, 11월에 쓴 돈, 최근 본 상품 subtitle, banner line 1) |
| `--toss-text-ad-sub` | measured `#a3a2a5` → `#adacaf` | Ad subtitle "… · AD" |
| `--toss-text-4` | measured `#69686b` → `#717074` | 토스유스카드 · N개월 전 (the dimmest) |
| `--toss-header-fg` | `#a8a8b0` | Header title "토스뱅크", Pay, bell (grey, not white) |
| `--toss-chevron` | `#b2b6bf` | Row chevrons |
| `--toss-tab-fg` | icons `#d8d7dd`, selected filled icon `#dcdce4`, labels `#d5d4d9` (peak) | Tab bar |
| `--toss-toast-bg` | `#1f1e21` (31,30,33) | Toast pill, loading box |
| status-bar text | `#eeedf0` | |
| gesture handle | `#6b6a6d` | |

### 2.1 Android status bar + gesture bar (all screens)
- **Status bar.** 28 dp, transparent: the screen's own bg shows through (home `#100f12`, pushed pages and splash `#171619`). It is identical to the nh/hana Galaxy bar.
  - Clock ink: x 28.0 dp, digit ink y 8.0–17.6 dp, ~14 dp Roboto-like regular, `#eeedf0`.
  - Right cluster ends at x 356 dp: alarm, mute, Wi-Fi, signal, "NN%" and a battery-with-bolt glyph.
  - **Reuse** the existing nh/hana `.statusbar--android` rules (height 28, padding-left 26.7, 14 px). Use a light fg. Left-side notification icons (screen recorder, other apps) are not cloned.
  - During a push or pop the status-bar region briefly shows black (see §3.4). That is optional.
- **Navigation.** Gesture navigation with **no black band**: the app draws to the bottom edge, and the tab bar `#171619` runs under the handle.
  - Handle: x 134.41–249.56 dp (115.2 wide), y 843.20–847.33 dp (≈4.1 tall), radius 2, `#6b6a6d`.
  - Draw it as an overlay like `.phone__gesture` (kbank) with `top: 843.2`, not the nh 15 dp black `.phone__navbar`. On pushed pages it sits on `#171619`.
- Samsung edge-panel handle: a grey sliver at x 0–4.8, y 119–237 dp, visible in every frame. **Not cloned.**

### 2.2 Splash (A 0.55–7.29) and lock screen (A 8.57–9.97)
- **Splash.** bg `#171619`. Toss logo (3-D blue "split-ellipse" mark) 124.8×115.2 dp, centred at (191.2, 425.6). No text and no animation.
  - The recording shows ~6.7 s. The clone should hold for **1.2 s**, then cross-fade to home.
  - Faithful option: at +0.5 s move the logo 8 dp down in one frame (system → app splash handoff), then continue.
- **Lock screen** (optional; other clones skip auth):
  - Logo at y 375.2–490.4 (the shifted position).
  - Button 1 **생체인식으로 잠금 해제**: x 33.3–350.6 dp (317.3 wide, centred), y 623.0–680.2 (≈56 tall), bg `#3182f6`, text 17–18 dp SB white (ink x 111.2–272.0), radius ≈14.
  - Button 2 **비밀번호로 잠금 해제**: same box at y 692.2–747.7, bg `#1e2740`, text `#4693fa` (ink x 120–264). Gap 12 dp.
  - Unlock: the buttons vanish in one frame (9.97→9.99). The logo stays ~130 ms, then home cross-fades (§3.1).
  - Recommendation: skip the lock screen by default. Possibly enable it with `?lock=1`, where both buttons unlock immediately.

### 2.3 HOME: header (not seen scrolling)
- **Logo:** grey monochrome Toss mark (metallic grey gradient `#878d94`→`#9aa0a8`), ink x 25.6–46.4, y 47.2–65.6 (20.8×18.4).
- **"토스뱅크"**: 17 dp SB, `#a8a8b0`. Ink x 51.2–109.6, y 48.8–64.8.
- **Chevron ›**: x 116.0–121.6, y 52.0–61.6, stroke ≈1.6, `#83888d`. Tapping title + chevron = one hit target.
- **Pay icon**: x 281.6–316.8, y 43.2–65.6 (35.2×22.4).
  - Four rounded corner brackets (arm ≈5 dp, stroke ≈1.6) framing "Pay" (~13 dp SB). Colour `#adafb7`. Draw it in SVG.
- **Bell**: outline bell, x 336.8–358.4, y 43.2–66.4 (21.6×23.2), stroke ≈1.7, `#abadb4`.
  - **Red dot** Ø≈7.5 dp, centre (359.6, 42.4), `#f04452`. SVG.
- Row visual centre ≈ y 55.6, so the header is the 28→~84 band.
- Scroll behaviour was not observed. Invented default: the header is sticky on `--toss-page`, and content scrolls under it.

### 2.4 HOME: content column (final layout, A 10.70 / B 138.5)
Cards are x 12.0–371.5 (width 359.5 ≈ 360, side margin 12). The vertical gap between cards is **9.4 dp** (measured 9.0–9.8; use 9.4). Card bg `#19181b`, corner radius ≈ **22–23 dp** (fit 22.8, smooth-corner look). There is no border. The 1-px lighter vertical edge seen at x 16/463 is compression ringing.

| Block | top–bottom (dp) | height |
|---|---|---|
| Reward banner (+ close circle) | 93.67–159.09 (circle 83.8–108.0) | 65.4 |
| Card 1: accounts | 167.17–381.41 | 214.2 |
| Card 2: spending | 390.63–508.79 | 118.2 |
| Card 3: 최근 본 상품 / 방문한 서비스 / 오늘의 딜 | 518.17–710.33 | 192.2 |
| Card 4: ad | 719.29–~815.5 | ≈96 |
| Two half cards | ~824.9–893.1 | 68.2 (measured in B cached frame) |
| List card | ~902.5–1060.8 | 158.3 |
| Next card | ~1070.2– … | not visible (invent, §5) |

Without the banner (cached first paint, B 136.05), card 1 starts at **86.3** dp. The banner block therefore occupies 80.9 dp: 7.4 above + 65.4 + 8.1 below.

**Reward banner** (dismissible):
- Box x 15.94–367.94 (352 wide, margin 16, i.e. narrower than the cards), y 93.67–159.09. bg `#171619` (darker than the cards), radius ≈18.8.
- Icon: Face-ID style, x 40.8–64.0, y 115.2–137.6. Four blue corner brackets + 2 eye dots + nose stroke + smile, stroke ≈2, `#1b83e2`→use `#3182f6`. SVG.
- Line 1: `<NAME_GIVEN>님의 {M}월 최대 적립금`, 13 dp R/M, `#929194`. Ink x 76.8, y 108.8–120.8.
- Line 2: `<PROMO_AMOUNT>원`, 17 dp SB/B, `#e1e0e3`. Ink y 128.0–144.8.
- Button **확인하기**: x 278.4–344.0 (65.6 wide), y 110.4–143.2 (32.8 tall), bg `#3182f6`, radius ≈8. Text 13 dp SB white, ink x 288.8–332.8.
- **Close circle**: Ø 24.2 dp, centre (360.6, 95.9), i.e. overhangs the banner's top-right corner. bg `#29282b`. "×" 8×8 dp, stroke ≈1.5, `#838285`.

**Card 1: accounts.** Padding-top 8. Three rows of **52.8** dp, centred at y 201.6 / 254.4 / 307.2.
- Icon: 30 dp squircle (x 32.7–62.4).
- Text column x 75.2: amount ink top = row centre −16.0, label ink bottom = row centre +17.6.
- Small button: x 299.1–351.2 (52.1×31.7), centred on the row, radius ≈6 (fit 5.2), bg `#2a2b30`. Text 13 dp SB `#bbbcc3`, ink x 313.6–336.0.

| Row | Icon | Amount (17 dp B, `#e4e3e6`) | Label (13 dp M) | Button |
|---|---|---|---|---|
| 1 | squircle `#22375c` + blue Toss mark (~18×15, gradient `#0a6efa`→`#4aa3ff`) | `<BAL_TOSSBANK>원` | 토스뱅크 통장 (`#c4c5cb`) | 송금 |
| 2 | same | `<BAL_TOSSMONEY>원` | 토스머니 (`#c4c5cb`) | 송금 |
| 3 | squircle `#1e273c` + Ø≈20 circle `#307bec` with white **P** (bold ~12) | `<POINT_CHANCES>번` | 송금·결제 후 받는 포인트 (dimmer, `#97979c`) | 받기 |

- Divider: **full card width** (x 12–371.5) at y 341.6, `#252427`, ≈0.8 dp.
- Footer row: y 342–381.4 (≈40 tall), text centred **계좌 · 카드 · 포인트 모두 보기**. 13 dp M, `#c0c1c7`, ink x 116.8–267.2, y 355.2–367.2. The separators are "·" with spaces.

**Card 2: spending.** Two rows, centres y 421.6 / 474.4 (pitch 52.8). Row 1 pressed rect = y 396.2–446.6.
- Row 1:
  - Amount `<SPEND_MONTH>원`, 17 dp B, `#f8f7fa`. Ink x 32.8, y 405.6–420.8.
  - Label `{M}월에 쓴 돈`, 13 dp M, `#97979c`. Ink y 424.8–437.6.
  - Button **내역**.
- Row 2 is indented to x 75.2: there is an **empty 30-dp icon slot** at x 32.7–62.4 (uniform card colour in both videos).
  - Amount `<YOUTH_CARD_BAL>원`, 17 dp B. Ink y 458.4–473.6.
  - Label `토스유스카드 · <N>개월 전`, 13 dp, dim `#717074`. Ink y 479.2–491.2.
  - Button **충전**.

**Card 3.** Rows centred y 553.6 / 607.6, inset divider at y 639.8 (x 27.8–355.4), row centred 674.8. Bottom padding ≈35.5.
- Title: 15 dp **B** `#fafafc`, ink x 32.8, ink top = centre −16.8.
- Subtitle: 13 dp M `#97979c`, ink top = centre +4.8. Single line, ellipsis.
- Thumbnail: 36 dp squircle, radius ≈12, x 291.2–327.2.
- Chevron ›: x 340.0–347.2, 7.2×11.2, stroke ≈1.8, `#b2b6bf`.

| Row | Title | Subtitle | Thumbnail |
|---|---|---|---|
| 1 | 최근 본 상품 | `<RECENT_PRODUCT>` (truncated "…") | white squircle with product photo → **invent** |
| 2 | 방문한 서비스 | `<VISITED_SERVICE>` | squircle `#223339` + teal `#67cccc` ticket with star cut-out (SVG) |
| 3 | 오늘의 딜 | 최대 1만원 꽝 없는 쿠폰 뽑기 | teal `#21ead4` bold glyph mark (two vertical "ㅂ/H"-like shapes) on transparent, 36 dp |

**Card 4: ad**
- Title **빚 최대 탕감결과 30초 확인**: 17 dp B white. Ink x 33.6, top = card top +20.7, ink h 16.
- Subtitle **상담 없이 결과 즉시 확인 가능 · AD**: 13 dp M `#adacaf`. Ink top +44.
- Third line `광고 책임 변호사 <AD_LAWYER_NAME>`: ~9 dp R `#77767a`. Ink top ≈+71, h 8.8.
- Thumbnail: 36 dp white squircle with an advertiser logo, vertically centred, x 319.2–356.0. **Invent** both the advertiser and the line.

**Two half cards** (B cached frame):
- Left box x 12.6–187.3, right box x 196.0–371.1 (≈175 wide, h-gap 8.8), height 68.2, same card radius.
- bg: card colour plus a soft bottom glow. Left is bluish (`#1d2130` at bottom), right is warm brown (`#2a2220`).
- Titles: 2 lines, 15 dp SB `#f3f2f5`, line pitch 20.8. Ink tops at card top +16.7 / +37.5, text x = card left +19.5.
  - Left: **편의점에서 / 토스머니 충전**. Right: **토스 브랜드콘 / 구매하기**.
- 3-D illustrations are bottom-right and clipped by the card bottom.
  - Left: x 120–172 dp, a blue/lilac convenience-store box with awning.
  - Right: x 311–356 dp, an iced-coffee cup with a barcode coupon.
  - Crop or redraw them (§5).

**List card** (3 rows, pitch ≈49.4, first row centre = top +29.9, last = bottom −29.5):
- Icon: 24 dp box at x 33.6–55.2.
- Title: 15 dp SB `#f3f2f5`, x 70.4. Chevron at x 340.
- Rows:
  - **계좌 개설**: blue card icon `#4b8ff6`.
  - **토스쇼핑**: coral bag `#f96167` with a grey handle.
  - **체크카드 혜택 추천**: mint card `#a8e5cf` with a blue star badge.

**Bottom padding.** Make the last card scroll fully above the tab bar: content end + 12 + tab bar 73.3.

### 2.5 HOME: bottom tab bar (fixed)
- Sheet from y **780.0** dp to the screen bottom (853.33), i.e. 73.3 tall incl. the gesture area.
- bg `#171619`, 1-px top/side border `#2b2a2d`, top corners radius ≈**20.8**. Content scrolls under it (opaque, no blur).
- 5 items with centres at x **50.0, 120.4, 190.4, 261.2, 331.6**. Pitch 70.4; the group is 1.6 dp left of centre, keep that.
- Icons ~21×21 dp with top at y 790.4 (bottom 811.2), stroke ≈1.7.

| Tab | Icon (SVG) | Label |
|---|---|---|
| 홈 (selected) | **filled** rounded house with door notch, `#dcdce4` | 홈 |
| 혜택 | outline gem: flat top, slanted sides to a point; short bar inside the top | 혜택 |
| 쇼핑 | outline tote bag with arched handle | 쇼핑 |
| 증권 | outline rounded box whose top edge is a rising zig-zag (chart) | 증권 |
| 전체 | three horizontal lines (18.4 wide, 6.4 pitch) | 전체 |

- Labels: 11 dp M, ink y 817.6–828.0, all the **same colour** `#d5d4d9`. Selection is shown **only by the filled icon**: unselected icons are not dimmed in this recording.
- Selected states for other tabs were not seen. Use a filled variant of each icon.

### 2.6 Pushed-page shell (blank 토스뱅크 page, ad redirect pages)
- bg `#171619`. Back arrow "←" white, x 19.2–37.6, y 45.6–62.4 (≈18.4×16.8, stroke ≈2).
- The header band is 28→80 dp.
- Web-view **progress bar**: y 80.0–82.4 dp (≈2.4–3), full width. Fill `#3182f6` at ~45 % alpha (measured `#2d4a77`), track `#595c65`.

### 2.7 Toast "토스뱅크로 이동했어요" / "토스로 이동했어요"
- Pill bg `#1f1e21`, fully round, height **49.5**, centred at y **54.4**, horizontally centred.
  - "토스뱅크…": x 88.1–295.2 (207 wide).
  - "토스…": x 102.5–280.9 (178.4 wide).
  - Padding ≈19 dp left / 20 dp right.
- Content:
  - Blue Toss mark ≈18×16 at x +19.
  - 4 dp gap, then text 16 dp SB.
  - **"토스뱅크"** (or "토스") in `#3182f6` **underlined**: underline ≈1.6 dp at the text baseline (y 59.2–60.8), same blue.
  - Then **"로 이동했어요"** in `#ffffff`.
- The pill overlaps the header band, between the back arrow and the right edge.

### 2.8 Loading box "잠시만 기다려주세요." (B 151.98)
- Panel x ~10–374 dp, y ~418–496, bg `#1f1e21`, radius ≈20, soft shadow.
- Blue spinner arc (Ø≈20, stroke ≈2.5, `#3182f6`, ~90° arc) at x ≈48–66.
- Text 15 dp R white, ink x 96.0–217.6, y 448.8–464.8.
- It appeared ~1 s after the footer tap, just before the push. Show it only if navigation takes >300 ms.

### 2.9 Post-transfer ad pages
**Coupon page** (B 72.4–77.3). bg `#171619`, back arrow as §2.6, content bottom-anchored and left-aligned at x 24–25.
- Coupon image: peach banknote-style coupon "5000" with a face silhouette, `#ffd1bf`/`#f6a184`. x 28–80, y 516.0–542.4. Crop it.
- Title **5천원 쿠폰이 / 발급됐어요**: 22 dp B `#f5f5f7`. Ink tops 581.6 / 615.2 (line pitch 33.6), ink h 20.
- Subtitle **토스쇼핑에서 쓸 수 있어요 · AD**: 17 dp R/M `#b6b5b9`. Ink y 659.2–675.2.
- Button **쿠폰 받기**: x 20.2–363.3 (full width, margin 20), y 716.1–771.9 (≈56), radius ≈14, bg `#3182f6`. Text 17–18 dp SB white.
- Text button **3일 동안 안보기**: 16 dp M `#898b91`, centred, ink y 797.6–812.8.

**"30일" ad page** (B 129.25, final layout). bg `#17161b`, back arrow at top-left. Everything is centred.
- Lottie calendar illustration: x 144.8–268.8, y 189.6–322.4 (≈124×133).
- Title **30일 동안 / 매일 2,000원 돌려받기**: 26 dp B white. Line-1 ink 388.8–412.8, line-2 ink 423.2–449.6 (pitch 34.4).
- Subtitle **새로 나온 토스페이 이벤트 · AD**: 15 dp R `#929196`. Ink y 464.0–480.0.
- Button **확인하기**: x 134.5–248.8 (114.3 wide), y 684.1–740.0 (≈56), radius ≈15, `#3182f6`. Text 17 dp SB white, ink x 162.4–220.
- **× 닫기**: "×" 11×11 dp at x 169.6–180.8, "닫기" 17 dp M at x 190.4–216.8, `#9d9ca1`, ink y 767.2–783.2.
- Before the reflow (126.73–127.57) all content sat **~49–54 dp lower** (title ink 442.4) and "닫기" had no "×".

### 2.10 Cached / first-paint home (B 136.05)
Order:
1. Accounts card (2 rows, no 포인트 row) at 86.3–247.3.
2. Spending card at 256.7–374.6.
3. Card 3 (2 rows, no divider / 오늘의 딜) at 384.0–508.9.
4. Half cards at 518.5–586.7.
5. List card at 596.5–754.8.
6. Next card at 764.0.

No banner and no ad card.

---

## 3. Interactions & transitions

### 3.1 Launch
1. Optional window-open zoom: ~200 ms scale 0.9→1 with rounded corners. The recorder caught only its tail: 0.547→0.624.
2. Splash. Clone: 1.2 s.
3. Optional lock screen.
4. **Home cross-fade ≈300 ms ease-out** (A 10.118→10.40):
   - Opacity samples at 0.42 / 0.55 / 0.83 / 0.97 = +47 / +195 / +229 / +280 ms.
   - The logo fades faster (0.73 already at +47 ms).
   - During the last ~90 ms the 포인트 row expands (height 0→52.8, fade in) and pushes the cards below down.

### 3.2 Press states
- **List row** (account row, spending row, card-3 rows, list rows):
  - Pointer-down: immediate full-width (card-clipped) highlight `#2a2b30` behind the whole row.
  - The small button in that row also lightens to `#3b3c41`.
  - No scale.
  - Release: highlight fades out **~170 ms** (A 13.479→13.646).
- **Footer "계좌·카드·포인트 모두 보기"**: the footer area bg becomes `#252427` and the **text scales to 0.97** (146.4/150.4) for the duration of the press (B 150.989→151.44).
- **Text button (3일 동안 안보기)**: text brightens (`#898b91`→`#a0a1a6`) and a faint rounded rect `#26262a` hugs the text.
- **Navigation latency.**
  - A: release→push 490 ms.
  - B footer: press→push 1.04 s, with the loading box shown for the last 50 ms.
  - Clone: navigate **~120 ms after release**. Show §2.8 only if the next screen is not ready within 300 ms.

### 3.3 Toast timing (A 14.23–19.19, B 126.23–127.75)
- **Enter.** Spring from above with blur-in.
  - Opacity 0→1 in ~180 ms; a Gaussian blur of ~8 dp clears in ~150 ms.
  - Centre y path (A): −10 dp at +150 ms (first legible) → **+5.5 dp overshoot at +240…+330 ms** → back to 0 at ~+800 ms (55.9 at +505, 54.6 at +760, 54.4 final).
  - Suggested: `translateY(-14dp)→0` with a spring of damping ≈0.55, response ≈0.45 s, plus a separate 180 ms opacity/blur ramp.
- **Hold.** At least ~1.45 s after entry start (B), and until the page content is ready + ~100 ms (A: content 18.893 → exit 18.99).
- **Exit.** ~200 ms: translateY 0→−13 dp (ease-in) + opacity 1→0 (A 18.99→19.19). B was faster (~60 ms).

### 3.4 Push: Toss "slide-up" page transition (A 14.134, B 120.35 / 122.81 / 126.04 / 140.47 / 152.03)
- **New page:**
  - `translateY` **+150 dp → 0**, **400 ms**, `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out; best fit to measured offsets 92 / 32 / 13.6 / 7.2 / 2.4 / 0 dp at +30 / 90 / 149 / 204 / 260 / 358 ms).
  - Opacity 0→1 within the first ~40 ms (one blended frame at +16…35 ms).
- **Old page:**
  - Stays visible **above** the incoming page's top edge.
  - Drifts up ~15 dp during the first ~90 ms (header seen moving 46→34 dp).
  - Then it is hidden. Any gap above the incoming page (status-bar area only) shows **black** until the page reaches the top (~+300 ms). The black gap is optional; `#000` is faithful.
- **Pop (back / 닫기 / 확인 on a completion page):**
  - Closing page `translateY 0→+45 dp`, **~125 ms**, ease-in (`cubic-bezier(0.4,0,1,1)`), then removed.
  - Samples: +2.4 / +8 / +16 / +24.8 / +37.6 dp at +14 / 37 / 61 / 84 / 110 ms.
  - The area it uncovers is black. The previous page appears at the end with no animation.
- **Dialog-like ad pages** (coupon) **dismiss by fading out, ~90 ms linear** (B 77.332→77.42). The page underneath is already visible.

### 3.5 Home → 토스뱅크 통장 (row 1 tap)
1. Row press (§3.2).
2. Push (§3.4) of a blank `#171619` page with back arrow.
3. Toast "토스뱅크로 이동했어요" starts at push +100 ms.
4. Progress bar: jumps 0→70 % (to x 268 dp) in ~80 ms at push +1.4 s (A). Then it **fills linearly 70→100 % in ~300 ms** when the page is ready, and hides ~0.6 s later.
5. 통장 content (skeleton first) appears.

Recording: content arrived at +4.76 s. **Clone: ready at ~+700 ms.** Bar at +150 ms, fill +700→+1000 ms, toast out at max(entry + 1.45 s, ready + 0.1 s).

### 3.6 Home refresh animations (B 137.66–138.46, 149.45–149.97)
- **Banner slot insert:** cards below shift down 0→80.9 dp over ~450 ms (ease-out, long tail). The banner fades in over ~120 ms once the slot is half open (137.86→137.98).
- **Row/card insertion** (포인트 row, 오늘의 딜 row + divider, ad card): height 0→H plus opacity, ~250 ms ease-out. Staggered: ad / 오늘의 딜 first (137.75), banner (137.81), 포인트 row (137.98→138.23).
- **Number roll (odometer)** when an amount changes (e.g. balance after a transfer, spending total):
  - Each digit column scrolls vertically (old digit exits upward, new enters from below) **through the intermediate digits**. Comma and 원 are fixed.
  - Columns finish **left→right**, staggered ~60–80 ms.
  - Total ~420–500 ms, ease-out.
  - Changed digits only, or all digits when the digit count changes; the width animates.
- Clone: animate on return to home if a value differs from the last rendered one. Skip it on first load (A showed no roll).

### 3.7 Banner close / buttons (not tapped in the video, see §5)

### 3.8 Ad pages
- **Coupon page:**
  - After 옮겼어요 → 확인: pop of the completion page (B 70.44–70.58), then the coupon page shell shows blank ~1.55 s.
  - Content **fades in ~350 ms ease-out** (opacity 0→0.54 at +0, 0.88 at +187, 0.97 at +311, 0.99 at +400 ms).
  - Clone: skip the blank wait, fade in 300 ms.
  - "3일 동안 안보기": press (§3.2), then fade-out 90 ms → 통장. Suppress this page for 3 days.
  - "쿠폰 받기": not seen → §5.
- **"30일" page:**
  - After 보냈어요 → 확인: two redirect shells (each a push + progress bar), then a push with toast "토스로 이동했어요".
  - Clone: **one** push → shell (progress bar to 70 %) → content at +600 ms (fade 200 ms), then toast exit.
  - The Lottie calendar loops ~**1.9 s**: calendar with orange "+" (~0.45 s) → page flip to orange "₩" (~0.25 s) → pages fan/flip away (~0.8 s) → back. Approximate it with 3 cropped key-frames cross-faded on a 1.9 s loop, or one static ₩ frame.
  - The ~49–54 dp content jump at +0.85 s is a web reflow. Optional; recommended: render the final layout.
  - The "×" icon before 닫기 appears at +1.85 s. Optional; render it from the start.
  - 닫기 → pop (§3.4) → 통장. 확인하기 → §5.

---

## 4. Data & server

**New server app `toss`.**
- `server/db.mjs`: `APPS` += `"toss"`. Data dir `server/data-toss/`, default port **9117**. Dev: vite **5181**, API **8795**. `npm run dev:toss` / `start:toss`. Cookie `bank_sid_toss`.
- Galaxy + dark are fixed: `data-app="toss"`, no os/theme switches, as kakao2 fixes iPhone + light.
- Frame CSS: `html[data-app="toss"] { --frame-w:384px; --frame-h:853.33px }`, status bar per §2.1, gesture overlay per §2.1.

**`GET /api/home`** (toss branch; the current handler returns a kakao-shaped payload, so add an `APP === "toss"` branch):

```ts
interface TossHome {
  profile: { userName: string; givenName: string };      // banner "<givenName>님의 {M}월 최대 적립금"
  reward: { month: number; maxAmount: number; dismissed: boolean }; // banner; dismissed → hide
  hasUnread: boolean;                                    // bell red dot
  accounts: {                                            // card 1, in this order
    tossbank: { id: "main"; label: "토스뱅크 통장"; balance: number; number: string };
    tossmoney: { id: "money"; label: "토스머니"; balance: number };
  };
  points: { chances: number };                           // "N번"
  spend: { month: number; total: number };               // "{M}월에 쓴 돈"
  youthCard: { name: "토스유스카드"; balance: number; lastUsedAt: string } | null; // "N개월 전" computed client-side; null → hide row
  recent: { product?: { title: string; thumb: string }; service?: { title: string; icon: string } }; // hide row if absent
  deal: { title: "오늘의 딜"; desc: string };            // static
  ad: { title: string; desc: string; disclosure?: string; thumb: string }; // static, invented
  quick: { id: string; title: string[]; image: string }[];  // 2 half cards, static
  links: { id: string; label: string; icon: string }[];     // 계좌 개설 / 토스쇼핑 / 체크카드 혜택 추천 (+ invented)
}
```

- Money values are integers in 원. Format with `toLocaleString("ko-KR") + "원"`.
- `spend.total`: same idea as kakao's `monthlyCardSpend`. Use the sum of withdrawals this calendar month that are card/pay tagged, with a 🔔 override in `profile.card_spend`. The 소비 builder must use the same number.
- `{M}` = current month (server `nowIso()`).
- "N개월 전" = whole months between `lastUsedAt` and now.

**Reused endpoints:**
- `GET /api/accounts/:id` and `/transactions` (통장)
- `POST /api/transfers` (transfer flow)
- `PATCH /api/profile`: extend it with `givenName`, `rewardDismissed`, `adSnoozeUntil`, `cardSpend`, `pointChances`, `youthCardBalance`.

**Ad-page snooze ("3일 동안 안보기").** Store `adSnoozeUntil` (ISO) on the profile, server-side so it is per profile. While `now < adSnoozeUntil`, transfer completion → 확인 goes straight back.

**Seed (invented, all fictional).**
- Profile 홍길동, given name 길동, reward max 50,000원.
- 토스뱅크 통장 balance 1,250,000원, number in Toss Bank format `1000-XXXX-XXXX` (12 digits, invented).
- 토스머니 3,200원. 포인트 3번.
- 토스유스카드 15,000원, last used 2 months ago.
- 최근 본 상품: "바삭 감자칩 오리지널 3봉" + an invented snack thumbnail.
- 방문한 서비스: "토스쇼핑" with the coral bag icon.

**🔔 bell** = the shared 관리 패널 (as in the other apps). Show the red dot when `hasUnread`, or always, as in the video.

---

## 5. Not visible in the videos: invented defaults
- **Scrolling.** The home is never scrolled.
  - Header stays sticky on `#100f12`. Invented: when scrolled > 4 dp, add a 0.8 dp `#252427` bottom hairline.
  - The tab bar is fixed.
  - Pull-to-refresh: none.
- **Content below the list card.** One more card (top ≈1070), e.g. a list card with 2 rows **내 신용점수 보기** and **자산 추가하기** (icons: green gauge, blue "+").
  - Then the footer text **화면 편집하기** (13 dp M `#97979c`, centred, 40 dp tall).
  - Then bottom padding 12 + 73.3.
- **Taps not shown in the video:**
  - Header "토스뱅크 ›" → same as the 토스뱅크 통장 row (toast + 통장).
  - Pay → toast-style snackbar "준비 중이에요" (`#1f1e21` pill, 2 s).
  - 송금 on row 1 → transfer "어디로 보낼까요?" via the same push + toast "토스뱅크로 이동했어요".
  - 송금 / 받기 / 충전 on rows 2–3 and 토스머니 / 포인트 / 유스카드 rows, card-3 rows, half cards, list rows, ad card, 혜택 / 쇼핑 / 증권 tabs → press feedback + "준비 중이에요".
  - 내역 → 소비 (same as the row).
  - 전체 tab → 전체 메뉴 (other spec). Tab switch: instant, no transition.
- **Banner ×:** collapse the slot (reverse of §3.6: banner fades 120 ms, slot 80.9→0 in ~300 ms) and set `rewardDismissed` for the month. Banner **확인하기** → "준비 중이에요".
- **Ad-page buttons:** 쿠폰 받기 / 확인하기 → snackbar "쿠폰을 받았어요" / "준비 중이에요", then dismiss as 3일 동안 안보기 / 닫기 do (without snoozing).
- **Which ad after which transfer:** own-account transfer (옮겼어요) → coupon page. Send to another person (보냈어요) → "30일" page. Respect the snooze.
- **Lock screen:** off by default.
- **Status-bar clock:** device-like; reuse the existing status bar logic.

---

## 6. Personal data seen (do not copy, replace with seed)

| Role | Placeholder | Format only | Where |
|---|---|---|---|
| Recorder's given name | `<NAME_GIVEN>` | 2 Hangul syllables + "님의" | Reward banner (A 10.1–13.6, B 137.8–152) |
| Reward max amount | `<PROMO_AMOUNT>` | 5-digit 원 "NN,NNN원" | Banner line 2 |
| 토스뱅크 통장 balance | `<BAL_TOSSBANK>` | 1–2 digit 원 (changes between A and B) | Card 1 row 1, 통장 page |
| 토스머니 balance | `<BAL_TOSSMONEY>` | 1 digit 원 | Card 1 row 2 |
| Point chances | `<POINT_CHANCES>` | 1 digit "N번" | Card 1 row 3 |
| This-month spending | `<SPEND_MONTH>` | 6-digit "NNN,NNN원" (two values: before/after 소비 visit) | Card 2 row 1 |
| Youth-card balance + last use | `<YOUTH_CARD_BAL>`, `<N>개월 전` | 5-digit "NN,NNN원"; 1-digit months | Card 2 row 2 |
| Recently viewed product + photo | `<RECENT_PRODUCT>` | Brand + product name, truncated | Card 3 row 1 (**don't crop the thumbnail**) |
| Visited service | `<VISITED_SERVICE>` | One word | Card 3 row 2 |
| Ad-disclosure lawyer name (third party) | `<AD_LAWYER_NAME>` | 3 Hangul syllables | Ad card line 3 (B 137.8–138) |
| 토스뱅크 account number | `<ACCT_TOSSBANK>` | 12 digits, 4-4-4 grouping | 통장 page header (A 18.9+, B 76–79, 130) |
| Counterparty name on 보냈어요 page | `<NAME_CPTY>` | 3 syllables + "님에게" | B 119.5 (adjacent, other spec) |
| Other-app heads-up notifications | n/a | Deposit amount, a name, a balance, a timestamp | B 76.2–79.1 (do not clone) |
| Installed apps (launcher) | n/a | n/a | A 0–0.4 (do not clone) |

UI labels, product names (토스뱅크 통장, 토스머니, 토스유스카드), ad copy and brand marks above are fine to reproduce.

---

## 7. Asset crop list
Crops are verified in `scratchpad/toss/frames/home/crops/`; boxes are in px@480 on the given frame. Every crop is low-res (1.25 px/dp, so a 36 dp thumbnail is only 45 px). Prefer SVG where marked. Upscale crops ×2–4 (as in the ibk Real-ESRGAN pipeline) or redraw them.

| Asset | Source frame | Box (x0,y0,x1,y1) | Use | Privacy |
|---|---|---|---|---|
| Toss logo, blue 3-D (splash, toast, account icon) | A 3.750 | 156,454,324,610 (key out bg `#171619`) | splash 124.8×115.2 dp; scale down for toast/icon | OK: public brand mark |
| Grey header logo | A 10.698 | 28,54,62,84 | Header | OK (or tint the blue mark grey in CSS) |
| Account icon (navy squircle + logo) | A 10.698 | 38,231,80,273 | Prefer composing squircle `#22375c` + logo | OK |
| Points icon | A 10.698 | 38,363,80,405 | **SVG preferred** (circle + "P") | OK |
| Banner Face-ID icon | A 10.698 | 46,140,84,176 | **SVG** | OK |
| Pay icon / bell | A 10.698 | 348,50,400,86 / 416,44,458,86 | **SVG** | OK |
| 방문한 서비스 ticket icon | A 10.698 | 360,733,412,785 | **SVG** preferred | OK (generic icon) |
| 오늘의 딜 teal mark | A 10.698 | 360,817,412,869 | Crop or SVG | OK (public service mark) |
| Half-card illustrations | B 136.113 | left 140,662,226,734; right 380,662,452,734 | Bottom-right of the half cards (bg = card + glow; key out) | OK: generic 3-D art |
| List icons 계좌 개설 / 토스쇼핑 / 체크카드 혜택 추천 | B 136.113 | 38,766,74,800 / 38,826,74,860 / 38,888,74,924 | Or SVG | OK |
| Calendar Lottie frames ("+", "₩", flip) | B 128.650 / 129.251 / 127.990 | 176,232,338,406 (final layout) | Ad page loop | OK: generic illustration; the heads-up pill is outside the box |
| Coupon "5000" image | B 74.942 | 28,638,104,684 | Coupon page | OK: generic ad art |
| Recent-product photo | A 10.698 | 362,666,410,716 | **Do not crop**: personal browsing data. Invent. | NOT OK |
| Ad advertiser logo | A 10.698 | 398,934,446,976 | **Do not crop**: third-party brand. Invent. | NOT OK |
| Tab icons | A 10.698 | 0,975,480,1066 | Reference only, **draw in SVG** | OK |
