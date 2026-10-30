import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Profile } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { OS } from "../platform/platform";
import { IbkHeader, IbkHeaderIcon, IbkIcon } from "./common";
import { holdIbkSpinner, ibkSleep } from "./loading";
import { ibkHereKey, ibkToFirst, useIbkBackHandler, useIbkGo, type IbkGoOptions } from "./nav";
import { IBK_STATUS, useIbkStatusBar } from "./theme";
import "./ibk-menu.css";

// 전체메뉴 (녹화 70.47~72.0초 · 85.40~88.93초, spec: scratchpad/ibk/specB/menu.md 1절).
// 위에서 아래로: 로그아웃 · ⌂ ⚙ ✕ → [이름]님 > → 바로가기 카드(이벤트 · 인증/보안 · 고객센터 | 플라워, 오른쪽 흰 흐림) → 검색칸
// → 회색 띠 → 분류 칩(최근 · 조회 · 이체/출금 · 예적금 · 대출 · ⌄) → 최근 이용 메뉴 / 펼쳐보기 → 조회 묶음(항목 5개) → 이체/출금 묶음 제목.
// 바탕은 상태바부터 이어지는 연파랑 → 흰 그라데이션. 녹화는 스크롤하지 않아 이체/출금 아래 내용은 없음 (문구를 지어내지 않음).
// 위치는 클론 좌표 (x = (녹화 x − 0.35) / 1.0242, 본문 y = 녹화 y − 29.4) — 값마다 ibk-menu.css 에 녹화 숫자

const SOON = "연습용 앱에서는 준비 중인 메뉴예요.";
// 메뉴 항목 → 화면 (녹화 1-9, 71.867 누름): 뗀 순간 점(72.300~72.567 보임, 바로 사라짐) · 누른 바탕은 점이 뜨고 ≈134ms 뒤 133ms 동안 옅어짐(72.433~72.567)
// → (녹화엔 빈 메뉴 400ms 가 더 있으나 홈 '이체'(IBK_PAGE)처럼 기다림은 뺌) → 흰 화면 67ms(73.000~73.067) → #fafafa + 점 367ms(73.067~73.433)를 0.6배로 220ms
// → 이체결과조회가 스스로 흰 화면 → 뼈대 → 머리줄 → 기간 → 목록 (IbkResults STAGE_AT)
const PRESS = { fadeAt: 134, spin: 267, spinFade: 100 };
const MENU_GO: IbkGoOptions = { white: 67, blank: 220 };
// ✕ 누름 덮개가 켜졌다 꺼진 뒤 닫힘 (녹화 88.933 누름 → 89.000 진함 → 89.133~89.233 옅어짐 → 89.267 밀려 나감)
const CLOSE_HOLD = 70;
const CLOSE_FADE = 100;

// 상태바(녹화 0~29.4) 바탕: 녹화 위 (221,235,253) → 아래 (225,237,250) 세로 그라데이션 (70.6~71.8·85.5~88.5초 30fps PNG(bt709) 125장 평균, x 150~270 ·
// 줄 0~28 RMS 0.9/0.5/1.6. F/*.jpg 로 잰 (222,235,253)→(226,240,252) 는 JPEG 로 다시 저장하며 아래 줄 R·G 가 +2~3 밝아진 값이라 1.7/1.6/1.2).
// 아래끝이 본문 바탕 위끝 (224.7,237.2,251.5)(ibk-menu.css)과 이어짐. 이음새 그림자는 PhoneFrame 이 마지막 색으로 그림
const STATUS_BG = "linear-gradient(180deg, rgb(221,235,253), rgb(225,237,250))";
// 오른쪽에서 밀려 들어올 때(menu-in 100ms) 녹화는 판이 상태바도 덮으며 들어옴(70.367 은 왼쪽 75% 가 아직 #fafafa, 70.400 은 25%).
// 상태바는 화면 밖(PhoneFrame)이라 한 번에 바뀜 → 판이 반쯤 들어온 50ms 에 바꿈
const STATUS_LATE = 50;

