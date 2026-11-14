// T2 얼마를 보낼까요? (transfer.md §2.1 · §2.3 · §3.3–3.10 · §5.5, C3 29.2 · C2 26.0 · C3 30.7 · C3 31.05)
// 웹 화면(받는 분 · 금액 · 출금계좌 줄) + 네이티브 키패드 판(칩 · 키패드 · 다음, 화면 y 435–818, 웹 로딩 막에 덮이지 않음).
// 판이 열리고 닫힐 때 화면은 한 프레임에 다시 배치되고 판만 미끄러짐 (화면 아래끝에서 들어옴 175ms, 나감 170ms — motion.ts AO_PANEL, transfer.css).
// 다음 → 판 나감 → +133ms 계좌 비밀번호(T3) → 4번째 숫자 +50ms → password 막(483) → 이체 확인.
// 출금가능금액 부족 | 잔액채우기 → 판 나감 + topupLink 막 → 잔액채우기(T5). 돌아오면 판이 다시 들어옴
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import type { Bank } from "../../api/types";
import { aoPaths, type AoAccount, type AoHome } from "../api";
import { aoBankName } from "../bank";
import { useAoFlow } from "../flow";
import { AO_LIMITS, aoAccountNumber, aoAmountReading, aoBankLast4, aoBankLine, aoCanSend, aoDigits, aoNum, aoWon } from "../format";
import { AO_PANEL } from "../motion";
import { aoLoadingProfile, onAoLoadingHidden } from "../loading";
import { aoNativeHost, onAoNativeReset } from "../native";
import { useAoBack, useAoReturn } from "../nav";
import { useLayerActive } from "../../platform/LayerContext";
import { AoButton, AoChevronDownIcon, AoHeader, AoNativePortal, AoPage, AoSheet, aoToast } from "../ui";
import { PasswordSheet } from "./Password";
import { AmountPad, SendRow } from "./parts";
import { addMan, bankLabel, copyText, markTopupLink, padApply, type PadKey } from "./util";

type Panel = "in" | "out" | "off";
const CHIPS: [string, number][] = [
  ["+1만", 1],
  ["+5만", 5],
  ["+10만", 10],
  ["+100만", 100],
];
// 칩 x (C3 29.5): 21.65–86.93 / 92.92–157.87 / 164.2–228.81 / 235.14–300.08 / 306.08–371.02
const CHIP_X: [number, number][] = [
  [21.65, 86.93],
  [92.92, 157.87],
  [164.2, 228.81],
  [235.14, 300.08],
  [306.08, 371.02],
];
const DOWN = 133; // 다음 → 판 나감 → T3 (C3 30.996 → 31.129)
const PANEL_OUT = AO_PANEL.out; // 판 나감 (transfer.css 와 같은 수, C3 1.879–2.046 에 맞춤)
const TOAST_PANEL = 419; // 판 위 16

