// S6 받는 분에게 표시 /send/memo?…(받는 분) (transfer.md §2.7, 녹화 B 104.140 자판 · 105.761 자판 없음)
//  ← · 오른쪽 '완료', 큰 제목 "토스뱅크 송금", 가운데 한 줄 (24 R) — 처음엔 지금 값이 통째로 골라져 있고 첫 키가 바꿈
//  한글 자판은 push 가 끝나고 ≈0.4초 뒤 240ms 에 올라옴, 글자 · 안내가 자판 위로 뜀. 한글 7자 · 영문 14자
//  완료 = 저장(확인 화면이 같이 봄) 후 뒤로 (pop), ← = 버리고 뒤로. 빈 칸으로 완료하면 기본값(내 이름)
//  ?tx=<출금 거래 id>: 완료 화면(S8) '메모 남기기' — 같은 꼴, 20자까지, 완료 = 거래 메모 저장 (PATCH /api/transactions/:id)
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Profile, TransactionDetail } from "../../api/types";
import { useLayerActive } from "../../platform/LayerContext";
import { tossApi } from "../api";
import { useTossBand } from "../band";
import { useTossBack, useTossBackStep } from "../nav";
import { TossAppBar, TossPage, TossPressable } from "../ui";
import { Caret } from "./common";
import { nextPop } from "./guard";
import { compose, isJamo } from "./hangul";
import { KoreanKeyboard, type KoKey } from "./KoreanKeyboard";
import { memoUnits, sendMemo } from "./store";
import "./send.css";

const TOUCH = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const KB_DELAY = 730; // push 400 + ≈0.33초 (B 100.83 → 101.56)

export function SendMemo() {
  const { search } = useLocation();
  const txId = new URLSearchParams(search).get("tx");
  const profile = useApi<Profile>(paths.profile);
  const tx = useApi<TransactionDetail>(txId ? paths.transaction(txId) : paths.profile);
  const initial = txId ? (tx.status === "done" ? ((tx.data as TransactionDetail).memo ?? "") : null) : profile.data ? (sendMemo.get() ?? profile.data.userName) : null;
  return initial === null ? (
    <MemoShell txId={txId} />
  ) : (
    <MemoEditor key={txId ?? "to"} txId={txId} initial={initial} />
  );
}

function MemoShell({ txId }: { txId: string | null }) {
  return (
    <TossPage header={<TossAppBar right={<span className="toss-send-memo__done" />} />} className="toss-send-memo" bodyClassName="toss-send-memo__body">
      <div className="toss-send-memo__in">
        <h1 className="toss-send-memo__h1">{txId ? "메모 남기기" : "토스뱅크 송금"}</h1>
      </div>
    </TossPage>
  );
}

function MemoEditor({ txId, initial }: { txId: string | null; initial: string }) {
  const back = useTossBack();
  const active = useLayerActive();
  const [committed, setCommitted] = useState(initial);
  const [seq, setSeq] = useState<string[]>([]);
  const [selected, setSelected] = useState(initial.length > 0);
  const [kb, setKb] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const composing = compose(seq);
  const text = committed + composing;
  const fits = (s: string) => (txId ? [...s].length <= 20 : memoUnits(s) <= 14);

  useEffect(() => {
    const t = window.setTimeout(() => setKb(true), KB_DELAY);
    return () => window.clearTimeout(t);
  }, []);
  const kbUp = kb && active && !TOUCH;
  useTossBackStep(kbUp, () => setKb(false));
  useTossBand(kbUp ? "kb" : null); // 자판이 떠 있는 동안 아래 띠도 자판 색
  useEffect(() => {
    if (!active || !(kb || !TOUCH)) return;
    input.current?.focus({ preventScroll: true });
    if (selected) input.current?.select(); // 실제 키보드로 쳐도 골라 둔 글자를 바꿈
  }, [active, kb, selected]);

  const onKey = (k: KoKey) => {
    if (k.t === "hide" || k.t === "done") {
      // 자판을 내리면 조합 중인 글자를 확정
      setCommitted(committed + composing);
      setSeq([]);
      return setKb(false);
    }
    if (k.t === "back") {
      if (selected) {
        setSelected(false);
        setCommitted("");
        setSeq([]);
      } else if (seq.length) setSeq(seq.slice(0, -1));
      else setCommitted([...committed].slice(0, -1).join(""));
      return;
    }
    const base = selected ? "" : committed;
    const baseSeq = selected ? [] : seq;
    if (isJamo(k.v)) {
      const nextSeq = [...baseSeq, k.v];
      if (!fits(base + compose(nextSeq))) return;
      setCommitted(base);
      setSeq(nextSeq);
    } else {
      const next = base + compose(baseSeq) + k.v;
      if (!fits(next)) return;
      setCommitted(next);
      setSeq([]);
    }
    setSelected(false);
  };
  // 실제 키보드 · 폰 키보드 (숨은 입력칸)
  const onInput = (v: string) => {
    let s = v;
    while (s && !fits(s)) s = [...s].slice(0, -1).join("");
    setCommitted(s);
    setSeq([]);
    setSelected(false);
  };

  // 자판이 쌓아 둔 방문 기록 칸을 먼저 빼고 뒤로
  const leave = async () => {
    if (kbUp) {
      setKb(false);
      await nextPop();
    }
    back();
  };
  const finish = async () => {
    if (saving) return;
    const v = text.trim();
    if (txId) {
      setSaving(true);
      try {
        await tossApi.updateTransaction(txId, { memo: v });
      } catch {
        setSaving(false);
        return;
      }
    } else sendMemo.set(v ? v : null);
    leave();
  };

  // 조합 중인 마지막 글자에 밑줄
  const last = seq.length ? [...composing].slice(-1)[0] : "";
  const head = seq.length ? committed + [...composing].slice(0, -1).join("") : committed;
  return (
    <TossPage
      header={
        <TossAppBar
          onBack={leave}
          right={
            <TossPressable className="toss-send-memo__done" radius={8} color="#2a2a2e" onPress={finish}>
              완료
            </TossPressable>
          }
        />
      }
      className={`toss-send-memo${kbUp ? " toss-send-memo--kb" : ""}`}
      bodyClassName="toss-send-memo__body"
    >
      <div className="toss-send-memo__in">
        <h1 className="toss-send-memo__h1">{txId ? "메모 남기기" : "토스뱅크 송금"}</h1>
        <div className="toss-send-memo__text" onClick={() => setKb(true)}>
          {selected ? (
            <span className="toss-send-memo__sel">{text}</span>
          ) : (
            <>
              {head}
              {last && <span className="toss-send-memo__comp">{last}</span>}
              {!text && txId && !kbUp && <span className="toss-send-memo__ph">메모를 입력해주세요</span>}
            </>
          )}
          {(kbUp || TOUCH) && <Caret h={31} />}
        </div>
        <p className="toss-send-memo__cap">{txId ? "20자까지 입력 가능" : "한글은 7자, 영문은 14자까지 입력 가능"}</p>
        <input
          ref={input}
          className="toss-send-hidden-input"
          value={text}
          autoComplete="off"
          aria-label={txId ? "메모" : "받는 분에게 표시"}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish();
            else if (e.key === "Backspace" && selected) {
              e.preventDefault();
              onKey({ t: "back" });
            }
          }}
        />
      </div>
      {!TOUCH && <KoreanKeyboard open={kbUp} onKey={onKey} />}
    </TossPage>
  );
}
