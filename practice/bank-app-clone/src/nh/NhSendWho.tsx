import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type {
  Account,
  Bank,
  Recipient,
  TransferRecipients,
} from "../api/types";
import { nhBankList } from "./banks";
import { NhAccountIcon, NhImg } from "./common";
import { nhWon } from "./hangul";
import { isNhLoading, subscribeNhLoading, withNhLoading } from "./loading";
import { NhRecipientList, type RlTab } from "./NhRecipientList";
import "./nh-send.css";

// 콕송금에 들어온 뒤 실제 앱 순서. 앞 화면의 로딩 막이 걷혀 콕송금이 처음 보인 때부터 ms (녹화1 14.67~15.68초, 녹화2 1.92~2.73초):
//   두 번째 로딩(점 3개 + 막) 125~405 (녹화1 114~324, 녹화2 104~456) → 청록 ⌄⌄ 360 (녹화1 537, 녹화2 183. 나타난 뒤 0.1s 부터 움직임)
//   → 최근송금 시트 790 에 올라옴 (두 녹화 모두 ⌄⌄ 가 나타나고 410~455ms 뒤)
const ENTRY = { loadAt: 125, loadMs: 280, kokAt: 360, sheetAt: 790 };
// 은행 줄을 누르면 점 3개 + 막이 1.17초 돈 뒤, 막이 걷히고 35ms 뒤 은행선택 화면 (녹화2 3.37~4.59초)
const BANK_LOADING = { ms: 1170, after: 35 };
// 같은 콕송금 방문(같은 주소) 안에서 다시 마운트될 때 — 금액 단계에서 돌아오거나 은행을 고르고 돌아옴 — 는
// 위 순서를 되풀이하지 않고 탭도 그대로 둠 (앱 화면이 그대로 남아 있는 것처럼)
const visit: { key: string; tab: RlTab } = { key: "", tab: "recent" };

