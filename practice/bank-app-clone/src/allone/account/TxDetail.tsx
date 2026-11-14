// /tx/:txId — 거래내역 상세 (account.md §2.2, 녹화 C2 14.458–15.791 입금 · 17.658–19.224 출금, 기준 프레임 C2 14.991 · 18.324).
// 머리줄: 왼쪽 제목 + × (확인과 같음). 이름 줄 → 메모 칸 (54, 둥글기 12) → 정보 카드 → (보낸 이체만) 자동이체 등록 › → 아래 고정 확인 (누르면 #004511)
//  보낸 이체(출금 + 받는 계좌가 있음): 이름 옆 ☆, 오른쪽 다시보내기, 카드에 출금계좌(내 계좌, 하이픈) · 입금계좌(받는 계좌, 숫자만)
//  그 밖(입금 · 체크카드 · 자동이체 · 결산이자): 이름만, 카드는 거래시간 · 거래금액 · 거래 후 잔액. 이름 줄이 4pt 낮아 아래가 4pt 올라감
//  ☆  : 받는 분 등록이 있으면 PATCH /api/payees/:id {favorite}, 없으면 POST /api/payees {…, favorite: true} — 누르자마자 바뀜 (실패하면 되돌림)
//  메모: 누르면 한국어 키보드 (최대 20자), ✓ · ↵ · 바깥 누름 · 화면을 떠날 때 바뀐 경우만 PATCH /api/transactions/:id {memo}
//  다시보내기: resend 로딩 1000ms 뒤 얼마를 보낼까요 (이 칸을 바꿈 → 거기서 뒤로 가면 거래내역조회)
//  ×  · 확인: 뒤로 (거래내역조회는 스크롤 그대로). 자동이체 등록 › 은 아무 일 없음 (plan §1.7)
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoApi, aoPaths, AO_TOPUP_MEMO, type AoAccount, type AoTxDetail } from "../api";
import { aoBankName } from "../bank";
import { useAoFlow } from "../flow";
import { aoAccountNumber, aoDigits, aoTime, aoWon } from "../format";
import { useAoBack } from "../nav";
import { AoButton, AoCaret, AoChevronRightIcon, AoHeader, AoKeyboard, AoPage, AoStarIcon, aoToast } from "../ui";
import { acctDate } from "./list";
import "./account.css";

const MEMO_MAX = 20;

// 출금계좌: 이 거래가 있는 내 계좌 (거래내역조회에서 이미 받아 둔 것)
function FromAccount({ id }: { id: string }) {
  const acct = useApi<AoAccount>(aoPaths.account(id));
  const a = acct.data;
  return (
    <div className="ao-acct-info__row ao-acct-info__row--two">
      <span className="ao-acct-info__label">출금계좌</span>
      <span className="ao-acct-info__value">
        <span className="ao-acct-info__bank">{a ? aoBankName(a.bank) : ""}</span>
        <span className="ao-acct-info__num">{a ? aoAccountNumber(a) : ""}</span>
      </span>
    </div>
  );
}

// ☆: 서버 값 위에 누른 값을 먼저 보여 줌 (서버가 같은 값을 돌려주면 내려놓음)
//  받는 분을 새로 등록(POST)한 뒤 상세를 다시 받기 전에 또 누르면, 방금 만든 id 로 PATCH (두 번 등록하지 않음)
function useFavorite(t: AoTxDetail | undefined) {
  const server = !!t?.ao?.payee?.favorite;
  const [mine, setMine] = useState<boolean | null>(null);
  const busy = useRef(false);
  const created = useRef<string | null>(null);
  if (mine !== null && mine === server) setMine(null); // 서버가 따라오면 내려놓음
  const on = mine ?? server;
  const toggle = () => {
    const tr = t?.transfer;
    if (!t || !tr || busy.current) return;
    const next = !on;
    busy.current = true;
    setMine(next);
    const id = t.ao?.payee?.id ?? created.current;
    const req = id
      ? aoApi.setFavorite(id, next)
      : aoApi.addPayee({ bankCode: tr.bank.code, number: aoDigits(tr.number), holder: tr.holder, favorite: true }).then((p) => {
          created.current = p.id;
        });
    req.then(
      () => {
        busy.current = false;
      },
      () => {
        busy.current = false;
        setMine(null);
      },
    );
  };
  return { on, toggle };
}

