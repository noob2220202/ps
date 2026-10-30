import { useEffect, useRef, useState, type CSSProperties } from "react";
import { paths } from "../api/endpoints";
import type { Profile } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { IbkHeader, IbkHeaderIcon, IbkIcon } from "./common";
import { useIbkGo, type IbkGoOptions } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-menu.css";

// 전체메뉴 (녹화 70.47~72.0초 · 85.40~88.93초, spec: scratchpad/ibk/specB/menu.md 1절).
// 위에서 아래로: 로그아웃 · ⌂ ⚙ ✕ → [이름]님 > → 바로가기 카드(이벤트 · 인증/보안 · 고객센터 | 플라워, 오른쪽 흰 흐림) → 검색칸
// → 회색 띠 → 분류 칩(최근 · 조회 · 이체/출금 · 예적금 · 대출 · ⌄) → 최근 이용 메뉴 / 펼쳐보기 → 조회 묶음(항목 5개) → 이체/출금 묶음 제목.
// 바탕은 상태바부터 이어지는 연파랑 → 흰 그라데이션. 녹화는 스크롤하지 않아 이체/출금 아래 내용은 없음 (문구를 지어내지 않음).
// 위치는 클론 좌표 (x = (녹화 x − 0.35) / 1.0242, 본문 y = 녹화 y − 29.4) — 값마다 ibk-menu.css 에 녹화 숫자

const SOON = "연습용 앱에서는 준비 중인 메뉴예요.";
// 메뉴 항목 → 화면: 녹화 1-9 (71.867 누름 → 점 433ms → 흰 화면 → 빈 바탕 + 점 → 이체결과조회)를 줄인 것
const MENU_GO: IbkGoOptions = { spin: 430, white: 67, blank: 900 };
// ✕ 누름 덮개가 켜졌다 꺼진 뒤 닫힘 (녹화 88.933 누름 → 89.000 진함 → 89.133~89.233 옅어짐 → 89.267 밀려 나감)
const CLOSE_HOLD = 70;
const CLOSE_FADE = 100;

// 상태바(녹화 0~29.4)까지 이어지는 바탕: 녹화 y 0 #ddebfd → 29.4 에서의 색
const STATUS_BG = "linear-gradient(180deg, #ddebfd, rgb(224.7, 237.2, 251.5))";

// 바로가기 카드 (1-4): 그림(녹화에서 잘라 4배)의 왼쪽 위(클론 x, 녹화 y)·크기(dp), 글자 pen x, 글자 폭(누름 칸용) — 모두 화면 기준
const CARD = { x: 18.5, y: 147 };
const SHORTCUTS = [
  { label: "이벤트", img: "ibk-menu-gift", x: 34.81, y: 161, w: 20.5, h: 21, pen: 59.5, tw: 35 },
  { label: "인증/보안", img: "ibk-menu-lock", x: 105.11, y: 159, w: 21.48, h: 23, pen: 130.4, tw: 51 },
  { label: "고객센터", img: "ibk-menu-headset", x: 190.05, y: 159, w: 23.43, h: 23, pen: 216.6, tw: 45 },
  { label: "플라워", img: "ibk-menu-flower", x: 285.73, y: 160, w: 21.48, h: 22, pen: 311.0, tw: 34 },
];

// 분류 칩 (1-6): 바깥 x (클론), 글자 pen x. 고른 칩은 진회색 채움 (녹화: '최근')
const CHIPS = [
  { label: "최근", x: 18.1, w: 47.8, pen: 29.6 }, // 채움 녹화 화소로 다시 잼: 클론 18.1~65.9 × 녹화 314.6~348.6
  { label: "조회", x: 72.6, w: 48.2, pen: 83.7 },
  { label: "이체/출금", x: 126.8, w: 79.3, pen: 137.9 },
  { label: "예적금", x: 211.7, w: 61.3, pen: 223.1 },
  { label: "대출", x: 278.7, w: 48.4, pen: 290.0 },
] as const;
type Chip = (typeof CHIPS)[number]["label"];

// 조회 묶음 항목 (1-8). to 가 있는 것만 실제 화면으로, 나머지는 준비 중 안내
const INQUIRY: { label: string; to?: string; ls?: number }[] = [
  { label: "전체계좌조회" },
  { label: "거래내역조회", to: "/history/main" },
  { label: "이체결과조회", to: "/results" },
  { label: "해지계좌조회" },
  { label: "계좌통합관리(어카운트인포)", ls: -0.43 }, // 긴 줄은 자간 −0.43 이 더 맞음 (§10)
];

// .ibk-bl 의 top: 녹화 기준선 base(반올림)에 글자가 놓이게. origin = 담는 상자 위의 녹화 y (ibk-menu.css 머리 주석)
function blTop(base: number, fs: number, origin: number) {
  const a = Math.round(0.927734 * fs);
  const d = Math.round(0.244141 * fs);
  return Math.round(base) - Math.floor(a - (a + d) / 2) - origin;
}

