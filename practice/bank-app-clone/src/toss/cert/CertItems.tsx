import { useEffect, useMemo, useState } from "react";
import { paths } from "../../api/endpoints";
import type { TransferRecord } from "../../api/types";
import { useApi } from "../../api/useApi";
import { TossBottomDock, TossButton, TOSS_DOCK_SPACE } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { certAmount, certFilter, certGroups, certHm, certUrl, CERT_T, useCertQuery, type CertGroup } from "./data";
import { CertBar, CertCheckCircle, CertChevronDown, CertFieldSearchIcon, CertTitle } from "./parts";
import { useCertNext, useCertPhase, useCertRevisit } from "./steps";
import "./cert.css";

// 본문 좌표 (화면 y − 81.6)
const GROUPS_TOP = 253.6; // 첫 날짜 칸 위 (335.2)
const DAY_H = 40; // 날짜 칸 (잉크 위끝 +19.3)
const TX_H = 72; // 거래 줄 (375.2–447.2)
const PRESS = "rgba(255,255,255,0.075)"; // 최고 #29282b
// 날짜 묶음 자리: 날짜 칸 40 + 거래 72 씩 (녹화 날짜 잉크 위끝 간격 112 = 한 건짜리 묶음)
const placeGroups = (groups: CertGroup[]) =>
  groups.reduce<(CertGroup & { top: number; bottom: number })[]>((out, g) => {
    const top = out.at(-1)?.bottom ?? GROUPS_TOP;
    out.push({ ...g, top, bottom: top + DAY_H + g.items.length * TX_H });
    return out;
  }, []);

// /cert/transfer/items?account= — L 어떤 내역을 발급할까요? (cert.md §2.4, 녹화 A 74.167 / 74.767).
// 고른 계좌에서 보낸 이체 (GET /api/transfers?from=, 최근 것부터), 날짜(MM월 DD일)마다 묶음. 여러 개 고름: 손을 뗄 때 동그라미가 채워지고
// 버튼이 'N건 선택' 으로. 모두 선택은 보이는 줄을 다 고르거나 다 풂 (지어낸 동작, plan §1.6). 검색칸은 이름 · 금액으로 거름, 칩은 누름 표시만.
// 처음엔 300ms 빈 화면, ✓ 동그라미는 줄보다 250ms 늦게 (뒤로 와도). 보낸 이체가 없으면 '발급할 수 있는 내역이 없어요'
export function CertItems() {
  const q = useCertQuery();
  const list = useApi<TransferRecord[]>(paths.transfers(q.account || "main"));
  const { revisit } = useCertRevisit();
  const phase = useCertPhase([CERT_T.itemsBlank], list.status !== "loading", revisit);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [text, setText] = useState("");
  const [late, setLate] = useState(true);
  const { next, waiting } = useCertNext();
  useEffect(() => {
    if (phase < 1) return;
    const t = window.setTimeout(() => setLate(false), CERT_T.itemsCircles + 50);
    return () => window.clearTimeout(t);
  }, [phase]);

  const all = useMemo(() => (q.account ? (list.data ?? []) : []), [q.account, list.data]);
  const shown = useMemo(() => certFilter(all, text), [all, text]);
  const groups = useMemo(() => certGroups(shown), [shown]);
  const allOn = shown.length > 0 && shown.every((t) => sel.has(t.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s);
      for (const t of shown) {
        if (allOn) n.delete(t.id);
        else n.add(t.id);
      }
      return n;
    });
  const ids = all.filter((t) => sel.has(t.id)).map((t) => t.id);

  const placed = useMemo(() => placeGroups(groups), [groups]);
  const y = placed.length ? placed[placed.length - 1].bottom : GROUPS_TOP;
  const show = phase >= 1 && list.status !== "loading";
  const circle = `toss-cert-items__circle${late ? " toss-cert-items__circle--late" : ""}`;

  return (
    <TossPage
      className="toss-cert-items"
      header={<CertBar />}
      dock={
        show && (
          <TossBottomDock fade>
            <TossButton disabled={!ids.length} loading={waiting} onPress={() => ids.length && next(certUrl("/cert/transfer/method", { account: q.account, ids }))}>
              {ids.length ? `${ids.length}건 선택` : "다음"}
            </TossButton>
          </TossBottomDock>
        )
      }
    >
      {list.status === "error" && !list.data && (
        <TossPressable className="toss-cert-fail" onPress={list.retry}>
          잠시 후 다시 시도해 주세요
        </TossPressable>
      )}
      {show && list.data && (
        <div className="toss-cert-c" style={{ height: Math.max(y, 420) + TOSS_DOCK_SPACE }}>
          <CertTitle>어떤 내역을 발급할까요?</CertTitle>
          <label className="toss-cert-items__field">
            <CertFieldSearchIcon />
            <input className="toss-cert-items__input" type="search" value={text} placeholder="사람 이름, 상호명, 금액으로 검색" enterKeyHint="search" onChange={(e) => setText(e.target.value)} />
          </label>
          <TossPressable className="toss-cert-items__chip toss-cert-items__chip--1" radius={7} color="rgba(255,255,255,0.06)" fadeIn={80} fadeOut={120}>
            모든 기간
            <CertChevronDown />
          </TossPressable>
          <TossPressable className="toss-cert-items__chip toss-cert-items__chip--2" radius={7} color="rgba(255,255,255,0.06)" fadeIn={80} fadeOut={120}>
            입출금
            <CertChevronDown />
          </TossPressable>
          {shown.length > 0 ? (
            <TossPressable className="toss-cert-row toss-cert-items__all" inset="0 4px" radius={10} color={PRESS} fadeIn={150} fadeOut={100} onPress={toggleAll}>
              <CertCheckCircle className={circle} on={allOn} color="#5a595c" />
              <p className="toss-cert-t toss-cert-narrow toss-cert-items__alllabel">모두 선택</p>
            </TossPressable>
          ) : (
            <p className="toss-cert-t toss-cert-items__empty">{text.trim() && all.length ? "검색 결과가 없어요" : "발급할 수 있는 내역이 없어요"}</p>
          )}
          {placed.map((g) => (
            <div key={`${g.day}${g.top}`} className="toss-cert-row" style={{ top: g.top, height: DAY_H + g.items.length * TX_H }}>
              <p className="toss-cert-t toss-cert-items__day" style={{ top: 17.93 }}>
                {g.day}
              </p>
              {g.items.map((t, i) => (
                <TossPressable
                  key={t.id}
                  className="toss-cert-row toss-cert-items__tx"
                  style={{ top: DAY_H + TX_H * i }}
                  inset="0 4px"
                  radius={10}
                  color={PRESS}
                  fadeIn={150}
                  fadeOut={100}
                  onPress={() => toggle(t.id)}
                >
                  <CertCheckCircle className={circle} on={sel.has(t.id)} />
                  <p className="toss-cert-t toss-cert-items__who">{t.holder}</p>
                  <p className="toss-cert-t toss-cert-items__when">{certHm(t.at)} | 출금</p>
                  <p className="toss-cert-t toss-cert-items__amt">{certAmount(t.amount)}</p>
                </TossPressable>
              ))}
            </div>
          ))}
        </div>
      )}
    </TossPage>
  );
}
