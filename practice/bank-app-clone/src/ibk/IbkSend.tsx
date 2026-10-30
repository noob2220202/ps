import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Account, Bank, HomeData, Recipient, TransferRecipients, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog } from "../components/Sheet";
import { ibkNumber, nf } from "./bank";
import { IbkBankLogo, IbkHeader, IbkHeaderIcon, IbkHeaderText, IbkIcon, IbkNotice, IbkSheet } from "./common";
import { IbkKeypad, type IbkKey } from "./IbkKeypad";
import { holdIbkSpinner, ibkSleep, useIbkSpinner } from "./loading";
import { useIbkBack, useIbkBackHandler, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-send.css";

// 완료 화면(/send/done)으로 넘기는 값 (location.state). IbkDone 이 이 모양을 씀
export interface IbkDoneState {
  result: TransferResult; // 서버 응답: to(받는 분 은행·번호·이름), amount, at, balanceAfter, id(이체 기록 id), outTxId
  from: { id: string; number: string; label: string; bank: Bank }; // 출금계좌: 기업 123-456789-01-011 · 보통예금(IBK W통장)
  memoTo: string; // 받는 분 통장 표기 (기본: 내 이름)
  memoMe: string; // 내 통장 표기 (기본: 받는 분 이름)
}

// 이체 (녹화 10~43초, 96~140초). 머리줄('← 이체 ≡/취소')은 고정이고 아래 본문만 단계별로 바뀜:
//   who     누구에게 보낼까요? — 입금계좌 입력(+ 은행 고르기 시트), 계좌번호|즐겨찾기, 내 계좌(접힘)·최근 이체 N 목록 (spec/who.md)
//   amount  내 계좌에서(⌄ 출금계좌) · ○○님 계좌로(변경) · 얼마를 보낼까요? + 숫자 자판 → 다음 (specB/amount.md)
//   confirm ○○님께 N원을 보낼까요? · 출금계좌 · 내 통장 표기 · 받는 분 통장 표기 → 보내기 (specB/confirm.md 3)
// 앞으로는 새 본문이 오른쪽에서 230ms, 뒤로는 왼쪽에서 200ms (나가는 본문은 바로 사라짐). 아래 버튼은 도착한 뒤에 나타남.
// 실제 앱은 '보내기' 뒤 비밀번호 화면(녹화가 막히는 보안 화면)이 뜨지만, 연습용이라 원호 로딩 뒤 바로 완료로 넘어감
type Stage = "who" | "amount" | "confirm";
type Dir = "fwd" | "back";
// 받는 분 (서버가 receiveError 를 주면 '다음' 뒤 받는 은행 오류 안내 — 녹화 28초. 🔔 관리 → 받는 분에서 계좌마다 켬)
type To = Recipient & { receiveError?: boolean };
interface Notice {
  message: string;
  code?: string;
  then: Stage; // '확인'을 누르면 돌아갈 단계
}

const TOUCH = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches; // 폰이면 입력칸에 기기 키보드
const SOON = "연습용 앱에서는 준비 중인 메뉴예요.";
const TITLE = "아래 내용을\n확인해주세요";
const LIMIT = 10_000_000; // 서버의 1회 이체 한도
// 금액 읽기 (amount 4-3): 만 미만은 숫자 그대로 "2,000원", 만 이상은 "20만원" (끝자리가 남는 경우는 녹화에 없음 → "12만 3,456원")
function ibkReadWon(n: number) {
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!man) return `${nf.format(rest)}원`;
  return `${nf.format(man)}만${rest ? ` ${nf.format(rest)}` : ""}원`;
}
const dateOf = (iso: string) => iso.slice(0, 10).replaceAll("-", ".");
const digitsOf = (s = "") => s.replace(/\D/g, "");

