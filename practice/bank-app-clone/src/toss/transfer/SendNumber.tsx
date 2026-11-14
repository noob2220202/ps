// S2 어떤 계좌로 보낼까요? /send/number?from= (transfer.md §2.2, 녹화 B 11.111 · 14.678 · 16.679 · 29.936 · 36.981)
//  들어오면 번호 칸에 바로 커서, 삼성 숫자 자판은 push 가 끝나고 ≈0.5초 뒤 180ms 에 올라옴 (아래 띠 kb)
//  0–6자리: 안내 "계좌번호를 입력하면 은행을 찾아드릴게요." (+ 내 계좌와 앞자리가 같으면 '내 … 입력' 알약)
//  7자리 이상: 치는 동안 "··· 은행을 찾는 중이에요" → 0.35초 쉬면 은행 칩 3개 (350ms 나타남)
//  은행 칸 → 자판 내림 + S3 은행 선택 시트. 은행이 정해지면 '확인' (자판 위 20 / 자판이 없으면 아래) → 금액(S4)
import { useEffect, useMemo, useRef, useState } from "react";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Bank, TransferRecipients } from "../../api/types";
import { HanaKeyboard, type KbKey } from "../../hana/HanaKeyboard";
import "../../hana/hana-send.css"; // .hana-kb* 를 그대로 씀 — 토스만 바꿀 것은 send.css 에 html[data-app="toss"] .hana-kb… 로 (hana 규칙은 고치지 않음)
import { useLayerActive } from "../../platform/LayerContext";
import { TOSS_BANK_TILES, TOSS_SEC_TILES, type TossBankTile } from "../bank";
import { useTossBack, useTossBackStep, useTossGo } from "../nav";
import { ClearIcon, TossAppBar, TossButton, TossPage, TossPressable, TossSheet } from "../ui";
import { BankGlyph, Caret } from "./common";
import { nextPop } from "./guard";
import { useKeyed, useRevisit } from "./keyed";
import { bankFull, digitsOf } from "./store";
import { useSendParams } from "./target";
import "./send.css";

const TOUCH = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const MAX = 16;
const KB_DELAY = 870; // 들어온 뒤 자판이 올라오기 시작할 때까지 (push 400 + 0.47초)
const CHIP_IDLE = 350;
const LABEL: Record<string, string> = Object.fromEntries([...TOSS_BANK_TILES, ...TOSS_SEC_TILES].filter((t) => t.code).map((t) => [t.code!, t.label]));
const FALLBACK = ["nh", "kakao", "kb", "toss", "shinhan", "woori", "hana"];