function useEntry() {
  const { key } = useLocation();
  const [again] = useState(() => visit.key === key);
  const [kok, setKok] = useState(again);
  const [sheet, setSheet] = useState<"rise" | "static" | null>(
    again ? "static" : null,
  );
  useEffect(() => {
    visit.key = key;
    if (again) return;
    visit.tab = "recent";
    const timers: number[] = [];
    let unsub = () => {};
    const start = () => {
      unsub();
      const at = (ms: number, f: () => void) =>
        timers.push(window.setTimeout(f, ms));
      at(ENTRY.loadAt, () => withNhLoading(() => undefined, ENTRY.loadMs));
      at(ENTRY.kokAt, () => setKok(true));
      at(ENTRY.sheetAt, () => setSheet("rise"));
    };
    // 앞 화면 로딩이 아직 덮여 있으면(막 아래에서 이미 콕송금으로 바뀐 경우) 걷힐 때부터 셈
    if (isNhLoading()) {
      const off = subscribeNhLoading(() => {
        if (!isNhLoading()) start();
      });
      unsub = () => void off();
    } else start();
    return () => {
      unsub();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [again, key]);
  return { again, kok, sheet };
}

// 콕송금 첫 단계 (녹화1 15~27초, 녹화2 0~3초): 출금계좌 / 청록 ⌄⌄ / "누구에게 보낼까요?" / 계좌·휴대전화 /
// 은행·계좌번호 / 빠른송금 + 아래 최근송금 시트. 위치는 녹화(480px) × 0.8 = dp 로 잰 값을 그대로 씀 (헤더 아래가 0)
export function NhSendWho({
  account,
  bank,
  digits,
  busy,
  recipients,
  listOpen,
  onPickBank,
  onOpenNumber,
  onClearDigits,
  onToggleList,
  onPickRecipient,
}: {
  account?: Account;
  bank: Bank | null;
  digits: string;
  busy: boolean;
  recipients?: TransferRecipients;
  listOpen: boolean;
  onPickBank: () => void;
  onOpenNumber: () => void;
  onClearDigits: () => void;
  onToggleList: () => void;
  onPickRecipient: (r: Recipient) => void;
}) {
  const entry = useEntry();
  const pickBank = () =>
    withNhLoading(() => undefined, BANK_LOADING.ms).then(() =>
      window.setTimeout(onPickBank, BANK_LOADING.after),
    );
  // 계좌 조회 중: 실제 앱은 화면 전체가 어두워지고 가운데 점 3개 (녹화2 13.6~14.05초). 공용 로딩을 그동안 켜 둠
  useEffect(() => {
    if (!busy) return;
    let done = () => {};
    withNhLoading(() => new Promise<void>((r) => (done = r)), 0);
    return () => done();
  }, [busy]);
  return (
    <>
      <div className={`nh-sw${account?.balance === 0 ? " nh-sw--zero" : ""}`}>
        <FromAccount account={account} />
        {entry.kok && <KokArrows />}
        <h2 className="nh-sw__who">누구에게 보낼까요?</h2>
        <div className="nh-sw__seg" role="tablist">
          <button className="on" role="tab" aria-selected>
            계좌
          </button>
          <button role="tab" aria-selected={false}>
            휴대전화
          </button>
        </div>
        <button className="nh-sw__row nh-sw__bank" onClick={pickBank}>
          <span>
            {bank
              ? (nhBankList([bank], bank.section)[0]?.label ?? bank.name)
              : " "}
          </span>
          <Chevron />
        </button>
        <div className={`nh-sw__row nh-sw__number ${digits ? "filled" : ""}`}>
          <button onClick={onOpenNumber}>{digits || "계좌번호 입력"}</button>
          {digits && (
            <button
              className="nh-sw__clear"
              aria-label="지우기"
              onClick={onClearDigits}
            >
              <ClearIcon />
            </button>
          )}
        </div>
        <button className="nh-sw__quick">
          <QuickIcon />
          빠른송금
        </button>
      </div>
      <NhRecipientList
        open={listOpen}
        onToggle={onToggleList}
        data={recipients}
        onPick={onPickRecipient}
        appear={entry.sheet}
        initialTab={entry.again ? visit.tab : "recent"}
        onTab={(t) => (visit.tab = t)}
        lower={account?.balance === 0 ? 14.4 : 0}
      />
    </>
  );
}

function FromAccount({ account }: { account?: Account }) {
  return (
    <div className="nh-sw__from">
      <NhImg
        name="nh-sendwho-from"
        w={24}
        h={24}
        fallback={<NhAccountIcon size={24} plain />}
      />
      <b>{account?.label ?? " "}</b>
      <small>농축협 {account?.number}</small>
      <Chevron />
      <em className={account?.balance === 0 ? "nh-sw__zero" : ""}>{account ? nhWon(account.balance) : ""}</em>
      {/* 잔액이 0원이면 옆에 [+ 채우기] (2026-10-29 녹화) */}
      {account?.balance === 0 && <span className="nh-sw__fill">+ 채우기</span>}
    </div>
  );
}

// ⌄ (10.7 × 5.4dp, 굵기 1.5, 각진 끝) — 출금계좌 줄 오른쪽, 은행 줄 오른쪽. 잉크 12.1 × 7dp (녹화 15.1 × 8.7px)
function Chevron() {
  return (
    <svg
      className="nh-sw__chev"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M6.64 9.32 12 14.68l5.36-5.36" />
    </svg>
  );
}

// 지우기: 지름 15.5 원(#2b343f) + × (5.8dp, 굵기 1.5) — 녹화2 14.1초 (원 19.4px, 중심 (425.1, 522.3)px)
function ClearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="7.75" fill="#2b343f" />
      <path
        d="m9.1 9.1 5.8 5.8m0-5.8-5.8 5.8"
        stroke="#cbd2da"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// 청록 ⌄⌄: 아래로 흘러가는 꺾쇠 (주기 1.5s — 1.15s 동안 한 칸씩 내려가며 커지고 0.35s 쉼).
// 칸: 위(투명, ×0.45) → 작은 것(×0.67, 8.6 위) → 큰 것(×1: 팔 7.28dp·45°, 굵기 4.56, 둥근 끝) → 아래(투명, ×1.49).
// 꺾쇠 3개가 각각 한 칸씩 맡아서 이음새 없이 반복. 팔 두 개를 따로 그림: 위는 옅고(불투명도 .48) 아래로 갈수록 진함(.94). 두 팔이 겹치는 꼭짓점만 더 밝아짐(실제 앱과 같음)
function KokArrows() {
  return (
    <span className="nh-sw__kok" aria-hidden>
      {["a", "b", "c"].map((k) => (
        <i key={k} className={`nh-sw__kok-${k}`}>
          <svg width="24" height="24" viewBox="-12 -12 24 24">
            <g
              fill="none"
              stroke="url(#nh-sw-kok-g)"
              strokeWidth="4.56"
              strokeLinecap="round"
            >
              <path d="M-7.28-7.28 0 0" />
              <path d="M7.28-7.28 0 0" />
            </g>
          </svg>
        </i>
      ))}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient
            id="nh-sw-kok-g"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="-9.56"
            x2="0"
            y2="2.28"
          >
            <stop offset="0" stopColor="#0195a3" stopOpacity="0.48" />
            <stop offset="1" stopColor="#0195a3" stopOpacity="0.94" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

// '빠른송금' 앞: 오른쪽이 열린 회색 원호 + 노란 번개 (녹화 x 350~376, y 570~594 에서 잰 좌표, 1 = 녹화 1px = 0.8dp)
function QuickIcon() {
  return (
    <svg width="20.8" height="19.2" viewBox="0 0 26 24" aria-hidden>
      <path
        d="M19.45 5.04A10.1 10.1 0 1 0 12.48 21.46"
        fill="none"
        stroke="#4d5561"
        strokeWidth="1.8"
      />
      <defs>
        <linearGradient id="nh-sw-bolt" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#ffdd6a" />
          <stop offset="0.55" stopColor="#f9c22e" />
          <stop offset="1" stopColor="#ec9f10" />
        </linearGradient>
      </defs>
      <path
        d="M16.6 7.4h6L21.3 13.8h4.3l-8.2 10.2 1.3-7h-3.5Z"
        fill="url(#nh-sw-bolt)"
      />
      <path d="M15.5 16.2 16.9 8.3" stroke="#f1ecdc" strokeWidth="0.7" />
    </svg>
  );
}
