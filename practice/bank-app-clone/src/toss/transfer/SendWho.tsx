// S1 어디로 보낼까요? /send?from=<보내는 계좌> (transfer.md §2.1, 녹화 B 8.500 접힘 · A 118.056 펼침 · B 88.750 스크롤)
//  위 28–212.1 (머리줄 + 제목 + 탭) 고정, 아래가 스크롤. 계좌번호 입력 상자 → S2, 내 계좌(+N개) 펼치기, 최근 보낸 계좌 (내 계좌도 섞임 "내 …")
//  줄 누름: 내용 0.96 + 둥근 바탕, 손 떼면 → 금액(S4). ★ = 즐겨찾기 (내 계좌는 accounts.favorite, 받는 분은 payees.favorite)
//  ★ 가 하나라도 켜지면 '즐겨찾기' 구역이 최근 보낸 계좌 위에 생김 (녹화엔 없음, 발명)
import { useState, type ReactNode } from "react";
import { api, paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Bank, MyAccountRecipient, Recipient, TransferRecipients } from "../../api/types";
import { tossApi } from "../api";
import { useTossGo } from "../nav";
import { TossAppBar, TossPage, TossPressable } from "../ui";
import { SendLogo } from "./common";
import { bankShort, digitsOf, formatted } from "./store";
import { useKeyed } from "./keyed";
import { useSendParams } from "./target";
import "./send.css";

type RowItem = {
  key: string;
  bank: Bank;
  title: string;
  sub: string;
  favorite: boolean;
  to: string; // 금액 화면 주소의 받는 분 부분
  star: { accountId?: string; payeeId?: string; recipient?: Recipient };
};

const TABS = ["계좌", "연락처", "해외"];
const TAB_X = [
  [32.0, 72.8],
  [91.6, 143.9],
  [164.2, 202.7],
];

// 내 계좌 줄: 토스머니는 "토스머니", NH 는 숫자만 (녹화 그대로), 나머지는 은행 형식
function mineRow(m: MyAccountRecipient): RowItem {
  const digits = digitsOf(m.number);
  const sub = m.role === "money" ? "토스머니" : `${bankShort(m.bank)} ${m.bank.code === "nh" ? digits : m.number ?? digits}`;
  return { key: `a:${m.accountId}`, bank: m.bank, title: m.label, sub, favorite: !!m.favorite, to: `to=${encodeURIComponent(m.accountId)}`, star: { accountId: m.accountId } };
}
function recentRow(r: Recipient, mine: MyAccountRecipient[]): RowItem {
  const own = r.accountId ? mine.find((m) => m.accountId === r.accountId) : undefined;
  return {
    key: r.accountId ? `a:${r.accountId}` : r.payeeId ? `p:${r.payeeId}` : `n:${r.bank.code}:${r.number}`,
    bank: r.bank,
    title: r.accountId ? `내 ${own?.label ?? r.holder}` : r.holder,
    sub: `${bankShort(r.bank)} ${formatted(r.bank, r.number)}`,
    favorite: !!r.favorite,
    to: r.accountId ? `to=${encodeURIComponent(r.accountId)}` : `bank=${r.bank.code}&number=${r.number}`,
    star: { accountId: r.accountId, payeeId: r.payeeId, recipient: r },
  };
}

