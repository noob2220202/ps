import { useState, type ReactNode } from "react";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Bank, HomeData } from "../../api/types";
import { tossAdSnoozed, tossApi, tossPaths, type TossCard, type TossHomeData, type TossPoint, type TossProfile } from "../api";
import { PanelCount, PanelField, PanelMoney, PanelSeg } from "./fields";
import type { TossRun } from "./types";
import "./panel.css";

// 🔔 관리 → 계좌 탭 맨 아래 "토스" 칸 (plan.md §2.5):
//  홈 카드 · 배너 · 광고: 포인트 기회 N번 · 리워드 최대 적립금(또는 숨김) · 리워드 배너 다시 보이기 · 이체 뒤 광고 다시 보이기
//  카드 목록 (이름 · 은행 · 연결 계좌 · 종류 · 선불 잔액 · 마지막 사용일 · 그림) → 자산 카드 · 홈 토스유스카드 줄
//  포인트 목록 (이름 · 잔액 · 아이콘) → 자산 포인트 · 총 자산
// 저장하면 api client 가 모든 화면 데이터를 다시 받게 함 (홈 · 소비 · 자산 숫자는 바뀐 자리만 굴러감)
export function TossPanelSection({ run, home }: { run: TossRun; home: HomeData }) {
  const profile = home.profile as TossProfile;
  const block = (home as TossHomeData).toss;
  const cards = useApi<TossCard[]>(tossPaths.cards);
  const points = useApi<TossPoint[]>(tossPaths.points);
  const banks = useApi<Bank[]>(paths.banks);
  return (
    <div className="toss-assets-panel">
      <h3 className="tab__h">토스 홈 · 광고</h3>
      <HomeFields key={`${profile.pointChances}-${profile.rewardMax}`} profile={profile} adSnoozeUntil={block?.adSnoozeUntil ?? profile.adSnoozeUntil ?? null} run={run} />

      <h3 className="tab__h">카드 {cards.data ? `${cards.data.length}장` : ""}</h3>
      <p className="tab__hint">자산 '카드' 칸 (이번 달 쓴 돈 많은 순) · 선불카드 첫 장은 홈 '토스유스카드' 줄</p>
      {cards.data?.map((c) => (
        <CardEditor key={JSON.stringify(c)} card={c} banks={banks.data ?? []} accounts={home.accounts} run={run} />
      ))}
      {banks.data && <AddCard banks={banks.data} accounts={home.accounts} run={run} />}

      <h3 className="tab__h">포인트 {points.data ? `${points.data.length}개` : ""}</h3>
      <p className="tab__hint">자산 '포인트' 칸 · 총 자산 = 계좌 + 포인트</p>
      {points.data?.map((p) => (
        <PointEditor key={JSON.stringify(p)} point={p} run={run} />
      ))}
      <AddPoint run={run} />
    </div>
  );
}

