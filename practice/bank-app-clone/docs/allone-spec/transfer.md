# allone (NH올원뱅크): 이체 (transfer) + 잔액채우기 (top-up) spec

Area: **누구에게 보낼까요** → **얼마를 보낼까요** → **계좌 비밀번호 입력** → (invented) 이체 확인 → 이체 완료, plus the **잔액채우기** branch
(error link → loading → page → 출금계좌 선택 sheet → 금액 입력 sheet → 잔액채우기 button) and **취소** back to home.
Sources: C2 = `…_1_4.mp4` (20–27.8 s), C3 = `…_2.mp4` (0–12.7 s and 19.5–36 s). Real pts only (ffprobe `frame=pts_time`). C2 starts at pts 0.0243 and C3 at 0.0293. Every time below is the pts of the **first frame that shows the change**.

**Excluded, not specified:** C3 **12.71–19.48** (excluded range) and C3 **33.23–34.00** (excluded range, after the password).
In the clone, 잔액채우기 and transfers simply **succeed** (§5).

**Privacy:** no recorded value appears below. That covers names, account numbers, last-4 digits, balances, typed amounts and times. Only formats and roles (§6), UI labels, product names, geometry, colours and timings.

Coordinates: **x pt = px / 3.0025**, **y pt = px / 3.000** (same convention as `infra.md`). Device 393 × 852. Web area 59–818, white native bands 0–59 and 818–852 (`infra.md` §1.1).
Fonts: sizes are **Pretendard fits** (rendered Pretendard vs. recorded ink width, height and coverage). The weight is the one whose ink coverage ratio is closest to 1.
CSS top for `line-height:1` = ink-centre − 0.54 × size (SOLUTION.md rule). **Exception: digits.** The big amount and the keypad digits match **Roboto** (repo `@fontsource/roboto`) far better than Pretendard (§0.4).
Evidence: `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/allone/frames/transfer/`. Scripts are in `…/scratchpad/allone/tools-transfer/`:
`dump.py` (1/10 decode + pts), `diff.py`, `track.py` / `edgef.py` (per-frame edges at full resolution), `bez.py` (cubic-bezier fit), `fit.py` / `fitb.py` / `rob.py` (font fits), `rad.py` (corner radius).

---

## 0. Key findings (read first)

1. **Web vs native pieces.**
   - **Web** (inside the viewport 59–818; covered by the web loading dim): 누구에게 page, 얼마를 보낼까요 page body, 잔액채우기 page, 출금계좌 선택 sheet.
   - **Native accessory panel**: the 얼마를 보낼까요 keypad panel (chips + keypad + 다음, y 435 to the screen bottom 852). It is **not** dimmed by the web loading dim (C3 1.896: panel luma stays 255 while the page goes 117).
     It behaves like an iOS keyboard. The page **re-lays out in one frame** when it opens or closes, and the panel slides from / to the screen bottom (in 175 ms, out 170 ms, §3.6–3.7).
   - **Native full-window sheets** with their own dim: **금액 입력** (luma 60) and **계좌 비밀번호 입력** (luma 68). Render them in the infra native layer.
2. **Cuts, not pushes.** Every page change is a one-frame cut, normally behind the web loading dim and spinner (`infra.md` §1.8).
   Exception: **tapping a 최근 row → 얼마를 보낼까요 is an instant cut with no loading** (C2 22.774, C3 28.963).
3. **Real flow after 다음.** 다음 opens the **계좌 비밀번호 입력** sheet (in the clip, C3 31.129). The 4th digit auto-submits, then the web loading dim runs **483 ms**. After that the recording shows only the excluded notice.
   The clone continues with an invented **이체 확인 → 보내기 → 이체 완료** (§5.1, §5.2).
4. **Digits are Roboto-like.** Big amount, for example: recorded 2-digit ink 32.6 × 27.0. Roboto 500 at 36 px gives 32.7 × 26.3 (coverage ratio 1.03). Pretendard needs 37 px for the height but is 2 pt too wide, or 1.7 pt too narrow with `tnum`.
   Keypad "00": Roboto 700 at 24 px gives width 25.3 (measured 25.3, ratio 0.97). Pretendard 600 gives 28.7.
   Use `font-family: Roboto, Pretendard` **only** on `.ao-num` (big amount, keypad digits, chip digits). Hangul stays Pretendard.
5. **The web content is a 360-wide design scaled ×1.0917 (393/360).** Measured sizes land on design integers × 1.0917:
   15 → 16.4 (rows and tabs), 13 → 14.2 (sub-lines), 17 → 18.6 (fields), 12 → 13.1 (helpers), 22 → 24.0 (margins), 44 → 48.0 (buttons), 58 → 63.3 (row pitch), 33 → 36.0 (logos).
   pt values are given below. Rounding to these keeps the clone consistent.
6. **잔액채우기 sequence** (C3): link tap → dim + panel out → page cut (+367 ms) → **출금계좌 선택 sheet auto-rises under the dim** → dim off (+1.43 s).
   Then row tap → dim → page updated → **금액 입력 sheet auto-rises** → typing → 확인 → 잔액채우기 button → loading.
   The clone then succeeds (§5.3) and returns to 얼마를 보낼까요 with the balance updated.

---

## 1. Screen / state inventory

