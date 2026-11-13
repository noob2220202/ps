// T1 누구에게 보낼까요? (transfer.md §2.2 · §5.4 · §5.6, C3 27.5 · C2 21.2)
// 계좌번호 칸(숫자 패드) + 은행 칸(은행 선택 시트) + 도움말 + 다음(조회 → 얼마를 보낼까요), 탭 최근 · 자주 · 내계좌 · 연락처, 줄의 ☆, 최근 삭제하기.
// 줄을 누르면 얼마를 보낼까요로 바로 CUT (로딩 없음). 취소 = 새로 불러온 홈 (cancelHome)
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import type { Bank } from "../../api/types";
import { aoApi, aoPaths, type AoRecipients } from "../api";
import { aoBankName, aoBankTabs } from "../bank";
import { useAoFlow } from "../flow";
import { aoDigits } from "../format";
import { useAoBack } from "../nav";
import { AoBankLogo, AoButton, AoCaret, AoChevronDownIcon, AoHeader, AoKeyboard, AoPage, AoSheet, AoStarIcon } from "../ui";
import { SendRow } from "./parts";
import { findBank, logoBank, rawLine } from "./util";

type Tab = "recent" | "fav" | "mine" | "contacts";
const TABS: [Tab, string][] = [
  ["recent", "최근"],
  ["fav", "자주"],
  ["mine", "내계좌"],
  ["contacts", "연락처"],
];
const EMPTY: Record<Tab, string> = {
  recent: "최근 보낸 내역이 없어요",
  fav: "자주 보내는 계좌가 없어요",
  mine: "보낼 수 있는 내 계좌가 없어요",
  contacts: "연락처는 연습용 앱에서 지원하지 않아요",
};

interface Row {
  key: string;
  bank: Bank;
  number: string;
  holder: string;
  name: string; // 줄 첫째 줄 (받는 분 이름 · 내 계좌는 상품명)
  payeeId?: string;
  favorite?: boolean;
  lastAt?: string;
  star: boolean; // ☆ 보임 (내계좌는 없음)
}
const keyOf = (bank: string, number: string) => `${bank}:${aoDigits(number)}`;