export function IbkSend() {
  useIbkStatusBar();
  const go = useIbkGo();
  const navigate = useNavigate();
  const leaveHome = useIbkBack("/", 450); // ← 를 떼고 ≈600ms 뒤 홈 (who 6.7)
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "main");
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";
  const ready = !!data.data && !!home.data;
  useIbkSpinner(!ready && data.status !== "error" && home.status !== "error");

  const [stage, setStage] = useState<Stage>("who");
  const [dir, setDir] = useState<Dir | null>(null);
  const [seq, setSeq] = useState(0); // 본문을 새로 그릴 때마다 (스크롤 0, 전환 다시)
  const [to, setTo] = useState<To | null>(null);
  const [amount, setAmount] = useState(0);
  const [kp, setKp] = useState(false); // 숫자 자판
  const [memoTo, setMemoTo] = useState<string | null>(null); // 받는 분 통장 표기 (null = 내 이름)
  const [memoMe, setMemoMe] = useState<string | null>(null); // 내 통장 표기 (null = 받는 분 이름)
  const [editing, setEditing] = useState<"me" | "to" | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false); // 취소 → 이체를 취소하시겠습니까?
  const [fromSheet, setFromSheet] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [popSeq, setPopSeq] = useState(0); // 안드로이드 뒤로로 단계를 되돌린 횟수 // 누른 목록 행 (다음 화면까지 눌림 바탕 유지)
  // 받는 분 화면 상태 (금액에서 돌아와도 입력값·탭은 그대로)
  const [digits, setDigits] = useState("");
  const [tab, setTab] = useState<"acct" | "fav">("acct");
  const [mineOpen, setMineOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [bankSheet, setBankSheet] = useState(false);
  const [typing, setTyping] = useState(false); // 입금계좌 칸에 커서 (PC 는 아래 숫자 자판)
  const busy = useRef(false);
  const visited = useRef(false); // 금액 화면을 한 번 봤는지 (처음만 원호 로딩 — who 6.4 관측 1 vs 2)
  const leaving = useRef(false);

  // 머리줄 오른쪽(≡ ↔ 취소)은 본문보다 늦게 바뀜: 받는 분 → 금액은 도착하고 33ms 뒤(amount 8-1), 금액 → 받는 분은 밀기 둘째 프레임(≈100ms, who 6.6)
  const [head, setHead] = useState<Stage>("who");
  const headTimer = useRef(0);
  useEffect(() => () => clearTimeout(headTimer.current), []);
  const toStage = (s: Stage, d: Dir) => {
    clearTimeout(headTimer.current);
    headTimer.current = window.setTimeout(() => setHead(s), d === "fwd" ? 293 : 100);
    setStage(s);
    setDir(d);
    setSeq((n) => n + 1);
    setKp(false);
    setPicked(null);
    setTyping(false); // 입력칸이 사라지면 blur 가 오지 않음
  };
  const choose = (r: To) => {
    if (!to || to.bank.code !== r.bank.code || to.number !== r.number) {
      setMemoTo(null);
      setMemoMe(null);
    }
    setTo(r); // 금액은 그대로 (amount 8-6: 받는 분을 바꿔도 200,000원 유지)
  };

  // 목록 행 → 금액. 처음엔 원호 → 금액 화면이 오른쪽에서 (원호는 도착하고 ≈150ms 뒤 사라짐), 두 번째부터는 바로 (who 6.4·6.5).
  // 녹화는 누른 순간부터 원호 233ms · 전환 333ms 이고 손을 뗀 건 그 33~67ms 뒤 → 뗀(click) 뒤로는 200 / 290ms
  const pick = async (r: To, key: string) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(key);
    let release: (() => void) | null = null;
    if (!visited.current) {
      await ibkSleep(200);
      release = holdIbkSpinner();
      await ibkSleep(1000);
    } else await ibkSleep(290);
    visited.current = true;
    choose(r);
    toStage("amount", "fwd");
    busy.current = false;
    if (release) {
      await ibkSleep(380);
      release();
    }
  };

  // 입금계좌 직접 입력 → (은행) → 예금주 조회 → 금액. 최근·즐겨찾기·내 계좌에 같은 번호가 하나뿐이면 그 은행으로 바로
  const submitDigits = async (code?: string) => {
    if (busy.current) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (digits.length < 6) return setError("입금계좌번호를 정확히 입력해 주세요.");
    const known = [...(data.data?.recent ?? []), ...(data.data?.favorites ?? [])].filter((r) => r.number === digits).map((r) => r.bank.code);
    const mine = (data.data?.mine ?? []).filter((m) => digitsOf(m.number) === digits).map((m) => m.bank.code);
    const guess = [...new Set([...known, ...mine])];
    const bank = code ?? (guess.length === 1 ? guess[0] : null);
    if (!bank) return setBankSheet(true);
    busy.current = true;
    const release = holdIbkSpinner();
    try {
      const [r] = await Promise.all([api.lookupAccount(bank, digits), ibkSleep(700)]);
      visited.current = true;
      choose(r);
      toStage("amount", "fwd");
      await ibkSleep(380);
      release();
    } catch (e) {
      release();
      if (e instanceof ApiError && e.status === 404)
        setNotice({ message: "입금계좌 정보가 올바르지 않습니다. 은행과 계좌번호를 확인해 주시기 바랍니다.", then: "who" });
      else setError(e instanceof ApiError ? e.message : "연결에 실패했어요.");
    } finally {
      busy.current = false;
    }
  };

  // 거래내역 '다시이체': ?bank=…&number=… 로 오면 원호 아래에서 그 계좌를 조회해 금액 화면부터 (받는 분 화면은 그리지 않음)
  const againBank = params.get("bank");
  const againNumber = params.get("number");
  const [again, setAgain] = useState(!!(againBank && againNumber));
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    if (!againBank || !againNumber) return;
    let live = true;
    busy.current = true;
    const release = holdIbkSpinner();
    Promise.all([api.lookupAccount(againBank, againNumber), ibkSleep(700)])
      .then(
        ([r]) => {
          if (!live) return;
          visited.current = true;
          chooseRef.current(r);
          setHead("amount");
          setStage("amount");
        },
        () => live && setNotice({ message: "입금계좌 정보가 올바르지 않습니다. 은행과 계좌번호를 확인해 주시기 바랍니다.", then: "who" }),
      )
      .finally(() => {
        busy.current = false;
        release();
        if (live) setAgain(false);
      });
    return () => {
      live = false;
    };
  }, [againBank, againNumber]);

  // 금액 '다음' → 뗀 다음 프레임에 원호 1.4초 → 확인 화면 (오른쪽에서) | 안내 화면 (한 번에) — amount 8-5
  const next = async () => {
    if (busy.current || !to || !account || amount <= 0) return;
    busy.current = true;
    await ibkSleep(33);
    const release = holdIbkSpinner();
    await ibkSleep(1400);
    const problem: Notice | null = to.receiveError
      ? { message: "해당기관 기타 사유로 거래가 불가능합니다. 해당기관 고객센터에 문의해 주시기 바랍니다.", code: "ECBKEXT10625", then: "amount" }
      : to.accountId === account.id
        ? { message: "출금계좌와 입금계좌가 같습니다. 입금계좌를 확인해 주시기 바랍니다.", then: "amount" }
        : amount > LIMIT
          ? { message: `1회 이체한도(${nf.format(LIMIT)}원)를 초과하였습니다. 이체금액을 확인해 주시기 바랍니다.`, then: "amount" }
          : amount > account.balance
            ? { message: `출금가능금액(${nf.format(account.balance)}원)을 초과하였습니다. 이체금액을 확인해 주시기 바랍니다.`, then: "amount" }
            : null;
    if (problem) {
      release(); // 원호가 사라진 다음 프레임에 안내 화면 (27.700 → 27.733)
      await ibkSleep(33);
      setNotice(problem);
    } else {
      toStage("confirm", "fwd");
      await ibkSleep(100); // 원호는 확인 화면이 붙을 때 67~100ms 페이드아웃 (confirm 3-8)
      release();
    }
    busy.current = false;
  };

  // 보내기 → (비밀번호 생략) 버튼 비활성 + 원호 1.93초 → 완료 화면이 한 번에 (confirm 4-1). 녹화는 비밀번호 뒤에야 비활성 — 두 번 누름 막기
  const send = async () => {
    if (sending || !to || !account) return;
    setSending(true);
    const release = holdIbkSpinner();
    const mTo = (memoTo ?? me).trim();
    const mMe = (memoMe ?? to.holder).trim();
    try {
      const [result] = await Promise.all([
        api.transfer({ fromAccountId: account.id, bankCode: to.bank.code, number: to.number, amount, memoTo: mTo, memoMe: mMe }),
        ibkSleep(1930),
      ]);
      const state: IbkDoneState = {
        result,
        from: { id: account.id, number: account.number ?? "", label: account.label, bank: account.bank },
        memoTo: mTo,
        memoMe: mMe,
      };
      // 단계마다 쌓아 둔 뒤로가기 칸(ibkBack = n)을 먼저 걷고 이체 화면 자리를 완료로 바꿈.
      // 안 걷으면 기록이 [홈, 이체, 완료] 로 남아 완료·홈·거래내역에서 뒤로 하면 이체 화면이 다시 뜸
      leaving.current = true;
      const n = (window.history.state as { ibkBack?: number } | null)?.ibkBack ?? 0;
      if (n > 0)
        await new Promise<void>((done) => {
          window.addEventListener("popstate", () => done(), { once: true });
          window.history.go(-n);
        });
      navigate("/send/done", { replace: true, state });
      release();
    } catch (e) {
      release();
      setSending(false);
      setNotice({ message: e instanceof ApiError ? e.message : "연결에 실패했어요. 잠시 후 다시 시도해 주시기 바랍니다.", then: "confirm" });
    }
  };

  // 안내 화면 '확인' → 전환 없이 한 번에 (amount 7: 금액 화면 C 상태로)
  const closeNotice = () => {
    if (!notice) return;
    setNotice(null);
    if (notice.then !== stage) {
      clearTimeout(headTimer.current);
      setHead(notice.then);
      setStage(notice.then);
      setDir(null);
      setSeq((n) => n + 1);
    }
  };
  // 뒤로: 단계 하나씩. 머리줄 ← 는 뗀 뒤 ≈450ms 기다렸다 (amount 8-7, confirm 4-2), 안드로이드 뒤로는 바로
  const stepBack = () => {
    if (stage === "confirm") toStage("amount", "back");
    else if (stage === "amount") toStage("who", "back");
  };
  const headerBack = () => {
    if (busy.current) return;
    if (stage === "who") return leaveHome();
    busy.current = true;
    window.setTimeout(() => {
      busy.current = false;
      stepBack();
    }, 450);
  };
  // 금액·확인 단계 동안 뒤로가기 칸 하나. 뒤로가기로 빠지면 한 단계 되돌리고, 아직 깊으면 key(popSeq)를 바꿔 다시 쌓음.
  // (단계가 바뀔 때마다 key 를 바꾸면 걷어 내는 history.back() 과 다시 쌓는 pushState 가 엇갈려 칸이 사라짐 → 앞으로 갈 땐 그대로 둠)
  useIbkBackHandler(
    stage !== "who",
    () => {
      if (leaving.current) return; // 나가는 중(완료로 · 취소)에 걷어 낸 칸은 다시 쌓지 않음
      setPopSeq((n) => n + 1);
      if (!busy.current) stepBack();
    },
    popSeq,
  );
  useIbkBackHandler(!!notice, () => closeNotice());
  useIbkBackHandler(!!editing, () => setEditing(null));
  useIbkBackHandler(kp, () => setKp(false));
  useIbkBackHandler(asking, () => setAsking(false));
  useIbkBackHandler(!!error, () => setError(null));

  // 취소 → 예: 단계와 상관없이 이체를 나감 (쌓아 둔 뒤로가기 칸이 있으면 두 칸)
  // (지금 칸이 ibkBack = n 이면 n 칸 + 이체 화면 한 칸을 한 번에 — 열려 있던 알림창 등은 뒤로가기 처리기가 알아서 닫힘)
  const leave = () => {
    leaving.current = true;
    const st = window.history.state as { idx?: number; ibkBack?: number } | null;
    if ((st?.idx ?? 0) > 0) window.history.go(-((st?.ibkBack ?? 0) + 1));
    else navigate("/", { replace: true });
  };

  const anim = dir === "fwd" ? "ibk-in-right" : dir === "back" ? "ibk-in-left" : "";
  const late = dir === "fwd" ? "ibs-late" : dir === "back" ? "ibs-late ibs-late--back" : "";
  return (
    <div className="ibk ibk-page ibs">
      <IbkHeader
        title="이체"
        onBack={headerBack}
        right={
          head === "who" ? (
            <IbkHeaderIcon name="menu" label="전체메뉴" onClick={() => go("/menu", { anim: "menu-in" })} />
          ) : (
            <IbkHeaderText onClick={() => setAsking(true)}>취소</IbkHeaderText>
          )
        }
      />
      {stage === "who" && (
        <div key={`who-${seq}`} className={`ibk-body ibs-body ${anim}`}>
          {ready && !again ? (
            <Who
              data={data.data}
              digits={digits}
              onDigits={setDigits}
              onTyping={setTyping}
              onSubmit={() => submitDigits()}
              tab={tab}
              onTab={setTab}
              mineOpen={mineOpen}
              onMine={() => setMineOpen((v) => !v)}
              recentOpen={recentOpen}
              onRecent={() => setRecentOpen((v) => !v)}
              picked={picked}
              onPick={pick}
              onSoon={() => setError(SOON)}
            />
          ) : (
            (data.status === "error" || home.status === "error") && (
              <div className="ibs-fail">
                <p>정보를 불러오지 못했어요.</p>
                <button
                  onClick={() => {
                    data.retry();
                    home.retry();
                  }}
                >
                  다시 시도
                </button>
              </div>
            )
          )}
        </div>
      )}
      {/* 받는 분 입력칸: 폰은 기기 키보드, PC 는 같은 숫자 자판을 키보드 삼아 (입력칸에서 커서가 빠지면 아래 '다음' 버튼) */}
      {stage === "who" && ready && typing && !TOUCH && (
        <IbkKeypad doneLabel="다음" onKey={(k) => setDigits((d) => (k === "back" ? d.slice(0, -1) : (d + k).slice(0, 16)))} onDone={() => submitDigits()} />
      )}
      {stage === "who" && ready && !typing && digits.length > 0 && (
        <div className="ibk-bottom ibs-bottom">
          <button className="ibk-btn ibs-press" onClick={() => submitDigits()}>
            다음
          </button>
        </div>
      )}
      {stage === "amount" && to && account && (
        <>
          <div key={`amount-${seq}`} className={`ibk-body ibs-body ${anim}`}>
            <Amount
              account={account}
              to={to}
              amount={amount}
              kp={kp}
              onOpenKp={() => setKp(true)}
              onFrom={() => setFromSheet(true)}
              onChange={() => !busy.current && toStage("who", "back")}
              onGuide={() => setError(SOON)}
              onReserve={() => setError("연습용 앱에서는 예약이체를 할 수 없어요.")}
            />
          </div>
          {/* '다음'은 늘 있고 자판이 올라오면 판이 덮음 (자판 '확인'을 떼는 순간 같은 프레임에 보임 — amount 6-3) */}
          <div key={`next-${seq}`} className={`ibk-bottom ibs-bottom ${late}`}>
            <button className="ibk-btn ibs-press" disabled={amount <= 0} onClick={next}>
              다음
            </button>
          </div>
          {kp && (
            <IbkKeypad
              chips
              onKey={(k) => setAmount((a) => press(a, k))}
              onChip={(add) => setAmount((a) => Math.min(add === null ? account.balance : a + add, 99_999_999_999))}
              onDone={() => setKp(false)}
            />
          )}
        </>
      )}
      {stage === "confirm" && to && account && (
        <>
          <div key={`confirm-${seq}`} className={`ibk-body ibs-body ${anim}`}>
            <Confirm
              account={account}
              to={to}
              amount={amount}
              memoMe={memoMe ?? to.holder}
              memoTo={memoTo ?? me}
              onEdit={setEditing}
              onMore={() => setError(SOON)}
            />
          </div>
          <div key={`send-${seq}`} className={`ibk-bottom ibs-bottom ${late}`}>
            <button className="ibk-btn ibs-press" disabled={sending} onClick={send}>
              보내기
            </button>
          </div>
        </>
      )}

      {editing && to && (
        <MemoEdit
          title={editing === "me" ? "내 통장 표기" : "받는 분 통장 표기"}
          initial={editing === "me" ? (memoMe ?? to.holder) : (memoTo ?? me)}
          fallback={editing === "me" ? to.holder : me}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (editing === "me") setMemoMe(v);
            else setMemoTo(v);
            setEditing(null);
          }}
        />
      )}
      {notice && (
        <div className="ibs-notice">
          <IbkNotice title={TITLE} message={notice.message} code={notice.code} onConfirm={closeNotice} onConsult={() => setError(SOON)} />
        </div>
      )}
      <BankSheet
        open={bankSheet}
        banks={banks.data ?? []}
        onClose={() => setBankSheet(false)}
        onPick={(code) => {
          setBankSheet(false);
          void submitDigits(code);
        }}
      />
      <FromSheet
        open={fromSheet}
        accounts={home.data?.accounts ?? []}
        current={from}
        onClose={() => setFromSheet(false)}
        onPick={(id) => {
          setFrom(id);
          setFromSheet(false);
        }}
      />
      <Dialog message={error} onClose={() => setError(null)} />
      <Dialog message={asking ? "이체를 취소하시겠습니까?" : null} cancelLabel="아니요" okLabel="예" onCancel={() => setAsking(false)} onClose={leave} />
    </div>
  );
}