| id | screen / state | kind | clip + pts |
|---|---|---|---|
| L1 | loading into T1 from 거래내역조회 `이체` | web dim + spinner | C2 20.091 dim on; T1 painted under the dim at 20.808; dim off **21.141** (1.050 s) |
| L2 | loading into T1 from home card `이체` | web dim + spinner | C3 26.146 → cut ≈26.43 → dim off **26.563** (417 ms) |
| T1 | **누구에게 보낼까요?** (최근 tab, 4 rows) | web page | C2 21.141–22.758 (logos and stars pop in 1 frame later, 21.158); C3 26.563–28.946 |
| T2a | **얼마를 보낼까요?** placeholder, panel open | web + native panel | C2 22.774 cut, panel slides 22.808–22.958, idle to 25.66; C3 28.963 cut, panel 28.98–29.146, idle to 30.45 |
| T2b | amount typed, **출금가능금액 부족 \| 잔액채우기** | same | C2 25.674 (1st digit) / 25.841 (2nd digit) → end of C2; C3 0–1.879; C3 20.446–21.579 |
| T2c | amount typed, enough balance, caption, **다음 enabled** | same | C3 30.463 (1st digit) / 30.596 (2nd) |
| T2d | 다음 pressed | native | C3 30.896–30.979 |
| T2e | panel closed layout (amount centred low, account row at the bottom) | web | C3 30.996–31.113 (panel sliding out); C3 34.00–34.08 |
| T3 | **계좌 비밀번호 입력** native sheet (4 dots, 4-column shuffled pad) | native | C3 31.129 (one frame, no slide) – 32.713. Digits at 32.079 / 32.346 / 32.546 / 32.679 |
| L3 | loading after the password | web dim | C3 32.746 – 33.213 (483 ms) → **[EXCLUDED 33.23–34.00]** |
| L4 | loading after the 잔액채우기 link | web dim (deepening) + panel out | C3 1.896 – 2.246 |
| T5i | **잔액채우기** page, initial (no 출금계좌) | web page | C3 2.263 – 5.46 (under the dim until 3.329, then under the T6 scrim) |
| T6 | **출금계좌 선택** web bottom sheet | web sheet | rises C3 2.879–3.196 under the dim; idle 3.329–5.163 |
| L5 | loading after the T6 row tap | web dim over the sheet | C3 5.179 – 5.563 (sheet removed and page updated at 5.463) |
| T7 | **금액 입력** native sheet | native | #1: dim 5.579, rise 5.643–≈6.0, × 7.729, slide down to 7.879, dim off 8.246. #2: dim 9.513, rise 9.559–≈9.91, digit 1 10.746, digit 2 10.946, 확인 pressed 11.096, slide down 11.189–11.33, dim off 11.696 |
| T5s | 잔액채우기 page, 출금계좌 selected, amount 0 | web page | C3 8.246 – 8.73 |
| T5k | same, scrolled 66 pt (max) | web page | C3 8.746 – 8.963 (momentum scroll), rest 9.0 – 9.5 |
| T5f | amount filled, limits shown | web page | C3 11.696 – 12.029 |
| T5p | 잔액채우기 button pressed (lighter) | web | C3 12.029 – 12.129 |
| L6 | loading after 잔액채우기 | web dim | C3 12.146 – 12.70 → **[EXCLUDED 12.71–19.48]** → clone: success (§5.3) |
| G1 | real-app glitch right after the excluded range: T2's keypad panel slides up **over** T5 | native | C3 19.529–19.663. Do not copy (§3.9) |
| X1 | 잔액채우기 × → T5 removed (cut) → T2 panel re-slides | web + native | cut C3 20.446, panel 20.496–20.646 |
| X2 | **취소** → home | web dim + panel out | C3 21.596 → home cut 21.979 → dim off 22.246; C3 35.229 → 35.629 → 35.896 |

Not in the recording (invented, §5): T1 typing and bank sheet, the other tabs, 삭제하기 mode, T2's 출금 account sheet, the confirm and done pages, top-up success, T3 ×/↻/⌫/OK behaviour, back buttons.

---

## 2. Screens

### 2.0 Tokens (measured unless marked)
| token | value | where |
|---|---|---|
| green | **#0C8F2D** | 다음 enabled, 확인, 잔액채우기, 타행 계좌등록, password dots |
| green pressed (native) | **#003E0E** | 다음 (C3 30.9), 금액 입력 확인 (C3 11.15) |
| green pressed (web) | **#12A434** (lighter) | 잔액채우기 button (C3 12.05). Use it for every web green button |
| disabled fill | **#F5F5F5** | T1 다음 (text #808080), T2 다음 (text #FFFFFF), T5 잔액채우기 initial (text white) |
| field border | 1 pt **#EEEEEE** | T1 inputs, T5 fields |
| chip / tab base line | 1 pt **#F5F5F5** | chips, tab base line |
| outline button border | 1 pt **#DCDCDC** | 농협 계좌등록 |
| text | #000; labels **#4E4E4E**; secondary **#4C4C4C**; sub / placeholder **#808080**; inactive tab **#9E9E9E**; amount placeholder **#BCBCBC** | |
| error | **#FF0000** (most saturated pixels #FC0001) | 출금가능금액 부족 |
| link | **#555555**, underline 1 pt #575757 | 잔액채우기 link |
| star outline | **#8F8F8F**, stroke ≈1.5 | T1 rows |
| native sheet grey | × **#656571**, amount placeholder **#525154**, caption **#4E525A** | T7 |
| scrim (web sheet) | white → 176–178 = **rgba(0,0,0,.30)**, fade-in ≈300 ms | T6 |
| native dims | T7 luma **60** (black .765), T3 luma **68** (black .733), whole window incl. status band | infra §1.4 |
| web loading dim | luma 117 over white (infra fit rgba(56,56,59,.70)); one-frame on/off | L1–L6 |

### 2.1 Shared web header (T1, T2, confirm): fixed, white, 59–109
- **Back `<`**: ink box x 23.98–35.64, y 73.67–94.33 (11.7 × 20.7). Black stroke ≈2.0, round caps (SVG). Hit area 44 × 44.
- **취소**: right-aligned ink x 344.4–368.7, y 78.0–90.7. **14.5 px / 400, #838383**.
- T2 recipient block (below the header, scrolls with nothing; T2 does not scroll):
  - **Name** `<NAME_R>`: centred (ink centre x 196.2), ink y 113.67–128.33, **16.5 px / 500, #141414**.
  - **Bank + number** `<BANK> <ACCT_R digits>`: centred (ink x 123.6–269.8 for a 12-digit number), ink y 142.33–155.0. **14.3 px / 400, #808080**, digits raw (no hyphens), one space.
    **Underline** 1 pt #888888 at y 157–158 spanning the text width.

