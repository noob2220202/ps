// ===== 토스 (toss) 초기 데이터 — 이름 · 계좌번호 · 잔액 · 금액 · 가게 전부 지어낸 값 =====
// 녹화 속 값(이름, 상대방, 계좌번호, 잔액, 금액, 가게)은 하나도 쓰지 않음.
// 날짜는 '지금' 기준 상대값 — 어느 날 켜도 이번 달 '{M}월에 쓴 돈' · 소비 · 지난달 비교 · 거래내역이 비지 않음.
//   c(n, "HH:MM") = 오늘 − n일 (이번 달 1일보다 앞이면 1일로)
//   p(day, …)     = 지난달 그 날,  q(day, …) = 두 달 전 그 날 (그 달에 없는 날이면 마지막 날)
// 지금보다 늦은 시각(예: 08:00 에 켰는데 c(0, "09:12"))은 지금 바로 앞으로 당김 — 순서는 그대로, 1분 간격
// (케이뱅크에서 '미래' 예시 거래 사이에 지금 한 이체가 끼어 잔액이 어긋났던 문제를 피함)
// 잔액은 아래 표의 값 그대로 저장. 거래 후 잔액은 서버가 지금 잔액에서 거꾸로 계산 (server/index.mjs listTransactions)

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (t) =>
  `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
const digits = (s) => String(s ?? "").replace(/\D/g, "");

// db.mjs 의 transaction() 과 같은 일 (db.mjs ↔ 이 파일이 서로 import 하지 않게 따로 둠)
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

const wipe = (d) =>
  d.exec(
    "DELETE FROM transfers; DELETE FROM payees; DELETE FROM transactions; DELETE FROM cards; DELETE FROM points; DELETE FROM accounts; DELETE FROM profile; DELETE FROM sqlite_sequence;",
  );

function relativeClock(now) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const daysIn = (mm) => new Date(y, mm + 1, 0).getDate(); // mm 이 음수면 작년 (Date 가 알아서 넘김)
  const at = (mm, day, hhmm) => {
    const [h, mi] = hhmm.split(":").map(Number);
    return new Date(y, mm, Math.min(day, daysIn(mm)), h, mi, 0);
  };
  return {
    c: (n, hhmm) => at(m, Math.max(1, today - n), hhmm),
    p: (day, hhmm) => at(m - 1, day, hhmm),
    q: (day, hhmm) => at(m - 2, day, hhmm),
  };
}

// 오늘 일 중 지금보다 늦은 것 → 지금 바로 앞으로 (늦은 것부터 지금 −1분, −2분 …). 바로 앞 것보다 이르면 그 뒤로는 그대로
function noFuture(events, now) {
  const end = now.getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todays = events.filter((e) => e.when.getTime() >= startOfToday).sort((a, b) => b.when - a.when);
  if (!todays.some((e) => e.when.getTime() > end)) return;
  const gap = Math.max(1000, Math.min(60_000, Math.floor((end - startOfToday) / (todays.length + 1))));
  let prev = end;
  for (const e of todays) {
    if (e.when.getTime() < prev) break;
    prev -= gap;
    e.when = new Date(prev);
  }
}

// ---------- 예시 데이터 표 ----------
// [id, kind, bank, name, number, balance, opened_at, role] — sort 는 이 순서 (내 계좌 순서: 통장, 하나, 카카오, 농협, 토스머니)
const ACCOUNTS = [
  ["main", "main", "toss", "토스뱅크 통장", "1000-1234-5678", 1_250_000, "2024-03-15", null],
  ["hana", "external", "hana", "영하나플러스 통장", "123-456789-01234", 84_500, "2023-08-02", null],
  ["kakao", "external", "kakao", "입출금통장", "3333-01-2345678", 15_300, null, null],
  ["nh", "external", "nh", "자립예탁금", "301-0123-4567-01", 52_000, null, null],
  ["money", "external", "toss", "토스머니", "1000-9999-0001", 3_200, null, "money"], // 번호는 안에서만 씀 (화면에 안 나옴)
];

// [id, name, bank, linked account, art, kind, balance, last used]
const CARDS = (q) => [
  ["c-toss", "토스뱅크 체크카드", "toss", "main", "toss-check", "check", null, null],
  ["c-hana", "Young Hana+ 체크카드", "hana", "hana", "hana-young", "check", null, null],
  ["c-kakao", "프렌즈 체크카드", "kakao", "kakao", "kakao-friends", "check", null, null],
  ["c-youth", "토스유스카드", "toss", null, "toss-youth", "prepaid", 15_000, q(10, "14:00")],
];

const POINTS = [
  ["pt-toss", "토스포인트", 1_280, "toss-point"],
  ["pt-hana", "하나머니", 350, "hana-money"],
];

// 받는 분 (☆ 는 모두 꺼짐 — 녹화의 ★ 도 전부 꺼져 있음)
const PAYEES = {
  김철수: ["kb", "123456-01-234567"],
  이영희: ["kakao", "3333-02-3456789"],
  박민수: ["woori", "1002-345-678901"],
  최지우: ["hana", "456-789012-34567"],
  정하늘: ["ibk", "010-123456-01-012"],
  오세라: ["nh", "302-1234-5678-11"],
  "(주)예시상사": ["shinhan", "110-123-456789"],
  윤다온: ["toss", "1000-2345-6789"],
  강예린: ["woori", "1002-456-789012"],
  서지호: ["kb", "654321-02-765432"],
};

function exampleEvents({ c, p, q }) {
  const send = (when, to, amount) => ({ type: "send", when, to, amount }); // 통장(main)에서 보냄. to = 받는 분 이름 또는 "own:<계좌 id>"
  const income = (when, account, from, amount) => ({ type: "income", when, account, from, amount }); // 다른 사람이 보낸 돈
  // 카드 · 페이 · 이자 · 캐시백 · 카드값 [계좌, 시각, 가게, 금액, tag, channel, category, card, 플래그]
  const tx = (account, when, merchant, amount, tag, channel, category, card = null, flags = {}) => ({
    type: "tx",
    account,
    when,
    merchant,
    amount,
    tag,
    channel,
    category,
    card,
    cancelled: flags.cancelled ? 1 : 0,
    exclude: flags.exclude ? 1 : 0,
  });
  const CARD = "#체크카드";
  return [
    // 통장에서 보낸 이체 (내 계좌로 보낸 것은 받은 계좌에 입금도)
    send(c(0, "09:12"), "최지우", 15_000),
    send(c(1, "18:40"), "own:hana", 50_000),
    send(c(2, "12:05"), "김철수", 32_000),
    send(c(3, "20:31"), "이영희", 8_500),
    send(c(5, "13:10"), "own:kakao", 20_000),
    send(c(6, "19:22"), "박민수", 120_000),
    send(p(25, "11:00"), "정하늘", 45_000),
    send(p(18, "08:30"), "오세라", 12_000),
    send(p(9, "21:15"), "own:money", 10_000),
    send(p(4, "10:45"), "(주)예시상사", 77_000),
    send(q(20, "16:20"), "윤다온", 5_000),
    send(q(11, "09:05"), "강예린", 9_900),
    // 내 하나 → 통장 (상세 '입금처 / 출금처' 둘 다 내 계좌)
    { type: "own", when: c(8, "17:30"), from: "hana", to: "main", amount: 100_000 },
    // 다른 사람이 보낸 돈 (+ 보낸 분 기록)
    income(c(4, "10:20"), "main", "이영희", 30_000),
    income(p(15, "09:00"), "main", "(주)예시상사", 150_000),
    income(c(2, "15:40"), "hana", "김철수", 20_000),
    income(q(9, "14:00"), "nh", "오세라", 20_000),
    // 카드 · 페이 · 이자 · 캐시백 · 카드값
    tx("main", c(0, "08:05"), "한빛편의점", -4_800, CARD, "card", "편의점·마트", "c-toss"),
    tx("main", c(1, "12:30"), "소나무분식", -9_000, CARD, "card", "식비", "c-toss"),
    tx("main", c(2, "15:10"), "하늘카페", -5_500, CARD, "card", "카페·간식", "c-toss"),
    tx("main", c(3, "16:45"), "새싹문구", -12_000, CARD, "card", "교육", "c-toss"),
    tx("main", c(3, "21:02"), "카드 캐시백", 50, CARD, "card", "캐시백", "c-toss"),
    tx("main", c(5, "19:40"), "샘플쇼핑_PG", -32_900, CARD, "pay", "쇼핑", "c-toss"),
    tx("main", c(6, "13:15"), "예시마트", -68_000, CARD, "card", "편의점·마트", "c-toss"), // 이체 6 과 같은 날 → '평소보다 많이 씀'
    tx("main", c(6, "18:05"), "별빛서점", -23_000, CARD, "card", "문화·여가", "c-toss"),
    tx("main", c(7, "23:40"), "구름택시", -14_300, CARD, "card", "교통", "c-toss"),
    tx("main", p(1, "00:10"), "통장 이자", 412, "#예금이자", "account", "이자"),
    tx("main", p(3, "12:00"), "소나무분식", -8_000, CARD, "card", "식비", "c-toss"),
    tx("main", p(7, "08:40"), "한빛편의점", -3_200, CARD, "card", "편의점·마트", "c-toss"),
    tx("main", p(12, "19:30"), "하늘카페", -6_100, CARD, "card", "카페·간식", "c-toss"),
    tx("main", p(20, "14:20"), "예시마트", -41_000, CARD, "card", "편의점·마트", "c-toss"),
    tx("main", p(27, "21:00"), "카드 캐시백", 30, CARD, "card", "캐시백", "c-toss"),
    tx("main", q(1, "00:10"), "통장 이자", 388, "#예금이자", "account", "이자"),
    tx("main", q(6, "13:00"), "별빛서점", -15_000, CARD, "card", "문화·여가", "c-toss"),
    tx("main", q(14, "18:45"), "소나무분식", -9_500, CARD, "card", "식비", "c-toss"),
    tx("main", q(23, "11:30"), "구름택시", -11_800, CARD, "card", "교통", "c-toss"),
    tx("hana", c(1, "08:20"), "한빛편의점", -2_300, CARD, "card", "편의점·마트", "c-hana"),
    tx("hana", c(3, "17:10"), "샘플쇼핑_PG", -19_800, CARD, "card", "쇼핑", "c-hana", { cancelled: true }),
    tx("hana", c(4, "16:00"), "바른학원", -150_000, CARD, "card", "교육", "c-hana"),
    tx("hana", c(5, "07:00"), "하나카드", -54_000, "#자동이체", "account", null, null, { exclude: true }), // 카드값
    tx("hana", c(5, "12:40"), "하늘카페", -4_800, CARD, "card", "카페·간식", "c-hana"),
    tx("hana", p(5, "07:00"), "하나카드", -61_000, "#자동이체", "account", null, null, { exclude: true }),
    tx("hana", p(9, "13:30"), "소나무분식", -7_500, CARD, "card", "식비", "c-hana"),
    tx("hana", p(16, "20:10"), "예시마트", -22_000, CARD, "card", "편의점·마트", "c-hana"),
    tx("kakao", c(2, "22:15"), "앱마켓_PG", -1_100, CARD, "pay", "카테고리 없음", "c-kakao"),
    tx("kakao", c(4, "12:10"), "소나무분식", -7_000, CARD, "card", "식비", "c-kakao"),
    tx("kakao", p(11, "19:00"), "별빛서점", -9_000, CARD, "card", "문화·여가", "c-kakao"),
    tx("kakao", p(22, "15:30"), "한빛편의점", -2_700, CARD, "card", "편의점·마트", "c-kakao"),
    tx("nh", p(2, "10:00"), "자립예탁금 이자", 95, "#예금이자", "account", "이자"),
    tx("money", c(3, "11:11"), "토스페이 결제", -2_400, CARD, "pay", "쇼핑"),
  ];
}

function insertBase(d, userName, { accounts, rewardMax, cashbackCount }) {
  d.prepare(
    `INSERT INTO profile (id, user_name, card_last4, card_spend, cashback_count, point_chances, reward_max, reward_dismissed, ad_snooze_until)
     VALUES (1, ?, '1234', NULL, ?, 3, ?, NULL, NULL)`,
  ).run(userName, cashbackCount, rewardMax);
  const acc = d.prepare(
    "INSERT INTO accounts (id, kind, bank_code, number, balance, name, sort, opened_at, role, favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
  );
  accounts.forEach(([id, kind, bank, name, number, balance, openedAt, role], i) => acc.run(id, kind, bank, number, balance, name, i + 1, openedAt, role));
}

// 예시 데이터: 홍길동 · 계좌 5개(토스머니 포함) · 카드 4장 · 포인트 2개 · 받는 분 10명 · 거래 약 60건 (3달)
export function seedTossExample(d, userName = "홍길동", now = new Date()) {
  const clock = relativeClock(now);
  const events = exampleEvents(clock);
  noFuture(events, now);
  events.sort((a, b) => a.when - b.when); // 이른 것부터 넣어 id 도 시간 순
  inTransaction(d, () => {
    wipe(d);
    insertBase(d, userName, { accounts: ACCOUNTS, rewardMax: 50_000, cashbackCount: 2 });
    const card = d.prepare(
      "INSERT INTO cards (id, name, bank_code, account_id, art, kind, balance, last_used_at, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    CARDS(clock.q).forEach(([id, name, bank, account, art, kind, balance, lastUsed], i) =>
      card.run(id, name, bank, account, art, kind, balance, lastUsed && isoOf(lastUsed), i + 1),
    );
    const point = d.prepare("INSERT INTO points (id, name, balance, icon, sort) VALUES (?, ?, ?, ?, ?)");
    POINTS.forEach(([id, name, balance, icon], i) => point.run(id, name, balance, icon, i + 1));
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, 0)");
    for (const [holder, [bank, number]] of Object.entries(PAYEES)) payee.run(bank, digits(number), holder);

    const account = Object.fromEntries(ACCOUNTS.map(([id, , bank, , number]) => [id, { bank, digits: digits(number) }]));
    const insTx = d.prepare(
      "INSERT INTO transactions (account_id, at, merchant, amount, tag, channel, category, card_id, cancelled, exclude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const transferTx = (accountId, at, merchant, amount) => insTx.run(accountId, at, merchant, amount, "#이체", null, null, null, 0, 0).lastInsertRowid;
    const insTr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id, in_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    // 내 계좌끼리 옮김: 보낸 쪽 출금 + 받은 쪽 입금 + 이체 기록 (POST /api/transfers 와 같은 모양 — 적요는 둘 다 내 이름)
    const move = (at, from, to, amount) => {
      const out = transferTx(from, at, userName, -amount);
      const inTx = transferTx(to, at, userName, amount);
      insTr.run(from, account[to].bank, account[to].digits, userName, amount, at, out, inTx);
    };
    for (const e of events) {
      const at = isoOf(e.when);
      if (e.type === "send" && e.to.startsWith("own:")) move(at, "main", e.to.slice(4), e.amount);
      else if (e.type === "send") {
        const [bank, number] = PAYEES[e.to];
        insTr.run("main", bank, digits(number), e.to, e.amount, at, transferTx("main", at, e.to, -e.amount), null);
      } else if (e.type === "own") move(at, e.from, e.to, e.amount);
      else if (e.type === "income") {
        // 보낸 분 기록: 입금 거래에 transfers 행을 붙임 (out_tx_id = 입금 거래 — SENT() 가 '보낸 이체'에서 뺌, 케이뱅크 예시와 같은 자리)
        const [bank, number] = PAYEES[e.from];
        insTr.run(e.account, bank, digits(number), e.from, e.amount, at, transferTx(e.account, at, e.from, e.amount), null);
      } else insTx.run(e.account, at, e.merchant, e.amount, e.tag, e.channel, e.category, e.card, e.cancelled, e.exclude);
    }
  });
}

// 빈 상태: 토스뱅크 통장 0원 + 토스머니 0원 + 토스포인트 0. 카드 · 거래 · 받는 분 없음, 배너 숨김 (새 프로필은 이걸로 시작)
export function seedTossEmpty(d, userName, now = new Date()) {
  inTransaction(d, () => {
    wipe(d);
    const [main, money] = [ACCOUNTS[0], ACCOUNTS[4]];
    insertBase(d, userName, {
      accounts: [
        [...main.slice(0, 5), 0, isoOf(now).slice(0, 10), null],
        [...money.slice(0, 5), 0, null, "money"],
      ],
      rewardMax: null,
      cashbackCount: 0, // 소비 '캐시백 가능한 내역' 줄도 안 보이게 (빈 목록)
    });
    const [id, name, , icon] = POINTS[0];
    d.prepare("INSERT INTO points (id, name, balance, icon, sort) VALUES (?, ?, 0, ?, 1)").run(id, name, icon);
  });
}
