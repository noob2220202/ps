import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { HomeData } from "../api/types";
import { paths } from "../api/endpoints";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { NhEqualsIcon, NhImg } from "./common";
import { nhWon } from "./hangul";
import type { NhDoneState } from "./NhConfirm";
import "./nh-done.css";
import "./nh-confirm-mark.css";

// 송금 완료 (녹화2 30.15~36초). 화면이 뜬 때(T0) 기준:
//   +95ms 동전이 보임(앞의 로딩 막은 +170ms에 걷힘) → +400 동전이 한 바퀴 돌고 → +1.1s 사라짐 →
//   +1.42s 청록 원이 튀어 오르며 나타남 → +1.51s "할게요"(보라)가 위로 밀려 사라지고 "했어요"가 아래에서 올라옴 →
//   +1.96s 체크 표시가 그려짐 → +2.01s 상세보기·메시지 보내기·아래 버튼이 서서히 나타남(440ms)
// 동전·체크 그림은 녹화 프레임을 이어 붙인 스프라이트(nh-done-mark.png + nh-confirm-mark.css, scripts/nh-crops/confirm.py)
export function NhDone() {
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const state = useLocation().state as NhDoneState | null;
  const home = useApi<HomeData>(paths.home);
  const [detail, setDetail] = useState(false);
  const mark = localAsset("nh-done-mark");
  useStatusBar("#18171c", "light");
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);
  if (!state) return null;
  const { result, memoTo, memoMe } = state;
  const { to, amount } = result;
  const account = home.data?.accounts.find((a) => a.id === result.fromAccountId);

  return (
    <div className="screen nh nh-dn">
      {mark ? (
        <span className="nh-dn-mark nh-dn-mark--sprite" style={{ backgroundImage: `url(${mark})` }} />
      ) : (
        <span className="nh-dn-mark nh-dn-mark--css">
          <NhImg name="nh-coin" w={60} h={64} className="nh-dn-mark__coin" fallback={<span style={{ fontSize: 44 }}>🪙</span>} />
          <span className="nh-dn-mark__check">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
        </span>
      )}
      <h2 className="nh-dn__title">
        <span>
          <b>{to.holder}</b>님에게
        </span>
        <b>{nhWon(amount)}</b>
        <b>
          송금{" "}
          <span className="nh-dn__word">
            <span className="nh-dn__did">했어요</span>
            <span className="nh-dn__will">할게요</span>
          </span>
        </b>
      </h2>
      <div className="nh-dn__late">
        <button className={`nh-dn__more ${detail ? "nh-dn__more--open" : ""}`} onClick={() => setDetail((d) => !d)}>
          상세보기
          <svg className="nh-dn__chev" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
            <path d="M9.2 6.4 14.8 12l-5.6 5.6" />
          </svg>
        </button>
        {/* 펼친 모양은 녹화에 없음 → 확인 화면에 실제로 나오는 항목만 같은 모양(남색 상자)으로 */}
        {detail && (
          <dl className="nh-dn__rows">
            <div>
              <dt>출금계좌</dt>
              <dd>
                {account?.label}
                <br />
                {account?.number}
              </dd>
            </div>
            <div>
              <dt>수수료</dt>
              <dd>면제</dd>
            </div>
            <div>
              <dt>받는계좌에 표시</dt>
              <dd>{memoTo}</dd>
            </div>
            <div>
              <dt>내계좌에 표시</dt>
              <dd>{memoMe}</dd>
            </div>
          </dl>
        )}
      </div>
      <div className="nh-dn__msg nh-dn__late">
        <p>메시지 보내기</p>
        <div>
          {(
            [
              ["card", "메시지카드"],
              ["kakao", "카카오톡"],
              ["mms", "문자(MMS)"],
            ] as const
          ).map(([k, label]) => (
            <button key={k}>
              <NhImg name={`nh-msg-${k}`} w={51.2} h={51.2} fallback={<span>💬</span>} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="nh-bottom nh-dn__bottom nh-dn__late">
        <button className="nh-btn nh-btn--line nh-btn--square" aria-label="메뉴" onClick={() => go(`/history/${result.fromAccountId}`)}>
          <NhEqualsIcon />
        </button>
        <button className="nh-btn nh-btn--outline-purple" onClick={() => go(`/send?from=${result.fromAccountId}`, { replace: true })}>
          송금계속
        </button>
        <button className="nh-btn" onClick={() => go("/")}>
          확인
        </button>
      </div>
    </div>
  );
}