### 2.2 T1 누구에게 보낼까요? (web page, white)
Top → bottom (ink boxes):
| element | geometry | style |
|---|---|---|
| title "누구에게 보낼까요?" | ink x 28.98–197.5, y 135.67–155.67 (origin ≈ x 28.5, i.e. **4.5 pt right of the 24 content edge**) | **22.2 px / 500–600** (coverage 1.06 at 500, 0.91 at 600 → use 500), #000 |
| 계좌번호 input | box **x 24–369, y 192–246 (54 tall)**, r **12**, 1 pt #EEEEEE, fill #FFF | placeholder "계좌번호를 입력해 주세요" ink x 45.96–228.8, y 211.67–228.0, **18.4 px / 400, #808080** (left padding 22) |
| 은행 select | box **x 24–369, y 258–312**, r 12, 1 pt #EEEEEE | "은행을 선택해 주세요" ink x 45.96–196.8, y 277.67–294.0, **18.4 px / 500, #000** (black even when empty). Chevron ▾: x 336.3–348.3 × y 282.0–288.7 (12 × 6.7), stroke ≈1.4 black, open V |
| helper | ink x 24.65–254.1, y 333.0–344.67 | "계좌번호를 입력하면 은행을 조회해 드릴게요" **13.2 px / 400, #4C4C4C** |
| 다음 (disabled) | **x 24–369, y 377–425 (48)**, r **6.5**, fill #F5F5F5 | "다음" centred, ink y 394.67–410.0, **17.5 px / 400, #808080** |
| tabs | 4 equal cells over x 24–369 (86.25 each): centres 67.1 / 153.4 / 239.6 / 325.9. Text ink y 477.67–493.0 | "최근" "자주" "내계좌" "연락처", **16.4 px / 500**; active #000, inactive **#9E9E9E** |
| tab lines | base line 1 pt **#F5F5F5** at y 507–508, x 24–369. Active underline **2 pt #000 (#030303)** at y 506–508 spanning the whole cell (24–110.6 for 최근) | |
| 삭제하기 | right-aligned ink x 319.1–369.0, y 535.33–548.33; underline 1 pt at y 549–550 | **15.0 px / 500, #000** |
| rows | first logo top **570.0**, **pitch 63** (☆ and tile edges are 189 px apart in C3 27.500 and C2 21.200; the first fit read 63.33). The 5th would start below the web area, so the list scrolls | |
| ↳ logo | **x 24–60, 36 × 36 squircle** (§7) | |
| ↳ name | x 71 (ink 70.7), ink y +0.67…+15.3 from the logo top | `<NAME_R>` **16.3 px / 500, #000** |
| ↳ sub | x 71, ink y +22.3…+35.0 | `<BANK> <ACCT digits>` **14.3 px / 400, #808080**, raw digits, one space |
| ↳ ☆ | x 347.3–367.3, y +7.7…+27.3 (20 × 19.7, centred on the logo centre) | outline 5-point star, stroke ≈1.5 **#8F8F8F**, mitred (SVG). Filled (invented, shared with `account.md`): **#FFC31A** fill + stroke |

