import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import type { TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { Icon } from "../components/icons/Icon";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { NhImg, NhShareIcon } from "./common";
import { nhWon } from "./hangul";
import "./nh-txdetail.css";

const MEMO_CHIPS = ["용돈", "식비", "회비", "생활비", "교통비", "월세"];

// 거래 상세 (스크린샷 2026-10-28 9:48): 거래메모(0/20) + 거래정보, 출금이면 입금은행·계좌와 빠른송금 등록/동일내역 송금
export function NhTxDetail() {
  const { txId = "" } = useParams();
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const tx = useApi<TransactionDetail>(paths.transaction(txId));
  const [memo, setMemo] = useState<string | null>(null); // null = 아직 안 고침 (서버 값 그대로)
  const [copied, setCopied] = useState(false);
  useStatusBar("#18171c", "light");
  const t = tx.data;
  const value = memo ?? t?.memo ?? "";

  // 입력이 0.5초 멈추면 저장
  useEffect(() => {
    if (memo === null || !t || memo === (t.memo ?? "")) return;
    const id = setTimeout(() => api.updateMemo(t.id, memo).catch(() => {}), 500);
    return () => clearTimeout(id);
  }, [memo, t]);

  if (!t) return <div className="screen nh" />;
  const out = t.amount < 0;
  const sendAgain = () => t.transfer && go(`/send?from=${t.accountId}&bank=${t.transfer.bank.code}&number=${t.transfer.number}`);

  return (
    <div className="screen nh nh-txd">
      <header className="nh-header">
        <span className="nh-header__right">
          <button className="nh-icon-btn" aria-label="닫기" onClick={() => navigate(-1)}>
            <Icon name="close" size={26} stroke={1.6} />
          </button>
        </span>
      </header>
      <div className="nh-txd__body">
        <p className="nh-txd__who">{t.merchant}</p>
        <p className={`nh-txd__amount ${out ? "" : "in"}`}>
          {out ? "출금" : "입금"} {nhWon(Math.abs(t.amount))}
        </p>
        <div className="nh-txd__memo">
          <input value={value} maxLength={20} placeholder="거래메모를 입력해 주세요" onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div className="nh-txd__count">{value.length}/20</div>
        <div className="nh-txd__chips">
          {MEMO_CHIPS.map((c) => (
            <button key={c} className={value === c ? "on" : ""} onClick={() => setMemo(c)}>
              {c}
            </button>
          ))}
        </div>

        <h3 className="nh-txd__title">거래정보</h3>
        <dl className="nh-rows nh-txd__rows">
          <div className="nh-row">
            <dt>거래일시</dt>
            <dd>{t.transactedAt}</dd>
          </div>
          <div className="nh-row">
            <dt>거래내용</dt>
            <dd>
              {t.merchant}
              <small>
                '{t.merchant}' 검색 <Icon name="chevron-right" size={14} stroke={1.8} />
              </small>
            </dd>
          </div>
          <div className="nh-row">
            <dt>거래금액</dt>
            <dd>
              <span className={out ? "nh-red" : "nh-blue"}>
                {out ? "출금" : "입금"} {nhWon(Math.abs(t.amount))}
              </span>
              <small>+ MY 소비기록 추가</small>
            </dd>
          </div>
          <div className="nh-row">
            <dt>거래 후 잔액</dt>
            <dd>{nhWon(t.balanceAfter)}</dd>
          </div>
          {t.transfer && (
            <>
              <div className="nh-row">
                <dt>입금은행</dt>
                <dd>{t.transfer.bank.name}</dd>
              </div>
              <div className="nh-row">
                <dt>입금계좌</dt>
                <dd>
                  <span>
                    {t.transfer.number}{" "}
                    <button
                      className="nh-copy"
                      onClick={() => {
                        navigator.clipboard?.writeText(t.transfer!.number).catch(() => {});
                        setCopied(true);
                      }}
                    >
                      {copied ? "복사됨" : "복사"}
                    </button>
                  </span>
                  <small>+ 자주쓰는계좌로 추가</small>
                </dd>
              </div>
            </>
          )}
        </dl>
        {t.transfer && (
          <div className="nh-txd__actions">
            <button onClick={sendAgain}>
              <NhImg name="nh-quick-register" w={48} h={48} fallback={<span>⚡</span>} />
              빠른송금 등록
            </button>
            <button onClick={sendAgain}>
              <NhImg name="nh-same-send" w={48} h={48} fallback={<span>🔁</span>} />
              동일내역 송금
            </button>
          </div>
        )}
      </div>
      <div className="nh-bottom">
        <button className="nh-btn nh-btn--line nh-btn--square" aria-label="공유">
          <NhShareIcon />
        </button>
        <button className="nh-btn" onClick={() => navigate(-1)}>
          확인
        </button>
      </div>
    </div>
  );
}
