import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { TransferRecord } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { ibkBankName, ibkNumber, nf } from "./bank";
import { IbkHeader, IbkHeaderIcon, IbkNotice } from "./common";
import { useIbkSpinner } from "./loading";
import { IbkBackButton } from "./IbkResults";
import { useIbkBack, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-menu.css";

// 이체확인증 (녹화 77.90~83.33초, spec: scratchpad/ibk/specB/menu.md 3절). 머리줄은 이체결과조회와 같음 (제목도 '이체결과조회').
// 이체확인증 제목 → 9줄 표(회색 라벨 칸 | 흰 값 칸, 피치 41.82) → 확인 문구 → 안내 2줄 → 오른쪽 IBK기업은행 로고 → 공유하기.
// 연습용 앱이라 표 위에 '연습용 화면 · 실제 이체 아님' 워터마크를 비스듬히 반복해서 깔고(옅게, 표는 그대로 보이게), 공유는 막음.
// 위치는 클론 좌표 (x = (녹화 x − 0.35) / 1.0242, 본문 y = 녹화 y − 81.4) — 값마다 ibk-menu.css 에 녹화 숫자

const BACK_MS = 500; // < 를 뗀 뒤 이체결과조회까지 (82.867 뗌 → 83.367)
const SPIN_AFTER = 300; // 기록을 못 받은 채 열렸을 때(주소로 바로 열기 등) 이만큼 지나야 점
const MARK = "연습용 화면 · 실제 이체 아님";

// 'YYYY-MM-DDTHH:mm:ss' → 'YYYY.MM.DD HH:mm:ss'
const fullTime = (at: string) => `${at.slice(0, 10).replaceAll("-", ".")} ${at.slice(11, 19)}`;

// 출금계좌는 가려서: 3-6-2-3 번호면 '123-4567**-01-***' (녹화: 둘째 묶음 끝 2자리와 넷째 묶음 전체를 *).
// 다른 길이는 뒤 5자리를 가림
function maskedNumber(number: string) {
  const d = number.replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 3)}-${d.slice(3, 7)}**-${d.slice(9, 11)}-***`;
  return d.length > 5 ? `${d.slice(0, -5)}*****` : d;
}

// .ibk-bl 의 top: 녹화 기준선 base(반올림)에 글자가 놓이게. origin = 담는 상자 위의 녹화 y (ibk-menu.css 머리 주석)
function blTop(base: number, fs: number, origin: number) {
  const a = Math.round(0.927734 * fs);
  const d = Math.round(0.244141 * fs);
  return Math.round(base) - Math.floor(a - (a + d) / 2) - origin;
}
// 표 (3-3): 위 테두리 중심 녹화 164.3 → 줄 k 칸 위 163.8 + 41.82k.
// 기준선: 숫자 값·라벨 189.35 + 41.82k (녹화 숫자 아래끝을 다시 잼: 231.1 · 273.1 · 398.5 · 524.2 — 스펙 189.7~189.8 보다 0.4 위,
// 라벨도 겹쳐 재면 같음), 한글 값 189.7 + 41.82k
const ROW_Y = (k: number) => 163.8 + 41.82 * k;
const BASE = (k: number, kind?: Kind) => (kind === "ko" ? 189.7 : 189.35) + 41.82 * k;
const VALUE_FS: Record<Kind, number> = { ko: 12.5, num: 13, amt: 12.75 };

// 값 글자 (§10): 한글만(즉시이체·이름) 12.5px / 숫자가 든 것(일시·계좌·은행 번호·0원) 13px / 이체금액 굵게
type Kind = "ko" | "num" | "amt";
const KIND_OF = (v: string): Kind => (/\d/.test(v) ? "num" : "ko");

export function IbkCertificate() {
  useIbkStatusBar();
  const { transferId = "" } = useParams();
  const go = useIbkGo();
  const back = useIbkBack("/results", BACK_MS);
  const rec = useApi<TransferRecord>(paths.transferRecord(transferId));
  // 녹화엔 점이 없음(이체결과조회가 미리 받아 둠). 주소로 바로 열었을 때처럼 오래 걸릴 때만 점
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (rec.status !== "loading") return;
    const t = window.setTimeout(() => setSlow(true), SPIN_AFTER);
    return () => window.clearTimeout(t);
  }, [rec.status]);
  useIbkSpinner(rec.status === "loading" && slow);
  const [notice, setNotice] = useState<string | null>(null);

  if (rec.status === "error")
    return (
      <div className="ibk ibk-page">
        <IbkNotice title={"아래 내용을\n확인해주세요"} message={rec.error.message || "이체 기록을 찾을 수 없어요."} consult={false} onConfirm={back} />
      </div>
    );

  const t = rec.data;
  const rows: [string, string, Kind?][] = t
    ? [
        ["거래구분", "즉시이체"],
        ["거래일시", fullTime(t.at)],
        ["출금계좌", maskedNumber(t.fromNumber)],
        ["내통장표시", t.memoMe],
        ["예금주", t.holder],
        ["입금은행", `${ibkBankName(t.bank)} ${ibkNumber(t.bank, t.number)}`],
        ["수수료", "0원"],
        ["받는분통장표시", t.memoTo],
        ["이체금액", `${nf.format(t.amount)}원`, "amt"],
      ]
    : [];
  const symbol = localAsset("ibk-ci-symbol");
  const wordmark = localAsset("ibk-cert-wordmark");

  return (
    <div className="ibk ibk-page ibc">
      <IbkHeader title="이체결과조회" left={<IbkBackButton onBack={back} />} right={<IbkHeaderIcon name="menu" label="전체메뉴" onClick={() => go("/menu", { anim: "menu-in" })} />} />
      <div className="ibk-body">
        {t && (
          <div className="ibc-content">
            <h2 className="ibk-bl ibc-title">이체확인증</h2>
            <div className="ibc-table">
              <i className="ibc-table__labels" />
              {rows.map(([label, value, kind], k) => (
                <div key={label} className="ibc-row" style={{ top: 41.82 * k }}>
                  <span className="ibk-bl ibc-row__label" style={{ top: blTop(BASE(k), 12.5, ROW_Y(k)) }}>
                    {label}
                  </span>
                  <b
                    className={`ibk-bl ibc-row__value ibc-row__value--${kind ?? KIND_OF(value)}`}
                    style={{ top: blTop(BASE(k, kind ?? KIND_OF(value)), VALUE_FS[kind ?? KIND_OF(value)], ROW_Y(k)) }}
                  >
                    {/원$/.test(value) && (kind ?? KIND_OF(value)) !== "ko" ? (
                      <>
                        {value.slice(0, -1)}
                        <small>원</small>
                      </>
                    ) : (
                      value
                    )}
                  </b>
                </div>
              ))}
              <i className="ibc-row ibc-row--end" style={{ top: 41.82 * rows.length }} />
              <div className="ibc-mark" aria-hidden>
                <div className="ibc-mark__sheet">
                  {Array.from({ length: 12 }, (_, i) => (
                    <p key={i}>{`${MARK}　　${MARK}　　${MARK}`}</p>
                  ))}
                </div>
              </div>
            </div>
            <p className="ibk-bl ibc-confirm">위의 내용이 정상적으로 이체되었음을 확인합니다.</p>
            <p className="ibc-note">위 확인증은 고객 편의를 위해 제공되는 것으로 참고용으로만 사용하실 수 있습니다.</p>
            <div className="ibc-logo" aria-label="IBK기업은행">
              {symbol && <img className="ibc-logo__symbol" src={symbol} alt="" draggable={false} />}
              {wordmark ? <img className="ibc-logo__word" src={wordmark} alt="" draggable={false} /> : <b className="ibc-logo__text">IBK기업은행</b>}
            </div>
            <div className="ibk-bottom ibc-bottom">
              <button className="ibk-btn" onClick={() => setNotice("연습용 앱에서는 공유할 수 없어요.")}>
                공유하기
              </button>
            </div>
          </div>
        )}
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
