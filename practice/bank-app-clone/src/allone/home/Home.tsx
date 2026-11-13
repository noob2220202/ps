// [기초 단계 자리 — home 영역이 이 파일을 진짜 홈(머리줄 · 배너 · NH농협/다른금융 카드 · 오늘의 혜택 · 탭 바 · 뼈대 · 정기점검 시트)으로 바꿈]
// 지금은 앱을 돌아다닐 수 있게만: "<이름>님", 계좌 목록(거래내역 · 이체), 🔔 = 관리 패널, ≡ = 전체메뉴
import { useState } from "react";
import { useApi } from "../../api/useApi";
import { DevPanel } from "../../dev-panel/DevPanel";
import { useStatusBar } from "../../hooks/useStatusBar";
import { aoPaths, isAoNh, type AoHome } from "../api";
import { aoBankName } from "../bank";
import { useAoFlow } from "../flow";
import { aoAccountNumber, aoWon } from "../format";

export function Home() {
  useStatusBar("#ffffff", "dark");
  const home = useApi<AoHome>(aoPaths.home);
  const flow = useAoFlow();
  const [panel, setPanel] = useState(false);
  const name = home.data?.profile.userName ?? "";
  return (
    <div className="ao-stub">
      <header className="ao-stub__head ao-stub__head--home">
        <h1 className="ao-stub__title ao-stub__title--left">{name ? `${name}님` : ""}</h1>
        <button className="ao-stub__icon" aria-label="알림 (관리 패널)" onClick={() => setPanel(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
            <path d="M6 10a6 6 0 0 1 12 0v4.5l1.6 2.5H4.4L6 14.5Z" />
            <path d="M10 19.5a2 2 0 0 0 4 0" />
          </svg>
        </button>
        <button className="ao-stub__icon" aria-label="전체메뉴" onClick={() => void flow.goMenu()}>
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="#000" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M4 6.5h16M4 12h16M4 17.5h16" />
          </svg>
        </button>
      </header>
      <div className="ao-stub__body">
        <p className="ao-stub__sub">home · / (기초 단계 자리)</p>
        {home.data?.accounts.map((a) => (
          <div key={a.id} className="ao-stub__card">
            <strong>{a.label}</strong>
            <small>
              {aoBankName(a.bank)} {aoAccountNumber(a)}
              {a.limited ? " · 한도제한" : ""}
            </small>
            <span className="ao-stub__bal">{aoWon(a.balance)}</span>
            <div className="ao-stub__row">
              <button className="ao-stub__link" onClick={() => void flow.goHistory(a.id)}>
                거래내역
              </button>
              {isAoNh(a) ? (
                <button className="ao-stub__link" onClick={() => void flow.goSend({ from: a.id, origin: "home" })}>
                  이체
                </button>
              ) : (
                <button className="ao-stub__link" onClick={() => void flow.goTopup({ to: "main", from: a.id, origin: "card" })}>
                  잔액채우기
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <DevPanel open={panel} onClose={() => setPanel(false)} />
    </div>
  );
}
