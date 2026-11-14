# toss (토스 / 토스뱅크) — infra spec: codebase map + device chrome

Area: everything needed to add app id **`toss`** as its own server/app (port 9117, dev vite 5181 / API 8795),
Galaxy + DARK fixed, no recording intro. Screens themselves are other specs; this file is the plumbing
checklist, the AppName / bank-code traps, reusable parts, and measured device chrome.

Privacy: no values from the recordings appear below (names, numbers, balances, amounts, merchants, dates).
Only formats, UI labels, product/brand names, geometry and colours.
Scratch evidence: `/tmp/claude-0/-home-user-ps/23b26e0f-9264-5b65-bab4-ff964ff6821e/scratchpad/toss/frames/infra/`
(splash_avg.png = 56-frame average 0.5–6 s of video A, home_avg.png, push_tile.png, B_25/B_33/B_50 frames),
tools in `.../scratchpad/toss/tools/infra/`.

Repo baseline at the time of writing: `git status` clean, `npx tsc -p tsconfig.app.json --noEmit` exit 0 (TypeScript 7.0.2).

---

## 0. Key decisions / findings (read first)

1. **Same device as the NH 콕뱅크 / 하나원큐 recordings.** Video A starts (0–0.55 s) in the One UI app drawer,
   which has NH콕뱅크 installed, and the clock ink sits at exactly the NH-measured spot. 480×1066 is the
   1080×2400 panel scaled by 4/9 (2400·4/9 = 1066.67 → 1066). So the frame is **384 × 853.33 dp**,
   the same as `html[data-app="nh"|"hana"]`, with **status bar 28 dp + app 810.33 dp + nav band 15 dp**.
   Conversion: `dp_x = px / 1.25`, `dp_y = px / 1.24922` (using /1.25 for y is off by ≤ 0.53 dp at the very bottom).
2. **Nav band is the NH/하나 15 dp band, not kbank's overlay.** Content always ends at video y = 1047 px (= 838.4 dp)
   and rows 1048–1065 have their own colour, #171619 (23,22,25), on every screen, even on home where the page is #100f12.
   So keep the shared `.phone__navbar` (already shown when `APP !== "kakao" && OS === "android"`) and
   recolour it, like `hana.css` does.
3. **TS7 strict is on by default.** These already fail when `AppName` gets `"toss"` (I checked this with a test file):
   `APP_NAME: Record<AppName,…>` (TS2741), `ROUTES[APP]` in App.tsx (TS7053), and the `overlay={{…}[APP]}` object in App.tsx (TS2339).
   Other per-app chains use `APP === "x" ? … :` and **fail silently**: toss falls through to the NH or kakao branch.
   §3 lists all of them, including DevPanel `ownBank()` → 농협 and ScreenStack `NH_ANDROID`.
4. **`toss` is both an app id and a bank code** (server/banks.mjs `B("toss","토스뱅크","토스뱅크","#DBE9FE",[4,4,4])`).
   They are separate namespaces. Where they meet, it works or must be handled. See §4.
   The recording shows the 토스뱅크 통장 number as **12 digits, 4-4-4**. That matches the existing pattern, so no banks.mjs change.
5. **No dark-only lock exists yet.** `theme.ts` only has `lightOnly`. §2.10 gives the design: `darkOnly` + a `THEME_LOCK`
   used by OsSwitch, DevPanel and ProfilePicker, gated so ibk/kbank/kakao2 behave exactly as today.
6. **Font:** Toss Product Sans is proprietary and not available. Use **Pretendard** (already global). Details in §7.

---

## 1. Device chrome measured from the recordings

All dp are screen coordinates (0 = top of the status bar). They come from averaged frames in which the area was static.

### 1.1 Frame
| item | value | evidence |
|---|---|---|
| frame | 384 × 853.33 dp, same rule as nh/hana (`--frame-w:384px; --frame-h:853.33px`) | 480 px / 1.25; app drawer 0–0.55 s = NH device |
| status bar | 0–28 dp | clock ink x 28.0 dp, y 8.0–18.4 dp (NH: 27.7 dp, 8.0–18.67 dp, same device). A black band of 40 px → 32 px in A 14.23–14.25 s is the toast window sliding in, not the status bar |
| app viewport | 28 – 838.33 dp | content ends at y 1047 px in A_20/A_45/A_120/B_2/B_140/B_155/B_165 |
| nav band | 838.33 – 853.33 dp (15) | own colour on every screen |

### 1.2 Status bar (One UI, dark)
- **Background** = colour of the screen behind it. Set it per screen with `useStatusBar(bg, "light")`.
  Home page is **#100f12** (16,15,18). Splash, 통장, list, 이체 and 증명서 screens are **#171619** (23,22,25).
- **Text/icons** are near-white. Clock max luma 240–245 ≈ NH's `#f0f0f2`. Clock 14 px / 400.
  **Reuse NH's CSS block as is**: height 28, padding-left 26.7, font-size 14, weight 400, children `translate: 0 -1.07px`,
  85 ms colour transitions, seam `box-shadow: 0 1px 0 <bg>` (PhoneFrame applies it for every `APP !== "kakao"`).
- **Clock format**: the device shows a **12-hour clock without AM/PM** ("h:mm"; an afternoon recording shows a single-digit hour).
  `useClock()` in PhoneFrame.tsx is 24-hour for every app. Suggest a toss-only 12-hour format: `h % 12 || 12`.