// 자판 키 → 금액. 11자리(999억)까지, 앞자리 0 은 안 붙음
function press(a: number, k: IbkKey) {
  if (k === "back") return Math.floor(a / 10);
  const s = `${a || ""}${k}`.replace(/^0+/, "");
  return s.length > 11 ? a : Number(s || 0);
}

// ---------- 누구에게 보낼까요? (spec/who.md) ----------
interface Row {
  key: string;
  r: To;
  name: string;
  last?: string; // 최종이체 날짜
}
function Who({
  data,
  digits,
  onDigits,
  onTyping,
  onSubmit,
  tab,
  onTab,
  mineOpen,
  onMine,
  recentOpen,
  onRecent,
  picked,
  onPick,
  onSoon,
}: {
  data: TransferRecipients;
  digits: string;
  onDigits: (d: string) => void;
  onTyping: (on: boolean) => void;
  onSubmit: () => void;
  tab: "acct" | "fav";
  onTab: (t: "acct" | "fav") => void;
  mineOpen: boolean;
  onMine: () => void;
  recentOpen: boolean;
  onRecent: () => void;
  picked: string | null;
  onPick: (r: To, key: string) => void;
  onSoon: () => void;
}) {
  const [focus, setFocus] = useState(false);
  const recent: Row[] = data.recent.map((r) => ({ key: `r-${r.bank.code}-${r.number}`, r, name: r.holder, last: dateOf(r.lastAt) }));
  const mine: Row[] = data.mine
    .filter((m) => m.number)
    .map((m) => {
      const n = digitsOf(m.number);
      return { key: `m-${m.accountId}`, r: { bank: m.bank, number: n, holder: m.holder, accountId: m.accountId }, name: m.label };
    });
  const favs: Row[] = data.favorites.map((p) => ({ key: `f-${p.id}`, r: { ...p, payeeId: p.payeeId }, name: p.holder }));
  const rows = (list: Row[]) =>
    list.map((row) => <WhoRow key={row.key} row={row} on={picked === row.key} onPick={() => onPick(row.r, row.key)} />);

  return (
    <div className="ibs-who">
      <div className="ibs-who__top">
        <h2 className="ibk-bl ibs-who__title">누구에게 보낼까요?</h2>
        <span className="ibk-bl ibs-who__label">입금계좌</span>
        <label className={`ibs-acct ${focus ? "ibs-acct--focus" : ""}`}>
          <input
            className="ibs-acct__input"
            value={digits}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="계좌번호 입력"
            aria-label="입금계좌"
            onFocus={() => {
              setFocus(true);
              onTyping(true);
            }}
            onBlur={() => {
              setFocus(false);
              onTyping(false);
            }}
            onChange={(e) => onDigits(digitsOf(e.target.value).slice(0, 16))}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
          {digits && focus ? (
            <button
              className="ibs-acct__clear"
              aria-label="지우기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                onDigits("");
              }}
            >
              <IbkIcon name="close" w={7.2} h={7.5} sw={1.4} color="#fff" />
            </button>
          ) : (
            <button
              className="ibs-acct__cam"
              aria-label="계좌 촬영"
              onClick={(e) => {
                e.preventDefault();
                onSoon();
              }}
            >
              <IbkIcon name="camera" sw={1.62} />
            </button>
          )}
        </label>
        <button className="ibs-link ibs-link--contact" onClick={onSoon}>
          <IbkIcon name="contact" />
          <span className="ibk-bl">연락처 이체</span>
        </button>
        <button className="ibs-link ibs-link--search" onClick={onSoon}>
          <IbkIcon name="search" sw={1.5} />
          <span className="ibk-bl">계좌 검색</span>
        </button>
        <div className={`ibs-seg ibs-seg--${tab}`} role="tablist">
          <i className="ibs-seg__pill" />
          <button role="tab" aria-selected={tab === "acct"} onClick={() => onTab("acct")}>
            <span className="ibk-bl">계좌번호</span>
          </button>
          <button role="tab" aria-selected={tab === "fav"} onClick={() => onTab("fav")}>
            <span className="ibk-bl">즐겨찾기</span>
          </button>
        </div>
      </div>
      {tab === "acct" ? (
        <>
          <Section title="내 계좌" open={mineOpen} onToggle={onMine} />
          {mineOpen && (mine.length ? rows(mine) : <p className="ibs-empty">보낼 수 있는 내 계좌가 없어요</p>)}
          <Section title="최근 이체" count={recent.length} open={recentOpen} onToggle={onRecent} />
          {recentOpen && (recent.length ? rows(recent) : <p className="ibs-empty">최근 이체한 계좌가 없어요</p>)}
        </>
      ) : favs.length ? (
        <div className="ibs-favs">{rows(favs)}</div>
      ) : (
        <p className="ibs-empty ibs-empty--fav">즐겨찾기한 계좌가 없어요</p>
      )}
      <div className="ibs-who__end" />
    </div>
  );
}

