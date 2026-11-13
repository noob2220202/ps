# toss — 이체 flow spec (어디로 보낼까요 → 계좌번호 → 은행 선택 → 금액 → 확인 → 메모 → 보내는 중 → 완료)

Area owner: transfer. Sources: two Galaxy dark-mode recordings, 480×1066 px, VFR. All times are real `pts_time` (s).
- **A** = `591c4ee0-…_175407_Toss.mp4` (132.37 s). **B** = `68897750-…_175809_Toss.mp4` (174.59 s).

**Geometry** (same as infra.md §1): 384 × 853.33 dp, **1.25 px/dp** (`dp = px/1.25`). Status bar 0–28, app viewport 28–838.33, nav band 838.33–853.33.
All dp below are screen coordinates (0 = top of status bar). Text boxes are **ink** boxes measured at the half-intensity crossing (±0.3 dp). "row top/bottom" values are layout boxes inferred from ink + pressed highlights.

**Font.** Pretendard (global). Sizes are Pretendard sizes **fitted to measured ink width** (same convention as home.md), with the likely Toss nominal size in brackets.
Weights come from ink-coverage fitting. Toss "bold" measures ≈ Pretendard **650** on every bold text here (title, row titles, section headers). Use **600 (SB)** to match home.md, or 650 if Pretendard Variable is used directly. "B" below = 650–700, "SB" = 600, "M" = 500, "R" = 400.

**Privacy.** No values from the recordings appear in this file: names, account numbers, balances, amounts, the typed number, the memo text and the clipboard amount are all placeholders (§6). Bank, product and UI labels are recorded verbatim.
Scratch evidence: `scratchpad/toss/frames/transfer/` (frames, `s_*.png` sheets). Tools: `scratchpad/toss/tools/transfer/` (`fr.py` frame by pts, `meas.py` ink+fit, `tm.py`/`tm2.py` template tracking, `track.py` patch/edge tracking).

---

## 0. Key findings (read first)

1. **Two verbs, one flow.** If the destination is **one of my accounts**, all copy uses 옮기다: "얼마나 옮길까요?", "…으로 N원을 옮길까요?", **옮기기**, "옮길게요", "옮겼어요", and the done screen has a single **확인**.
   For anyone else it uses 보내다: "얼마나 보낼까요?", "<NAME>님에게 N원을 보낼까요?", **보내기**, "보낼게요", "보냈어요", and the done screen has **공유하기 + 확인**. Footer is always "평생 수수료 무료".
2. **Four motion families** (all measured, §3.1). **PUSH**: new page from +≈160 dp, easeOutExpo ≈450 ms; old page fades out in 80 ms while drifting up 12 dp.
   **POP**: old page slides down 40 dp in ≈120 ms (ease-in, no fade) and is cut; revealed page settles from −6 dp in ≈150 ms.
   **REPLACE** (금액→확인, 확인→보내는 중→완료): instant. **SHEET / DIALOG**: scrim plus a short fade+slide.
   **The whole page moves, including its header** (they are web pages). The status bar never moves.
3. **Recent list includes my own accounts** ("내 영하나플러스 통장" etc.), so the server `recent` filter must be gated for toss (infra §2.2). "내 계좌 +N개" = my accounts except the sending one.
4. **Bank list icons are squircles** (40 dp, radius ≈14), not the repo's circular `bank-<code>.png`. The 은행 선택 grid and suggestion chips use **glyph-only** logos. They match the existing `hana-bank-<code>.png` style, and all 61 codes are present.
5. **Keyboards.** The number keyboard is exactly `src/hana/HanaKeyboard.tsx` (same device and geometry, top at 494.7 dp). The **Korean keyboard** for the memo is new (§2.8.1), with the same outer frame.
   The amount keypad is Toss's own in-page keypad (no keyboard).
6. **Not cloneable / do not copy:** the **black frames B 112.13–113.92** (FLAG_SECURE auth prompt after 보내기), and the WebView glitch frames B 31.84–31.95 (a grey card flashes at the top before the sheet).
   Also the 2.2 s blank-spinner network waits (A 112.66–114.83, A 121.7–124.9, B 93.4–95.4): keep a short spinner/skeleton only.
7. **Validation is client-side:** amount > balance → red "출금할 수 있는 돈이 {잔액}원이에요." and a disabled 다음. A wrong account number is only reported **after 다음** on the amount screen, by the dialog "계좌번호를 찾을 수 없어요" (server 404 from lookup).

---

## 1. Screen / state inventory

