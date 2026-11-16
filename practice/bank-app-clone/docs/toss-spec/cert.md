# toss — 증명서 발급 (certificate issuance) spec

Area: video A, 59.5–102.7 s. The flow is 상세 내역 "증명서 발급하기" → 토스뱅크 증명서 발급하기 → 송금 확인증 intro →
account → items → delivery method → loading → issued (preview) → 문서.pdf viewer, then back through every step.
Video B has no certificate screens (checked against the 3 s contact sheet).

**Privacy:** no names, account numbers, amounts, dates or issue numbers from the recording appear below.
Only formats, UI labels, geometry, colours and timing are recorded. §6 lists every personal field as a placeholder.

**Units:** dp in screen coordinates (0 = top of the status bar). x = px / 1.25. For y I used px / 1.25.
infra.md's px / 1.24922 differs by at most 0.4 dp at y 640. Frame 384 × 853.33, status bar 0–28, app 28–838.33, nav band 838.33–853.33 (infra §1).
"ink" means the measured glyph box (half-intensity edges), not the CSS line box.
For Pretendard with `line-height: 1`, the Hangul ink centre is top + 0.54 em (SOLUTION.md).

**Evidence:** frames are in `scratchpad/toss/frames/cert/` (`all/NNNNN.jpg` = frame index into `ptsA.txt`;
`png/A<idx>_<pts>.png` are lossless). Tools are in `scratchpad/toss/tools/cert/`: `chg.py` frame diff, `arrow.py` slide tracking,
`prog.py` progress bar, `rings.py` loader rings, `inkm.py` / `rows.py` ink boxes, `fit2.py` / `weight.py` Pretendard size and weight fits,
`col.py` colours, `strip.py` contact strips.

**Colours:** text colours are the brightest-ink ("peak") values. Blur makes dense-ink averages read 5–15 % darker,
so peak values are closer to the CSS value.

---

## 0. Key findings

1. **Two motion levels.** Toss opens each certificate *activity* with the Android slide-up push. This applies to 상세 → 증명서 home,
   증명서 home → 송금 확인, and issued → 문서.pdf. Closing one uses the slide-down pop.
   **Inside** the 송금 확인증 activity the steps (intro → account → items → method → loading → issued) are WebView page changes.
   They are hard cuts: content clears, a blank shows while loading, then the new content appears in one frame.
   Back between steps is an instant cut too. The motion matches transfer.md §3.1 PUSH / POP / REPLACE, so reuse those keyframes.
2. **Status bar is `#171619` on every cert screen**, including the 증명서 home, whose page and header are `#100f12`.
   The 증명서 home uses the "grouped" palette: page `#100f12` with `#171619` cards. All step pages are flat `#171619`.
3. **The document is an A4 page**, 344 × 486.4 dp in the preview card and 368 × 520.4 dp in the viewer (ratio exactly √2).
   Render it as one HTML component in page units and scale it (§2.10). Apply infra §8's safety rule:
   watermark, no real seal, dummy verification URL and phone number, never a clean PDF.
4. **Loading page** "잠시만 기다려주세요" has two animations: a left-to-right **shimmer on the title text** and **expanding concentric rings**
   (centre 192, 352; r 0 → 184 dp in 2.0 s; a new ring every 1.28 s).
   A 1.8 s **fully black** stretch at A 79.08–80.90 is a secure-window recording artifact. Do not reproduce it.
5. **Selections reset on back.** Returning to items or account shows nothing selected and the CTA disabled (A 97.85, 98.51).
   Loading is not a history entry: back from "issued" goes to "method".

---

## 1. Screen inventory (video A, pts seconds)

| id | screen / state | pts range | notes |
|---|---|---|---|
| E | 상세 내역 (entry; owned by account.md S3) | 56.40–60.16, again 101.25–102.61 | row "증명서 발급하기" pressed 59.51–59.71 |
| T1 | PUSH 상세 → H (activity open) | 60.162–60.508 | §3.1 |
| H0 | 증명서 home, blank, native header `#171619` (arrow only) | 60.25–60.71 | |
| H1 | H partial: title + card 1 with "많이 찾아요" only, all content +53.6 dp lower | 60.713–60.847 | WebView below native header |
| H2 | H full content, still +53.6 dp lower; progress bar | 60.847–62.014 | bar track 60.76, fill 61.18→61.98, fade-out until 62.63 |
| H3 | **H final**: WebView takes over the header area, header `#100f12`, content jumps up 53.6 dp in one frame | 62.014–64.632 | search icon appears 62.245. Reference frame `png/A02170_062.677.png` |
| H-press | row "송금 확인증 (계좌이체 확인증)" pressed | 64.161–64.294 | |
| T2 | PUSH H → I | 64.632–64.98 | |
| I0 | 송금 확인 activity loading: blank, progress bar, faint skeleton | 64.75–67.158 | skeleton 66.3–66.6 (generic), 66.97–67.04 (page-shaped) |
| I | **송금 확인증 intro** | 67.158–69.775 | CTA press 69.360–69.426, dots 69.611–69.759 |
| I→A | cut to blank (header only) | 69.775–70.059 | 284 ms |
| A | **어떤 계좌의 증명서를 발급할까요?**, none selected, CTA disabled | 70.059–71.606 | row press 71.388–71.49 |
| A' | A with Toss account selected (✓, CTA enabled) | 71.606–72.373 | CTA press 72.188–72.24 |
| A→L | cut to blank | 72.373–73.068 | 695 ms |
| L0 | **어떤 내역을 발급할까요?**, rows without check circles | 73.068–73.319 | |
| L | L with check circles, none selected, CTA "다음" disabled | 73.319–74.469 | row press 74.269–74.437 |
| L' | L with 1 row selected, CTA "1건 선택" enabled | 74.469–75.270 | CTA press 74.956–75.157, dots 75.238 |
| M | **증명서를 어떻게 받을까요?** | 75.270–77.440 | "휴대폰에 저장" pressed 76.803–76.969 |
| W | **잠시만 기다려주세요** loader | 77.440–83.368 | rings + shimmer from 77.719. Black artifact 79.080–80.898 |
| D0 | **송금 확인증을 발급했어요**, card skeleton | 83.368–84.220 | buttons fade in 83.37–83.62 |
| D1 | D, card turns white (blank page) | 84.220–84.501 | |
| D | D with document preview | 84.501–90.626 | "파일 저장하기" pressed 88.903–89.323 |
| T3 | PUSH D → V | 90.600–90.970 | |
| V | **문서.pdf viewer** | 90.970–95.340 | static. Reference frame `png/A03000_092.236.png` |
| T4 | POP V → D | 95.340–95.462 (+ settle to ≈95.6) | |
| back | D → M → L → A → I, instant cuts | 96.412 / 97.397 (L circles +284 ms at 97.681) / 98.328 / 99.313 | selections reset |
| T5 | POP I → H | 100.135–100.274 (+ settle to 100.41) | H is shown in its final state (cached) |
| T6 | POP H → E | 101.127–101.254 (+ settle) | |

