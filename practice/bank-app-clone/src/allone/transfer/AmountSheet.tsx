// T7 금액 입력 (transfer.md §2.7 · §3.13–3.15, C3 5.579–11.696): 네이티브 시트 (창 전체 막 .765, 위 224, r 24),
// 막은 한 프레임에, 시트는 +64ms(금액 칸을 누르면 +46ms)부터 357ms 올라옴. 상태바 글자는 흰색 (AoNativeSheet 가).
// 숫자를 누르면 "0" 은 바로 사라지고 "원" 은 검정, 새 숫자는 30pt 위에서 흐리게(.1 → .3) 250ms 내려온 뒤 또렷 (다음 누름에 바로 또렷)
// 확인 = 금액을 칸에 넣고 닫힘, × = 그대로 닫힘. 닫힘 145ms 미끄러짐 + 막 370ms 남음
import { useState } from "react";
import { aoAmountReading, aoNum } from "../format";
import { AO_AMOUNT_SHEET } from "../motion";
import { AoButton, AoNativeSheet } from "../ui";
import { AmountPad } from "./parts";
import { addMan, padApply, type PadKey } from "./util";

const CHIPS: [string, number, number, number][] = [
  // 글자, 만, x 왼쪽, x 오른쪽 (C3 6.5)
  ["+ 1만원", 1, 24, 105.6],
  ["+ 5만원", 5, 111.6, 193.5],
  ["+ 10만원", 10, 199.8, 281.4],
  ["+ 100만원", 100, 287.4, 369],
];

export function AmountSheet({
  open,
  initial,
  riseDelay,
  onConfirm,
  onClose,
  onClosed,
}: {
  open: boolean;
  initial: number;
  riseDelay: number;
  onConfirm: (amount: number) => void;
  onClose: () => void;
  onClosed?: () => void; // 막까지 다 사라진 뒤
}) {
  const [value, setValue] = useState("");
  const [roll, setRoll] = useState({ key: 0, n: 0 }); // 마지막 누름으로 새로 들어온 숫자 개수 (굴러 내려오는 중)
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(initial > 0 ? String(initial) : "");
      setRoll({ key: 0, n: 0 });
    }
  }

  const onKey = (k: PadKey) => {
    const next = padApply(value, k, 10);
    const added = k === "back" ? 0 : Math.max(0, next.length - value.length);
    setValue(next);
    setRoll((r) => ({ key: r.key + 1, n: added }));
  };
  const onChip = (man: number) => {
    setValue((v) => addMan(v, man, 10));
    setRoll((r) => ({ key: r.key + 1, n: 0 }));
  };

  const n = Number(value || 0);
  // 글자마다 따로 (쉼표 포함). 끝에서 roll.n 개 숫자가 굴러 들어오는 중
  const chars = n > 0 ? [...aoNum(n)] : [];
  let left = roll.n;
  const rolling = new Set<number>();
  for (let i = chars.length - 1; i >= 0 && left > 0; i--) {
    rolling.add(i);
    if (/\d/.test(chars[i])) left--;
  }

  // 키패드 칸 가운데: 녹화 숫자 잉크 가운데 (C3 6.5: 열 80.2 / 196.4 / 311.8, 줄 484.7 / 550.4 / 615.7 / 681.3) 에 Roboto 글리프 치우침만큼 맞춤
  return (
    <AoNativeSheet open={open} level="amount" title="금액 입력" riseDelay={riseDelay} onClose={onClose} onClosed={onClosed} className="ao-send-t7">
      <p className={`ao-send-t7__amt${n > 0 ? " ao-send-t7__amt--on" : ""}`}>
        {n > 0 ? (
          <span className="ao-num ao-send-t7__digits">
            {chars.map((c, i) =>
              rolling.has(i) ? (
                <span key={`r${roll.key}-${i}`} className="ao-send-t7__roll" style={{ animationDuration: `${AO_AMOUNT_SHEET.digitRoll}ms` }}>
                  {c}
                </span>
              ) : (
                <span key={`s${i}`}>{c}</span>
              ),
            )}
          </span>
        ) : (
          <span className="ao-num ao-send-t7__zero">0</span>
        )}
        <span className="ao-send-t7__won">원</span>
      </p>
      {n > 0 && <p className="ao-send-t7__cap">{aoAmountReading(n)}</p>}
      {CHIPS.map(([label, man, x0, x1]) => (
        <button key={label} type="button" className="ao-send-t7__chip" style={{ left: x0, width: x1 - x0 }} onClick={() => onChip(man)}>
          <span>{label}</span>
        </button>
      ))}
      <AmountPad cols={[80.6, 196.3, 312]} rows={[261, 326.4, 391.9, 457.2]} cellH={65.5} size={25} back={{ left: 297.99, top: 450.63 }} onKey={onKey} />
      <AoButton className="ao-send-t7__ok" pressed="native" height={56} radius={5.5} size={17.6} weight={500} onPress={() => onConfirm(n)}>
        확인
      </AoButton>
    </AoNativeSheet>
  );
}
