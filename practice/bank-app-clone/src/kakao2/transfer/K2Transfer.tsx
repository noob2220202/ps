import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { accountLine, api, paths } from "../../api/endpoints";
import type { Bank, Recipient, TransferRecipients } from "../../api/types";
import { useApi } from "../../api/useApi";
import { BankIcon } from "../../components/BankIcon";
import { ErrorState } from "../../components/ErrorState";
import { useStatusBar } from "../../hooks/useStatusBar";
import type { AmountState } from "../../screens/transfer/TransferScreen";
import { K2Chevron, K2Close, K2Magnifier, K2Star } from "../art";
import { k2ClockOnce } from "../chrome";
import { useK2Back, useK2Once } from "../nav";
import { K2BankSheet, type K2SheetKind } from "./K2BankSheet";
import "./k2-transfer.css";

// kakao2 이체 (녹화 8.17 ~ 27.9초, transfer.md + critic.md C3 · G10). 홈에서 아래로부터 올라오는 전체 화면 모달(ScreenStack · nav.css),
// X 를 누르면 내려감. 머리(X · 이체 · 검색 · 계좌번호|카카오톡 친구)는 고정, 목록만 따로 스크롤 (위끝 286pt).
// 기능은 카카오뱅크 이체(TransferScreen)와 같음: 내 계좌 / 최근 이체(☆ 즐겨찾기) → 금액 화면, 직접입력 → 은행선택 → 계좌번호 → 금액
const SKEL_MS = 390; // 올라오기 시작 → 목록 (8.172 → 8.565초). 그동안 뼈대, '+ 계좌번호 직접입력' 없음
const AI_MS = 225; // 'AI로 이체하기' 가 늦게 나타남 (8.398초, 페이드 없이)
// 시트를 열고 닫을 때 상태바 글자색이 바뀌는 때 (device.md §5): 열기 = 시트 시작 + 234ms(10.092초) 흰 글자, 닫기 = +102ms(23.702초) 검은 글자. 시계는 200ms.
// 시트는 한 프레임쯤 앞당겨 움직이므로(k2-bank-sheet.css 음수 delay) 그만큼 덜 기다림
// (스크린캐스트: 열기 = 시트가 막 넘쳐 올라간 프레임(−3pt), 닫기 = 첫 프레임에서 5프레임 뒤 — 둘 다 녹화와 같은 프레임)
const SB_LIGHT_MS = 210;
const SB_DARK_MS = 85;