No toast appears anywhere in the flow, including after "파일 저장하기".

---

## 2. Screens

### 2.0 Shared chrome
- **Header** 28–81 dp (53 dp). Only a **back arrow** on the step pages. H adds a search icon; V adds a title and a share icon.
  - Back arrow ink x 18.9–38.0, y 45.8–63.2 (19 × 17.4). Use a 24 dp icon box at (16.5, 42.5).
    White `#ffffff`, stroke ≈2 dp, round caps: shaft from x 19 to 38 at y 54.5, 45° heads ≈8.8 dp long.
    SVG (24 viewBox): `M20 12H4.5 M11 5.5 4.5 12l6.5 6.5`, stroke-width 2, round caps and joins. Draw it in SVG; no crop needed.
  - Header background = the page colour (H `#100f12`, steps `#171619`, V `#171619`). No divider.
- **Progress bar** (activity load, H and I): sits under the header at y 80–82 dp (2 dp), full width.
  The grey track `#46474b` fades in first (≈0.4 s). The blue fill `#3182f6` (renders ≈ `#2c5fa8` at ≈65 % opacity) grows left → right
  (to ≈70 % in ≈100 ms, then slower to 100 % over ≈0.8 s). At 100 % the whole bar fades out over ≈0.6 s.
  Use the same component as account.md §3.2. Clone timing: show at +150 ms, fill to 100 % when content is ready, fade out 400 ms.
- **CTA (single)**: x 20–364, y 762–818 (56 dp), radius 16, fill `#3182f6` (measured `#2f80f5`), label 17 / 600 white, centred (label ink y 781.9–797.2).
  Disabled: fill `#1e355b`, label `#4c5f7e`. Enable / disable crossfade ≈180 ms ease-out (A 71.538→71.72, 74.437→74.57).
  Pressed: fill darkens to ≈`#2b72de`, label dims slightly; ≈30 ms in, ≈120 ms out after release (A 69.360→69.54).
- **Button loading dots** (A 69.611, 75.238): the label crossfades out (≈150 ms) while **3 dots** fade in. Dot ⌀ ≈7 dp, white,
  centres at x 177.3 / 192 / 207.2 (pitch ≈15 dp), y 790 (button centre). Left-to-right opacity wave: dot1 → 1, dot2 ≈0.5, dot3 ≈0.3,
  cycling. Use period 900 ms, stagger 150 ms, opacity 0.3 ↔ 1 (same pattern as the existing "점 3개" loaders).
  The button fill darkens ≈5 % while loading. Show the dots only if the next step is not ready ≈180 ms after release.
- **Row press highlight** (all list rows): rounded rect inset ≈4 dp from the row container's sides, full row height, radius ≈10 dp,
  colour = white ≈5–7 % over the background (`#212023` on a `#171619` card; `#252427` / `#29282b` on a `#171619` page).
  Fade-in 60–150 ms while the finger is down, fade-out ≈100–120 ms after release. The action fires at release.
- **Nav band** `#171619` (infra §1.3) on all cert screens, including V.
- **Font**: Pretendard (infra §7). Pure-Hangul strings fit size N exactly. Strings with spaces or parentheses fit ≈0.3 dp smaller
  because Toss's space is narrower. Optional `word-spacing: -1px` on 17 dp list labels.

### 2.1 H — 토스뱅크 증명서 발급하기 (final state, frame A 62.677)
Status bar `#171619`. Header and page `#100f12`.