function Img({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const src = localAsset(name);
  return src ? <img className={className} src={src} alt="" draggable={false} style={style} /> : <i className={className} style={style} />;
}

export function IbkMenu() {
  useIbkStatusBar(STATUS_BG);
  const go = useIbkGo();
  const profile = useApi<Profile>(paths.profile);
  const name = profile.data?.userName ?? "";
  const [notice, setNotice] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip>("최근");
  const [held, setHeld] = useState<string | null>(null); // 누른 뒤 화면이 바뀔 때까지 바탕을 남겨 둘 항목
  const [closing, setClosing] = useState<"" | "hold" | "fade">("");
  const body = useRef<HTMLDivElement>(null);
  const inquiry = useRef<HTMLDivElement>(null);
  const transfer = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const soon = () => setNotice(SOON);

  const open = async (item: (typeof INQUIRY)[number]) => {
    if (!item.to) return soon();
    setHeld(item.label);
    await go(item.to, MENU_GO);
    setHeld(null);
  };
  // ✕ · ⌂ → 홈: 누름 덮개(✕ 만) → 메뉴가 오른쪽으로 밀려 나감
  const close = (withPress: boolean) => {
    if (closing) return;
    const leave = () => go("/", { anim: "menu-out", replace: true });
    if (!withPress) return leave();
    setClosing("hold");
    timers.current.push(
      window.setTimeout(() => setClosing("fade"), CLOSE_HOLD),
      window.setTimeout(leave, CLOSE_HOLD + CLOSE_FADE),
    );
  };
  // 칩: 녹화에서 누르지 않음 → 조회 · 이체/출금은 그 묶음으로 스크롤, 최근은 맨 위, 나머지는 안내
  const pick = (label: Chip) => {
    const target = label === "조회" ? inquiry.current : label === "이체/출금" ? transfer.current : null;
    if (label !== "최근" && !target) return soon();
    setChip(label);
    const el = body.current;
    if (el) el.scrollTo({ top: target ? target.offsetTop - 12 : 0, behavior: "smooth" });
  };

  return (
    <div className="ibk ibk-page ibm">
      <div className="ibk-body" ref={body}>
        <div className="ibm-content">
          <IbkHeader
            bg="transparent"
            left={
              <button className="ibm-logout" onClick={soon}>
                <span>로그아웃</span>
              </button>
            }
            right={
              <>
                <IbkHeaderIcon name="home" cx={271.1} label="홈" onClick={() => close(false)} />
                <IbkHeaderIcon name="gear" cx={314.0} label="설정" onClick={soon} />
                <span className={`ibm-close-press ${closing ? `is-${closing}` : ""}`} />
                <IbkHeaderIcon name="close" cx={357.0} label="닫기" onClick={() => close(true)} />
              </>
            }
          />

          {/* 프로필을 받기 전엔 '님 >' 만 보이지 않게 줄째 숨김 */}
          <button className="ibm-name" onClick={soon} style={name ? undefined : { visibility: "hidden" }}>
            <b>{name}</b>
            <span>님</span>
            <IbkIcon name="chevron-right" w={7.1} h={15} sw={1.5} />
          </button>

          <div className="ibm-card">
            {SHORTCUTS.map((s) => (
              // 누름 칸 = 그림 왼쪽 4 ~ 글자 끝 4. 그 안의 그림·글자는 칸 기준
              <button key={s.label} className="ibm-card__item" style={{ left: s.x - CARD.x - 4, width: s.pen - s.x + s.tw + 8 }} onClick={soon}>
                <Img name={s.img} className="ibm-card__img" style={{ left: 4, top: s.y - CARD.y, width: s.w, height: s.h }} />
                <span className="ibk-bl" style={{ left: s.pen - s.x + 4 }}>
                  {s.label}
                </span>
              </button>
            ))}
            <i className="ibm-card__bar" />
            <i className="ibm-card__fade" />
          </div>

          <button className="ibm-search" onClick={soon}>
            <IbkIcon name="search" scale={1.06} sw={1.5} className="ibm-search__icon" />
            <span className="ibk-bl">검색어를 입력해 주세요.</span>
          </button>

          <i className="ibm-band" />

          <div className="ibm-chips">
            {CHIPS.map((c) => (
              <button
                key={c.label}
                className={`ibm-chip ${chip === c.label ? "is-on" : ""}`}
                style={{ left: c.x, width: c.w }}
                onClick={() => pick(c.label)}
              >
                <span className="ibk-bl" style={{ left: c.pen - c.x }}>
                  {c.label}
                </span>
              </button>
            ))}
            <i className="ibm-chips__fade" />
            <button className="ibm-chips__more" onClick={soon} aria-label="분류 펼치기">
              <IbkIcon name="chevron-down" w={16.9} h={8.6} sw={1.45} />
            </button>
          </div>

          <b className="ibk-bl ibm-recent">최근 이용 메뉴</b>
          <button className="ibk-bl ibm-expand" onClick={soon}>
            펼쳐보기
          </button>
          <i className="ibm-line ibm-line--1" />

          <div className="ibm-group ibm-group--inquiry" ref={inquiry}>
            <Img name="ibk-menu-group-inquiry" className="ibm-group__icon" />
            <b className="ibk-bl">조회</b>
          </div>
          {INQUIRY.map((item, k) => (
            <button
              key={item.label}
              className={`ibm-item ${held === item.label ? "is-held" : ""}`}
              style={{ top: 454.4 + 44.9 * k }}
              onClick={() => open(item)}
            >
              <span className="ibk-bl" style={{ top: blTop(511.9 + 44.9 * k, 14.5, 483.8 + 44.9 * k), letterSpacing: item.ls }}>
                {item.label}
              </span>
            </button>
          ))}
          <i className="ibm-line ibm-line--2" />

          <div className="ibm-group ibm-group--transfer" ref={transfer}>
            <Img name="ibk-menu-group-transfer" className="ibm-group__icon" />
            <b className="ibk-bl">이체/출금</b>
          </div>
        </div>
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
