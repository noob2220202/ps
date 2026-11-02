import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, HomeData, TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { kbankBankShort, kbankKindLabel } from "./bank";
import { useKbankGo } from "./nav";
import { kbNf, useKbankStatusBar } from "./theme";
import "./kbank-receipt.css";

// 이체확인증 (두 번째 녹화 45.7~52.1초 프레임 1377~1563 '1 원' · 73.9~77.8초 2217~2334 '500,000 원' · 90.2~94.3초 2706~2829).
// 출금 이체 상세의 '이체확인증'에서 열림 (경로 /receipt/:txId, App.tsx). 흰 머리줄(오른쪽 ↓ 만, 제목·‹·× 없음) · 회색 바탕 위 그림자 카드 · 바닥 '확인'.
// 들어올 때: '확인'은 제자리에서 진해지고(.70 → 1), 머리줄·카드 쪽은 거래 상세 올라오기와 같은 445ms cubic-bezier(.46,0,.17,1) 로 올라옴
//   (원본 pts 74.27~74.67 · 90.69~91.12초, 위치 RMS 11 · 14px). 쌓임은 머리줄 > '확인' > 카드 (녹화 1237~1239 머리줄이 버튼을 덮고 지나감) — kbank-receipt.css
// '확인' = 뒤로 (누름 표시 없음, 손 뗀 프레임에 바로 사라짐: 52.032 → 52.056초). ↓(내려받기)는 녹화에서 안 누름 → 무반응.
// 연습용 앱이라 카드에 옅은 '연습용 화면 · 실제 이체 아님' 무늬를 깔아 둠 (i-ONE 이체확인증 IbkCertificate 와 같은 이유 — 실제 확인증처럼 쓰이지 않게).
// 녹화에는 없음 → 겹쳐 잴 때는 .kbc-mark 를 숨김 (display: none)

const MARK = "연습용 화면 · 실제 이체 아님";
const seenKeys = new Set<string>(); // 그린 적 있는 방문 기록 칸 — 앞으로 가기로 다시 들어오면 올라오지 않음 (KbankTxDetail 과 같음)

// 표 행 가운데 y (카드 안 = 앱 y − 58.9; 카드는 59 에 놓고 글자는 kbank-receipt.css 에서 겹쳐 맞춤): 녹화 거래일시 213.2 · 거래구분 242.5 · 출금계좌 271.8 · 보낸사람 301.7 · 받는계좌 331.0 · 받는 분 360.3
// / 내 통장에 표기 401.3 · 받는 분에게 표기 433.2 · 수수료 462.5 · 추가정보 491.7 (avg_certA·B 잉크)
const ROWS_A = [154.3, 183.6, 212.9, 242.8, 272.1, 301.4];
const ROWS_B = [342.4, 374.3, 403.6, 432.8];

// 금액 숫자: 녹화 기기 글꼴의 '1' 은 고정폭이라 Pretendard 보다 좌우가 넓음 ('1 원' 이 3.3 왼쪽, 1377~1563) → '1' 만 감싸 양옆 0.12em (kbank-receipt.css .kbc-n1)
const amountDigits = (text: string) =>
  [...text].map((ch, i) =>
    ch === "1" ? (
      <span key={i} className="kbc-n1">
        1
      </span>
    ) : (
      ch
    ),
  );

function DownIcon() {
  // ↓ + 밑줄 (옆벽 없음): 선 1.45 #2e2e2f, 끝 각짐. 버튼 상자(x 326 · y 0) 안 좌표 — 대 x 350.4 y 14.8~28.0, 날개 (345.6, 23.1)·(355.0, 23.1) → 꼭지 (350.5, 28.0),
  // 받침 y 33.1 x 341.4~359.2 (프레임 2240~2330 평균 잉크 x 341.7~359.3 · y 14.3~33.8)
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <path d="M24.4 14.8V28M19.6 23.1l4.9 4.9 4.5-4.9M15.4 33.1h17.8" fill="none" stroke="#2e2e2f" strokeWidth="1.45" />
    </svg>
  );
}

