// S4 토스뱅크 송금 (금액) /send/amount?from=&to= · ?from=&bank=&number= (transfer.md §2.4 · §2.5, 녹화 B 45.030 · 48.212 · A 130.500)
//  들어오면 ← 만 → 제목이 0.33초 뒤 250ms 에 나타남 → 내용 (잔액 로딩중 · 사기계좌 조회중 칩) → 잔액 → 조회 끝 (방패 + 번호, '내 ' 붙음)
//  화면 안 숫자판(1–9 · 00 · 0 · ←). 금액 > 0 이면 '다음' 막대가 130ms 에 올라옴. 잔액보다 많으면 빨간 글 + 다음 꺼짐
//  다음: 찾은 받는 분 → 확인(S5, cut). 못 찾은 번호 → 점 0.44초 → D1 "계좌번호를 찾을 수 없어요" (웹 영역만 어둡게)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { applyKey, type PadKey } from "../../lib/keypad";
import { useLayerActive } from "../../platform/LayerContext";
import { num, won } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar, TossButton, TossDialog, TossPage, TossSpinner } from "../ui";
import { AmountKeypad } from "./AmountKeypad";
import { Caret, LoadChip, Shield } from "./common";
import { accountLine, sendMemo, toLabel, verbAsk } from "./store";
import { useKeyed, useRevisit } from "./keyed";
import { targetQuery, useSendParams, useSendTarget } from "./target";
import "./send.css";

const MAX_LEN = 9;
const LIMIT = 10_000_000; // 서버: 한 번에 1천만원까지
const SHOW_MIN = 350; // push 가 거의 끝날 때까지 빈 화면 (녹화의 기다림을 줄인 값)
const BAL_AT = 250; // 내용이 나온 뒤 잔액
const CHECK_AT = 750; // 내용이 나온 뒤 사기계좌 조회 끝 ('내 ' · 방패)
const DOTS_MS = 440; // 못 찾은 번호: 다음 → 점 → 안내창