export function K2Transfer() {
  const navigate = useNavigate();
  const back = useK2Back();
  const once = useK2Once(); // X · 받는 분: 빠르게 두 번 눌러도 한 번만 (두 칸 뒤로 · 금액 화면 두 번 쌓임 없이)
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);

  // 홈에서 모달로 올라올 때만 뼈대 · AI 링크 늦추기 (층에 layer--k2-modal). 금액 화면에서 돌아오거나 새로고침이면 바로 —
  // ScreenStack 층 안의 <Routes location> 은 useNavigationType 이 늘 POP 이라 층 class 로 앎. 그리기 전에 정함 (useLayoutEffect)
  const root = useRef<HTMLDivElement>(null);
  const [skelDone, setSkelDone] = useState(false);
  const [aiShown, setAiShown] = useState(false);
  useLayoutEffect(() => {
    if (!root.current?.closest(".layer")?.classList.contains("layer--k2-modal")) {
      setSkelDone(true);
      setAiShown(true);
      return;
    }
    const a = setTimeout(() => setAiShown(true), AI_MS);
    const s = setTimeout(() => setSkelDone(true), SKEL_MS);
    return () => (clearTimeout(a), clearTimeout(s));
  }, []);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"account" | "kakao">("account");
  const [sheet, setSheet] = useState<K2SheetKind | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);

  const goAmount = useCallback(
    (to: Recipient) => once(() => navigate("/transfer/amount", { state: { from, to } satisfies AmountState })),
    [once, navigate, from],
  );
  const closeSheet = useCallback(() => setSheet(null), []);
  const pickBank = useCallback((b: Bank) => {
    setBank(b);
    setSheet("number");
  }, []);
  const changeBank = useCallback(() => setSheet("bank"), []);

  // 검색: 이름, 계좌번호(숫자만), 은행 이름 어디에 걸려도 보여줌
  const q = query.replace(/\s/g, "");
  const hit = (...texts: (string | undefined)[]) => !q || texts.some((t) => t?.replace(/[\s-]/g, "").includes(q));
  const mine = data.data?.mine.filter((m) => hit(m.label, m.number, m.bank.name)) ?? [];
  const recent = data.data?.recent.filter((r) => hit(r.holder, r.number, r.bank.name)) ?? [];
  const skel = tab === "account" && data.status !== "error" && (!data.data || !skelDone);

  return (
    <div className="k2t" ref={root}>
      <SheetGlyphs open={sheet !== null} />
      <div className="k2t__head">
        <button className="k2t__close" aria-label="닫기" onClick={() => once(back)}>
          <K2Close />
        </button>
        <h1 className="k2t__title">이체</h1>
        <button className={`k2t__ai ${aiShown ? "" : "k2t__ai--wait"}`}>
          <AiStar />
          <span>AI로 이체하기</span>
          <K2Chevron width={6} stroke={1.05} />
        </button>
        <div className="k2t__search">
          <K2Magnifier className="k2t__glass" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="받는사람 이름 또는 계좌번호" />
        </div>
        <button className="k2t__camera" aria-label="계좌번호 촬영">
          <CameraIcon />
        </button>
        <div className="k2t__tabs">
          <button className={tab === "account" ? "on" : ""} onClick={() => setTab("account")}>
            계좌번호
          </button>
          <button className={tab === "kakao" ? "on" : ""} onClick={() => setTab("kakao")}>
            카카오톡 친구
          </button>
        </div>
      </div>

      <div className="k2t__list">
        {tab === "kakao" ? (
          <p className="k2t__empty">카카오톡 친구 목록이 없어요.</p>
        ) : data.status === "error" ? (
          <ErrorState error={data.error} onRetry={data.retry} />
        ) : skel ? (
          <SkeletonRows />
        ) : (
          <>
            {mine.length > 0 && <h2 className="k2t__section">내 계좌</h2>}
            {mine.map((m) => (
              <button
                key={m.accountId}
                className="k2t__row row-press"
                onClick={() => goAmount({ bank: m.bank, number: (m.number ?? "").replace(/\D/g, ""), holder: m.holder, accountId: m.accountId })}
              >
                <BankIcon bank={m.bank} size={44.3} />
                <span className="k2t__text">
                  <strong>{m.label}</strong>
                  <small>{accountLine(m.bank, m.number)}</small>
                </span>
              </button>
            ))}
            {recent.length > 0 && <h2 className="k2t__section">최근 이체</h2>}
            {recent.map((r) => (
              <div key={`${r.bank.code}-${r.number}`} className="k2t__row row-press" onClick={() => goAmount(r)}>
                <BankIcon bank={r.bank} size={44.3} />
                <span className="k2t__text">
                  <strong>{r.holder}</strong>
                  <small>{accountLine(r.bank, r.number)}</small>
                </span>
                {/* ☆ 즐겨찾기: 등록된 받는 분일 때만 서버에 저장 */}
                <button
                  className={`k2t__star ${r.favorite ? "on" : ""}`}
                  aria-label="즐겨찾기"
                  disabled={!r.payeeId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (r.payeeId) api.updatePayee(r.payeeId, { favorite: !r.favorite }).catch(() => {});
                  }}
                >
                  <K2Star width={18.9} height={18} color="currentColor" />
                </button>
              </div>
            ))}
            {q && mine.length + recent.length === 0 && <p className="k2t__empty">검색 결과가 없어요.</p>}
          </>
        )}
      </div>

      {/* 목록 위에 떠 있는 흰 카드 버튼 (뒤 흰 띠 없음 — 목록이 밑 · 옆으로 보임). 뼈대 동안은 없음.
          뗀 뒤에도 시트가 덮을 때까지 눌린 색 그대로 (9.875초) */}
      {!skel && (
        <button className={`k2t__direct ${sheet ? "k2t__direct--held" : ""}`} onClick={() => setSheet("bank")}>
          <PlusIcon />
          <span>계좌번호 직접입력</span>
        </button>
      )}

      <K2BankSheet sheet={sheet} banks={banks.data} bank={bank} onClose={closeSheet} onPick={pickBank} onChangeBank={changeBank} onFound={goAmount} />
    </div>
  );
}

// 상태바 글자: 흰 바탕엔 검은 글자, 시트 배경(.737 검정)이 깔리면 흰 글자 — 시트가 움직이기 시작하고 조금 뒤에, 시계는 200ms 로.
// 타이머가 끝날 때 이 빈 컴포넌트만 다시 그림 (화면 전체를 다시 그리면 그만큼 늦게 바뀌고 시트가 한 프레임 끊겼음)
function SheetGlyphs({ open }: { open: boolean }) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (open === light) return;
    const id = setTimeout(
      () => {
        k2ClockOnce(200);
        setLight(open);
      },
      open ? SB_LIGHT_MS : SB_DARK_MS,
    );
    return () => clearTimeout(id);
  }, [open, light]);
  useStatusBar(light ? "#434343" : "#ffffff", light ? "light" : "dark");
  return null;
}