| element | geometry (dp) | style |
|---|---|---|
| back arrow | §2.0 | white |
| search icon (magnifier) | ink x 336.2–357.7, y 43.2–64.7; 24 dp box at (335, 42) | stroke ≈2.4 dp, `#9094a1` (circle ⌀≈15 + handle to lower right). SVG |
| title "토스뱅크 증명서 발급하기" | x 24.0, ink 112.8–133.6 | 22 / 700, `#ffffff` |
| **card 1** | x 16–368, y 162.4–417.6 (255.2), radius 20 | `#171619` |
| label "많이 찾아요" | x 40.8, ink 190.4–206.4 | 17 / 700, `#e1e0e3` |
| 3 rows, pitch 62.4 | row 2 press box x 19.2–364.8, y 282.4–343.2 (≈61 tall) | |
| rank badge | 16 × 16 at x 46.4–62.4; centres y 251.2 / 313.6 / 376.0; radius ≈4 | fill `#2b2b33`, digit "1"/"2"/"3" ≈11 / 700 `#3182f6`, centred |
| row label | x 82.4, ink tops 243.2 / 305.6 / 368.0 (ink h 16) | 17 / 500, `#e1e0e3`: "통장 사본 (계좌개설 확인증)", "송금 확인증 (계좌이체 확인증)", "거래내역서". No chevron |
| section label "증명서 전체보기" | x 24.0, ink 445.6–461.6 | 17 / 600, `#8f8e91` |
| **card 2** | x 16–368, top 475.2, radius 20, extends below the fold | `#171619` |
| group title "통장·예적금" | x 40.0, ink 503.2–519.2 | 17 / 700, `#e1e0e3` (middle dot U+00B7) |
| items, pitch ≈54.9 | x 40.0, ink tops 552.0 / 607.2 / 661.6 / 716.8 / 772.0 / 826.4 | 17 / 500, `#bab9bc`: 잔액 증명서 · 통장 사본 (계좌개설 확인증) · 거래내역서 · 송금 확인증 (계좌이체 확인증) · 해외 송금 확인증 · 자동이체 확인증 (cut by the fold) |

Scroll: never scrolled in the video. Content below the fold is invented (§5). The page scrolls as a whole.
Keep the header fixed with `#100f12` and no border. Optionally fade in a centred title in the header once the big title scrolls under it,
using account.md's rule (250 ms).

Load sequence. The clone should skip the WebView quirk and render the final layout directly. If you reproduce it:
blank for ≈0.55 s with a native `#171619` header bar → content drawn 53.6 dp lower (title ink at 172.8) → at load end the header turns
`#100f12` and the content jumps up 53.6 dp in one frame → search icon appears +230 ms later.
Clone: blank 250 ms → content (card 1 rows may appear +130 ms after the card) → progress bar as in §2.0.

### 2.2 I — 송금 확인증 intro (frame A 68.449)
Page, header and status bar `#171619`.

| element | geometry | style |
|---|---|---|
| title "송금 확인증" | x 24.7, ink 111.1–130.7 | 22 / 700 white |
| subtitle "다른 계좌로 돈을 보낸 내역을 확인할 수 있어요." | x 25.0, ink 144.9–160.2 | 17 / 500 (fit 16.7), `#b4b9c1` (slightly blue-grey) |
| label "언어" | x 24.7, ink 232.5–245.6 | 15.5 / 400, `#8c8d92` |
| value "국문" | x 24.6, ink 253.6–268.7 | 17 / 700, `#e1dfe7` |
| CTA "발급하기" | §2.0 | enabled |

Loading before the content (I0, clone ≈600 ms): blank → progress bar → a **very faint skeleton** fades in.
It is +16 luma over `#171619`, about `#27262b`, with a diagonal lighter shimmer. Shapes: title bar ≈x 26–192, y 106–134;
subtitle bar ≈x 26–136, y 149–170; 3 rows of ⌀≈40 circle at x 30 plus a bar x 83–354 (≈24 dp tall, pitch ≈74, first at y≈205).
Optional. A blank page is acceptable.

### 2.3 A — 어떤 계좌의 증명서를 발급할까요? (frames A 71.155 / 71.773)
| element | geometry | style |
|---|---|---|
| title | x 24.8, ink 111.0–130.6 | 22 / 700 white: "어떤 계좌의 증명서를 발급할까요?" |
| section "사용중인 통장" | x 24.7, ink 180.2–193.7 | 15 / 500, `#8f8e91` |
| **row (Toss account)** | row box y 204–292 (88), press box x ≈4–380 | |
| icon tile | 28 × 28 at x 24.6–52.4, centre y 248, radius ≈8 | fill `#100f12`; Toss Bank symbol ≈18 dp (asset C1) |
| product name "토스뱅크 통장" | x 66.5, ink 221.5–232.8 | 13 / 400, `#8e8d90` |
| account number `<ACCT_TOSS>` | x 66.9, digit ink 240.8–253.6 | ≈17.5 / 500, `#e3e2e5`, dashed 4-4-4 |
| "개설일 `<YY.MM.DD>`" | x 66.6, ink 261.9–273.5 | 13 / 400, `#6e6d70` |
| selected check ✓ | ink x 339.9–355.9, y 243.0–254.0 (16 × 11) | stroke ≈2 dp, `#3182f6` (measured `#3581fa`). Drawn only on the selected row |
| section "오픈뱅킹 연결한 통장" | x 24.7, ink 312.9–326.4 | as above |
| **row (other bank)** | box ≈336–404 (2 text lines) | |
| icon tile | 28 × 28, centre (38.5, 371.6) | `#100f12` tile with the bank's square logo (asset C2) |
| bank short name "`<BANK_SHORT>`" | x 66.7, ink 353.7–365.0 | 13 / 400, `#8f8e91` (server `bank.short`) |
| account number | x 66.7, ink 373.0–385.8 | as Toss row, dashed per bank pattern |
| CTA "다음" | §2.0 | disabled until a row is selected |

