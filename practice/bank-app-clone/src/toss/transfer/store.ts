// 이체 흐름이 화면 사이에 같이 쓰는 값 · 글자 규칙 (transfer.md §0.1 · §4.3)
//  받는 분: own (내 계좌) · payee (등록된 받는 분) · typed (친 번호, 아직 못 찾음)
//  옮기다 / 보내다: 받는 계좌가 내 것이면 옮기다 ("얼마나 옮길까요?", 옮기기, 옮길게요, 옮겼어요), 아니면 보내다
//  받는 분에게 표시(memoTo): 확인 화면(S5) ↔ 메모 화면(S6) 이 같이 봄 — 금액 화면에서 '다음' 을 누를 때마다 처음(내 이름)으로
import { useSyncExternalStore } from "react";
import { formatAccountNumber } from "../../api/endpoints";
import type { Bank } from "../../api/types";
import { roOnly } from "../format";
import { tossBankFull, tossBankShort } from "../bank";

export type SendKind = "own" | "payee" | "typed";
export interface SendTarget {
  kind: SendKind;
  bank: Bank;
  digits: string; // 숫자만
  holder: string; // 예금주 (내 계좌면 내 이름)
  accountId?: string; // own
  name?: string; // own: 계좌 이름 (영하나플러스 통장)
  money?: boolean; // own: 토스머니 (번호를 보여 주지 않음)
  payeeId?: string;
}

export const digitsOf = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");
// 은행 형식대로 하이픈 (등록된 계좌 · 받는 분). 친 번호는 숫자 그대로
export const formatted = (bank: Bank, digits: string) => formatAccountNumber(bank.pattern, digits, bank.alt);

export const isMove = (t: SendTarget | null | undefined) => t?.kind === "own";
export const verb = (t: SendTarget | null | undefined) => (isMove(t) ? "옮기" : "보내");
// "얼마나 옮길까요?" · "옮기기" · "옮길게요" · "옮겼어요"
export const verbAsk = (t: SendTarget | null | undefined) => (isMove(t) ? "옮길까요?" : "보낼까요?");
export const verbCta = (t: SendTarget | null | undefined) => (isMove(t) ? "옮기기" : "보내기");
export const verbSending = (t: SendTarget | null | undefined) => (isMove(t) ? "옮길게요" : "보낼게요");
export const verbDone = (t: SendTarget | null | undefined) => (isMove(t) ? "옮겼어요" : "보냈어요");

// 받는 쪽 이름 + 조사: 내 영하나플러스 통장 + 으로 / 김철수 + 님에게 / 하나은행 계좌 + 로
export function toLabel(t: SendTarget) {
  if (t.kind === "own") return { label: `내 ${t.name ?? ""}`, particle: roOnly(t.name ?? "") };
  if (t.kind === "payee") return { label: t.holder, particle: "님에게" };
  return { label: `${bankFull(t.bank)} 계좌`, particle: "로" };
}

// 금액 · 확인 화면에 쓰는 은행 이름 (하나은행 · NH농협 · KB국민은행 …)
export const bankFull = (b: Bank) => tossBankFull(b.code, b.name);
// 받는 계좌 한 줄 (금액 화면 아래줄 · 확인 화면 입금 계좌): 토스머니는 "토스머니", 그 밖엔 "하나은행 123-456789-01234"
export const accountLine = (t: SendTarget, raw = false) => (t.money ? "토스머니" : `${bankFull(t.bank)} ${raw ? t.digits : formatted(t.bank, t.digits)}`);
// 목록 줄에 쓰는 짧은 이름 (하나 · NH농협 · KB국민 · 카카오뱅크 …)
export const bankShort = (b: Bank) => tossBankShort(b.code, b.short);

// 받는 분에게 표시 (null = 기본값, 내 이름)
let memo: string | null = null;
const listeners = new Set<() => void>();
export const sendMemo = {
  get: () => memo,
  set(v: string | null) {
    memo = v;
    listeners.forEach((fn) => fn());
  },
};
export const useSendMemo = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => memo,
  );

// 메모 글자 수: 한글 7자 · 영문 14자 (한글 한 자 = 2칸, 14칸까지)
export const memoUnits = (s: string) => [...s].reduce((n, c) => n + (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(c) ? 2 : 1), 0);
