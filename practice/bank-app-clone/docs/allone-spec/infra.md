# allone (NH올원뱅크) — infra spec: codebase map + device chrome

Area: everything needed to add app id **`allone`** (NH올원뱅크, NH농협은행's app; not NH 콕뱅크 = `nh`) as its own server/app:
port **9119**, dev vite **5182** / API **8796**, data `server/data-allone/`, cookie `bank_sid_allone`, `APP_NAME` "올원뱅크",
**iPhone + LIGHT fixed**, **with a recording intro** (home screen → tap the all one icon → app launch).
Screens themselves belong to other specs. This file covers the plumbing checklist, the traps, what to reuse from kakao2, and the measured device chrome.

Privacy: no value from the recordings appears below. That excludes names, account numbers, balances, amounts, transaction dates, clock times, phone numbers, codes, and
the identity of the wallpaper or of other installed apps. Only formats, UI labels, product/brand names, geometry, colours and timings are given.
Excluded content is not specified: C1 ≈ 2.28–3.33 s (iOS paste-permission alert), C3 ≈ 12–19 s (withdrawal-block notice), C3 ≥ 42 s and all of C4.
Scratch evidence: `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/allone/frames/infra/` (frames, crops, tiles).
Measuring scripts: `.../scratchpad/allone/tools/infra/` (`sb_measure.py`, `dimscan.py` (streaming), `motion.py`, `c1_launch_scan.py`, `splash_scan.py`,
plus a scratch copy of `src/` used for the type-check in §3).

Repo baseline when this was written: working tree clean at `da92cb1`. `npx tsc -p tsconfig.app.json --noEmit` exits 0 (TypeScript 7.0.2).

Coordinates: x pt = px / 3.0025 (1180 / 393). Layout bands use y pt = px / 3.000 (2556 / 852, exact).
Status-bar glyph y values are given in the kakao2 convention (px / 3.0025) so they can be compared directly with `src/kakao2/StatusBar.tsx` constants.
The two conventions differ by ≤ 0.12 pt there.

---

## 0. Key decisions / findings (read first)

1. **Same device as kakao2.** It is the same 393 × 852 pt iPhone: recording island 107.2–279.4 × 11.0–48.3, red dot Ø ≈ 12 at (125.7, 29.6), and a 1.5 s dot pulse
   (11 peaks in C1, mean period 1.48 s). So the frame, island, red dot and `BLINK_MS` 1500 are **identical to kakao2**, and `K2Island` can be imported as is (§6).
2. **Different screen model from kakao2.** NH올원뱅크 is a WebView inside a native shell. The recording shows **three fixed bands**:
   - native status band 0–59 pt, always white;
   - web area 59–818 pt;
   - native bottom band 818–852 pt, always white, with **no home indicator** in-app.

   Web loading dims and web sheet scrims cover **only 59–818**: the status band and bottom band stay at 255 in every sample of C1, C2 and C3.
   Two native sheets (금액 입력 keypad sheet, 계좌 비밀번호 입력 sheet) dim the **whole window**, status band included.
   kakao2's model is different: there each screen paints its own 54 pt band under a transparent status bar.
   For allone: inset `.phone__viewport` to 59/34, have the frame draw the white bands, and add a full-window "native" layer (§1.4, §2.13).
3. **New app WITH intro on its own server.** Today `INTRO` means "is a VARIANT" (`kbank2`/`ibk2`/`kakao2`), and `APP` is derived from it (`server/db.mjs:28-29`).
   allone is not a variant, so add `INTRO_APPS = ["allone"]` and decouple APP from INTRO (§2.1).
   The client then gets `HAS_INTRO` from `window.__BANK_INTRO__` (prod) or `VITE_INTRO=1` (dev). No client derivation change is needed. `KAKAO2` / `IBK2` stay false because they also test APP.
4. **The intro cannot use recorded frames.** The home screen shows album-artwork wallpaper (copyrighted and personal), notification badges and other installed apps.
   kakao2 could reuse 25 App-Library frames. allone must **draw** the home-screen scene: a neutral wallpaper, neutral placeholder icons, the all one icon, and a generic dock and search pill.
   Then play the press → zoom → white → splash sequence with the measured timings (§1.7, §7).
   This needs a new recorder branch (the existing `IntroCfg` path expects a `<video>`).
5. **TS7 catches only three places** when `AppName` gets `"allone"` (verified in a scratch copy): `App.tsx:135` TS7053, `App.tsx:188` TS2339, `session.ts:45` TS2741.
   Everything else falls through silently to kakao, NH, generic-iOS or "not locked" behaviour (§3).
6. **App id ≠ bank code, and the bank code is another app's id.** NH농협은행's bank code is `nh`, which is also NH 콕뱅크's app id.
   `allone` is not a bank code, so `POST /api/accounts`' default `bankCode = APP` returns **400 "은행을 골라 주세요"** for allone (§4).
   All allone NH accounts must be stored with `bank_code = 'nh'`. Assets and classes must never use `nh-` (콕뱅크 owns 141 `nh-*` assets): use `allone-` for assets and `ao-` for CSS.
7. **Pushes are instant cuts.** Every screen change in C2/C3 is a single-frame cut, usually behind the green all-one loading spinner and the web dim.
   There are no iOS slide pushes. allone needs its own ScreenStack branch: no animation, and probably no edge-swipe (§2.14). Today it would get the generic iOS 420 ms push and swipe-back.
8. **Odd-width recording fix applies to allone too.** `recorder.ts:193` snaps the 393-wide phone to device pixels only for `KAKAO2`.
   allone is also 393 wide, so without `|| ALLONE` the recording width jitters 392/394 px (the kakao2 bug fixed in `ffcb727`).

---

## 1. Device chrome measured from the recordings

### 1.1 Frame and bands
| item | value | evidence |
|---|---|---|
| frame | 393 × 852 pt, corner radius 55 (same rule as `html[data-kakao2]`) | 1180 × 2556 px, same device as kakao2 |
| status band | **0–59 pt, white #ffffff**, native | PIN screen green starts at px 177 = 59.0 pt (C1 7.0 s); loading dims start at px 177 |
| web area | **59–818 pt** (759 pt) | web dim ends at px 2453/2454 = 818.0 pt (C1 10.3 s, C2 9.0 s, C3 21.7 s) |
| bottom band | **818–852 pt (34), white**, native, never dimmed by web dims | rows 2454–2555 stay 255 under every web dim |
| home indicator | hidden in-app; only visible right after launch (§1.3) | no dark bar at y 839–844 in any in-app sample |

### 1.2 Status bar (iOS, light, recording iPhone): compare with `K2StatusBar`
All glyphs are black (`fg dark`) on the white band in every in-app frame. Under the native dims the clock may go white (§1.5).
Draw it as one 393 × 54 SVG overlay, as K2 does. The glyphs sit in y 22.6–35.7, so the extra 5 pt of band (54 → 59) is empty white.

| glyph | allone (x pt, y pt) | kakao2 constant | delta |
|---|---|---|---|
| clock "H:MM" | Pretendard 600 16.2 px as K2. Ink y 23.65–34.97 (cap 11.3). **Ink centre x ≈ 60.2** (60.0–60.45 across three minutes; first ink 41.3–42.6) | `CLOCK_X` 50.46 (centred with the indicator to its right) | **no indicator next to the clock in any allone frame** → centre the clock alone. The K2 clock + arrow group centre is 59.1, so this is consistent with iOS centring the left group |
| indicator (moon / location arrow) | none | moon / bubble / arrow | drop it |
| signal | **dual-SIM glyph**: 4 columns, each 3.0 wide, at x 292.09 / 297.09 / 302.08 / 307.08. Top row = bars bottom-aligned at 30.64, tops 26.64 / 25.98 / 24.31 / 22.65. Bottom row = four 3.0 × 3.67 dots at y 31.97–35.64. All filled #000 | single row of 4 bars, 2 off, x 291.09–309.08, bottom 34.97 | new glyph, +1.0 pt right |
| LTE | ink 316.07–334.39 × 24.98–34.30 (same font/scale as K2) | 315.07–333.39, baseline 34.30 | +1.0 pt |
| battery body | x **340.72–364.36** (23.64), y 22.65–35.64 (12.99), rounded. Fill #000 from the left at **level / 100 × width** (measured 0.507 at 50 and 0.493 at 49). Empty part: black at **fill-opacity .333** on white → 168–179 measured; K2 dark-fg value is the same | x 339.4 + 23.6, y 22.7 + 12.9 | +1.33 pt |
| battery cap | x 365.36–366.69, y ≈ 27.3–30.6, black at fill-opacity ≈ .31 | `M364 27.63A1.35 1.455 …` | +1.33 pt |
| battery number | knocked out (mask) as in K2. Digits ink y 25.33–33.33. **Centre x 352.54** | `numX` 351.2 | +1.34 pt |
| default battery | the recording shows 50 (C1, C2) then 49 (C3). Use 50 | `deviceStatus.ts:16` `KAKAO2 ? 50 : 62` | add `ALLONE` |

Clock format is the existing 24-hour-style `H:MM` without AM/PM, the same as `useNow()` formatting in K2. Battery and clock come from `useDeviceStatus()` / `useNow()`.

### 1.3 Dynamic island, red dot, home indicator
- **Recording island** 107.24–279.43 × 10.99–48.29 (K2 `.dynamic-island--k2rec`: 107.41–279.27 × 11.23–48.05, half-value edges). **Same.**
- **Red dot** ink 119.90–131.56 × 23.98–35.30, centre (125.73, 29.64) (K2: Ø 12.1 at (125.68, 29.53)). **Same.**
  Pulse period 1.5 s (C1 peaks every 1.50 s, apart from the first two). Reuse `k2-rec` keyframes and `BLINK_MS` 1500.
  The dot is **not dimmed** by the native full-window dims (C3 6.5 s, R 255), so the native layer must sit under the island.
- **Home indicator** (launch only): **139.6 × 5.0 pt, x 126.9–266.4, y 839.0–844.0 (8 pt from the bottom), #000** on the white launch window (C1 1.70 s).
  This is the generic `.phone--ios .phone__home-indicator` geometry (140 × 5, bottom 8, `rgba(0,0,0,.9)` → use #000).
  Opacity over time, relative to **H = zoom start (C1 0.917 s)**: already ≈ .40 at +233 ms, .48 +333, .66 +417, .87 +517, .98 +717, **1.0 at +767**,
  holds to ≈ +833, then fades out .89 +867, .68 +917, .45 +967, .21 +1017, **0 at +1066**.
  K2 runs 283 → 733 in and 1485 → 1751 out, so allone fades out ~650 ms earlier: give it its own keyframes (§6).

### 1.4 Overlays and dims (who covers what)
| kind | example (pts) | covers | colour over white | notes |
|---|---|---|---|---|
| web loading dim + green all-one spinner | C2 8.99–9.99 (→ 거래내역), C2 20.09–21.14 (→ 이체), C3 32.75 | **59–818 only** | luma 116–118. Fit: **rgba(56,56,59,0.70)** (269 colour bins, R/G/B agree) | appears in one frame. For 거래내역 상세 open/close (C2 14.29, 16.57) and C3 2.0 it then deepens to ≈ 90–96 over ≈ 150–300 ms. The spinner may lead the dim by 1–2 frames (C2 14.27). The screen specs own the exact levels |
| web sheet scrim (정기점검 sheet, 출금계좌 선택 sheet) | C1 12.75–13.05 fade-in, C3 3.33, C3 22.63–22.96, C3 36.38–36.65 | **59–818 only** | white → 165–178, ≈ **black .30–.35**, fades in ≈ 300 ms | the sheet body is white at the bottom, so whether it reaches into the bottom band cannot be told. Treat it as web |
| **native sheet dim (금액 입력 keypad sheet)** | C3 5.579 on (one frame), slides up to 5.83, closes 7.75–7.88, dim off 8.246 (one frame) | **whole window 0–852 incl. status band** | luma **60** (band 60–61, bottom 57) ≈ black .765 | status glyphs stay above the dim (§1.5) |
| **native sheet dim (계좌 비밀번호 입력, 4-col secure keypad)** | C3 31.13–32.73 | whole window | luma **68** ≈ black .733 | after 다음 on 얼마를 보낼까요 |
| iOS system alert dim | C1 2.28–3.33 | whole window | — | **EXCLUDED** (paste-permission alert). Do not build it |
| iOS keyboard (search) | C3 41.1–41.5 slides up | covers the bottom band | panel ≈ #f0f1f4–#f2f3f6, white keys, top edge ≈ 545 pt (centre; corners rounded, 551 at x 10 pt). Accessory bar `^ ∨ ✓` on white above it (≈ 505–545 pt) | iOS 26-style rounded panel, Korean 두벌식 |

Consequences for the implementation:
- **Web layer**: everything inside `.phone__viewport` (inset 59 / 34): ScreenStack layers, the web loading dim and spinner, web sheets and scrims, toasts.
- **Native layer**: a full-window host rendered through PhoneFrame's `overlay` prop: native dims and sheets, the iOS keyboard, the intro scene and launch window.
  Its z-order must be **below** the island (z 60) and the status glyph overlay (z 70), and above the bands and viewport.

### 1.5 Status-bar foreground changes
- Normal in-app state: `dark` (black) on white everywhere, including splash, PIN, home, lists, details, search and menu.
- **금액 입력 native sheet**: the dim arrives at 5.579 with the glyphs still black. At **6.179** signal, LTE and battery flip to white **in one frame**.
  The clock stays black until 6.246, then fades to white by 6.346 (≈ 67 ms delay + ≈ 100 ms ramp).
  On close (7.746) everything goes back to black in one frame, before the dim leaves (8.246).
  This is exactly K2's "right icons in one frame, clock fades" mechanism (`--k2-clock-ms`), with a different duration.
- **계좌 비밀번호 sheet**: the glyphs stay **black** on the 68-grey band for the whole sheet. So the fg choice belongs to each native sheet.
  Expose a status-fg override from the native layer (§2.13) rather than tying it to the dim.
- Intro: during the home-screen scene the glyphs are **white**. During the zoom (C1 0.95 → 1.18 s) the clock goes white → black.

### 1.6 Brand colours (light)
NH올원 green **#0c8f2d** (PIN background and the green 확인 button, same value) · all-one spinner ≈ #0d8e41 · home page background ≈ #fafcfd · tab bar #ffffff ·
app icon green ≈ #0a902b.
Bank tiles in sheets and lists are **36 × 36 pt squircles** (continuous corners, ≈ 11 pt), not circles:
KB ≈ #50473c with white mark · 케이뱅크 ≈ #0004a3 white K · NH ≈ #0251b1 white "NH" · 신한 ≈ #0d53ee · 하나 ≈ #009698 · 카카오뱅크 yellow tile with black B (§8).

### 1.7 Intro / boot timeline (C1, real pts)
| pts (s) | what | clone |
|---|---|---|
| 0.000–0.650 | iPhone home screen, static. The all one icon is the **4th column of the top row: 301.4–365.0 × 80.3–143.9 pt (64 pt), centre (333.4, 112.1)**, label under it | drawn scene (§7): neutral wallpaper, neutral placeholders, only the all one icon branded. Never reuse the recorded wallpaper or icons |
| 0.650 | press: the icon darkens in one frame (icon-region luma 155 → 83, ≈ brightness .54) | `filter: brightness(.54)` or a black .46 overlay on the icon |
| 0.650–0.900 | held (≈ 267 ms) | |
| **0.917 = H** | release → app window zooms from the icon rect to full screen. Window luma at the screen centre is full white by 1.117 and at the icon by 1.150 | ≈ 233 ms zoom of a **white** rounded window (launch screen is plain white). Fine keyframes belong to the launch spec |
| 0.95–1.18 | status glyphs white → black | |
| ≈ 1.15–1.98 | home indicator in, hold, out (§1.3) | |
| 1.18–2.28 | white launch screen, black status bar | |
| 2.28–3.33 | **EXCLUDED** (system alert + dim) | skip. Suggest holding white ≈ 1.1 s after the zoom, then the splash (open question 1) |
| 3.317–3.383 | white | |
| 3.383 → ≈ 3.60 | splash artwork fades in (≈ 220 ms: top-left campaign mark, mascot, bottom-right badge) | `AlloneSplash` starts white, then fades the artwork in |
| ≈ 4 → 6 | splash static | boot spec |
| ≈ 6–9 | PIN screen (green, shuffled white keypad) | boot spec |
| ≈ 10 | web loading dim (luma 71 over green) + spinner | |
| ≈ 12 | home + 정기점검 bottom sheet (scrim fades in 12.75–13.05) | |

### 1.8 Navigation style (for ScreenStack)
Every screen change in C2 and C3 is a **one-frame cut**. Motion scan: frame-difference peaks of 112–135 in 1–2 frames at C2 9.96, 14.46, 17.66, 21.14 and C3 22.25, 26.15, 26.56, 35.90, 38.95.
Each cut is normally preceded by the web loading dim and spinner (≈ 170 ms to ≈ 1.1 s).
The only sliding motions are sheets (bottom sheets, native keypad sheets, the keyboard) and in-page scrolling. They are screen-level, not stack-level.

---

## 2. Touchpoint checklist (file by file)

Rule (kakao2 / toss): **every change is gated** (`APP === "allone"` / `ALLONE`) so the other 9 servers render byte-identically.
Ports: kakao 5173/8787/9101 · nh 5174/8788/9103 · hana 5175/8789/9105 · ibk 5176/8790/9107 · kbank 5177/8791/9109 · kbank2 5178/8792/9111 ·
ibk2 5179/8793/9113 · kakao2 5180/8794/9115 · toss 5181/8795/9117 → **allone 5182/8796/9119**.

### 2.1 `server/db.mjs`
- [ ] `export const APPS = ["kakao", "nh", "hana", "ibk", "kbank", "toss", "allone"];` (line 21).
- [ ] **INTRO derivation** (lines 27-29). Today `INTRO = Object.hasOwn(VARIANTS, SERVER_ID); APP = INTRO ? VARIANTS[SERVER_ID] : SERVER_ID`. Change to:
  ```js
  const VARIANTS = { kbank2: "kbank", ibk2: "ibk", kakao2: "kakao" };
  // 처음부터 녹화 인트로가 있는 앱 (두 번째 서버가 아니라 자기 서버) — allone: 아이폰 홈 화면 → all one 아이콘 탭 → 앱이 켜짐
  const INTRO_APPS = ["allone"];
  const VARIANT = Object.hasOwn(VARIANTS, SERVER_ID);
  export const APP = VARIANT ? VARIANTS[SERVER_ID] : SERVER_ID;
  export const INTRO = VARIANT || INTRO_APPS.includes(APP);
  ```
  Result: kbank2/ibk2/kakao2 are unchanged (VARIANT true → INTRO true). `allone` gives APP `allone`, INTRO true, SERVER_ID `allone`.
  `INTRO` is used only at `index.mjs:951` (window flag). `KBANK_TX_MORE` uses `SERVER_ID === "kbank2"`, not INTRO, so it is safe.
- [ ] Error text (line 30): `APP은 kakao, kakao2, nh, hana, ibk, ibk2, kbank, kbank2, toss, allone 중 하나`. Update the header comment (lines 12-20) too.
- [ ] `DATA` automatically becomes `server/data-allone/` (`data-${SERVER_ID}`).
- [ ] Seeds in a separate **`server/allone-seed.mjs`** (toss precedent `toss-seed.mjs`, which imports nothing from db.mjs to avoid cycles):
  `seedAlloneExample(d, userName = "홍길동")` and `seedAlloneEmpty(d, userName)`, then
  `SEEDS.allone = { example: (d, name) => seedAlloneExample(d, name), empty: (d, name) => seedAlloneEmpty(d, name) }`.
  A missing key **crashes the first boot** (`db.mjs:604` `SEEDS[APP].example`), `POST /api/profiles` (`index.mjs:289-290`) and `/api/reset` (`index.mjs:929` `SEEDS[db().app]`).
- [ ] **Every NH account row: `bank_code = 'nh'`** with the 13-digit 3-4-4-2 format (`302-0000-0000-00`-style invented digits, which matches `B("nh", …, [3,4,4,2])`).
  A NULL bank_code renders as 카카오뱅크 (`toAccount`: `bankByCode(row.bank_code ?? "kakao")`).
- [ ] **Dates relative to now.** 거래내역's default filter is "1개월", so a fixed-date seed goes empty after a month.
  Copy toss-seed's `relativeClock` pattern (`c(n, "HH:MM")`, clamp future times). Do not import it: it is private and toss is WIP.
- [ ] **한도제한 tag trap.** `migrate()` runs `UPDATE accounts SET badge = NULL WHERE kind = 'main'` **on every DB open** (line 172).
  So `accounts.badge` cannot hold "한도제한" for the main account.
  Add a gated column instead, like toss's `add()`: `if (APP === "allone") add("accounts", "limited", "INTEGER NOT NULL DEFAULT 0")`.
  Alternatively keep it client-only. Do not touch the shared UPDATE.
- Suggested example shape (all invented, product names from the UI are fine):
  - main `NH페이모아통장(비대면실명확인)` (nh, 13-digit), plus a second NH account `NH X 카카오페이통장(비대면실명확인)` (kind `external`, bank `nh`).
    The home "NH농협" pager shows several NH cards.
  - 다른금융 / registered 출금계좌 for 잔액채우기: `KB나라사랑우대통장` (kb, 14-digit 6-2-6), `MY 입출금통장` (kbank, 12-digit 3-3-6), all external.
  - Payees with invented names in 신한, 카카오뱅크, 하나 and others, some ☆ (`favorite`). Transfers so that 최근 is not empty. A few deposits and withdrawals in the last month.

### 2.2 `server/index.mjs`
- [ ] Port map (line 958): add `allone: 9119`.
- [ ] `<title>` map (line 950): add `allone: "올원뱅크"` → "올원뱅크 클론 연습" (matches `APP_NAME`; use "NH올원뱅크" only if wanted, see open questions).
  `window.__BANK_APP__ = "allone"` and `window.__BANK_INTRO__ = true` come automatically from §2.1.
- [ ] `POST /api/accounts` (line 419): `bankCode = APP === "kakao" ? undefined : APP` gives **"allone" → 400 "은행을 골라 주세요"**.
  Change to `APP === "kakao" ? undefined : APP === "allone" ? "nh" : APP`.
  - Line 423 `bank.code === "kakao" && !TOSS` rejects 카카오뱅크 accounts. allone registers other-bank 출금계좌, so use `&& !TOSS && APP !== "allone"`.
    Keep it additive: changing it to `APP === "kakao"` would alter nh/hana/ibk/kbank error wording.
  - Do **not** add an own-bank-only line for allone (it holds KB / 케이뱅크 / … accounts for 잔액채우기).
  - Default-name map (line 449): add `allone: bank.code === "nh" ? "입출금통장" : null`, or have the DevPanel always send a name.
- [ ] `DELETE /api/accounts/:id` message map (line 489): add `allone: "대표계좌"`. Without it the message reads "undefined은 지울 수 없어요".
- [ ] `txDetailJson` (lines 536-556): `transfer` is resolved only by `out_tx_id`.
  The 거래내역 상세 shows **출금계좌 and 입금계좌**. For the NH side of an own-account top-up (잔액채우기: KB → NH, deposit = `in_tx_id`) the source account is not returned.
  Add an allone-only additive field, e.g. `...(APP === "allone" && alloneDetail(t))`, which looks up `transfers WHERE in_tx_id = ?` and returns the from-account bank and number (toss did the same with `txDetailFields`).
- [ ] (screen-spec decision) `KIND_BY_TAG["#이체"]` is "이체". The list shows "올원이체" for transfers. Either map it client-side (recommended) or gate a server default like kakao2's "일반이체" (line 548).
- [ ] (transfer-spec decision) `GET /api/transfer/recipients`:
  - `mine` excludes `from` except for nh (`APP === "nh" ? "" : from`, line 779). Check whether 누구에게 보낼까요 › 내계좌 lists the sending account.
  - Limits: `dailyRemaining` exists only for `db().app === "nh"` (콕뱅크 1,000,000). The allone UI shows "한도제한" and "1회 한도 / 1일 잔여한도" on 잔액채우기.
    If those numbers must be live, add an allone branch next to `NH_DAILY_LIMIT` (`dailyRemaining` line 819, constant line 823) and the `POST /api/transfers` check (lines 876-877). Do not reuse `db().app === "nh"`.
- [ ] No change needed for: auth and profile middleware, `/api/home` (allone reads `profile` and `accounts` and ignores the kakao banner fields), `/api/banks`, accounts PATCH,
  `/api/accounts/:id/transactions` (balanceAfter is computed), transactions PATCH (`memo` max 20 for non-ibk, which **matches "메모 입력 (최대 20자)"**), payees CRUD,
  `/api/transfer/lookup`, `POST /api/transfers`, `/api/transfers`, `/api/reset`.
  잔액채우기 = `POST /api/transfers { fromAccountId: <KB external id>, bankCode: "nh", number: <my NH> }`. The existing code already creates the out tx on KB, the in tx on NH, and the transfer row.
  Per the brief, top-ups and transfers simply succeed. **No withdrawal block exists or is to be added.**
  `API_DELAY_MS` 250 ms covers the spinner frames.

### 2.3 `server/auth.mjs`
- [ ] **No change.** `COOKIE = bank_sid_${SERVER_ID}` gives `bank_sid_allone`. The admin password goes to `server/data-allone/admin-password.txt`, and the log prefix uses `[allone]`.

### 2.4 `server/banks.mjs`
- [ ] **No change.** `nh` (농협은행, 13-digit 3-4-4-2 plus alts 6-2-6 and 3-2-6), `kb` (6-2-6), `kbank` (3-3-6), `shinhan`, `kakao` and `hana` all exist.
  The allone bank picker (은행을 선택해 주세요 ▾) uses its own order and short labels: put that list in `src/allone/bank.ts` (pattern of `src/nh/banks.ts`, `src/toss/bank.ts`).

### 2.5 `src/profile/session.ts`
- [ ] Line 27: `export type AppName = "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss" | "allone";`
- [ ] Line 36 APP parse: add `|| appName === "allone"`. Without it the client **silently runs as kakao**.
- [ ] Line 45 `APP_NAME`: add `allone: "올원뱅크"` (TS2741 otherwise). It is used by LoginScreen and AdminPanel.
- [ ] Add `export const ALLONE = APP === "allone";`, mirroring `TOSS`. Update the port comment (lines 22-26) and the `__BANK_INTRO__` comment (line 31).
- `HAS_INTRO` (line 38) needs **no change**: true from the server flag or `VITE_INTRO=1`. `KAKAO2` (line 40) stays false because APP is not `kakao`.

### 2.6 `src/vite-env.d.ts`
- [ ] `VITE_APP?: "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss" | "allone"`, and extend the `VITE_INTRO` comment.

### 2.7 `.env.allone` (new)
```
# npm run dev:allone (vite --mode allone) 일 때만 읽힘 → NH올원뱅크 (아이폰 · 라이트 고정) + 녹화 인트로 (배포 땐 서버가 window.__BANK_INTRO__ 를 넣어 줌)
VITE_APP=allone
VITE_INTRO=1
```
`vite.config.ts` `fs.deny` already blocks `.env.*`.

### 2.8 `package.json`
- [ ] `"dev:allone": "concurrently -k -n api,web -c yellow,cyan \"node --watch --disable-warning=ExperimentalWarning server/index.mjs --app allone --port 8796\" \"vite --mode allone --port 5182\""`
- [ ] `"start:allone": "node --disable-warning=ExperimentalWarning server/index.mjs --app allone"`

### 2.9 `vite.config.ts`, `.gitignore`
- [ ] Proxy map: add `allone: 'http://localhost:8796'` and a comment line ("npm run dev:allone … 화면 5182 + API 8796, VITE_APP=allone · VITE_INTRO=1 은 .env.allone 에서"). The `API_TARGET` override still works.
- [ ] `.gitignore`: add `server/data-allone/`.

### 2.10 Locks: `src/platform/platform.ts`, `theme.ts`, `intro.ts`, `deviceStatus.ts`
- [ ] `platform.ts:22` `DEVICE_LOCK = IBK2 ? "android" : KAKAO2 ? "ios" : APP === "toss" ? "android" : APP === "allone" ? "ios" : null`.
  This hides the Galaxy/iPhone switch and ignores `?os=`. `data-app="allone"` is already set by `main.tsx:17`. **Do not** set `dataset.kakao2` for allone (it would pull in kakao2 nav.css layer animations and kakao2 intro rules).
- [ ] `theme.ts`: light lock exactly like kakao2:
  `const lightOnly = KAKAO2 || ALLONE || ["ibk","kbank"].includes(…)` (line 42) and `THEME_LOCK = KAKAO2 || ALLONE ? "light" : darkOnly ? "dark" : null` (line 35).
  Optionally `THEME_CHOICE = ALLONE ? "light" : …` so profiles store "light".
- [ ] `intro.ts:12` `INTRO_OS = KAKAO2 || ALLONE ? "ios" : "android"`. Without it the IntroToggle never shows (`HAS_INTRO && OS === INTRO_OS`) and the recorder skips the intro.
- [ ] `intro.ts:48` `BLINK_MS = APP === "ibk" ? 1000 : KAKAO2 || ALLONE ? 1500 : 986`. Otherwise the red dot pulses at 986 ms.
- [ ] `deviceStatus.ts:16` default battery `KAKAO2 || ALLONE ? 50 : 62`.

### 2.11 `src/platform/recorder.ts`
- [ ] Line 193: `const unsnap = (KAKAO2 || ALLONE) && (elementCapture || regionCapture) ? snapToDevicePixels(target) : …`. allone is 393 wide too (see §0.8).
- [ ] **Intro branch** (lines 275-308). `cfg` (`KAKAO2 ? KAKAO_INTRO : APP === "kbank" ? KBANK_INTRO : null`) stays null for allone, so without a branch ● 녹화 does off → 600 ms → splash.
  Add a drawn-intro branch next to ibk's custom `playIbkIntro`:
  ```ts
  } else if (ALLONE && isIntroOn() && OS === INTRO_OS) {
    await started;            // start after the recorder's first frame (kakao2 lesson: playing immediately lost ~5 frames)
    await nextFrame();
    const stopKeep = keepCapturing(target);   // keep Chrome emitting frames during static scene parts
    recorder.addEventListener("stop", stopKeep, { once: true });
    await playAlloneIntro();  // src/allone/intro.ts — shows the scene, press, zoom; dispatches RESTART "start" under the white window; resolves when the scene is gone
  }
  ```
  Before `recorder.start()`: the scene must already cover the phone (the first recorded frame must be the home screen, not black).
  So mount the scene in the "off" phase: `RESTART_EVENT "off"` → `showAlloneScene()` → `await nextFrame()`.
  Call `syncBlink(…)` so the red dot phase is continuous (any phase is fine, since there is no video to match).
- The `IntroCfg` / `loadIntro` / `playIntro` video path stays untouched.

### 2.12 `src/styles/global.css`
- [ ] Frame: add `html[data-app="allone"]` to the kakao2 rule (lines 95-100): `--frame-w:393px; --frame-h:852px; --safe-bottom:34px`.
  It must beat `[data-os="ios"] { 402 × 874 }`. The `html[…]` specificity is enough.
- [ ] Corner radius 55: add `html[data-app="allone"] .phone--ios` to the kakao2 rule (line 162).
- [ ] Font: add `html[data-app="allone"] body` to the kakao2 Pretendard rule (line 321). Otherwise `[data-os="ios"] body` picks `-apple-system` on Macs.
  The screen specs may refine this after an ink comparison.
- [ ] Mobile (≤ 500 px, lines 168-200): add `html[data-app="allone"]` to the `--safe-bottom: env(…)` group, and set
  `--ao-top: env(safe-area-inset-top, 0px); --ao-bottom: env(safe-area-inset-bottom, 0px)` there.
  The existing rules already hide `.statusbar > *`, `.dynamic-island` and `.phone__home-indicator` on real phones.
- [ ] Do not redefine the global `--home-*` tokens. Put allone tokens in `src/allone/allone.css` (`--ao-green:#0c8f2d; --ao-bg:#fafcfd; …`).

### 2.13 `src/components/PhoneFrame.tsx` / `PhoneFrame.css`
- [ ] Island (lines 344-351): `KAKAO2 || ALLONE ? <K2Island recording={recording}/> : …` (import as is, §6).
- [ ] Status bar (line 353): `KAKAO2 ? <K2StatusBar/> : TOSS ? <TossStatusBar/> : ALLONE ? <AlloneStatusBar/> : <StatusBar/>`.
  Without it the generic iOS `StatusBar` renders (402-pt layout grid, Wi-Fi glyph, no LTE) inside the flex column and pushes the viewport down by 54.
- [ ] Bands: for ALLONE render `<div className="ao-band ao-band--top"/>` and `<div className="ao-band ao-band--bottom"/>` (white, absolute) and inset the viewport:
  ```css
  html[data-app="allone"] { --ao-top: 59px; --ao-bottom: 34px; }
  html[data-app="allone"] .phone__viewport { position: absolute; inset: var(--ao-top) 0 var(--ao-bottom); z-index: 0; }
  html[data-app="allone"] .phone > .statusbar { position: absolute; inset: 0 0 auto; height: 54px; background: transparent !important;
    box-shadow: none !important; padding: 0; display: block; z-index: 70; pointer-events: none; }
  ```
  (This is the kakao2 overlay rule from `chrome.css:15-29`, re-declared for allone. The bands are white `.ao-band` elements at z 1.)
- [ ] Home indicator (lines 361-378): `KAKAO2 ? <K2HomeIndicator/> : ALLONE ? <AlloneHomeIndicator/> : <div className="phone__home-indicator …">`.
  Without it a permanent generic home indicator is drawn, but the recording hides it in-app.
- [ ] Overlay z-order: `overlay` (App.tsx, §2.15) hosts the **native layer** (`<AlloneOverlay/>`), absolute `inset:0`, **z 50–58**, below the island (60) and glyphs (70).
  It contains: a portal host `#ao-native` for native sheets and the iOS keyboard, the full-window native dim, and the intro scene plus launch window.
  `AlloneHomeIndicator` must sit above the launch window (e.g. z 72).
- [ ] Status fg under native sheets: the native layer sets an override such as `setAoStatusFg("light" | null, { clockDelay: 67, clockMs: 100 })`.
  `AlloneStatusBar` uses `override ?? useStatusBarStyle().fg`. Right-side icons switch in one frame; the clock follows after the delay and ramp (§1.5).
- [ ] `OsSwitch` needs no edit: `!DEVICE_LOCK` and `!THEME_LOCK` already hide both switches once §2.10 is done, and the IntroToggle shows through `HAS_INTRO && OS === INTRO_OS`.
- [ ] The `StatusBar()` `boxShadow` seam (line 161, `APP !== "kakao"`) does not apply, because allone does not render the generic StatusBar.

### 2.14 `src/components/ScreenStack.tsx`
- [ ] Without a branch, allone (iOS) gets `TIMING.nav.ios` 420 ms iOS push/pop CSS and edge swipe-back, while the recording shows **cuts** (§1.8).
  Add, like `IBK_ANDROID` / `TOSS_ANDROID`:
  ```ts
  const ALLONE_IOS = ALLONE; // OS is locked to ios
  // in the layout effect, before the generic path:
  if (ALLONE_IOS) { drag.current = null; setDragging(false); setEnterAnim(null); setExiting(null); return; }
  ```
  If a screen spec later measures a real transition, add `src/allone/nav.ts` (`aoAnimFor`) and `layer--ao-*` CSS, as toss did.
- [ ] `canSwipe` (line 255): gate with `!ALLONE` unless the screen specs want WebView back-swipe (open question 2).
- Navigation guard: copy the `useK2Once` / `useKbankGo` double-tap lock pattern into `src/allone/nav.ts`. Cuts after a loading dim make double pushes easy.

### 2.15 `src/App.tsx`
- [ ] Import `renderAlloneRoute` from `src/allone/routes.tsx` (one import, like kakao2/toss) and add it to `ROUTES` (line 133). TS7053 otherwise.
- [ ] `overlay={{ …, allone: <AlloneOverlay/> }[APP]}` (line 188). TS2339 otherwise.
- [ ] Splash chain (lines 218-233): `APP === "allone" ? <AlloneSplash onDone={toReady}/>`. Without it allone falls to kakao's `<Splash onDone={toLoading}/>` (yellow kakao splash + BootLoading).
  `AlloneSplash` owns the boot: white → artwork fade-in (≈ 220 ms) → splash → **PIN screen** (간편비밀번호 6자리) → web dim + spinner → `onDone`.
  PIN is a boot step, not a route, because ScreenStack starts at "/".
- [ ] Login / ProfilePicker (lines 192-217): the inset viewport already starts below the band, so **no Inset wrapper** is needed and the plain branch is correct.
  Add a comment to that effect. Do not reuse `K2Inset`: it paints a 54 pt band and allone's band is frame-level.
- [ ] Restart (line 172): `setBoot(currentProfileId() ? (KAKAO2 ? "ready" : "splash") : "pick")` → "splash" for allone (cold start). Correct, no change.
- [ ] `warmStart` (line 140): leave it (allone is not warm; `?skip` still jumps to home).
- [ ] Launch anchor: call `aoLaunchReady()` when boot enters "splash" (not "ready"), so the post-launch home indicator also shows without the intro. The intro sets the anchor itself at H.

### 2.16 `src/components/AppBrand.tsx`
- [ ] `if (APP === "allone") return <AlloneAppIcon size={size}/>;`. Otherwise the 카카오 circle shows on Login, ProfilePicker and AdminPanel.
  The icon is a green squircle with the "all NH one" wordmark (§9).

### 2.17 `src/auth/LoginScreen.tsx`, `src/profile/ProfilePicker.tsx`, `auth.css`, `ProfilePicker.css`
- [ ] `useStatusBar` bg chains (`LoginScreen.tsx:14-26`, `ProfilePicker.tsx:29-41`): add `APP === "allone" ? "#ffffff"` before `"var(--home-bg)"`.
  The fg expression already yields "dark" for allone (THEME light).
- [ ] `ProfilePicker.tsx:54-55`: `KAKAO2 || TOSS || ALLONE ? OS : …` and the same for theme. Otherwise a profile with a stale theme triggers a pointless `location.assign(?theme=…)` reload.
- [ ] CSS: `.login--allone { background:#fff; color:#222 }`, `.login--allone .login__form input:focus { border-color:#0c8f2d }`,
  `.login--allone .login__btn { background:#0c8f2d; color:#fff }`. Also `.picker--allone { --home-bg:#fff; --home-text:#222; --home-btn:#f2f4f3; --home-card:#f7f8f8; --home-line:#e6e9e8 }`.

### 2.18 `src/dev-panel/DevPanel.tsx` / `DevPanel.css`
allone is "NH own bank plus other-bank 출금계좌". That is neither own-bank-only (nh/hana/ibk/kbank) nor kakao.
- [ ] `BasicForm` 기기 field (line 158): `!KAKAO2 && APP !== "toss"` → add `&& !ALLONE` (or `!DEVICE_LOCK`, but that would also hide ibk2's field, a behaviour change). The 테마 field already hides via `THEME_LOCK`.
- [ ] `OWN_BANK` (line 691): add `allone: { code: "nh", name: "NH농협은행", placeholder: "NH페이모아통장", numberLabel: "NH농협은행 계좌번호 (13자리)" }`.
  Extend `ownBank()` (line 699) and the `AddPayee` default-bank chain (line 826) with `"allone"`.
  Today both fall to the 콕뱅크 `nh` entry ("저축예금", "농축협 14자리 / 농협은행 13자리"): it works by accident but uses the wrong label and placeholder.
- [ ] `AccountsTab` (lines 404-422): add an allone branch rendering **both** `<AddOwnBankAccount/>` (NH) and `<AddBankAccount … exclude={[]} withName />` ("출금계좌 (다른 은행) 추가"), as the toss branch does.
- [ ] `AccountEditor` `ownHint` (lines 441-450): add `APP === "allone" ? { name: "NH페이모아통장", number: "숫자 13자리", max: 16 }`.
  Make `freeNumber` (line 452) `own && ((APP !== "toss" && APP !== "allone") || account.bank?.code === (APP === "allone" ? "nh" : "toss"))`.
  Otherwise a 14-digit KB number plus hyphens is truncated to `max`.
- [ ] Allone-only fields (if §2.1 adds `limited`): a "한도제한 표시" toggle in AccountsTab under `APP === "allone"`.
- [ ] `accountName()` (line 139) returns `a.label` for non-kakao, which is fine. The `CardEditor`, `SuspendToggle` and `KbankTakeTwo` branches do not apply.
- [ ] `DevPanel.css`: `.dev-panel--allone { --yellow:#0c8f2d; --yellow-pressed:#0a7524; }` plus the `.btn` text colour rule, following `.dev-panel--toss` (lines 503-515).
- Opening the panel: the allone home header has a **bell** (wallet / bell / menu icons). Wire the bell to `<DevPanel>` as `K2Home.tsx:361` does.

### 2.19 Files that need no change (checked)
`main.tsx` (sets `data-app`, saves os/theme), `hooks/useStatusBar.tsx` (allone screens call `useStatusBar("#ffffff","dark")`; `StatusBandContext` stays null outside K2Inset),
`server/auth.mjs`, `server/banks.mjs`, `api/client.ts`, `capture.ts`, `LayerContext.ts`, `components/Sheet.tsx` (kakao-styled; allone needs its own sheets).

### 2.20 Docs
- [ ] `README.md`:
  - dev list: `npm run dev:allone # NH올원뱅크(아이폰) + 녹화 인트로: → http://localhost:5182 (API 8796)`.
  - VPS block: `npm run start:allone # 9119` plus the pm2 line.
  - "서버 하나는 앱 하나만" paragraph: `APP=allone`, `server/data-allone/`.
  - login paragraph ports list (`allone(9119)`) and the admin-password folder list (`data-allone/`).
  - a new section **"## 🍀 NH올원뱅크 allone (아이폰 · 녹화 인트로)"**. Cover: iPhone + light lock; the drawn intro (no video, privacy reason); the band model; cuts plus loading spinner;
    the PIN screen accepts any 6 digits and nothing is stored; 잔액채우기 = transfer from a registered 출금계좌; 🔔 panel differences.
  - switch-row note (no Galaxy/iPhone, no 라이트/다크, `인트로 켜기/끄기` shown) and the ● 화면 녹화 note (intro scene → app opens → splash).
  - 데이터 section (`seedAlloneExample` in `server/allone-seed.mjs`, relative dates) and asset commands if any.
- [ ] `SOLUTION.md`: folder tree line `allone/`, and a new section after toss's (26 if toss is not documented first, else 27).
  Cover: a new app with an intro on its own server (`INTRO_APPS`), the app-id/bank-code trap (`allone` vs `nh`), the 59/34 native-band model vs kakao2's painted band,
  the two dim layers and status-fg override, why the intro is drawn (wallpaper and installed apps are personal), measured chrome (§1), and the instant-cut navigation.

---

## 3. Type-check and silent-fallthrough traps when `AppName` grows

Verified by adding `"allone"` to `AppName` and `VITE_APP` in a scratch copy and running `tsc -p tsconfig.app.json --noEmit`. Exactly three errors:

| place | without an allone entry |
|---|---|
| `src/App.tsx:135` `ROUTES[APP]` | **TS7053** |
| `src/App.tsx:188` `overlay={{…}[APP]}` | **TS2339** |
| `src/profile/session.ts:45` `APP_NAME: Record<AppName,string>` | **TS2741** |
| `session.ts:36` APP parse chain | silently **kakao** (everything below then behaves as kakao) |
| `App.tsx:218-233` splash chain | kakao yellow Splash + BootLoading |
| `App.tsx:192-217` Login / Picker wrappers | plain (correct only if the viewport is inset, §2.13) |
| `AppBrand.tsx:11-16` | KakaoCircle |
| `LoginScreen.tsx:14-26`, `ProfilePicker.tsx:29-41` status bg | `var(--home-bg)` (kakao token) |
| `ProfilePicker.tsx:54-55` os/theme lock | reads the profile's stored os/theme (reload loops on mismatch) |
| `platform.ts:22` `DEVICE_LOCK` | null → Galaxy/iPhone switch shown, `?os=android` honoured |
| `theme.ts:35,42` `THEME_LOCK` / `lightOnly` | system theme → dark mode possible, switch shown |
| `intro.ts:12` `INTRO_OS` | "android" → IntroToggle hidden, intro never plays on iOS |
| `intro.ts:48` `BLINK_MS` | 986 ms red-dot pulse |
| `deviceStatus.ts:16` battery default | 62 |
| `recorder.ts:193` pixel snap | 392/394 px jitter in recordings |
| `recorder.ts:276` intro cfg | no intro; ● 녹화 = off → 600 ms → splash |
| `PhoneFrame.tsx:344-353` island / status bar | generic iOS island (126 wide, small dot) + generic iOS `StatusBar` in flow (54 pt) |
| `PhoneFrame.tsx:361-378` home indicator | permanent generic indicator |
| `ScreenStack.tsx:52,255` nav timing / swipe | iOS 420 ms slide push + edge swipe |
| `DevPanel.tsx:158` 기기 field | shown |
| `DevPanel.tsx:404-422` AccountsTab | "농협 계좌 추가" only (no other-bank 출금계좌) |
| `DevPanel.tsx:441-452` ownHint / freeNumber | "자립예탁금 / 13~14자리", other-bank numbers truncated |
| `DevPanel.tsx:699,826` ownBank / AddPayee default | 농협 (works by accident, 콕뱅크 labels) |
| `global.css:90-100,162,321` frame / radius / font | 402 × 874, radius 62, `-apple-system` |
| server `SEEDS[APP]` (`db.mjs:604`, `index.mjs:289-290,929`) | **crash** on first boot, on new profile and on reset |
| server title / port / delete-message maps (`index.mjs:950,958,489`) | "undefined 클론 연습", NaN port (random), "undefined은 지울 수 없어요" |
| server `POST /api/accounts` default bank (`index.mjs:419`) | **400 "은행을 골라 주세요"** |
| server `db.mjs:28-29` | INTRO false → no `__BANK_INTRO__` → `HAS_INTRO` false in prod |

`tsc -b` (in `npm run build`) catches only the first three rows. After the change, grep `APP ===`, `APP !==`, `[APP]`, `KAKAO2 ||` and `TOSS ?` across `src/` and `server/`.

---

## 4. App id `allone` vs bank code `nh` (and app id `nh`)

The namespaces are `APP` / `data-app` / `SERVER_ID` / cookie / data folder on one side, and `bank.code` / `bank_code` / asset names on the other.
- `allone` is **not** a bank code. Every server default that uses "app id = bank code" breaks:
  - `POST /api/accounts` → map `allone → "nh"` (§2.2).
  - DevPanel `OWN_BANK.allone.code = "nh"` (§2.18).
- `nh` is **both** NH 콕뱅크's app id and NH농협은행's bank code. allone code must test `bank.code === "nh"`. **Never test `APP === "nh"`.**
  `db().app` is `"allone"` on this server, so all 콕뱅크 rules stay off for allone: 1-day limit, `mine` incl. `from`, `dailyRemaining`. Port any that are wanted as allone branches.
- Assets: `bank-nh.png` is the kakao-style green circle and `hana-bank-nh.png` is the 하나원큐 glyph. 콕뱅크 owns `nh-*` (141 files).
  allone assets use the **`allone-` prefix** (`allone-app-icon.png`, `allone-bank-<code>.png` for squircle tiles, `allone-splash-*.png`). Never `nh-*`, never `bank-*`.
- CSS: `html[data-app="allone"]` plus the `.ao-*` class prefix. Neither `ao-` nor `allone` is used anywhere in `src/`, `server/` or `scripts/` (checked).
- Seeds: NH rows `bank_code = 'nh'`. The format is 13 digits 3-4-4-2 (농협은행). The 14-digit 6-2-6 alt is 지역농축협, so do not use it for allone's NH accounts.

---

## 5. Server API reuse for allone screens

| screen | endpoint(s) | notes |
|---|---|---|
| home (NH농협 pager, 다른금융) | `GET /api/home` | `accounts` filtered client-side: NH (`bank.code === "nh"`) vs others |
| 거래내역조회 | `GET /api/accounts/:id`, `/api/accounts/:id/transactions` | "1개월 · 전체 · 최신순" and 잔액 숨기기 are client-side |
| 거래내역 상세 | `GET /api/transactions/:id`, `PATCH {memo}` (≤ 20) | needs the `in_tx_id` addition for 출금계좌 of top-ups (§2.2). 다시보내기 = client prefill |
| 누구에게 보낼까요 | `GET /api/transfer/recipients?from=` | tabs 최근 / 자주(favorites) / 내계좌(mine) / 연락처 (static). ☆ = `PATCH /api/payees/:id {favorite}` |
| 계좌번호 + 은행 | `GET /api/transfer/lookup` | 404 → screen's error copy |
| 얼마를 보낼까요 → 계좌 비밀번호 → done | `POST /api/transfers` | 출금가능금액 부족 is a client check (`amount > balance`) leading to the 잔액채우기 link. The password is never sent (§9) |
| 잔액채우기 | `POST /api/transfers` from a registered other-bank account to my NH account | always succeeds (no block) |
| 출금계좌 선택 sheet | `GET /api/home` accounts (external, non-NH) | 농협 계좌등록 / 타행 계좌등록 buttons = stubs (or 🔔) |
| 정기점검 sheet, 전체메뉴, 통합검색 | none | static client content. "1일동안 안보기" in localStorage per profile (kbank `prefs.ts` pattern). Search results not built (excluded topic) |
| 🔔 panel | existing | §2.18 |

---

## 6. Reusing kakao2 chrome: import vs copy

All kakao2 CSS is gated on `html[data-kakao2]`. allone must not set that attribute (it would enable kakao2 nav.css and kakao2 intro rules).
`@keyframes` are global, and `src/kakao2/chrome.css` is always bundled because PhoneFrame imports `kakao2/StatusBar`. So allone CSS may **reference** `k2-rec` without copying it.

| piece | decision | why |
|---|---|---|
| `K2Island` (`kakao2/StatusBar.tsx:191-208`) + `K2RecDot` | **import as is** | parameter-free; island, dot and 1.5 s pulse are identical. Add `html[data-app="allone"]` rules mirroring `chrome.css:219-240` (`.dynamic-island` 37.33 tall, `--k2rec` rect, `.k2-rec` box) with `animation: k2-rec 1500ms linear infinite` (global keyframes) |
| `K2StatusBar` | **copy and adapt** to `src/allone/StatusBar.tsx` | no indicator / moon / launch bubble, dual-SIM signal, +1.0–1.33 pt right cluster, clock centred ≈ 60.2, native fg override. The ink helpers (`inkOf`, `useInk`, `useFontLoaded`) are module-private; toss already copied them. Exporting them from kakao2 would edit a kakao2 file (behaviour-neutral, but the precedent is copying) |
| `K2HomeIndicator` + `launch.ts` | **copy pattern** (`src/allone/launch.ts`, own keyframes §1.3) | different timings; K2's are tied to `LAUNCH` and kakao2 home behaviour |
| `Launch.tsx` (`prepareK2Launch`, `K2LaunchIcon`) | **copy pattern only** | K2 resumes into a pre-drawn dark home over a video backdrop. allone zooms a **white** window from its own icon rect over a **drawn** scene, then cold-starts the splash. Reuse the ideas: WAAPI with `startTime` pinned to H, clip-path window, copied status bar during the zoom |
| `K2Inset` / `StatusBandContext` | **do not use** | allone bands are frame-level and always white |
| `K2LoadingDim` + `dim.ts` | **copy pattern** (`src/allone/loading.ts` + `AlloneLoading`) | one global owner of the web dim and spinner (show in one frame, leave, cut, auto-cut on restart and logout). Render it **inside the viewport** (web area) with the measured levels (§1.4) and the green all-one spinner |
| `nav.ts` (`useK2Once`, `useK2Back`) | **copy pattern** | double-tap lock, and "back on a deep link goes home" |
| `kakao-intro-erase.py`, `src/assets/intro/*` | **not used** | no video for allone |
| `snapToDevicePixels`, `keepCapturing`, `syncBlink` (recorder/intro) | **reuse** (add `ALLONE` gates) | generic |

---

## 7. Recording-intro design for allone (drawn scene)

1. **Why drawn:** the recorded home screen contains copyrighted album-art wallpaper, notification badges and other installed apps. That is personal, and those frames must not be shipped.
   The press and zoom happen over that wallpaper, so no part of C1 0–1.15 s is usable as video.
2. **Scene** (`src/allone/intro/HomeScene.tsx`, full window, in the native layer under the island and status glyphs):
   - neutral wallpaper (a soft gradient, not derived from the recording);
   - a generic iOS grid: 64-pt icons, first row y 80–144, rightmost column x 301–365, other columns at the same pitch;
   - neutral placeholder icons (grey or tinted squircles, no third-party brands);
   - **the all one icon** at 301.4–365.0 × 80.3–143.9 with the label "NH올원뱅크" under it;
   - a generic search pill and a dock with neutral placeholders.
   Status glyphs are **white** during the scene (`setAoStatusFg("light")`).
3. **Sequence** (ms from scene start; the recording's 0.650 s idle can be shortened, see open question 1):
   - idle ≈ 650;
   - press: icon brightness .54 for ≈ 267;
   - **H**: white window zooms from the icon rect to full screen in ≈ 233 ms (launch-spec keyframes). Status glyphs white → black over ≈ 230 ms;
     home indicator per §1.3; at **H** call `aoSetLaunchAt(H)` and dispatch `RESTART_EVENT "start"` so `AlloneSplash` mounts **white** under the window;
   - hold white ≈ 1.1 s (the recording's pre-alert white is 1.18–2.28);
   - remove the scene and window; `AlloneSplash` fades its artwork in (≈ 220 ms).
4. **Recorder wiring:** §2.11. `keepCapturing` keeps Chrome capturing frames while the scene is static.
   Intro off → black → 600 ms → splash (existing path), with the launch anchor at splash mount.
5. **Toggle and island:** `IntroToggle` appears once `INTRO_OS` is ios for allone. `K2Island` shows the wide recording island whenever the intro is on or recording, as on kakao2.

---

## 8. Reusable shared parts

- **Bank logos.** allone uses **36-pt squircle tiles** (sheet and list rows at x 24–60): KB, 케이뱅크, NH, 신한, 하나, 카카오뱅크, and a blue faceted mark the transfer spec should identify.
  `components/BankIcon.tsx` draws `bank-<code>` **circles** (150 px), which is the wrong shape.
  Build `AlloneBankLogo`: a squircle in the bank colour (§1.6) with a white mark. Get the mark from `hana-bank-<code>.png` glyphs (kb, kbank, nh, shinhan, kakao, hana and 55 more) recoloured via CSS `mask-image`.
  Alternatives: SVG redraws, or 3× crops from the recording (108 px), which contain no personal data.
  Fallback for banks without a mark: colour tile plus short name, as `BankIcon` does.
- **Keypads.** `lib/keypad.ts` `applyKey` (`00`, `back`, max length) for the 얼마를 보낼까요 pad (+1만/+5만/+10만/+100만/전액 chips, 1–9, 00, 0, ←).
  `ibk/IbkKeypad.tsx` has the **same layout** (chips row + 3 × 4 with 00 and ←): copy its structure, not its visuals.
  PIN pad: 3 × 4 **shuffled** digits with ↻ (re-shuffle) and ⌫. 계좌 비밀번호 pad: 4 columns, shuffled, blank dummy keys, ↻ / ⌫ / OK.
  Both are new components. A Fisher–Yates shuffle exists inline in `toss/transfer/SendWho.tsx` and `nh/NhBankPicker.tsx` (copy it).
- **iOS Korean keyboard** (통합검색): no iOS keyboard exists in the repo. `toss/transfer/hangul.ts` (두벌식 composition, `isConsonant` / `isVowel` / `isJamo`) can be imported for the logic.
  The visuals are new (iOS 26 light panel, §1.4). Render it in the native layer, since it covers the bottom band.
- **Spinner, dims:** `kakao2/art.tsx` `K2Spinner` is grey. allone needs a green "all one" ring spinner (new SVG or crop). Dim logic per §6.
- **Skeleton:** `.skel` in `global.css:268` (light), usable as is if any allone list shows skeletons.
- **`hooks/useStatusBar`, `LayerContext`, `ScreenStack`, `api/useApi`** (prefetch during splash, `invalidate` after a transfer), `lib/format.ts` (`won`, `groupByDate`),
  `assets/Asset.tsx` `localAsset("allone-…")`. Crop scripts must respect `scripts/keep_assets.py` (no overwrite without `--force`).
- **Patterns to copy:** `kbank/prefs.ts` (per-profile "don't show today" for the 정기점검 sheet), the toss `routes.tsx` + `stub.tsx` placeholder screens,
  and toss `Overlay.tsx` (restart and logout cleanup).

---

## 9. Safety and privacy rules for this app

- **PIN screen (간편비밀번호 6자리) and 계좌 비밀번호 pad:** practice visuals only. Accept any input, never send it to the server, never store it (not even in localStorage), and do not log it.
  The flow continues after the 6th or 4th digit.
- **Excluded flows are not built:** the withdrawal-block notice and its code, anything about 이의제기 (search results, 신청/조회, branch search, phone verification, ID checks, mobile ID),
  and the iOS paste-permission alert. In the clone, 잔액채우기 and transfers simply succeed.
- **Seeds:** invented 홍길동-style data only. Product names from the UI are fine. No value from the recordings.
- **Assets:** never crop anything that shows the recorder's name, numbers, balances or home-screen content.
  The all one icon may be cropped from C1 0.2 s **only with a squircle mask** that removes the wallpaper corners; an App Store original is preferred.

---

## 10. Assets needed (infra-level only)

- `allone-app-icon` (Login / ProfilePicker / AdminPanel and the intro scene): App Store original via an `appicon.py` like `scripts/kbank-crops/appicon.py` (needs network and the iTunes id),
  or a masked crop of the 64-pt icon (≈ 192 px at 3×, C1 0.2 s, rect in §1.7).
- Green all-one loading spinner (SVG preferred).
- Status-bar dual-SIM signal glyph (SVG in pt, §1.2). Everything else in the status bar is K2-derived.
- Squircle bank tiles (§8) for KB, 케이뱅크, NH, 신한, 하나, 카카오뱅크 at minimum.
- Neutral home-screen scene art (CSS/SVG; nothing from the recording).
- Splash artwork (top-left campaign mark, mascot on sofa with chat bubbles, "all NH one" logo, bottom-right badge) belongs to the boot/splash spec.

## 11. Open questions (for the orchestrator / screen owners)

1. Intro timing: keep the recording's 0.65 s idle and 1.1 s white hold (≈ 2.3 s total before the splash), or shorten them?
2. iOS edge swipe-back: disable for allone (recommended; hybrid WebView app, no evidence in the recording) or keep the generic one?
3. Home-screen scene filler: neutral placeholders only (recommended), or the repo's own clone app icons (i-ONE Bank, 카카오뱅크, …)?
4. `<title>`: "올원뱅크 클론 연습" (matches `APP_NAME`) or "NH올원뱅크 클론 연습"?
5. 한도제한 / 1회 한도 / 1일 잔여한도: show fixed copy, or model real limits server-side (new allone branch; the 콕뱅크 `NH_DAILY_LIMIT` must not be reused)?
6. "올원이체" label: client mapping (recommended) or a server default kind?
7. Screen font: Pretendard for everything (kakao2 rule, recommended pending an ink comparison), or system font on Apple devices?
