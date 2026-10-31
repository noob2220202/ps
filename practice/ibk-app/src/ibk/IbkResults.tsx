import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { TransferRecord } from "../api/types";
import { prefetch, useApi } from "../api/useApi";
import { Dialog } from "../components/Sheet";
import { ibkBankName, ibkNumber, nf } from "./bank";
import { IbkHeader, IbkHeaderIcon, IbkIcon } from "./common";
import { holdIbkSpinner, ibkSleep, useIbkSpinner } from "./loading";
import { useIbkBack, useIbkBackHandler, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-menu.css";

// 이체결과조회 (녹화 75.37~77.33초 · 83.67~85.33초, spec: scratchpad/ibk/specB/menu.md 2절).
// 머리줄(< 이체결과조회 ≡) 아래만 스크롤: 계좌 선택 상자(🏛 전체계좌 ⌄) → 회색 띠 → '1개월 · 즉시이체 ⌄' + 굵은 돋보기
// → 기간 띠 → 이체 행(시각 · 정상 / 받는 분 · 금액 / 은행 번호 / 공유, 피치 134.7, 구분선 없음). 행을 누르면 이체확인증(본문만 오른쪽에서).
// 위치는 클론 좌표 (x = (녹화 x − 0.35) / 1.0242, 본문 y = 녹화 y − 81.4) — 값마다 ibk-menu.css 에 녹화 숫자

const ROW_TOP = 265.1; // 첫 행 칸 위 = 녹화 346.5 (시각 기준선 364.8 − 18.3), 본문 기준
const ROW_REC = 346.5;
const ROW_PITCH = 134.7;
// < 를 뗀 뒤 이전 화면까지 (녹화 84.867 뗌 → 85.400 메뉴, 82.867 → 83.367 확인증 → 결과): 약 500ms
const BACK_MS = 500;
// 행 누름 → 확인증 (77.367 손댐 → 77.467 바탕 완전 → 77.633 이동): 뗀 뒤 약 170ms
const OPEN_DELAY = 170;
const OPEN_WAIT = 600;
// 새로 열 때(메뉴 항목 · 홈 바로가기, 뒤로 돌아올 땐 아님) 녹화 1-9 처럼 단계별로 나타남 — 이 화면이 붙은 순간(= 흰 화면 73.000) 기준 ms.
// 녹화: 흰 화면 → #fafafa+점(go 의 blank) → 73.433 흰 화면 → 73.600 뼈대(선택 상자·띠·필터·글자 없는 기간 띠, 머리줄 없음)
// → 점 73.933~74.433 → 74.467 머리줄 → 점 74.767~75.267 → 75.033 기간 글자 → 75.367 목록. 흰 화면 67ms 뒤의 기다림은 홈 뼈대처럼 0.6배
const STAGES = ["white", "skeleton", "header", "period", "rows"] as const;
type Stage = (typeof STAGES)[number];
const STAGE_AT = { skeleton: 390, header: 910, period: 1250, rows: 1450 };
const STAGE_SPIN: [number, number][] = [
  [590, 810], // 점은 100ms 에 걸쳐 사라지니 머리줄·목록보다 100ms 먼저 놓음
  [1090, 1350],
];
const seenKeys = new Set<string>(); // 이미 그린 방문 기록 칸 (돌아온 것이면 단계 없이 바로)

// .ibk-bl 의 top: 녹화 기준선 base(반올림)에 글자가 놓이게. origin = 담는 상자 위의 녹화 y (ibk-menu.css 머리 주석)
function blTop(base: number, fs: number, origin: number) {
  const a = Math.round(0.927734 * fs);
  const d = Math.round(0.244141 * fs);
  return Math.round(base) - Math.floor(a - (a + d) / 2) - origin;
}

// 이체 행 글자: [녹화 기준선(첫 행), 크기] — 행마다 + 피치 (2-4, §10)
const ROW_TEXT = { time: [364.8, 11], state: [366.9, 11], name: [397.4, 14.25], amt: [397.4, 14.75], acct: [419.2, 10.75] } as const;
// 공유 아이콘 (2-4): 녹화 화소로 다시 잼 — 고리 중심 왼쪽 (341.1, 442.6) · 위 (350.0, 438.25) · 아래 (350.0, 447.45) → 기본 모양을 11.76 × 12.0 으로,
// 선 중심 상자 왼쪽 위 클론 (339.67, 녹화 436.85). 단추(화면 x 330, 칸 위 +84.3) 안에서 transform 으로 (단추 위치는 화면에서 정수로 붙음)
const SHARE = { x: 340.05, y: 436.85, w: 11.76, h: 12.0 };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
// 'YYYY-MM-DDTHH:mm:ss' → 'MM.DD HH:mm'
const rowTime = (at: string) => `${at.slice(5, 7)}.${at.slice(8, 10)} ${at.slice(11, 16)}`;

// 녹화: 오늘 10.30 기준 '1개월' = 2026.10.01 ~ 2026.10.30 (한 달 전 다음 날 ~ 오늘). 지난달에 그날이 없으면 지난달 말일 기준 (거래내역조회와 같음)
function periodFrom(now: Date) {
  const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  return new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), lastOfPrev) + 1);
}

