import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import type { HomeData, Transaction, TransactionDetail, TransferRecipients } from "../api/types";
import { useApi } from "../api/useApi";
import { KbankCopyIcon } from "./KbankAccount";
import { kbankBankName } from "./bank";
import { KbankClose } from "./header";
import { useKbankStatusBar } from "./theme";
import "./kbank-tx.css";

// 거래 상세 (녹화 59~82초, 프레임 1770~2460). 계좌 화면 위로 아래에서 올라오는 전체 화면, 오른쪽 위 ×.
// 이름 · 메모 입력 ✎ · 거래 일시/구분/금액(복사) · 회색 상자(이체 금액·수수료) · 계좌 잔액 · 상대 정보(입금) 또는 받는 계좌·받는 분에게 표기(출금)
// · 내보내기(입금) / 내보내기 | 이체확인증(출금) — 버튼은 무반응.
// 올라오기 445ms cubic-bezier(.46,0,.17,1) (raw 58.94~59.32초 × 위치로 맞춤, 오차 6px), 내려가기 413ms cubic-bezier(.78,0,.555,1) (65.21~65.62초, 오차 2px).
// 움직이는 동안 반투명 (아래 계좌 화면이 비침): 올라올 때 0.45 → 1, 내려갈 때 1 → 0.6. 값은 kbank-tx.css

const nf = new Intl.NumberFormat("ko-KR");
const MEMO_MAX = 20;
// 녹화는 이체가 모두 '전자금융' (서버 기본 거래구분 '이체')
const kindLabel = (kind: string) => (kind === "이체" ? "전자금융" : kind);
const KIND_BY_TAG: Record<string, string> = { "#체크카드": "체크카드결제", "#자동이체": "자동이체", "#예금이자": "예금이자", "#이체": "이체" };
// 계좌 화면에서 넘겨준 거래(location.state.tx)로 먼저 그림 → 상세를 받는 동안에도 올라오는 화면에 내용이 보임 (녹화도 처음부터 내용이 있음).
// 출금 이체인지는 목록 행의 toBank(받은 은행)로 알 수 있으니 모양(받는 계좌 · 버튼 2개)은 처음부터 맞게 그리고, 받는 계좌 값만 상세가 오면 채움
const provisional = (t: Transaction): TransactionDetail => ({
  ...t,
  transactedAt: `${t.at.slice(0, 10).replaceAll("-", ".")} ${t.at.slice(11, 19)}`,
  kind: KIND_BY_TAG[t.tag] ?? "",
});

