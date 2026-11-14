import { useState } from "react";
import { useApi } from "../../api/useApi";
import type { Transaction } from "../../api/types";
import { tossApi, tossPaths, type TossCard, type TossChannel } from "../api";
import { PanelField, PanelSeg } from "./fields";
import type { TossRun } from "./types";
import "./panel.css";

// 소비 분류 (서버 색표와 같은 이름 — 소비 막대 · 범례 · 줄 아이콘). 비우면 서버가 계산 (#이체 → 이체, 그 밖 → 카테고리 없음)
const CATEGORIES = ["이체", "식비", "카페·간식", "편의점·마트", "쇼핑", "교통", "문화·여가", "교육", "카테고리 없음", "캐시백", "이자"];
const CHANNELS: [TossChannel | "auto", string][] = [
  ["auto", "자동"],
  ["card", "카드"],
  ["account", "입·출금"],
  ["pay", "페이·기타"],
];
const OnOff: ["on" | "off", string][] = [
  ["on", "켜기"],
  ["off", "끄기"],
];

// 🔔 관리 → 거래 → 거래 하나를 고치는 칸 안 토스만의 칸 (plan.md §2.5). 저장은 이 칸이 따로 (tossApi.updateTransaction)
//  분류 · 결제 수단 · 카드 · 취소됨 · 소비에서 제외 → 거래내역 아이콘 · 상세 · 소비 (합계 · 막대 · 주간 달력 · 줄 색)
export function TossTxFields({ tx, run }: { tx: Transaction; run: TossRun }) {
  const cards = useApi<TossCard[]>(tossPaths.cards);
  const known = !tx.category || CATEGORIES.includes(tx.category);
  const [category, setCategory] = useState(tx.category ?? "");
  const [custom, setCustom] = useState(!known);
  // 서버는 비어 있는 결제 수단을 거래 종류로 채워 보냄 (#체크카드 → 카드, 그 밖 → 입·출금). 그 값과 같으면 '자동'으로 보임
  //  (저장하면 비워 둠 → 나중에 위의 거래 종류를 바꾸면 결제 수단도 따라감)
  const derived: TossChannel = tx.tag === "#체크카드" ? "card" : "account";
  const [channel, setChannel] = useState<TossChannel | "auto">(!tx.channel || tx.channel === derived ? "auto" : tx.channel);
  const [cardId, setCardId] = useState(tx.cardId ?? "");
  const [cancelled, setCancelled] = useState(!!tx.cancelled);
  const [exclude, setExclude] = useState(!!tx.exclude);
  return (
    <div className="toss-assets-panel__box">
      <strong>토스 소비</strong>
      <PanelField label="분류 (비우면 자동: 이체 / 카테고리 없음)">
        {custom ? (
          <div className="row">
            <input value={category} maxLength={20} placeholder="새 분류 이름" onChange={(e) => setCategory(e.target.value)} />
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => (setCustom(false), setCategory(""))}>
              목록
            </button>
          </div>
        ) : (
          <select value={category} onChange={(e) => (e.target.value === "__custom" ? (setCustom(true), setCategory("")) : setCategory(e.target.value))}>
            <option value="">자동</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__custom">직접 입력…</option>
          </select>
        )}
      </PanelField>
      <PanelSeg label="결제 수단 (소비 탭)" value={channel} options={CHANNELS} onChange={setChannel} />
      <PanelField label="카드 (소비 줄 아래 글자 · 자산 카드 이번 달 쓴 돈)">
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">없음</option>
          {cards.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </PanelField>
      <div className="row">
        <div style={{ flex: 1 }}>
          <PanelSeg label="취소됨 (취소선 · 합계에서 빠짐)" value={cancelled ? "on" : "off"} options={OnOff} onChange={(v) => setCancelled(v === "on")} />
        </div>
        <div style={{ flex: 1 }}>
          <PanelSeg label="소비에서 제외 (회색)" value={exclude ? "on" : "off"} options={OnOff} onChange={(v) => setExclude(v === "on")} />
        </div>
      </div>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() =>
          run(
            () =>
              tossApi.updateTransaction(tx.id, {
                category: category.trim() || null,
                channel: channel === "auto" ? null : channel,
                cardId: cardId || null,
                cancelled,
                exclude,
              }),
            "소비 정보를 바꿨어요",
          )
        }
      >
        토스 소비 저장
      </button>
    </div>
  );
}