- **Left icons, after the clock** (dp x): One UI **screen-recorder indicator** at 60.0–71.2. It is corner brackets with a camcorder inside.
  The camcorder **blinks with a 1.000 s period at 50 % duty**: in A, on at …0.75 s and off at …0.25 s, steady for 130 s.
  This is the same rhythm as ibk2's `BLINK_MS` 1000. Next come 1–3 third-party notification icons. They differ between A and B
  and include a 하나원큐 "1Q" icon in B, so omit them. **Recommendation:** draw the recorder indicator only while
  `useRecorder().status === "recording"`. kakao2's red island dot follows the same rule. Without intro there is no "always on" case.
- **Right cluster** (dp x; ink y ≈ 7.2–19.2; right margin 27.2 dp): battery-protection icon 241.6–249.6 ·
  alarm clock 255.2–266.4 · sound-off speaker with slash 271.2–282.4 · Wi-Fi with ↑↓ activity arrows 286.4–303.2 ·
  signal 4 bars 306.4–316.0 (two short, two tall) · `NN%` 321.6–346.4 (for two digits) · battery with charging bolt 348.8–356.8.
  Draw them as **one 384×28 SVG in dp coordinates**, as `KbankIcons` / `IbkIcons` do. That avoids per-icon pixel snapping.
  Battery % and clock come from `useDeviceStatus()` / `useNow()`, so the switch row controls keep working.
  Generic `AndroidIcons` (wifi, signal, %, battery) is the acceptable fallback for a first pass.
- **Samsung Edge-panel handle** (optional, present in every frame): left edge x 0–4.8 dp, y 119.3–237.0 dp,
  fill ≈ #5a595c, 1 px lighter right edge (≈ #67686c), rounded right end. Could be a pointer-events:none div in PhoneFrame for toss.

### 1.3 Nav band and gesture handle
- Band **#171619**. The handle is a rounded bar **≈ 115 × 4.2 dp, x ≈ 134.7–249.2 (centred on 192), y ≈ 843.7–847.9 dp**,
  colour **#6b6a6d** (107,106,109). This is the NH geometry: 115.2 × 4.27 at 5.33 dp below the band top, already in
  `.phone__navbar i`. Only the colours change. Hana's dark band is #191a1c with handle #6c6d6f, almost identical.
- **Under the Samsung keyboard** (B 25 s): band **#090909**, handle **#616161**, keyboard toolbar #252525 from video y 618.
  This is the same keyboard and geometry as `src/hana/HanaKeyboard.tsx`. The ⌨ / ∨ row sits in the band. Same as hana's `data-hana-kb` rule.
- **Under a bottom-sheet scrim** (B 33 s, 은행 선택 sheet): the scrim covers the whole window. Status bar area and page go
  #171619 → **#09080b** (black ≈ 0.61). The band goes to **#050407** and the handle to **#5e5d60**.