export function SendWho() {
  const { from } = useSendParams();
  const go = useTossGo();
  const rec = useApi<TransferRecipients>(paths.recipients(from));
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useKeyed("who-open", false);
  // ★ 누른 뒤 서버 값이 새로 올 때까지 화면이 먼저 바꿈 (그때의 응답 객체와 같을 때만)
  const [fav, setFav] = useState<Record<string, { on: boolean; data: unknown }>>({});
  const data = rec.data;
  // 최근에 연결한 계좌부터 (녹화처럼 내 계좌 순서의 거꾸로 — 예시: 토스머니 · 자립예탁금 · 입출금통장 · 주거래하나 통장)
  const mine = data ? [...data.mine].reverse().map(mineRow) : [];
  const recent = data ? data.recent.map((r) => recentRow(r, data.mine)) : [];
  const isFav = (r: RowItem) => (fav[r.key] && fav[r.key].data === data ? fav[r.key].on : r.favorite);
  // 즐겨찾기: 내 계좌 · 최근 · ☆ 받는 분 (최근에 없어도)
  const favRows: RowItem[] = [];
  const seen = new Set<string>();
  for (const r of [...mine, ...recent, ...(data?.favorites ?? []).map((p) => recentRow({ ...p, payeeId: p.payeeId }, data?.mine ?? []))])
    if (isFav(r) && !seen.has(r.key)) {
      seen.add(r.key);
      favRows.push(r);
    }
  const recentLeft = recent.filter((r) => !isFav(r));

  const toggleStar = (r: RowItem) => {
    const on = !isFav(r);
    setFav((f) => ({ ...f, [r.key]: { on, data } }));
    const { accountId, payeeId, recipient } = r.star;
    const req = accountId
      ? tossApi.updateAccount(accountId, { favorite: on })
      : payeeId
        ? api.updatePayee(payeeId, { favorite: on })
        : recipient
          ? api.addPayee({ bankCode: recipient.bank.code, number: recipient.number, holder: recipient.holder }).then((p) => api.updatePayee(p.id, { favorite: on }))
          : Promise.resolve();
    req.catch(() => setFav((f) => ({ ...f, [r.key]: { on: !on, data } })));
  };
  const pick = (r: RowItem) => go(`/send/amount?from=${encodeURIComponent(from)}&${r.to}`);
  const row = (r: RowItem) => (
    <TossPressable key={r.key} className="toss-send-who__row" scale={0.96} radius={12} inset="0 8px" color="#211f27" fadeIn={120} onPress={() => pick(r)}>
      <SendLogo bank={r.bank} />
      <span className="toss-send-who__text">
        <span className="toss-send-who__title">{r.title}</span>
        <span className="toss-send-who__sub">{r.sub}</span>
      </span>
      <TossPressable className={`toss-send-star${isFav(r) ? " on" : ""}`} radius={14} onPress={() => toggleStar(r)} ariaLabel="즐겨찾기">
        <StarGlyph />
      </TossPressable>
    </TossPressable>
  );

  const header = (
    <div className="toss-send-who__head">
      <TossAppBar />
      <h1 className="toss-send-who__h1">어디로 보낼까요?</h1>
      <div className="toss-send-who__tabs" role="tablist">
        {TABS.map((t, i) => (
          <TossPressable key={t} className={`toss-send-who__tab${tab === i ? " on" : ""}`} onPress={() => setTab(i)} role="tab" style={{ left: TAB_X[i][0] - 6, width: TAB_X[i][1] - TAB_X[i][0] + 12 }}>
            {t}
          </TossPressable>
        ))}
        <i className="toss-send-who__bar" style={{ left: TAB_X[tab][0], width: TAB_X[tab][1] - TAB_X[tab][0] }} />
      </div>
    </div>
  );

  return (
    <TossPage header={header} className="toss-send-who" bodyClassName="toss-send-who__body">
      {tab !== 0 ? (
        <p className="toss-send-who__empty">준비 중이에요</p>
      ) : (
        <>
          <TossPressable className="toss-send-who__box" radius={12} onPress={() => go(`/send/number?from=${encodeURIComponent(from)}`)}>
            <span className="toss-send-who__ph">계좌번호 입력</span>
            <TossPressable className="toss-send-who__cam" radius={16} onPress={() => {}} ariaLabel="카메라">
              <CameraGlyph />
            </TossPressable>
          </TossPressable>
          {data && (
            <div className="toss-send-who__list">
              {mine.length > 0 && (
                <TossPressable className={`toss-send-who__mine${open ? " open" : ""}`} color="#201f22" onPress={() => setOpen((o) => !o)}>
                  <span className="toss-send-who__sec">내 계좌</span>
                  <span className="toss-send-who__count">{open ? `${mine.length}개` : `+${mine.length}개`}</span>
                  <svg className="toss-send-who__chev" width="11.2" height="6.4" viewBox="0 0 11.2 6.4" fill="none" aria-hidden>
                    <path d="M.8.8l4.8 4.8L10.4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </TossPressable>
              )}
              <Expand open={open} height={20.2 + mine.length * 68}>
                {favRows.length === 0 && <p className="toss-send-who__hint">별표를 눌러 즐겨찾기 해보세요.</p>}
                {favRows.length > 0 && <div style={{ height: 20.2 }} />}
                {mine.map(row)}
              </Expand>
              {favRows.length > 0 && (
                <>
                  <h2 className="toss-send-who__sec toss-send-who__sech">즐겨찾기</h2>
                  {favRows.map(row)}
                </>
              )}
              {recentLeft.length > 0 && (
                <>
                  <h2 className="toss-send-who__sec toss-send-who__sech">최근 보낸 계좌</h2>
                  {recentLeft.map(row)}
                </>
              )}
              <div className="toss-send-who__pad" />
            </div>
          )}
        </>
      )}
    </TossPage>
  );
}

// 내 계좌 펼치기: 높이 200ms → 줄 100ms 나타남. 접기는 거꾸로 (A 117.64–118.03 · 118.87–119.24) — 순서는 CSS transition-delay
function Expand({ open, height, children }: { open: boolean; height: number; children: ReactNode }) {
  return (
    <div className={`toss-send-who__exp${open ? " open" : ""}`} style={{ height: open ? height : 0 }} aria-hidden={!open} inert={!open}>
      <div className="toss-send-who__exprows">{children}</div>
    </div>
  );
}

function StarGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M10.00 0.50L12.58 7.40L19.94 7.72L14.17 12.31L16.14 19.40L10.00 15.34L3.86 19.40L5.83 12.31L0.06 7.72L7.42 7.40Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
// 카메라 (채운 몸통 + 렌즈 구멍): 21.6 × 20 잉크, #525154
function CameraGlyph() {
  return (
    <svg width="21.6" height="20" viewBox="0 0 21.6 20" aria-hidden>
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M7 0h7.6l1.8 2.7h2.7a2.5 2.5 0 0 1 2.5 2.5v12.3a2.5 2.5 0 0 1-2.5 2.5H2.5A2.5 2.5 0 0 1 0 17.5V5.2a2.5 2.5 0 0 1 2.5-2.5h2.7ZM10.8 7.1a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"
      />
    </svg>
  );
}
