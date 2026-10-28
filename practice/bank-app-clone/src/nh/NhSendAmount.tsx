import type { Account, Recipient } from "../api/types";
import { nhWon } from "./hangul";
import { NhAmtClear } from "./NhAmountSheet";
import { amountError } from "./nhAmount";
import "./nh-send-amount.css";

// 콕송금 받는 분을 고른 뒤 (녹화2 14.2~20초, 녹화1 56.7~63.6초)
//   amount "얼마를 보낼까요?" 금액 상자(누르면 금액 시트) / 1일 송금 잔여한도. 잔액 부족이면 상자 안 빨간 금액 + 아래 두 줄 안내
//          (표시 내용 단계에서 ← 로 돌아오면 금액이 남아 있으므로 아래 [다음]으로 바로 넘어갈 수 있음 — 참고 영상에 없는 상태)
//   memo   "1원을 보낼게요" + 받는계좌/내계좌 표시 상자 + 상세 정보 ⌄ (누르면 거래메모 줄이 열림) + [다음]
export function NhSendAmount({
  account,
  to,
  stage,
  amount,
  remaining,
  memoTo,
  memoMe,
  memo,
  detail,
  onMemoTo,
  onMemoMe,
  onMemo,
  onToggleDetail,
  onOpenAmount,
  onClearAmount,
  onLimitInfo,
  onPickAgain,
  onAmountNext,
  onNext,
}: {
  account?: Account;
  to: Recipient;
  stage: "amount" | "memo";
  amount: number;
  remaining: number;
  memoTo: string;
  memoMe: string;
  memo: string;
  detail: boolean;
  onMemoTo: (v: string) => void;
  onMemoMe: (v: string) => void;
  onMemo: (v: string) => void;
  onToggleDetail: () => void;
  onOpenAmount: () => void;
  onClearAmount: () => void;
  onLimitInfo: () => void;
  onPickAgain: () => void;
  onAmountNext: () => void;
  onNext: () => void;
}) {
  const error = account ? amountError(amount, account.balance, remaining) : null;
  return (
    <>
      <div className="nh-sa">
        {/* 출금계좌 (작게): 농축협 번호 / 잔액 · 오른쪽 ⌄ */}
        <div className="nh-sa__from">
          <p>
            농축협 <span>{account?.number}</span>
          </p>
          <b>{account ? nhWon(account.balance) : " "}</b>
          <NhSaChevron />
        </div>
        <div className="nh-sa__to">
          <p>
            <u className="nh-sa__name" onClick={onPickAgain}>
              {to.holder}
            </u>
            님에게
          </p>
          {stage === "memo" && (
            <p>
              <u className="nh-sa__amt" onClick={onOpenAmount}>
                {nhWon(amount)}
              </u>
              을 보낼게요
            </p>
          )}
          <p className="nh-sa__acct">
            {to.bank.name}
            <span>{to.number}</span>
          </p>
        </div>
        {stage === "amount" ? (
          <>
            <h2 className="nh-sa__how">얼마를 보낼까요?</h2>
            <div className={`nh-sa__box ${amount ? "filled" : ""} ${error ? "error" : ""}`} role="button" tabIndex={0} onClick={onOpenAmount}>
              <NhSaOutline y0={0.4} h={60.8} />
              {amount ? (
                <>
                  <span>{nhWon(amount)}</span>
                  <button
                    className="nh-amt-clear nh-amt-clear--page"
                    aria-label="지우기"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAmount();
                    }}
                  >
                    <NhAmtClear />
                  </button>
                </>
              ) : (
                "금액 입력"
              )}
            </div>
            {error && <p className="nh-sa__error">{error}</p>}
            <div className="nh-sa__limit">
              <span>1일 송금 잔여한도</span>
              <button className="nh-sa__q" aria-label="1일 송금 잔여한도 안내" onClick={onLimitInfo}>
                ?
              </button>
              <b>{nhWon(remaining)}</b>
            </div>
          </>
        ) : (
          <>
            <div className={`nh-sa__memo ${detail ? "open" : ""}`}>
              {/* 선 바깥 268.267 / 319.467 / 371.2 (/ 거래메모 줄이 열리면 422.4) — 모두 480·720 기기 px 정수 자리 */}
              <NhSaOutline y0={0.2667} h={detail ? 154.133 : 102.933} dividers={detail ? [51.2, 102.933] : [51.2]} />
              <MemoRow label="받는계좌에 표시" value={memoTo} placeholder="" onChange={onMemoTo} />
              <MemoRow label="내계좌에 표시" value={memoMe} placeholder="받는분 이름 표시" onChange={onMemoMe} />
              {detail && <MemoRow label="거래메모" value={memo} placeholder="한글 20자 이내" onChange={onMemo} />}
            </div>
            <button className={`nh-sa__more ${detail ? "open" : ""}`} aria-expanded={detail} onClick={onToggleDetail}>
              상세 정보
              <NhSaChevron />
            </button>
          </>
        )}
      </div>
      {(stage === "memo" || (amount > 0 && !error)) && (
        <div className="nh-bottom nh-sa__bottom">
          <button className="nh-btn" onClick={stage === "memo" ? onNext : onAmountNext}>
            다음
          </button>
        </div>
      )}
    </>
  );
}

// 0.5dp 바깥테두리 #2f343a (실제 기기 720 에서 기기 1px 한 줄, 녹화 480 에서 한 행).
// 크롬은 DPR 2 미만에서 0.5px border 를 1 CSS px(두 행)로 올리고, box-shadow 는 상자를 정수 CSS px 에 붙여 그려 선이 두 행으로 갈림 →
// SVG 로 그림. SVG 원점도 정수 CSS px 에 붙으므로 상자 위에서 y0 만큼 위(정수 자리)에 두고, 선 가장자리를 ×1.25·×1.875 가 모두 정수인
// y(0.5333 의 배수)에 놓음. h = 바깥 높이, dividers = 가운데 가로선 위 가장자리 (상자 위에서)
const HAIR = 0.5333;
function NhSaOutline({ y0, h, dividers = [] }: { y0: number; h: number; dividers?: number[] }) {
  const w = 336;
  const t = HAIR / 2;
  return (
    <svg className="nh-sa__ol" width={w} height={y0 + h} style={{ top: -y0 }} aria-hidden>
      <rect x={t} y={y0 + t} width={w - HAIR} height={h - HAIR} rx={12 - t} />
      {dividers.map((d) => (
        <path key={d} d={`M0 ${y0 + d + t}H${w}`} />
      ))}
    </svg>
  );
}

// 표시 내용 한 줄: 왼쪽 이름(16/400), 오른쪽 입력칸(17/500) + ⓧ
function MemoRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="nh-sa__row">
      <span>{label}</span>
      <input value={value} maxLength={20} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button
          className="nh-amt-clear nh-amt-clear--page"
          aria-label="지우기"
          onClick={(e) => {
            e.preventDefault();
            onChange("");
          }}
        >
          <NhAmtClear />
        </button>
      )}
    </label>
  );
}

// ⌄ (출금계좌 줄 오른쪽 · 상세 정보 옆, 24 상자 중심 x 347.5, 굵기 1.5, 각진 끝). 색은 CSS
function NhSaChevron() {
  return (
    <svg className="nh-sa__chev" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M7.04 9.52 12 14.48l4.96-4.96" />
    </svg>
  );
}
