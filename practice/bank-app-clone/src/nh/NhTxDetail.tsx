import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import { http } from "../api/client";
import type { Payee, TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { NhHeader, NhImg, NhShareIcon } from "./common";
import { nhWon } from "./hangul";
import "./nh-txdetail.css";

// 거래메모 칩. 앞의 셋은 스크린샷 그대로, 나머지는 ⌄ 로 펼쳤을 때 (실제 목록은 확인 못 함)
const MEMO_CHIPS = ["식비", "생활/마트", "경조사/모임", "쇼핑", "교통", "주거/통신", "의료/건강", "문화/여가", "교육", "용돈"];
const MEMO_MAX = 20;

// 거래 상세 (스크린샷 2026-10-28 9:48, 녹화2 43.5~53초)
// 위: 이름 · ±금액 [복사] → 거래메모 ? · 칩(가로 스크롤 + ⌄) · 메모 칸 0/20 → 거래정보 표
// 출금 이체면 입금은행·입금계좌 + 빠른송금 등록/동일내역 송금. 헤더(X)와 아래 버튼 줄은 고정, 가운데만 스크롤
export function NhTxDetail() {
  const { txId = "" } = useParams();
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const tx = useApi<TransactionDetail>(paths.transaction(txId));
  const [memo, setMemo] = useState<string | null>(null); // null = 아직 안 고침 (서버 값 그대로)
  const [chipsOpen, setChipsOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
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
  const amount = `${out ? "-" : "+"}${nhWon(Math.abs(t.amount))}`;
  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
  const sendAgain = () => t.transfer && go(`/send?from=${t.accountId}&bank=${t.transfer.bank.code}&number=${t.transfer.number}`);
  // 받은 계좌를 자주쓰는계좌(즐겨찾기)로: 등록된 받는 분이면 별표만, 아니면 등록 후 별표
  const addFavorite = async () => {
    const tr = t.transfer;
    if (!tr || favorite) return;
    try {
      const digits = tr.number.replace(/\D/g, "");
      const list = await http.get<Payee[]>(paths.payees);
      const found = list.find((p) => p.bank.code === tr.bank.code && p.number.replace(/\D/g, "") === digits);
      const payee = found ?? (await api.addPayee({ bankCode: tr.bank.code, number: digits, holder: tr.holder }));
      await api.updatePayee(payee.id, { favorite: true });
      setFavorite(true);
    } catch {
      /* 내 계좌 등은 등록 안 됨 */
    }
  };

  return (
    <div className="screen nh nh-txd">
      <NhHeader onClose={() => navigate(-1)} />
      <div className="nh-txd__scroll">
        <p className="nh-txd__who">{t.merchant}</p>
        <div className="nh-txd__amount">
          <span>{amount}</span>
          <button className="nh-txd__tag" onClick={() => copy(amount)}>
            복사
          </button>
        </div>

        <h3 className="nh-txd__h nh-txd__h--memo">
          거래메모
          <button className="nh-txd__q" aria-label="거래메모 안내">
            <QuestionIcon />
          </button>
        </h3>
        <div className={`nh-txd__chips ${chipsOpen ? "open" : ""}`}>
          <div className="nh-txd__chip-list">
            {MEMO_CHIPS.map((c) => (
              <button key={c} onClick={() => setMemo(c)}>
                {c}
              </button>
            ))}
          </div>
          <span className="nh-txd__more-wrap">
            <button className="nh-txd__more" aria-label={chipsOpen ? "접기" : "펼치기"} aria-expanded={chipsOpen} onClick={() => setChipsOpen((o) => !o)}>
              <svg width="12.4" height="7.2" viewBox="0 0 12.4 7.2" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M0.75 0.75 6.2 6.2 11.65 0.75" />
              </svg>
            </button>
          </span>
        </div>
        <textarea
          className="nh-txd__memo"
          value={value}
          maxLength={MEMO_MAX}
          rows={2}
          placeholder="거래메모 선택 또는 입력"
          onChange={(e) => setMemo(e.target.value.replace(/\n/g, ""))}
        />
        <div className="nh-txd__count">
          {value.length}/{MEMO_MAX}
        </div>

        <h3 className="nh-txd__h nh-txd__h--info">거래정보</h3>
        <dl className="nh-txd__rows">
          <div className="nh-txd__row">
            <dt>거래일시</dt>
            <dd className="nh-txd__num">{t.transactedAt}</dd>
          </div>
          <div className="nh-txd__row">
            <dt>거래내용</dt>
            <dd>
              {t.merchant}
              <button className="nh-txd__sub nh-txd__search">
                '{t.merchant}' 검색
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M7.3 4.4 12.9 10l-5.6 5.6" />
                </svg>
              </button>
            </dd>
          </div>
          <div className="nh-txd__row">
            <dt>거래금액</dt>
            <dd>
              <span className={out ? "nh-red" : "nh-blue"}>
                {out ? "출금" : "입금"} {nhWon(Math.abs(t.amount))}
              </span>
              {out && <button className="nh-txd__sub nh-txd__add">+ MY 소비기록 추가</button>}
            </dd>
          </div>
          <div className="nh-txd__row">
            <dt>거래 후 잔액</dt>
            <dd>{nhWon(t.balanceAfter)}</dd>
          </div>
          {t.transfer && (
            <>
              <div className="nh-txd__row">
                <dt>입금은행</dt>
                <dd>{t.transfer.bank.name}</dd>
              </div>
              <div className="nh-txd__row">
                <dt>입금계좌</dt>
                <dd>
                  <span className="nh-txd__acct">
                    <span className="nh-txd__num">{t.transfer.number}</span>
                    <button className="nh-txd__tag" onClick={() => copy(t.transfer!.number)}>
                      복사
                    </button>
                  </span>
                  <button className="nh-txd__sub nh-txd__add" onClick={addFavorite}>
                    {favorite ? "자주쓰는계좌로 추가됨" : "+ 자주쓰는계좌로 추가"}
                  </button>
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
              <NhImg name="nh-same-send" w={48} h={48} fallback={<span>₩</span>} />
              동일내역 송금
            </button>
          </div>
        )}
      </div>
      {/* 버튼 줄은 스크롤 밖에 고정 (스크롤 끝에서도 위치가 안 바뀜) */}
      <div className="nh-bottom nh-txd__bottom">
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

// 거래메모 옆 ? (지름 18.7dp 회색 동그라미 + 어두운 물음표)
function QuestionIcon() {
  return (
    <svg width="18.67" height="18.67" viewBox="0 0 18.67 18.67" aria-hidden>
      <circle cx="9.33" cy="9.33" r="9.33" fill="#606e7c" />
      <path d="M7.75 7.4C7.75 6 8.9 5.25 10.4 5.25S13.05 6 13.05 7.15c0 1.05-.8 1.55-1.55 2.05-.75.5-1.2 1-1.2 1.75v.6" fill="none" stroke="#18171c" strokeWidth="1.5" />
      <circle cx="10.4" cy="13.3" r="0.88" fill="#18171c" />
    </svg>
  );
}
