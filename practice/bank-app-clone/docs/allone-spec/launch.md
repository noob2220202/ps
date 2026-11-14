# allone (NH올원뱅크) — launch sequence, recording intro, PIN, loading spinner, 정기점검 sheet

Area: C1 0–14 s (iOS home → app open → white launch → splash → PIN → loading → home + notice sheet), plus the all-one loading
spinner/dim wherever it appears (C2, C3) and the notice sheet's reappearances (C3).
Device: iPhone, 1180 × 2556 px = 393 × 852 pt, **1 pt = 3.0025 px**, light mode. All times are real pts (ffprobe). C1 is 60 fps
with one duplicated frame (no frame at 3.400; 3.383 → 3.417). C2/C3 are gap-free 60 fps. Coordinates below are pt on the 393 × 852
screen unless marked px. "ink" = measured glyph/shape bounding box, not the CSS line box.
Fonts: sizes are **Pretendard fits** (rendered Pretendard at 3.0025 px/pt and matched ink width + height to the recording); the app
itself is a hybrid web view whose face is not Pretendard (likely the iOS system Hangul face), so use these fitted values, not the
app's px values.

Skipped / excluded in this area: C1 ≈ 2.283–3.367 excluded system alert (skip — the clone goes straight from the white
launch screen to the splash). C3 ≈ 12–19 s and ≈ 33.0–34.6 s are excluded ranges — skipped. C3 ≥ 42.4 s and
the 4th clip — excluded.

---

## 0. Global chrome facts discovered here (affect every allone screen)

