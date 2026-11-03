import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { localAsset } from "../assets/Asset";
import { kbankBankName } from "./bank";
import { Checking, KbankPair, type KbankDoneState } from "./common";
import { kbHistoryGo } from "./sendback";
import { noteKbankSent } from "./notice";
import { KbankTabBar } from "./tabbar";
import { kbNf, noop, useKbankStatusBar } from "./theme";
import "./kbank-send.css";
import "./kbank-done.css";

// 이체 완료 (녹화 36~42초, 프레임 1081~1260). 머리줄 없음.
//   sending  보내는 중이에요 (1081~1153): 확인 화면에서 머리줄·표가 한 번에 빠지고 '확인중' 버튼이 230ms 동안 흐려지며 사라짐,
//            셋째 줄 '보낼까요?' → '보내는 중이에요' 겹쳐 바뀜(1082~1087), K › B 의 › 가 ››› 로 펼쳐져 늘었다 줄었다 함(1083~1153)
//   done     보냈어요 (1154~): 로고가 빠지고 ✓ · '보냈어요' · 공유·메세지 보내기 · 의견 카드 · 추가이체/확인이 함께 310ms 동안 진해지며 올라옴
//            (요소마다 거리 다름, kbank-done.css .kbd-rise). '받는계좌 | 은행 번호' 는 바로 바뀜. 말풍선 '돈을 보냈다고 알려주세요 ×' 는
//            440ms 뒤 한 번에(38.837 → 38.862초). 메세지 앞 그림은 1.285초마다 굴러 바뀜
//   확인 → 홈: 누르자마자 홈 탭바가 화면 맨 아래 맨 위층에 고정돼 추가이체/확인을 가리고(41.761초), 약 90ms 뒤 ScreenStack pop 밀기(296ms,
//            41.78~42.08초 · 프레임 1255~1262)로 완료 화면이 오른쪽으로 빠지는 동안에도 탭바는 제자리
// 아이폰: 아래 카드·버튼은 홈 인디케이터 위로(--safe-bottom), 가운데 부품(✓ · 공유/메세지 · 말풍선)은 화면 가운데 기준이라 402 폭에서도 가운데
const SENDING_MS = 2170; // 1088 → 1153
const FLOAT_LEAD_MS = 60; // 확인 → 홈: 탭바가 고정돼 나타난 뒤 밀기가 시작되기까지 녹화 ≈90ms (41.761 → ≈41.85초) — 홈 층을 다시 그리는 한두 프레임(≈30~60ms)을 뺌
const NOTICE_MS = SENDING_MS - 220; // 상태바 'K' 알림은 '보냈어요' 0.22초 전 (38.20 · 38.42초) — notice.ts
const TIP_MS = 440; // 로고가 사라진 38.421초 → 말풍선 38.837~38.862초 (한 번에)
// '메세지 보내기' 앞 그림: 웃는 얼굴 → 네잎클로버 → 돈주머니 (녹화 1155~1254 에 보인 순서, 그 뒤는 처음부터 다시).
// 바뀌기 시작: 38.46 · 39.75 · 41.03초 (원본 프레임 시각) → 1.285초마다. 처음 것은 '보냈어요' 와 함께 아래서 올라옴
const EMOJI = ["kbank-send-smile", "kbank-send-clover", "kbank-send-bag"];
const EMOJI_MS = 1285;

export function KbankDone() {
  useKbankStatusBar();
  const state = useLocation().state as KbankDoneState | null;
  if (!state?.result) return <Navigate to="/" replace />;
  return <DoneView {...state} />;
}