- **Under a web dialog** (B 50 s, "계좌번호를 찾을 수 없어요"): only the web content area dims (y 81.6–838.3 dp, again #09080b).
  The native header (status bar + top bar, 0–81.6 dp) and the nav band stay undimmed. Screen specs should pick per case.

### 1.4 Home tab bar (for the home spec; measured here for chrome continuity)
- Fill #171619, same as the band, so the two read as one. 1 px top hairline at video y 975 (≈ 780.5 dp, luma 39 on 23).
  Top corners radius ≈ 19–20 dp. Spans 780.5 → 838.33 dp (57.8 dp) and continues visually into the band. 5 equal tabs of 76.8 dp:
  홈 / 혜택 / 쇼핑 / 증권 / 전체.

### 1.5 Brand colours sampled (dark)
Page #100f12 (home) / #171619 (others) · card #19181b · grey button #292a2f · Toss blue ≈ **#2f80f5**
(TDS blue500 #3182f6; use #3182f6 for login/DevPanel accents) · secondary blue-tinted button #1e2740 (lock screen).

### 1.6 Boot timeline (video A, measured with frame pts; for the splash/boot owner)
| time | screen |
|---|---|
| 0–0.55 s | device app drawer (not used: no intro) |
| 0.55–7.31 s | splash: 3-D blue Toss symbol centred on #171619. Static 1.0–5.5 s at x 129.6–253.6 dp, y 368.2–483.5 dp (≈124×115). Moves down ≈ 8 dp by 6 s |
| 7.31–8.57 s | full black, status bar included (status bar text stays) |
| 8.57–~10.0 s | lock screen: same symbol plus buttons **생체인식으로 잠금 해제** (blue) / **비밀번호로 잠금 해제** (#1e2740, blue text) |
| ~10.0–10.4 s | home appears |

First push (home → 토스뱅크 통장 in A, 14.11–14.17 s): quick **cross-fade ≈ 60–80 ms**. The pressed row stays until it starts.
This matches what toss inherits by default via `NH_ANDROID` (80 ms fade). §2.13 has the details.

---

## 2. Touchpoint checklist (file by file)

Rule from the kakao2 work: **every change is gated** (`APP === "toss"` / `TOSS`) so the other 8 servers render byte-identically.
Ports: kakao 5173/8787/9101 · nh 5174/8788/9103 · hana 5175/8789/9105 · ibk 5176/8790/9107 · kbank 5177/8791/9109 ·
kbank2 5178/8792/9111 · ibk2 5179/8793/9113 · kakao2 5180/8794/9115 → **toss 5181/8795/9117**.

### 2.1 `server/db.mjs`
- [ ] `export const APPS = ["kakao","nh","hana","ibk","kbank","toss"]`.
  toss is **not** in `VARIANTS`, so `INTRO = false` and `APP = SERVER_ID = "toss"`.
- [ ] Error text: `APP은 kakao, kakao2, nh, hana, ibk, ibk2, kbank, kbank2, toss 중 하나`. Update the header comment too.
- [ ] `DATA` becomes `server/data-toss/` automatically (`data-${SERVER_ID}`).
- [ ] `seedTossExample(d, userName = "홍길동")` and `seedTossEmpty(d, userName)` (invented data only), plus
  `SEEDS.toss = { example: (d, name) => seedTossExample(d, name), empty: seedTossEmpty }`. SEEDS is used by first boot,
  `addProfile` and `/api/reset`, so a missing key crashes at startup: `SEEDS[APP].example`.
- [ ] **The main account must have `bank_code = 'toss'`** (kbank does `'kbank'`). index.mjs does `bankByCode(row.bank_code ?? "kakao")`
  in toAccount, PATCH number and `myAccountByNumber`. A NULL bank_code would render the 토스뱅크 통장 as 카카오뱅크.
- Suggested example shape (all invented):
  - main `토스뱅크 통장` (toss, 12-digit 4-4-4, e.g. `1000-0000-1234`).
  - Several `external` accounts for 자산 / 내 계좌: e.g. hana `영하나플러스 통장` (14 digits, 3-6-5; reuse a hana-style
    fake like `123-910000-12345`), nh `자립예탁금`, kakao `입출금통장`, using the product names seen in the UI.
  - Payees with invented names in several banks.
  - Transfers (including some to own accounts, see §2.2 `recent`).
  - Transactions: card spend in several merchants, 통장 이자, 카드 캐시백, transfers in and out.
- [ ] **Dates:** "N월에 쓴 돈" and the 소비 month calendar read the **current month**. Either generate seed timestamps
  relative to now (`daysAgo(n, "HH:MM:SS")`) or copy kbank's "fixed date + shift back" (`kbankShift/shiftIso`).
  Relative is recommended so the 소비 screen is never empty.
- [ ] (if screens need them) toss-only profile data: 토스머니 balance, point count, prepaid-card balance.
  Add nullable/defaulted columns in `migrate()` (harmless for other apps) rather than faking them as accounts.
  `accounts.kind` is CHECK('main','external') and every account shows up in DevPanel and recipients.

### 2.2 `server/index.mjs`
- [ ] Port map (last lines): add `toss: 9117`.
- [ ] `<title>` map in the dist block: add `toss: "토스"` → "토스 클론 연습". `window.__BANK_APP__ = "toss"`; no `__BANK_INTRO__`.
- [ ] `DELETE /api/accounts/:id` message map: add `toss: "토스뱅크 통장"`. Without it you get "undefined은 지울 수 없어요".
- [ ] `POST /api/accounts`:
  - Default `bankCode = APP === "kakao" ? undefined : APP` gives `"toss"`, which is the 토스뱅크 bank. That is correct by coincidence (§4). Comment it.
  - `else if (bank.code === "kakao") "카카오뱅크 통장은 이미 있어요"` is unconditional. **Gate it with `APP === "kakao"`** so a toss
    profile can hold a 카카오뱅크 account. Other single-bank apps still reject it through their own-bank lines.
  - Do **not** add an own-bank-only line for toss. Toss aggregates every bank.
  - Default `name` map: add toss only for the 토스뱅크 case (`bank.code === "toss" ? "토스뱅크 통장" : null`).
    Otherwise the label falls back to `${userName}의 ${bank.name} 계좌`. Better: DevPanel sends a name for toss (§2.11).
- [ ] `GET /api/transfer/recipients`:
  - `recent` (the non-kakao branch) does `.filter((r) => !myAccountByNumber(r.bank_code, r.number))`. **Toss lists own accounts
    inside 최근 보낸 계좌** (e.g. "내 영하나플러스 통장"), so gate: `APP === "toss" || !myAccountByNumber(…)`. The client labels them "내 …"
    by matching `mine`.
  - `mine` excludes `from` (except nh). Let the 이체 spec confirm whether toss's 내 계좌 list includes the sending account.
    Gate a change like nh does: `APP === "nh" ? "" : from`.
- [ ] `txDetailJson`: the counterpart is only looked up by `out_tx_id`. Toss 상세 shows **입금처 / 출금처** also on the receiving side
  of a transfer between own accounts. Add an additive field from `SELECT … FROM transfers WHERE in_tx_id = ?`, emitted only
  when `db().app === "toss"`, so other apps' JSON is unchanged.
- [ ] (decide with 소비 spec) `TAGS` / `KIND_BY_TAG`: the 소비 tabs are 전체 / 카드 / 입·출금 / 페이·기타. Mapping options:
  카드 = `#체크카드`; 입·출금 = `#이체` / `#자동이체` / `#예금이자`; 페이·기타 needs either a new tag (e.g. `"#페이"`) gated with
  `APP === "toss" ? [...] : ...`, or a rule. A new tag also touches `src/api/types.ts` (`TxTag`, `TX_TAGS`) and the DevPanel tag chips.
- [ ] No change needed: auth/profile middleware, `/api/home` (toss reads `profile`, `accounts`, `monthlyCardSpend` and ignores the kakao
  banners), `/api/banks`, accounts CRUD, `/api/accounts/:id/transactions`, transaction PATCH/DELETE, payees, lookup,
  `POST /api/transfers` (own-account transfers already create the matching deposit row), `/api/transfers?from=` and
  `/api/transfers/:id` (IBK; reuse for **송금 확인증**), `/api/reset`. `API_DELAY_MS` 250 ms keeps the skeletons visible;
  toss shows skeletons in A 15–18 s.

### 2.3 `server/auth.mjs`
- [ ] **No change.** `COOKIE = bank_sid_${SERVER_ID}` gives **`bank_sid_toss`**. Admin password goes to `server/data-toss/admin-password.txt`,
  and the log prefix uses SERVER_ID.

### 2.4 `server/banks.mjs`
- [ ] **No change.** 토스뱅크 (`toss`, 4-4-4) and 토스증권 (`tosssec`) already exist. Toss's bank-picker grid uses its own short
  labels and order (토스뱅크, 신한, 우리, IBK기업, 하나, 새마을, 부산, iM뱅크(대구), 케이뱅크, 신협, 우체국, SC제일, 경남, 광주,
  수협, 전북, 저축은행, 제주 …). Put that list client-side in `src/toss/bank.ts`, the way `src/hana/bank.ts` and `src/nh/banks.ts`
  do it, not in banks.mjs.

### 2.5 `src/profile/session.ts`
- [ ] `export type AppName = "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss";`
- [ ] APP parse: add `|| appName === "toss"`. Otherwise the client silently runs as kakao.
- [ ] `APP_NAME` gets `toss: "토스"`. This is a `Record<AppName,string>`, so TS fails without it. Used by LoginScreen and AdminPanel.
- [ ] Optional `export const TOSS = APP === "toss";`, mirroring `KAKAO2`. Update the port comment.

### 2.6 `src/vite-env.d.ts`
- [ ] `VITE_APP?: "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss"`.

### 2.7 `.env.toss` (new)
```
# npm run dev:toss (vite --mode toss) 일 때만 읽힘 → 화면이 토스로 (갤럭시 · 다크 고정, 녹화 인트로 없음)
VITE_APP=toss
```
(no `VITE_INTRO`). `vite.config.ts` `fs.deny` already blocks `.env.*`.

### 2.8 `package.json`
- [ ] `"dev:toss": "concurrently -k -n api,web -c yellow,cyan \"node --watch --disable-warning=ExperimentalWarning server/index.mjs --app toss --port 8795\" \"vite --mode toss --port 5181\""`
- [ ] `"start:toss": "node --disable-warning=ExperimentalWarning server/index.mjs --app toss"`

### 2.9 `vite.config.ts` and `.gitignore`
- [ ] Proxy map: add `toss: 'http://localhost:8795'`, plus a comment line ("npm run dev:toss … 화면 5181 + API 8795").
  `API_TARGET` override still works.
- [ ] `.gitignore`: add `server/data-toss/`.

### 2.10 `src/platform/platform.ts` and `src/platform/theme.ts` (Galaxy + DARK lock)
- [ ] platform.ts: `export const DEVICE_LOCK: Os | null = IBK2 ? "android" : KAKAO2 ? "ios" : APP === "toss" ? "android" : null;`
  This automatically hides the Galaxy/iPhone switch in `OsSwitch` and ignores `?os=ios`. No `dataset.toss` is needed: `data-app="toss"` is set in main.tsx.
- [ ] theme.ts: dark-only design, mirroring `lightOnly`:
  ```ts
  import { APP, KAKAO2 } from "../profile/session";
  // 토스는 녹화가 다크 모드뿐 → 늘 다크 (kakao2 라이트 고정의 반대). 스위치 · 🔔 테마 · 프로필 테마를 숨기거나 무시
  const darkOnly = APP === "toss";
  export const THEME_LOCK: Theme | null = KAKAO2 ? "light" : darkOnly ? "dark" : null;
  export const THEME_CHOICE: Theme | "system" = darkOnly ? "dark" : isTheme(chosen) ? chosen : "system";
  export const THEME: Theme = lightOnly ? "light" : darkOnly ? "dark" : /* unchanged */ …;
  ```
  `THEME_CHOICE = "dark"` for toss means main.tsx saves `theme: "dark"` on the profile, and DevPanel never shows a stale value.
  `THEME_LOCK` deliberately excludes ibk/kbank (`lightOnly`): today they still show a non-working 라이트/다크 switch, and the
  kakao2 rule is "don't change other apps".
- [ ] Consumers:
  - `PhoneFrame.tsx` `OsSwitch`: `{!KAKAO2 && …라이트/다크…}` → `{!THEME_LOCK && …}`. Same result for kakao2, hidden for toss.
  - `DevPanel.tsx` `BasicForm`: 기기 field `!KAKAO2` → `!KAKAO2 && APP !== "toss"` (or `!DEVICE_LOCK`, which would also hide
    ibk2's useless 기기 field; that is a behaviour change, so gate unless agreed). 테마 field → `!THEME_LOCK`.
  - `ProfilePicker.tsx` `enter()`: `os` already uses `KAKAO2 ? OS : p.os ?? OS`. Make it `KAKAO2 || TOSS ? OS : …`
    (or `DEVICE_LOCK ?? …`, as the original kakao2 commit did). Do the same for `theme` (`… ? THEME_CHOICE : p.theme ?? THEME_CHOICE`).
    Otherwise an old profile with `theme:"light"` triggers a pointless `location.assign(?theme=light)` reload.

### 2.11 `src/dev-panel/DevPanel.tsx` and `DevPanel.css`
Toss aggregates many banks, so it is neither "own bank only" (nh/hana/ibk/kbank) nor kakao.
- [ ] `AccountsTab`: `APP !== "kakao" ? <AddOwnBankAccount/> : <AddBankAccount/>`. For toss, `ownBank()` returns
  **NH (농협)** because `OWN_BANK[APP === "hana"||"ibk"||"kbank" ? APP : "nh"]`. Fix:
  - Add `OWN_BANK.toss = { code: "toss", name: "토스뱅크", placeholder: "토스뱅크 통장", numberLabel: "토스뱅크 계좌번호 (12자리)" }` and extend both
    `ownBank()` and the `AddPayee` default-bank chain (`APP === "hana"||"ibk"||"kbank"` …) with `"toss"`.
  - For toss render **both** "토스뱅크 계좌 추가" and "다른 은행 계좌 추가". The latter is `AddBankAccount`; give it an optional
    "계좌 이름" input for toss (e.g. 영하나플러스 통장) and `exclude={[]}` (it currently excludes kakao).
- [ ] `AccountEditor`: `own = APP !== "kakao"` turns on the name field (good for toss) **and** a free-text number field sliced to `ownHint.max`.
  Add `toss: { name: "토스뱅크 통장", number: "숫자 12자리", max: 14 }`. For **non-toss accounts in toss** use the kakao branch
  (`formatAccountNumber(bank.pattern, …, bank.alt)`). Otherwise a 14-digit 하나 number plus hyphens gets truncated at 14 chars.
- [ ] `CardEditor` ("이번달 쓴 돈"): shown for `APP === "kakao" || APP === "kbank"`. Add toss, which drives home "N월에 쓴 돈".
- [ ] Toss-only fields (if §2.1 adds them), e.g. 토스머니 / 포인트: put them in AccountsTab under `APP === "toss"`.
- [ ] Tag options: only if a toss tag is added (§2.2).
- [ ] `accountName()` already returns `a.label` for non-kakao, which is fine.
- [ ] `KbankTakeTwo`, `SuspendToggle`, `showRecent` UI are kakao/kbank-only, so nothing to do.
- [ ] `DevPanel.css`: `.dev-panel--toss { --home-card:#19181b; --home-btn:#292a2f; --home-line:#2c2c33; --home-text:#fff;
  --home-sub:#9e9ea4; --yellow:#3182f6; --yellow-pressed:#1b64da; color-scheme:dark }` and
  `.dev-panel--toss .btn:not(.btn--danger):not(.btn--in):not(.btn--out):not(.btn--ghost){color:#fff}` (pattern of `.dev-panel--nh`/`--kbank`).
- Opening the panel: toss home has a **bell (🔔) top-right** with a red dot. Wire it to `<DevPanel>` like the other homes do.

### 2.12 `src/components/PhoneFrame.tsx` / `PhoneFrame.css`
- [ ] `StatusBar()`: add a toss branch on the android path:
  `OS === "android" && APP === "toss" && <TossLeft rec={recording} />` (recorder indicator, 1 s blink) and the right side
  `APP === "toss" ? <TossIcons/> : …` (§1.2). Otherwise it falls to `AndroidIcons`.
  The seam `boxShadow` already applies (APP !== "kakao"); keep it, since 28 dp ends at device px 78.75, the same half-pixel seam as NH.
- [ ] `useClock()`: toss-only 12-hour format (§1.2).
- [ ] `PhoneFrame()`: `navbar = APP !== "kakao" && OS === "android"` already gives toss the 15 dp `.phone__navbar` band with handle. Recolour in CSS:
  ```css
  html[data-app="toss"] .phone__navbar { background:#171619; box-shadow:0 -1px 0 #171619; }  /* 띠가 0.4px 내려가 있음 */
  html[data-app="toss"] .phone__navbar i { background:#6b6a6d; }
  html[data-app="toss"][data-toss-kb] .phone__navbar { background:#090909; box-shadow:0 -1px 0 #090909; }
  html[data-app="toss"][data-toss-kb] .phone__navbar i { background:#616161; }
  html[data-app="toss"][data-toss-dim] .phone__navbar { background:#050407; box-shadow:0 -1px 0 #050407; }
  html[data-app="toss"][data-toss-dim] .phone__navbar i { background:#5e5d60; }
  ```
  If HanaKeyboard is reused, either also match `[data-hana-kb]` for toss or parametrise its dataset key.
  These could live in a `src/toss/toss.css` like `hana.css`.
- [ ] Status bar CSS: append `html[data-app="toss"] .statusbar--android` to the three NH/하나 selector groups
  (height/padding/font, `> *` translate, `.statusbar--light` colour #f0f0f2).
- [ ] `overlay` prop: App.tsx must pass a toss key (§2.14). Use a toss loading layer if the screens need one (e.g. toast/scrim above the status bar), otherwise `undefined`.
- [ ] Optional Edge-panel handle (§1.2).
- [ ] Mobile ≤ 500 px: `global.css` hides `.statusbar > *` etc. but **not** `.phone__navbar`. NH keeps its band on real phones; kbank hides its handle.
  Choose one; recommendation: hide `html[data-app="toss"] .phone__navbar` on ≤ 500 px, since the real phone draws its own.

### 2.13 `src/components/ScreenStack.tsx` / `ScreenStack.css`
- `NH_ANDROID = APP !== "kakao" && OS === "android"` is a catch-all, so toss already gets `navMs` 80 (push) / 100 (pop) and
  android pop animations stay enabled. But `layer-fade` linear and `layer-fade-out` are only defined for `html[data-app="nh"]`.
  For toss, push uses the generic `[data-os="android"] .layer--push-enter` (ease-out fade at 80 ms). Pop has **no** CSS, so the
  exiting layer just sits on top for 100 ms and then vanishes.
- [ ] Add `const TOSS_ANDROID = APP === "toss";` (OS is locked) with its own `navMs` branch and
  `html[data-app="toss"] .layer--push-enter / .layer--pop-exit` keyframes, **once the screen specs measure them**.
  The only measurement so far is the home → 토스뱅크 통장 activity: a 60–80 ms cross-fade at A 14.11–14.17 s.
  In-app web pages (통장 → 거래내역 → 상세, 증명서 steps) may differ.
- `canSwipe` is iOS-only, so it does not matter. Galaxy back = browser back (history), as in kbank/ibk.

### 2.14 `src/App.tsx`
- [ ] Imports: `src/toss/*` screens. Recommended: a `src/toss/routes.tsx` exporting `renderTossRoute`, like `src/kakao2/routes.tsx`,
  so App.tsx gains one import. Import `src/toss/toss.css` there or in routes.
- [ ] `const ROUTES = { …, toss: renderTossRoute }`. TS7053 if missing.
- [ ] `overlay={{ nh:…, hana:…, ibk:…, kbank: undefined, kakao: undefined, toss: <TossLayer/> | undefined }[APP]}`. TS2339 if missing.
- [ ] Splash chain: `APP === "toss" ? <TossSplash onDone={toReady} />`. Without it toss falls to kakao's `<Splash onDone={toLoading}/>` (yellow kakao splash + BootLoading).
  TossSplash should own the full boot of §1.6 (splash ~6.75 s → black ~1.3 s → lock screen → home). Its timing can be compressed; the screens owner decides.
  `?skip` (`warmStart`) and the recorder restart (`boot = "splash"`) need no change.
- [ ] Routes: owned by screen specs (home, 통장, 거래내역, 상세, 이체 steps, 증명서 flow, 소비, 자산, 전체). Paths may overlap other apps; only one app renders per server.

### 2.15 `src/components/AppBrand.tsx`
- [ ] `if (APP === "toss") return <TossAppIcon size={size} />;`. The icon is a white rounded square with the blue Toss symbol, as in the app drawer.
  Options: an App Store original via an `appicon.py` like `scripts/kbank-crops/appicon.py` (needs network; the iTunes lookup id
  must be looked up), or an SVG redraw. It appears on Login, ProfilePicker and AdminPanel.

### 2.16 `src/auth/LoginScreen.tsx`, `src/profile/ProfilePicker.tsx`, `auth.css`, `ProfilePicker.css`
- [ ] `useStatusBar(...)` bg chain: add `APP === "toss" ? "#171619"` before `"var(--home-bg)"`. That var resolves to kakao's dark #1f1f1f on `html`,
  not the picker's override. The fg expression already yields `"light"` for toss (THEME dark), so no change there.
- [ ] CSS: `.login--toss { background:#171619; color:#fff }`, `.login--toss .login__form input:focus { border-color:#3182f6 }`,
  `.login--toss .login__btn { background:#3182f6; color:#fff }`. Also `.picker--toss { --home-bg:#171619; --home-text:#fff;
  --home-sub:#9e9ea4; --home-btn:#292a2f; --home-card:#19181b; --home-line:#2c2c33 }`.
- [ ] `ProfilePicker.enter()` lock: see §2.10.

### 2.17 `src/platform/recorder.ts` and `intro.ts`
- [ ] **No change required.** `cfg` is null for toss and `isIntroOn()` is false (`HAS_INTRO` false). ● 녹화 runs off → 600 ms → `RESTART_EVENT "start"` → splash.
- If the status-bar recorder icon reuses `useBlinkEpoch`, add toss to `BLINK_MS` (`APP === "ibk" || APP === "toss" ? 1000 : …`).
  A plain CSS 1 s `steps` animation is enough, since no intro video needs a phase match.

### 2.18 `src/styles/global.css`
- [ ] Frame size: add `html[data-app="toss"]` to the NH/하나 rule `--frame-w:384px; --frame-h:853.33px`. The `:not([data-os="ios"])` guard is harmless.
- [ ] Do **not** redefine the global `[data-theme="dark"] --home-*` tokens. They are kakao's. Put toss tokens in `src/toss/toss.css`
  (e.g. `--toss-bg:#171619; --toss-home-bg:#100f12; --toss-card:#19181b; --toss-btn:#292a2f; --toss-blue:#3182f6`).
- [ ] `.skel` is light (#f0f0f2 + white shimmer). Toss needs a dark skeleton (A 15–18 s: blocks ≈ #201f26 on #17161b) via its own class
  or `.toss .skel` override.

### 2.19 Docs
- [ ] `README.md`: dev list (`npm run dev:toss # 토스: → http://localhost:5181 (API 8795)`), VPS block (`npm run start:toss # 9117`,
  pm2 line), "서버 하나는 앱 하나만" paragraph (`APP=toss`, `server/data-toss/`), login paragraph ports list (토스(9117)),
  admin-password folder list (`data-toss/`), a new section **"## 💙 토스 (toss)"** (Galaxy · 다크 고정, no intro, screens, 🔔 패널 differences),
  the switch-row note (toss has no `Galaxy/iPhone` and no `라이트/다크`), the 데이터 section (`seedTossExample`), and asset commands if any.
- [ ] `SOLUTION.md`: folder tree (`toss/`), and a new **"## 26. 토스 (toss)"** covering: same device as 콕뱅크 (384×853.33, 28 + 15 band),
  dark lock (`THEME_LOCK`), aggregator data model (main + external accounts; recent includes own accounts), the bank-code/app-id coincidence (§4),
  measurements, and the watermark rule (§8).

---

## 3. Type-check and silent-fallthrough traps when `AppName` grows

| place | what happens without a toss entry |
|---|---|
| `session.ts` `APP_NAME: Record<AppName,string>` | **TS2741** (build fails) |
| `App.tsx` `ROUTES[APP]` | **TS7053** |
| `App.tsx` `overlay={{…}[APP]}` | **TS2339** |
| `session.ts` APP parse chain | silently **kakao** |
| `App.tsx` splash chain | kakao Splash + BootLoading |
| `DevPanel` `ownBank()` / `OWN_BANK[...]` / `AddPayee` default | **농협** |
| `DevPanel` `ownHint` chain | "자립예탁금 / 13~14자리" |
| `ScreenStack` `NH_ANDROID` (`APP !== "kakao"`) | NH 80/100 ms timings, no pop CSS |
| `PhoneFrame` `navbar` (`APP !== "kakao"`) | black NH band (#000 + #5d5d5d handle) |
| `PhoneFrame` StatusBar right side | generic `AndroidIcons` |
| `LoginScreen` / `ProfilePicker` status-bar bg | `var(--home-bg)` = kakao dark #1f1f1f |
| server `SEEDS[APP]` | crash on first boot |
| server title / port / delete-message maps | "undefined 클론 연습", no port (NaN → random), "undefined은 지울 수 없어요" |
| server `TAGS`, recipients `recent`, `POST /api/accounts` | kakao-or-other behaviour (see §2.2) |

`tsc -b` (in `npm run build`) catches only the first three. Grep for `APP ===`, `APP !==` and `[APP]` after the change.
Currently 11 src files contain APP comparisons: App, LoginScreen, AppBrand, PhoneFrame, ScreenStack, DevPanel, intro, platform,
recorder, ProfilePicker, session.

---

## 4. App id `toss` vs bank code `toss`

They live in different namespaces: `APP` / `data-app` / `SERVER_ID` / cookie / folder versus `bank.code` / `bank_code` / asset names.
Every place they meet:

1. `POST /api/accounts` default `bankCode = APP` (non-kakao) gives `"toss"`, the **토스뱅크** bank. Correct by coincidence; keep it and comment it.
2. DevPanel `OWN_BANK` is keyed by APP but carries `code`. `toss: { code: "toss" }` is consistent.
3. Assets: shared logos are `bank-toss.png` / `bank-tosssec.png` (kakao-style circles). **Prefix toss app assets with `toss-`**
   (`toss-app-icon.png`, `toss-bank-<code>.png` for Toss's own logo glyphs, `toss-home-*.png`). Never name an app asset `bank-*`.
   `localAsset("toss-bank-toss")` is unambiguous.
4. Never test `code.startsWith("toss")`: it also matches `tosssec`. Hana does a `startsWith("tax")` check elsewhere, so the pattern exists in the codebase.
5. CSS: `data-app="toss"` (html attribute) and toss screen classes (`.toss-*`) do not clash with anything. No `[data-bank]` selectors exist.
6. Seeds: the main account `bank_code` **must** be `'toss'` (§2.1); otherwise it falls back to `"kakao"`.
7. Payees in other apps already use bank `toss` (12-digit numbers). That is unaffected.

---

## 5. Server API reuse for toss screens

| screen | endpoint(s) | notes |
|---|---|---|
| home, 자산 총 자산 | `GET /api/home` | sum balances client-side; `monthlyCardSpend` for "N월에 쓴 돈" |
| 토스뱅크 통장 / other-bank account | `GET /api/accounts/:id`, `/api/accounts/:id/transactions?limit=` | `balanceAfter` is computed by the server |
| 상세 내역 | `GET /api/transactions/:id`, `PATCH {memo}` | needs the `in_tx_id` addition (§2.2) for 입금처/출금처 of own transfers |
| 어디로 보낼까요 | `GET /api/transfer/recipients?from=` | `recent` own-account gate (§2.2) |
| 계좌번호 입력 → 은행 | `GET /api/transfer/lookup?bank=&number=` | 404 `ACCOUNT_NOT_FOUND` → "계좌번호를 찾을 수 없어요" dialog (B 50 s) |
| 송금 / 옮기기 | `POST /api/transfers` | own account means "옮길까요 / 옮겼어요", others "보낼까요 / 보냈어요" (client wording). "출금할 수 있는 돈이 0원이에요" is a client check before posting |
| 증명서 → 송금 확인증 | `GET /api/transfers?from=`, `GET /api/transfers/:id` | IBK precedent |
| 소비 (month) | per-account transaction lists merged client-side | or a new `GET /api/transactions?month=` if it gets slow; only toss uses it |
| 🔔 panel | existing | §2.11 |

---

## 6. Reusable shared parts

- **`src/hana/HanaKeyboard.tsx`**: the Samsung number keyboard from the **same device**. Tool row #252525 at video y 618,
  4 rows (1 2 3 ⌫ / 4 5 6 완료 / 7 8 9 .- / · 0 · ,), and a ⌨ / ∨ row in the band. Toss B 6–33 s shows exactly this.
  Reuse it, preferably by moving it to `components/` or importing it and adding toss band colours (§2.12).
  The Korean keyboard (B ~100 s, 받는 분에게 표시 memo) is new.
- **`src/lib/keypad.ts` `applyKey`** (`00`, `back`): use it for the toss amount pad (1–9, 00, 0, ←). `kbank/keypad.tsx` has a similar 3×4 layout but different visuals.
- **Asset slots** `src/assets/Asset.tsx` `localAsset(name)`: looks up `name.dark` first, then `name`. Toss is always dark, so plain `toss-*.png` is enough.
  The `import.meta.glob` bundles only existing files. Respect `scripts/keep_assets.py` in any crop script (no overwrite without `--force`).
- **`components/BankIcon.tsx`**: shared kakao-style circular logos (150 px), falling back to a colour circle with a short name.
  Toss's bank grid (B 33 s) uses **its own logo glyphs on rounded tiles**, so either new `toss-bank-*` assets or accept the circles.
- **`hooks/useStatusBar`**: per-screen status-bar colour. `LayerContext` / `useLayerActive`. `ScreenStack` (layers, memo, enter/exit).
- **`api/useApi`**: `prefetch` during splash, cache, `invalidate` after mutations. **`lib/format.ts`**: `won`, `signedWon`, `groupByDate`.
  **`nh/hangul.ts`**: `hangulAmount` if amounts are read out in Korean.
- **Patterns to copy, not import**: `kbank/nav.ts` `useKbankGo` (double-tap / mid-transition navigation lock);
  IBK `useIbkBackHandler` (Galaxy back closes sheet → step → screen); kakao2 `dim.ts` (one loading scrim owner);
  `IbkCertificate` watermark (§8).
- **`components/Sheet.tsx`** (Sheet / Dialog / Keypad) is kakao-styled. Toss sheets are inset floating cards (≈ 12 dp side margins,
  large radius, B 33 s), so a toss-specific component is likely.
- **Skeleton** (`.skel` in global.css): structure reusable, colours need a dark override (§2.18).
- **`platform/deviceStatus`**: battery and clock for the status bar. **`platform/capture`**: capture mode is fine as is.

---

## 7. Fonts

- **Toss Product Sans**, Toss's in-house font, is not available and not redistributable. Do not try to fetch it.
- Available: **Pretendard** (npm `pretendard`; global `body` font via `pretendardvariable-dynamic-subset.css`; static OTFs in
  `node_modules/pretendard/dist/public/static/` for render tests), `@fontsource/noto-sans-kr`, `@fontsource/roboto`, and system **Inter** (fc-list).
- **Use Pretendard Variable** (no extra import). A quick render of 0원, 토스뱅크 통장 and 계좌 · 카드 · 포인트 모두 보기 next to the home average
  (`frames/infra/font_cmp.png`) shows close Hangul shapes. Digits look slightly narrower/taller in the recording.
  The screen specs should run kbank's FONT.md-style ink comparison on a few digit strings (Pretendard default vs `ss01`/`tnum`, Inter Display)
  before fixing sizes. Status-bar clock: Pretendard 14/400, as NH does.

---

## 8. Safety rule for documents (증명서 / 송금 확인증 / 문서.pdf)

The 송금 확인증 is an official-looking bank document with a red circular seal and a verification URL.
Follow the i-ONE Bank precedent (README IBK section, SOLUTION 22 "이체확인증 워터마크"):
- Overlay **"연습용 화면 · 실제 이체 아님"** repeated diagonally on the certificate preview **and** on the 문서.pdf viewer page.
- **Do not reproduce the bank's seal or stamp image**: draw a neutral placeholder or omit it. Use a dummy issue number and
  dummy verification text. Keep the layout.
- "파일 저장하기", share and save: no-op, as on IBK, or at most save a watermarked image. Never produce a clean PDF.
- Same rule for any other certificate (통장 사본, 잔액증명서 …) if built.

---

## 9. Assets needed (infra-level only)
- Toss app icon (Login / ProfilePicker / AdminPanel): App Store original or SVG.
- Splash / lock-screen 3-D blue Toss symbol (≈ 124 × 115 dp): a crop from the static 1.0–5.5 s splash average gives only 1.25 px/dp.
  Upscale it (the Real-ESRGAN pipeline in `scripts/ibk-crops/esrgan.py`) or vectorise it.
- Status-bar icon set (One UI: recorder indicator, battery-protection, alarm, sound-off, Wi-Fi with arrows, signal, charging battery): SVG drawn in dp.
- Optional Edge-panel handle (CSS only).

## 10. Open questions (for the orchestrator / screen owners)
1. Status-bar notification icons: show the One UI recorder indicator only while ● 녹화 runs (recommended), always, or never?
   Should the toss status bar copy the recording's fixed right cluster (alarm, mute, charging) or keep generic icons?
2. 12-hour clock for toss only (matches the device) vs the 24-hour clock used by all other apps.
3. Edge-panel handle on the left edge: replicate (fidelity) or skip?
4. Data model for 토스머니 / 포인트 / 토스유스카드-style rows on home: new profile columns (recommended) vs not modelled.
5. 소비 "페이·기타" category: new tag (`#페이`, toss-only) vs mapping rule.
6. Seed dates: relative to now (recommended) vs fixed recording-day + shift.
7. On real phones (≤ 500 px): hide the fake nav band and handle (recommended, kbank-like) or keep it (NH-like)?
