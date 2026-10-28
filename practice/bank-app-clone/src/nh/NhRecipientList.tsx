import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Bank, Recipient, TransferRecipients } from "../api/types";
import { localAsset } from "../assets/Asset";
import { nhNumber } from "./banks";
import { NhBankIcon, NhImg } from "./common";
import { nhWon } from "./hangul";
import { withNhLoading } from "./loading";
import "./nh-recipients.css";

export type RlTab = "recent" | "mine" | "fav";
type Tab = RlTab;
type Row = Recipient & {
  key: string;
  at?: string;
  line: string;
  balance?: number;
};

// 시트가 접혔을 때 내려가 있는 거리: 펼친 위치(헤더 아래, 앱 위 47.84) → 접힌 위치(앱 위 451.5)
const COLLAPSED = 403.66;

// 탭을 바꿀 때 (녹화1 21.95초 내계좌, 23.895초 자주쓰는, 프레임 시간으로 잼. 누른 때부터 ms):
//   내계좌: 바로 목록 비움 → 25 점 3개 + 막(공용 로딩, 막은 190ms 동안 짙어짐) → 570 막 걷힘 → 590 줄 나타남
//   자주쓰는: 바로 점 3개 + 목록 비우고 빈 상태(흰 공·문구) → 50 톱니 나타남 → 82 막 걷힘 → 116 줄 나타남
const TAB_LOADING = {
  mine: { at: 25, ms: 545, rows: 20 },
  fav: { at: 0, ms: 82, rows: 34, gear: 50 },
  recent: { at: 0, ms: 82, rows: 34 },
} as const;

