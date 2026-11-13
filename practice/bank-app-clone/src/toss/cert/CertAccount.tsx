import { useEffect, useRef, useState } from "react";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { TossAccount, TossHomeData } from "../api";
import { TossBottomDock, TossButton } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { certAccounts, certBankShort, certOpened, certUrl, CERT_T } from "./data";
import { CertBar, CertCheck, CertTile, CertTitle } from "./parts";
import { useCertNext, useCertPhase, useCertRevisit } from "./steps";
import "./cert.css";

// 본문 좌표 (화면 y − 81.6). 구역 이름은 잉크 가운데 기준 (top = 가운데 − 8.1)
const SEC1 = 186.95 - 81.6; // '사용중인 통장' 잉크 180.2–193.7
const SEC_TO_ROW = 17.05; // 구역 이름 가운데 → 첫 줄 위 (204 − 186.95)
const ROW_TO_SEC = 27.65; // 마지막 줄 아래 → 다음 구역 이름 가운데 (319.65 − 292)
const ROW3 = 88; // 토스 계좌 (이름 · 번호 · 개설일)
const ROW2 = 68; // 다른 은행 (은행 · 번호) — 개설일이 없는 토스 계좌도
const PRESS = "rgba(255,255,255,0.06)"; // 최고 #252427

interface Placed {
  a: TossAccount;
  top: number;
  h: number;
  opened: string | null;
  toss: boolean;
}

// 구역 · 줄 자리 (본문 좌표). 다른 은행 계좌가 없으면 그 구역은 없음
function placeAccounts(toss: TossAccount[], linked: TossAccount[]) {
  const placed: Placed[] = [];
  const secs: { label: string; c: number }[] = [];
  let y = SEC1;
  for (const [label, list, isToss] of [
    ["사용중인 통장", toss, true],
    ["오픈뱅킹 연결한 통장", linked, false],
  ] as const) {
    if (!list.length) continue;
    secs.push({ label, c: y });
    y += SEC_TO_ROW;
    for (const a of list) {
      const opened = isToss ? certOpened(a.openedAt) : null;
      const h = opened ? ROW3 : ROW2;
      placed.push({ a, top: y, h, opened, toss: isToss });
      y += h;
    }
    y += ROW_TO_SEC;
  }
  return { placed, secs, bottom: y };
}

// /cert/transfer/account — A 어떤 계좌의 증명서를 발급할까요? (cert.md §2.3, 녹화 A 71.155 / 71.773).
// 사용중인 통장 = 토스뱅크 통장들 (토스머니 빼고), 오픈뱅킹 연결한 통장 = 다른 은행 계좌 (없으면 구역째 숨김).
// 하나만 고름: 누름 표시가 사라질 때 ✓, 다음 버튼이 켜짐 (180ms). 처음 들어올 땐 250ms 빈 화면, 뒤로 와서는 바로 (고른 것은 비워짐)
export function CertAccount() {
  const home = useApi<TossHomeData>(paths.home);
  const { revisit } = useCertRevisit();
  const phase = useCertPhase([CERT_T.accountBlank], home.status === "done", revisit);
  const [sel, setSel] = useState<string | null>(null);
  // ✓ 는 누름 표시가 다 사라질 때 (뗀 뒤 120ms)
  const pick = useRef(0);
  useEffect(() => () => window.clearTimeout(pick.current), []);
  const choose = (id: string) => {
    window.clearTimeout(pick.current);
    pick.current = window.setTimeout(() => setSel(id), 120);
  };
  const { next, waiting } = useCertNext();
  const { toss, linked } = certAccounts(home.data);

  const { placed, secs, bottom } = placeAccounts(toss, linked);

  const show = phase >= 1 && home.data;
  return (
    <TossPage
      className="toss-cert-acct"
      header={<CertBar />}
      dock={
        show && (
          <TossBottomDock>
            <TossButton disabled={!sel} loading={waiting} onPress={() => sel && next(certUrl("/cert/transfer/items", { account: sel }), { prefetch: [paths.transfers(sel)] })}>
              다음
            </TossButton>
          </TossBottomDock>
        )
      }
    >
      {home.status === "error" && (
        <TossPressable className="toss-cert-fail" onPress={home.retry}>
          잠시 후 다시 시도해 주세요
        </TossPressable>
      )}
      {show && (
        <div className="toss-cert-c" style={{ height: bottom + 120 }}>
          <CertTitle>어떤 계좌의 증명서를 발급할까요?</CertTitle>
          {secs.map((s) => (
            <p key={s.label} className="toss-cert-t toss-cert-acct__sec" style={{ top: s.c - 8.1 }}>
              {s.label}
            </p>
          ))}
          {placed.map(({ a, top, h, opened, toss: isToss }) => {
            const mid = opened ? 44 : 35.6; // 타일 · ✓ 가운데 (줄 위에서)
            return (
              <TossPressable
                key={a.id}
                className="toss-cert-row"
                style={{ top, height: h }}
                inset="0 4px"
                radius={10}
                color={PRESS}
                fadeIn={66}
                fadeOut={120}
                onPress={() => choose(a.id)}
              >
                <CertTile code={isToss ? "toss" : a.bank.code} bank={a.bank} className="toss-cert-acct__tile" style={{ top: mid - 14 }} />
                <p className="toss-cert-t toss-cert-acct__name">{isToss ? a.label : certBankShort(a)}</p>
                <p className="toss-cert-t toss-cert-acct__num" style={opened ? undefined : { top: 34.6 }}>
                  {a.number}
                </p>
                {opened && <p className="toss-cert-t toss-cert-acct__opened">개설일 {opened}</p>}
                {sel === a.id && <CertCheck className="toss-cert-acct__check" style={{ top: mid - 5.5 }} />}
              </TossPressable>
            );
          })}
        </div>
      )}
    </TossPage>
  );
}
