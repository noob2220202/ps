import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { localAsset } from "../assets/Asset";
import { kbankBankName } from "./bank";
import { Checking, KbankPair, type KbankDoneState } from "./KbankSend";
import { kbHistoryGo, kbNf } from "./sendback";
import { useKbankStatusBar } from "./theme";
import "./kbank-send.css";
import "./kbank-done.css";

// 이체 완료 (녹화 36~42초, 프레임 1081~1260). 머리줄 없음.
//   sending  보내는 중이에요 (1081~1153): 확인 화면에서 머리줄·표가 한 번에 빠지고 '확인중' 버튼이 230ms 동안 흐려지며 사라짐,
//            셋째 줄 '보낼까요?' → '보내는 중이에요' 겹쳐 바뀜(1082~1087), K › B 의 › 가 ››› 로 펼쳐져 늘었다 줄었다 함(1083~1153)
//   done     보냈어요 (1154~): 로고가 빠지고 ✓ 가 그려지며 '보냈어요', '받는계좌 | 은행 번호', 공유·메세지 보내기, 아래 의견 카드·추가이체/확인이
//            200ms 동안 떠오름(1155~1160). 말풍선 '돈을 보냈다고 알려주세요 ×' 는 470ms 뒤(1168). 메세지 앞 그림은 1.285초마다 굴러 바뀜
// 아이폰: 아래 카드·버튼은 홈 인디케이터 위로(--safe-bottom), 가운데 부품(✓ · 공유/메세지 · 말풍선)은 화면 가운데 기준이라 402 폭에서도 가운데
const SENDING_MS = 2170; // 1088 → 1153
const TIP_MS = 470; // 1154 → 1168
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
  const [phase, setPhase] = useState<"sending" | "done">("sending");
  const [tip, setTip] = useState(false);
  const [tipClosed, setTipClosed] = useState(false);
  const going = useRef(false);
  useEffect(() => {
    const a = window.setTimeout(() => setPhase("done"), SENDING_MS);
    const b = window.setTimeout(() => setTip(true), SENDING_MS + TIP_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const soon = () => {};
  const done = phase === "done";

  // 확인 → 홈. 기록 첫 칸(홈)까지 걷고, 첫 칸이 홈이 아니면 그 칸을 홈으로 바꿈 (지금 칸만 바꾸면 기록이 [홈, 계좌, 홈] 으로 남음)
  // 녹화: 확인을 떼고 바로 홈이 한 번에 (1252 → 1266, 미는 전환 없음)
  const toHome = async () => {
    if (going.current) return;
    going.current = true;
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
        <svg className="kbd-check" width="56" height="40" viewBox="0 0 56 40" aria-hidden>
          <path d="M4 18.5 20.5 34.5 52 4" fill="none" stroke="#4862f7" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <h2 className="kbs-big kbs-big--1 kbd-abs">
        <em>{to.holder}</em>님에게
      </h2>
      <h2 className="kbs-big kbs-big--2 kbd-abs">{kbNf.format(result.amount)}원을</h2>
      {done ? (
        <h2 key="sent" className="kbs-big kbs-big--3 kbd-abs kbd-in">
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
          <div className="kbd-acts kbd-up">
            <button className="kbd-share" onClick={soon} aria-label="공유">
              <svg width="20" height="21" viewBox="0 0 20 21" aria-hidden>
                <path d="M10 13.2V1.6M5.6 5.8 10 1.4l4.4 4.4M2.2 10.4v7.4a1.6 1.6 0 0 0 1.6 1.6h12.4a1.6 1.6 0 0 0 1.6-1.6v-7.4" fill="none" stroke="#3a3e42" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="kbd-msg" onClick={soon}>
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
          <button className="kbd-fb kbd-up" onClick={soon}>
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
          <div className="kbd-btns kbd-up">
            <button className="kbd-again" onClick={again}>
              추가이체
            </button>
            <button className="kbd-ok" onClick={toHome}>
              확인
            </button>
          </div>
        </>
      )}
    </div>
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
  return (
    <span className="kbd-emoji" aria-hidden>
      {n > 0 && pic(n - 1) && <img key={n - 1} className="kbd-emoji__out" src={pic(n - 1)} alt="" draggable={false} />}
      {pic(n) && <img key={n} className="kbd-emoji__in" src={pic(n)} alt="" draggable={false} />}
    </span>
  );
}