// 은행 건물 (2-2): 녹화 잉크 46~74 × 126~153 → 클론 44.6~71.9. 진한 파랑 지붕(가운데 흰 점) · 띠 · 연한 기둥 4개 · 밑판.
// viewBox 는 클론 좌표 그대로 (화면 x 44, 녹화 y 125 에 정수로 놓음)
function BankBuilding() {
  return (
    <svg className="ibr-acct__icon" width="28" height="29" viewBox="44 125 28 29" aria-hidden>
      <path d="M44.4 133.1 58.4 126 71.6 133.1Z" fill="#0b70e0" />
      <rect x="44.4" y="132.6" width="27.2" height="4" rx="0.8" fill="#0b70e0" />
      <circle cx="58" cy="130.5" r="1.3" fill="#e9fbff" />
      <rect x="46.8" y="136.6" width="22.8" height="10.8" fill="#dcf1ff" />
      {[48.4, 53.8, 59.2, 64.7].map((x) => (
        <rect key={x} x={x} y="136.6" width="2.8" height="10.8" fill="#70aaee" />
      ))}
      <rect x="44.75" y="147.35" width="26.7" height="4.95" rx="1" fill="#0b70e0" />
    </svg>
  );
}

export function IbkResults() {
  useIbkStatusBar();
  const go = useIbkGo();
  const back = useIbkBack("/menu", BACK_MS);
  const list = useApi<TransferRecord[]>(paths.transfers());
  // 새로 연 것인지: 한 번 그린 방문 기록 칸(location.key)으로 돌아온 것(확인증 < · 시스템 뒤로)이면 목록을 바로.
  // (ScreenStack 이 <Routes location> 으로 그려서 useNavigationType 은 늘 POP 이라 못 씀.) 주소로 바로 연 첫 화면('default')도 바로
  const { key } = useLocation();
  const [stage, setStage] = useState<Stage>(() => (key === "default" || seenKeys.has(key) ? "rows" : "white"));
  useEffect(() => {
    seenKeys.add(key);
  }, [key]);
  const shown = (s: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(s);
  useEffect(() => {
    if (stage === "rows") return; // 단계 시간표는 붙을 때 한 번
    const t = (Object.keys(STAGE_AT) as (keyof typeof STAGE_AT)[]).map((k) => window.setTimeout(() => setStage(k), STAGE_AT[k]));
    const releases: (() => void)[] = [];
    for (const [on, off] of STAGE_SPIN) {
      let release: (() => void) | null = null;
      releases.push(() => release?.());
      t.push(
        window.setTimeout(() => (release = holdIbkSpinner()), on),
        window.setTimeout(() => release?.(), off),
      );
    }
    return () => {
      t.forEach((id) => window.clearTimeout(id));
      releases.forEach((r) => r());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useIbkSpinner(stage === "rows" && list.status === "loading");
  const [today] = useState(() => new Date());
  const from = periodFrom(today);
  const [notice, setNotice] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // 떠나는 중(행을 눌러 확인증으로 가기 전 · ← 를 뗀 뒤 BACK_MS)엔 안내창을 띄우지 않음. 띄우면 그 뒤로가기 칸이 기록에 남거나
  // 늦게 실행된 ← 의 navigate(-1) 이 그 칸만 빼서 화면이 그대로였음 (V3 race resopen · resback)
  const leaving = useRef(false);
  // 기능 없는 버튼은 눌러도 아무 일 없음 (안내창 없이)
  const soon = () => {};
  const onBack = () => {
    if (held) return;
    leaving.current = true;
    back();
  };
  // 안드로이드 뒤로(3버튼 바 <)는 안내창부터 닫음 (아이폰은 칸이 있는 동안 가장자리 끌기가 안 됨 — ScreenStack)
  useIbkBackHandler(!!notice, () => setNotice(null));

  // 녹화: 확인증은 점 없이 내용이 다 그려진 채 밀려 들어옴 → 손을 대는 순간부터 받아 두고(서버 조회 지연 ≈250ms) 받으면 이동 (최대 OPEN_WAIT)
  const pending = useRef<{ id: string; ready: Promise<unknown> } | null>(null);
  const warm = (id: string) => {
    const p = pending.current?.id === id ? pending.current : { id, ready: prefetch(paths.transferRecord(id)) };
    pending.current = p;
    return p.ready;
  };
  const open = async (id: string) => {
    if (held || leaving.current) return;
    setHeld(id);
    const ready = warm(id);
    await Promise.all([Promise.race([ready, ibkSleep(OPEN_WAIT)]), ibkSleep(OPEN_DELAY)]);
    if (!alive.current) return;
    go(`/results/${id}`, { anim: "body-right" });
  };

  // 기간 안의 이체만 (서버가 최신순으로 줌). 기간 글자와 같은 날짜 기준
  const fromIso = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
  const rows = shown("rows") ? (list.data ?? []).filter((t) => t.at.slice(0, 10) >= fromIso) : [];
  return (
    <div className="ibk ibk-page ibr">
      <IbkHeader
        title="이체결과조회"
        className={shown("header") ? "" : "ibr-header--late"}
        onBack={onBack}
        right={<IbkHeaderIcon name="menu" label="전체메뉴" onClick={() => go("/menu", { anim: "menu-in" })} />}
      />
      <div className="ibk-body">
        <div
          className={`ibr-content ${shown("skeleton") ? "" : "is-white"} ${shown("period") ? "" : "is-skeleton"}`}
          style={{ height: ROW_TOP + Math.max(rows.length, 1) * ROW_PITCH }}
        >
          <button className="ibr-acct" onClick={soon}>
            <BankBuilding />
            <span className="ibk-bl">전체계좌</span>
            <IbkIcon name="chevron-down" w={12.9} h={6.2} sw={1.3} className="ibr-acct__arrow" />
          </button>
          <i className="ibr-band" />
          <button className="ibr-filter" onClick={soon}>
            <span className="ibk-bl">1개월 · 즉시이체</span>
            <IbkIcon name="chevron-down" w={10.7} h={4.5} sw={1.15} className="ibr-filter__arrow" />
          </button>
          <button className="ibr-search" onClick={soon} aria-label="검색">
            <IbkIcon name="search" scale={1.37} sw={1.85} />
          </button>
          <div className="ibr-period">
            <span className="ibk-bl">
              {ymd(from)} ~ {ymd(today)}
            </span>
          </div>

          {shown("rows") && list.status === "done" && rows.length === 0 && <p className="ibr-empty">조회기간 내 이체내역이 없습니다.</p>}
          {shown("rows") && list.status === "error" && (
            <button className="ibr-empty" onClick={list.retry}>
              이체결과를 불러오지 못했어요. 눌러서 다시 시도해 주세요.
            </button>
          )}
          {rows.map((t, k) => {
            const y0 = ROW_REC + ROW_PITCH * k; // 행 칸 위의 녹화 y
            const at = (key: keyof typeof ROW_TEXT) => ({ top: blTop(ROW_TEXT[key][0] + ROW_PITCH * k, ROW_TEXT[key][1], y0) });
            const shareTop = Math.round(y0 + 84.3); // 단추 위를 화면 정수에 (그래야 아이콘 transform 이 정확)
            return (
              <div key={t.id} className="ibr-row" style={{ top: ROW_TOP + ROW_PITCH * k }}>
                <button className={`ibr-row__main ${held === t.id ? "is-held" : ""}`} onPointerDown={() => warm(t.id)} onClick={() => open(t.id)}>
                  <span className="ibk-bl ibr-row__time" style={at("time")}>
                    {rowTime(t.at)}
                  </span>
                  <span className="ibk-bl ibr-row__state" style={at("state")}>
                    정상
                  </span>
                  <b className="ibk-bl ibr-row__name" style={at("name")}>
                    {t.holder}
                  </b>
                  <b className="ibk-bl ibr-row__amt" style={at("amt")}>
                    {nf.format(t.amount)}
                    <small>원</small>
                  </b>
                  <span className="ibk-bl ibr-row__acct" style={at("acct")}>
                    <small>{ibkBankName(t.bank)}</small> {ibkNumber(t.bank, t.number)}
                  </span>
                </button>
                <button className="ibr-row__share" style={{ top: shareTop - y0 }} onClick={soon} aria-label="공유">
                  <IbkIcon
                    name="share"
                    w={SHARE.w}
                    h={SHARE.h}
                    style={{ transform: `translate(${SHARE.x - 330}px, ${SHARE.y + ROW_PITCH * k - shareTop}px)` }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