// 섹션 머리 ('내 계좌 ⌄' · '최근 이체 16 ⌃'): 높이 52, 기준선 +26 (who 2.8·2.9)
function Section({ title, count, open, onToggle }: { title: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <button className={`ibs-sec ${count === undefined ? "ibs-sec--mine" : ""}`} onClick={onToggle} aria-expanded={open}>
      <span className="ibk-bl">
        {title}
        {count !== undefined && <b>{count}</b>}
      </span>
      <IbkIcon name={open ? "chevron-up" : "chevron-down"} sw={1.38} className={open ? "ibs-sec__up" : "ibs-sec__down"} />
    </button>
  );
}

// 목록 행 (who 2.10): 피치 63.55, 로고 원 29.6 · 이름 · 은행 번호 · 최종이체 날짜. 누르면 scale(0.96) + 바탕 #f4f5f8 (6.4)
function WhoRow({ row, on, onPick }: { row: Row; on: boolean; onPick: () => void }) {
  return (
    <button className={`ibs-row ${on ? "ibs-row--on" : ""}`} onClick={onPick}>
      <i className="ibs-row__bg" />
      <span className="ibs-row__in">
        <span className="ibs-row__logo">
          <IbkBankLogo bank={row.r.bank} size={29.6} />
        </span>
        <b className="ibk-bl ibs-row__name">{row.name}</b>
        <span className="ibk-bl ibs-row__acct">
          <small>{row.r.bank.short}</small>
          {ibkNumber(row.r.bank, row.r.number)}
        </span>
        {row.last && (
          <span className="ibk-bl ibs-row__last">
            <small>최종이체</small> {row.last}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------- 얼마를 보낼까요? (specB/amount.md) ----------
function Amount({
  account,
  to,
  amount,
  kp,
  onOpenKp,
  onFrom,
  onChange,
  onGuide,
  onReserve,
}: {
  account: Account;
  to: To;
  amount: number;
  kp: boolean;
  onOpenKp: () => void;
  onFrom: () => void;
  onChange: () => void;
  onGuide: () => void;
  onReserve: () => void;
}) {
  return (
    <div className="ibs-amt">
      <h2 className="ibk-bl ibs-amt__h ibs-amt__h--from">내 계좌에서</h2>
      <span className="ibs-amt__logo ibs-amt__logo--from">
        <IbkBankLogo bank={account.bank} size={21.9} />
      </span>
      <button className="ibs-amt__line ibs-amt__line--from" onClick={onFrom} aria-label="출금계좌 바꾸기">
        <span className="ibs-amt__bank">{account.bank.short}</span>
        <span className="ibs-amt__num">{ibkNumber(account.bank, account.number ?? "")}</span>
        <IbkIcon name="chevron-down" w={12.9} h={6.15} color="#7a7a7a" className="ibs-amt__chev" />
      </button>
      <span className="ibk-bl ibs-amt__avail">
        출금가능금액 <span>{nf.format(account.balance)}</span>원
      </span>
      <h2 className="ibk-bl ibs-amt__h ibs-amt__h--to">{to.holder}님 계좌로</h2>
      <span className="ibs-amt__logo ibs-amt__logo--to">
        <IbkBankLogo bank={to.bank} size={22.6} />
      </span>
      <div className="ibs-amt__line ibs-amt__line--to">
        <span className="ibs-amt__bank">{to.bank.short}</span>
        <span className="ibs-amt__num">{ibkNumber(to.bank, to.number)}</span>
        <button className="ibs-amt__change" onClick={onChange}>
          변경
        </button>
      </div>
      <button className={`ibs-amt__field ${kp ? "ibs-amt__field--focus" : ""}`} onClick={onOpenKp} aria-label="보낼 금액">
        {amount > 0 ? (
          <span className="ibk-bl ibs-amt__value">
            {nf.format(amount)}
            <small>원</small>
          </span>
        ) : (
          <>
            <span className="ibk-bl ibs-amt__ph">얼마를 보낼까요?</span>
            {kp && <i className="ibs-amt__caret" />}
          </>
        )}
        <i className="ibs-amt__under" />
      </button>
      {amount > 0 && <span className="ibk-bl ibs-amt__read">{ibkReadWon(amount)}</span>}
      <button className="ibs-amt__guide" onClick={onGuide}>
        <span className="ibk-bl">이용안내</span>
      </button>
      <button className="ibs-amt__reserve" onClick={onReserve}>
        <i className="ibs-amt__check" />
        <span className="ibk-bl">예약이체</span>
      </button>
    </div>
  );
}

// ---------- ○○님께 N원을 보낼까요? (specB/confirm.md 3) ----------
function Confirm({
  account,
  to,
  amount,
  memoMe,
  memoTo,
  onEdit,
  onMore,
}: {
  account: Account;
  to: To;
  amount: number;
  memoMe: string;
  memoTo: string;
  onEdit: (which: "me" | "to") => void;
  onMore: () => void;
}) {
  return (
    <div className="ibs-cf">
      <span className="ibs-cf__logo ibs-cf__logo--from">
        <IbkBankLogo bank={account.bank} size={29.8} />
      </span>
      {/* ▸ 1.5초 주기로 깜빡임 (3-2) */}
      <svg className="ibs-cf__tri" width="5.94" height="11.8" viewBox="0 0 5.94 11.8" aria-hidden>
        <path d="M0 0v11.8l5.94-5.9Z" fill="#101010" stroke="#101010" strokeWidth="0.6" strokeLinejoin="round" />
      </svg>
      <span className="ibs-cf__logo ibs-cf__logo--to">
        <IbkBankLogo bank={to.bank} size={29.9} />
      </span>
      <h2 className="ibk-bl ibs-cf__name">{to.holder}님께</h2>
      <span className="ibk-bl ibs-cf__acct">{`${to.bank.short} ${ibkNumber(to.bank, to.number)}`}</span>
      <h2 className="ibk-bl ibs-cf__q">
        <span>{nf.format(amount)}</span>원을 보낼까요?
      </h2>
      <span className="ibk-bl ibs-cf__kor">{ibkReadWon(amount)}</span>
      <div className="ibs-cf__card">
        <div className="ibs-cf__row ibs-cf__row--from">
          <span className="ibk-bl ibs-cf__label">출금계좌</span>
          <span className="ibk-bl ibs-cf__from">
            <span className="ibs-cf__mini">
              <IbkBankLogo bank={account.bank} size={16.7} />
            </span>
            {`${account.bank.short} ${ibkNumber(account.bank, account.number ?? "")}`}
          </span>
          <span className="ibk-bl ibs-cf__fromname">{account.label}</span>
        </div>
        <CfRow label="내 통장 표기" value={memoMe} onClick={() => onEdit("me")} />
        <CfRow label="받는 분 통장 표기" value={memoTo} onClick={() => onEdit("to")} />
      </div>
      <button className="ibs-cf__more" onClick={onMore}>
        <span className="ibk-bl">추가정보입력</span>
        <IbkIcon name="chevron-down" w={9.33} h={4.78} sw={1.3} color="#3a3a3a" />
      </button>
      <p className="ibs-cf__promo">
        <span className="ibk-bl">기업은행은</span>
        <b className="ibk-bl">평생 수수료 무료!</b>
      </p>
    </div>
  );
}
function CfRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button className="ibs-cf__row" onClick={onClick}>
      <span className="ibk-bl ibs-cf__label">{label}</span>
      <span className="ibk-bl ibs-cf__val">{value}</span>
      <IbkIcon name="chevron-right" color="#1e1e1e" className="ibs-cf__gt" />
    </button>
  );
}

// ---------- 통장 표기 고치기 (녹화에 없음 — 받는 분 입력칸 모양을 빌림) ----------
function MemoEdit({
  title,
  initial,
  fallback,
  onClose,
  onSave,
}: {
  title: string;
  initial: string;
  fallback: string; // 비우면 이 값으로
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);
  const save = () => onSave(v.trim() || fallback);
  return (
    <div className="ibk-page ibs-edit">
      <IbkHeader title={title} onBack={onClose} />
      <div className="ibk-body">
        <h2 className="ibk-bl ibs-edit__title">통장에 표시할 이름을 입력해 주세요</h2>
        <span className="ibk-bl ibs-who__label">{title}</span>
        <label className="ibs-acct ibs-acct--focus">
          <input
            ref={input}
            className="ibs-acct__input"
            value={v}
            maxLength={10}
            autoComplete="off"
            placeholder={fallback}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </label>
        <span className="ibk-bl ibs-edit__help">최대 10자까지 입력할 수 있어요</span>
      </div>
      <div className="ibk-bottom">
        <button className="ibk-btn ibs-press" onClick={save}>
          확인
        </button>
      </div>
    </div>
  );
}

// ---------- 은행 고르기 시트 (녹화에 없음 — 하나원큐 은행 시트 구조를 IBK 모양으로: 제목 · ✕ · 은행|증권사 세그먼트 · 3열 타일) ----------
function BankSheet({ open, banks, onClose, onPick }: { open: boolean; banks: Bank[]; onClose: () => void; onPick: (code: string) => void }) {
  const [tab, setTab] = useState<"bank" | "securities">("bank");
  const list = banks.filter((b) => b.section === tab);
  return (
    <IbkSheet open={open} onClose={onClose} className="ibs-sheet">
      <div className="ibs-sheet__in ibs-banks">
        <h2 className="ibk-bl ibs-sheet__title">은행 선택</h2>
        <button className="ibs-sheet__close" onClick={onClose} aria-label="닫기">
          <IbkIcon name="close" />
        </button>
        <div className={`ibs-seg ibs-seg--${tab === "bank" ? "acct" : "fav"} ibs-seg--sheet`} role="tablist">
          <i className="ibs-seg__pill" />
          <button role="tab" aria-selected={tab === "bank"} onClick={() => setTab("bank")}>
            <span className="ibk-bl">은행</span>
          </button>
          <button role="tab" aria-selected={tab === "securities"} onClick={() => setTab("securities")}>
            <span className="ibk-bl">증권사</span>
          </button>
        </div>
        <div className="ibs-banks__grid">
          {list.map((b) => (
            <button key={b.code} className="ibs-tile" onClick={() => onPick(b.code)}>
              <IbkBankLogo bank={b} size={30} />
              <span>{b.short}</span>
            </button>
          ))}
        </div>
      </div>
    </IbkSheet>
  );
}

// ---------- 출금계좌 고르기 시트 (금액 화면 ⌄ — 녹화에 없음, 같은 시트 모양) ----------
function FromSheet({
  open,
  accounts,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  accounts: Account[];
  current: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <IbkSheet open={open} onClose={onClose} className="ibs-sheet">
      <div className="ibs-sheet__in" style={{ height: 86 + accounts.length * 72 + 24 }}>
        <h2 className="ibk-bl ibs-sheet__title">출금계좌 선택</h2>
        <button className="ibs-sheet__close" onClick={onClose} aria-label="닫기">
          <IbkIcon name="close" />
        </button>
        <ul className="ibs-froms">
          {accounts.map((a) => (
            <li key={a.id}>
              <button className={a.id === current ? "on" : ""} onClick={() => onPick(a.id)}>
                <IbkBankLogo bank={a.bank} size={29.6} />
                <b>{`${a.bank.short} ${ibkNumber(a.bank, a.number ?? "")}`}</b>
                <span>{a.label}</span>
                <strong>{nf.format(a.balance)}원</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </IbkSheet>
  );
}
