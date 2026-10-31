import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../api/endpoints";
import type { Bank } from "../api/types";
import { Dialog } from "../components/Sheet";
import { ibkBankName, ibkNumber, nf } from "./bank";
import { IbkBankLogo, IbkCheckCircle, IbkHeader, IbkHeaderText, IbkIcon } from "./common";
import type { IbkDoneState } from "./IbkSend";
import { ibkNextPaint, setIbkCover } from "./loading";
import { IBK_PAGE, ibkToFirst, useIbkBackHandler, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-done.css";

// 녹화 145.067초(확인을 뗀 뒤 바탕이 돌아오기 시작)가 아니라 144.917초(손을 떼서 크기가 다시 커지기 시작 = click) 에서
// 145.700초 홈 껍데기까지 783ms (confirm 6). 이 동안 화면은 그대로
const HOME_DELAY = 783;
// 완료 화면이 붙은 뒤 말풍선이 나오기까지 (140.000 → 140.100, 3프레임). 그동안은 확인 화면 머리줄(← 이체 취소)이 남아 있음
const ARRIVE_MS = 100;

// 이체 완료 (녹화 140.0~145.7초, specB/confirm.md 5절): 머리줄 없음. 파란 체크 원 → "○○님께 / N 원을 보냈어요 ☆",
// ☆ 아래 '즐겨찾기에 추가해보세요' 말풍선(×), 출금/입금 계좌 카드(⧉ 복사), 자세히보기 ⌄, 아래 거래내역조회 · [공유] [확인]
export function IbkDone() {
  const state = useLocation().state as IbkDoneState | null;
  useIbkStatusBar();
  if (!state?.result) return <Navigate to="/" replace />;
  return <DoneView {...state} />;
}

// state 는 IbkSend 가 '보내기' 성공 뒤 navigate("/send/done", { replace: true, state }) 로 넘김: 이체 API 응답(result) + 출금 계좌 + 통장 표기
function DoneView({ result, from, memoTo, memoMe }: IbkDoneState) {
  const go = useIbkGo();
  const to = result.to;
  const [arrived, setArrived] = useState(false);
  const [tip, setTip] = useState(true); // 말풍선 (× 를 누르거나 ☆ 를 누르면 닫힘 — 녹화에 없음, 자연스러운 처리)
  const [star, setStar] = useState(!!to.favorite);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const leave = useRef<number | null>(null);
  const going = useRef(false); // 확인 · 거래내역조회를 눌러 떠나는 중 (그동안 안내창을 띄우면 그 뒤로가기 칸이 기록에 남았음 — V3 race done·donehist)
  useEffect(() => {
    const t = window.setTimeout(() => setArrived(true), ARRIVE_MS);
    return () => {
      window.clearTimeout(t);
      if (leave.current) window.clearTimeout(leave.current);
    };
  }, []);

  const fromNo = ibkNumber(from.bank, from.number);
  const toNo = ibkNumber(to.bank, to.number);
  const say = (m: string) => !going.current && setNotice(m);
  // 기능 없는 버튼은 눌러도 아무 일 없음 (안내창 없이)
  const soon = () => {};
  // 안드로이드 뒤로(3버튼 바 <)는 안내창부터 닫음 (아이폰은 칸이 있는 동안 가장자리 끌기가 안 됨 — ScreenStack)
  useIbkBackHandler(!!notice, () => setNotice(null));
  const copy = (bank: Pick<Bank, "code" | "short">, number: string) => {
    if (going.current) return;
    navigator.clipboard?.writeText(`${ibkBankName(bank)} ${number}`).catch(() => undefined);
    say("계좌번호를 복사했어요.");
  };
  // ☆: 받는 분(등록된 계좌)의 즐겨찾기를 켜고 끔 — 하나 HanaDone 과 같은 규칙. 내 계좌는 받는 분으로 등록할 수 없음 (서버 규칙)
  const toggleStar = () => {
    if (going.current) return;
    setTip(false);
    if (to.accountId) return say("내 계좌는 즐겨찾기에 추가할 수 없어요.");
    if (!to.payeeId) return;
    const next = !star;
    setStar(next);
    api.updatePayee(to.payeeId, { favorite: next }).catch(() => {
      setStar(!next);
      say("즐겨찾기를 바꾸지 못했어요.");
    });
  };
  // 확인 → 홈 (홈이 흰 1프레임 → 껍데기 → 뼈대 로딩부터: home 6-5 — IbkHome 의 ibkHome: "skeleton"). 이체가 끝났으니 완료 화면은 기록에서 지움.
  // 기록 첫 칸(홈)까지 걷고 그 칸을 뼈대 홈으로 바꿈 (지금 칸만 바꾸면 기록이 [홈, 홈] — V2 s1). 걷는 동안 돌아온 홈(껍데기)이 비치지 않게 흰 덮개
  // (뼈대 홈도 흰 1프레임부터라 그만큼 이어짐)
  const toHome = () => {
    if (going.current) return;
    going.current = true;
    leave.current = window.setTimeout(async () => {
      setIbkCover("#ffffff");
      await ibkToFirst();
      go("/", { replace: true, state: { ibkHome: "skeleton" } });
      await ibkNextPaint();
      setIbkCover(null);
    }, HOME_DELAY);
  };
  // 거래내역조회 → 출금 계좌 거래내역 (녹화에 없음: 홈 카드 → 거래내역과 같은 이동)
  const toHistory = () => {
    if (going.current) return;
    going.current = true;
    go(`/history/${from.id}`, { ...IBK_PAGE, replace: true });
  };

  const details: [string, string][] = [
    ["내 통장 표기", memoMe],
    ["받는 분 통장 표기", memoTo],
    ["수수료", "0원"],
    ["이체일시", result.at.slice(0, 19).replace("T", " ").replaceAll("-", ".")],
  ];

  return (
    <div className="ibk ibk-page ibd">
      {!arrived && <IbkHeader className="ibd-ghost" title="이체" onBack={() => undefined} right={<IbkHeaderText>취소</IbkHeaderText>} />}
      <span className="ibd-check">
        <IbkCheckCircle size={47.1} />
      </span>
      <p className="ibk-bl ibd-name">{to.holder}님께</p>
      <p className="ibk-bl ibd-sent">
        <b className="ibd-amt">{nf.format(result.amount)}</b>
        <b className="ibd-won">원</b>
        <b className="ibd-sent__t">을 보냈어요</b>
        <span className="ibd-star-at">
          <button className={`ibd-star ${star ? "ibd-star--on" : ""}`} onClick={toggleStar} aria-label="즐겨찾기" aria-pressed={star}>
            <IbkIcon name="star" w={16.24} h={15.44} />
          </button>
          {arrived && tip && (
            <span className="ibd-tip">
              <svg className="ibd-tip__bg" width="163.75" height="31.77" overflow="visible" aria-hidden>
                <path d="M5.9 .5H133.59L138.18-7.27 142.87.5H157.85Q163.25.5 163.25 6V25.77Q163.25 31.27 157.85 31.27H5.9Q.5 31.27.5 25.77V6Q.5.5 5.9.5Z" />
              </svg>
              <span className="ibk-bl ibd-tip__t">즐겨찾기에 추가해보세요</span>
              <button className="ibd-tip__x" onClick={() => setTip(false)} aria-label="말풍선 닫기">
                <IbkIcon name="close" w={7.22} h={7.5} sw={1.02} />
              </button>
            </span>
          )}
        </span>
      </p>

      <div className="ibd-mid">
        <div className="ibd-card">
          <div className="ibd-row ibd-row--from">
            <span className="ibk-bl ibd-label ibd-label--from">출금계좌</span>
            <span className="ibk-bl ibd-acct ibd-acct--from">
              <span className="ibd-logo">
                <IbkBankLogo bank={from.bank} size={17.5} />
              </span>
              {ibkBankName(from.bank)} {fromNo}
            </span>
            <span className="ibk-bl ibd-acctname">{from.label}</span>
            <button className="ibd-copy" onClick={() => copy(from.bank, fromNo)} aria-label="출금계좌 복사">
              <IbkIcon name="copy" />
            </button>
          </div>
          <i className="ibd-line" />
          <div className="ibd-row">
            <span className="ibk-bl ibd-label ibd-label--to">입금계좌</span>
            <span className="ibk-bl ibd-acct ibd-acct--to">
              <span className="ibd-logo">
                <IbkBankLogo bank={to.bank} size={17.5} />
              </span>
              {ibkBankName(to.bank)} {toNo}
            </span>
            <button className="ibd-copy" onClick={() => copy(to.bank, toNo)} aria-label="입금계좌 복사">
              <IbkIcon name="copy" />
            </button>
          </div>
          {/* 자세히보기를 펼친 모습은 녹화에 없음 → 확인 화면 카드의 행(내 통장 표기 · 받는 분 통장 표기) 모양으로 이어 붙임 */}
          {open &&
            details.map(([k, v]) => (
              <div key={k}>
                <i className="ibd-line" />
                <div className="ibd-row">
                  <span className="ibk-bl ibd-label">{k}</span>
                  <span className="ibk-bl ibd-val">{v}</span>
                </div>
              </div>
            ))}
        </div>
        <div className="ibd-more-at">
          <div className="ibk-bl ibd-more">
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "간단히보기" : "자세히보기"}
              <span className="ibd-more__chev">
                <IbkIcon name={open ? "chevron-up" : "chevron-down"} w={10} h={5.1} sw={1.3} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="ibk-bl ibd-link">
        <button onClick={toHistory}>
          <span>거래내역조회</span>
        </button>
      </div>
      <div className="ibk-bottom">
        <button className="ibk-btn ibk-btn--line" onClick={soon}>
          공유
        </button>
        <button className="ibk-btn ibd-ok" onClick={toHome}>
          확인
        </button>
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