export function SendNumber() {
  const { from } = useSendParams();
  const go = useTossGo();
  const back = useTossBack();
  const active = useLayerActive();
  const rec = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  // 금액 화면에서 돌아와도 번호 · 은행은 그대로, 자판은 칸을 누를 때만
  const revisit = useRevisit("num");
  const [digits, setDigits] = useKeyed("num", "");
  const [bankCode, setBankCode] = useKeyed<string | null>("bank", null);
  const [focus, setFocus] = useState(!revisit);
  const [kb, setKb] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [idle, setIdle] = useState(revisit);
  const input = useRef<HTMLInputElement>(null);
  const idleTimer = useRef(0);

  // 자판은 들어오고 조금 뒤 (그 사이 칸을 떠났으면 안 올림)
  useEffect(() => {
    if (revisit) return;
    const t = window.setTimeout(() => setKb(true), KB_DELAY);
    return () => window.clearTimeout(t);
  }, [revisit]);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  // 숨은 입력칸에 초점 (실제 키보드 · 폰 키보드)
  useEffect(() => {
    if (focus && active && !sheet) input.current?.focus({ preventScroll: true });
    else input.current?.blur();
  }, [focus, active, sheet]);

  const kbUp = kb && focus && !sheet && active && !TOUCH;
  const closeKb = () => {
    setKb(false);
    setFocus(false);
  };
  useTossBackStep(kbUp, closeKb);

  const setNumber = (next: string) => {
    const v = digitsOf(next).slice(0, MAX);
    if (v === digits) return;
    setDigits(v);
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), CHIP_IDLE);
  };
  const onKey = (k: KbKey) => {
    if (k === "hide" || k === "enter") return closeKb();
    if (k === "back") return setNumber(digits.slice(0, -1));
    setNumber(digits + k);
  };
  const openField = () => {
    setFocus(true);
    setKb(true);
  };
  // 자판이 쌓아 둔 방문 기록 칸이 빠진 뒤에 (시트 · 뒤로가 그 칸을 잘못 잡지 않게)
  const afterKb = (fn: () => void) => {
    const had = kbUp;
    closeKb();
    if (had) nextPop().then(fn);
    else fn();
  };
  const openSheet = () => afterKb(() => setSheet(true));

  const bank = banks.data?.find((b) => b.code === bankCode) ?? null;
  // 앞자리가 같은 내 계좌 (토스머니는 번호를 안 보여 줌)
  const own = useMemo(() => {
    if (!digits || digits.length > 6) return null;
    return rec.data?.mine.find((m) => m.role !== "money" && digitsOf(m.number).startsWith(digits)) ?? null;
  }, [digits, rec.data]);
  // 은행 칩 (녹화의 칩은 쓰지 않고 정해진 규칙으로): 내 계좌 · 받는 분 번호가 같은 은행 → 자리수가 맞는 은행 → 토스 순서
  const chips = useMemo(() => {
    if (digits.length < 7) return [];
    const out: string[] = [];
    const add = (c: string) => LABEL[c] && !out.includes(c) && out.length < 3 && out.push(c);
    for (const r of [...(rec.data?.mine ?? []), ...(rec.data?.recent ?? []), ...(rec.data?.favorites ?? [])]) if (digitsOf(r.number).startsWith(digits)) add(r.bank.code);
    for (const t of TOSS_BANK_TILES) {
      const b = banks.data?.find((x) => x.code === t.code);
      if (b?.pattern && [b.pattern, b.alt].some((p) => p && p.reduce((a, n) => a + n, 0) === digits.length)) add(b.code);
    }
    FALLBACK.forEach(add);
    return out;
  }, [digits, rec.data, banks.data]);

  const ok = !!bankCode && digits.length > 0;
  const submit = () => {
    if (!ok) return;
    closeKb();
    go(`/send/amount?from=${encodeURIComponent(from)}&bank=${bankCode}&number=${digits}`);
  };
  const pickTile = (t: TossBankTile) => {
    if (!t.code) return; // 교보SBI저축은행: 코드 없음
    setBankCode(t.code);
    setSheet(false);
  };

  const empty = digits.length === 0;
  const kbShown = kbUp;
  return (
    <TossPage header={<TossAppBar onBack={() => afterKb(back)} />} className={`toss-send-num${empty ? " toss-send-num--empty" : ""}`} bodyClassName="toss-send-num__body">
      <div className="toss-send-num__in">
        <h1 className="toss-send-num__h1">어떤 계좌로 보낼까요?</h1>
        <div className={`toss-send-field toss-send-num__number${focus && !sheet ? " toss-send-field--focus" : ""}`}>
          <span className="toss-send-field__label">계좌번호 입력</span>
          <div className="toss-send-num__tap" onClick={openField} />
          <span className="toss-send-num__value" onClick={openField}>
            {digits}
            {focus && !sheet && <Caret h={33} />}
          </span>
          {digits && focus && !sheet && (
            <TossPressable className="toss-send-num__clear" radius={18} onPress={() => setNumber("")} ariaLabel="지우기">
              <ClearIcon size={25.6} color="#403f42" knock="#171619" />
            </TossPressable>
          )}
          <i className="toss-send-field__line" />
          <input
            ref={input}
            className="toss-send-hidden-input"
            value={digits}
            inputMode="numeric"
            autoComplete="off"
            aria-label="계좌번호"
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && closeKb()}
            onFocus={() => !focus && openField()}
          />
        </div>
        <div className="toss-send-num__shift">
          <div className={`toss-send-field toss-send-num__bank${sheet ? " toss-send-field--active" : ""}`} onClick={openSheet} role="button" aria-label="은행 선택">
            <span className="toss-send-field__label" style={{ opacity: bank ? 1 : 0 }}>
              은행 선택
            </span>
            <span className="toss-send-num__bankph" style={{ opacity: bank ? 0 : 1 }}>
              은행 선택
            </span>
            {bank && <span className="toss-send-num__bankval">{bankFull(bank)}</span>}
            <svg className="toss-send-num__chev" width="12.8" height="7.2" viewBox="0 0 12.8 7.2" fill="none" aria-hidden>
              <path d="M.9.9l5.5 5.5L11.9.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <i className="toss-send-field__line" />
          </div>
          <div className="toss-send-num__under">
            {bank ? null : digits.length < 7 ? (
              <span className="toss-send-num__hint">계좌번호를 입력하면 은행을 찾아드릴게요.</span>
            ) : !idle ? (
              <span className="toss-send-num__finding">
                <span className="toss-send-num__dots">
                  <i />
                  <i />
                  <i />
                </span>
                은행을 찾는 중이에요
              </span>
            ) : (
              <div className="toss-send-num__chips" key={digits}>
                {chips.map((c) => (
                  <TossPressable key={c} className="toss-send-chip" radius={6.4} onPress={() => setBankCode(c)}>
                    <BankGlyph code={c} size={12.8} />
                    {LABEL[c]}
                  </TossPressable>
                ))}
              </div>
            )}
          </div>
        </div>
        {own && !bank && kbShown && (
          <TossPressable
            className="toss-send-num__pill"
            radius={8}
            onPress={() => {
              setNumber(digitsOf(own.number));
              setBankCode(own.bank.code);
            }}
          >
            내 {bankFull(own.bank)} {digitsOf(own.number)} 입력
          </TossPressable>
        )}
        {ok && (
          <div className={`toss-send-num__ok${kbShown ? " toss-send-num__ok--kb" : ""}`}>
            <TossButton onPress={submit}>확인</TossButton>
          </div>
        )}
      </div>
      {!TOUCH && (
        <div className="toss-send-kbwrap">
          <HanaKeyboard open={kbShown} onKey={onKey} />
        </div>
      )}
      <TossSheet open={sheet} onClose={() => setSheet(false)} title="은행을 선택해주세요" top={169.7} className="toss-send-sheet">
        <BankGrid tiles={TOSS_BANK_TILES} onPick={pickTile} />
        <h3 className="toss-send-grid__sec">증권사 선택</h3>
        <BankGrid tiles={TOSS_SEC_TILES} onPick={pickTile} />
      </TossSheet>
    </TossPage>
  );
}

// S3 은행 선택 격자: 타일 99 × 85, 3칸, 간격 8.8, #28272a, 글리프 높이 24 · 가로로 긴 것은 28 폭까지 (타일 위 +16), 이름 14 M (잉크 위 +54.3)
function BankGrid({ tiles, onPick }: { tiles: TossBankTile[]; onPick: (t: TossBankTile) => void }) {
  return (
    <div className="toss-send-grid">
      {tiles.map((t) => (
        <TossPressable key={t.label} className="toss-send-tile" radius={10} color="#323135" fadeIn={100} onPress={() => onPick(t)}>
          {t.code && <BankGlyph code={t.code} size={24} w={28} />}
          <span className="toss-send-tile__label">{t.label}</span>
        </TossPressable>
      ))}
    </div>
  );
}
