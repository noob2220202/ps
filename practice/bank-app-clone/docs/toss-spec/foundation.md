# Foundation contract (as built, commit ece0cf1)
Authoritative over plan.md where they differ. Verify step aligned src/toss/api.ts to the server.

## SERVER — contract

All toss additions appear only when the server runs as toss. Money is integer 원. Local timestamps are "YYYY-MM-DDTHH:MM:SS". Months are "YYYY-MM" everywhere.

**Profile.** `GET /api/profile`, `PATCH /api/profile` and `/api/home .profile` add:
`pointChances: number`, `rewardMax: number | null`, `rewardDismissed: "YYYY-MM" | null`, `adSnoozeUntil: string | null`.

PATCH also accepts:
- `pointChances`: integer 0–99
- `rewardMax`: integer or null (null hides the banner)
- `rewardDismissed`: "YYYY-MM" or null
- `adSnoozeUntil`: any Date.parse-able string up to 40 characters, or null

**Account** (every toAccount: /api/home accounts[], GET/PATCH/POST /api/accounts) adds:
`openedAt: "YYYY-MM-DD" | null`, `favorite: boolean`, `role: "money" | null`.

- `PATCH /api/accounts/:id` also accepts `favorite` (boolean), `openedAt` ("YYYY-MM-DD" or null), `sort` (0–9999) and `role` ("money" or null). A bad value returns 400 with fields.
- Toss account numbers are still checked as 12 digits.
- `POST /api/accounts {bankCode, number, balance, name?}`:
  - any bank, including kakao, is allowed for toss
  - default name is "토스뱅크 통장" for bankCode toss; otherwise "<userName>의 <bank.name> 계좌"
  - a toss-bank account gets openedAt = today
- `DELETE` main → 400 "토스뱅크 통장은 지울 수 없어요".