export function SendAmount() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  const back = useAoBack();
  const home = useApi<AoHome>(aoPaths.home);
  const banks = useApi<Bank[]>(aoPaths.banks).data;

  const bankCode = params.get("bank") ?? "";
  const number = aoDigits(params.get("number"));
  const holder = params.get("holder") ?? "";
  const [fromId, setFromId] = useState(params.get("from") ?? "main");
  const from: AoAccount | undefined = home.data?.accounts.find((a) => a.id === fromId);

  const [amount, setAmount] = useState("");
  const [panel, setPanel] = useState<Panel>("in");
  const [open, setOpen] = useState(true); // 화면 배치 (판 열림 / 닫힘) — 판이 움직이기 시작하는 프레임에 바뀜
  const [pw, setPw] = useState(false);
  const [acctSheet, setAcctSheet] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const panelIn = useCallback(() => {
    setPanel("in");
    setOpen(true);
  }, []);
  const panelOut = useCallback(() => {
    setOpen(false);
    setPanel((p) => (p === "off" ? p : "out"));
    later(PANEL_OUT + 20, () => setPanel((p) => (p === "out" ? "off" : p)));
  }, []);

  // 위 화면(잔액채우기 · 이체 확인)에서 돌아오면 판이 다시 들어옴 (C3 20.446 → 20.496).
  // 보내기 · 완료 확인 막 동안 브라우저 뒤로로 돌아왔으면 판은 그대로 둠: 막이 끝나면 이체 완료가 이 칸 위에 쌓이거나(send) 흐름 전 화면으로 감(finish).
  // 그러지 못하고 막만 걷히면(보내기 실패) 그때 판이 들어옴
  const heldPanel = useRef<(() => void) | null>(null);
  useEffect(() => () => heldPanel.current?.(), []);
  const active = useLayerActive();
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useAoReturn(() => {
    setPw(false);
    setAcctSheet(false);
    heldPanel.current?.();
    heldPanel.current = null;
    const p = aoLoadingProfile();
    if (p === "send" || p === "finish") {
      const off = onAoLoadingHidden(() => {
        off();
        heldPanel.current = null;
        if (activeRef.current) panelIn(); // 이체 완료가 위에 쌓였으면 그대로 (다음에 돌아올 때 다시 정함)
      });
      heldPanel.current = off;
      return;
    }
    panelIn();
  });
  // 녹화 다시 시작 · 로그아웃: 판은 화면과 같이 사라짐 — 남은 그림자 판만 치움
  useEffect(() => onAoNativeReset(() => document.querySelectorAll(".ao-send-ghost").forEach((g) => g.remove())), []);

  // ---- 금액 검사 (§2.3: 0 < 금액 ≤ 잔액, ≤ 500만) ----
  const n = Number(amount || 0);
  const balance = from?.balance ?? 0;
  const short = n > 0 && !!from && n > balance;
  const overLimit = n > AO_LIMITS.perTransfer && !short;
  const canNext = !!from && aoCanSend(n, balance);

  const onKey = (k: PadKey) => setAmount((v) => padApply(v, k));
  const onChip = (man: number) => setAmount((v) => addMan(v, man));
  const onAll = () => setAmount(balance > 0 ? String(Math.min(balance, 10 ** 13 - 1)) : "");

  // ---- 이동 ----
  const panelRef = useRef<HTMLDivElement>(null);
  // 이동을 받지 않을 때(잠금 중 · 맨 위 층이 아님)는 판을 움직이지 않음 (flow.canGo). 그래도 거절되면 판을 다시 올림 — 판만 내려가고 화면에 갇히지 않게
  const unlessMoved = (go: Promise<boolean>) => void go.then((ok) => !ok && panelIn());
  const onBack = () => {
    // 화면은 바로 T1 으로 CUT, 판은 그 위에서 170ms 동안 내려감 (화면과 함께 사라지지 않게 그림자 판으로). 이동했을 때만
    const el = panelRef.current;
    if (back() && panel === "in") ghostOut(el);
  };
  const onCancel = () => {
    if (!flow.canGo()) return;
    panelOut();
    unlessMoved(flow.goHomeFresh());
  };
  const onTopup = () => {
    if (!flow.canGo()) return;
    panelOut();
    markTopupLink();
    unlessMoved(flow.goTopup({ to: fromId, origin: "amount" }));
  };
  const onNext = () => {
    if (!canNext) return;
    panelOut();
    later(DOWN, () => setPw(true));
  };
  const onPwClose = () => {
    setPw(false);
    panelIn();
  };
  const onPwDone = () => {
    setPw(false);
    const q = new URLSearchParams({ from: fromId, bank: bankCode, number, holder, amount: String(n) });
    unlessMoved(flow.go(`/send/confirm?${q}`, { via: "password", prefetch: [aoPaths.home, aoPaths.banks] }));
  };
  const onAcct = () => {
    // 판이 다 들어와 있을 때만 (시트를 고르거나 닫은 뒤 판이 다시 들어오기 전의 누름이 시트를 또 열어 판과 엇갈리지 않게)
    if (acctSheet || panel !== "in") return;
    panelOut();
    later(PANEL_OUT, () => setAcctSheet(true));
  };
  const pickAcct = (id: string) => {
    setFromId(id);
    setAcctSheet(false);
    later(150, panelIn);
  };
  const closeAcct = () => {
    setAcctSheet(false);
    later(150, panelIn);
  };
  const onCopy = () => {
    copyText(number);
    aoToast("계좌번호를 복사했어요", panel === "in" ? { bottom: TOAST_PANEL } : {});
  };

  const accounts = home.data?.accounts ?? [];
  const sheetAccounts = accounts.filter((a) => a.bank.code === "nh" || a.id === fromId);
  const lay = open ? "open" : "closed";

  return (
    <AoPage className={`ao-send-amount ao-send-amount--${lay}`} header={<AoHeader variant="flow" onBack={onBack} onCancel={onCancel} />}>
      {/* 받는 분 */}
      <p className="ao-send-amount__holder">{holder}</p>
      <button type="button" className="ao-send-amount__line" onClick={onCopy}>
        <span>
          {bankLabel(banks, bankCode)} {number}
        </span>
      </button>

      {/* 금액 */}
      <div className={`ao-send-amt ao-send-amt--${lay}`}>
        {n === 0 ? (
          <p className="ao-send-amt__ph">얼마를 보낼까요?</p>
        ) : (
          <>
            <p className={`ao-send-amt__val${short || overLimit ? " ao-send-amt__val--err" : ""}`}>
              <span className="ao-num ao-send-amt__digits">{aoNum(n)}</span>
              <span className="ao-send-amt__won">원</span>
            </p>
            {short ? (
              <p className="ao-send-amt__err">
                <span className="ao-send-amt__errtext">출금가능금액 부족</span>
                <button type="button" className="ao-send-amt__link" onClick={onTopup}>
                  잔액채우기
                </button>
              </p>
            ) : overLimit ? (
              <p className="ao-send-amt__err">
                <span className="ao-send-amt__errtext">1회 이체한도 초과</span>
              </p>
            ) : (
              <p className="ao-send-amt__cap">{aoAmountReading(n)}</p>
            )}
          </>
        )}
      </div>

      {/* 출금계좌 줄: NH농협은행(끝 4자리) · 잔액 ▾ (녹화의 '한도제한' 글자는 빼기로 함) */}
      {from && (
        <button type="button" className={`ao-send-acct ao-send-acct--${lay}`} onClick={onAcct}>
          <span className="ao-send-acct__bank ao-send-acct__bank--solo">{aoBankLast4(from)}</span>
          <span className="ao-send-acct__bal">{aoWon(from.balance)}</span>
          <AoChevronDownIcon w={13} h={7.67} stroke={1.3} className="ao-send-acct__chev" />
        </button>
      )}

      {/* 네이티브 키패드 판 */}
      {panel !== "off" && (
        <AoNativePortal layer="panel">
          <div className="ao-send-panelclip" ref={panelRef}>
            <div className={`ao-send-panel ao-send-panel--${panel}`}>
              {CHIPS.map(([label, man], i) => (
                <button key={label} type="button" className="ao-send-chip" style={{ left: CHIP_X[i][0], width: CHIP_X[i][1] - CHIP_X[i][0] }} onClick={() => onChip(man)}>
                  <span className="ao-num">{label}</span>
                </button>
              ))}
              <button type="button" className="ao-send-chip" style={{ left: CHIP_X[4][0], width: CHIP_X[4][1] - CHIP_X[4][0] }} onClick={onAll}>
                <span>전액</span>
              </button>
              <AmountPad
                className="ao-send-panel__pad"
                cols={[80.9, 196.7, 312.8]} // 잉크 가운데 (C3 29.2: "1" 79.8 · "00" 80.8 · "2" 196.8 · "0" 196.65) — Roboto 글리프가 왼쪽으로 치우쳐 칸 가운데를 조금 옮김
                rows={[89.3, 149.3, 209.7, 269.7]}
                cellH={60}
                size={24}
                back={{ left: 298.12, top: 262.2 }}
                onKey={onKey}
              />
              <AoButton className="ao-send-panel__next" disabled={!canNext} pressed="native" height={56} radius={8.5} size={18.8} onPress={onNext}>
                다음
              </AoButton>
            </div>
          </div>
        </AoNativePortal>
      )}

      {/* 출금계좌 선택 (invented, T6 모양) */}
      <AoSheet open={acctSheet} title="출금계좌 선택" onClose={closeAcct} className="ao-send-acctsheet">
        {sheetAccounts.map((a) => (
          <SendRow
            key={a.id}
            code={a.bank.code}
            bank={a.bank}
            h={63}
            name={a.label}
            sub={aoBankLine(a)}
            onPress={() => pickAcct(a.id)}
            right={<span className="ao-send-acctsheet__bal">{aoWon(a.balance)}</span>}
            className={a.id === fromId ? "ao-send-row--on" : undefined}
          />
        ))}
      </AoSheet>

      <PasswordSheet open={pw} account={from ? `${aoBankName(from.bank)} ${aoAccountNumber(from)}` : ""} onClose={onPwClose} onDone={onPwDone} />
    </AoPage>
  );
}

// 판 그림자: 화면이 먼저 사라져도 판이 170ms 동안 내려가는 모습을 남김 (React 밖의 복사본, 끝나면 지움)
function ghostOut(el: HTMLElement | null) {
  const host = aoNativeHost("panel");
  if (!el || !host) return;
  const g = el.cloneNode(true) as HTMLElement;
  g.classList.add("ao-send-ghost");
  g.querySelector(".ao-send-panel")?.classList.replace("ao-send-panel--in", "ao-send-panel--out");
  host.appendChild(g);
  window.setTimeout(() => g.remove(), PANEL_OUT + 30);
}