export function KbankReceipt() {
  useKbankStatusBar();
  const { txId = "" } = useParams();
  const go = useKbankGo();
  const location = useLocation();
  // 앱 안에서 열었을 때만 올라오기 (주소로 바로 열거나 앞으로 가기로 다시 들어오면 그냥 보임 — 거래 상세와 같음)
  const [enter] = useState(() => location.key !== "default" && !seenKeys.has(location.key));
  useEffect(() => {
    seenKeys.delete(location.key);
    seenKeys.add(location.key);
    if (seenKeys.size > 30) seenKeys.delete(seenKeys.values().next().value as string);
  }, [location.key]);
  const detail = useApi<TransactionDetail>(paths.transaction(txId));
  const tx = detail.data;
  // 출금계좌: 거래 상세가 넘겨 준 계좌 id (거래가 오기 전에 다른 계좌를 먼저 받지 않게)
  const passedAcc = (location.state as { accountId?: string } | null)?.accountId;
  const acc = useApi<Account>(paths.account(tx?.accountId ?? passedAcc ?? "main"));
  const home = useApi<HomeData>(paths.home);

  // 확인: 거래 상세로 돌아감. 주소로 바로 열어 기록이 없으면 그 거래 상세로 바꿔 놓음 (상세는 올라오지 않고 바로 보임 — fromReceipt)
  const close = () => (window.history.state?.idx > 0 ? go(-1) : go(`/tx/${txId}`, { replace: true, state: { fromReceipt: true } }));

  const userName = home.data?.profile.userName ?? "";
  const sent = tx?.transfer;
  // 이체확인증은 출금 이체에만 (앱에서는 출금 이체 상세에만 버튼이 있음). 주소로 입금 · 체크카드 거래를 열면 찾을 수 없음으로
  const notTransfer = !!tx && (!sent || tx.amount > 0);
  const abs = Math.abs(tx?.amount ?? 0);
  // 값 (FINAL K01 '값' 표): 거래일시는 초까지(상세는 분까지), 출금계좌는 숫자만, 받는계좌는 짧은 은행 이름, 받는 분에게 표기는 없으면 내 이름, 수수료 '0원'(붙여 씀)
  const rows: [string, string][] = tx
    ? [
        ["거래일시", tx.transactedAt],
        ["거래구분", kbankKindLabel(tx.kind)],
        ["출금계좌", acc.data?.id === tx.accountId ? (acc.data.number ?? "").replace(/\D/g, "") : ""],
        ["보낸사람", userName],
        ["받는계좌", sent ? `${kbankBankShort(sent.bank, sent.number)} ${sent.number}` : ""],
        ["받는 분", sent?.holder ?? ""],
      ]
    : [];
  const rows2: [string, string][] = tx
    ? [
        ["내 통장에 표기", tx.merchant],
        ["받는 분에게 표기", tx.memoTo || userName],
        ["수수료", "0원"],
        ["추가정보", ""],
      ]
    : [];
  const logo = localAsset("kbank-wordmark");

  return (
    <div className={`kb kbc ${enter ? "kbc--enter" : ""}`}>
      <div className="kbc-page">
        <div className="kbc-bg" />
        <section className="kbc-card">
          {logo ? (
            <i className="kbc-logo" style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }} role="img" aria-label="Kbank" />
          ) : (
            <b className="kbc-logo kbc-logo--text">Kbank</b>
          )}
          <h2 className="kbc-title">이체확인증</h2>
          {notTransfer || (!tx && detail.status === "error") ? (
            <div className="kbc-fail">
              <p>{notTransfer || detail.error?.status === 404 ? "거래내역을 찾을 수 없어요" : "거래내역을 불러오지 못했어요"}</p>
              {!notTransfer && detail.error?.status !== 404 && <button onClick={detail.retry}>다시 시도</button>}
            </div>
          ) : (
            <>
              <span className="kbc-label kbc-amt__label">이체금액</span>
              {tx && (
                <>
                  <span className="kbc-amt__num">{amountDigits(kbNf.format(abs))}</span>
                  <span className="kbc-amt__won">원</span>
                </>
              )}
              <i className="kbc-line kbc-line--amt" />
              {rows.map(([label, value], i) => (
                <div key={label} className="kbc-row" style={{ transform: `translateY(${ROWS_A[i]}px)` }}>
                  <span className="kbc-label">{label}</span>
                  <span className="kbc-value">{value}</span>
                </div>
              ))}
              <i className="kbc-line kbc-line--mid" />
              {rows2.map(([label, value], i) => (
                <div key={label} className="kbc-row" style={{ transform: `translateY(${ROWS_B[i]}px)` }}>
                  <span className="kbc-label">{label}</span>
                  <span className="kbc-value">{value}</span>
                </div>
              ))}
              <i className="kbc-line kbc-line--end" />
              <p className="kbc-note">
                <span>이체확인증은 고객편의를 위하여 제공하는 것으로 거래의</span>
                <span>참고용으로만 사용할 수 있습니다.</span>
              </p>
            </>
          )}
          <div className="kbc-mark" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <p key={i}>{`${MARK}　　${MARK}　　${MARK}`}</p>
            ))}
          </div>
        </section>
      </div>
      <div className="kbc-bottom">
        <button className="kbc-ok" onClick={close}>
          <span>확인</span>
        </button>
      </div>
      <div className="kbc-head">
        <div className="kbc-head__bar">
          {/* 내려받기: 녹화에서 안 누름 → 무반응 */}
          <button className="kbc-down" aria-label="내려받기">
            <DownIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