export function TxDetail() {
  const { txId = "" } = useParams();
  const flow = useAoFlow();
  const back = useAoBack();
  const tx = useApi<AoTxDetail>(aoPaths.transaction(txId));
  const t = tx.data;
  const fav = useFavorite(t);

  // 메모: editing 이면 draft 를 보여 줌, 저장 중이면 saving, 아니면 서버 값
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const serverMemo = t?.memo ?? "";
  if (saving !== null && saving === serverMemo) setSaving(null); // 저장한 값이 돌아오면 내려놓음
  const memo = editing ? draft : (saving ?? serverMemo);

  // 키보드가 열린 채 화면을 떠나면 (브라우저 뒤로) 그때까지 쓴 메모를 저장
  const leave = useRef({ editing, draft, serverMemo, id: t?.id });
  useEffect(() => {
    leave.current = { editing, draft, serverMemo, id: t?.id };
  });
  useEffect(
    () => () => {
      const m = leave.current;
      const next = m.draft.trim();
      if (m.editing && m.id && next !== m.serverMemo) void aoApi.updateMemo(m.id, next).catch(() => {});
    },
    [],
  );

  const startMemo = () => {
    if (!t || editing) return;
    setDraft(memo);
    setEditing(true);
  };
  const doneMemo = () => {
    if (!editing) return;
    setEditing(false);
    const next = draft.trim();
    if (!t || next === serverMemo) return;
    setSaving(next);
    aoApi.updateMemo(t.id, next).catch(() => {
      setSaving(null);
      aoToast("메모를 저장하지 못했어요");
    });
  };

  const sent = !!t?.transfer && t.amount < 0;
  const own = sent && t?.memoTo === AO_TOPUP_MEMO; // 잔액채우기 (내 계좌끼리): ☆ 없음
  const out = !!t && t.amount < 0;

  const resend = () => {
    if (!t?.transfer) return;
    void flow.goAmount({
      from: t.ao?.accountId ?? t.accountId,
      to: { bankCode: t.transfer.bank.code, number: t.transfer.number, holder: t.transfer.holder },
      replace: true,
      via: "resend",
    });
  };

  return (
    <AoPage
      className="ao-acct-detail"
      header={<AoHeader variant="close" title="거래내역 상세" onClose={back} />}
      footer={
        <AoButton pressed="dark" onPress={back}>
          확인
        </AoButton>
      }
    >
      {t && (
        <div className={`ao-acct-detail__body${sent ? " ao-acct-detail__body--sent" : ""}`}>
          <div className="ao-acct-name">
            <span className="ao-acct-name__text">{t.merchant}</span>
            {sent && !own && (
              <button type="button" className="ao-acct-name__star" aria-label="자주 보내는 계좌" aria-pressed={fav.on} onClick={fav.toggle}>
                <AoStarIcon filled={fav.on} />
              </button>
            )}
            {sent && (
              <AoButton variant="outline" className="ao-acct-name__resend" width={80.6} height={30} radius={8} size={12.65} weight={400} onPress={resend}>
                다시보내기
              </AoButton>
            )}
          </div>

          <div className={`ao-acct-memo${editing ? " ao-acct-memo--focus" : ""}`} data-ao-kb-field onClick={startMemo}>
            {memo ? <span className="ao-acct-memo__text">{memo}</span> : !editing && <span className="ao-acct-memo__ph">메모 입력 (최대 20자)</span>}
            {editing && <AoCaret height={22} />}
          </div>

          <div className="ao-acct-info">
            <div className="ao-acct-info__row">
              <span className="ao-acct-info__label">거래시간</span>
              <span className="ao-acct-info__value">
                {acctDate(t.at)}
                <span className="ao-acct-info__time">{aoTime(t.at)}</span>
              </span>
            </div>
            <div className="ao-acct-info__row ao-acct-info__row--gap">
              <span className="ao-acct-info__label">거래금액</span>
              <span className={`ao-acct-info__value ao-acct-info__amt ao-acct-info__amt--${out ? "out" : "in"}`}>{aoWon(Math.abs(t.amount))}</span>
            </div>
            <div className="ao-acct-info__row">
              <span className="ao-acct-info__label">거래 후 잔액</span>
              <span className="ao-acct-info__value">{aoWon(t.balanceAfter)}</span>
            </div>
            {sent && t.transfer && (
              <>
                <FromAccount id={t.ao?.accountId ?? t.accountId} />
                <div className="ao-acct-info__row ao-acct-info__row--two">
                  <span className="ao-acct-info__label">입금계좌</span>
                  <span className="ao-acct-info__value">
                    <span className="ao-acct-info__bank">{aoBankName(t.transfer.bank)}</span>
                    <span className="ao-acct-info__num">{aoDigits(t.transfer.number)}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {sent && (
            // 자동이체 등록 › : 녹화에 누름 · 다음 화면 없음 → 아무 일 없음
            <div className="ao-acct-auto">
              <span>자동이체 등록</span>
              <AoChevronRightIcon className="ao-acct-auto__chev" />
            </div>
          )}
        </div>
      )}
      {!t && tx.status === "error" && (
        <div className="ao-acct-error ao-acct-error--detail">
          <p>일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.</p>
          <AoButton variant="outline" width={120} height={40} radius={10} size={15} weight={500} onPress={tx.retry}>
            다시 시도
          </AoButton>
        </div>
      )}

      <AoKeyboard open={editing} value={draft} onChange={setDraft} maxLength={MEMO_MAX} onDone={doneMemo} />
    </AoPage>
  );
}