Behaviour: **single select**, like a radio. Tap = highlight (in 66 ms, peak `#252427`) → release → highlight out ≈120 ms → ✓ appears
instantly at the end of the fade → CTA enables (180 ms). The CTA label stays "다음".

### 2.4 L — 어떤 내역을 발급할까요? (frames A 74.167 / 74.767)
| element | geometry | style |
|---|---|---|
| title | x 24.0, ink 110.4–131.2 | 22 / 700 white: "어떤 내역을 발급할까요?" |
| search field | x 20–364, y 165.6–209.6 (44), radius ≈10 | fill `#2b2a2d` |
| · magnifier | ink x 33.6–49.6, y 179.2–195.2 (16) | `#9c9b9e`, stroke ≈1.8 |
| · placeholder "사람 이름, 상호명, 금액으로 검색" | x 62.3, ink 180.0–195.4 | 16 / 400, `#828184` |
| chips | y 221.6–253.6 (32), radius ≈7, fill `#292a2f` | chip 1 x 20–105.6: "모든 기간" (ink x 30.4–78.4) + chevron-down (ink x 84–93.6, y 234.4–240, `#95969b`). Chip 2 x 112–184.8: "입출금" (ink 124–156.8) + chevron (163.2–172.8). Text 13 / 500 `#c2c3c8`. Padding ≈10–12 left, 12 right, text–chevron gap ≈5 |
| "모두 선택" row | circle ⌀22 at x 25–47 (centre 36, 297.8); label x 60.6, ink 289.7–304.6 | circle: 2 dp outline `#5a595c` with a check glyph inside, same colour (stroke ≈2). Label 17 / 500 `#c1c0c3` |
| date header "`MM월 DD일`" | x 24.7, ink tops 354.5 / 466.4 / 578.4 / 690.4 (pitch 112) | 13 / 500, `#e3e2e5`. **Zero-padded** month and day |
| tx row | box 72 dp directly under its date header (first: 375.2–447.2), press box x ≈4–380, radius ≈10, peak `#29282b` | |
| · check circle | ⌀22, centre (36, row top + 35.3) | unselected: outline + check, `#58575a`. **Selected: filled `#3182f6` (measured `#3d83fe`) with the check knocked out in the page colour (dark check, not white)** |
| · name | x 60.9, ink 393.8–409.1 (row 1) | 17 / 600, `#e8e7ec` (recipient name) |
| · sub "`HH:MM` \| 출금" | x 60.8, ink 416.0–427.3 | 13 / 400, `#727176`; the separator is a plain "\|" with spaces |
| · amount "`-N,NNN 원`" | right edge 358.5, ink 402.4–419.0 | 17 / 700, `#eaebf0`; minus sign, comma grouping, **space before 원** |
| bottom fade | gradient from `rgba(23,22,25,0)` at y ≈722 to opaque at ≈754, solid to the CTA | measured on the 4th row (visibility 0.5 @ 738 → 0 @ 753) |
| CTA | §2.0 | "다음" disabled when 0 selected. Otherwise **"`N`건 선택"** enabled |

Behaviour: **multi select**. "모두 선택" toggles all (invented detail, §5). Row tap: highlight in ≈150 ms (74.269→74.388) →
release → highlight out 100 ms, circle fills **at release** (74.469), CTA enables (150 ms) and the label changes immediately.
On first render the circles appear ≈250 ms after the rows (73.068 → 73.319, again 97.397 → 97.681); optional.
The list scrolls under the fade. The title, search and chips scroll with it. Nothing is sticky (not scrolled in the video; assumption).

### 2.5 M — 증명서를 어떻게 받을까요? (frame A 76.040)
| element | geometry | style |
|---|---|---|
| title | x 24.0, ink 110.4–131.2 | 22 / 700 white |
| rows "휴대폰에 저장" / "이메일" / "팩스" | x 24.0, ink tops 180.0 / 236.0 / 292.0 (pitch 56, ink h 16) | 17 / 600 (ink weight lands between 600 and 700), `#e7e6e9` |
| chevron-right per row | ink x 353.6–359.1 (5.5 × 10.2), vertically centred on the label | `#515053`, stroke ≈1.6 dp |

No CTA. A row tap shows the standard highlight (row box ≈ label centre ± 28, x ≈4–380).

### 2.6 W — 잠시만 기다려주세요 (A 77.44–83.37)
- Title "잠시만 기다려주세요": x 25.0, ink 111.1–130.6, 22 / 700.
  **Shimmer**: base colour ≈`#6b6a6e` (luma 107), highlight ≈`#dcdbdf` (luma 220). A broad bright band (about the text width) sweeps
  **left → right**, period ≈**2.3 s**, linear. At first paint (77.44) the text is uniformly dim; the sweep starts at +280 ms.
  CSS: `background: linear-gradient(90deg, #6b6a6e 0%, #6b6a6e 25%, #dcdbdf 45%, #dcdbdf 55%, #6b6a6e 75%, #6b6a6e 100%) 0 0 / 300% 100%;
  background-clip: text; color: transparent; animation: shimmer 2.3s linear infinite` (background-position 100% → 0%).