function UploadIcon() {
  // 내보내기: 잉크 x 236~260 · y 890~915px (15.6 × 16.3dp), 선 2px(1.3dp) 남색. 받침 양옆 선 가운데 x 237.6 · 258.6, 아래 913.6px, 모서리 둥긂(약 3px),
  // 화살 꼭지 (248, 890.8), 날개 끝 ±6.5px · y 897, 대 아래 906.3px (프레임 1790~1830 평균)
  return (
    <svg width="15.8" height="16.4" viewBox="0 0 15.8 16.4" aria-hidden>
      <path
        d="M1.05 9.8v3.6a2 2 0 0 0 2 2h9.65a2 2 0 0 0 2-2V9.8M7.87 10.6V.75M3.67 4.6 7.87.65l4.2 3.95"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Memo({ tx }: { tx: TransactionDetail }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    const v = (draft ?? "").trim();
    setDraft(null);
    if (v !== (tx.memo ?? "")) void api.updateMemo(tx.id, v).catch(() => {});
  };
  if (draft !== null)
    return (
      <input
        className="kbt-memo kbt-memo__input"
        autoFocus
        value={draft}
        maxLength={MEMO_MAX}
        placeholder="메모 입력"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  return (
    <button className="kbt-memo" onClick={() => setDraft(tx.memo ?? "")}>
      {tx.memo || "메모 입력"}
      {/* 연필: 잉크 x 131~153 · y 242~264px, #6c707c (머티리얼 edit 모양) */}
      <svg className="kbt-memo__pen" width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#6c707c"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
        />
      </svg>
    </button>
  );
}

export function KbankTxDetail() {
  useKbankStatusBar();
  const { txId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // 앱 안에서 열었을 때만 올라오기 (주소로 바로 열면 그냥 보임)
  const [enter] = useState(() => location.key !== "default");
  const detail = useApi<TransactionDetail>(paths.transaction(txId));
  const passed = (location.state as { tx?: Transaction } | null)?.tx;
  const full = detail.data;
  const tx = full ?? (passed?.id === txId ? provisional(passed) : undefined);
  const home = useApi<HomeData>(paths.home);
  const people = useApi<TransferRecipients>(paths.recipients(tx?.accountId ?? "main"));

  const close = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(`/account/${tx?.accountId ?? "main"}`, { replace: true }));

  const inbound = (tx?.amount ?? 0) > 0;
  const abs = Math.abs(tx?.amount ?? 0);
  // 출금 이체(받는 계좌가 있음): 상세가 오면 transfer, 오기 전엔 목록 행의 toBank 로 판단 → 처음부터 출금 모양
  const outbound = !inbound && (full ? !!full.transfer : !!tx?.toBank);
  const sent = full?.transfer;
  // 받는 분에게 표기: 보낼 때 적은 글자, 없으면 내 이름 (상세가 와야 앎 → 그 전엔 빈칸)
  const memoTo = full ? full.memoTo || home.data?.profile.userName || "" : "";
  // 입금 상대 은행: 받는 분 목록(최근·즐겨찾기)에 같은 이름이 있으면 그 은행 (서버 거래에는 보낸 은행이 없음). 목록을 받기 전엔 빈칸 (이름만 먼저 나왔다 바뀌지 않게)
  // 출금인데 이체가 아닌 것(체크카드 결제 등, 녹화에 없음)은 가맹점 이름만
  const from = (() => {
    if (!tx) return null;
    if (!inbound) return tx.merchant;
    if (people.status === "loading") return null;
    const d = people.data;
    const hit = d && [...d.recent, ...d.favorites].find((r) => r.holder === tx.merchant);
    return hit ? `${tx.merchant} ${kbankBankName(hit.bank, hit.number)}` : tx.merchant;
  })();

  return (
    <div className={`kb kbt ${enter ? "kbt--enter" : ""}`}>
      <KbankClose onClick={close} />
      {!tx && detail.status === "error" && (
        <div className="kbt-fail">
          <p>{detail.error.status === 404 ? "거래내역을 찾을 수 없어요" : "거래내역을 불러오지 못했어요"}</p>
          {detail.error.status !== 404 && <button onClick={detail.retry}>다시 시도</button>}
        </div>
      )}
      {tx && (
        <>
          <h2 className="kbt-name">{tx.merchant}</h2>
          <Memo key={tx.id} tx={tx} />
          <div className="kbt-line" style={{ top: 191.2 }} />
          {/* 줄 위치: 프레임 1800(입금) · 2100(출금) 잉크와 겹쳐 맞춤 — 거래 일시 382 · 구분 437 · 금액 493 · 이체 금액 573 · 수수료 616 · 잔액 696 · 상대 정보 777px (±1px) */}
          <dl className="kbt-rows">
            <div className="kbt-row" style={{ top: 214.5 }}>
              <dt>거래 일시</dt>
              <dd>{tx.transactedAt.slice(0, 16)}</dd>
            </div>
            <div className="kbt-row" style={{ top: 250.45 }}>
              <dt>거래 구분</dt>
              <dd>{kindLabel(tx.kind)}</dd>
            </div>
            <div className="kbt-row" style={{ top: 287.1 }}>
              <dt>거래 금액</dt>
              <dd className="kbt-amt">
                {inbound ? "+" : "-"}
                {nf.format(abs)}원
                <button
                  className="kbt-amt__copy"
                  aria-label="금액 복사"
                  onClick={() => void navigator.clipboard?.writeText(String(abs)).catch(() => {})}
                >
                  <KbankCopyIcon color="#2c2c2c" size={15} />
                </button>
              </dd>
            </div>
          </dl>
          <div className="kbt-box">
            <div className="kbt-row kbt-row--box" style={{ top: 17.6 }}>
              <dt>이체 금액</dt>
              <dd>{nf.format(abs)} 원</dd>
            </div>
            <div className="kbt-row kbt-row--box" style={{ top: 45.9 }}>
              <dt>수수료</dt>
              <dd>0 원</dd>
            </div>
          </div>
          <div className="kbt-row" style={{ top: 418.85 }}>
            <dt>계좌 잔액</dt>
            <dd>{nf.format(tx.balanceAfter)} 원</dd>
          </div>
          <div className="kbt-line" style={{ top: 452.8 }} />
          {outbound ? (
            <>
              <div className="kbt-row" style={{ top: 471.6 }}>
                <dt>받는 계좌</dt>
                <dd>{sent ? `${kbankBankName(sent.bank, sent.number)} ${sent.number}` : ""}</dd>
              </div>
              <div className="kbt-row" style={{ top: 507.4 }}>
                <dt>받는 분에게 표기</dt>
                <dd>{memoTo}</dd>
              </div>
              <div className="kbt-line" style={{ top: 541.6 }} />
              <div className="kbt-btns" style={{ top: 566.9 }}>
                <button className="kbt-btn kbt-btn--half">
                  <UploadIcon />
                  내보내기
                </button>
                <button className="kbt-btn kbt-btn--half">이체확인증</button>
              </div>
            </>
          ) : (
            <>
              <div className="kbt-row" style={{ top: 471.6 }}>
                <dt>상대 정보</dt>
                <dd>{from}</dd>
              </div>
              <div className="kbt-line" style={{ top: 505.5 }} />
              <div className="kbt-btns" style={{ top: 530.4 }}>
                <button className="kbt-btn">
                  <UploadIcon />
                  내보내기
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
