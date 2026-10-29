import { useLayoutEffect, useRef } from "react";
import type { Bank } from "../api/types";
import { Keypad } from "../components/Sheet";
import type { PadKey } from "../lib/keypad";
import { nhBankList } from "./banks";
import { BackArrowKey, NhCloseIcon } from "./common";
import { withNhLoading } from "./loading";
import { NhBankSquare } from "./NhBankPicker";
import { notePickerFromSheet } from "./nhPickerHint";
import "./nh-numbersheet.css";

// 은행 이름 옆 ⌄ (가운데선 폭 10.3, 높이 5.45, 굵기 1.55 — 녹화1 29초와 줄별 잉크 분포·무게중심 y 452.1px@480 을 맞춤)
function ChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" aria-hidden>
      <path d="M6.85 9 12 14.45l5.15-5.45" />
    </svg>
  );
}

// 입력칸 오른쪽 ⓧ: 지름 24.6 회색 원 #535f6e + ×(굵기 2.25, #cbd2da) — 녹화 × 잉크 12×12px@480, 덮임 79px²
function ClearCircle() {
  return (
    <svg width="24.6" height="24.6" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#535f6e" />
      <path d="m7.75 7.75 8.5 8.5m0-8.5-8.5 8.5" stroke="#cbd2da" strokeWidth="2.25" />
    </svg>
  );
}

// '콕' 키 글리프 (공용 NhKokKey 와 같은 18.4×27.2 상자). 녹화1 여러 장 평균에 그려 맞춘 모양:
// ㅋ 가운데 획은 7.7 에서 꺾여 사선으로 ㅡ 에 붙고 오른쪽 세로획과는 떨어져 있음, 모서리 반경 1.7, 획 2.85
function KokGlyph() {
  return (
    <svg width="18.4" height="27.2" viewBox="0 0 18.4 27.2" fill="none" stroke="currentColor" strokeWidth="2.85" aria-label="콕">
      <path d="M0.45 1.05H11.25a1.7 1.7 0 0 1 1.7 1.7V10.6" />
      <path d="M0.45 6.6H7.7L2.25 12.9" strokeLinejoin="round" />
      <path d="M0.4 13.8H17.95" />
      <path d="M0.45 18.45H11.3a1.7 1.7 0 0 1 1.7 1.7V26.8" />
    </svg>
  );
}

// 계좌번호는 앞자리 0도 그대로 (금액용 applyKey 는 앞 0을 지움), 최대 16자리
function typeKey(digits: string, k: PadKey) {
  if (k === "back") return digits.slice(0, -1);
  if (k === "kok") return digits; // '콕'(붙여넣기 등)은 연습용 앱에선 아무 일 안 함
  return (digits + k).slice(0, 16);
}

// 은행 이름(⌄) → 은행선택 (녹화1 29.39~29.62초): 시트가 가속하며 내려가고 막이 걷히기 시작(onClose) →
// 40ms 뒤 점 3개 105ms → 걷히면 은행선택(onBank)이 콕송금 위에 나타남
const TO_PICKER = { dotsAt: 40, dotsMs: 105 };

// 시트가 '열린 채로' 새로 그려졌을 때 (은행선택에서 고른 뒤 콕송금이 다시 그려지는 경우) 실제 앱처럼 열리게:
// 185ms 동안 고른 은행이 보이는 콕송금 → 막 245ms 직선 0→0.6 + 시트 320ms 올라오며 200ms 동안 불투명해짐
// (녹화1 48.005→48.14→48.45, 녹화2 5.79→6.03→6.36. 평소 열림과 같은 곡선 — nh.css .sheet--keypad)
function useEnterIfMountedOpen() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current?.closest<HTMLElement>(".sheet__panel");
    const sheet = panel?.parentElement;
    if (!panel || !sheet?.classList.contains("sheet--open")) return;
    const backdrop = sheet.querySelector<HTMLElement>(".sheet__backdrop");
    const a = panel.animate([{ transform: "translate3d(0, 100%, 0)" }, { transform: "translate3d(0, 0, 0)" }], {
      duration: 320,
      delay: 185,
      easing: "cubic-bezier(0.28, 1, 0.56, 1)",
      fill: "backwards",
    });
    const o = panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 185, easing: "ease", fill: "backwards" });
    const b = backdrop?.animate([{ opacity: 0 }, { opacity: 0.6 }], { duration: 245, delay: 185, easing: "linear", fill: "backwards" });
    return () => {
      a.cancel();
      o.cancel();
      b?.cancel();
    };
  }, []);
  return ref;
}

// ---------- 계좌번호 시트: [은행 ⌄] [X] / 입력칸 / 키패드(콕) / 다음 ----------
// 녹화1 27.6~29초(NH농협, 빈 칸), 48.6~56초(하나은행, 입력 중), 녹화2 6~12초
export function NhNumberSheet({
  bank,
  digits,
  onChange,
  onBank,
  onClose,
  onDone,
}: {
  bank: Bank;
  digits: string;
  onChange: (d: string) => void;
  onBank: () => void; // 은행선택 열기 (시트 닫기·점 3개는 여기서 먼저 함)
  onClose: () => void;
  onDone: () => void;
}) {
  const head = useEnterIfMountedOpen();
  const pickBank = () => {
    onClose();
    window.setTimeout(
      () =>
        withNhLoading(() => undefined, TO_PICKER.dotsMs).then(() => {
          notePickerFromSheet();
          onBank();
        }),
      TO_PICKER.dotsAt,
    );
  };
  return (
    <>
      <div className="nh-sheet-head nh-number__head" ref={head}>
        <button className="nh-number__bank" onClick={pickBank}>
          <NhBankSquare bank={bank} size={24} />
          <span>{nhBankList([bank], bank.section)[0]?.label ?? bank.name}</span>
          <ChevronDown />
        </button>
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <NhCloseIcon />
        </button>
      </div>
      {/* 비어 있으면 1dp 회색 테두리 + "계좌번호 입력", 치기 시작하면 2dp 청록 테두리 + 숫자·커서·ⓧ */}
      <div className={`nh-number__box ${digits ? "on" : ""}`}>
        {digits ? (
          <span className="nh-number__val">
            {digits}
            {/* 숫자가 바뀔 때마다 다시 그려서 깜빡임을 처음(켜짐)부터 — 녹화1 50~56초: 입력 직후 500ms 켜짐 → 500ms 꺼짐 */}
            <i key={digits} className="nh-number__caret" />
            <button className="nh-number__clear" aria-label="지우기" onClick={() => onChange("")}>
              <ClearCircle />
            </button>
          </span>
        ) : (
          <span className="nh-number__ph">계좌번호 입력</span>
        )}
      </div>
      <Keypad kok kokLabel={<KokGlyph />} rowHeight={68.25} back={<BackArrowKey />} onKey={(k) => onChange(typeKey(digits, k))} />
      {/* 한 자리만 쳐도 '다음'이 켜짐 (녹화1 50초 "7") */}
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={!digits} onClick={onDone}>
        다음
      </button>
    </>
  );
}
