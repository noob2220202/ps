import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import { http } from "../api/client";
import type { Payee, TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog } from "../components/Sheet";
import { useNhGo } from "./loading";
import { NhHeader, NhImg, NhShareIcon } from "./common";
import { nhWon } from "./hangul";
import "./nh-txdetail.css";
import { NH_LIGHT, useNhStatusBar } from "./theme";

// 거래메모 칩. 앞의 셋은 스크린샷 그대로, 나머지는 ⌄ 로 펼쳤을 때 (실제 목록은 확인 못 함)
const MEMO_CHIPS = ["식비", "생활/마트", "경조사/모임", "쇼핑", "교통", "주거/통신", "의료/건강", "문화/여가", "교육", "용돈"];
const MEMO_MAX = 20;
const digitsOf = (s: string) => s.replace(/\D/g, "");

// 거래 상세 (스크린샷 2026-10-28 9:48, 녹화2 43.5~53초)
// 위: 이름 · ±금액 [복사] → 거래메모 ? · 칩(가로 스크롤 + ⌄) · 메모 칸 0/20 → 거래정보 표
// 출금 이체면 입금은행·입금계좌 + 빠른송금 등록/동일내역 송금. 헤더(X)와 아래 버튼 줄은 고정, 가운데만 스크롤
// 데이터가 오기 전·못 받았을 때도 헤더(X)와 버튼 줄은 그대로 그림 (빈 화면에 갇히지 않게)
export function NhTxDetail() {
  const { txId = "" } = useParams();
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const tx = useApi<TransactionDetail>(paths.transaction(txId));
  const payees = useApi<Payee[]>(paths.payees);
  // 처음 그릴 때 이미 데이터가 있으면(미리 받아 둠) 그대로, 없었으면 도착할 때 내용만 80ms 페이드인
  const [late] = useState(() => tx.data === undefined);
  const [memo, setMemo] = useState<string | null>(null); // null = 아직 안 고침 (서버 값 그대로)
  const [chipsOpen, setChipsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useNhStatusBar("#18171c");
  const t = tx.data;
  const value = memo ?? t?.memo ?? "";

  // 입력이 0.5초 멈추면 저장
  useEffect(() => {
    if (memo === null || !t || memo === (t.memo ?? "")) return;
    const id = setTimeout(() => api.updateMemo(t.id, memo).catch(() => {}), 500);
    return () => clearTimeout(id);
  }, [memo, t]);

  // X·확인: 앱 안에서 열었으면 뒤로, 주소로 바로 열었으면(돌아갈 기록 없음) 그 계좌 거래내역으로
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(t ? `/history/${t.accountId}` : "/", { replace: true });
  };

  const out = (t?.amount ?? 0) < 0;
  const amount = t ? `${out ? "-" : "+"}${nhWon(Math.abs(t.amount))}` : "";
  const tr = t?.transfer;
  // 받은 계좌가 이미 받는 분 목록에 있는지 (자주쓰는계좌 여부)
  const findPayee = (list?: Payee[]) => tr && list?.find((p) => p.bank.code === tr.bank.code && digitsOf(p.number) === digitsOf(tr.number));

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
  // 동일내역 송금: 같은 은행·계좌·금액으로 콕송금
  const sendAgain = () => t && tr && go(`/send?from=${t.accountId}&bank=${tr.bank.code}&number=${digitsOf(tr.number)}&amount=${Math.abs(t.amount)}`);
  // 받은 계좌를 자주쓰는계좌(즐겨찾기)로: 등록된 받는 분이면 별표만, 아니면 등록 후 별표
  const addFavorite = async () => {
    if (!tr) return;
    try {
      const payee = findPayee(payees.data ?? (await http.get<Payee[]>(paths.payees)));
      if (payee?.favorite) return setNotice("이미 자주쓰는계좌로 등록된 계좌예요.");
      const p = payee ?? (await api.addPayee({ bankCode: tr.bank.code, number: digitsOf(tr.number), holder: tr.holder }));
      await api.updatePayee(p.id, { favorite: true });
      setNotice("자주쓰는계좌로 추가했어요.");
    } catch {
      setNotice("자주쓰는계좌로 추가하지 못했어요."); // 내 계좌 등은 등록 안 됨
    }
  };
  // 공유: 기기 공유 창, 없으면 거래 요약을 복사
  const share = async () => {
    if (!t) return;
    const text = `[NH콕뱅크 거래정보]\n${t.merchant} ${amount}\n거래일시 ${t.transactedAt}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice("거래정보를 복사했어요.");
      }
    } catch {
      /* 공유 창을 닫음 */
    }
  };

  return (
    <div className="screen nh nh-txd">
      <NhHeader onClose={close} />
      {t ? (
        <div key="body" className={`nh-txd__scroll ${late ? "nh-txd__scroll--in" : ""}`}>
          <p className="nh-txd__who">{t.merchant}</p>
          <div className="nh-txd__amount">
            <span>{amount}</span>
            <button className="nh-txd__tag" onClick={() => copy(amount)}>
              복사
            </button>
          </div>

          <h3 className="nh-txd__h nh-txd__h--memo">
            거래메모
            <button className="nh-txd__q" aria-label="거래메모 안내" onClick={() => setNotice(`거래메모는 ${MEMO_MAX}자까지 입력할 수 있어요.`)}>
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
          <div className="nh-txd__memo-box">
            <textarea
              className="nh-txd__memo"
              value={value}
              maxLength={MEMO_MAX}
              rows={2}
              placeholder="거래메모 선택 또는 입력"
              onChange={(e) => setMemo(e.target.value.replace(/\n/g, ""))}
            />
          </div>
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
                <button className="nh-txd__sub nh-txd__search" onClick={() => go(`/history/${t.accountId}?q=${encodeURIComponent(t.merchant)}`)}>
                  '{t.merchant}' 검색
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M7.3 4.4 12.9 10l-5.6 5.6" />
                  </svg>
                </button>
              </dd>
            </div>
            <div className={`nh-txd__row ${out ? "nh-txd__row--add" : ""}`}>
              <dt>거래금액</dt>
              <dd>
                <span className={out ? "nh-red" : "nh-blue"}>
                  {out ? "출금" : "입금"} {nhWon(Math.abs(t.amount))}
                </span>
                {/* MY 소비기록은 우리 데이터에 없는 기능이라 모양만 */}
                {out && <button className="nh-txd__sub nh-txd__add">+ MY 소비기록 추가</button>}
              </dd>
            </div>
            <div className="nh-txd__row">
              <dt>거래 후 잔액</dt>
              <dd>{nhWon(t.balanceAfter)}</dd>
            </div>
            {tr && (
              <>
                <div className="nh-txd__row">
                  <dt>입금은행</dt>
                  <dd>{tr.bank.name}</dd>
                </div>
                <div className="nh-txd__row nh-txd__row--acct">
                  <dt>입금계좌</dt>
                  <dd>
                    <span className="nh-txd__acct">
                      <span className="nh-txd__num">{tr.number}</span>
                      <button className="nh-txd__tag" onClick={() => copy(digitsOf(tr.number))}>
                        복사
                      </button>
                    </span>
                    <button className="nh-txd__sub nh-txd__add" onClick={addFavorite}>
                      + 자주쓰는계좌로 추가
                    </button>
                  </dd>
                </div>
              </>
            )}
          </dl>
          {tr && (
            <div className="nh-txd__actions">
              {/* 빠른송금(금액까지 저장해 두는 송금)은 우리 데이터에 없는 기능이라 모양만 */}
              <button className="nh-txd__quick">
                <NhImg name={NH_LIGHT ? "nh-quick-register-light" : "nh-quick-register"} w={48} h={48} fallback={<span>⚡</span>} />
                빠른송금 등록
              </button>
              <button className="nh-txd__same" onClick={sendAgain}>
                <NhImg name={NH_LIGHT ? "nh-same-send-light" : "nh-same-send"} w={48} h={48} fallback={<span>₩</span>} />
                동일내역 송금
              </button>
            </div>
          )}
        </div>
      ) : (
        <div key="wait" className="nh-txd__scroll">
          {tx.status === "error" && (
            <div className="nh-txd__error" role="alert">
              <p>{tx.error.status === 404 ? "거래내역을 찾을 수 없어요." : "거래내역을 불러오지 못했어요."}</p>
              {tx.error.status !== 404 && (
                <button className="nh-txd__tag" onClick={tx.retry}>
                  다시 시도
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {/* 버튼 줄은 스크롤 밖에 고정 (스크롤 끝에서도 위치가 안 바뀜) */}
      <div className="nh-bottom nh-txd__bottom">
        <button className="nh-btn nh-btn--line nh-btn--square" aria-label="공유" onClick={share}>
          <NhShareIcon />
        </button>
        <button className="nh-btn" onClick={close}>
          확인
        </button>
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

// 거래메모 옆 ? : 지름 18.13dp(34px@720) #606e7c 동그라미 + 어두운 '?' 글자 (실제도 글꼴 글자 모양)
function QuestionIcon() {
  return (
    <span className="nh-txd__qmark" aria-hidden>
      ?
    </span>
  );
}