Scroll (invented, consistent with T5): the header (59–109) is fixed and everything else scrolls as one page. No bounce colour change.
Rows have no dividers and no pressed state in the clip (use bg #F7F7F7 on `:active`, invented).

### 2.3 T2 얼마를 보낼까요? (web page + native panel)
**Panel open layout** (T2a–T2c; the page re-lays out to this in the same frame the panel starts opening):
| element | geometry | style |
|---|---|---|
| header + recipient | §2.1 | |
| amount placeholder | centred (ink x 90.9–303.1), ink y **241.33–269.33** | "얼마를 보낼까요?" **31.6 px / 500, #BCBCBC** |
| amount typed | group centred on x 196.4. Digits ink y **228.0–256.3** (error state) / **229.67–258.33** (caption state). "원" follows after a **9.7 pt** ink gap | digits **Roboto 500, 36 px, #000**, thousands commas. "원" **Pretendard 400, 33 px, #000** |
| caption (enough balance) | centred, ink y **272.33–285.0** | Korean reading of the amount, **14.4 px / 400, #808080**. Format: `N원` below 10,000; `N만 N,NNN원`; `N억 N,NNN만 N,NNN원`, dropping zero parts (`500만원`, `1만원`) (invented beyond 2 digits) |
| error line (insufficient) | centred group, ink y **273.67–286.33** | "출금가능금액 부족" **14.4 px / 400, #FF0000**, gap **8.3**, then "잔액채우기" **14.4 px / 400, #555555** with a 1 pt #575757 underline at y 287.33–288.33. It replaces the caption |
| account row | ink y **380.67–395.0** (centre ≈388) | "한도제한" **11 px / 400, #000** at x 43.6 (no pill; only for accounts flagged 한도제한) · `NH농협은행(<LAST4>)` **14.8 px / 400, #4B4B4B** at x 90.9 · right: `<BAL>원` **14.2 px / 500, #000**, right ink edge 335.7 · chevron ▾ x 343.0–356.0, y 384.0–391.7, stroke ≈1.3 black |
| page bg | #FFFFFF | |

**Native panel** (white, no top divider or shadow): **y 435–818**, slides as one block.
| element | geometry | style |
|---|---|---|
| chips ×5 | y **439.33–473.33 (34)**; x 21.65–86.93 / 92.92–157.87 / 164.2–228.81 / 235.14–300.08 / 306.08–371.02 (65.3 wide, gap 6.2), r **7**, 1 pt #F5F5F5, fill #FFF | "+1만" "+5만" "+10만" "+100만" "전액": **14.2 px / 400, #000**, centred (digits `.ao-num`) |
| keypad 3 × 4 | x 21.65–371 in 3 columns (centres **79.9 / 196.3 / 312.8**). Rows centred at **523.8 / 583.8 / 644.2 / 704.2** (pitch 60.1; cell 60 tall, first cell 493.8–553.8) | digits **Roboto 700, 24 px, #000** (ink height 17.3–17.7). Row 4: "00" · "0" · ← (arrow ink x 298.3–316.3, y 697.3–711.3, 18 × 14, stroke ≈1.5, round caps, SVG). **No press highlight** in the recording (C2 25.674 and C3 30.463 show no key change) |
| 다음 bar | **x 24–369, y 754–810 (56)**, r **8.5** | disabled: fill #F5F5F5, "다음" **18.8 px / 600, #FFFFFF** (white on light grey, barely visible). Enabled: fill #0C8F2D, white text. Pressed: **#003E0E** |
| bottom | 810–818 white (panel padding 8). The native band 818–852 stays white | |

**Panel closed layout** (T2e; the instant re-layout when the panel leaves): amount block ink y **424.67–453.33** (digits) and caption **467.33–480.0**, same x.
Account row ink y **771.0–786.0** (same x positions). Header and recipient unchanged.
Both layouts centre the amount block about 12 pt above the middle of the free space (158 → account row). Use the absolute values.

Validation (measured): **다음 is enabled iff 0 < amount ≤ 출금 balance.** The first digit enables it (C3 30.463), or shows the error line when the balance is too small (C2 25.674); both happen in the same frame.
The chip and 전액 rules are invented (§5.5).

### 2.4 T3 계좌 비밀번호 입력 (native sheet, full-window dim luma 68)
- Appears **in one frame** at C3 31.129 (no slide), dim included. Leaves in one frame at 32.729. Status glyphs stay black (infra §1.5).
- Sheet: top **368**, r **20** (corner profile: +14 at x 1, +9.3 at x 3, +2.7 at x 10), white to 852.
- Title "계좌 비밀번호 입력": x 25.0, ink y 396.0–412.33, **18.8 px / 400, #000**. × at x 346.3–364.3, y 394.3–412.3 (18 × 18), black, stroke ≈1.7.
- Account line `NH농협은행 <ACCT_A hyphenated 3-4-4-2>`: centred (ink x 102.3–291.1), ink y 456.67–469.33, **≈14 px / 400, #606060**.
- Dots: **Ø 20.3 #0C8F2D**, pitch 22.0 (gap 1.7), ink y **504.67–524.67**. The group is centred on x 196.3 and grows as digits are added. **No empty placeholders.**
- Digit grid: **4 columns** (cell 98.25; centres **49.1 / 147.4 / 245.6 / 343.9**), 3 rows centred at **586 / 652 / 717**.
  Ten digits **in order 1–9, 0** fill the 12 cells, with **2 blank "dummy" keys** inserted at random cells. The recording had them at row 1 col 4 and row 3 col 3.
  Digits **≈25 px / 400 (Roboto 400 or Pretendard 400), #000**.
  A dummy key shows the grey NH symbol (ring with a V on top), **#D4D4D8**, ≈19 × 18 (SVG, §7).
- Bottom row: **3 columns** (centres 65.5 / 196.5 / 327.5) at y centre **779.7**: ↻ (ink x 56.3–75.9, 19.6 × 20, stroke ≈1.7) · ⌫ (184.5–208.2, 23.6 wide, outline tag with ×) · **"OK"** (ink x 319.1–339.4, y 773.0–786.3, **15.8 px / 400**). All black.
- Timing: each digit adds a dot in one frame. The 4th digit (32.679) is followed **50 ms** later (32.729) by sheet + dim off, then the web loading dim (32.746) for **483 ms**.

### 2.5 T5 잔액채우기 page (web, white)
**Fixed header 59–109** (white; content scrolls under it and is clipped at 109): title "잔액채우기" centred (ink x 159.2–233.1), ink y 76.67–92.33, **17.6 px / 500**.
× at x 349.0–365.65, y 75.67–92.33 (16.7 square), black, stroke ≈1.7, round caps.
**Fixed footer from y 722** (solid white, hard edge): button **x 24–369, y 731.33–788 (56.7)**, r **15**, then 30 pt white to 818.

Scrolling body (unscrolled positions):
| element | geometry | style |
|---|---|---|
| title (2 lines) | "잔액이 부족할 땐" ink x 24.98, y 141.67–161.67; "NH올원뱅크에서 채워보세요" ink y 169.67–189.67 (line pitch 28) | **22.6 px / 500, #000** |
| label 입금계좌 | ink x 24.98, y 245.33–258.0 | **14.3 px / 400, #4E4E4E** |
| 입금계좌 field (read-only) | **x 24–369, y 272–326**, r 12–13, 1 pt #EEEEEE | `NH농협은행 <ACCT_A 3-4-4-2>` x 46.6, ink y 291.67–308.0, **17.1 px / 600, #000** |
| balance | right-aligned to x 368, ink y 341.33–353.0 | `잔액<BAL_A>원` (no space after 잔액), **13.1 px / 400, #4C4C4C** |
| label 출금계좌 | ink x 24.65, y 408.33–421.0 | as 입금계좌 |
| **initial**: select box | **x 24–369, y 435–502 (67)**, r 12, 1 pt #EEEEEE | "출금계좌를 선택해주세요" x 49.6, ink y 462.67–477.33, **16.6 px / 500, #000**. Chevron x 336.0–348.3, y 466.3–473.0 |
| **selected**: block (no border) | padding 21 inside x 24–369 | logo **x 45–81, y 468.67–505 (36)**. Product name x 94.3, ink y 470.67–487.33, **16.5 px / 500, #000**. `NH농협은행 <ACCT_B 3-4-4-2>` (or `<BANK> <digits>`) ink y 493.0–504.0, **11.3 px / 400, #7D7D7D**. Chevron x 336.3–348.3, y 474.3–481.0 |
| ↳ 출금가능금액 | right edge 346.7; label ink y 534.33–547.0 **14.4 px / 400, #4E4E4E**; amount ink y 556.0–574.33 | `<BAL_B>원` **18.7 px / 500, #000** (digits `.ao-num`) |
| label 금액 | initial ink y 555.33–568.3; selected **652.33–665.0** (+97) | 14.1 px / 400 #4E4E4E |
| 금액 field | initial **y 582–636**; selected **679–733**; r **13**, 1 pt #EEEEEE | empty: "0" at x 45.65 **#808080 ≈18 px / 400**, unit "원" right (ink right ≈347) **≈18 px / 600, #000**. Filled: `<AMT> 원` right-aligned (ink right 346.4), **17.9 px / 600, #000** |
| limits (2 lines, right-aligned to 368) | initial ink y 645.33–657.0 / 662.33–674.0; selected +97 (742.33 / 759.33, behind the footer until scrolled) | "1회 한도 **0**원" / "1일 잔여한도 **0**원" before selection. After selection "1회 한도 **500만** 원" / "1일 잔여한도 **100만** 원". **13.1 px / 400, #4C4C4C**, value **700 #000** |
| 잔액채우기 button | footer | **disabled until a 출금계좌 is chosen**: #F5F5F5 with white text (C3 2.3 and 5.5 under the dim). Enabled #0C8F2D. Pressed **#12A434**. Label **18.5 px / 600, #FFF**, ink y 752.67–769.33 |

Scroll: max scroll **66 pt** in the selected state (content bottom = limits + ≈ 17 pt above the footer edge). Scrolled positions (C3 12.05): label 입금계좌 179.33, field 206–260, 금액 field **613–667**, limits ink y **676–688 / 693–705**.
iOS-style momentum and scroll indicator (C3 8.75).

### 2.6 T6 출금계좌 선택 (web bottom sheet)
- Sheet top **453**, r **24** (top corners), white, extends past 818 (the band below is white anyway). Scrim **rgba(0,0,0,.30)** over 59–818.
- Title "출금계좌 선택": x 25.0, ink y 476.33–494.67, **20.6 px / 500, #000**. × at x 349.0–365.6, y 476.7–493.3 (16.7), black.
- Rows: first logo top **527.33**, **pitch 63** (527.33 / 590.33 / 653.33). Same row component as T1 (logo x 24–60; name 16.4/500 at x 71; sub 14.3/400 #808080), **no ☆**.
  Recorded order: KB (KB나라사랑우대통장, sub `국민은행 <14 digits>`), 케이뱅크 (MY 입출금통장, sub `케이뱅크 <12 digits>`), NH (NH페이모아통장(비대면실명확인), sub `NH농협은행 <ACCT 3-4-4-2>`).
  So it lists **all my accounts except the 입금계좌**, other banks first.
- Buttons: **y 731.33–788 (56.7)**. "농협 계좌등록" x 24–190.8, white, 1 pt **#DCDCDC**, label **18.4 px / 500, #000**. Gap ≈10. "타행 계좌등록" x 200.8–367.4, #0C8F2D, label **18.4 px / 600, #FFF**. r **15** for both. Bottom padding 30.
- With more than about 3 rows (invented): the list scrolls between the title and the buttons. Max sheet top = 160.

### 2.7 T7 금액 입력 (native sheet, full-window dim luma 60)
- Sheet top **224** at rest, r **24**, white to 852 (covers the band).
- Title "금액 입력": x 24.65, ink y 250.67–268.67, **19.8 px / 600, #000**. × x 347.0–363.3, y 251.7–268.0, **#656571**, square caps, stroke ≈1.6.
- Amount, centred: placeholder **"0원"** ink y 303.0–328.0, **27.8 px / 400, #525154**.
  Typed: `<AMT> 원` black: digits ≈29 px / 400 (SF-like, use Roboto 400 29 px), "원" 28.2 px / 400. Then a caption (Korean reading) ink y 348.33–360.33, **≈13.5 px / 400, #4E525A**.
- **Digit roll** (C3 10.746–11.03): on a key press the placeholder "0" vanishes at once and "원" turns black.
  The new digit enters **30 pt above** its slot at opacity ≈.1, moves down linearly (≈2 pt/frame, ≈120 pt/s) while fading to ≈.26, and is still grey at rest.
  It snaps to solid black when the next render settles (C3 11.029, ≈280 ms after the first press; the 2nd digit snapped about 83 ms after its own press).
  Clone: `translateY(-30pt → 0)`, `opacity .1 → .3`, linear 250 ms, then solid. A new key press finishes all running digits at once.
- Chips ×4: **y 383–417 (34)**; x 24–105.6 / 111.6–193.5 / 199.8–281.4 / 287.4–369 (≈81.6, gap 6); r ≈6; 1 pt #F5F5F5.
  Labels "+ 1만원" "+ 5만원" "+ 10만원" "+ 100만원" (space after +), **14.4 px / 400, #000** (thin).
- Keypad 3 × 4: column centres **80 / 196 / 312**, rows centred **484.7 / 550.3 / 615.7 / 681.3** (pitch 65.5). Digits **Roboto 700, 25 px, #000**. Row 4: "00", "0", ← (thin, as §2.3).
- 확인: **x 24–369, y 730–786 (56)**, r **5.5**, #0C8F2D. Pressed **#003E0E**. Label **17.6 px / 500, #FFF**, ink y 749.67–765.67.
- Status glyphs flip to white 600 ms after the dim arrives (infra §1.5).

---

## 3. Interactions and transitions (measured)

| # | trigger | effect and timing | clone |
|---|---|---|---|
| 3.1 | 거래내역조회 `이체` | web dim on C2 20.091 (17 ms after release) → T1 painted under the dim 20.808 → dim off **21.141**. Logos and stars appear **1 frame later** (image load) | loading 1050 ms (or max(api, 1050)), cut. `from` = the list's account |
| 3.2 | home card `이체` | dim C3 26.146 → cut ≈26.43 → off **26.563** | loading **417 ms**, `from` = that card's account |
| 3.3 | **tap a 최근 row** | **instant cut** to T2a (C2 22.774 / C3 28.963), no dim. Layout is "open" at once. **The panel starts sliding ≈ 5 ms after the cut** | §3.6 slide-in |
| 3.4 | key press on T2 | amount updates in the same frame, no key highlight. Error or caption and 다음 state update in the same frame | |
| 3.5 | chips | not recorded | §5.5 |
| 3.6 | **panel slide-in** | re-measured frame by frame (chip text and the digit rows agree): the panel (435–852) comes in from the **screen bottom (852)**, not 818, and its content shows in the 818–852 band while it moves. Panel top from the C3 28.963 cut: hidden, 836, 804.7, 759.7, 706.3, 646.3, 588.3, 532.7, 489.7, 459, 441, 435. Fit **175 ms cubic-bezier(.4,.2,.6,1)** starting **5 ms** after the cut (rms 1.0–1.4 pt); the first 818-based 150 ms (.31,.18,.55,.89) fit is 5–40 pt off | `transform: translateY(100%) → 0`, 175 ms that curve, delay 5 (`AO_PANEL`) |
| 3.7 | **panel slide-out** | to the screen bottom. Panel top from the C3 1.896 dim frame: 442.7, 459.3, 491, 536, 587.3, 647, 709, 762, 804.3. Fit **170 ms cubic-bezier(.4,0,.6,.7)** (rms 1.5–2.2 pt; it starts one frame before the dim). Same at 21.596 and 30.996. The layout jumps to "closed" in the first frame | `translateY(0 → 100%)`, 170 ms that curve (`AO_PANEL`) |
| 3.8 | 다음 | press: fill **#003E0E** (C3 30.896, 5 frames) → **30.996** layout closed + panel out → **31.129** T3 sheet + native dim in **one frame** (no slide) | as recorded |
| 3.9 | T3 digits | one dot per digit at once. The 4th triggers sheet + dim off after **50 ms** → web loading dim **483 ms** | clone → confirm page (§5.1). Never send or store the PIN (infra §9) |
| 3.10 | **잔액채우기 link** | **1.896**: web dim (117) + panel out (§3.7) + layout closed. The dim then **deepens 117 → 91 over ≈300 ms** (1.896–2.196, ease-out). **2.263**: T5 cut under the dim (dim back to 117). **2.879–3.196**: T6 rises under the dim, while the scrim fades in behind it (dim reads 117 → 90). **3.329**: dim + spinner off in one frame (scrim stays, 176) | timings as recorded: cut +367 ms, sheet start +983 ms, dim off +1433 ms |
| 3.11 | **T6 rise** | top 818 → 453: start 2.879, **≈291 ms**, fit **cubic-bezier(0,.11,.17,.87)** (strong ease-out). Scrim fades in ≈300 ms | |
| 3.12 | T6 row tap | **5.179** web dim over everything (sheet too) → **5.463** T6 removed (no slide) and T5 shows the selected account → **5.563/5.579** web dim off and **T7 native dim on** (one shared frame reads luma 20; skip it) → **5.643** T7 starts rising | auto-open T7 when amount is 0 |
| 3.13 | **T7 rise** | 852 → 224: **≈357 ms**, fit **cubic-bezier(.19,.52,.23,1)** (two openings agree: 357 / 351 ms) | |
| 3.14 | **T7 close** (× or 확인) | slide down **≈140–150 ms** (C3 7.729–7.879, 11.189–11.329), fit ≈ **cubic-bezier(.29,.19,.54,.75)**. **The native dim stays ≈370 ms after the sheet is gone**, then disappears in one frame (8.246, 11.696). 확인 pressed #003E0E ≈93 ms before the slide | |
| 3.15 | tap 금액 field (T5) | native dim on in one frame (9.513), sheet rises from **+46 ms** | |
| 3.16 | 잔액채우기 button | pressed **#12A434** at 12.029 (≈100 ms) → web dim **12.146** → [excluded at 12.71] | clone: loading **567 ms** → success (§5.3) |
| 3.17 | T5 × | page removed (cut, 20.446) → T2 visible with the panel re-sliding **20.496–20.646** (§3.6) | the clone also closes T5 the same way after success |
| 3.18 | **취소** (T2) | **21.596**: web dim + panel out + layout closed → home cut under the dim **+383 / +400 ms** → dim off **+650 / +667 ms** (21.596/22.246; 35.229/35.896) | reset the stack to home (the home spec owns the 정기점검 sheet rerun) |
| 3.19 | spinner | green all-one spinner centred ≈ (196.5, 425) during every web dim; phase rules in `launch.md` | shared `AlloneLoading` |

Do **not** copy G1 (C3 19.53–19.66: the T2 panel sliding up over T5 right after the excluded range). It is a real-app glitch tied to the excluded range.

---

## 4. Data and server

### 4.1 What each screen needs
| screen | data | source |
|---|---|---|
| T1 최근 | `{bank, number, holder, payeeId?, favorite}` newest first, max 20, own accounts excluded | **existing** `GET /api/transfer/recipients?from=` → `recent` (default branch; `APP==="kakao"` branch is not taken) |
| T1 자주 | favourites | **existing** `favorites` (payees with `favorite=1`, ordered by holder) |
| T1 내계좌 | my accounts except `from`, rows show **product name** (label) + `<BANK> <digits>`, no ☆ | **existing** `mine` (`label`, `bank`, `number`, `balance`) |
| T1 연락처 | none | static empty state (§5.6) |
| T1 ☆ | toggle | **existing** `PATCH /api/payees/:id {favorite}`. With no payee yet: `POST /api/payees {bankCode, number, holder, favorite:true}`. **Small change: POST must accept `favorite`** (shared with `account.md`) |
| T1 삭제하기 | hide a recent entry | **new, allone-gated** (§4.2) |
| T1 계좌번호 + 은행 → 다음 | holder lookup | **existing** `GET /api/transfer/lookup?bank&number` (404 → helper error) |
| T2 | from-account: name, `bank`, `number` (→ last 4), `balance`, 한도제한 flag; recipient `{bank, number, holder}` | **existing** `GET /api/accounts/:id`. 한도제한 flag per `home.md` / `infra.md` (badge or `limited` column) |
| T2 → confirm → done | transfer | **existing** `POST /api/transfers {fromAccountId, bankCode, number, amount, memoTo?, memoMe?}` → `{id, outTxId, balanceAfter, at, to}`. Memo: **existing** `PATCH /api/transactions/:outTxId {memo}` (≤ 20) |
| T5 | 입금계좌 (target = the T2 from-account, or the main account from 전체메뉴), sources = all my accounts except the target with balances | **existing** `GET /api/home` (`accounts`) |
| T5 limits | 1회 한도 **5,000,000** (constant). 1일 잔여한도 = **1,000,000 − today's top-ups from that source** | constants in the client. Today's sum from **existing** `GET /api/transfers?from=<source>` (filter `at` = today). Display-only by default |
| T5 잔액채우기 | move money source → target | **existing** `POST /api/transfers {fromAccountId: source, bankCode: "nh", number: target.number, amount, memoTo:"잔액채우기", memoMe:"잔액채우기"}`. `findRecipient` resolves my own account and the existing code writes the out tx, the in tx and the transfer row atomically |

`POST /api/transfers` already returns **400 INSUFFICIENT_BALANCE** when needed. The client pre-checks, so the user never sees it. 잔액채우기 and transfers always succeed (no server-side block).
`API_DELAY_MS` (250 ms) sits inside the recorded loading holds. Hold each loading for **max(api, recorded)**.

### 4.2 Server changes for this area (all allone-gated, additive)
1. `POST /api/payees`: accept `favorite: true` on insert (shared with the account spec).
2. **Recent hide** (삭제하기): table `recent_hidden(bank_code TEXT, number TEXT, hidden_at TEXT, PRIMARY KEY(bank_code, number))`, created only when `APP === "allone"`.
   - `DELETE /api/transfer/recent?bank=&number=` upserts `hidden_at = nowIso()`.
   - In `/api/transfer/recipients` (allone only) drop recent rows whose `last_at <= hidden_at`. A new transfer brings the row back.
   - Fallback if the orchestrator wants no server change: per-profile localStorage list (not shared across devices).
3. `txDetailJson`: the `in_tx_id` lookup for top-up deposits (already listed in `infra.md` §2.2). The 거래내역 상세 then shows 출금계좌 = the source account.
4. Nothing else. Do not reuse `NH_DAILY_LIMIT` / `db().app === "nh"` (콕뱅크).

### 4.3 Seed needs (invented, owned by `server/allone-seed.mjs`)
- The **main NH account balance must be small** (for example a few thousand 원) so that 출금가능금액 부족 and 잔액채우기 can be reproduced. A second NH account (NH페이모아통장(비대면실명확인)) has a moderate balance.
- KB나라사랑우대통장 (kb, 6-2-6) and MY 입출금통장 (kbank, 3-3-6) are `external`, with balances: they are the T6 sources.
- ≥ 4 payees (invented 홍길동-style names) across 전북은행, 신한은행, 카카오뱅크, 하나은행 (the recording's bank mix), with seeded transfers in the last month so that 최근 has 4+ rows. Mark 2 as `favorite` for 자주.
- Bank display names: allone shows `NH농협은행` for code `nh` (BANKS says 농협은행). Map it in the client (`bank.code === "nh" ? "NH농협은행" : bank.name`). The others match BANKS (국민은행, 케이뱅크, 신한은행, 카카오뱅크, 하나은행, 전북은행).

---

## 5. Invented (not in the recording), with defaults

### 5.1 이체 확인 page (web, cut after the 483 ms password loading)
- Header §2.1 (back `<` → T2, 취소 → home as §3.18).
- Title (T5 style): x 24, two lines at **22.6 px / 500**, pitch 28, first ink top ≈141. Line 1 `<NAME>님에게`, line 2 `<AMOUNT>원을 보낼까요?` (amount digits `.ao-num`).
- Box: x 24–369, top 230, r 13, 1 pt #EEEEEE, padding 20. Rows 48 tall: label left **14.3 / 400 #4E4E4E**, value right **16.3 / 500 #000**.
  - 받는 계좌: `<BANK> <digits>`
  - 출금 계좌: `NH농협은행(<LAST4>)`
  - 받는 분 통장 표시 ›: default my name
  - 내 통장 표시 ›: default the holder
  - 수수료: `면제`
  The two 표시 rows open an input sheet (max 20, uses the shared Korean keyboard from the search/menu spec) and fill `memoTo` / `memoMe`.
- Below the box: memo field like the 거래내역 상세 one ("메모 입력 (최대 20자)", optional). Saved with `PATCH /api/transactions/:outTxId {memo}` after success.
- Footer §2.5: **보내기** (green, pressed #12A434). Tap → web dim + spinner, `POST /api/transfers`, hold max(api, **1000 ms**) → done page (cut).

### 5.2 이체 완료 page (web, no back)
- Green check: circle **Ø 56 #0C8F2D**, white check stroke 3, centre (196.5, 220). Pop-in: scale .8 → 1 + fade, 200 ms ease-out.
- Centred text **22.6 px / 500**, pitch 28, first ink top ≈272: `<NAME>님에게` / `<AMOUNT>원을 보냈어요` (amount in #0C8F2D).
- Box (as §5.1) with rows: 받는 계좌, 출금 계좌, 거래 후 잔액 (`balanceAfter`), 메모 if set.
- Footer: **확인** (green). It returns to the screen that started the flow, with dim + spinner ≈650 ms as §3.18, and invalidates the home, accounts and transactions caches.
  From 거래내역조회 or 다시보내기 (`account.md` item 10), go back to the list.

### 5.3 잔액채우기 success
1. After the loading (567 ms; `POST /api/transfers` as §4.1), T5 closes (**cut**, as §3.17).
2. T2 shows with the panel sliding in (§3.6), the account row balance updated, and the error line replaced by the caption. 다음 enables when amount ≤ the new balance.
3. Toast `잔액을 채웠어요`: pill rgba(0,0,0,.80), white 14.3 / 400, padding 12 × 20, r 22, centred, bottom edge at y 419 (16 above the panel). Fade 200 ms, hold 2000 ms.

If T5 was opened from 전체메뉴 (home spec), stay on T5 instead: reset the amount, refetch the balances, show the same toast above the footer (bottom at 712).

Errors (client, invented, red **#FF0000 13.1 px / 400** under the 금액 field):
- amount 0 → `금액을 입력해 주세요`
- amount > 출금가능금액 → `출금가능금액을 초과했어요`
- amount > 5,000,000 or > 1일 잔여한도 → `이체한도를 초과했어요`

Buttons 농협 계좌등록 / 타행 계좌등록: toast `준비 중인 서비스예요` (accounts are added through the 🔔 panel).

### 5.4 T1 input flow
- Tap 계좌번호: focus border **1 pt #0C8F2D**, caret #0C8F2D. Digits only, max 16, typed text **18.4 px / 500 #000**.
- Keyboard: an **iOS 26 number pad** in the native layer.
  - Panel #F0F1F4 (infra keyboard colour), 4 × 3 white keys (r 8.5, h 46, gap 6).
  - Digit 25 / 400 + letters 10 / 600 (ABC…). Bottom row: blank · 0 · ⌫.
  - Slide-in 250 ms `cubic-bezier(.2,.8,.2,1)`; it covers the bottom band. Tapping outside dismisses it.
- **Bank auto-fill** (matches the helper text): after ≥ 10 digits and a 300 ms pause, if the number matches exactly one bank among `recent` / `favorites` / `mine`, put that bank in the select.
- **Bank select** → web sheet styled like T6: top 118, r 24, scrim .30, rise as §3.11.
  - Title `은행 선택` + ×; tabs `은행 / 증권사` styled as §2.2.
  - 3-column grid (cell 115 × 84): 36-pt tile + name **13.1 / 400 #000** centred. BANKS order with `nh` (NH농협은행) first. The grid scrolls.
  - Tap → sheet down 150 ms and the name shows in the select.
- **다음** enables when number ≥ 10 digits and a bank is chosen (green, white 17.5 / 400). Tap → web dim + spinner, lookup, hold max(api, 417 ms).
  - OK → cut to T2 (§3.3 panel timing).
  - 404 → the helper turns **#FF0000**: `입력하신 계좌정보를 확인해 주세요`.

### 5.5 T2 extras
- Chips: `+N만` adds N × 10,000. `전액` sets the amount to the balance (empty if 0).
- Max 13 digits. Amount > 5,000,000 → red line `1회 이체한도 초과` (layout as the error line, no link), 다음 disabled.
- Back `<`: cut to T1 while the panel slides out (§3.7).
- **Account row ▾**: the panel slides out (§3.7), then a 출금계좌 sheet styled as T6 rises (title `출금계좌 선택`; my NH accounts; balance right-aligned **14.2 / 500**; no buttons).
  Pick → sheet down 150 ms → the panel slides in → amount re-validated.
- Recipient bank + number line: tap → copy the digits and show the toast `계좌번호를 복사했어요` (§5.3 style).

### 5.6 T1 tabs and edit mode
- Tab switch: instant (no underline slide, consistent with the app's cuts).
- 자주: favourites, ☆ filled.
- 내계좌: own accounts. Name = product name; tap → T2 with holder = my name.
- 연락처: centred grey text **14.3 / 400 #808080** at y ≈ 620: `연락처는 연습용 앱에서 지원하지 않아요`.
- 삭제하기 (only on 최근): the link becomes `완료`, each ☆ becomes a 22-pt grey circle × (#BCBCBC). Tap × → the row is removed at once (no animation) and §4.2 hide runs.
- Empty 최근 / 자주: centred `최근 보낸 내역이 없어요` / `자주 보내는 계좌가 없어요` (same style as 연락처).

### 5.7 T3 extras
- × → sheet + dim off in one frame, the panel slides back in (§3.6).
- ↻ re-randomizes the 2 dummy positions. ⌫ removes the last dot.
- OK with fewer than 4 digits does nothing.

---

## 6. Placeholder table (personal data seen; formats only)

| role | where | placeholder and format |
|---|---|---|
| recent recipients (4) | T1 rows | `<NAME_R1..R4>`: 3-syllable Korean names |
| their accounts | T1 rows, T2 sub-line | `<ACCT_R1>` 전북은행 13 digits · `<ACCT_R2>` 신한은행 12 digits · `<ACCT_R3>` 카카오뱅크 13 digits · `<ACCT_R4>` 하나은행 14 digits. All raw digits, no hyphens |
| recorder's main NH account | T2 row, T5 입금계좌 | `<ACCT_A>` 13 digits **3-4-4-2** with hyphens on T5; last 4 only on T2 `NH농협은행(<LAST4_A>)` |
| recorder's 2nd NH account | T6 row, T5 selected, T3 | `<ACCT_B>` 3-4-4-2 hyphenated; `NH농협은행(<LAST4_B>)` on T2 |
| recorder's KB account | T6 | `<ACCT_KB>` 14 digits raw |
| recorder's 케이뱅크 account | T6 | `<ACCT_KBANK>` 12 digits raw |
| balances | T2 row, T5 `잔액…원`, `출금가능금액` | `<BAL_A>` (main), `<BAL_B>` (4-digit, comma) |
| typed amounts | T2 (C2 and C3), T7, T5 | `<AMT_1>` 1 digit, `<AMT_2>` 2 digits |
| status-bar clock, home-screen content | everywhere | not in this area's scope (infra) |

---

## 7. Assets (icons and crops)

| asset | how | privacy |
|---|---|---|
| bank squircle tiles 36 pt: 전북, 신한, 카카오뱅크, 하나 | **crop** C3 27.5 s, px x **72–180**, rows y px **1710–1818 / 1900–2008 / 2088–2196 / 2278–2386**. Mask with a continuous squircle (r ≈ 11) over white | **OK**: logos only. Text starts at px 212, outside the box |
| KB, 케이뱅크, NH tiles | crop C3 4.5 s (sheet over scrim, tile area white), px x 72–180, y px **1582–1690 / 1771–1879 / 1960–2068** | **OK** (no text inside). Or use infra's `AlloneBankLogo` (colour tile + white mark). Prefer that if it already exists |
| NH tile on T5 | same as NH above, drawn at x 45 | OK |
| back `<`, ×(web), ×(native #656571), ▾ chevrons, ← arrow, ☆ / ★, ↻, ⌫, check | **SVG** (sizes and strokes in §2) | n/a |
| NH symbol for the T3 dummy keys | **SVG** (ring + V, #D4D4D8, 19 × 18). Crop fallback: C3 32.6 s px x 1003–1060, y 1731–1785 | OK (public brand mark, no personal data) |
| all-one spinner | shared (`launch.md`) | n/a |

Never crop rows, sheets or fields that contain names, numbers or amounts. Rebuild them with seed data.

---

## 8. Open questions
1. Top-up limits: display-only with the client checks of §5.3 (default), or enforce server-side (allone branch in `POST /api/transfers` with a `topup` flag)?
2. Should 한도제한 accounts also enforce a 1일 transfer limit on T2? Default: no, the tag is display-only.
3. 삭제하기: server table (§4.2, default) or localStorage only?
4. Confirm-page order: password → confirm (default, matches the recording's password-then-server-check) or confirm → password?
5. Digits font: `.ao-num` Roboto (recommended, measured) or Pretendard everywhere for simplicity (≈2 pt width error on big amounts)?