| fact | measured | evidence |
|---|---|---|
| Top band | **0 – 59.0 pt is a native white band** (#FFFFFF) on every app screen, even on the green PIN page. Status-bar glyphs black. | PIN frame C1 7.333: white to y 176 px, green from 177 px |
| Web view | **59.0 – 817.3 pt** (= iPhone safe area 59 / 34.7). Below 817.3 a native **white band** (34.7 pt). | C1 6.317 (PIN without keypad): green ends 2453 px; home C1 13.9: white below tab bar |
| Dims | Both the loading dim and the notice-sheet dim cover **only the web view (59.0–817.3)**; top/bottom bands stay pure white, status glyphs never dim. | C1 10.0: y ≤ 176 px = 255, y ≥ 2454 px = 255 |
| Home indicator | Visible only during app launch (C1 1.15–2.0 s), then auto-hidden for the rest of the recording. | §2.4 |
| Island | Same recording-mode island as kakao2: 107.2–279.4 × 11.0–48.3, red dot centre (125.5, 29.45) Ø 12.66, pulse period **1.500 s** (brightness minimum at C1 0.62 + 1.5k s). Reuse `K2Island`. | C1 0–9.8 |
| Status bar | Clock ink centred at **x 59.8** (no location arrow/moon here — kakao2's 50.46 was shifted by the arrow), ink y 23.3–35.3. **Dual-SIM signal**: 4 columns 3 pt wide at x 292.1 / 297.1 / 302.1 / 307.1; upper bars bottom 30.6, tops 26.6 / 26.0 / 24.3 / 22.6; lower row of 4 dots y 32.0–35.6; all filled. LTE ink 316.1–334.4 × 25.0–34.3. Battery ink 340.7–366.7 × 22.6–35.6 (≈ kakao2 BATT + 1.3 pt), fill black, empty part #B3B3B3, number white inside. | C1 7.333 |

Values are drawn live: clock = current time, battery = configured level (never the recorded ones).

---

## 1. Screen / state inventory

| id | what | clip + pts | notes |
|---|---|---|---|
| S0 | iOS home screen (intro) | C1 0.000 – 0.900 | static except the island dot; wallpaper slowly shifts by ≤ 3 levels (irrelevant, replaced) |
| S0p | all-one icon **pressed** | C1 0.650 – 0.900 (press frame 0.650, 1 frame, no scale) | release begins 0.917 |
| T0 | app open = **dissolve to white** (no zoom) | C1 0.900 – 1.150 (first change 0.917, fully white 1.150) | status glyphs white → black 0.933 – 1.183 |
| S1 | white launch screen | C1 1.150 – 2.283 | pure white + status bar + home indicator (1.15–2.0) |
| — | excluded system alert | C1 2.283 – 3.367 | **skip** |
| S2 | splash | fade-in C1 3.400 – 3.667, static to 6.050 | full-screen native view, no animation after fade-in |
| T1 | splash → PIN crossfade | C1 6.050 – 6.217 | 6.183 one-frame spinner flash + 6.200 one-frame dark frame = glitches, skip |
| S3 | PIN page, no keypad yet | C1 6.217 – 6.317 | links row at bottom |
| S4 | PIN page with secure keypad | C1 6.333 – 9.900 | keypad pops in (1 frame); dots at 7.617, 8.667, 8.900, 9.133, 9.500, 9.850 |
| S5 | loading dim + all-one spinner over PIN | C1 9.917 – 12.150 | 9.917 = 4 frames after the 6th dot; home replaces PIN under the dim at 11.950; spinner off 12.100; dim off 12.150 |
| S6 | home (handoff only; layout = home spec) | C1 12.150 → | skeleton → data 12.50 → lower rows 12.70 |
| S7 | 정기점검 notice sheet + dim | C1 12.733 – 13.833 | dim fade 12.733 – 13.05; closed instantly 13.833 |
| S7' | same sheet, reappearing | C3 22.617 – 24.083 (sheet from 22.917); C3 36.350 – 38.017 (sheet from 36.850) | each time after a spinner-loaded return to home |
| L | spinner/dim instances elsewhere | C2 8.983–9.983, C2 20.067–21.133, C3 1.90–3.33, 5.18–5.58, 21.60–22.25, 26.15–26.57, 32.75–33.23, 35.23–35.90, 38.75–38.95, 39.85–39.98 | phase always starts at the coin face (phase-locked to onset) |

---

## 2. Screens

### 2.1 S0 — iOS home screen for the recording intro

**Recommendation: DRAW the home screen in DOM/SVG (no video clip at all).** Reasons: (1) the wallpaper is copyrighted album art and
personal — must not be reused, and it is behind every icon, label, the dock glass and the search pill, so it cannot be cleanly
"erased" from the video; (2) the other apps, the folder contents and the badges are personal home-screen content; (3) the recorded
home screen is static (only the press darkening), and (4) the app opens with a plain dissolve — so a drawn version is pixel-exact in
geometry and timing and needs no video asset. The recorded status bar is invisible here (white glyphs on a 255-white sky), so nothing
there needs to be matched.

Layout (measured from C1 0.600, full res):

| element | geometry (pt) | style |
|---|---|---|
| wallpaper | full 393 × 852 | **generated** neutral gradient, near-white at the top so white status glyphs are barely visible (as in the recording): `radial-gradient(120% 60% at 30% 18%, rgba(255,255,255,.85), rgba(255,255,255,0) 60%), linear-gradient(180deg, #F4F8FC 0%, #DCE8F2 22%, #B7CCDF 45%, #93AECB 65%, #7C93B4 82%, #6B7EA0 100%)`. No imagery. |
| status bar | as §0 | glyphs **white** (#FFF) |
| row-1 icons | 4 icons **64 × 64** (measured 63.3–64.0), top **80.0**, lefts **28.7 / 119.6 / 210.5 / 301.4** (pitch 90.9) | iOS continuous-corner squircle, radius ≈ 22.5 % (14.4 pt) |
| icon labels | 12 pt, Pretendard 500 (ls 0), white, `text-shadow: 0 .5px 2px rgba(0,0,0,.35)`; ink y **150.5–160.9**, centred under icon (all-one label ink x 304.4–361.7) | |
| col 4 = all-one icon | x 301.4–365.0, y 80.0–143.9 (px 905–1095 × 240–431) | bg **#0C8F2D** (sampled 11.5/143.1/45 centre), white "all NH one" wordmark ≈ 50 × 36.3 pt centred (ink y 93.6–129.9) — draw as SVG (same wordmark as splash, white). Label "NH올원뱅크". |
| cols 1–3 | generic, **not** the recorder's apps: col 1 a folder "금융" (3×3 neutral pastel mini-squircles, no logos), cols 2–3 two generic glyph apps (e.g. "메모", "캘린더" drawn as our own simple SVG glyphs). No badges anywhere. | |
| search pill | x **167.9–225.1**, y **682.1–711.4** (57.3 × 29.3), fully rounded | glass `rgba(255,255,255,.22)` + `backdrop-filter: blur(20px)`, 1 px rim `rgba(255,255,255,.4)`; magnifier + "검색" white ≈ 14 pt 600 |
| dock | x **12.0–380.3**, y **730.0–838.6** (368.3 × 108.6), radius **40** (fitted from rim: inset 28.3 @2 pt, 13.7 @10 pt, 5.3 @20.6 pt) | glass `rgba(255,255,255,.18)` + blur 24 px saturate 1.4, bright rim (top rim ≈ 1.9× interior luminance) `inset 0 0 0 1px rgba(255,255,255,.45)` |
| dock icons | 4 × 64 × 64, top **752.7**, lefts **34.6 / 121.6 / 208.5 / 295.4** (pitch 86.9) | generic: phone-handset green, chat-bubble green, compass blue, music-note red — own SVG, no badges, no labels |
| page dots / home indicator | none (iOS 26 search pill instead of dots; no indicator on home) | |

Pressed state S0p (C1 0.650, appears in one frame, no scale, no move — icon box identical 904–1095 × 240–431 px through 1.03 s):
green #0C8F2D → **#034913** (2.6/72.9/19.1), white wordmark → **#919291** (145/146/145). Implement as a palette swap (CSS vars)
on the SVG icon; the label does not change. Release at 0.917: un-darken over ≈ 100 ms ease-out, concurrently with the dissolve.

Optional alternative (not recommended): kakao2-style "app window grows from the icon". **The recording does not zoom** (scale fit
over frames 56–64 is exactly 1.00; edge detail and low frequencies fade at the same ratio → no blur either). If a zoom is ever
wanted the start rectangle is the icon box above (radius 14.4), but it would not match this recording.

### 2.2 T0 — dissolve to the white launch screen (C1 0.900 → 1.150)

- The whole home screen (icons, dock, labels) fades to white; no scale/blur. sRGB alpha blend of white over the home fits
  (residual 3–7 levels, linear-light blend fits worse).
- White alpha per frame from 0.900 (16.67 ms steps, 250 ms):
  `0, .004, .008, .039, .077, .129, .203, .285, .387, .490, .602, .713, .817, .902, .962, 1`
  → CSS: `animation: 250ms linear(0, .004, .008, .039, .077, .129, .203, .285, .387, .49, .602, .713, .817, .902, .962, 1)`
  (implement as the home overlay's opacity 1 → 0 over the already-white app).
- Status glyphs: white → black from **D+100 over 217 ms**, `linear(0, .015, .06, .14, .23, .34, .455, .57, .69, .8, .88, .95, .985, 1)` (re-measured per frame on the core pixels of
  the clock, LTE and battery fill, which agree: 0 @1.000, .055 @1.033, .224 @1.067, .448 @1.100, .69 @1.133, .88 @1.167, .98 @1.200, 1 @1.217).
  The first reading ("dissolve curve delayed 33 ms") led the clip by up to .2. `AO_INTRO.statusDelay / statusMs / statusEase`.
  Simplest: the home overlay carries its own white status-bar copy; the app's black status bar sits underneath and is revealed.
- Island stays above the overlay, unaffected.

### 2.3 Red recording dot at intro start (C1 0.0–0.6)

The dot is enlarged when the recording starts: Ø 15.0 at 0.00 → 16.65 at 0.10 → 15.3 at 0.25 → 14.0 at 0.35 → 12.66 at 0.55 s
(centre fixed at 125.5, 29.45). Clone: `scale 1.18 → 1.31 (0–100 ms) → 1.0 (100–550 ms, ease-out)` at recording start.
Pulse thereafter: period 1500 ms, brightness minimum (R ≈ 204) at 0.62 s, rise 0.65 → 0.85 s (≈ 200 ms), plateau to ≈ 1.4 s, slow
fall to the next minimum 2.12 s → reuse kakao2 `k2-rec` keyframes, phase so that a minimum lands at t = 0.62 s.

### 2.4 S1 — white launch screen (C1 1.150 – 2.283)

- Pure #FFFFFF everywhere; status bar black; island.
- **Home indicator**: black pill **140.2 × 5.0** at x 126.6–266.8, y **838.3–843.3** (radius 2.5). It belongs to the app layer
  (fades in with the dissolve), then opacity (recording time): 1.15 .41 · 1.20 .45 · 1.25 .49 · 1.30 .60 · 1.35 .72 · 1.40 .85 ·
  1.45 .88 · 1.50 .91 · 1.55 .94 · 1.60 .97 · 1.65–1.75 1 · 1.80 .85 · 1.85 .64 · 1.90 .40 · 1.95 .19 · 2.00 0. Hidden afterwards.
- Clone duration: the recording holds white until the (skipped) dialog at 2.283 and shows the splash 67 ms after the dialog closes.
  With the dialog removed: **splash fade-in starts at 2.350 s** (white hold 1.20 s after the dissolve ends). Same 1.20 s hold on a
  launch without the intro.

### 2.5 S2 — splash (fade-in C1 3.400 – 3.667, static until 6.050)

Full-screen native view (it covers the bottom band too: the ground and the MA badge reach y 851). White background. Static — the
only per-frame changes are the island dot.

| element | ink box (pt) | colour |
|---|---|---|
| "국민과 함께하는 농심천심" logo (top-left) | x 20.0–127.2, y 60.0–89.3 | multi-colour (orange/yellow, blue figure, green text) |
| "all NH one" wordmark | x 138.9–254.5, y 235.8–321.1 ("all NH" row 235.8–273.8, "one" row 283.4–321.1); "NH" x 215.8–253.5, y 257.1–273.1 | "all"/"one" **#0C8F2D**, "NH" **#10429F** |
| bubbles | blue smiley 203.2–245.1 × 435.3–480.6; pink ✕-flower 120.9–189.2 × 501.6–559.9; green heart 204.2–263.1 × 560.2–608.8; + faint small dots | 3D renders |
| ground + mascot on green sofa + horse + plant | full width, y 628.1–851.3; mint ground #DCFDE7 → #E9FEF6 at the bottom with a soft hill edge ≈ y 723 at the sides | 3D render |
| "MA" mobile-accessibility mark | x 333.1–371.4, y 788.0–830.3 | navy |

- **Crop, don't redraw** (3D illustration). One image: average of C1 **3.75 – 6.00 s** (135 frames, removes compression noise),
  px box **x 0–1180, y 177–2556** (= 59–852 pt; the status band is excluded). **Privacy: OK** — no personal data in that box (the
  status band with the recorded clock/battery is excluded). Place on a white page under the clone's live status bar.
  Optionally vectorise the wordmark (it is reused for the icon and the spinner).
- Fade-in: opacity of the splash content over white, uniform for all regions; from 3.400, 16.67 ms steps (267 ms):
  `linear(0, .188, .308, .422, .529, .624, .694, .756, .809, .855, .893, .92, .942, .964, .975, .983, 1)` — a decelerating fade.
- Hold: 2.383 s (3.667 → 6.050). Clone timeline (intro on): fade-in 2.350–2.617, hold to **5.000**.

### 2.6 T1 — splash → PIN crossfade (C1 6.050 – 6.217)

PIN page opacity over the splash, 167 ms, symmetric ease-in-out:
`linear(0, .026, .108, .236, .395, .541, .692, .82, .911, .96, 1)`. Frames 6.183 (a PIN-page spinner flashes for one frame) and
6.200 (one dark frame) are web-view glitches — **do not reproduce**. Clone: 5.000 – 5.167.

### 2.7 S3/S4 — PIN page (간편비밀번호)

Background green **#0C8F2D** (12/143/45) from 59.0 to the keypad top (503.6) — before the keypad shows, to 817.3. Text and icons
white #FFFFFF. Top band 0–59 white with black status glyphs.

| element | measured (pt) | spec |
|---|---|---|
| header | band 59–109 (centre ≈ 84) | no divider |
| title "NH올원뱅크" | ink x 145.2–248.5, y 73.9–93.9 (centred, x-centre 196.9) | custom logotype (geometric "NH"). **Crop** → white alpha mask: average C1 6.40–7.50 s, px box x 430–750, y 214–287, un-premultiply over #0C8F2D (α = (px − bg)/(255 − bg)). Privacy OK. Text fallback: Pretendard 800 22.5, ls −1. |
| globe icon | ink x 306.4–327.7, y 72.9–93.9 (Ø 21.3, centre 317.0, 83.4) | SVG: circle + vertical ellipse meridian + 2 latitude lines, stroke ≈ 1.5 white |
| menu-search icon | ink x 347.0–367.7, y 75.9–91.9 (20.6 × 16) | SVG: top full-width line, two short lines left (middle, bottom), magnifier circle + handle bottom-right; stroke ≈ 1.6, round caps |
| prompt | line 1 "간편비밀번호" ink x 148.5–244.5, y 162.5–179.5; line 2 "6자리를 입력해주세요" ink x 117.6–275.8, y 189.8–206.5 | **Pretendard 500, 19 pt, ls −0.35, line-height 27.3**, centred |
| 6 slots | each bar **25.6 × 1.33**, y **261.8–263.1**, lefts 108.9 + 30.0·i (i = 0…5), span 108.9–284.4 | white |
| dots | filled circle **Ø 16.3**, centre x = 121.7 + 30.0·i, y 245.1–261.8 (dot bottom = bar top) | the dot **replaces** its bar, instantly (1 frame, no scale/fade) |
| 자동로그인 | check-circle Ø 16.5 at x 152.2–168.5, y 298.4–315.1 (outline ≈ 1.3, check inside ≈ 7 × 5); text ink x 173.9–239.8, y 299.8–314.1; gap 5.4; group centred | Pretendard 400, 16.5, ls −0.9 |
| links row | "로그인 방식 변경하기" ink x 33.3–162.2 (centre 97.8 = ¼ width); separator x 196.2–197.8, y 463.6–473.6 (≈ 1.5 × 10); "간편비밀번호 재등록" ink x 231.5–357.7 (centre 294.6 = ¾). ink y **460.9–475.3** with keypad (28.3 above it); **769.4–783.7** without keypad (33.6 above 817.3). **Without the keypad** (C1 6.233–6.300, and under the login dim at 10.600) the row is condensed 2.6 % horizontally: ink 35.0–159.9 / 233.8–356.4, separator 1.33 × 14 at y 770.0–784.0 (with the keypad it is 1.3 × 10 at 464–474) | Pretendard 400, 16.5, ls −0.5. Pinned to the bottom of the visible web area. |
| keypad | white #FFFFFF, **503.6 → 852** (348.4 tall, covers the bottom band); no divider, no key borders | native secure keypad |
| keypad grid | 3 equal columns of 130.5 with a 0.75 inset (digit centres **65.9 / 196.5 / 326.9**); 4 rows, centres **543.8 / 621.7 / 699.4 / 777.5** (pitch 77.9); 35.5 pt empty below row 4 | |
| digits | 10 digits fill rows 1–3 (all 9 cells) + row 4 centre; ink height 16.3 | **Pretendard 500, 22.5 pt, #000** |
| ↻ (re-shuffle) | row 4 left, ink x 54.6–77.3, y 764.0–790.7 (22.6 × 26.7) | SVG: two opposing arcs with chevron heads (upper-left head pointing left, lower-right pointing right), stroke ≈ 1.5 black |
| ⌫ | row 4 right, ink x 311.1–343.0, y 766.7–788.0 (32 × 21.3) | SVG: left-pointing pentagon outline + ✕ inside, stroke ≈ 1.6 black |

Keypad behaviour:
- Pops in at once **117 ms after the crossfade ends** (C1 6.217 → 6.333); the links row jumps from 769.4 to 460.9 in the same frame.
  Clone: 5.283 s (intro timeline).
- Layout is a **random permutation of 0–9** into the 10 digit cells, chosen when the page mounts; it does **not** change between
  key presses (constant over all 6 presses). ↻ re-shuffles (not exercised — instant re-render, invented).
- **No visible pressed state** on keys (no highlight in any frame). Each press adds a dot in the next frame.
- ⌫ removes the last dot (dot → bar instantly; invented, not exercised). Input after the 6th digit is ignored.
- After the 6th dot (C1 9.850) → **+67 ms** (9.917) the keypad disappears and the loading dim + spinner appear in the **same frame**
  (no fade). The 6 dots stay visible under the dim; the links row drops back to 769.4.
- **The clone's PIN is purely visual: any 6 digits proceed; digits are never stored, logged, sent to the server or written to
  storage** (component state only, cleared on unmount). No wrong-PIN/error state exists. Real auth stays the existing cookie
  session (`bank_sid_allone`).
- Desktop convenience (invented): keys 0–9 / Backspace map to the keypad.

### 2.8 S5 / L — loading dim + all-one spinner

**Dim**: `rgba(55,55,55,.68)` over the web view only (59.0–817.3). Fitted per channel on a full colourful page (C2 20.0 vs 20.5:
k = 0.345, c = 55.3 equal on R/G/B) and on the PIN page (white 255 → 117, #0C8F2D → 45/80/55): white → 118–124 across instances.
Appears in **one frame**, disappears in **one frame** (no fade).

**Spinner** (same everywhere): centred on the **screen** (196.5, 425.8) — not on the web view. Face phase: glassy coin **Ø 61.0**
(166.2–227.1 × 395.7–456.3), face #1AC66D (26/198/109) with a darker outer ring ≈ #16B758 and a thin light rim highlight, white
"all NH one" wordmark ink 177.2–215.8 × 412.0–439.6 (63 % of the diameter). The animation is rendered at **30 fps** (each pose
held 2 frames) and loops every **1.467 s** (88 frames, autocorrelation minimum; phase starts at the face on every onset):

| t from onset | pose |
|---|---|
| 0 – 0.05 | face, still |
| 0.05 – 0.23 | coin turns about the vertical axis (≈ 0 → 40°), glass edge thickness visible on the left |
| 0.23 – 0.37 | edge-on twisted glass ribbon (≈ 15 pt wide), then swells into a glass drop/sphere |
| 0.43 – 0.57 | back face (mirrored wordmark) turning, narrowing to a twisted ribbon again |
| 0.63 – 0.77 | front face returns |
| 0.77 – 1.10 | small settling wobble |
| 1.10 – 1.467 | face, still |

Implementation options: (a) **recommended**: SVG coin (radial green + rim + white wordmark) with a CSS `rotateY` keyframe loop
(1467 ms: 0 % 0°, 3 % 0°, 16 % 40°, 25 % 90° + scaleY 1.05, 39 % 180° (mirrored back), 46 % 270°, 52 % 330°, 60 % 360°, 60–75 %
± 4° wobble, 75–100 % 360°), optionally `steps()` to 30 fps; (b) higher fidelity: 44-frame sprite from **C1 9.950 – 11.417**,
px box **x 440–740, y 1130–1430**, background uniform dim-green (45/80/55) — matte against that known colour. **Privacy: OK** (PIN
page centre is empty green; dots at y ≤ 262 and links at 769 are outside the box). Do not cut spinner frames from C2/C3 (page
content under the spinner).

Hide order: spinner disappears 1–3 frames before the dim (C1: 12.100 vs 12.150; C2: 21.117 vs 21.133) → hide spinner, +33 ms dim.
Observed durations: login 2.233 s (C1); navigation 0.65–1.45 s (C2/C3). A global `showAlDim() / hideAlDim()` (like kakao2
`dim.ts`) — the screen that triggers shows it, the next screen hides it.

### 2.9 S5 → S6 handoff after login (C1)

| t from 6th dot (9.850) | event |
|---|---|
| +67 ms (9.917) | keypad off, dim + spinner on |
| +2.100 s (11.950) | under the dim the PIN page is replaced by the home (skeleton) — spinner keeps looping |
| +2.250 s (12.100) | spinner off |
| +2.300 s (12.150) | dim off → home visible (skeleton blocks, account card empty) |
| +2.65 s (12.50) | account card filled; +2.85 s (12.70) lower rows (home spec) |
| +2.883 s (12.733) | notice sheet + dim start |

Clone: mount the home under the dim at onset + 2.033 s with data prefetched during the dim; keep a minimum dim of 2.233 s
(constant, e.g. `AL_LOGIN_LOADING_MS`), extend while `/api/home` is pending.

### 2.10 S7 — "11월 시스템 정기점검 안내" sheet

Sheet: white, top at **490.6**, to the bottom of the screen; top corners radius **24** (fitted: inset 17.1 @1 pt, 12.4 @3, 5.3 @9,
1.75 @15). No grabber, no divider, no shadow visible.

| element | ink (pt) | style |
|---|---|---|
| title "{M}월 시스템 정기점검 안내" | x 33.6–289.4, y 531.6–553.9; "정기점검" x 158.5–241.1 | Pretendard 700, 25 pt, ls 0, #000; "정기점검" **#008B1E** |
| item 1 title "NH인증서 서비스 일시중단" | x 31.0–204.5, y 599.8–615.2 | Pretendard 600, 17.5, ls −0.7, #000 |
| item 1 date line "· MM/DD(요일) HH:MM ~ MM/DD(요일) HH:MM" | x 31.0–275.8, y 624.8–639.5 | Pretendard 600, 15.5, ls 0.1, **#00821F** |
| item 2 title "전자금융 서비스 일시중단" | x 30.3–195.2, y 665.8–681.1 | as item 1 |
| item 2 date line | x 31.0–275.8, y 690.1–705.4 | as item 1 date |
| bell illustration | x 298.1–359.7, y 632.1–693.4 (61.6 × 61.3) | 3D yellow bell + red "!" badge (top-right). **Crop**: average C1 12.80–13.80 s, px x 880–1090, y 1880–2090, on white (sheet is opaque) — **privacy OK**. Fallback: Fluent 3D "bell" emoji (MIT, already used as fallback art in the repo) + CSS red badge Ø ≈ 14 with white "!". |
| page indicator | active pill x 140.5–161.2, y 752.0–762.7 (20.6 × 10.3, r 5.15) **#0A902B**; 4 dots Ø 10.3 at x 168.5 / 186.5 / 204.5 / 222.5 (pitch 18.0, gap 7.3) **#878B94**; pause "II" x 242.8–249.8, y 752.4–762.4 (two ≈ 2 pt bars) **#727272** | carousel of 5 pages with a pause control |
| "1일동안 안보기" | x 26.0–104.6, y 786.0–798.7 | Pretendard 400, 14.5, ls −0.6, **#353535** |
| "닫기" | x 346.4–367.7, y 786.0–798.7 | same |

Behaviour:
- Appears on the home **0.35–0.6 s after the dim/spinner lifts** (C1 +0.583; C3 +0.37, +0.45) → clone 500 ms.
- Dim **`rgba(0,0,0,.30)`** over the web view (fit k ≈ 0.70 on R/G/B, white → 178), fades in **300 ms `ease`** (measured 0 → 1:
  .065 @17 ms, .31 @50, .51 @83, .68 @117, .82 @167, .935 @217, 1 @317).
- The sheet itself **pops in without sliding** (best vertical shift between consecutive frames = 0). In C1 it appears in the dim's
  first frame; in C3 it appears after the dim has finished (+0.30 / +0.50 s). Clone: with the dim's first frame (C1 = launch).
  The bell image appears 2 frames after the sheet (image load) — don't reproduce.
- **닫기** (what the recorder used — the sheet comes back later the same day): sheet + dim removed in **one frame** (C1 13.833,
  C3 24.083, 38.017).
- Reappears on every **fresh load of the home** — after login, and after a flow exits to home through the spinner (C3: amount
  page "취소" → spinner 0.65 s → home → sheet). Not after a plain back-pop to an already mounted home (invented rule).
- Active page never changed in the 1.1–1.5 s it was open → auto-advance unobserved (see §5).

---

## 3. Interactions & transitions — clone timeline (intro ON, t = recording start)

| t (s) | event | source |
|---|---|---|
| 0.000 | drawn iOS home, island dot enlarged → shrinks by 0.55 | C1 0.000 |
| 0.650 | scripted press: all-one icon pressed palette (1 frame) | C1 0.650 |
| 0.900 – 1.150 | release + dissolve to white (§2.2); status glyphs → black (D+100 → D+317) | C1 0.900 |
| 1.150 – 2.000 | white launch screen; home indicator curve (§2.4) | C1 |
| 2.350 – 2.617 | splash fade-in (§2.5) | C1 3.400 − 1.050 (dialog removed) |
| 5.000 – 5.167 | crossfade to PIN | C1 6.050 − 1.050 |
| 5.283 | keypad pops in | C1 6.333 − 1.050 |
| user | 6 digits → +67 ms dim + spinner → +2.033 home under dim → +2.183 spinner off → +2.233 dim off → +0.5 s notice sheet | C1 9.85–12.73 |

Intro OFF / normal launch (profile pick, refresh): white launch 1.20 s → splash fade-in → hold 2.383 s → PIN (same curves).
`?skip` warm start → straight to home (dev only). No touch indicator is drawn (iOS shows none).

Recorder wiring (proposal): a new intro kind "drawn" in `recorder.ts` (no video sources): mount `<AlIosHome>` as an overlay above
the viewport and the status bar but below the island, start the app's boot at the white launch phase underneath, run the timeline
with WAAPI animations whose `startTime` = recording start, remove the overlay at 1.150. No `keepCapturing`/video-end tricks
needed. Wait for fonts and icon SVGs before starting the capture.

---

## 4. Data each screen needs / server

| screen | data | source |
|---|---|---|
| status bar (all) | current time, battery level | existing `useNow()`, `useDeviceStatus()` |
| intro home | none (static config: icon set, labels, wallpaper) | client constants |
| splash | static image | asset |
| PIN | nothing from the server; random keypad permutation (client) | — |
| loading → home | prefetch `GET /api/home` (and `/api/profile`; `/api/auth/me` already loaded) during the dim | existing endpoints |
| notice sheet | `{M}` = current month; 5 pages of static copy; dates **computed** from today (e.g. next Friday 23:50 → Saturday 02:00, next Sunday 23:55 → Monday 04:00) in the format "· MM/DD(요일) HH:MM ~ MM/DD(요일) HH:MM"; "1일동안 안보기" until next local midnight | client constants + `localStorage` (per-viewer convenience, try/catch, renders fine without it) |

No new server endpoints are needed for this area. DevPanel (🔔 → 기본): `정기점검 안내 켜기/끄기`, `1일동안 안보기 지우기`;
phone switch row: `인트로 켜기/끄기` (iPhone fixed, always visible, like kakao2).

---

## 5. Not visible in the recording — invented defaults

- Drawn iOS home content: generated gradient wallpaper, generic folder/app/dock icons and labels, no badges (§2.1).
- White-launch hold 1.20 s (the recording's 2.25 s included the skipped dialog).
- PIN: ⌫ removes last dot instantly; ↻ re-shuffles instantly; 자동로그인 toggles a filled-circle state (visual only); globe, menu,
  "로그인 방식 변경하기", "간편비밀번호 재등록" → no-op; any 6 digits succeed; keyboard input on desktop.
- Notice sheet pages 2–5: neutral bank notices with the same layout (e.g. 앱 업데이트 안내, 고객센터 운영시간 안내,
  개인정보처리방침 개정 안내, 이벤트 안내) and the same bell art; auto-advance every 4 s with a 300 ms horizontal slide, swipe
  between pages, pause "II" ↔ play "▶" toggle; tapping the dim does nothing; "1일동안 안보기" hides it until tomorrow.
- Loading minimum durations: login 2.233 s; navigation default 0.7 s (observed 0.65–1.45).

---

## 6. Personal data seen in this area → placeholders (never write the values)

| role | where | placeholder / handling |
|---|---|---|
| recording clock | status bar, all frames | `<REC_TIME>` (H:MM) — clone draws the live clock |
| battery level | status bar | `<BATT_PCT>` — clone uses the configured level |
| wallpaper (album artwork, copyrighted + personal) | C1 0–1.15 | **not reused**; generated gradient |
| installed apps, folder contents | C1 0–1.15 row 1 + dock | generic icons |
| notification badge counts | C1 0–1.15 (folder, dock apps) | none |
| PIN digits / which keys were pressed | C1 7.6–9.85 | not visible (no key highlight); never documented; clone stores nothing |
| customer name in home header | C1 12.15–14.0 (under the dims) | `<NAME_A>님` (seed 홍길동) |
| account number on the home card | C1 12.5–14.0 | `<ACCT_A>` format `###-####-####-##` |
| balance | C1 12.5–14.0 | `<AMOUNT>원` |
| counterparty names / numbers / amounts in C3 flows near the sheet reappearances | C3 19–36 | `<NAME_B>`, `<ACCT_B>`, `<AMOUNT>` (other specs) |

Scratch frames for this area: `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/allone/frames/launch/`
(never commit; includes frames with the personal data listed above).