- **Rings**: centre (192, 352) dp. Each ring is a 1 dp circle stroke ≈`#d1cdd6` (peak). Radius 0 → **184 dp** over **2.0 s**,
  `cubic-bezier(0.4, 0.45, 0.5, 0.95)` (fit RMS 0.006; ≈128 dp/s linear until r≈130, then decelerating).
  Opacity: 0 → 1 over the first ≈20 % of life (r < ≈50), 1 until ≈80 %, then → 0 (r 176 → 184). **A new ring every 1.28 s**,
  so at most two are visible. The first ring appears +280 ms after page show, already at r≈90–120.
  Start the animation with `animation-delay: -0.8s` and stagger ring 2 by 1.28 s.
  Implement as SVG `<circle>` with animated `r`, or a bordered div animating width/height. Do **not** use `scale()`, which would scale the stroke.
- Header back arrow stays visible. No CTA.
- Clone duration: ≈2.6 s (two ring periods). The video shows 5.9 s including the 1.8 s artifact. Then **REPLACE** to D, so W is not in history.

### 2.7 D — 송금 확인증을 발급했어요 (frames A 83.816 skeleton, 89.341 loaded)
| element | geometry | style |
|---|---|---|
| title | x 24.7, ink 111.0–131.2 | 22 / 700 white: "송금 확인증을 발급했어요" |
| preview card | x 20–364, y 160–646.4 (344 × 486.4, A4), radius 16, clips content | skeleton `#292a2f` (0.85 s in the video, 600 ms in the clone) → white `#ffffff` → document content +280 ms (clone +150 ms) |
| left button "확인했어요" | x 20–184.4, y 762–818, radius 16 | fill `#292a2f`, label 17 / 600 `#bebec8` (centred, ink 65.6–138.4) |
| right button "파일 저장하기" | x 191.6–364, y 762–818, radius 16 | fill `#3182f6`, label 17 / 600 white (ink 232.2–322.0) |

Buttons: gap ≈7–8 dp, unequal widths (164.4 / 172.4) as measured. `flex: 1 1 auto` with an 8 dp gap and 0 basis plus label width
reproduces this closely. Otherwise hard-code the widths.
Both buttons fade in from ≈0.4 to 1 over ≈250 ms at page show (83.37 → 83.62). The card and title are visible at once.
The document inside the card is §2.10 scaled by 344 / 368 = 0.9348 from the card's top-left (verified: title ink 37.9, 180.8 vs predicted 37.6, 180.8).

### 2.8 V — 문서.pdf viewer (frame A 92.236)
| element | geometry | style |
|---|---|---|
| status bar + header | 0–81.6, `#171619` | |
| back arrow | ink x 18.9–38.0, y 45.8–63.2 | white |
| title "문서.pdf" | x 72.0, ink 46.4–64.0 (Hangul), ink width 59.2 | 17 / 600 white |
| share icon (upload: open tray + up arrow) | ink x 337.7–356.8, y 44.3–64.0 (19 × 20) | `#e1e0e3`, stroke ≈2 dp, rounded tray corners. SVG: `M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6 M12 3v12 M7 8l5-5 5 5` |
| body | 81.6–838.33 | `#dddee3` (221,222,227) |
| page | x 8–376 (368), y 100.8–620 (≈520 = A4) | white, faint 1 px bottom shadow ≈`#efefef`, no border or radius |

Static in the video (no zoom or scroll). One page fits with a ≈218 dp grey gap below.
With several pages (§5), stack them with 19.2 dp gaps and scroll the body.

### 2.9 E — entry row (owned by account.md S3)
"증명서 발급하기" row in 상세 내역 (doc icon T19, label 16 R, chevron). Pressed A 59.51–59.71 with a full-width highlight
(x ≈2.4–380.8, ≈47 dp tall, peak luma 35 on 23). Push starts ≈450 ms after the highlight ends (60.162).
The row opens the generic 증명서 home and does **not** pre-select the transaction.

### 2.10 The 송금확인증 document (A4; units = viewer dp, page W 368 × H 520.4; 1 unit = 0.5707 mm)
Coordinates are relative to the page's top-left and are ink boxes. Colours are suggested CSS values, because measured ink is blurred at 4–5 dp.
Use `#191f28` (title / rules), `#333d4b` (labels), `#6b7684` (values), `#8b95a1` (unit), `#4e5968` (footnote).