| # | Screen / state | Video | pts (s) | Notes |
|---|---|---|---|---|
| L0 | Loading page (blank `#171619` + centre spinner) after 보내기 on 통장 / 거래내역 | A | 112.662–114.830 | 2.17 s network wait. Spinner ⌀≈30 dp at (192, 433) |
| L0 | same | B | 83.340–84.000 | 0.66 s |
| S1 | **어디로 보낼까요?** PUSH in | A | 114.830–115.172 | list empty until data |
| S1 | list (내 계좌 / 최근 보낸 계좌) fades in | A | 115.24–115.28 (icons to 115.33) | no skeleton |
| S1 | idle (collapsed 내 계좌 "+4개") | A | 115.28–117.62 | |
| S1 | 내 계좌 row pressed → expand | A | press 117.62; height 117.64–117.85; rows fade 117.93–118.03 | |
| S1 | expanded (hint + 4 own rows) | A | 118.03–118.87 | |
| S1 | collapse | A | rows fade 118.87–118.97; height 119.03–119.24 | |
| S1 | recent row "내 영하나플러스 통장" tapped → PUSH out | A | 121.55–121.70 | to S4 (own) |
| S1 | entered by POP-style reveal from 통장 (recording starts mid-flow) | B | 7.182–7.433 | |
| S1 | idle; tap 계좌번호 입력 box | B | 7.43–9.94 | → S2 (PUSH) |
| S1 | PUSH in again after 통장 보내기 | B | 84.00–84.32 | |
| S1 | scroll down/up; pressed highlights cancelled by scroll | B | 86.53–90.52 (highlights 86.6, 87.9) | title + tabs sticky |
| S1 | recent row (a person) pressed → PUSH out | B | press 93.07; out 93.30–93.37 | → S4 (person) |
| S2 | **어떤 계좌로 보낼까요?** PUSH in, field focused | B | 9.936–10.321 | caret visible at once |
| S2 | Samsung number keyboard slides up | B | 10.81–10.99 | |
| S2 | 1–6 digits: hint + own-account pill "내 하나은행 <ACCT_HANA> 입력" | B | 13.16–15.0, 21.59–26.86 | |
| S2 | ≥7 digits while typing: "··· 은행을 찾는 중이에요" | B | 15.10–16.17 and after each key | |
| S2 | bank chips (3) fade in after a ~0.35 s typing pause | B | 16.18–16.53, 17.43, 17.88, 19.19, 20.32, 21.11, 28.27, 29.11 | |
| S2 | chip "하나" tapped → bank 하나은행, **확인** above keyboard | B | 29.936 | |
| S2 | 은행 선택 field tapped → keyboard down, scrim in | B | 31.21; kb 31.33–31.47; scrim 31.35–31.58 | |
| S3 | **은행을 선택해주세요** sheet in | B | 32.004–32.104 | glitch frames 31.84–31.95 not cloned |
| S3 | sheet scrolled to the end (banks → 증권사), overscroll bounce | B | 32.49–36.12 (bounce 36.0–36.45) | |
| S3 | sheet closed without a choice | B | 36.83–36.93 | |
| S2 | keyboard hidden, **확인** at bottom; press-cancel ripple | B | 36.93–39.6 (ripple 37.55–37.82) | |
| S2 | 확인 → PUSH to S4 | B | press 39.62; 39.60–39.99 | |
| S4 | **토스뱅크 송금** (typed account, unresolved): blank + ← | B | 39.70–40.03; title fades in 40.03–40.29 | |
| S4 | centre spinner → faint skeleton → content | B | 40.30; ≈43.0; 44.55 | |
| S4 | "잔액 로딩중" / "사기계좌 조회중", placeholder 얼마나 보낼까요?, paste chip | B | 44.55; chip 44.81 | |
| S4 | balance loaded; to-sub gets shield + number | B | 45.03; ≈47.0 | |
| S4 | bare "원" (amount 0) | B | 47.56–48.11 | |
| S4 | digit + **다음** bar | B | 48.13–48.18 | |
| S4 | 다음 → dots | B | 49.28–49.72 | |
| D1 | dialog **계좌번호를 찾을 수 없어요** | B | in 49.72–49.88; 확인 51.28; out 51.27–51.40 | |
| S4→S2 | ← back (POP) | B | 54.40–54.66 | |
| S2 | tap in field (caret moved) → keyboard up; ⌫ inside the number; 확인 | B | 55.9–56.2; 57.25; 58.96 | |
| S4 | own account by number: "내 영하나플러스 통장으로 / 얼마나 옮길까요?" | B | push 59.07–59.4; content 60.96; balance 61.21; "내 " prefix 62.0 | |
| S4 | "원" → digit + 다음 → (tap 다음) | B | 62.76; 62.86; ≈63.5 | |
| S5 | **…으로 N원을 옮길까요?** (REPLACE) | B | 63.660; chevrons 63.711 | |
| S5 | 옮기기 pressed → dots | B | 66.15; dots 66.27–66.69 | |
| S7 | **옮길게요** (sending lottie) | B | 66.708–68.108 (coin 66.877) | |
| S8 | **옮겼어요** done (+ 메모 남기기, 확인) | B | 68.108; check lottie 68.30–68.95 | |
| S8 | 확인 pressed → POP down → ad pages (home.md #21–24) | B | 69.61; 70.44–70.58 | |
| S4 | person via recent: blank + ← → skeleton → content | B | push 93.37–93.68; skeleton 95.31; content 95.49–95.71; "내 " + shield 96.21 | |
| S4 | "원" → digit + 다음 → (tap) | B | 96.61; 97.21; 97.41 | |
| S5 | **<NAME_P>님에게 N원을 보낼까요?** | B | 97.43–100.16 | |
| S5 | row 받는 분에게 표시 pressed → PUSH to S6 | B | 100.16; 100.83–101.16 | |
| S6 | **memo page** (토스뱅크 송금 / centred text selected / 완료) | B | 100.83–101.56 | |
| S6 | Korean keyboard up; text moves up | B | 101.56–101.80 | |
| S6 | ⌫ clears selection; typing with key pop-ups | B | 102.2; 103.44–104.14 | |
| S6 | keyboard down (∨) | B | 104.81–105.0 | |
| S6 | 완료 pressed → POP to S5 (row shows new memo) | B | 108.02; 108.06–108.34 | |
| S5 | 보내기 pressed → label fades → dots | B | 109.76; 109.90; dots 110.0–112.13 | |
| — | **black** (auth prompt, FLAG_SECURE) — not cloned | B | 112.13–113.92 | |
| S5 | dots again | B | 113.94–115.54 | |
| S7 | **보낼게요** sending | B | 115.556–117.10 (coin 115.80) | |
| S8 | **보냈어요** done (+ 메모 남기기, 공유하기 / 확인) | B | 117.10; check lottie 117.30–117.95 | |
| S8 | 확인 → PUSH blank pages → ad (home.md #25–29) → 통장 | B | 120.32 → 129.73 | |
| S4 | own account via recent (A): blank+← / title / content / chip / balance + "내 " | A | 121.70; 122.2; 124.87; 125.0; 125.75 | |
| S4 | digit → **error** "출금할 수 있는 돈이 {잔액}원이에요." + disabled 다음 | A | 129.55–129.73 | |
| S4 | ← key clears → placeholder, 다음 gone | A | 131.12 (until end 132.37) | |

---

## 2. Screens

### 2.0 Shared parts

**Page.** bg `#171619`, status bar same colour (infra). Every page has a web header in the page: back arrow ink **x 18.4–38.4, y 45.6–64.0** (20×18.4, stroke ≈2 dp, round caps, `#fdfcff`).
App bar box = 28–81.6 (53.6 tall); hit area ≈48×48 centred on the arrow. Draw the arrow in SVG.
**App-bar title** (S4, S5, S7, S8): "토스뱅크 송금", ink x 72.5–161.4, y 47.0–62.3, **16.5 SB [17]**, `#fcfbfe`. S1/S2 have no title. S6 has **완료** on the right and a large title in the body.

**Colour tokens (sampled)**
| token | hex | use |
|---|---|---|
| bg | `#171619` | page, status bar |
| title | `#f4f3f6` / `#fffeff` | page titles, amount, done text |
| text | `#dddcdf` | list titles, section headers, input digits |
| value | `#c1c0c5` | confirm row values |
| placeholder-strong | `#b6b5b8` | "은행 선택" placeholder |
| text-2 | `#9c9ba0` / `#9f9ea3` | particles "에서/로", 잔액 line |
| sub | `#838285` / `#7e7d80` | row subs, hints |
| label | `#7d7b82` | confirm row labels |
| placeholder | `#6d6c6f` | 계좌번호 입력 (box) |
| faint | `#58575a` | 별표 hint; loading text `#56555c` |
| box | `#1f1e21` | input box, sheet card |
| tile | `#28272a` | bank grid tile |
| chip | `#2b2a2d` | bank suggestion chip |
| pill | `#27282d` | own-account suggestion pill |
| surface-2 | `#2a2a34` | paste chip, 메모 남기기 chip, dialog card |
| hairline | `#272629` | under tabs (1 px) |
| underline | `#4194fa` focused (2.4 dp) / `#2c2b2e` idle (1.6 dp) | text fields |
| press | `#201f22` (≈ white 4 %) / `#211f27` | row pressed |
| blue | `#3182f6` (sampled `#2f80f5`) | CTA, focus, caret, check |
| blue-pressed | `#225eb5` | CTA pressed (≈ black 27 % over blue) |
| blue-disabled | `#1f355e` bg, `#4e5c79` text | 다음 disabled |
| blue-secondary | `#18294a` bg, `#4690f6` text | 공유하기 |
| red | sampled `#e2414f` (use TDS `#f04452`) | amount error |
| star-off | `#413f42` | ★ not favourite |
| scrim | `rgba(0,0,0,.61)` | sheet (whole window); dialog (web area only) |
| selection | `rgba(49,130,246,.38)` | memo text selection |
| spinner | `#b5b6bb` | loading spinner |

**Primary CTA** (확인 / 옮기기 / 보내기): x **20–364.2** (344.2 wide), height **56.2**, radius **14.4**, `#3182f6`. Label **17 SB [17]** `#f3feff`, centred.
Bottom-docked position: y 761.5–817.7 (20.6 above content bottom) on S2, or 723.1–779.3 on S5 (the caption sits below it).
**Pressed:** a darker ripple grows from the touch point to the full button in ≈100 ms (to `#225eb5`) and the button scales ≈0.995 (−0.8 dp per side). Release fades back in ≈150 ms (B 37.55–37.82).
**Loading** (after tap): label fades out (≈100 ms), then **3 dots** ⌀≈6.4 dp at centres x 177.6 / 192.8 / 207.2 (15 dp pitch), vertically centred.
Each dot pulses opacity 0.3→1 and scale ≈0.75→1, in order 1→2→3 with ≈0.2 s stagger, ≈0.75 s cycle. Bright dot `#f3f3f5`, dim ≈ white 25 % over blue.
A radial darker centre is visible while loading (pressed overlay stays).

**Full-bleed bar CTA** (다음 on S4): y **518.0–574.0** (56), x 0–384, radius 0. Enabled `#3182f6` / text `#f3feff` 17 M. Disabled `#1f355e` / text `#4e5c79`.

**Loading spinner**: grey `#b5b6bb` indeterminate arc (Material-like, growing/shrinking arc, ≈1 s rotation), ⌀≈30 dp, stroke ≈2.5 dp, centred at (192, 433).

### 2.1 S1 — 어디로 보낼까요?  (ref frames B 8.500 = idx 254; A 118.056 = idx 3824 expanded; B 88.750 = idx 3446 scrolled)

Top → bottom (dp):
1. **App bar**: ← only.
2. **Title** "어디로 보낼까요?": ink x 24.9–211.7, y 115.7–140.8, **27.8 B [28]**, `#f4f3f6`.
3. **Tabs** 계좌 / 연락처 / 해외: ink y 179.2–194.3, **16.7 SB [17]**. Ink x 계좌 38.2–66.5, 연락처 97.2–138.3, 해외 169.8–197.1 (centres 52.4 / 117.8 / 183.4).
   Selected `#dedde0`, others `#8b8a8d`. Indicator: x 32.0–72.8 (text ±5.6), y 209.7–212.1 (2.4 dp), `#dfdee1`. Full-width hairline 1 px at y 211.3 `#272629` (the indicator sits on it).
   **Sticky:** 28 → 212.1 (app bar + title + tabs) stays fixed. Everything below scrolls under it and is clipped at 212.1.
4. **Account-number box** (a button that opens S2): x 24–360, y 235.8–292.2 (56.4), radius 12, `#1f1e21`.
   Placeholder "계좌번호 입력" ink x 40.8–128.0, y 257.1–272.3, **16.4 M [16]**, `#6d6c6f`.
   Camera icon (filled body + lens cut-out) ink x 320.8–342.4, y 253.6–273.6, `#525154` (SVG).
5. **내 계좌 row** (pressable, full width): box y 308.2–357.8 (49.6). Pressed bg `#201f22` (A 117.71).
   "내 계좌" ink x 25.0–70.4, y 329.5–344.7, **16.5 SB [17]** `#dddcdf`.
   Right: "+N개" ink x 313.9–342.6, y 330.8–343.9, **14.6 R [15]** `#878689`, then a chevron ∨ 11.2×6.4 at x 350.4–361.6, y 333.8–340.2 (stroke 1.6, `#7e7d80`).
   Expanded: label "N개" (no +; ink x 322.3–342.6) and chevron ∧ (rotates 180°, passing through ">" at 117.71).
6. **Expanded block** (A 118.06), inserted between 내 계좌 and 최근 보낸 계좌:
   - hint "별표를 눌러 즐겨찾기 해보세요." ink x 24.8–179.6, y 361.5–373.0, **12.8 R [13]** `#58575a`.
   - N own-account rows (68 dp each) from y 378. First icon at 392.
     Rows here: 토스머니 (Toss mark on dark-navy squircle, sub "토스머니"), 자립예탁금 (sub "NH농협 <ACCT_NH_RAW>", **no hyphens**), 입출금통장 (sub "카카오뱅크 <ACCT_KAKAO>"), 영하나플러스 통장 (sub "하나 <ACCT_HANA>").
7. **"최근 보낸 계좌"** header: ink x 24.8–116.8, y 379.1–394.4 (collapsed; +292.8 when expanded with 4 rows), **16.4 SB [17]** `#dedde0`. Header box ≈ 357.8–407.6.
8. **Recipient rows**, 68 dp pitch from y 407.6 (row 1 = 407.6–475.6):
   - icon **squircle 40×40**, x 24–64, top = row top + 14, radius ≈14 (fit 14.0–14.4).
   - title ink x 79.3, y = row top + 16.2 … +31.6 (e.g. 423.8–439.2), **16.5 SB [17]** `#dddcdf`.
     Own account: "내 {account name}". Others: holder name.
   - sub ink y = row top + 38.8 … +51.7, **14.5 R [15]** `#838285`, "{toss short bank} {formatted number}".
     Toss shorts seen: 하나, 지역농협, NH농협, 우리, KB국민, 카카오뱅크, IBK기업.
   - ★ 20×20 at x 337.6–357.6, vertically centred, off `#413f42`. On colour is not seen (§5).
   - **Pressed:** the row content scales to **0.96** (transform-origin centre: icon x 24→30.4, ★ 357.6→351.2) and gets a rounded bg (radius ≈12, `#1b1a1d`→`#211f27` while fading in).
     Navigation fires on release (≈0.23 s hold in B 93.07→93.30). If a scroll starts, the press is cancelled (B 86.6, 87.9).
   - Recent list length in B ≈15 rows. Own accounts are mixed in by recency (3 of them in the recording).
9. Scroll: the list scrolls the whole region below the sticky header (box, 내 계좌, list). Android overscroll at the ends. Bottom padding not visible; use 24 dp (invented).

### 2.2 S2 — 어떤 계좌로 보낼까요?  (ref B 11.111 idx 319 empty+kb; 16.679 idx 458 chips; 14.678 idx 377 pill; 29.936 idx 879 bank set; 36.981 idx 1152 kb hidden)

1. **App bar**: ← only.
2. **Title** "어떤 계좌로 보낼까요?": ink x 24.8–249.0, y 115.2–138.4, **25.8 B [26]** `#fffeff`. Smaller than S1's title.
3. **Number field** (auto-focused):
   - label "계좌번호 입력" ink x 25.0–92.6, y 165.5–176.9, **12.7 M [13]**. Blue `#3182f6` when focused (looks `#215fb3` because the text is small), `#9e9fa3` when not focused.
   - value: digits only, no hyphens, ink y 192.7–209.1 (digit cap height 16.4 → **22 R [22]**), `#dddcdf`, x from 24.9.
     Caret: 2 dp blue, ink ≈186–217, blinking. Tapping inside moves the caret and shows an Android selection handle (blue teardrop) for ≈1 s (B 55.9).
   - clear ⓧ ⌀19.2 at x 326.4–345.6, y 190.4–209.6 (`#403f42` disc, dark ×), shown when the field has text.
   - underline x 24–360: focused **2.4 dp `#4194fa`** at y 221.7–224.1 (with value; 217.7–219.3 when empty: the field is ≈4 dp shorter while empty). Not focused: 1.6 dp `#2c2b2e`.
4. **Bank field** (tap → S3):
   - empty: placeholder "은행 선택" ink x 24.8–101.2, y 269.6–288.8, **21.3 R [22]** `#b6b5b8`. Chevron ∨ 12.8×7.2 at x 341.6–354.4, y 275.2–282.4, `#6d6c6f`. Underline 1.6 dp at y 298.4.
   - with a value (positions with the number field filled): small label "은행 선택" ink y 249.6–261.6 (12.7, `#9f9ea1`); value e.g. "하나은행" (full `bank.name`) ink y 273.6–293.6, **21.3 R** `#dcdbde`. Underline y 302.4–304.8 (blue while the sheet is open).
     The placeholder cross-fades into label + value (B 29.936, one frame).
5. **Under the bank field** (one slot):
   - 0 digits or 1–6 digits: hint "계좌번호를 입력하면 은행을 찾아드릴게요." ink x 24.7–235.6, y 308.0–319.7, **12.8 R [13]** `#7e7d80`.
   - ≥7 digits while typing: "··· 은행을 찾는 중이에요". 3 animated dots at x 24–39.2 (y 316–320.8) + text from x 44.8, ink y 312.3–321.6, 12.8 R `#7e7d80`.
   - ≥7 digits and idle ≈0.35 s (measured 0.28–0.42 s): **3 bank chips** replace it, fading in over ≈350 ms (B 16.18→16.53).
     Chips: y 312.3–351.2 (38.9 tall), gap 9.4, radius ≈6–7, `#2b2a2d`. Content: padding-left 12.9, glyph logo 12.8×12.8, gap 6.4, label **14.8 M [15]** `#b4b5b8`, padding-right 12.8.
     Labels are the S3 grid labels (e.g. 대신, 광주, KB증권 / iM뱅크(대구), 한국투자, NH농협 / 새마을, 하나, 씨티). The next keystroke removes the chips at once.
6. **Own-account pill** (only for 1–6 digits that prefix-match one of my accounts; B 13.16–15.0, 21.59–26.86): centred, x 71.9–312.5 (width = content), y 440.7–478.6 (38), radius ≈8, `#27282d`.
   Text "내 {bank.name} {digits} 입력" (digits unhyphenated), **13.1 M [13]** `#b5b9c0`. Sits 16 dp above the keyboard top (494.7). Hidden at ≥7 digits.
7. **확인** (shown once a bank is chosen and the number is non-empty): with the keyboard up, y 418.3–474.6 (20 above the keyboard). With the keyboard down, y 761.5–817.7.
   The button jumps; it does not animate with the keyboard (B 31.43).
8. **Keyboard**: Samsung number keyboard = `HanaKeyboard` (toolbar top 494.7 = video y 618; rows 1 2 3 ⌫ / 4 5 6 완료 / 7 8 9 .- / ·0·, ; band `#090909`, handle `#616161`). Pressed key `#3d3d3d` vs `#2b2b2b`.
   Slide up ≈180 ms decelerating (B 10.81→10.99), starting ≈0.5 s after the PUSH settles (0.87 s after the tap). Slide down ≈150 ms (31.33→31.47). 완료 / ∨ hide it.

### 2.3 S3 — 은행 선택 bottom sheet  (ref B 32.202 idx 942; scroll 34.300–35.503)

- **Scrim** over the whole window, status bar and band included: `#171619`→`#09080b` (black 0.61). Band `#050407`, handle `#5e5d60` (infra §1.3).
- **Card** (floating): x 11.2–372.8 (361.6), top 169.7, bottom ≈828 (10.3 above the band), radius **≈22–24** all corners, `#1f1e21`.
- **Grabber**: x 170.4–212.8 (42.4), y 181.7–185.7 (4), `#363538`, fully round.
- **Title** "은행을 선택해주세요": ink x 40.0–191.6, y 216.0–234.0, **19.0 B [20]** `#fcfbfe`. Header (grabber + title) is fixed. The grid scrolls under it, clipped at ≈256.
- **Grid**: 3 columns, tiles **99 × 85**, x 34.6 / 142.4 / 249.9, gap 8.8 both ways (row pitch 93.7), radius ≈10, `#28272a`. First row top 264.9 at rest.
  Tile content: glyph logo in a 24×24 box, top = tile top + 16, centred. Label ink top = tile top + 54.3, **14.0 M [14]** `#f2f1f4`, centred, wraps to 2 lines ("교보SBI저축은\n행", "카카오페이증\n권").
- **Section** "증권사 선택" after the banks: ink x 36.0–105.7, **15.7 R [16]** `#adacaf`. 37.7 dp from the last bank tile bottom to the text top, 17.6 dp from the text bottom to the next tile.
- **Order (exactly as seen)**. Banks: NH농협, 카카오뱅크, KB국민 / 토스뱅크, 신한, 우리 / IBK기업, 하나, 새마을 / 부산, iM뱅크(대구), 케이뱅크 / 신협, 우체국, SC제일 / 경남, 광주, 수협 / 전북, 저축은행, 제주 / 씨티, KDB산업, 산림조합 / 교보SBI저축은행, BOA, 중국 / HSBC, 중국공상, 도이치 / JP모건, BNP파리바, 중국건설.
  증권사: 토스증권, 카카오페이증권, 미래에셋 / 키움, 한국투자, 신한투자 / 삼성증권, KB증권, NH투자 / 유안타, 대신, IBK투자 / 하나증권, 한화투자, 유진투자 / 아이엠증권, 교보, 메리츠증권 / SK, LS, 현대차증권 / DB증권, 우리투자증권, 신영 / 다올투자증권, 케이프투자, BNK투자 / 부국, 상상인증권.
- **Code map** (banks.mjs). nh, kakao, kb, toss, shinhan, woori, ibk, hana, mg, busan, im, kbank, shinhyup, post, sc, kn, kj, suhyup, jb, savings, jeju, citi, kdb, nfcf, **(교보SBI저축은행: no code)**, boa, boc, hsbc, icbc, deutsche, jpm, bnp, ccb.
  tosssec, kakaopaysec, mirae, kiwoom, kis, shinhansec, samsung, kbsec, nhsec, yuanta, daishin, ibksec, hanasec, hanwha, eugene, imsec, kyobo, meritz, sks, ls, hmsec, dbsec, wooriinv, shinyoung, daol, cape, bnksec, bookook, sangsangin.
  Put the toss labels and order in `src/toss/bank.ts` (infra §2.4). Logos: `localAsset("hana-bank-<code>")` glyphs (all present), fallback = BankIcon.
- No selected-state styling is visible. Tile press → choose + close (§5).

### 2.4 S4 — 토스뱅크 송금 (amount)  (ref B 45.030 idx 1509; 48.212 idx 1685; A 130.500 idx 4402 error)

1. **App bar**: ← + "토스뱅크 송금".
2. **From line**: ink y 105.2–125.2, x 24.7. "{내 }{from label}" **21.9 B [22]** `#fdfdff` + "에서" 21.8 R `#9c9ba0`. "내 " is added once the recipient check finishes (B 62.0 / 96.21 / A 125.75).
3. **Balance line**: "잔액 {balance}원" ink x 25.0–89.8, y 143.4–155.7, **14.8 R [15]**, `#9f9ea3` (number part slightly lighter, `#b9b8bd`).
   Loading: "잔액 로딩중" inside a faint rounded skeleton chip (x ≈36–200, text from x 44.6, ≈12 dp, `#56555c`).
4. **To line**: ink y 199.0–218.5 (22 B + particle R).
   - own account: "내 {account name}" bold `#fdfdff` + "으로/로" `#9c9ba0`.
   - person: "{holder}" bold `#fdfdff` + "님에게" R grey.
   - unresolved (typed number not found): "{bank.name} 계좌" bold **grey `#9e9ca2`** + "로".
5. **To sub**: ink y 234.3–247.2, **14.5 R [14–15]** `#7c7a81`.
   - person / typed: shield 12.8×15.2 at x 25.6–38.4 (y 233.6–248.8, `#2e7ff4`, solid, SVG), then "{toss full bank} {number}" from x 44.5.
     The number is hyphen-formatted for a known payee ("지역농축협 …") and raw digits for a typed one.
   - own account: no shield, text at x 24.7 "{bank.name} {formatted}".
   - loading: "사기계좌 조회중" in a faint skeleton chip (same style as 잔액 로딩중).
6. **Amount**: value "{n}원" ink y 294.4–320.2, **31 B [30–32]** `#fdfcff`, x 25.6.
   Placeholder "얼마나 보낼까요?" / "얼마나 옮길까요?" ink y 288.0–316.8, **30.1 M [30]** `#727078`, with the blue caret at x 24 (≈29 dp tall, blinking) in front.
   A bare **"원"** (no digits) is shown when 0 / 00 is pressed on an empty amount (B 47.56, 62.76, 96.61).
7. **Slot under the amount** (one at a time):
   - paste chip "{clipboard amount}원 붙여넣기" (only while the amount is empty and the clipboard holds a number): x 24–(content), y 333.0–356.4 (≈24), radius ≈6, `#2a2a34`, text **13 M** `#bab9c1`, padding ≈8. Fades in ≈250 ms after the content appears (B 44.55→44.81).
     Not shown again after clearing (A 131.12).
   - error "출금할 수 있는 돈이 {balance}원이에요." ink x 24.6–204.0, y 342.2–355.6, **14.8 SB [15]**, red. It appears in the same frame as the digit.
8. **다음 bar**: y 518.0–574.0 (§2.0). Appears when amount > 0, sliding up from behind the keypad in ≈130 ms (A 129.60→129.73: top 560→520). Disabled when amount > balance. Gone at 0.
9. **Keypad** (in-page): y 574.3–838.3, 4 rows × **66**, 3 columns × **121.2** from x 10.2 (centres 70.8 / 192.0 / 313.2). Keys: 1–9 / **00** 0 **←**.
   Digits **30 R [28–30]** `#c2c1c6` (ink cap height ≈22.5). ← is an arrow glyph 20×17.6 (SVG). **No visible pressed state.** Background = page.
- Digit entry animation: the new digit fades in (≈150 ms) while dropping ≈4–5 dp into place. "원" slides right to make room (A 129.585–129.70).

### 2.5 D1 — dialog "계좌번호를 찾을 수 없어요"  (ref B 51.012 idx 1839)
- Scrim on the **web area only** (81.6–838.3, keypad and 다음 included), black 0.61. App bar and status bar stay undimmed.
- Card x 32.1–351.8 (319.7), y 361.6–504.0 (142.4), radius **≈24**, `#2a2a34`, padding-left 22.4.
- Title "계좌번호를 찾을 수 없어요" ink x 54.5–256.1, y 387.2–405.3, **19.8 B [20]** `#e2e1e7`.
- Body "돈을 보내려는 계좌번호를 다시 확인해주세요." ink x 54.7–315.2, y 422.4–435.3, **14.8 M [15]** `#9796a0`.
- Action "확인" (text button, right) ink x 295.1–322.7, y 463.3–478.4, **17 B** `#317ceb`. Pressed: rounded highlight `#292731` behind the text (B 51.28).
- In: fade + slight scale, ≈160 ms (49.72→49.88). Out: ≈130 ms, starting on release (51.27→51.40). After closing the user stays on S4.

### 2.6 S5 — confirm (옮길까요 / 보낼까요)  (ref B 63.727 idx 2446; 97.514 idx 3791)
1. App bar: ← + 토스뱅크 송금.
2. **Title block**, centred, 3 lines, **26.5 B [26]**, line pitch **35.2**. Ink: line 1 y 164.8–189.6, line 2 200.0–223.2, line 3 235.2–258.4.
   Line 1 "{to label}{particle}": label in **blue `#3182f6`** + particle white ("으로" / "님에게"). Line 2 "{n}원을". Line 3 "옮길까요?" / "보낼까요?" (ink x 141.0–243.2).
3. **Info rows** (3), labels left, values right. Row boxes 37.6 tall: 574.0–611.6 / 611.6–649.2 / 649.2–686.8. Label ink tops 586.4 / 624.7 / 662.0.
   - label x 20.9, **14.8 M [15]** `#7d7b82`: 받는 분에게 표시 / 출금 계좌 / 입금 계좌.
   - value right-aligned to x 343.6 + chevron ">" 6.4×10.4 at x 352.8–359.2 (`#b0b6bc`), or to 359.2 when there is no chevron. **14.8 SB [15]** `#c1c0c5`.
     - 받는 분에게 표시 → memoTo (default = my name) + chevron.
     - 출금 계좌 → "내 토스뱅크 통장" + chevron.
     - 입금 계좌 → own: "{bank.name} {formatted}", **no chevron**. Person: shield + "{toss full bank} {formatted}" + chevron.
   - Chevrons appear 50 ms after the screen (63.66→63.71).
   - Pressed row: bg `#211f27`, box x 4–380, radius ≈8 (B 100.16).
4. **CTA** 옮기기 / 보내기: y 723.1–779.3 (§2.0).
5. Caption "평생 수수료 무료": centred, ink x 144.2–239.9, y 799.2–812.2, **14.8 R [15]** `#96959a`.

### 2.7 S6 — 받는 분에게 표시 (memo) page  (ref B 105.761 idx 4129 no kb; 104.140 idx 4092 with kb)
1. App bar: ← left, **완료** right: ink x 331.7–358.6, y 47.1–61.4, **16 M [16]** `#dcdbde`. Pressed: rounded highlight ≈`#2a2a2e` behind it (B 108.02).
2. Large title "토스뱅크 송금": ink x 24.7–139.9, y 112.0–131.7, **21.5 B [22]** `#fdfcff`.
3. **Memo input**: one line, centred horizontally, **24 R [24]** white, blue caret.
   Vertically centred in the free area: without the keyboard ink ≈451–472 (centre 461.4); with the keyboard centre 289.6 (between 81.6 and 494.7).
   On open the current value is **fully selected** (selection `rgba(49,130,246,.38)`, box ≈±6 dp around the text, 35 dp tall). The first key replaces it (B 102.2: ⌫ cleared everything).
   While a Hangul syllable is composing, it is underlined (B 103.63).
4. Caption "한글은 7자, 영문은 14자까지 입력 가능": centred, **13.8 R [14]** `#818083`. Ink 804.8–818.3 without the keyboard, 461.6–475.2 with it (19.5 above the keyboard).
5. Korean keyboard (§2.8.1) starts ≈0.4 s after the page settles and slides up in ≈240 ms (101.56→101.80). Text and caption jump to their keyboard positions. ∨ hides it (104.81→105.0).

#### 2.8.1 Samsung Korean keyboard (new component; same frame as HanaKeyboard)
- Toolbar 494.7–538.5 `#252525` (emoji, gear, search, clipboard, mic, ···; reuse HanaKeyboard icons). Keyboard bg `#090909`. Bottom row ⌨ / ∨ 793–838 and the band as in HanaKeyboard.
- 5 key rows (dp): **number row 546.3–580.8** (34.5 tall); letter rows 591.9–633.7, 645.4–687.3, 698.4–740.1; bottom row 751.2–793.1 (≈41.8 tall, gap ≈11).
- Columns (10-key rows): x 8.5 + i·37.3, key width 31.7: 8.5–40.1, 45.6–77.5, …, 343.8–375.3.
  - Row 1: 1 2 3 4 5 6 7 8 9 0.
  - Row 2: ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ.
  - Row 3 (9 keys, starts at x 27.1): ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ.
  - Row 4: ⇧ (8.5–≈59), ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ (63.9–320.1, pitch 37.3), ⌫ (≈326–375).
  - Row 5: !#1, 한/영, ",", space (134.3–282.1), ".", 완료 (blue text).
- Letter keys `#2c2c2c`, function keys `#161616`–`#1f1f1f`, glyphs white ≈18 dp. Key press shows a pop-up bubble above the key (B 103.44, a larger dark rounded rect with the jamo).
- It needs a small 두벌식 composer (jamo → syllable), or accept physical-keyboard / IME input into a hidden `<input>` and treat the on-screen keys as decorative. Default: both (§5).

### 2.9 S7 — sending (옮길게요 / 보낼게요)  (ref B 115.801 idx 4608)
- App bar unchanged. Rows, CTA and caption disappear in the same frame the title changes (REPLACE).
- Text block centred, **22 B [22]**, pitch 30.8, ink line 1 y 227.2–247.2, line 2 257.6–277.6, line 3 288.8–308.8. Line 1 keeps the blue label. Line 3 "옮길게요" / "보낼게요".
- **Lottie slot** ≈68×68 centred at (191.6, 147): empty for 170–250 ms, then a silver 3-D **"₩" coin** pops in.
  The coin stretches into a comet and flies right with peach sparks, loops back through blue swirl rings and returns to the centre. One loop ≈1.0–1.2 s; it repeats while waiting.
  Recreate in CSS/SVG (§7): silver radial-gradient disc with "₩", stretch/translate keyframes. Not croppable at usable resolution.
- Minimum visible time: 1.40 s (B 66.708→68.108) / 1.55 s (115.556→117.10).

### 2.10 S8 — done (옮겼어요 / 보냈어요)  (ref B 69.609 idx 2793; 118.211 idx 4750)
- Text block at the S7 positions, **all white** (the blue on the label is removed). Line 3 "옮겼어요" / "보냈어요".
- **Check icon**: blue `#3182f6` disc **⌀68.4** centred (191.7, 146.9), white check (stroke ≈5.5–6 dp, round caps, ≈30×22). Arrives through the lottie (§3.3).
- **메모 남기기** chip: x 137.5–246.5 (109), y 334.5–368.9 (34.4), radius ≈12, `#2a2a34`. Text ink x 154.4–228.6, y 344.0–358.6, **16.9 R [16–17]** `#bebcc4`.
- **Bottom CTAs** (y 762.2–818.5, radius ≈13–14):
  - move: single **확인** x 20–364.2.
  - send: **공유하기** x 21.6–191.2 (`#18294a`, label `#4690f6` 17 SB) + **확인** x 200.5–363.5 (`#3182f6`). Widths are slightly unequal as measured (169.6 / 163.0, gap 9.3).
- CTA, chip and text appear together in one frame (68.108 / ≈117.10). The icon slot stays empty for 0.2 s, then the check lottie plays.
- ← in the app bar is still shown (§5).

---

## 3. Interactions and transitions

### 3.1 Motion families (measured with template tracking, `tm.py`)
| family | where | old page | new / revealed page | evidence |
|---|---|---|---|---|
| **PUSH** | S1→S2, confirm→memo, S1 recent→S4, S2 확인→S4, L0→S1 | opacity 1→0 in **70–80 ms** (≈ linear), drifts **0→−12 dp** (ease-in) | **translateY +≈160 dp → 0**, **easeOutExpo ≈450 ms** (cubic-bezier(.16,1,.3,1); measured exponential τ≈70 ms). Opacity 0→1 in the first ≈60 ms. Settled at +0.36 s | B 9.94–10.32 (dy 143→66→32→17→7→0), A 114.83–115.17, B 100.83–101.16, B 93.30–93.68 |
| PUSH, route that mounts later | S2→S4 (B 39.6), S1→S4 | same | the new page is first visible ≈100 ms in (at +40 dp), then follows the same curve | B 39.70 (+39) → 39.99 |
| **POP** | ← from S4, memo 완료→S5, (B 7.18 통장→S1) | **translateY 0→+40 dp, ease-in, ≈120–130 ms, no fade**, then removed | revealed page **−5.6 dp → 0, ease-out ≈150 ms** | B 54.40–54.66 (0.8, 3.2, 16, 25.6, 32, 37.6), B 108.06–108.34, B 7.18–7.43 |
| **REPLACE** | S4→S5, S5→S7, S7→S8 | cut | cut. Late parts (chevrons, lottie) follow 50–250 ms later | B 63.660, 66.708, 68.108 |
| LOAD | 통장/거래내역 보내기 → S1, S4 data | cut to blank `#171619` + spinner | PUSH when ready. Content fades in ≈60–150 ms; skeleton if slow | A 112.66→114.83, B 95.31→95.71 |
| SHEET | S2 bank field | keyboard down (150 ms) → scrim 0→0.61 over **230 ms** (31.35→31.58) | card at +14 dp fades in and settles in **100 ms** (32.00→32.10). Close: card +10 dp + fade, scrim out, **≈100 ms** (36.83→36.93) | §1 |
| DIALOG | S4 다음 (not found) | — | ≈160 ms fade + scale in, ≈130 ms out | B 49.72–49.88, 51.27–51.40 |
| EXPAND | S1 내 계좌 | — | height 0→N·68+20 in **≈200 ms**, then rows fade in **100 ms**. Collapse: fade out 100 ms, then height in 200 ms | A 117.64–118.03, 118.87–119.24 |

ScreenStack (infra §2.13): add `html[data-app="toss"]` keyframes for **push** (enter = the curve above; exit = fade+drift) and **pop** (exit = slide down 40 dp ease-in 120 ms; enter = −6 dp→0 150 ms). Use `navMs` ≈450 push / ≈150 pop.
Galaxy back (history) = POP. **B 7.18**: the recording starts with the 통장 page closing over S1 (POP motion). For "보내기 → S1" use LOAD+PUSH (A and B 83.3 evidence).

### 3.2 Taps
| control | result |
|---|---|
| S1 계좌번호 입력 box | PUSH → S2 (empty, focused, caret on); keyboard rises ≈0.5 s after the push settles |
| S1 camera icon | not seen → toast "준비 중이에요" (§5) |
| S1 tabs 연락처 / 해외 | not seen → indicator moves; empty state (§5) |
| S1 내 계좌 row | toggles EXPAND; label "+N개 ∨" ↔ "N개 ∧" |
| S1 row (own or recent) | press scale 0.96 + bg; on release PUSH → S4 with recipient preset |
| S1 ★ | toggles favourite (not seen, §5) |
| S2 digits | append (max 16, §5); live hint / searching / chips / pill rules (§2.2-5,6) |
| S2 ⓧ | clear number (§5) |
| S2 chip | bank = chip bank; keyboard stays; **확인** appears above it |
| S2 pill | number = that account's digits, bank = its bank (§5); 확인 appears |
| S2 bank field | keyboard down → SHEET |
| S3 tile | bank = tile; close SHEET (§5) |
| S3 scrim / back | close SHEET, nothing changes (B 36.83) |
| S2 확인 | PUSH → S4 at once (no lookup wait; lookup happens on S4) |
| S4 keypad | 1–9 / 0 / 00 / ← (`src/lib/keypad.ts` `applyKey`). 0/00 on empty → bare "원" |
| S4 paste chip | amount = chip value (§5) |
| S4 다음 | resolved recipient: REPLACE → S5 (no visible dots, ≈0.2 s). Unresolved: dots ≈0.44 s → D1 |
| D1 확인 | close dialog, stay on S4 |
| S5 받는 분에게 표시 row | PUSH → S6 |
| S5 출금 계좌 / 입금 계좌 rows | not seen (§5) |
| S5 옮기기 / 보내기 | CTA loading (dots) → POST → S7 → S8. move: dots 0.42 s; send: dots ≈1.4 s + auth (skip in clone) + ≈1.6 s |
| S6 완료 | save memoTo (client state), POP → S5 (row shows the new text) |
| S6 ← | discard, POP (§5) |
| S8 확인 | leave the flow → launching 통장/거래내역 (data refreshed). The recording shows ad interstitials first (home.md #21–29); optional |
| S8 메모 남기기 | not seen → memo editor for the out-transaction memo (§5) |
| S8 공유하기 | not seen → no-op / toast (§5) |

### 3.3 Timings to reproduce
- **Bank chips:** debounce 350 ms after the last key (when length ≥7) → fade in 350 ms. Any key → hide at once and show "··· 은행을 찾는 중이에요". Length ≤6 → hint (+ pill if a prefix matches).
- **Digit (S4):** 150 ms fade + 4–5 dp drop. **다음** bar 130 ms slide-up. Error appears with the digit.
- **CTA loading:** label fade ≈100 ms, dots loop (0.75 s cycle).
- **Sending (S7):** ≥1.4 s. Coin pops at +0.17–0.25 s and loops ≈1.1 s.
- **Done (S8):** text/CTA at once. Icon slot empty 0.20 s, then the **check lottie ≈650 ms**: silver drop (0–100 ms) → inverted/mushroom morph (≈200 ms) → turns blue with a check (≈300–400 ms) → round disc with a small squash (overshoot) → settled (≈650 ms).
  Measured B 68.305→68.94 and 117.30→117.95. CSS: disc `scale(.6)→1.08→.97→1` plus `border-radius` drop→circle and a check `stroke-dashoffset` draw from ≈60 % to 100 %.
- **Content load:** S1 list fades in ≈60 ms (no skeleton). S4 header title fades 0.25 s. S4 content: faint skeleton, then content fade ≈150–200 ms. Sub-lines show 잔액 로딩중 / 사기계좌 조회중 until their data (+0.2–0.7 s).

### 3.4 Validation and errors
- Amount > balance → red error + disabled 다음 (client). Server `INSUFFICIENT_BALANCE` 400 stays as a fallback (show its message in the same red slot).
- Amount max: server 10,000,000 ("한 번에 1천만원까지"). Show it in the red slot (copy invented).
- Not-found number → D1 after 다음 (lookup 404 `ACCOUNT_NOT_FOUND`).
- Same account as the sender: hide it from S1. If typed, D1-style dialog with the server message "같은 계좌로는 보낼 수 없어요".
- Memo: Hangul ≤7, Latin ≤14 (Hangul counts 2 of 14 units). Block extra input. Server limit 20 is fine.

---

## 4. Data and server

### 4.1 Per-screen data
| screen | data |
|---|---|
| S1 | `from` = toss main account id. `mine[]` (all my accounts except `from`): label/name, bank, number, favourite. `recent[]` (≤20, newest first, **own accounts included**, flagged by `accountId`): bank, number, holder, lastAt, payeeId?, favourite. Count "+{mine.length}개" |
| S2 | banks list (`/api/banks`) + toss label/order map. My accounts for the pill (prefix match on digits). Suggestion heuristic (§5) |
| S4 | from account (label, balance). Recipient via lookup → own (`accountId`) / payee (`holder`) / 404. Clipboard amount (optional) |
| S5 | memoTo (default `profile.userName`), from label, recipient display |
| S7/S8 | `TransferResult` {id, outTxId, to, amount, balanceAfter} |

### 4.2 Endpoints: existing vs needed
`src/kbank/KbankSend.tsx` uses `paths.home`, `paths.recipients(from)`, `paths.banks`, `api.lookupAccount(code, digits)`, `api.updatePayee(id, {favorite})` and `api.transfer({...req, checkDuplicate})`.
- `GET /api/transfer/recipients?from=` — **reuse**, with a toss gate in `recent`: keep own accounts (`APP === "toss" || !myAccountByNumber(…)`) and attach `accountId` for them so the client prints "내 {name}".
  `mine` already excludes `from` (correct: the recording shows "+4개" without the sending 통장). The toss UI ignores `favorites`.
- `GET /api/transfer/lookup?bank=&number=` — **reuse** as is (mine → payee → 404).
- `POST /api/transfers` — **reuse**: `{fromAccountId, bankCode, number, amount, memoTo}`. **No `checkDuplicate`** (toss shows no duplicate dialog). memoMe default = holder.
  Own accounts already create the matching deposit. No fee field; "평생 수수료 무료" is static.
- `PATCH /api/payees/:id {favorite}` — **reuse** for ★ on payee rows.
- ★ on **own-account rows** (seen in the recording) has no backing column: add `accounts.favorite INTEGER NOT NULL DEFAULT 0` in `migrate()` (harmless for other apps).
  Accept `favorite` in `PATCH /api/accounts/:id` only when `APP === "toss"`, and return `favorite` in `mine`/`recent`. Alternative: drop ★ on own rows (§8).
- `PATCH /api/transactions/:outTxId {memo}` — **reuse** for 메모 남기기.
- After a successful transfer, invalidate `home`, `recipients`, the from-account and its transactions (useApi `invalidate`).
- Bank suggestions: **client-side**, no endpoint (§5).

### 4.3 Copy rules
- Destination label: own → "내 {account.name ?? label}". Person → "{holder}" + "님에게". Unresolved → "{bank.name} 계좌".
- Particle after the label: "으로" if the last syllable has a final consonant (except ㄹ), else "로" (통장→으로, 계좌→로, 토스머니→로, 예탁금→으로). Amount: "{n}원을". From: "{내 }{label}에서".
- Bank display: list rows use Toss shorts (하나, 우리, KB국민, NH농협/지역농협, 카카오뱅크, IBK기업, …). S4/S5 use full names (하나은행, 지역농축협 / NH농협, …).
  Toss splits NH into 지역농협/지역농축협 vs NH농협 by account prefix (optional rule; default NH농협).
- Number formatting: hyphenated with banks.mjs `pattern` for saved accounts and payees; raw digits for typed numbers (S2, the pill, S4 unresolved).

---

## 5. Not visible in the recordings (invented defaults)
1. ★ on: filled `#ffc342`, 150 ms scale pop (1→1.2→1). A favourited row moves into a new section "즐겨찾기" above 최근 보낸 계좌 (same row style). The 별표 hint hides once any favourite exists.
2. Tabs 연락처 / 해외: the indicator slides (200 ms). Body shows a centred grey "준비 중이에요" (14.8 R `#7e7d80`).
3. Camera icon, 공유하기, 출금 계좌 row, 입금 계좌 row: toast "준비 중이에요" (Toss toast style from home.md).
4. ⓧ clears the number and keeps focus. Number max 16 digits.
5. Pill tap: fill that account's digits + bank, hide the pill, show 확인.
6. Chip heuristic (≥7 digits), up to 3 chips:
   (a) banks of my accounts/payees whose digits start with the input;
   (b) banks whose `pattern` digit-sum equals the input length;
   (c) fill from the toss order NH농협, 카카오뱅크, KB국민, 토스뱅크, 신한, 우리, 하나.
   Deterministic, so it never shows the recorder's chips.
7. S3 tile tap: tile press darkens to `#323135` (100 ms), set the bank, close (100 ms), focus nothing, 확인 shown at the bottom.
8. S4 paste chip: no clipboard access (permission prompts). Hidden by default; optional DevPanel field "클립보드 금액".
9. S6 ←: discard edits, POP. An empty memo on 완료 → revert to the default (my name).
10. S8 메모 남기기: open S6-style editor titled "메모" (≤20 chars), save via PATCH memo, toast "메모를 남겼어요".
11. S8 ← in the app bar = 확인.
12. Back during S7: ignored. Double taps: lock navigation while a PUSH/POP runs (copy kbank `useKbankGo`).
13. Auth after 보내기 (black in B): skipped. Dots for ≈1.0 s total, then S7.
14. Ad interstitials after 확인: follow home.md's decision (default: none; go straight back).
15. 토스머니 in 내 계좌: only if the account/자산 spec models it as an account row; otherwise "+N개" counts real accounts.
16. 교보SBI저축은행 tile: no bank code. Omit it (or show it and treat taps as "준비 중이에요").

## 6. Personal data seen → placeholders (replace with invented seed data)
| role | where | placeholder / format only |
|---|---|---|
| recorder's name | S5 받는 분에게 표시 default, S6 initial text | `<NAME_SELF>` → seed "홍길동" |
| recorder's 토스뱅크 통장 number | 통장 (not in my screens' text) | `<ACCT_TOSS>`: 12 digits, 4-4-4 |
| recorder's 하나 영하나플러스 통장 | S1 rows, S2 pill (raw), S4/S5 | `<ACCT_HANA>`: 14 digits, 3-6-5 (raw in the pill) |
| recorder's NH 자립예탁금 | S1 expanded | `<ACCT_NH_RAW>`: 13 digits, shown unhyphenated |
| recorder's 카카오뱅크 입출금통장 | S1 rows | `<ACCT_KAKAO>`: 13 digits, 4-2-7 |
| typed (wrong) number | S2, S4 sub | `<ACCT_TYPED>`: 15 digits |
| counterparties (≈12 people/companies) | S1 recent, S4/S5/S7/S8 titles | `<NAME_P1…>` → invented names |
| counterparty accounts | S1 subs, S4/S5 | formats: 지역농협 3-4-4-2 (13), NH농협 3-4-4-2 (13), 우리 4-3-6 (13), KB국민 6-2-6 (14), 카카오뱅크 4-2-7 (13), IBK기업 3-6-2-3 (14), 하나 3-6-5 (14) |
| balances | S4 잔액, A error copy | `<BAL>` (three different values across the clips) |
| transfer amounts | S4–S8 | `<AMOUNT>` (the same small amount every time) |
| clipboard number | S4 paste chip | `<CLIP_AMOUNT>` (8 digits, comma grouped) |
| memo typed | S6, S5 row | `<MEMO>` (2 Hangul syllables) |
| other apps' heads-up notifications | B 76.2–79.1, 127.55–131.0 | not Toss UI (home.md); do not clone |

Suggested seed for this flow (invented): main 토스뱅크 통장 `1000-0000-1234`. Own externals: 하나 "영하나플러스 통장", NH "자립예탁금", 카카오뱅크 "입출금통장".
Payees (≥8) in 하나, NH (one with a 352- prefix for 지역농협), 우리, KB국민, 카카오뱅크, IBK, with invented names (e.g. 김철수, 이영희, (주)예시상사).
Transfers with descending dates so `recent` mixes 2–3 own accounts among payees. Main balance > 0 in "example" and 0 in "empty" (shows the red error path).

## 7. Assets
| asset | how | crop (px @480, frame) | privacy |
|---|---|---|---|
| List squircle logos 40 dp (하나, NH/지역농협, 우리, KB국민, 카카오뱅크, IBK, 토스머니) | crop + upscale ×4 (ESRGAN pipeline), save `toss-bank-<code>.png` (`toss-money.png`). Or CSS squircle (r 14) in brand colour + `hana-bank-<code>` glyph (white for 하나/NH) | B idx 254 (8.500 s): x 29–80 × hana y 526–578, NH y 696–748, 우리 y 782–834, KB y 867–919. B idx 3446 (88.750 s): 카카오뱅크 y 440–492, IBK y 782–834. A idx 3824 (118.056 s): 토스머니 y 489–541 | **OK**: logo only. x ≤80 px stays left of the names (x ≥98 px) |
| Sheet / chip glyph logos | reuse `hana-bank-<code>.png` (all 61 codes present); crop not needed (24 dp = 30 px only) | — | OK |
| Back arrow, camera, ★, chevrons ∨ ∧ >, ⓧ, shield, keypad ←, check | SVG | — | OK |
| Sending coin / drop lottie | CSS/SVG approximation (§2.9, §3.3); not croppable | — | OK |
| Keyboards | HanaKeyboard + new Korean layout (§2.8.1), CSS | — | OK |
| Spinner, dots, skeleton | CSS | — | OK |

## 8. Open questions
1. ★ on own accounts: add `accounts.favorite` (recommended) or hide ★ on own rows?
2. Ad interstitials after 확인 (home.md #21–29): show them in the clone (and which one for 옮기기 vs 보내기), or return straight to 통장?
3. 지역농협/지역농축협 vs NH농협 display split by account prefix: implement the rule, or always "NH농협"?
4. 토스머니 as a 내 계좌 row (needs a data model from the account/자산 spec)?
5. Korean keyboard: full 두벌식 composer, or physical-keyboard input with decorative keys?
6. Simulated auth after 보내기 (a lock-screen-style password pad, like the splash spec) or none (recommended: none)?
