import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/endpoints";
import { Dialog } from "../components/Sheet";
import { hanaBankName, hanaNumber, nf } from "./bank";
import { ChevronDown, HanaHeader, HomeIcon, StarIcon } from "./common";
import type { HanaDoneState } from "./HanaSend";
import { useHanaStatusBar } from "./theme";
import "./hana-done.css";

// 이체 완료 (라이트 녹화 41~48초): 초록 체크(연민트 원)가 그려지고 "지역농축협 ○○○ 님에게 1원을 이체했어요".
// ☆ · 추가메모 · 자동이체 등록 칩, 입금계좌 / 출금계좌, 펼치기 ⌄, 아래 [공유] [거래내역 조회]. 오른쪽 위 ⌂ 는 홈
export function HanaDone() {
  const navigate = useNavigate();
  const state = useLocation().state as HanaDoneState | null;
  const [open, setOpen] = useState(false);
  const [star, setStar] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useHanaStatusBar();
  if (!state) return <Navigate to="/" replace />;
  const { result, fromNumber, memoTo, memoMe } = state;
  const to = result.to;
  const bankName = hanaBankName(to.bank, to.number);
  const toggleStar = () => {
    setStar((s) => !s);
    if (to.payeeId) api.updatePayee(to.payeeId, { favorite: !star }).catch(() => undefined);
  };
  return (
    <div className="screen hana hana-done">
      <HanaHeader
        right={
          <button className="hana-header__icon" onClick={() => navigate("/", { replace: true })} aria-label="홈">
            <HomeIcon />
          </button>
        }
      />
      <div className="hd-check" aria-hidden>
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="31.2" />
          <path d="m20.5 32.5 7.8 7.8 15.2-15.6" />
        </svg>
      </div>
      <h2 className="hd-title">
        <em>
          {bankName} {to.holder}
        </em>{" "}
        님에게
        <br />
        <em>{nf.format(result.amount)}원</em>을 이체했어요
      </h2>
      <div className="hd-chips">
        <button className="hana-chip hd-star" onClick={toggleStar} aria-label="자주쓰는 이체">
          <StarIcon on={star} size={21} />
        </button>
        <button className="hana-chip" onClick={() => navigate(`/tx/${result.outTxId}`)}>
          추가메모
        </button>
        <button className="hana-chip" onClick={() => setNotice("연습용 앱에서는 자동이체를 등록할 수 없어요.")}>
          자동이체 등록
        </button>
      </div>
      <dl className="hd-rows">
        <div>
          <dt>입금계좌</dt>
          <dd>
            {bankName}
            <br />
            {hanaNumber(to.bank, to.number)}
          </dd>
        </div>
        <div>
          <dt>출금계좌</dt>
          <dd>
            하나은행
            <br />
            {fromNumber}
          </dd>
        </div>
        {open && (
          <>
            <div>
              <dt>수수료</dt>
              <dd>무료</dd>
            </div>
            <div>
              <dt>받는분에게 표시</dt>
              <dd>{memoTo}</dd>
            </div>
            <div>
              <dt>나에게 표시</dt>
              <dd>{memoMe}</dd>
            </div>
            <div>
              <dt>이체일시</dt>
              <dd>{result.at.slice(0, 19).replace("T", " ").replaceAll("-", ".")}</dd>
            </div>
          </>
        )}
      </dl>
      <button className="hd-more" onClick={() => setOpen((o) => !o)}>
        {open ? "접기" : "펼치기"}
        <span className={open ? "hs-more--up" : ""}>
          <ChevronDown size={16} stroke={1.5} />
        </span>
      </button>
      <div className="hana-bottom hd-bottom">
        <button className="hana-btn hd-share" onClick={() => setNotice("연습용 앱에서는 공유할 수 없어요.")}>
          공유
        </button>
        <button className="hana-btn" onClick={() => navigate(`/history/${result.fromAccountId}`, { replace: true })}>
          거래내역 조회
        </button>
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