// ---------- 홈 카드 · 리워드 배너 · 이체 뒤 광고 ----------
function HomeFields({ profile, adSnoozeUntil, run }: { profile: TossProfile; adSnoozeUntil: string | null; run: TossRun }) {
  const [chances, setChances] = useState(profile.pointChances ?? 3);
  const [reward, setReward] = useState(profile.rewardMax ?? 0);
  const hidden = profile.rewardMax === null || profile.rewardMax === undefined;
  const snoozed = tossAdSnoozed(adSnoozeUntil);
  return (
    <div className="add-bank">
      {/* label 로 감싸지 않음 (PanelSeg 와 같은 까닭): 안내 글 · 'N번' 을 누르면 첫 버튼 '−' 가 눌려 횟수가 줄던 것 */}
      <div className="field">
        <span className="field__label">송금·결제 후 받는 포인트 (홈)</span>
        <div className="chips-row">
          <PanelCount value={chances} onChange={setChances} unit="번" />
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginLeft: "auto" }}
            onClick={() => run(() => tossApi.updateProfile({ pointChances: chances }), `포인트 기회를 ${chances}번으로 바꿨어요`)}
          >
            저장
          </button>
        </div>
      </div>
      <PanelField label={`리워드 배너 '이번 달 최대 적립금' ${hidden ? "(지금: 숨김)" : ""}`}>
        <PanelMoney value={reward} onChange={setReward} quick={[1000, 10000, 50000]} />
      </PanelField>
      <div className="row">
        <button type="button" className="btn btn--sm" style={{ flex: 1 }} onClick={() => run(() => tossApi.updateProfile({ rewardMax: reward }), "최대 적립금을 바꿨어요")}>
          이 금액으로
        </button>
        <button type="button" className="btn btn--sm btn--danger" disabled={hidden} onClick={() => run(() => tossApi.updateProfile({ rewardMax: null }), "리워드 배너를 숨겼어요")}>
          배너 숨기기
        </button>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          style={{ flex: 1 }}
          disabled={!profile.rewardDismissed}
          onClick={() => run(() => tossApi.updateProfile({ rewardDismissed: null }), "리워드 배너가 다시 보여요")}
        >
          {profile.rewardDismissed ? "리워드 배너 다시 보이기" : "리워드 배너 보이는 중"}
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          style={{ flex: 1 }}
          disabled={!snoozed}
          onClick={() => run(() => tossApi.updateProfile({ adSnoozeUntil: null }), "이체 뒤 광고가 다시 보여요")}
        >
          {snoozed ? "이체 뒤 광고 다시 보이기" : "이체 뒤 광고 보이는 중"}
        </button>
      </div>
    </div>
  );
}

// ---------- 카드 ----------
// 그림: 비우면 은행 기본 (자산 카드 줄의 세로 카드 그림)
const ARTS: [string, string][] = [
  ["", "은행 기본"],
  ["toss-check", "토스 체크"],
  ["toss-youth", "토스 유스"],
  ["kakao-friends", "노랑 B"],
  ["hana-young", "민트"],
];
type AccountLite = { id: string; label: string };

