// ===== NH올원뱅크 (allone) 초기 데이터 — 이름 · 계좌번호 · 잔액 · 금액 · 가게 전부 지어낸 값 =====
// 녹화 속 값(이름, 상대방, 계좌번호, 잔액, 금액, 가게)은 하나도 쓰지 않음. 상품 이름(NH페이모아통장 …)만 화면 글자 그대로.
// 날짜는 '지금' 기준 상대값: ago(n, "HH:MM:SS") = 오늘 − n일 그 시각 (n ≥ 1 → 미래 거래가 없음).
// 거래내역 기본 조회(1개월)가 어느 날 켜도 비지 않음. 시각은 늘 초까지 (거래내역 목록이 HH:mm:ss 로 보임).
// 잔액은 아래 표의 '지금 잔액' 그대로 저장 — 거래 후 잔액은 서버가 거꾸로 계산 (server/index.mjs listTransactions).
// 시작 잔액 120,000 / 0 / 520,000 / 70,000 에서 거래를 차례로 더하면 한 번도 음수가 되지 않고 4,638 / 7 / 245,000 / 58,300 이 됨.
// NH농협은행 계좌는 bank_code 'nh' (앱 이름 allone 은 은행 코드가 아님 — 'nh' 는 콕뱅크 앱 이름이기도 하지만 여기선 은행 코드).
// db.mjs 를 import 하지 않음 (db.mjs 가 이 파일을 import — 서로 부르지 않게, toss-seed.mjs 와 같은 방식)

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (t) =>
  `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
const digits = (s) => String(s ?? "").replace(/\D/g, "");

// db.mjs 의 transaction() 과 같은 일
function inTransaction(d, fn) {
  d.exec("BEGIN");
  try {
    fn();
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

// 두 예시 모두 '최근 이체 삭제하기'로 숨긴 줄(recent_hidden)도 비움
const wipe = (d) =>
  d.exec(
    "DELETE FROM transfers; DELETE FROM payees; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM profile; DELETE FROM recent_hidden; DELETE FROM sqlite_sequence;",
  );

// 오늘 − n일, 그 시각 (서버 시계 기준, nowIso 와 같은 지역 시각)
const agoFrom = (now) => (n, hms) => {
  const [h, mi, s] = hms.split(":").map(Number);
  return isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, h, mi, s));
};

// ---------- 예시 데이터 표 ----------
// [id, kind, bank, name, number, balance, limited, sort] — NH 카드 묶음 = bank 'nh' (main, kpay), 다른금융 = 나머지
const MAIN_NAME = "NH페이모아통장(비대면실명확인)";
const MAIN_NUMBER = "302-1234-5678-91";
const ACCOUNTS = [
  ["main", "main", "nh", MAIN_NAME, MAIN_NUMBER, 4_638, 1, 0],
  ["kpay", "external", "nh", "NH X 카카오페이통장(비대면실명확인)", "302-8765-4321-01", 7, 1, 1],
  ["kb", "external", "kb", "KB나라사랑우대통장", "123456-78-901234", 245_000, 0, 2],
  ["kbank", "external", "kbank", "MY 입출금통장", "100-123-456789", 58_300, 0, 3],
];

// [holder, bank, number, favorite] — 최근(새것부터) = 김민지 · 최유나 · 박하늘 · 윤하람, 자주 = ☆ 김민지 · 최유나
const PAYEES = [
  ["김민지", "kakao", "3333012345678", 1],
  ["최유나", "hana", "39191012345607", 1],
  ["박하늘", "jb", "1021012345678", 0],
  ["윤하람", "shinhan", "110345678901", 0],
  ["이서준", "woori", "1002456789012", 0],
  ["정다은", "kb", "65432102765432", 0],
];

// [account, ago, time, merchant, amount, tag, extra]
//   extra = { to: "<받는 분>" }   → 그 받는 분에게 보낸 이체 (transfers 행, 출금 거래와 연결)
//           { own: "<계좌 id>" }  → 내 계좌끼리 잔액채우기: 이 줄은 받는 쪽(입금), own 계좌에 같은 시각 출금 거래 + transfers 행 (in/out 둘 다 연결)
//           { memo: "…" }         → 거래 메모 (거래내역 상세 '메모 입력')
// 잔액채우기의 출금 쪽(kb · kbank 의 −금액 줄)은 own 줄이 만듦 — 표에는 아래 주석으로만 둠
const TX = [
  ["main", 84, "10:02:31", "잔액채우기", 300_000, "#이체", { own: "kb" }],
  ["main", 81, "12:41:07", "한빛편의점", -4_800, "#체크카드"],
  ["main", 77, "19:20:45", "김민지", -50_000, "#이체", { to: "김민지" }],
  ["main", 73, "08:10:00", "NH농협카드", -63_200, "#자동이체"],
  ["main", 70, "13:33:12", "이서준", 25_000, "#이체"],
  ["main", 66, "21:05:51", "하늘카페", -5_500, "#체크카드"],
  ["main", 62, "18:44:03", "박하늘", -40_000, "#이체", { to: "박하늘" }],
  ["main", 58, "11:12:40", "소나무분식", -9_000, "#체크카드"],
  ["main", 55, "03:00:00", "결산이자", 38, "#예금이자"],
  ["main", 49, "12:20:18", "예시마트", -32_400, "#체크카드"],
  ["main", 45, "19:02:33", "최유나", -30_000, "#이체", { to: "최유나" }],
  ["main", 43, "08:10:00", "NH농협카드", -71_500, "#자동이체"],
  ["main", 40, "15:47:09", "정다은", 15_000, "#이체"],
  ["main", 36, "20:11:56", "별빛서점", -16_000, "#체크카드"],
  ["main", 33, "09:40:27", "김민지", -20_000, "#이체", { to: "김민지" }],
  ["main", 29, "13:05:44", "구름택시", -12_300, "#체크카드"],
  ["main", 23, "12:00:41", "잔액채우기", 20_000, "#이체", { own: "kbank" }],
  ["main", 21, "08:10:00", "NH농협카드", -68_900, "#자동이체"],
  ["main", 18, "19:55:21", "이서준", 30_000, "#이체"],
  ["main", 15, "12:31:09", "소나무분식", -8_000, "#체크카드"],
  ["main", 12, "20:14:37", "박하늘", -35_000, "#이체", { to: "박하늘", memo: "모임 회비" }],
  ["main", 9, "17:22:48", "최유나", -12_000, "#이체", { to: "최유나" }],
  ["main", 6, "13:10:05", "한빛편의점", -3_200, "#체크카드"],
  ["main", 4, "21:40:16", "윤하람", 5_000, "#이체"],
  ["main", 2, "18:02:55", "하늘카페", -6_100, "#체크카드"],
  ["main", 1, "10:41:30", "김민지", -22_500, "#이체", { to: "김민지" }],
  ["kpay", 70, "09:12:10", "정다은", 50_000, "#이체"],
  ["kpay", 69, "09:30:02", "카카오페이", -50_000, "#자동이체"],
  ["kpay", 40, "14:02:33", "이서준", 30_007, "#이체"],
  ["kpay", 39, "08:00:00", "카카오페이", -30_000, "#자동이체"],
  ["kpay", 27, "16:48:20", "최유나", 150_000, "#이체"],
  ["kpay", 26, "11:05:09", "김민지", -120_000, "#이체", { to: "김민지" }],
  ["kpay", 24, "19:31:47", "윤하람", -30_000, "#이체", { to: "윤하람" }],
  // kb    ago(84, 10:02:31) 잔액채우기 −300,000 (위 main own 줄의 출금 쪽)
  ["kb", 60, "09:00:00", "(주)예시상사", 250_000, "#이체"],
  ["kb", 35, "18:20:12", "예시전자", -180_000, "#체크카드"],
  ["kb", 10, "12:44:51", "소나무마트", -45_000, "#체크카드"],
  ["kbank", 50, "22:10:30", "구름택시", -9_700, "#체크카드"],
  // kbank ago(23, 12:00:41) 잔액채우기 −20,000 (위 main own 줄의 출금 쪽)
  ["kbank", 8, "10:15:00", "이서준", 18_000, "#이체"],
];

const TOPUP = "잔액채우기"; // 잔액채우기 이체의 받는 분 표기 · 나에게 표기 (POST /api/transfers memoTo = memoMe 와 같음)

function base(d, userName, accounts) {
  wipe(d);
  // 정기점검 안내: 보이기(notice_on 1), 문구는 화면 기본값(notice_items NULL)
  d.prepare("INSERT INTO profile (id, user_name, card_last4, notice_on, notice_items) VALUES (1, ?, '0000', 1, NULL)").run(userName);
  const acc = d.prepare("INSERT INTO accounts (id, kind, bank_code, name, number, balance, limited, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const row of accounts) acc.run(...row);
}

// 예시: 홍길동 + NH 계좌 2개(페이모아 · 카카오페이) + 다른금융 2개(KB · 케이뱅크) + 받는 분 6명 + 거래 40건
export function seedAlloneExample(d, userName = "홍길동", now = new Date()) {
  const ago = agoFrom(now);
  inTransaction(d, () => {
    base(d, userName, ACCOUNTS);
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag, memo) VALUES (?, ?, ?, ?, ?, ?)");
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, memo_to, memo_me, at, out_tx_id, in_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const payees = new Map(PAYEES.map(([holder, bank, number]) => [holder, { bank, number }]));
    const byId = new Map(ACCOUNTS.map(([id, , bank, , number]) => [id, { bank, number }]));

    const pay = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, ?)");
    for (const [holder, bank, number, favorite] of PAYEES) pay.run(bank, number, holder, favorite);

    for (const [account, n, time, merchant, amount, tag, extra = {}] of TX) {
      const at = ago(n, time);
      if (extra.own) {
        // 내 계좌끼리: own 계좌 출금 → account 입금 (POST /api/transfers 가 만드는 모양 그대로)
        const out = tx.run(extra.own, at, TOPUP, -amount, "#이체", null).lastInsertRowid;
        const inTx = tx.run(account, at, merchant, amount, tag, extra.memo ?? null).lastInsertRowid;
        const to = byId.get(account);
        tr.run(extra.own, to.bank, digits(to.number), userName, amount, TOPUP, TOPUP, at, out, inTx);
        continue;
      }
      const id = tx.run(account, at, merchant, amount, tag, extra.memo ?? null).lastInsertRowid;
      if (extra.to) {
        const p = payees.get(extra.to);
        tr.run(account, p.bank, p.number, extra.to, -amount, null, null, at, id, null);
      }
    }
  });
}

// 빈 상태: NH페이모아통장 0원 하나만 (한도제한 표시), 받는 분 · 거래 없음, 정기점검 안내 켜짐 — 새 프로필은 이걸로 시작
export function seedAlloneEmpty(d, userName) {
  inTransaction(d, () => base(d, userName, [["main", "main", "nh", MAIN_NAME, MAIN_NUMBER, 0, 1, 0]]));
}