// ---------- 최근송금 / 내계좌 / 자주쓰는 시트 (녹화1 15.6~27초) ----------
// appear 가 정해지면 나타남: "rise" 는 아래(앞 화면 707dp)에서 108ms 만에 올라와 접힌 자리에 멈춤, "static" 은 그 자리에 바로.
// 손잡이를 누르거나 끌면 헤더 바로 아래까지 펼쳐짐. 탭을 바꾸면 점 3개 로딩이 잠깐 돌고 목록이 바뀜
export function NhRecipientList({
  open,
  onToggle,
  data,
  onPick,
  appear,
  initialTab = "recent",
  onTab,
}: {
  open: boolean;
  onToggle: () => void;
  data?: TransferRecipients;
  onPick: (r: Recipient) => void;
  appear: "rise" | "static" | null;
  initialTab?: Tab;
  onTab?: (t: Tab) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [gearHidden, setGearHidden] = useState(false);
  const seq = useRef(0); // 로딩 중에 다른 탭을 누르면 앞 로딩의 끝은 무시
  const [drag, setDrag] = useState<number | null>(null); // 끄는 중인 위치 (translateY px)
  const scroller = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  const switchTab = (k: Tab) => {
    if (k === tab) return;
    const n = ++seq.current;
    const t = TAB_LOADING[k];
    setTab(k);
    onTab?.(k);
    setLoading(true);
    setGearHidden(k === "fav");
    scroller.current?.scrollTo({ top: 0 });
    const later = (ms: number, f: () => void) =>
      window.setTimeout(() => n === seq.current && f(), ms);
    if ("gear" in t) later(t.gear, () => setGearHidden(false));
    const load = () =>
      withNhLoading(() => undefined, t.ms).then(() =>
        later(t.rows, () => setLoading(false)),
      );
    if (t.at) later(t.at, load);
    else load();
  };

  // 손잡이·탭 묶음을 위아래로 끌기. 6px 넘게 움직이면 끌기로 보고, 놓으면 가까운 쪽(또는 튕긴 쪽)으로.
  // 손가락이 시트 밖으로 나가도 따라가도록 window 에서 받음
  const startDrag = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const base = open ? 0 : COLLAPSED;
    const y0 = e.clientY;
    let moved = false;
    let lastY = y0;
    let lastT = e.timeStamp;
    let vy = 0; // px/ms, 위로 끌면 음수
    let pos = base;
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dy) < 6) return;
      moved = true;
      vy = (ev.clientY - lastY) / Math.max(1, ev.timeStamp - lastT);
      lastY = ev.clientY;
      lastT = ev.timeStamp;
      pos = Math.min(COLLAPSED, Math.max(0, base + dy));
      setDrag(pos);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) return;
      suppressClick.current = true; // 끈 뒤 손을 뗀 자리의 탭·손잡이 click 은 무시
      setTimeout(() => (suppressClick.current = false), 0);
      setDrag(null);
      const wantOpen = Math.abs(vy) > 0.5 ? vy < 0 : pos < COLLAPSED / 2;
      if (wantOpen !== open) onToggle();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const onClickCapture = (e: ReactMouseEvent) => {
    if (suppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  // 마우스 휠: 접힌 상태에서 아래로 굴리면 펼침, 펼친 상태에서 맨 위에서 위로 굴리면 접음
  const onWheel = (e: ReactWheelEvent) => {
    if (!open && e.deltaY > 0) onToggle();
    else if (open && e.deltaY < 0 && (scroller.current?.scrollTop ?? 0) <= 0)
      onToggle();
  };

  if (!data || !appear) return null;
  const rows: Row[] =
    tab === "recent"
      ? data.recent.map((r) => ({
          ...r,
          key: `r-${r.bank.code}-${r.number}`,
          line: accountLine(r.bank, r.number),
          at: r.lastAt.replace("T", " ").replaceAll("-", "."),
        }))
      : tab === "mine"
        ? data.mine.map((m) => {
            const number = (m.number ?? "").replace(/\D/g, "");
            return {
              bank: m.bank,
              number,
              holder: m.label,
              accountId: m.accountId,
              key: `m-${m.accountId}`,
              line: `농축협 ${nhNumber(number)}`,
              balance: m.balance,
            };
          })
        : data.favorites.map((p) => ({
            ...p,
            key: `f-${p.id}`,
            line: accountLine(p.bank, p.number),
          }));
  const y = drag ?? (open ? 0 : COLLAPSED);

  return (
    <section
      className={`nh-rl ${appear === "rise" ? "nh-rl--rise" : ""} ${open ? "open" : ""} ${drag !== null ? "dragging" : ""}`}
      style={{ transform: `translateY(${y}px)` }}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
    >
      <div className="nh-rl__grab" onPointerDown={startDrag}>
        <button
          className="nh-rl__handle"
          aria-label={open ? "내리기" : "올리기"}
          onClick={onToggle}
        />
      </div>
      {/* 접힌 상태에선 목록이 스크롤되지 않고, 목록 어디를 끌어도 시트가 따라옴 */}
      <div
        className={`nh-rl__scroll ${open ? "" : "locked"}`}
        ref={scroller}
        onPointerDown={open ? undefined : startDrag}
      >
        <div
          className="nh-rl__tabs"
          role="tablist"
          onPointerDown={open ? startDrag : undefined}
        >
          {(
            [
              ["recent", "최근송금"],
              ["mine", "내계좌"],
              ["fav", "자주쓰는"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? "on" : ""}
              onClick={() => switchTab(k)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="nh-rl__tools">
          <button className="nh-rl__search" aria-label="검색">
            <SearchIcon />
          </button>
          {tab === "recent" ? (
            <button className="nh-rl__trash" aria-label="삭제">
              <TrashIcon />
            </button>
          ) : tab === "mine" ? (
            <button className="nh-rl__reg">
              {/* 실제 앱도 로딩 중엔 아이콘 없이 '등록' 글자만 보임 (녹화1 21.97초) */}
              <RegisterIcon hidden={loading} />
              등록
            </button>
          ) : (
            <button
              className="nh-rl__gear"
              aria-label="자주쓰는 계좌 관리"
              style={gearHidden ? { visibility: "hidden" } : undefined}
            >
              <GearIcon />
            </button>
          )}
        </div>
        <div className={`nh-rl__rows nh-rl__rows--${tab}`}>
          {!loading &&
            rows.map((r) => (
              <div key={r.key} className="nh-rl__row" onClick={() => onPick(r)}>
                <RowIcon r={r} />
                <span className="nh-rl__text">
                  <b>{r.holder}</b>
                  <small>{r.line}</small>
                  {r.at && <small className="nh-rl__at">{r.at}</small>}
                </span>
                {r.balance !== undefined ? (
                  <em className="nh-rl__bal">{nhWon(r.balance)}</em>
                ) : tab === "fav" ? (
                  <StarIcon />
                ) : (
                  <button
                    className="nh-rl__plus"
                    aria-label="자주쓰는계좌로 추가"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      aria-hidden
                    >
                      <path d="M12 5.9v12.2M5.9 12h12.2" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          {tab === "fav" && (loading || !rows.length) && (
            <div className="nh-rl__empty">
              {/* 흰 공에 눈 두 개 (녹화1 23.98초에서 잘라 둔 그림) */}
              <NhImg
                name="nh-sendwho-favempty"
                w={48}
                h={48}
                fallback={<i />}
              />
              <p>등록된 자주쓰는 계좌가 없어요.</p>
              <button>자주쓰는 계좌 관리</button>
            </div>
          )}
          {tab !== "fav" && !loading && !rows.length && (
            <p className="nh-rl__none">
              {tab === "recent" ? "최근 송금 내역이 없어요." : "계좌가 없어요."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// 은행 이름 + 계좌번호 ("농축협 000000-00-000000", "농협은행 000-00-000000", "카카오 7777…", "기업 6050…")
const SHORT: Record<string, string> = {
  kakao: "카카오",
  toss: "토스뱅크",
  kbank: "케이뱅크",
};
function accountLine(bank: Bank, number: string) {
  const d = number.replace(/\D/g, "");
  if (bank.code !== "nh") return `${SHORT[bank.code] ?? bank.short} ${d}`;
  return `${d.length === 11 ? "농협은행" : "농축협"} ${nhNumber(d)}`;
}

// 36dp 둥근 사각형 은행 아이콘 (녹화에서 잘라 둔 것). 없는 은행은 원형 로고를 같은 상자에
const ICON: Record<string, string> = {
  kakao: "kakao",
  shinhan: "shinhan",
  woori: "woori",
  toss: "toss",
  ibk: "ibk",
  hana: "hana",
};
function RowIcon({ r }: { r: Row }) {
  const key = r.accountId
    ? "account"
    : r.bank.code === "nh"
      ? r.number.length === 11
        ? "nhbank"
        : "nh"
      : ICON[r.bank.code];
  const src = key && localAsset(`nh-sendwho-${key}`);
  if (src)
    return (
      <img
        className="nh-rl__icon"
        src={src}
        alt={r.bank.name}
        width={36}
        height={36}
        draggable={false}
      />
    );
  return (
    <span className="nh-rl__icon nh-rl__icon--other">
      <NhBankIcon bank={r.bank} size={30} />
    </span>
  );
}

// ---------- 작은 선 아이콘 (녹화에서 잰 좌표, 24dp 상자) ----------
function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.52"
      aria-hidden
    >
      <circle cx="12.38" cy="11.94" r="7.44" />
      <path d="M17.7 17.26 21.84 21.54" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.42"
      aria-hidden
    >
      <path d="M3 6.4h17.4M5.6 6.4l.6 11.6a2.4 2.4 0 0 0 2.4 2.4h6.4a2.4 2.4 0 0 0 2.4-2.4l.6-11.6M8.8 6.4V4.6a1.2 1.2 0 0 1 1.2-1.2h3a1.2 1.2 0 0 1 1.2 1.2v1.8" />
      <path d="M10 11.4v5M13.6 11.4v5" strokeLinecap="round" />
    </svg>
  );
}
function RegisterIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
      style={hidden ? { visibility: "hidden" } : undefined}
    >
      <rect x="3.6" y="2.9" width="16.5" height="16" rx="4.1" />
      <path d="M3.6 7.8h16.5M11.85 9.4v7.2M8.25 13h7.2" />
    </svg>
  );
}
// 톱니: 넓고 둥근 꽃잎 6개 (r = 6.7 + 1.9·|cos 3θ|^0.55, 골은 뾰족) + 가운데 원
function GearIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.00 3.40 12.45 3.42 12.89 3.50 13.33 3.62 13.74 3.79 14.14 4.01 14.51 4.28 14.84 4.60 15.13 4.97 15.35 5.42 15.35 6.20 16.02 5.81 16.52 5.77 16.99 5.84 17.43 5.97 17.85 6.15 18.24 6.39 18.59 6.66 18.92 6.98 19.20 7.32 19.45 7.70 19.65 8.10 19.81 8.52 19.92 8.96 19.98 9.41 19.99 9.86 19.94 10.31 19.83 10.76 19.65 11.20 19.37 11.61 18.70 12.00 19.37 12.39 19.65 12.80 19.83 13.24 19.94 13.69 19.99 14.14 19.98 14.59 19.92 15.04 19.81 15.48 19.65 15.90 19.45 16.30 19.20 16.68 18.92 17.02 18.59 17.34 18.24 17.61 17.85 17.85 17.43 18.03 16.99 18.16 16.52 18.23 16.02 18.19 15.35 17.80 15.35 18.58 15.13 19.03 14.84 19.40 14.51 19.72 14.14 19.99 13.74 20.21 13.33 20.38 12.89 20.50 12.45 20.58 12.00 20.60 11.55 20.58 11.11 20.50 10.67 20.38 10.26 20.21 9.86 19.99 9.49 19.72 9.16 19.40 8.87 19.03 8.65 18.58 8.65 17.80 7.98 18.19 7.48 18.23 7.01 18.16 6.57 18.03 6.15 17.85 5.76 17.61 5.41 17.34 5.08 17.02 4.80 16.68 4.55 16.30 4.35 15.90 4.19 15.48 4.08 15.04 4.02 14.59 4.01 14.14 4.06 13.69 4.17 13.24 4.35 12.80 4.63 12.39 5.30 12.00 4.63 11.61 4.35 11.20 4.17 10.76 4.06 10.31 4.01 9.86 4.02 9.41 4.08 8.96 4.19 8.52 4.35 8.10 4.55 7.70 4.80 7.32 5.08 6.98 5.41 6.66 5.76 6.39 6.15 6.15 6.57 5.97 7.01 5.84 7.48 5.77 7.98 5.81 8.65 6.20 8.65 5.42 8.87 4.97 9.16 4.60 9.49 4.28 9.86 4.01 10.26 3.79 10.67 3.62 11.11 3.50 11.55 3.42Z" />
      <circle cx="12" cy="12" r="3.05" />
    </svg>
  );
}
// 자주쓰는 별: 끝이 둥근 통통한 별 (굵은 같은 색 테두리로 모서리를 둥글게)
function StarIcon() {
  return (
    <svg
      className="nh-rl__star"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M12.00 5.70 14.53 9.62 19.04 10.81 16.09 14.43 16.35 19.09 12.00 17.40 7.65 19.09 7.91 14.43 4.96 10.81 9.47 9.62Z"
        fill="#ffbf2a"
        stroke="#ffbf2a"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
