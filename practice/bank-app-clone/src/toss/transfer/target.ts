// 금액(S4) · 확인(S5) 화면이 주소로 받는 분을 찾음
//  ?from=<보내는 계좌>&to=<내 계좌 id>        내 계좌 (어디로 보낼까요의 내 계좌 · 최근 보낸 계좌의 '내 …')
//  ?from=<보내는 계좌>&bank=<코드>&number=<숫자>  받는 분 · 친 번호 → 서버 조회(lookup): 내 계좌 / 등록된 받는 분 / 404 (못 찾음)
// 조회 결과는 이 모듈에 남겨 둠 (금액 → 확인 → 메모 → 확인 으로 오가도 다시 기다리지 않게)
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { ApiError, getVersion, subscribeVersion } from "../../api/client";
import { api, paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Bank, Profile, Recipient, TransferRecipients } from "../../api/types";
import type { TossAccount } from "../api";
import { digitsOf, type SendTarget } from "./store";

export interface SendParams {
  from: string;
  to: string | null;
  bank: string | null;
  number: string;
  amount: number;
}
export function useSendParams(): SendParams {
  const { search } = useLocation();
  return useMemo(() => {
    const q = new URLSearchParams(search);
    return { from: q.get("from") || "main", to: q.get("to"), bank: q.get("bank"), number: digitsOf(q.get("number")), amount: Number(q.get("amount")) || 0 };
  }, [search]);
}
// 다음 화면 주소에 붙일 받는 분 (금액 → 확인 · 메모)
export const targetQuery = (p: SendParams) =>
  `from=${encodeURIComponent(p.from)}${p.to ? `&to=${encodeURIComponent(p.to)}` : `&bank=${encodeURIComponent(p.bank ?? "")}&number=${p.number}`}`;

type Lookup = { status: "loading" } | { status: "found"; r: Recipient } | { status: "notfound" } | { status: "error"; message: string };
const looked = new Map<string, { at: number; v: Lookup }>();

// 서버 조회 (캐시: 데이터 버전이 같으면 다시 안 물음)
function useLookup(bank: string | null, number: string, on: boolean): Lookup {
  const version = useSyncExternalStore(subscribeVersion, getVersion);
  const key = `${bank}:${number}`;
  const hit = looked.get(key);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || !bank || !number) return;
    const h = looked.get(key);
    if (h && h.at === version && h.v.status !== "loading") return;
    let dead = false;
    if (!h) looked.set(key, { at: version, v: { status: "loading" } });
    api
      .lookupAccount(bank, number)
      .then((r) => looked.set(key, { at: version, v: { status: "found", r } }))
      .catch((e: unknown) => {
        const err = e instanceof ApiError ? e : null;
        looked.set(key, { at: version, v: err?.status === 404 ? { status: "notfound" } : { status: "error", message: err?.message ?? String(e) } });
      })
      .finally(() => !dead && bump((n) => n + 1));
    return () => {
      dead = true;
    };
  }, [bank, number, on, key, version]);
  if (!on || !bank || !number) return { status: "notfound" };
  return hit?.v ?? { status: "loading" };
}

export interface SendResolve {
  status: "loading" | "ready" | "notfound" | "error";
  target: SendTarget | null; // notfound 이면 typed (은행 · 번호만)
  from: TossAccount | null;
  userName: string;
  message?: string;
}

export function useSendTarget(p: SendParams): SendResolve {
  const fromAcc = useApi<TossAccount>(paths.account(p.from));
  const recipients = useApi<TransferRecipients>(paths.recipients(p.from));
  const profile = useApi<Profile>(paths.profile);
  const banks = useApi<Bank[]>(paths.banks);
  const own = useApi<TossAccount>(paths.account(p.to ?? p.from));
  const lookup = useLookup(p.bank, p.number, !p.to);
  const userName = profile.data?.userName ?? "";

  const name = (id: string) => recipients.data?.mine.find((m) => m.accountId === id)?.label ?? (own.data?.id === id ? own.data.label : undefined);
  let status: SendResolve["status"] = "loading";
  let target: SendTarget | null = null;
  let message: string | undefined;
  if (p.to) {
    if (own.status === "error") {
      status = "error";
      message = own.error.message;
    } else if (own.data && own.data.id === p.to) {
      status = "ready";
      target = { kind: "own", bank: own.data.bank, digits: digitsOf(own.data.number), holder: userName, accountId: own.data.id, name: own.data.label, money: own.data.role === "money" };
    }
  } else if (lookup.status === "found") {
    const r = lookup.r;
    status = "ready";
    target = r.accountId
      ? { kind: "own", bank: r.bank, digits: r.number, holder: r.holder, accountId: r.accountId, name: name(r.accountId) ?? r.holder, money: recipients.data?.mine.find((m) => m.accountId === r.accountId)?.role === "money" }
      : { kind: "payee", bank: r.bank, digits: r.number, holder: r.holder, payeeId: r.payeeId };
    // 내 계좌 이름을 아직 모름 (받는 분 목록을 안 받았음) → 잠깐 기다림
    if (r.accountId && !name(r.accountId) && recipients.status === "loading") status = "loading";
  } else if (lookup.status === "notfound" || lookup.status === "error") {
    const bank = banks.data?.find((b) => b.code === p.bank);
    if (bank || banks.status === "error") {
      status = lookup.status;
      if (lookup.status === "error") message = lookup.message;
      target = bank ? { kind: "typed", bank, digits: p.number, holder: "" } : null;
    }
  }
  if (!fromAcc.data && status !== "error") status = fromAcc.status === "error" ? "error" : "loading";
  if (fromAcc.status === "error" && !message) message = fromAcc.error.message;
  return { status, target, from: fromAcc.data ?? null, userName, message };
}