| # | element | x | y (ink) | font (units) | notes |
|---|---|---|---|---|---|
| 1 | title "송금확인증" (no space) | 18.8 | 22.2–32.1 | 11.1 / 700 `#191f28` | ≈18 pt on A4 |
| 2 | statement "`<NAME_A>`님의 계좌 송금 내역을 아래와 같이 증명합니다." | 18.7 | 67.2–74.3 | 7.8 / 700 `#191f28` | ≈12.5 pt. NAME = account holder (profile `userName`) |
| 3 | "단위: 원" | right-aligned at 348.8 | 86.7–90.2 | 4.3 / 400 `#8b95a1` | |
| 4 | top rule | 18.4–348.8 | 98.4–99.6 (≈1.0–1.2) | `#191f28` | ≈0.6 mm |
| 5 | header row | column x: **19.0** 거래일자 · **55.0** 받는사람 · **88.3** 보낸사람 · **121.3** 금액 · **171.0** 보낸 은행 계좌 · **243.4** 받는 은행 계좌 · **316.1** 받는통장 표시 (last ends 343.1) | 108.9–113.6 | 5.0 / 700 `#333d4b` | ≈8 pt; left-aligned columns, no cell borders |
| 6 | data row(s), same column x | line 1 ink 123.4–128.0, line 2 131.0–135.1 | 5.0 / 400 `#6b7684` | 거래일자 = `YYYY-MM-DD` / `HH:MM:SS` on line 2. Other cells are one line. See the field table below |
| 7 | footnote "본 송금확인증은 고객 편의를 위해 제공되는 것으로 거래의 참고용으로만 사용하실 수 있습니다." | 18.8 | 159.5–163.4 (≈24 below the last data line) | 4.1 / 400 `#4e5968` | best reading of 4 dp text |
| 8 | bottom rule | 18.4–348.8 | 448.0–449.2 | `#191f28` | |
| 9 | footer row 1 | "발급일자" 18.5 (700 `#333d4b`), value 61.7 (400 `#6b7684`) · "문서 진위확인" 177.6, value 233.6 | 458.4–463.2 | 5.0 | |
| 10 | footer row 2 | "발급번호" 18.5, value 61.7 · "고객센터" 177.8, value 233.8 | 468.5–473.0 | 5.0 | |
| 11 | Toss Bank logo (symbol + "toss bank" wordmark) | 18.4–72.8 | 491.4–500.9 | `#191f28` | SVG (asset C3) |
| 12 | red round seal | centre (103.2, 490.4), ⌀30.6 | | | **do not reproduce**: placeholder, see below |
| 13 | page number "1/1" | right edge 341.0 | 493.2–497.4 | 5.3 / 400 `#4e5968` | "`p`/`n`" |

Data-row fields (one row per selected transfer; source in §4):
- 거래일자 `YYYY-MM-DD` with `HH:MM:SS` on the next line.
- 받는사람 = recipient holder.
- 보낸사람 = account holder name.
- 금액 = `-N,NNN`: minus sign, comma grouping, no unit (the unit is in #3).
- 보낸 은행 계좌 = `<own number as displayed, dashed>(<bank name>)`, e.g. "…(토스뱅크)".
- 받는 은행 계좌 = `<recipient number, digits only, no dashes>(<bank full name>)`, e.g. "…(하나은행)".
- 받는통장 표시 = text printed on the recipient's passbook (`memoTo`, default the sender's name).
- No space before "(". Long values are not wrapped in the video.