const seenKeys = new Set<string>(); // 이미 그린 방문 기록 칸

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
  { label: "최근", x: 18.2, w: 48.6, pen: 29.6 }, // 바깥(안 고른 칩 테두리 자리) 녹화 19.0~68.8. 고르면 안쪽 0.9 만 채움 (ibk-menu.css)
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
  // 새로 밀려 들어오는 중인지: menu-in 으로 연 방문 기록 칸을 처음 그릴 때만 (돌아온 칸은 한 번에 바뀜, 녹화 85.400).
  // ScreenStack 이 <Routes location> 으로 그려 useNavigationType 은 늘 POP → 칸 key 로 가림
  const location = useLocation();
  const [sbLate, setSbLate] = useState(
    () => OS === "android" && !seenKeys.has(location.key) && (location.state as { ibkAnim?: string } | null)?.ibkAnim === "menu-in",
  );
  useEffect(() => {
    seenKeys.add(location.key);
  }, [location.key]);
  useEffect(() => {
    if (!sbLate) return;
    const t = window.setTimeout(() => setSbLate(false), STATUS_LATE);
    return () => window.clearTimeout(t);
  }, [sbLate]);
  useIbkStatusBar(sbLate ? IBK_STATUS : STATUS_BG);
  const go = useIbkGo();
  const profile = useApi<Profile>(paths.profile);
  const name = profile.data?.userName ?? "";
  const [notice, setNotice] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip>("최근");
  const [held, setHeld] = useState<{ label: string; fade: boolean } | null>(null); // 뗀 뒤 남겨 둘 누른 바탕 (fade = 옅어지는 중)
  const [closing, setClosing] = useState<"" | "hold" | "fade">("");
  const body = useRef<HTMLDivElement>(null);
  const inquiry = useRef<HTMLDivElement>(null);
  const transfer = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  const left = useRef(false); // 홈으로 닫는 중 (✕ · ⌂ · 아래 뒤로가기 칸이 겹쳐도 한 번만)
  const shut = useRef(false); // ✕ · ⌂ 를 누름 → 기다리던 항목 이동(open)은 하지 않음 (V3 menurace)
  useEffect(() => {
    alive.current = true;
    const ts = timers.current;
    return () => {
      alive.current = false;
      ts.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  // 항목을 눌러 이동을 기다리는 중이거나 닫는 중엔 안내창을 띄우지 않음 (띄우면 그 뒤로가기 칸이 기록에 남아 '<' 한 번이 헛돎 — V3 race menuopen)
  const soon = () => !held && !shut.current && setNotice(SOON);

  const open = async (item: (typeof INQUIRY)[number]) => {
    if (held || shut.current) return;
    if (!item.to) return soon();
    const at = ibkHereKey();
    setHeld({ label: item.label, fade: false });
    const release = holdIbkSpinner();
    await ibkSleep(PRESS.fadeAt);
    if (alive.current) setHeld({ label: item.label, fade: true });
    await ibkSleep(PRESS.spin - PRESS.fadeAt);
    release();
    await ibkSleep(PRESS.spinFade);
    if (!alive.current) return;
    // 기다리는 동안 닫았거나(✕ · ⌂) 뒤로가기로 메뉴를 떠났으면 가지 않음 (나가는 층으로 남아 alive 가 아직 true — V3 menurace)
    if (shut.current || ibkHereKey() !== at) return setHeld(null);
    await go(item.to, MENU_GO);
    if (alive.current) setHeld(null);
  };
  // ✕ · ⌂ → 홈: 누름 덮개(✕ 만) → 메뉴가 오른쪽으로 밀려 나감
  const close = (withPress: boolean) => {
    if (closing || left.current) return;
    shut.current = true;
    const leave = async () => {
      if (left.current) return;
      left.current = true;
      // 홈은 방문 기록 첫 칸: 그 위 칸을 다 걷음(뒤로가기 칸 포함) → 첫 칸이 홈이면 뒤로가기라 menu-in 을 거꾸로 = menu-out 으로 닫힘.
      // 지금 칸만 홈으로 바꾸면 기록이 [홈, 홈] 이 되어 홈에서 뒤로 하면 홈이 또 떴음 (V2 s3·s7). 첫 칸이 홈이 아니면(주소로 바로 연 메뉴 등) 홈으로 바꿈
      if (!(await ibkToFirst())) go("/", { anim: "menu-out", replace: true });
    };
    if (!withPress) return leave();
    setClosing("hold");
    timers.current.push(
      window.setTimeout(() => setClosing("fade"), CLOSE_HOLD),
      window.setTimeout(leave, CLOSE_HOLD + CLOSE_FADE),
    );
  };
  // 안드로이드 뒤로(3버튼 바 <): 주소로 바로 연 메뉴(방문 기록 첫 칸)는 갈 곳이 없어 그대로 남았음 → 칸을 하나 쌓아 두고 빠지면 ⌂ 처럼 홈으로.
  // 안내창이 떠 있으면 안내부터 닫음 (아이폰은 칸이 있는 동안 가장자리 끌기가 안 됨 — ScreenStack)
  const [first] = useState(() => ((window.history.state as { idx?: number } | null)?.idx ?? 0) === 0);
  useIbkBackHandler(first, () => close(false));
  useIbkBackHandler(!!notice, () => setNotice(null));
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
              className={`ibm-item ${held?.label === item.label ? (held.fade ? "is-held is-fading" : "is-held") : ""}`}
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