function DoneView({ result, from }: KbankDoneState) {
  const navigate = useNavigate();
  const to = result.to;
  // 한 번 본 완료 화면은 기록 칸에 표시를 남김 → PC 브라우저 '앞으로' 로 다시 들어오면 '보내는 중이에요' 를 다시 돌리지 않고 '보냈어요' 부터
  const [again0] = useState(() => !!(window.history.state as { kbDone?: number } | null)?.kbDone);
  const [phase, setPhase] = useState<"sending" | "done">(again0 ? "done" : "sending");
  const [tip, setTip] = useState(false);
  const [tipClosed, setTipClosed] = useState(false);
  const [leaving, setLeaving] = useState(false); // 확인 → 홈: 탭바를 맨 위층에 고정
  const going = useRef(false);
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, kbDone: 1 }, "");
    const wait = again0 ? 0 : SENDING_MS;
    const a = window.setTimeout(() => setPhase("done"), wait);
    const b = window.setTimeout(() => setTip(true), wait + TIP_MS);
    const c = again0 ? 0 : window.setTimeout(() => noteKbankSent(result.to.bank.code), NOTICE_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
    };
  }, [again0, result]);
  const done = phase === "done";

  // 확인 → 홈. 기록 첫 칸(홈)까지 걷고, 첫 칸이 홈이 아니면 그 칸을 홈으로 바꿈 (지금 칸만 바꾸면 기록이 [홈, 계좌, 홈] 으로 남음)
  // 녹화: 누르자마자 탭바가 맨 위층에 나타나고(41.761초), 이어서 ScreenStack pop 밀기 296ms (41.78~42.08초 · 프레임 1255~1262)
  const toHome = async () => {
    if (going.current) return;
    going.current = true;
    setLeaving(true);
    await new Promise((r) => setTimeout(r, FLOAT_LEAD_MS));
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    await kbHistoryGo(-idx);
    if (window.location.pathname !== "/") navigate("/", { replace: true });
  };
  // 추가이체 → 이체 처음부터 (같은 출금 계좌)
  const again = () => {
    if (going.current) return;
    going.current = true;
    navigate(`/send?from=${encodeURIComponent(from.id)}`, { replace: true });
  };

  return (
    <div className="kb kbd">
      {!done && <KbankPair from={from.bank} to={to.bank} moving className="kbd-pair" />}
      {done && (
        // ✓ : 잉크 165.3~218.7 × 169.2~206.3 (프레임 1210), 선 굵기 ≈ 5.2
        <svg className="kbd-check kbd-rise" width="56" height="40" viewBox="0 0 56 40" aria-hidden>
          <path d="M4 18.5 20.5 34.5 52 4" fill="none" stroke="#4862f7" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <h2 className="kbs-big kbs-big--1 kbd-abs">
        <em>{to.holder}</em>님에게
      </h2>
      <h2 className="kbs-big kbs-big--2 kbd-abs">{kbNf.format(result.amount)}원을</h2>
      {done ? (
        <h2 key="sent" className="kbs-big kbs-big--3 kbd-abs kbd-sent kbd-rise">
          보냈어요
        </h2>
      ) : (
        <>
          <h2 key="q" className="kbs-big kbs-big--3 kbd-abs kbd-out">
            보낼까요?
          </h2>
          <h2 key="ing" className="kbs-big kbs-big--3 kbd-abs kbd-in kbd-in--late">
            보내는 중이에요
          </h2>
        </>
      )}
      {done ? (
        <p className="kbs-sub kbd-abs kbd-rcv">
          받는계좌
          <i />
          {`${kbankBankName(to.bank, to.number)} ${to.number}`}
        </p>
      ) : (
        <p className="kbs-sub kbd-abs">{`${kbankBankName(to.bank, to.number)} ${to.number}로 보내요`}</p>
      )}
      {/* 확인 화면의 '확인중' 버튼이 흐려지며 사라짐 (1081~1088) */}
      {!done && (
        <div className="kbs-bottom kbd-leave">
          <span className="kbs-btn kbs-btn--check kbd-leave__btn">
            <Checking />
          </span>
        </div>
      )}
      {done && (
        <>
          <div className="kbd-acts kbd-rise">
            <button className="kbd-share" onClick={noop} aria-label="공유">
              <svg width="20" height="21" viewBox="0 0 20 21" aria-hidden>
                <path d="M10 13.2V1.6M5.6 5.8 10 1.4l4.4 4.4M2.2 10.4v7.4a1.6 1.6 0 0 0 1.6 1.6h12.4a1.6 1.6 0 0 0 1.6-1.6v-7.4" fill="none" stroke="#3a3e42" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="kbd-msg" onClick={noop}>
              <MsgEmoji />
              메세지 보내기
            </button>
          </div>
          {tip && !tipClosed && (
            <div className="kbd-tip">
              <span>돈을 보냈다고 알려주세요</span>
              <button onClick={() => setTipClosed(true)} aria-label="닫기">
                {/* × 잉크 289.6~300.7 × 490.1~500.5 (프레임 1170~1189) */}
                <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                  <path d="M2.1 2.1l8.8 8.8M10.9 2.1l-8.8 8.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
          <button className="kbd-fb kbd-rise" onClick={noop}>
            {/* 연필(뚜껑 떨어짐) + 끝 오른쪽 밑줄: 잉크 43.0~62.5 × 648.2~667.1, 몸통 폭 6.9 (프레임 1170~1189, 몸통 #565c64 · 밑줄 #b0b4c0) */}
            <svg className="kbd-fb__pen" width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <path d="M2.03 19.91V15.03L12.13 4.94 17.33 9.5 6.92 19.91Z" fill="#565c64" />
              <path d="M12.59 4.48 14.57 2.5A3.46 3.46 0 0 1 19.77 7.06L17.79 9.04Z" fill="#565c64" />
              <path d="M9.85 19.75H21.1" stroke="#b0b4c0" strokeWidth="1.63" />
            </svg>
            <span className="kbd-fb__small">케이뱅크 이체하기</span>
            <b className="kbd-fb__big">고객님의 의견이 궁금해요</b>
            <svg className="kbd-fb__gt" width="8" height="14" viewBox="0 0 8 14" aria-hidden>
              <path d="M1.3 1.3 6.6 7l-5.3 5.7" fill="none" stroke="#5a5f66" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="kbd-btns kbd-rise">
            <button className="kbd-again" onClick={again}>
              추가이체
            </button>
            <button className="kbd-ok" onClick={toHome}>
              확인
            </button>
          </div>
        </>
      )}
      {leaving && <FloatingTabBar />}
    </div>
  );
}

// 확인 → 홈 동안 홈 탭바를 폰 화면(.phone__viewport) 맨 위층에 고정 (z 가 화면 층보다 큼, 홈과 같은 자리).
// 완료 층이 밀려 나가 사라질 때 함께 사라지고, 그동안 홈 층 안의 탭바는 숨김 (kbank-done.css .kbd-tabfloat)
function FloatingTabBar() {
  const [host] = useState(() => document.querySelector(".phone__viewport"));
  if (!host) return null;
  return createPortal(
    <div className="kbd-tabfloat" aria-hidden>
      <KbankTabBar active="홈" />
    </div>,
    host,
  );
}

// 위로 굴러 바뀌는 그림 (프레임 1193~1205 · 1231~1243): 21.5 × 23.4 칸 안에서 나가는 것은 위로 밀리며 흐려지고(≈130ms),
// 들어오는 것은 아래에서 올라오며 진해짐(≈260ms, 70ms 늦게). 칸 밖은 잘림 (녹화 잉크가 칸 위·아래 끝 426.3 · 443.2 에서 잘림)
function MsgEmoji() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((v) => v + 1), EMOJI_MS);
    return () => clearInterval(t);
  }, []);
  const pic = (i: number) => localAsset(EMOJI[i % EMOJI.length]);
  // 그림마다 잉크 상자로 다듬어 자리가 다름 (kbank-done.css .kbd-emoji--smile …)
  const kind = (i: number) => `kbd-emoji--${EMOJI[i % EMOJI.length].replace("kbank-send-", "")}`;
  return (
    <span className="kbd-emoji" aria-hidden>
      {n > 0 && pic(n - 1) && <img key={n - 1} className={`kbd-emoji__out ${kind(n - 1)}`} src={pic(n - 1)} alt="" draggable={false} />}
      {pic(n) && <img key={n} className={`kbd-emoji__in ${kind(n)}`} src={pic(n)} alt="" draggable={false} />}
    </span>
  );
}