Clone rendering (recommended):
- **One React component `TossTransferCertDoc`** that lays the page out at **4×** (1472 × 2081.6 CSS px, every number above × 4)
  inside a box, then `transform: scale(k/4)` from the top-left. k = 0.9348 in the D card and 1 in V.
  Laying out at 4× avoids any browser minimum-font-size clamping of 4–5 px text, and the tiny text stays crisp on high-DPR screens.
  Absolute positioning in page units, Pretendard, `font-variant-numeric: tabular-nums` for dates and amounts (the video's digits look fixed-width).
- **Safety (infra §8, IBK precedent)**:
  - Overlay "연습용 화면 · 실제 이체 아님" repeated diagonally (−30°) on the page in both the preview and the viewer. Make it light
    enough that the table stays readable: e.g. 6 units / 600 at `rgba(240,68,82,.16)`, 3 rows × 2 columns per page.
  - Seal: a neutral placeholder, a red (`#e5484d`) double ring ⌀30.6 with "연습용" in the middle. No Toss marks inside.
  - "문서 진위확인" value → "연습용 문서 · 진위확인 불가". "고객센터" value → "0000-0000".
  - 발급번호: a dummy in the right format (§4).
- **No real PDF file.** "파일 저장하기" opens V, as in the video; nothing is downloaded. The share icon is a no-op.
  Do not add a PDF library (jsPDF etc.).
  If the owner later wants a file, the only acceptable output is `window.print()` of V with an `@page { size: A4; margin: 0 }`
  stylesheet that **keeps** the watermark and placeholder seal. Do not expose it by default.

---

## 3. Interactions and transitions

### 3.1 Activity PUSH (T1 60.162, T2 64.632, T3 90.600) — same family as transfer.md "PUSH"
- New screen: whole window including the status-bar strip, **translateY ≈+150 dp → 0**, strong decelerate. The window is opaque
  from ≈+70 ms (it starts ≈35 % opacity at the first visible frame).
  Measured offsets (px) for T3 at +26/+50/+73/+95/+117/+137/+158/+198/+239/+279/+336/+370 ms: 179/148/114/63/50/40/26/17/9/5/2/0.
  T1: 148/112/83/62/49/40/32/26/21/…/0 at +15…+346 ms.
  **Clone: 400 ms `cubic-bezier(0.05, 0.7, 0.1, 1)`, opacity 0 → 1 in the first 70 ms** (or transfer.md's 450 ms easeOutExpo; same look).
- Old screen: drifts up ≈−18 dp and fades out within ≈90 ms.
- While the window is offset, the strip above it is black (status bar shows black for ≈60 ms). Optional.
- Then the activity's content loads: blank + progress bar (§2.0), optional faint skeleton (§2.2), content.

### 3.2 Activity POP (T4 95.34, T5 100.135, T6 101.127) — transfer.md "POP"
- Closing screen: translateY 0 → ≈+40 dp, accelerating, ≈110–125 ms, no fade. Removed in one frame.
  Offsets px: 1, 4, 10–20, 31, 40, 47.
- Revealed screen: appears at −5.6 dp (−7 px) and eases to 0 in ≈140 ms (offsets −7, −5, −4, −2, −1, 0 at 20 ms steps).
- Revealed activities are shown from cache in their last state (H shows its final layout, no reload).

### 3.3 In-activity steps (inside the 송금 확인증 flow)
| from → to | trigger | what you see | clone |
|---|---|---|---|
| I → A | CTA "발급하기" | press → dots at +185 ms after release → content clears (header stays) at +350 ms → blank 284 ms → A appears (cut) | press → dots if not ready in 180 ms → cut to blank ≈250 ms → cut to A |
| A → L | CTA "다음" | release → clear +130 ms → blank 695 ms → L (circles +250 ms) | cut to blank ≈300 ms → L |
| L → M | CTA "N건 선택" | release → dots +80 ms → **M immediately** (no blank) | cut |
| M → W | row "휴대폰에 저장" | release → W after ≈470 ms (cut) | cut after ≈150 ms |
| W → D | (timer) | **REPLACE** cut; D0 skeleton | after ≈2.6 s |
| D → V | "파일 저장하기" | press ≈70 ms darken to `#2c71d8`, release → ≈1.3 s idle → PUSH (§3.1) | idle 400 ms → PUSH |
| back (header ← or Galaxy back) on D / M / L / A | | **instant cut** to the previous step. Selections cleared, CTA disabled | cut, reset state |
| back on I | | POP (§3.2) to H | |
| back on W | | not tested; treat as back to M (cancel) | cut to M |

### 3.4 Other taps
| tap | video | clone |
|---|---|---|
| H row "송금 확인증 (계좌이체 확인증)" (card 1 row 2) | PUSH I | PUSH I |
| H card 2 "송금 확인증 (계좌이체 확인증)" | not tapped | same as above |
| H other rows, search icon | not tapped | no-op (repo convention: unbuilt buttons do nothing, no dialog) — §5 |
| I "언어 / 국문" | not tapped | no-op |
| L search field, chips | not tapped | §5 |
| M "이메일", "팩스" | not tapped | no-op |
| D "확인했어요" | not tapped | leave the flow: return to E (pop every cert entry; §5) |
| V share icon | not tapped | no-op |

---

## 4. Data and server

### 4.1 Client data per screen
| screen | needs | source |
|---|---|---|
| H | static lists | constants (§5 for invented groups) |
| I | static | constants (only 송금 확인증 is built) |
| A | Toss accounts ("사용중인 통장"): product name, number, opened date. Linked other-bank accounts ("오픈뱅킹 연결한 통장"): `bank.short`, number | `GET /api/home` → `accounts` (bank toss vs others; see infra §4 for the main-account bank-code trap) |
| L | sent transfers of the chosen account, newest first: `id, at, holder, amount` | **existing** `GET /api/transfers?from=<accountId>` (`SENT` filter already excludes incoming records) |
| L grouping | header `MM월 DD일` (zero-padded) from `at`. Sub `HH:MM \| 출금`. Amount `-${amount.toLocaleString('ko-KR')} 원`. Search (if built): substring on holder, or digits on amount | client |
| D / V document | profile `userName`; per transfer `at, holder, amount, bank{name}, number, memoTo, fromNumber`; source account bank name | `GET /api/home` (profile + accounts) + `GET /api/transfers?from=` (or `/api/transfers/:id` each). `toTransfer` already returns `fromNumber`, `bank`, `memoTo` (defaults to `userName`) |
| D / V issue meta | 발급일자 `YYYY년 M월 D일` (issue moment, local); 발급번호 `NNNN-AAAA-AAAAAAAA` | client: `at = Date.now()` when "휴대폰에 저장" is tapped, carried in the URL; issue number = deterministic hash of (`ids`, `at`) → 4 digits, 4 + 8 uppercase letters. Reload-safe, no server state |

### 4.2 Server changes
1. **Account opened date** (for "개설일 YY.MM.DD"): add nullable `accounts.opened_at TEXT` ('YYYY-MM-DD') in `migrate()`, expose it as `openedAt` in `toAccount`,
   and set it in the toss seed. Fallback when null: the date of the account's oldest transaction, else hide the line.
2. Nothing else is required. Optionally add `fromBank: bankInfo(...)` to `toTransfer` so the doc does not need the accounts list.
3. **Seed requirement** (owner: account/transfer seed): the Toss account must have ≥4 **sent** transfers on ≥3 different dates.
   At least one should go to the profile's own other-bank account, so 받는사람 = own name, as in the recording.
   The seed also needs ≥1 linked other-bank account so "오픈뱅킹 연결한 통장" is not empty.
   For transfers sent *from* that other-bank account, L may be empty (§5).

### 4.3 Suggested routes and ScreenStack kinds
`/cert` (H) · `/cert/transfer` (I) · `/cert/transfer/account` (A) · `/cert/transfer/items?account=` (L) · `/cert/transfer/method?account=&ids=` (M) ·
`/cert/transfer/issuing?…` (W, navigates with `replace` to D) · `/cert/transfer/done?account=&ids=&at=` (D) · `/cert/doc?account=&ids=&at=` (V).

ScreenStack:
- Transitions between two `/cert/transfer/*` routes = **cut** (no animation, both directions).
- Into `/cert`, `/cert/transfer` (from `/cert`) and `/cert/doc` = activity PUSH (§3.1). Leaving them back = POP (§3.2).
- Keep `/cert/doc` outside the `/cert/transfer/` prefix so the resolver stays a prefix test.
- Galaxy back = `history.back()` everywhere.
- "확인했어요" = `history.go(-k)`, where k = number of cert entries above E. Carry a `certDepth` in `location.state`, as hana's 취소 → `go(-2)` does.

---

## 5. Not visible in the video: invent (defaults)

1. **H below the fold.** Card 2 "통장·예적금" continues after 자동이체 확인증. Further cards in the same style (all invented, all no-op rows):
   "대출" (부채 증명서, 대출 거래내역서, 이자 납입 증명서, 대출 완제 증명서), "카드" (체크카드 이용내역서), "세금" (이자소득 원천징수영수증, 연말정산용 증명서).
   24 dp bottom padding.
2. **Only 송금 확인증 works.** Other certificate rows and the search icon do nothing (repo convention).
   Alternative if the owner prefers: open I with that certificate's name and description, and make "발급하기" a no-op.
3. **"모두 선택"** toggles all rows. Its circle is filled when all rows are selected. CTA "N건 선택" for N ≥ 1.
4. **Empty states.** No sent transfers on the chosen account → L shows "발급할 수 있는 내역이 없어요" (15 / 500 `#8f8e91`, centred at y≈420),
   "모두 선택" hidden, CTA disabled. No linked other-bank account → hide the "오픈뱅킹 연결한 통장" section.
5. **Chips and search on L.** v1: chips are no-op. The search field filters as you type (client). Use the shared Korean keyboard component
   if transfer.md builds one, otherwise the native input. Default filter text stays "모든 기간" / "입출금".
6. **Many rows.** The data table fits ≈15 rows per page (row pitch 22 units: 2 lines × 8 + 6 gap, between y 123 and the footnote, ≤ y 440).
   Paginate with the footer on each page and "p/n". D previews page 1. V stacks pages with 19.2 dp gaps and scrolls.
7. **Back on W** cancels to M. **"확인했어요"** returns to E with a POP.
8. **Timings** (clone, compressed): H content +250 ms; I content +600 ms; I→A blank 250 ms; A→L blank 300 ms; W 2.6 s; D skeleton 600 ms;
   D→V idle 400 ms. Video values are in §1 and §3.
9. The WebView "+53.6 dp then jump" on H and the black secure-window gap on W are **not** reproduced.

---

## 6. Personal data seen → placeholders (no real values recorded)

| role | where it appears | placeholder | format |
|---|---|---|---|
| Recorder's name (account holder) | doc statement, 받는사람 / 보낸사람 / 받는통장 표시 in the doc row, L row name (own-account transfer), E | `<NAME_A>` | 3 Hangul syllables |
| Counterparties (recipients) | L rows 2–4 | `<NAME_B>`, `<NAME_C>`, `<NAME_D>` | 3 Hangul syllables |
| Recorder's Toss Bank account number | A row 1, doc 보낸 은행 계좌 | `<ACCT_TOSS>` | 12 digits, 4-4-4, shown dashed; doc appends "(토스뱅크)" |
| Account opened date | A row 1 "개설일" | `<YY.MM.DD>` | 2-digit year |
| Recorder's other-bank (하나) account number | A row 2 (dashed), doc 받는 은행 계좌 (digits only + "(하나은행)") | `<ACCT_HANA>` | 14 digits, 3-6-5 |
| Transfer amounts | L rows, doc 금액 | `<AMOUNT_1…4>` | "-N,NNN 원" (L), "-N,NNN" (doc); 4–6 digits |
| Transfer dates and times | L date headers and subs, doc 거래일자 | `<MM월 DD일>`, `<HH:MM>`, `<YYYY-MM-DD>` `<HH:MM:SS>` | zero-padded |
| Issue date | doc footer 발급일자 | `<ISSUE_DATE>` | `YYYY년 M월 D일` (recording day) |
| Issue number | doc footer 발급번호 | `<ISSUE_NO>` | 4 digits - 4 uppercase letters - 8 uppercase letters |
| Status-bar clock and notification icons | all frames | infra §1.2 | |
| (public, not personal) bank verification URL and customer-centre number | doc footer | dummy in the clone (§2.10) | URL path `/customer/verify-document`; phone `NNNN-NNNN` |

---

## 7. Assets

| id | asset | how | source (video A pts, px box x0,y0,x1,y1 on 480×1066) | privacy |
|---|---|---|---|---|
| C1 | Toss Bank symbol on a dark tile (A row 1) | prefer the toss symbol asset from home / account specs, or SVG. Crop fallback, ESRGAN pipeline if needed | 71.773 (frame 2410), (28,290,69,330). Existing crop: `frames/cert/crops/C1_tile_tossbank(_x4).png` | **OK**: logo only, no text |
| C2 | Hana Bank square logo on a dark tile (A row 2) | crop, or reuse the transfer spec's bank-logo set if it matches Toss's square style | 71.773 (frame 2410), (28,444,69,485). Existing: `crops/C2_tile_hana(_x4).png` | **OK**: logo only |
| C3 | "toss bank" symbol + wordmark (black) in the doc | **SVG redraw** (public brand mark). The crop is only 1.25 px/dp at 9 dp tall, too small | 92.236 (frame 3000), (32,738,102,754), reference only | OK (logo only) |
| — | red seal in the doc | **do not crop or reproduce** (safety rule). Placeholder SVG | — | — |
| — | doc icon on the E row | account.md T19 | — | OK |
| — | back arrow, search, share, chevron right / down, check, check circle (outline, filled with knocked-out check), loading dots, rings, progress bar | SVG / CSS | — | — |

Never crop from L, D or V for anything else. Those frames contain names, numbers and amounts.
