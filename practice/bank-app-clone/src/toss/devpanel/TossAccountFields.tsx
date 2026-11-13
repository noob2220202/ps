import { useState } from "react";
import type { Account } from "../../api/types";
import { tossApi, type TossAccount } from "../api";
import { PanelField, PanelSeg } from "./fields";
import type { TossRun } from "./types";
import "./panel.css";

// 🔔 관리 → 계좌 → 계좌 하나를 펼친 칸 안 토스만의 칸 (plan.md §2.5):
//  개설일 (증명서 '어떤 계좌의 증명서를' 의 개설일) · ★ 즐겨찾기 (어디로 보낼까요 내 계좌 ★) · 토스머니로 표시 (홈 둘째 줄 · 자산 · 내 계좌)
export function TossAccountFields({ account, run }: { account: Account; run: TossRun }) {
  const a = account as TossAccount;
  const [opened, setOpened] = useState(a.openedAt ?? "");
  const main = a.kind === "main";
  return (
    <div className="toss-assets-panel__box">
      <strong>토스</strong>
      <PanelField label="개설일 (증명서 계좌 고르기 '개설일')">
        <div className="row">
          <input type="date" value={opened} onChange={(e) => setOpened(e.target.value)} />
          <button type="button" className="btn btn--sm" onClick={() => run(() => tossApi.updateAccount(a.id, { openedAt: opened || null }), opened ? "개설일을 바꿨어요" : "개설일을 지웠어요")}>
            저장
          </button>
        </div>
      </PanelField>
      <PanelSeg
        label="★ 즐겨찾기 (어디로 보낼까요 · 내 계좌)"
        value={a.favorite ? "on" : "off"}
        options={[
          ["on", "켜기"],
          ["off", "끄기"],
        ]}
        onChange={(v) => (v === "on") !== !!a.favorite && run(() => tossApi.updateAccount(a.id, { favorite: v === "on" }), v === "on" ? "즐겨찾기에 넣었어요" : "즐겨찾기에서 뺐어요")}
      />
      {!main && (
        <PanelSeg
          label="토스머니로 보이기 (홈 둘째 줄 · 자산 · 내 계좌)"
          value={a.role === "money" ? "money" : "plain"}
          options={[
            ["money", "토스머니"],
            ["plain", "보통 계좌"],
          ]}
          onChange={(v) =>
            (v === "money") !== (a.role === "money") &&
            run(() => tossApi.updateAccount(a.id, { role: v === "money" ? "money" : null }), v === "money" ? "토스머니로 표시해요" : "보통 계좌로 표시해요")
          }
        />
      )}
    </div>
  );
}