// 뼈대 (8.548초): 원 44 #fafafa, 막대 80 × 12 #f9f9f9 · 40 × 8 #f8f8f8. 반짝임 없음. 첫 줄은 머리 밑에 거의 가려짐 (원 위끝 250.7 + 66n)
function SkeletonRows() {
  return (
    <div className="k2t__skel" aria-label="불러오는 중">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="k2t__skel-row">
          <i />
          <b />
          <b />
        </div>
      ))}
    </div>
  );
}

// 'AI로 이체하기' 별 (9.00초, 잉크 15.3 × 15.3): K2AiStar 와 같은 모양에 녹화에서 맞춘 그러데이션 — 위 꼭지 하늘 #00c2ff →
// 가운데 연두 → 아래 꼭지 노랑 #ffdc00, 오른쪽 아래로 18° 기울어짐 (별 안 픽셀 826개에 최소제곱, RMS 7)
const AI_STAR =
  "M14.34 8L14.27 8.01 14.08 8.06 13.77 8.16 13.36 8.35 12.86 8.62 12.3 8.97 11.7 9.41 11.08 9.92 10.48 10.48 9.92 11.08 9.41 11.7 8.97 12.3 8.62 12.86 8.35 13.36 8.16 13.77 8.06 14.08 8.01 14.27 8 14.34 7.99 14.27 7.94 14.08 7.84 13.77 7.65 13.36 7.38 12.86 7.03 12.3 6.59 11.7 6.08 11.08 5.52 10.48 4.92 9.92 4.3 9.41 3.7 8.97 3.14 8.62 2.64 8.35 2.23 8.16 1.92 8.06 1.73 8.01 1.66 8 1.73 7.99 1.92 7.94 2.23 7.84 2.64 7.65 3.14 7.38 3.7 7.03 4.3 6.59 4.92 6.08 5.52 5.52 6.08 4.92 6.59 4.3 7.03 3.7 7.38 3.14 7.65 2.64 7.84 2.23 7.94 1.92 7.99 1.73 8 1.66 8.01 1.73 8.06 1.92 8.16 2.23 8.35 2.64 8.62 3.14 8.97 3.7 9.41 4.3 9.92 4.92 10.48 5.52 11.08 6.08 11.7 6.59 12.3 7.03 12.86 7.38 13.36 7.65 13.77 7.84 14.08 7.94 14.27 7.99Z";
const AI_STOPS = ["#00c2ff", "#2ec8cd", "#61d178", "#8eda23", "#bcdc13", "#f0dd08", "#ffdc00"];
function AiStar() {
  const id = useId();
  return (
    <svg className="k2t__aistar" width="15.4" height="15.4" viewBox="0 0 16 16" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="6.56" y1="3.55" x2="9.44" y2="12.45">
          {AI_STOPS.map((c, i) => (
            <stop key={c} offset={i / (AI_STOPS.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      {/* svg 상자는 CSS px 단위로 붙어 그려져서, 0.4pt 오른쪽 자리는 안에서 옮김 (.k2t__aistar overflow visible) */}
      <path d={AI_STAR} transform="translate(.43 .08)" fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="3.32" strokeLinejoin="round" />
    </svg>
  );
}

// '+ 계좌번호 직접입력' 의 + (9.00초): 글자보다 가는 10 × 10 더하기, 두께 1.33, 둥근 끝
function PlusIcon() {
  return (
    <svg className="k2t__plus" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" aria-hidden>
      <path d="M5 .67v8.66M.67 5h8.66" />
    </svg>
  );
}

// SF camera.fill (18.3 × 16.7): 둥근 몸통 + 위 턱 + 흰 고리 렌즈
function CameraIcon() {
  return (
    <svg width="18.3" height="16.7" viewBox="0 0 18.3 16.7" aria-hidden>
      <rect x="5.4" y="0" width="7.5" height="4.6" rx="2" fill="#000" />
      <rect x="0" y="2.3" width="18.3" height="14.4" rx="3" fill="#000" />
      <circle cx="9.1" cy="8.95" r="4.83" fill="#f6f6f6" />
      <circle cx="9.1" cy="8.95" r="2.33" fill="#000" />
    </svg>
  );
}