export function SendAmount() {
  const p = useSendParams();
  const res = useSendTarget(p);
  const go = useTossGo();
  const active = useLayerActive();
  // 확인 화면에서 돌아오면 (다시 그려짐) 금액 그대로, 들어올 때의 기다림 없이
  const revisit = useRevisit("amt");
  const [amount, setAmount] = useKeyed("amt", "");
  const [shownAt, setShownAt] = useState<number | null>(() => (revisit ? -1e6 : null));
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialogState] = useState<{ title: string; body: string; open: boolean }>({ title: "", body: "", open: false });
  const setDialog = (d: { title: string; body: string } | null) => setDialogState((s) => (d ? { ...d, open: true } : { ...s, open: false }));
  const [mountAt] = useState(() => performance.now());

  const loaded = res.status !== "loading" && !!res.from;
  // 내용 나타남 · 그 뒤 단계 (잔액 → 조회 끝)
  useEffect(() => {
    if (!loaded || shownAt !== null) return;
    const t = window.setTimeout(() => setShownAt(performance.now()), Math.max(0, SHOW_MIN - (performance.now() - mountAt)));
    return () => window.clearTimeout(t);
  }, [loaded, shownAt, mountAt]);
  useEffect(() => {
    if (shownAt === null) return;
    const ts = [BAL_AT, CHECK_AT].map((ms) => window.setTimeout(() => setNow(performance.now()), ms + 5));
    return () => ts.forEach(window.clearTimeout);
  }, [shownAt]);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 700);
    return () => window.clearTimeout(t);
  }, []);
  const since = shownAt === null ? -1 : Math.max(now, shownAt) - shownAt;
  const balShown = since >= BAL_AT;
  const checked = since >= CHECK_AT;

  const t = res.target;
  const from = res.from;
  const value = Number(amount || 0);
  const resolved = res.status === "ready";
  const err =
    from && value > from.balance ? `출금할 수 있는 돈이 ${won(from.balance)}이에요.` : value > LIMIT ? "한 번에 1,000만원까지 보낼 수 있어요." : null;

  const onKey = (k: PadKey) => {
    if (busy) return;
    setAmount((a) => applyKey(a, k, MAX_LEN));
  };
  // 실제 키보드로도 (숫자 · ← · Enter)
  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!active || shownAt === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[0-9]$/.test(e.key)) onKey(e.key as PadKey);
      else if (e.key === "Backspace") onKey("back");
      else if (e.key === "Enter") nextRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const next = () => {
    if (busy || value <= 0 || err || dialog.open) return;
    if (res.status === "loading") return;
    if (!resolved) {
      setBusy(true);
      window.setTimeout(() => {
        setBusy(false);
        setDialog(
          res.status === "notfound"
            ? { title: "계좌번호를 찾을 수 없어요", body: "돈을 보내려는 계좌번호를 다시 확인해주세요." }
            : { title: "잠시 후 다시 시도해주세요", body: res.message ?? "받는 분 계좌를 확인하지 못했어요." },
        );
      }, DOTS_MS);
      return;
    }
    if (t?.kind === "own" && t.accountId === p.from) {
      setDialog({ title: "같은 계좌로는 보낼 수 없어요", body: "돈을 받을 다른 계좌를 골라주세요." });
      return;
    }
    sendMemo.set(null);
    go(`/send/confirm?${targetQuery(p)}&amount=${value}`);
  };
  useEffect(() => {
    nextRef.current = next;
  });

  // '원' 이 오른쪽으로 비켜남 (FLIP)
  const wonRef = useRef<HTMLSpanElement>(null);
  const lastX = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = wonRef.current;
    if (!el) return void (lastX.current = null);
    const x = el.getBoundingClientRect().left;
    if (lastX.current !== null && Math.abs(lastX.current - x) > 0.5) {
      el.style.transition = "none";
      el.style.transform = `translateX(${lastX.current - x}px)`;
      void el.offsetWidth;
      el.style.transition = "";
      el.style.transform = "";
    }
    lastX.current = x;
  }, [amount]);

  const lbl = t ? toLabel(t) : null;
  const fromName = `${resolved && checked ? "내 " : ""}${from?.label ?? ""}`;
  return (
    <TossPage header={<TossAppBar title={<span className="toss-send-amt__title">토스뱅크 송금</span>} />} className="toss-send-amt" bodyClassName="toss-send-amt__body">
      <div className="toss-send-amt__in">
        {shownAt === null ? (
          res.status === "error" && !from ? (
            <p className="toss-send-amt__fail">{res.message ?? "잠시 후 다시 시도해주세요."}</p>
          ) : slow ? (
            <TossSpinner className="toss-send-amt__spin" />
          ) : null
        ) : (
          <div className="toss-send-amt__content">
            <p className="toss-send-line toss-send-amt__from">
              <b>{fromName}</b>
              <span>에서</span>
            </p>
            <p className="toss-send-line toss-send-amt__bal">
              {balShown && from ? (
                <>
                  잔액 <em>{won(from.balance)}</em>
                </>
              ) : (
                <LoadChip>잔액 로딩중</LoadChip>
              )}
            </p>
            {t && lbl && (
              <>
                <p className={`toss-send-line toss-send-amt__to${t.kind === "typed" ? " toss-send-amt__to--grey" : ""}`}>
                  <b>{lbl.label}</b>
                  <span>{lbl.particle}</span>
                </p>
                <p className="toss-send-line toss-send-amt__tosub">
                  {t.kind === "own" ? (
                    accountLine(t)
                  ) : checked ? (
                    <>
                      <Shield />
                      {accountLine(t, t.kind === "typed")}
                    </>
                  ) : (
                    <LoadChip>사기계좌 조회중</LoadChip>
                  )}
                </p>
              </>
            )}
            <div className="toss-send-amt__amount">
              {amount === "" ? (
                <span className="toss-send-amt__ph">
                  <Caret h={29} />
                  얼마나 {verbAsk(t)}
                </span>
              ) : (
                <span className="toss-send-amt__val">
                  {value > 0 &&
                    num(value)
                      .split("")
                      .map((c, i) => <i key={i}>{c}</i>)}
                  <span className="toss-send-amt__won" ref={wonRef}>
                    원
                  </span>
                </span>
              )}
            </div>
            {err && <p className="toss-send-line toss-send-amt__err">{err}</p>}
          </div>
        )}
        {value > 0 && (
          <div className="toss-send-amt__bar">
            <TossButton bar disabled={!!err} loading={busy} onPress={next}>
              다음
            </TossButton>
          </div>
        )}
        <AmountKeypad onKey={onKey} />
      </div>
      <TossDialog open={dialog.open} title={dialog.title} body={dialog.body} onClose={() => setDialog(null)} />
    </TossPage>
  );
}