export function SendWho() {
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const flow = useAoFlow();
  const back = useAoBack();
  const rec = useApi<AoRecipients>(aoPaths.recipients(from));
  const banksApi = useApi<Bank[]>(aoPaths.banks);
  const banks = banksApi.data;

  // ---- 입력 ----
  const [number, setNumber] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);
  const [focus, setFocus] = useState(false);
  const [bankSheet, setBankSheet] = useState(false);
  const [bankTab, setBankTab] = useState<"banks" | "securities">("banks");
  const [lookupError, setLookupError] = useState(false);
  const autoBank = useRef(true); // 사용자가 은행을 직접 고르면 자동 채움 그만

  // ---- 목록 ----
  const [tab, setTab] = useState<Tab>("recent");
  const [edit, setEdit] = useState(false);
  const [starOverride, setStarOverride] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, string>>({}); // 삭제한 최근 줄 → 그때의 lastAt
  // 새 목록이 오면 ☆ 덮어쓰기는 버림 (서버 값이 맞음)
  const data = rec.data;
  const [seenData, setSeenData] = useState(data);
  if (data !== seenData) {
    setSeenData(data);
    setStarOverride({});
  }

  const rows = useMemo(() => {
    const fav = (r: { bank: Bank; number: string; favorite?: boolean }) => starOverride[keyOf(r.bank.code, r.number)] ?? !!r.favorite;
    const recent: Row[] = (data?.recent ?? [])
      .filter((r) => hidden[keyOf(r.bank.code, r.number)] !== r.lastAt)
      .map((r) => ({ key: keyOf(r.bank.code, r.number), bank: r.bank, number: r.number, holder: r.holder, name: r.holder, payeeId: r.payeeId, favorite: fav(r), lastAt: r.lastAt, star: true }));
    const favs: Row[] = (data?.favorites ?? [])
      .map((p) => ({ key: keyOf(p.bank.code, p.number), bank: p.bank, number: p.number, holder: p.holder, name: p.holder, payeeId: p.payeeId, favorite: fav({ ...p, favorite: true }), star: true }));
    const mine: Row[] = (data?.mine ?? []).map((m) => ({ key: `me:${m.accountId}`, bank: m.bank, number: aoDigits(m.number), holder: m.holder, name: m.label, star: false }));
    return { recent, fav: favs, mine, contacts: [] as Row[] };
  }, [data, starOverride, hidden]);
  const list = rows[tab];

  // 계좌번호 10자리 이상에서 0.3초 멈추면, 최근 · 자주 · 내계좌에 같은 번호가 은행 하나뿐일 때 그 은행을 넣음 (§5.4)
  useEffect(() => {
    if (number.length < 10 || !autoBank.current || !data) return;
    const t = window.setTimeout(() => {
      const all = [...data.recent, ...data.favorites, ...data.mine];
      const codes = new Set(all.filter((r) => aoDigits(r.number) === number).map((r) => r.bank.code));
      if (codes.size === 1) {
        const code = [...codes][0];
        const b = findBank(banks, code) ?? all.find((r) => r.bank.code === code)?.bank ?? null;
        if (b) setBank(b);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [number, data, banks]);

  const canNext = number.length >= 10 && !!bank;
  const onNext = () => {
    if (!canNext || !bank) return;
    setFocus(false);
    let holder = "";
    const code = bank.code;
    void flow.go(() => `/send/amount?from=${encodeURIComponent(from)}&bank=${code}&number=${number}&holder=${encodeURIComponent(holder)}`, {
      via: "lookup",
      prefetch: [aoPaths.home],
      task: () =>
        aoApi.lookup(code, number).then((r) => {
          holder = r.holder;
        }),
      onError: () => setLookupError(true),
    });
  };

  const openRow = (r: Row) => {
    if (editing) return;
    setFocus(false);
    void flow.goAmount({ from, to: { bankCode: r.bank.code, number: r.number, holder: r.holder } });
  };

  const toggleStar = (r: Row) => {
    const next = !r.favorite;
    setStarOverride((o) => ({ ...o, [r.key]: next }));
    const req = r.payeeId ? aoApi.setFavorite(r.payeeId, next) : aoApi.addPayee({ bankCode: r.bank.code, number: r.number, holder: r.holder, favorite: true });
    req.catch(() =>
      setStarOverride((o) => {
        const { [r.key]: _drop, ...rest } = o;
        return rest;
      }),
    );
  };

  const remove = (r: Row) => {
    setHidden((h) => ({ ...h, [r.key]: r.lastAt ?? "" }));
    aoApi.hideRecent(r.bank.code, r.number).catch(() =>
      setHidden((h) => {
        const { [r.key]: _drop, ...rest } = h;
        return rest;
      }),
    );
  };

  // 탭을 바꾸면 편집은 끝
  const pickTab = (t: Tab) => {
    setTab(t);
    setEdit(false);
  };
  const editing = edit && tab === "recent" && rows.recent.length > 0; // 지울 줄이 없으면 편집도 끝

  const bankTabs = useMemo(() => aoBankTabs(banks ?? []), [banks]);
  const listH = list.length ? list.length * 63.33 : 140;

  return (
    <AoPage
      className="ao-send-who"
      header={<AoHeader variant="flow" onBack={() => back()} onCancel={() => void flow.goHomeFresh()} />}
    >
      <div className="ao-send-who__top">
        <h2 className="ao-send-who__title">누구에게 보낼까요?</h2>

        <div
          className={`ao-send-field ao-send-who__number${focus ? " ao-send-field--focus" : ""}`}
          data-ao-kb-field
          role="textbox"
          aria-label="계좌번호"
          onClick={() => {
            setBankSheet(false);
            setFocus(true);
          }}
        >
          {number ? (
            <span className="ao-send-field__text ao-send-field__text--value">
              {number}
              {focus && <AoCaret height={21} color="#0c8f2d" className="ao-send-field__caret" />}
            </span>
          ) : (
            <>
              {focus && <AoCaret height={21} color="#0c8f2d" className="ao-send-field__caret ao-send-field__caret--empty" />}
              <span className="ao-send-field__text ao-send-field__text--ph">계좌번호를 입력해 주세요</span>
            </>
          )}
        </div>

        <button
          type="button"
          className="ao-send-field ao-send-who__bank"
          onClick={() => {
            setFocus(false);
            setBankSheet(true);
          }}
        >
          <span className="ao-send-field__text ao-send-field__text--bank">{bank ? aoBankName(bank) : "은행을 선택해 주세요"}</span>
          <AoChevronDownIcon w={12} h={6.7} stroke={1.4} className="ao-send-who__chev" />
        </button>

        <p className={`ao-send-who__help${lookupError ? " ao-send-who__help--error" : ""}`}>
          {lookupError ? "입력하신 계좌정보를 확인해 주세요" : "계좌번호를 입력하면 은행을 조회해 드릴게요"}
        </p>

        <AoButton
          className="ao-send-who__next"
          disabled={!canNext}
          disabledColor="#808080"
          height={48}
          radius={6.5}
          size={17.5}
          weight={400}
          onPress={onNext}
        >
          다음
        </AoButton>

        <div className="ao-send-tabs" role="tablist">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`ao-send-tabs__tab${tab === t ? " ao-send-tabs__tab--on" : ""}`} onClick={() => pickTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "recent" && rows.recent.length > 0 && (
          <button type="button" className="ao-send-who__edit" onClick={() => setEdit(!editing)}>
            <span>{editing ? "완료" : "삭제하기"}</span>
          </button>
        )}
      </div>

      <div className="ao-send-who__list" style={{ height: listH }}>
        {list.length === 0 && rec.status !== "loading" && <p className="ao-send-empty">{EMPTY[tab]}</p>}
        {list.map((r) => (
          <SendRow
            key={r.key}
            code={r.bank.code}
            bank={r.bank}
            name={r.name}
            sub={rawLine(r.bank, r.number)}
            onPress={() => openRow(r)}
            right={
              r.star &&
              (editing ? (
                <button type="button" className="ao-send-row__del" aria-label="삭제" onClick={() => remove(r)}>
                  <DelIcon />
                </button>
              ) : (
                <button type="button" className="ao-send-row__star" aria-label={r.favorite ? "자주 해제" : "자주 등록"} aria-pressed={!!r.favorite} onClick={() => toggleStar(r)}>
                  <AoStarIcon size={20} stroke={1.5} color="#8f8f8f" filled={!!r.favorite} />
                </button>
              ))
            }
          />
        ))}
      </div>

      <AoKeyboard
        open={focus}
        kind="num"
        value={number}
        maxLength={16}
        onChange={(v) => {
          setNumber(aoDigits(v).slice(0, 16));
          setLookupError(false);
        }}
        onDone={() => setFocus(false)}
      />

      <AoSheet open={bankSheet} top={118} title="은행 선택" onClose={() => setBankSheet(false)} className="ao-send-banksheet">
        <div className="ao-send-tabs ao-send-tabs--two" role="tablist">
          {(
            [
              ["banks", "은행"],
              ["securities", "증권사"],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={bankTab === t} className={`ao-send-tabs__tab${bankTab === t ? " ao-send-tabs__tab--on" : ""}`} onClick={() => setBankTab(t)}>
              {label}
            </button>
          ))}
        </div>
        <div className="ao-send-bankgrid">
          {bankTabs[bankTab].map((b) => (
            <button
              key={b.code}
              type="button"
              className="ao-send-bankgrid__cell"
              onClick={() => {
                autoBank.current = false;
                setBank(b);
                setLookupError(false);
                setBankSheet(false);
              }}
            >
              <AoBankLogo code={b.code} bank={logoBank(b)} />
              <span>{aoBankName(b)}</span>
            </button>
          ))}
        </div>
      </AoSheet>
    </AoPage>
  );
}

// 삭제하기 편집: ☆ 자리의 22pt 회색 동그라미 × (#BCBCBC)
function DelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <circle cx="11" cy="11" r="11" fill="#bcbcbc" />
      <path d="M7.4 7.4 14.6 14.6M14.6 7.4 7.4 14.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