function CardForm({
  init,
  banks,
  accounts,
  onSave,
  saveLabel,
  extra,
}: {
  init: Partial<TossCard>;
  banks: Bank[];
  accounts: AccountLite[];
  onSave: (body: Parameters<typeof tossApi.addCard>[0]) => Promise<boolean>;
  saveLabel: string;
  extra?: ReactNode;
}) {
  const [name, setName] = useState(init.name ?? "");
  const [bankCode, setBankCode] = useState(init.bankCode ?? "toss");
  const [accountId, setAccountId] = useState(init.accountId ?? "");
  const [kind, setKind] = useState<"check" | "prepaid">(init.kind ?? "check");
  const [balance, setBalance] = useState(init.balance ?? 0);
  const [lastUsed, setLastUsed] = useState(init.lastUsedAt?.slice(0, 10) ?? "");
  const [art, setArt] = useState(init.art ?? "");
  return (
    <>
      <PanelField label="카드 이름">
        <input value={name} maxLength={20} placeholder="토스뱅크 체크카드" onChange={(e) => setName(e.target.value)} />
      </PanelField>
      <div className="row">
        <PanelField label="은행">
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </PanelField>
        <PanelField label="연결 계좌">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">없음</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </PanelField>
      </div>
      <PanelSeg
        label="종류"
        value={kind}
        options={[
          ["check", "체크카드"],
          ["prepaid", "선불카드 (잔액)"],
        ]}
        onChange={setKind}
      />
      {kind === "prepaid" && (
        <PanelField label="선불 잔액 (홈 토스유스카드 줄)">
          <PanelMoney value={balance} onChange={setBalance} />
        </PanelField>
      )}
      <div className="row">
        <PanelField label="마지막 사용일 (홈 'N개월 전')">
          <input type="date" value={lastUsed} onChange={(e) => setLastUsed(e.target.value)} />
        </PanelField>
        <PanelField label="카드 그림">
          <select value={art} onChange={(e) => setArt(e.target.value)}>
            {ARTS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </PanelField>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn--sm"
          style={{ flex: 1 }}
          onClick={() =>
            onSave({
              name: name.trim(),
              bankCode,
              accountId: accountId || null,
              kind,
              balance: kind === "prepaid" ? balance : null,
              lastUsedAt: lastUsed || null,
              art: art || null,
            })
          }
        >
          {saveLabel}
        </button>
        {extra}
      </div>
    </>
  );
}

function CardEditor({ card, banks, accounts, run }: { card: TossCard; banks: Bank[]; accounts: AccountLite[]; run: TossRun }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="acct-edit">
      <button type="button" className="acct-edit__head" onClick={() => setOpen(!open)}>
        <span className="acct-edit__name">
          <strong>{card.name}</strong>
          <small>
            {banks.find((b) => b.code === card.bankCode)?.name ?? card.bankCode} · {card.kind === "prepaid" ? `선불 ${(card.balance ?? 0).toLocaleString("ko-KR")}원` : "체크"}
          </small>
        </span>
        <span className="toss-assets-panel__chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="acct-edit__body">
          <CardForm
            init={card}
            banks={banks}
            accounts={accounts}
            saveLabel="카드 저장"
            onSave={(body) => run(() => tossApi.updateCard(card.id, body), `${body.name || "카드"} 정보를 바꿨어요`)}
            extra={
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => confirm(`${card.name}를 지울까요?\n그 카드로 결제한 거래는 남아요.`) && run(() => tossApi.deleteCard(card.id), "카드를 지웠어요")}
              >
                카드 삭제
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function AddCard({ banks, accounts, run }: { banks: Bank[]; accounts: AccountLite[]; run: TossRun }) {
  const [n, setN] = useState(0); // 추가하면 칸을 비움
  return (
    <div className="add-bank">
      <CardForm key={n} init={{}} banks={banks} accounts={accounts} saveLabel="카드 추가" onSave={async (body) => (await run(() => tossApi.addCard(body), `${body.name || "카드"}를 추가했어요`)) && (setN(n + 1), true)} />
    </div>
  );
}

// ---------- 포인트 ----------
const ICONS: [string, string][] = [
  ["toss-point", "토스"],
  ["hana-money", "하나"],
];

function PointForm({ init, onSave, saveLabel, extra }: { init: Partial<TossPoint>; onSave: (body: { name: string; balance: number; icon: string }) => Promise<boolean>; saveLabel: string; extra?: ReactNode }) {
  const [name, setName] = useState(init.name ?? "");
  const [balance, setBalance] = useState(init.balance ?? 0);
  const [icon, setIcon] = useState(init.icon ?? "toss-point");
  return (
    <>
      <PanelField label="포인트 이름">
        <input value={name} maxLength={20} placeholder="토스포인트" onChange={(e) => setName(e.target.value)} />
      </PanelField>
      <PanelField label="잔액">
        <PanelMoney value={balance} onChange={setBalance} quick={[100, 1000, 10000]} />
      </PanelField>
      <PanelSeg label="아이콘" value={icon} options={ICONS} onChange={setIcon} />
      <div className="row">
        <button type="button" className="btn btn--sm" style={{ flex: 1 }} onClick={() => onSave({ name: name.trim(), balance, icon })}>
          {saveLabel}
        </button>
        {extra}
      </div>
    </>
  );
}

function PointEditor({ point, run }: { point: TossPoint; run: TossRun }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="acct-edit">
      <button type="button" className="acct-edit__head" onClick={() => setOpen(!open)}>
        <span className="acct-edit__name">
          <strong>{point.name}</strong>
        </span>
        <span className="acct-edit__bal">{point.balance.toLocaleString("ko-KR")}원</span>
        <span className="toss-assets-panel__chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="acct-edit__body">
          <PointForm
            init={point}
            saveLabel="포인트 저장"
            onSave={(body) => run(() => tossApi.updatePoint(point.id, body), `${body.name || "포인트"}를 바꿨어요`)}
            extra={
              <button type="button" className="btn btn--sm btn--danger" onClick={() => confirm(`${point.name}를 지울까요?`) && run(() => tossApi.deletePoint(point.id), "포인트를 지웠어요")}>
                삭제
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function AddPoint({ run }: { run: TossRun }) {
  const [n, setN] = useState(0);
  return (
    <div className="add-bank">
      <PointForm key={n} init={{}} saveLabel="포인트 추가" onSave={async (body) => (await run(() => tossApi.addPoint(body), `${body.name || "포인트"}를 추가했어요`)) && (setN(n + 1), true)} />
    </div>
  );
}
