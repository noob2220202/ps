import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import type { TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { hanaBankName, hanaNumber, hanaTxKind, nf } from "./bank";
import { ChevronRight, HanaHeader, HanaRetry, HanaSpinner, HeaderClose } from "./common";
import { useSafeBack } from "./nav";
import { useHanaStatusBar } from "./theme";
import "./hana-history.css";

// 거래내역상세 (라이트 스크린샷 b296deb7, 녹화 50~60초, 다크 D/0191~0213): 이름 → 거래일시 · 거래구분 · (입금계좌) · 거래금액 · (수수료) ·
// 거래후잔액 · 추가메모 → "'이름' 검색 >" → (내가 보낸 이체면) [다시 이체] [자주쓰는 이체 등록] → 카카오톡 · 문자 · 내역복사
export function HanaTxDetail() {
  const navigate = useNavigate();
  const { txId = "" } = useParams();
  const tx = useApi<TransactionDetail>(paths.transaction(txId));
  const [memo, setMemo] = useState<string | null>(null); // 메모 고치는 중이면 입력값
  const [notice, setNotice] = useState<string | null>(null);
  useHanaStatusBar();
  const t = tx.data;
  // 주소로 바로 열었으면 X 는 그 계좌의 거래내역으로
  const close = useSafeBack(t ? `/history/${t.accountId}` : "/");

  const saveMemo = () => {
    if (memo === null || !t) return;
    api.updateMemo(t.id, memo.trim()).catch(() => setNotice("메모를 저장하지 못했어요"));
    setMemo(null);
  };
  const copy = () => {
    if (!t) return;
    const text = `[하나은행] ${t.transactedAt}\n${t.merchant} ${t.amount < 0 ? "-" : "+"}${nf.format(Math.abs(t.amount))}원\n잔액 ${nf.format(t.balanceAfter)}원`;
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setNotice("거래내역을 복사했어요.");
  };
  // 자주쓰는 이체 등록: 받는 분으로 등록돼 있으면 ☆만 켜고, 없으면 받는 분부터 등록. 이미 ☆이면 안내만 (콕뱅크 NhTxDetail addFavorite 과 같은 규칙)
  const favorite = async () => {
    if (!t?.transfer) return;
    const tr = t.transfer;
    try {
      const r = await api.lookupAccount(tr.bank.code, tr.number).catch(() => null);
      if (r?.accountId) return setNotice("내 계좌는 등록할 수 없어요.");
      if (r?.favorite) return setNotice("이미 자주쓰는 이체로 등록된 계좌예요.");
      const payeeId = r?.payeeId ?? (await api.addPayee({ bankCode: tr.bank.code, number: tr.number, holder: tr.holder })).id;
      await api.updatePayee(payeeId, { favorite: true });
      setNotice("자주쓰는 이체에 등록했어요.");
    } catch {
      setNotice("등록하지 못했어요.");
    }
  };

  return (
    <div className="screen hana hana-txd">
      <HanaHeader title="거래내역상세" right={<HeaderClose onClick={close} />} />
      {!t ? (
        tx.status === "error" ? (
          <HanaRetry onRetry={tx.retry} message={tx.error.status === 404 ? "거래내역을 찾을 수 없어요" : undefined} />
        ) : (
          <div className="hh-list__spin">
            <HanaSpinner />
          </div>
        )
      ) : (
        <div className="htd-body">
          <h2 className="htd-name">{t.merchant}</h2>
          <dl className="htd-rows">
            <div>
              <dt>거래일시</dt>
              <dd>{t.transactedAt}</dd>
            </div>
            <div>
              <dt>거래구분</dt>
              <dd>{hanaTxKind({ ...t, toBank: t.transfer ? { code: t.transfer.bank.code, digits: t.transfer.number.length } : undefined })}</dd>
            </div>
            {t.transfer && (
              <div>
                <dt>입금계좌</dt>
                <dd>
                  {hanaBankName(t.transfer.bank, t.transfer.number)}
                  <br />
                  {hanaNumber(t.transfer.bank, t.transfer.number)}
                </dd>
              </div>
            )}
            <div>
              <dt>거래금액</dt>
              <dd>
                {t.amount < 0 ? "-" : "+"}
                {nf.format(Math.abs(t.amount))}원
              </dd>
            </div>
            {t.transfer && (
              <div>
                <dt>수수료</dt>
                <dd>면제</dd>
              </div>
            )}
            <div>
              <dt>거래후잔액</dt>
              <dd>{nf.format(t.balanceAfter)}원</dd>
            </div>
            <div>
              <dt>추가메모</dt>
              <dd>
                {memo !== null ? (
                  <input
                    className="htd-memo"
                    autoFocus
                    value={memo}
                    maxLength={20}
                    placeholder="메모 입력"
                    onChange={(e) => setMemo(e.target.value)}
                    onBlur={saveMemo}
                    onKeyDown={(e) => e.key === "Enter" && saveMemo()}
                  />
                ) : (
                  <button className="htd-link htd-link--strong" onClick={() => setMemo(t.memo ?? "")}>
                    {t.memo || "메모입력"} <ChevronRight size={18} stroke={2.2} />
                  </button>
                )}
              </dd>
            </div>
          </dl>
          <button className="htd-link htd-search" onClick={() => {}}>
            ‘{t.merchant}’ 검색 <ChevronRight size={20} stroke={1.6} />
          </button>
          {t.transfer && (
            <div className="htd-btns">
              <button
                onClick={() => {
                  const tr = t.transfer!;
                  navigate(`/send?bank=${tr.bank.code}&number=${tr.number}`);
                }}
              >
                다시 이체
              </button>
              <button onClick={favorite}>자주쓰는 이체 등록</button>
            </div>
          )}
          {/* 공유 아이콘 3개는 b296deb7 의 원 안에서 잘라 온 그림 (scripts/hana-crops/icons.py → hana-share-*) */}
          <div className="htd-share">
            <button onClick={() => {}}>
              <span>
                <ShareIcon name="kakao" w={22.4} h={20.3} fallback={<KakaoIcon />} />
              </span>
              카카오톡
            </button>
            <button onClick={() => {}}>
              <span>
                <ShareIcon name="sms" w={21.3} h={20.3} fallback={<SmsIcon />} />
              </span>
              문자
            </button>
            <button onClick={copy}>
              <span>
                <ShareIcon name="copy" w={20.3} h={20.3} fallback={<CopyIcon />} />
              </span>
              내역복사
            </button>
          </div>
        </div>
      )}
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

function ShareIcon({ name, w, h, fallback }: { name: string; w: number; h: number; fallback: ReactNode }) {
  const src = localAsset(`hana-share-${name}`);
  if (!src) return fallback;
  return <img className={`htd-share__ic htd-share__ic--${name}`} src={src} alt="" style={{ width: w, height: h }} draggable={false} />;
}

// 그림이 없을 때 대신 그리는 아이콘
function KakaoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <path d="M13 4C7.5 4 3 7.4 3 11.6c0 2.7 1.9 5.1 4.7 6.4l-1 3.8c-.1.3.3.6.6.4l4.4-2.9c.4 0 .9.1 1.3.1 5.5 0 10-3.4 10-7.8S18.5 4 13 4Z" fill="var(--htd-kakao)" />
    </svg>
  );
}
function SmsIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 26 26" fill="none" stroke="#2f74c7" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M5.5 4.5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h-1a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
      <path d="M8.5 9.5h9M8.5 13.5h6" strokeLinecap="round" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" stroke="#6c747d" strokeWidth="1.8" aria-hidden>
      <rect x="8.5" y="8.5" width="13" height="13" rx="2.5" />
      <path d="M17.5 5.5a2.5 2.5 0 0 0-2.4-1.5H7a2.5 2.5 0 0 0-2.5 2.5v8a2.5 2.5 0 0 0 1.6 2.3" />
      <path d="M11.5 12.5h7M11.5 16h5" strokeLinecap="round" />
    </svg>
  );
}
