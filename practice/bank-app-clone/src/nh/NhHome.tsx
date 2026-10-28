import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { Icon } from "../components/icons/Icon";
import { DevPanel } from "../dev-panel/DevPanel";
import { useStatusBar } from "../hooks/useStatusBar";
import { LockIcon, NhImg } from "./common";
import { nhWon } from "./hangul";

let tooltipClosed = false; // "콕! 눌러 캐릭터를 바꿔보세요" 한 번 닫으면 이번 세션 동안 안 보임

// 콕뱅크 홈 (스크린샷 2026-10-28 9:48): 대표계좌 잔액, 캐릭터, 콕송금/내계좌조회/콕조르기/콕더치페이, 지식콕·금융콕, 배너
export function NhHome() {
  useStatusBar("#18171c", "light");
  const navigate = useNavigate();
  const home = useApi<HomeData>(paths.home);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tip, setTip] = useState(!tooltipClosed);
  const [poke, setPoke] = useState(0);
  const main = home.data?.accounts.find((a) => a.kind === "main");

  return (
    <div className="nh">
      <div className="screen nh nh-home">
        <div className="nh-home__top">
          <button className="nh-icon-btn" aria-label="MY">
            <MyIcon />
          </button>
          <button className="nh-icon-btn" aria-label="관리 패널" onClick={() => setPanelOpen(true)}>
            <Icon name="bell" size={23} stroke={1.7} />
          </button>
          <button className="nh-icon-btn" aria-label="메뉴" onClick={() => navigate("/accounts")}>
            <Icon name="menu" size={24} stroke={1.7} />
          </button>
        </div>

        <div className="nh-home__account">
          <button className="nh-home__name" onClick={() => main && navigate(`/history/${main.id}`)}>
            {main?.label ?? " "} <Icon name="chevron-down" size={18} stroke={2} />
          </button>
          <span className="nh-home__tools">
            <button className="nh-icon-btn" aria-label="새로고침" onClick={home.retry}>
              <RefreshIcon />
            </button>
            <button className="nh-icon-btn" aria-label="더보기">
              <MoreIcon />
            </button>
          </span>
        </div>
        <button className="nh-home__balance" onClick={() => main && navigate(`/history/${main.id}`)}>
          <span className="nh-lock">
            <LockIcon size={17} />
          </span>
          {main ? nhWon(main.balance) : " "}
        </button>

        <div className="nh-home__hero">
          <NhImg name="nh-hero" w={360} h={211} className={`nh-home__char ${poke ? "poke" : ""}`} fallback={<span className="nh-home__char-fallback">👻</span>} />
          {/* 캐릭터 누르면 통통 (실제 앱은 캐릭터가 바뀜) */}
          <button className="nh-home__char-hit" aria-label="캐릭터" onClick={() => setPoke((n) => n + 1)} key={poke} />
          {tip && (
            <div className="nh-home__tip">
              <span>😊</span>
              <b>콕!</b> 눌러 캐릭터를 바꿔보세요.
              <button
                aria-label="닫기"
                onClick={() => {
                  tooltipClosed = true;
                  setTip(false);
                }}
              >
                <Icon name="close" size={14} stroke={2.2} />
              </button>
            </div>
          )}
        </div>

        <nav className="nh-home__menu">
          {(
            [
              ["send", "콕송금", () => main && navigate(`/send?from=${main.id}`), "⚡"],
              ["myaccount", "내계좌조회", () => navigate("/accounts"), "🏦"],
              ["poke", "콕조르기", undefined, "💙"],
              ["dutch", "콕더치페이", undefined, "➗"],
            ] as const
          ).map(([key, label, onClick, emoji]) => (
            <button key={key} onClick={onClick}>
              <NhImg name={`nh-menu-${key}`} w={27} h={29} fallback={<span>{emoji}</span>} />
              {label}
            </button>
          ))}
        </nav>

        <div className="nh-home__koks">
          <button className="nh-kok">
            <b>지식콕!</b>
            <NhImg name="nh-kok-bulb" w={65} h={60} className="nh-kok__img" fallback={<span>💡</span>} />
          </button>
          <button className="nh-kok">
            <b>금융콕!</b>
            <NhImg name="nh-kok-pig" w={62} h={60} className="nh-kok__img" fallback={<span>🐷</span>} />
          </button>
        </div>

        <button className="nh-home__banner">
          <span>
            <small>이건 못 참지!</small>
            <b>
              꿀이자 예·적금으로
              <br />
              FLEX~
            </b>
          </span>
          <NhImg name="nh-banner-char" w={127} h={101} fallback={<span style={{ fontSize: 40 }}>😎</span>} />
        </button>

        <p className="nh-home__bgset">
          배경색상 설정 <i />
        </p>
      </div>
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

function MyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="13" cy="8" r="4" />
      <path d="M5 21c0-4 3.5-6.5 8-6.5" strokeLinecap="round" />
      <text x="15" y="23" fill="currentColor" stroke="none" fontSize="7" fontWeight="700">
        MY
      </text>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}