**Transaction rows** (`GET /api/accounts/:id/transactions[?limit]`, `POST /api/accounts/:id/transactions` response) add:
- `category: string | null` (raw value)
- `channel: "card" | "account" | "pay"`: derived when NULL (#체크카드 → card, otherwise account)
- `cardId: string | null`, `cancelled: boolean`, `exclude: boolean`
- `own: boolean`: true for a transfer between my own accounts, on either side

`POST /api/accounts/:id/transactions` and `PATCH /api/transactions/:id` also accept:
- `category`: string up to 20, or null/"" (reset)
- `channel`: "card" | "account" | "pay", or null/"" (reset)
- `cardId`: an existing card id, or null/""
- `cancelled`, `exclude`: boolean
Balances do not change on cancel.

**`GET /api/transactions/:id`** = row + existing fields + `kindLabel: "입금" | "출금"` + `counterparty`, which is null for card and other non-transfer rows, otherwise:
`{direction: "out" | "in", own: boolean, accountId?, accountName?, bank: Bank, number: string (hyphenated per bank pattern), digits: string, holder: string}`
- out = my sent transfer
- in + own = money from my own account; that account is in accountId/accountName and holder is my name
- in + not own = another person's sender record
`memoTo` is unchanged: present only when set; the client defaults to userName.

**`GET /api/transfer/recipients?from=<id>`**
- `mine[]` (still excludes `from`) adds `role: "money" | null`, `favorite: boolean`.
- `recent[]` keeps my own accounts, except `from` itself. Own rows add `accountId`, `favorite` (from accounts.favorite) and `role`. Payee rows keep `payeeId` / `favorite`.
- Ordering and LIMIT 20 are unchanged. `favorites[]` is unchanged.
- Example seed with from=main: mine = hana, kakao, nh, money ("+4개"). recent has 12 rows, including hana, kakao and money as own accounts.

**`GET /api/home`.** `monthlyCardSpend` = shared spend total (same as 소비 total) plus:
`toss: {spend: {month, total}, pointChances, reward: {month, max: number | null, dismissed: boolean}, cardBill: {id, name, amount, dueDate} | null, adSnoozeUntil: string | null}`
- `reward.dismissed` = profile.rewardDismissed === the current month.
- `cardBill` = the first card with kind credit (sort order): `amount` = its `bill`, `dueDate` = next 결제일 ('YYYY-MM-DD': this month if today ≤ payDay, else next month; a missing day → that month's last day). Home card 2 row 2 '{D}일 낼 카드값'.
- The kakao banners and the other existing fields are still present.

**`GET /api/toss/spend?month=YYYY-MM&tab=all|card|account|pay`.** Both parameters are optional (current month, all). A malformed month or tab returns 400; a future month is clamped to the current one. Returns:
`{month, label ("11월", or "2025년 12월" in another year), today: "YYYY-MM-DD", hasPrev (any transaction before this month), hasNext (month < current), tab, total, vsLastMonth: {diff}, categories: [{key, label, color, amount}], days: [{date, dow (0 = 일), income, expense}] for every day of the month, cashback: {count} | null, groups: [{date, label "D일 요일", overspent, items}]}`

Each item: `{id, txId, accountId, channel, time "HH:MM", title, suffix?: "취소", subtitle, amount (signed), tone: "spend" | "excluded" | "income" | "cancelled", icon: "transfer" | "cashback" | "interest" | "store" | "bank:<code>" | "cat:<category>"}`

Rules:
- **Counted** = amount < 0, not cancelled, not excluded, not own; transfers to other people count. total and categories use counted rows.
- **Override:** profile.cardSpend replaces total (and the current-month part of diff) only when tab = all and month = current.
- **diff** = total from day 1 to D minus last month from day 1 to min(D, its length); D is today in the current month, otherwise the last day.
- **categories:** top 3 + "그 외" #3e3d40. Category = category ?? (#이체 → 이체, otherwise 카테고리 없음). Colours as plan §2.2; unknown categories #5b5a5e.
- **overspent:** day expense ≥ 30,000 and > 2 × (month expense / days elapsed).
- **Own transfers** show once (the sending side): title "내 계좌 이체", subtitle "토스뱅크 → 하나은행", tone excluded.
- **Subtitles:** card rows show the card name; pay rows "<card name> · <merchant without _PG>"; other rows "내 토스뱅크 통장" / "내 <bank> 계좌" / "토스머니".
- **Tabs** filter by channel (pay also takes unknown channels). Everything, including overspent, is recomputed per tab.
- **cashback** is shown only for the current month on tabs all and card when cashbackCount > 0. groups[0] is then always today's group, even if it has no items.
- **Row taps:** the client navigates to /tx/:txId only when channel === "account".

**`GET /api/toss/assets`** (also used by 내 계좌):
`{total (accounts + points; cards are not assets), accounts: {count, total, items: [{id, bankCode, name, number, balance, isMain, role, favorite}]} in sort order, cards: {count, items: [{id, name, bankCode, accountId, art, kind, bill? · payDay? (credit only), sort, monthAmount}]} sorted by monthAmount desc, points: {count, items: [{id, name, balance, icon, sort}]}}`
monthAmount = this month's non-cancelled debits with that card_id.

**Cards CRUD**
- `GET /api/toss/cards` → `[{id, name, bankCode, accountId, art, kind, bill? · payDay? (credit only), sort}]`
- `POST /api/toss/cards {name, bankCode, accountId?, art?, kind = "check" | "credit", bill? (0~10억), payDay? (1~31, required for credit), sort?}` → 201 card, id "card-xxxxxxxx". A check card stores bill / payDay as NULL
- `PATCH /api/toss/cards/:id` takes any subset and returns the card.
- `DELETE /api/toss/cards/:id` → 204 and clears transactions.card_id.
- Adult account (later change): kinds are check | credit (the first version had check | prepaid with balance · last_used_at — 원본 녹화의 연령 전용 상품은 성인용으로 바꿈).
  `migrate()` (toss only) rebuilds an old `cards` table once (it still has `last_used_at`): the example prepaid card `c-youth` becomes the example credit card
  `c-day` (bill = its old balance, payDay 14, pays from `hana` if present), other prepaid cards become check cards, art `hana-young` → `hana-travlog`, `toss-youth` → NULL.

**Points CRUD**
- `GET /api/toss/points` → `[{id, name, balance, icon, sort}]`
- `POST /api/toss/points {name, balance = 0, icon?, sort?}` → 201, id "pt-xxxxxxxx"
- `PATCH /api/toss/points/:id`, `DELETE /api/toss/points/:id` → 204.
- Errors on these routes: 400 VALIDATION with fields, 404 NOT_FOUND.

**Unchanged:** /api/banks, transfer/lookup, POST /api/transfers (no checkDuplicate), GET /api/transfers?from= and /:id, payees CRUD including PATCH {favorite}, POST /api/reset, profiles.

**Seed ids:**
- accounts: main, hana, kakao, nh, money
- cards: c-toss, c-hana, c-kakao, c-day (credit)
- points: pt-toss, pt-hana

**Empty seed:** main and money at 0, opened today; 토스포인트 0; rewardMax null; cashbackCount 0; no cards, transactions or payees.

### server deviations from plan

- **Kakao-bank gate.** The "카카오뱅크 통장은 이미 있어요" check is gated with `!TOSS`, not the plan's `APP === "kakao"`. The plan's version would change the message nh/hana/ibk/kbank return for a kakao-bank add (they would fall through to their own-bank line), which breaks byte-identity. The regression run confirms the old message is kept.
- **Columns are toss-only.** migrate() adds the §2.1 columns only when APP === "toss", not for every app. Other apps' DB files stay untouched; all code that reads the columns is toss-only.
- **Seed helpers stay apart.** toss-seed.mjs has its own BEGIN/COMMIT helper, so db.mjs and toss-seed.mjs don't import each other. The seeds take an optional `now` for tests.
- **Override scope.** The card_spend override applies only to the current month and tab = all. The plan applies `profile.card_spend ?? Σ` unconditionally, which would put the same number on every past month and every tab.
- **Own transfers in 소비 show once** (the sending side), with the subtitle "<from bank> → <to bank>".
- **recent.** It also excludes the `from` account itself, so the hana → main seed transfer doesn't list 통장 as a recipient of itself.
- **Future-time pull-back.** The plan's "now − (k+1) min by rank" is done as a monotone chain: each moved row lands at most 1 minute before the previous one, and the gap shrinks just after midnight. This keeps the order exact.
- **Additive extras beyond the plan's shapes:**
  - spend: `today`, `tab`, and on items `accountId`, `channel`, `time`
  - assets: `accounts.total`, and `number` / `favorite` on accounts
  - cards: `accountId`, `sort`
  - cardBill: `id`, `name`
  - counterparty: `accountId`, `digits`
  - factory: `spend` / `assets` exposed for tests
- **Choices where the plan was silent:**
  - empty seed cashbackCount = 0, so 소비 stays empty
  - main.openedAt = today in the empty seed
  - a toss-bank account added through POST gets openedAt = today
  - when cashback is shown, today's group exists even with no items

### server remaining

Mismatches with the client agent's src/toss/api.ts (I don't own src, so not edited). The orchestrator should align these types to the contract:
1. `TossHomeBlock.reward.dismissed` is typed `string | null`; the server sends a boolean (already-dismissed-this-month). The raw month is on `profile.rewardDismissed`.
2. `TossSpendItem.tone` is commented "expense | income | grey | cancelled"; the server sends "spend | excluded | income | cancelled".
3. `TossSpend.categories` is typed `{name, amount, color?, ratio?}`; the server sends `{key, label, color, amount}`, with no ratio (the client computes it from total).
4. `TossSpend.days` is typed `{date, amount, overspent?}`; the server sends `{date, dow, income, expense}`. overspent is on groups[].

Everything else in that file is compatible; my extra fields are additive.

Not done, because it is outside server ownership: package.json scripts, vite proxy, and any DevPanel/src wiring. Those are the client agent's. README/SOLUTION docs are for the integration step.

The 평소보다 많이 씀 rule (≥ 30,000 and > 2 × average daily spend) flags 1–2 days mid-month but up to 4 near the month end with the example seed. That is per spec; tune it if reviewers object.

Nothing is committed.

## CLIENT — contract

## Gates
- `session.ts`: `TOSS = APP === "toss"`, `APP_NAME.toss = "토스"`, `AppName` includes "toss".
- `platform.ts`: `DEVICE_LOCK = … : APP === "toss" ? "android"`.
- `theme.ts`:
  - `THEME_LOCK = KAKAO2 ? "light" : toss ? "dark" : null`.
  - `THEME_CHOICE = "dark"` for toss; `THEME` is "dark" for toss.
  - OsSwitch shows the theme switch only when `!THEME_LOCK`. DevPanel shows 기기 only when `!KAKAO2 && APP !== "toss"`, and 테마 only when `!THEME_LOCK`.
- `ProfilePicker.enter`: `os` and `theme` use the lock for `KAKAO2 || TOSS`. ibk2 is unchanged.

## Routes (src/toss/routes.tsx `renderTossRoute`, in ROUTES.toss)
Each route maps to a stub file in its area folder:
- `/` → home/TossHome
- `/tab/all` → home/AllMenu
- `/tab/:tab` → home/TabPlaceholder
- `/ad/coupon` → home/AdCoupon
- `/ad/payback` → home/AdPayback
- `/bank/:accountId` → account/BankScreen
- `/bank/:accountId/history` → account/History
- `/tx/:txId` → account/TxDetail
- `/account/:accountId` → account/OtherAccount
- `/send` → transfer/SendWho (S1)
- `/send/number` → transfer/SendNumber (S2)
- `/send/amount` → transfer/SendAmount (S4)
- `/send/confirm` → transfer/SendConfirm (S5)
- `/send/memo` → transfer/SendMemo (S6)
- `/send/done` → transfer/SendDone (S7/S8)
- `/cert` → cert/CertHome (H)
- `/cert/transfer` → cert/CertIntro (I)
- `/cert/transfer/account` → cert/CertAccount (A)
- `/cert/transfer/items` → cert/CertItems (L)
- `/cert/transfer/method` → cert/CertMethod (M)
- `/cert/transfer/issuing` → cert/CertIssuing (W)
- `/cert/transfer/done` → cert/CertDone (D)
- `/cert/doc` → cert/CertDoc (V)
- `/spend` → assets/Spend
- `/assets` → assets/Assets
- `/assets/accounts` → assets/MyAccounts
- `/dev/ui` → UiGallery (extra, foundation-owned)

Other boot wiring: TossSplash is at home/TossSplash.tsx (`{onDone}`), called by the App splash chain. Login and ProfilePicker are wrapped in `<TossInset>`. The overlay is `toss: <TossOverlay/>`, which holds the LoadingLayer and Toast.

## History state keys
- `location.state.tossAnim`: "push" | "load" | "pop" | "fade" | "reveal" | "cut"
- `location.state.tossExit`: "fade"
- `location.state.sendDepth`, `location.state.certDepth`
- `history.state.tossBack`: depth of in-screen back steps

## nav.ts
- `type TossAnim = "push" | "load" | "pop" | "fade" | "reveal"`
- `TOSS_ANIM_MS` = {push 400, load 400, pop 240, fade 90, reveal 450}
- `TOSS_ANIM_END` (animation names ScreenStack listens for to end a transition)
- `TOSS_NAV` = {push 400, pushFrom 150, pushFade 50, oldFade 60, oldDrift −12, bandHold 95, popExit 120, popDrop 40, popSettle 120, popFrom −5, fade 90, tapDelay 120, lock 450, pressOut 170}
- `tossAnimFor(navType, to, from)` — rules:
  - Explicit `state.tossAnim` wins.
  - Cut pairs: /cert/transfer ↔ /cert/transfer/*, and / ↔ /tab/*.
  - Pushing or replacing into /send/confirm or /send/done is a cut. Popping off /send/confirm is a cut.
  - Popping off a page whose state has `tossExit: "fade"` is a fade.
  - Otherwise push for a push and pop for a pop. A replace with no explicit kind is a cut.
- `tossDepth(state, "sendDepth" | "certDepth")`
- `carryDepth(fromState, replace, extra)`: a push adds 1 to every depth present; a replace keeps it.
- `tossHistoryGo(delta)` → Promise
- `tossLock(ms?)` → boolean
- `useTossGo()` → `(to: string | number, {replace?, state?, anim?, delay = 120, lock = 450}) => boolean`. It ignores calls from inactive layers, applies the lock, waits 120 ms after release, and carries the depths.
- `useTossBack(fallback = "/")`
- `useTossExit()` → `(depth, fallback = "/")` (uses `history.go(-depth)`)
- `tossBackLevel()`
- `useTossBackStep(active, onBack, key?)`

## flow.ts
- `useTossFlow()` → `{ goBank(id, {toast?}), goSend({from = "main", toastFromHome?}), certExit() }`
  - `goSend`: LOAD layer, prefetch `paths.recipients(from)` for at least 400 ms, then navigate `/send?from=` with `{tossAnim: "load", sendDepth: 1}` and remove the LOAD layer in the same render.
- `useSendFinish()` → `(kind: "move" | "send")`. It reads `/api/home` `toss.adSnoozeUntil`.
  - Not snoozed, move: replace to `/ad/coupon` with `{tossAnim: "reveal", tossExit: "fade", sendDepth}`.
  - Not snoozed, send: replace to `/ad/payback` with `{tossAnim: "push", sendDepth}`, plus the "토스" toast.
  - Snoozed: `history.go(-sendDepth)`.
- `useAdDismiss()` → `({snooze?})`. With snooze it sends `PATCH /api/profile {adSnoozeUntil: now + 3 days}`, then `history.go(-sendDepth)`.
- `TOSS_FLOW` = {loadMin 400, toastAfterPush 100, adSnoozeDays 3}

## toast.ts
- `showTossToast(word: "토스뱅크" | "토스" = "토스뱅크", {delay?, waitReady?})`
- `tossToastReady()`, `hideTossToast()`, `cutTossToast()`, `useTossToast()`
- `TOSS_TOAST` = {minHold 1450, afterReady 100, maxHold 2600, exit 200}
- `goBank` uses `waitReady`, so BankScreen must call `tossToastReady()` once its content is drawn.

## loading.ts
- `showTossLoad()` → id
- `cutTossLoad(id?)`, `isTossLoadUp()`
- `showTossWaitBox(afterMs = 300)` → hide function
- `hideTossWaitBox()`, `cutTossLoading()`, `useTossLoading()`

## band.ts
- `type TossBandMode = "solid" | "kb" | "dim" | "scrim"`
- `useTossBand(mode | null, enabled = true)` — applies only while the layer is active.
- `pushTossBand(mode)` → off function. Sets `html[data-toss-band]`.
- HanaKeyboard's `[data-hana-kb]` also maps to `kb` for toss.

## api.ts
- Types: `TossHomeBlock`, `TossHomeData` (extends HomeData with `toss?`), `TossAccount`, `TossTransaction`, `TossTxDetail` (`kindLabel`, `counterparty {direction, own, accountName?, bank: Bank, number, holder}`), `TossProfile`, `TossSpend`, `TossSpendGroup`, `TossSpendItem`, `TossAssets`, `TossAssetAccount`, `TossAssetCard`, `TossAssetPoint`, `TossCard`, `TossPoint`, `TossChannel`.
- `tossPaths` = {spend(month?, tab = "all"), assets, cards, card(id), points, point(id)}
- `tossApi` = {updateProfile, updateAccount, updateTransaction, addCard, updateCard, deleteCard, addPoint, updatePoint, deletePoint}
- `tossAdSnoozed(until)`
- Shared src/api/types.ts gained optional fields only: Profile {pointChances, rewardMax, rewardDismissed, adSnoozeUntil}; Account {openedAt, favorite, role}; Transaction {category, channel, cardId, cancelled, exclude, own}; MyAccountRecipient {role, favorite}.

## format.ts
`won`, `signedWon(n, plus = true)`, `num`, `md`, `mwd`, `mmdd`, `dayWeek`, `fullDateTime`, `hm`, `ym`, `tossDate`, `ro`, `roOnly`, `eulReul`, `iGa`, `eunNeun`.

## bank.ts
`TOSS_BANK_TILES`, `TOSS_SEC_TILES` (`{label, code | null}` in the recorded order), `tossBankShort`, `tossBankFull`, `isTossBank`.

## ui (also re-exported from src/toss/ui/index.ts)
- `TossPage` {bg = #171619, band, header, headerOverlay, dock, navMode, className, bodyClassName, style, bodyRef, onScroll}. DOM: `.toss-page` > `.toss-page__band` (28 dp) + `.toss-page__main` (> `.toss-page__head`, `.toss-page__body`, dock). Transitions animate `.toss-page__main`.
- `useTossPageRoot` (sheets and dialogs portal into the page root), `TossPortalRoot`, `TOSS_BG`, `TOSS_BG_DEEP`
- `TossAppBar` {title, center, titleVisible, onBack (false hides ←), backFallback, right, mode: "solid" | "blur" | "scroll", scrollTop, bg, progress}
- `TossPressable` {onPress, disabled, inset, radius, color, scale, fadeIn, fadeOut = 170, className, style, pressedClassName, ariaLabel}
- `TossRow` {icon, title, sub, right, height, padX, gap, …press props}
- `TossButton` {variant: primary | weak | grey | secondary, disabled, loading, bar, onPress}; `TossBottomDock` {fade, bg}; `TossButtonPair`; `TOSS_DOCK_SPACE` = 96
- `TossSheet` {open, onClose, title, top, cardStyle} — uses band `dim` and a back step
- `TossDialog` {open, title, body, actions [{label, onPress, tone}], onClose, dismissible, fullScrim}
- `TossSpinner` {variant: grey | blue}
- `TossProgressBar` {ready, delay}
- `TossSkeleton` {w, h, r, tone: acct | web}; `TossFadeIn` {delay, duration}
- `TossOdometer` {id, value, duration = 460, stagger = 70, prefix, suffix = "원"}
- `TossBankLogo` {code, bank, size, surface: page | card | tile, fill, glyph}; `tossBankFill`
- `TossSymbol` {size, height, grey}
- Icons: BackIcon, Chevron Right/Left/Down/Up, TriLeft/TriRight, Close, Search, Gear{filled}, Card, Share, Star{on}, Camera, Shield, Check, CheckCircle{filled}, Plus, More, KeypadBack, Clear, Bell{dot}, PayBrackets, FaceId, TabIcon{tab, filled}

## CSS tokens (`:root[data-app="toss"]`)
`--toss-sb` 28px, `--toss-nav` 15px (safe-area insets at ≤500 px), `--toss-bg`, `--toss-bg-deep`, `--toss-band-deep`, `--toss-card`, `--toss-card-2`, `--toss-surface`, `--toss-fill`, `--toss-fill-2`, `--toss-grey-btn`, `--toss-home-btn`, `--toss-home-btn-pressed`, `--toss-divider`, `--toss-skeleton`, `--toss-skeleton-web`, `--toss-blue`, `--toss-blue-pressed`, `--toss-blue-text`, `--toss-blue-weak`, `--toss-blue-weak-text`, `--toss-blue-secondary`, `--toss-blue-secondary-text`, `--toss-blue-disabled`, `--toss-blue-disabled-text`, `--toss-red`, `--toss-scrim`, `--toss-t0`…`--toss-t5`, `--toss-font`. Keyframes are prefixed `toss-`. Layer classes are `layer--toss-{push|load|pop|fade|reveal}`.

## DevPanel mounts (all gated `APP === "toss"`)
- `<TossPanelSection run home/>` at the end of AccountsTab
- `<TossAccountFields account run/>` inside AccountEditor
- `<TossTxFields tx run/>` inside TxEditForm (saves on its own)
- `TossRun` type is in src/toss/devpanel/types.ts. All three stubs currently return null.

## Assets (src/assets/local)
- `toss-symbol.png`: 504×468 px, 4 px/dp. Ink sits at dp x 128.8, y 367.7 on the splash.
- `toss-symbol-splash.png`: 530×499 px, 132.5×124.75 dp at x 126.8, y 363.2.
- `toss-app-icon.png`: 464×464 px.

### client deviations from plan

- **Font:** I did not list "Toss Product Sans" in the font stack. Pretendard is the only font, so rendering is deterministic and matches the Pretendard-fitted sizes in the area specs.
- **Extra route:** `/dev/ui` (UiGallery), a gallery of the shared components, linked from the home stub. It is not in the plan's route table. Remove it if unwanted.
- **Extra asset:** `toss-symbol-splash.png` (the symbol plus its drop shadow) in addition to `toss-symbol.png`. The plain symbol drops the shadow so it sits cleanly on the BankLogo and toast fills. The grey header mark is the `TossSymbol grey` component (a CSS mask with a gradient), not a separate file.
- **Push old layer:**
  - The whole old layer (background and band) stays for 95 ms, then hides.
  - Its `.toss-page__main` fades in 60 ms with a −12 dp drift.
  - A layer without a TossPage fades as a whole.
  - The `load` kind is a push whose old content is hidden from frame 0, so the page under the LOAD layer does not flash.
- **Pop revealed layer:** its background and 28 dp band stay visible while the closing page moves; only `.toss-page__main` waits and then settles.
- **Pop out of S8:** popping off `/send/done` is a POP, not a CUT, so the snoozed `history.go(-sendDepth)` exit is a POP as the plan says. Only popping off `/send/confirm` is a cut.
- **useTossGo:** gained a `lock` option. The stub tab bar uses delay 0 and lock 150, so quick tab taps are not dropped.
- **Sheet timing:** the card appears 130 ms after the scrim starts, so it lands as the 230 ms scrim finishes.
- **Toast:** with `waitReady` the toast has a 2.6 s maximum hold, so a page that never calls `tossToastReady()` does not leave it hanging.
- **Status bar:**
  - The recorder indicator is placed 7 dp after the clock's ink right edge (measured gap in the recording), so it moves with clock width. At a 4-character clock (h:mm) it lands at x 60.
  - Default battery stays 62 %, because deviceStatus is shared with other apps.
- **DevPanel for toss:**
  - Free-text number input is used only for toss-bank accounts; other banks use the bank's own number format.
  - The cashback count field is shown for toss.
  - AddBankAccount gained `exclude` and `withName` props; the defaults keep kakao's behaviour and request body identical.
- **Shared types:** shared src/api/types.ts gained optional toss fields (allowed by plan §2.4).
- **Lower specificity:** shared component root rules use `:where()`, so area CSS can override them with a single class.

### client remaining

- **Areas:** each area replaces the stubs in its own folder.
  - Home replaces TossSplash, TossHome, TabBar, TabPlaceholder, AllMenu and the ad pages. Today's stub splash simply hands off to home; the 300 ms cross-fade is the home area's job.
  - Account's BankScreen must call `tossToastReady()`.
  - Assets + panel fills src/toss/devpanel/* (all three stubs currently return null).
- **Not verified against real recording:** the recorder indicator only shows while ● 녹화 runs, and recording can't be started in headless Playwright. Its x position was not checked live.
- **Full regression is for the Verify step:** the 46 kakao2 API requests diffed against a baseline worktree, and push frames at 60/150/300 ms for all 8 other apps. I only boot-checked kakao, kakao2, nh and kbank, and grep-checked the remaining APP chains (intro BLINK_MS, recorder cfg, PhoneFrame StatusBar). None of those is reached for toss.
- **Not run:** `npm run build`, which writes dist/. dist is gitignored, but I built into a scratch outDir instead; tsc + vite build passed.
- **Docs:** README "## 💙 토스 (toss)" and SOLUTION "## 26" are for the integration step.
- **Lint:** 9 only-export-components warnings in src/toss/ui (Page context, Sheet/Dialog/ProgressBar constants, Pressable re-export of useTossGo). They could be split into separate files if wanted.

## VERIFY — contract

The server contract is as the server agent reported it, and the client types in src/toss/api.ts now match it exactly. Server shapes are unchanged.

**src/toss/api.ts**
- `TossHomeBlock` = {spend: {month, total}, pointChances, reward: {month, max: number | null, dismissed: boolean}, cardBill: {id, name, amount, dueDate} | null, adSnoozeUntil: string | null}.
- `TossSpend` = {month, label, today, hasPrev, hasNext, tab: TossSpendTab, total, vsLastMonth: {diff}, categories: TossSpendCategory[], days: TossSpendDay[], cashback: {count} | null, groups: TossSpendGroup[]}.
- `TossSpendCategory` = {key, label, color, amount}. `TossSpendDay` = {date, dow, income, expense}.
- `TossSpendItem` = {id, txId, accountId, channel: TossChannel, time, title, suffix?: "취소", subtitle, amount, tone: TossSpendTone, icon}.
- `TossSpendTone` = "spend" | "excluded" | "income" | "cancelled". groups[] = {date, label, overspent, items}.
- `TossCounterparty` = {direction, own, accountId?, accountName?, bank, number, digits, holder}. `TossTxDetail` adds `own?`.
- `TossAssets` = {total, accounts: {count, total, items: TossAssetAccount[]}, cards: {count, items}, points: {count, items}}.
  - `TossAssetAccount` = {id, bankCode, name, number: string | null, balance, isMain, role, favorite}.
  - `TossAssetCard` = {id, name, bankCode, accountId, art, kind: TossCardKind ("check" | "credit"), bill? · payDay? (credit only), sort, monthAmount}.
  - `TossAssetPoint` = {id, name, balance, icon, sort}.
- `TossCard.bill` / `TossCard.payDay` are optional (credit only).
- `TossCardInput` (POST/PATCH body, bill / accountId / art / payDay nullable).
  - `tossApi.addCard(TossCardInput & {name, bankCode})`
  - `tossApi.updateCard(id, TossCardInput)`
  - `tossApi.addPoint({name, balance?, icon?, sort?})`

**UI module layout**
- New src/toss/ui/shared.ts exports `TossPageContext`, `useTossPageRoot`, `useTossOverlayPhase(open, closeMs)`, `tossBankFill(code, surface?, brand?)`, `TOSS_LOGO_SURFACE`, `type TossLogoSurface`, `TOSS_SHEET`, `TOSS_DIALOG` and `TOSS_PROGRESS`.
- All of these are still re-exported from src/toss/ui/index.ts, which now also re-exports `useTossGo` and `useTossBack` from ../nav.
- Page.tsx exports only `TossPage`, `TossPortalRoot`, `TOSS_BG`, `TOSS_BG_DEEP` and `TossPageProps`. Areas should import the context hook from "../ui" or "../ui/shared".
- Everything else in the client contract (nav.ts, flow.ts, toast.ts, loading.ts, band.ts, CSS tokens, routes, DevPanel mounts) is unchanged.

### verify deviations from plan

- **Regression method.** The screenshot regression used production servers (each tree serving its own dist) on 8913–8920, not vite dev on 5313–5320. Production is what gets deployed, and it covers the kakao2/ibk2/kbank2 intro-flag injection natively. The web ports 5313–5320 were unused.
- **More than asked.** The API battery covered all 8 server ids, not just the 6 the server agent ran.
- **`npm run dev:toss` not run literally.** It hard-codes ports 5181/8795, which were not assigned to me. I ran the identical commands (`node server/index.mjs --app toss` + `vite --mode toss` with API_TARGET) on 8911/5311.
- **Lint fix touched an area stub.** Fixing the lint warnings meant editing src/toss/home/TossHome.tsx's import line. That file is a home-area stub that the home area will replace anyway.

### verify remaining

- **Not verified live: recorder indicator.** It shows only while ● 녹화 runs, and recording cannot start in headless Playwright. I checked the code path only (`useRecorder().status === "recording"`, positioned after the clock).
- **Left to the areas, as planned:**
  - Splash → home 300 ms cross-fade and the real splash: home area. The stub hands off directly.
  - BankScreen must call `tossToastReady()`. Until it does, the toast holds for its 2.6 s maximum.
  - The src/toss/devpanel/* stubs still return null: assets area.
  - Visual acceptance of the shared components (toast, odometer, sheet, buttons) against the video frames is done per area under §7.2–7.6.
- **Integration step:** README "## 💙 토스 (toss)" and SOLUTION "## 26".
- **Optional cleanup:**
  - The server agent's smoke-write.mjs line "from=hana: recent excludes hana" asserts the wrong thing (the seed's hana → main transfer means main legitimately appears).
  - `/dev/ui` (UiGallery) is an extra foundation route; keep it or remove it.
  - toss-symbol-splash.png has faint low-alpha specks; they are invisible on #171619, so this is cosmetic only.
- **Nothing committed.** Committing is left to the orchestrator.
