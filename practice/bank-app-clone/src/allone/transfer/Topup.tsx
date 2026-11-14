// T5 잔액채우기 (transfer.md §2.5 · §2.6 · §3.10–3.17 · §5.3, C3 2.263–12.146): 입금계좌(받는 NH 계좌) ← 출금계좌(내 다른 계좌).
//  - 출금계좌가 없으면 T6 출금계좌 선택 웹 시트가 저절로 올라옴 (잔액채우기 링크로 왔으면 링크 +983ms, 막 밑에서)
//  - T6 줄 → topupRow 막 → 시트가 한 프레임에 사라지고 계좌 표시 → 막이 걷히는 프레임에 T7 금액 입력 (금액이 0 일 때)
//  - 잔액채우기 = POST /api/transfers (출금계좌 → 입금계좌, 통장 표시 "잔액채우기"), topupSubmit 막 (567)
//    성공: T2 에서 왔으면 이 화면을 닫고(CUT) T2 판이 다시 들어옴 + "잔액을 채웠어요" (판 위), 메뉴 · 카드에서 왔으면 그대로 + 금액 0 + 토스트
// 1회 한도 500만 · 1일 잔여한도 100만 − 오늘 그 계좌에서 채운 합계 (표시 + 화면 검사, 서버 한도 없음)
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { prefetch, useApi } from "../../api/useApi";
import { aoApi, aoPaths, type AoHome, type AoTransferRecord } from "../api";
import { aoBankName } from "../bank";
import { aoViaOf, useAoFlow } from "../flow";
import { AO_LIMITS, aoAccountNumber, aoAmountReading, aoBankLine, aoDailyRemaining, aoNum, aoTopupError } from "../format";
import { AO_AMOUNT_SHEET } from "../motion";
import { aoHereKey, LOAD, useAoBack } from "../nav";
import { AoBankLogo, AoButton, AoChevronDownIcon, AoHeader, AoPage, AoSheet, aoLoad, aoToast } from "../ui";
import { AmountSheet } from "./AmountSheet";
import { SendRow } from "./parts";
import { logoBank, sinceTopupLink } from "./util";

const T6_AT_LINK = 983; // 링크를 누르고 983ms 에 T6 이 막 밑에서 올라오기 시작 (C3 2.879)
const TOAST_PANEL = 419;

// "500만" · "100만" · "99만 9,000" (원은 따로)
const manText = (n: number) => aoAmountReading(n).replace(/원$/, "");

export function Topup() {
  const [params] = useSearchParams();
  const location = useLocation();
  const flow = useAoFlow();
  const back = useAoBack();
  const home = useApi<AoHome>(aoPaths.home);
  const toId = params.get("to") ?? "main";
  const origin = params.get("origin") ?? "menu";
  const [fromId, setFromId] = useState<string | null>(params.get("from"));
  const transfers = useApi<AoTransferRecord[]>(aoPaths.transfers(fromId ?? toId));

  const accounts = home.data?.accounts ?? [];
  const to = accounts.find((a) => a.id === toId);
  const from = fromId ? accounts.find((a) => a.id === fromId) : undefined;
  // 출금계좌 후보: 입금계좌만 빼고 다른 은행 먼저 (C3 4.5: KB · 케이뱅크 · NH)
  const sources = accounts.filter((a) => a.id !== toId).sort((a, b) => Number(a.bank.code === "nh") - Number(b.bank.code === "nh"));

  const [amount, setAmount] = useState(0);
  const [t6, setT6] = useState(false);
  const [t6Exit, setT6Exit] = useState<"slide" | "cut">("slide");
  const [t7, setT7] = useState(false);
  const [t7Delay, setT7Delay] = useState<number>(AO_AMOUNT_SHEET.riseDelay);
  const [t7Up, setT7Up] = useState(false); // T7 막이 남아 있는 동안 (출금계좌 묶음에 테, C3 11.5)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 잔액채우기 버튼: 출금계좌를 고른 뒤에도 금액 입력(T7)이 한 번 닫힐 때까지는 회색 (C3 5.45–5.6 회색 → 7.85 초록).
  // 주소에 출금계좌가 있으면(다른금융 카드) 처음부터 켜짐
  const [armed, setArmed] = useState(() => !!params.get("from"));
  const bodyRef = useRef<HTMLDivElement>(null);

  // 처음 열릴 때 출금계좌가 없으면 T6 이 저절로 (링크에서 왔으면 막 시각표대로 +616ms, 아니면 바로). 첫 그림 한 번만
  const first = useRef({ from: params.get("from"), via: aoViaOf(location.state) });
  useEffect(() => {
    if (first.current.from) return;
    const since = sinceTopupLink();
    const wait = first.current.via !== "topupLink" ? 0 : since < 3000 ? Math.max(0, T6_AT_LINK - since) : T6_AT_LINK - LOAD.topupLink.cut;
    const t = window.setTimeout(() => {
      setT6Exit("slide");
      setT6(true);
    }, wait);
    return () => window.clearTimeout(t);
  }, []);

  const openT6 = () => {
    if (busy) return;
    setT6Exit("slide");
    setT6(true);
  };
  const openT7 = (delay: number) => {
    setT7Delay(delay);
    setT7(true);
    setT7Up(true);
  };
  // T6 줄: topupRow 막 → cut 에 시트를 한 프레임에 치우고 계좌 표시 → 막이 걷히는 프레임에 T7 (C3 5.179 → 5.463 → 5.579)
  const picking = useRef(false); // 두 번 누름에 막이 두 번 돌지 않게 (렌더 전 두 번째 누름까지)
  const pick = (id: string) => {
    if (picking.current) return;
    picking.current = true;
    void aoLoad("topupRow", {
      task: prefetch(aoPaths.transfers(id)),
      onCut: () => {
        setT6Exit("cut");
        setT6(false);
        setFromId(id);
        setError(null);
      },
      onHidden: () => {
        if (amount === 0) openT7(AO_AMOUNT_SHEET.riseDelay);
      },
    }).then(() => void (picking.current = false));
  };

  const daily = from ? aoDailyRemaining(transfers.data) : 0;
  const onBlockNotice = () => void (from && flow.goBlockNotice(from.id));
  const submitting = useRef(false);
  const submit = () => {
    // T7 가 닫히는 동안(내려감 + 막 370ms)의 누름은 네이티브 막이 받음 (ui.css .ao-nsheet--closing) — 여기로 오지 않음
    if (!from || !to || busy || submitting.current) return;
    // 지급정지 (invented) — 다른 오류보다 먼저 봄
    const err = from.blocked ? "입출금이 제한된 계좌예요" : aoTopupError(amount, from.balance, daily);
    setError(err);
    if (err) {
      // 오류 줄은 금액 칸 아래(아래 버튼 띠에 가려 있음) → 끝까지 내려 보이게
      const body = bodyRef.current;
      body?.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      return;
    }
    submitting.current = true;
    setBusy(true);
    const amt = amount;
    // 막 동안 브라우저 뒤로를 눌렀으면(topupSubmit 은 뒤로를 무시하고 끝까지 돎) 이미 이 화면을 떠났으므로 cut 의 뒤로는 하지 않음. 토스트는 도착한 화면에
    const here = aoHereKey();
    void aoLoad("topupSubmit", {
      // 채우기만 기다림 (POST 가 성공하면 무효화로 열린 화면들이 홈 데이터를 다시 받음 — 같은 주소를 또 받으면 브라우저 연결 수(6)에 막혀 cut 이 250ms 늦었음).
      // T2 계좌 줄 잔액은 그 다시 받기로 막 밑에서 바뀜
      task: () => aoApi.topup(from.id, to, amt),
      onCut: () => {
        setAmount(0);
        if (origin === "amount" && aoHereKey() === here) back();
      },
      onHidden: () => {
        submitting.current = false;
        setBusy(false);
        aoToast("잔액을 채웠어요", origin === "amount" ? { bottom: TOAST_PANEL } : {});
      },
      onError: (e) => {
        submitting.current = false;
        setBusy(false);
        setError(e instanceof Error && e.message ? e.message : "잠시 후 다시 시도해 주세요");
      },
    });
  };

  const sel = !!from;
  return (
    <AoPage
      className={`ao-send-topup${sel ? " ao-send-topup--sel" : ""}`}
      bodyRef={bodyRef}
      header={<AoHeader variant="modal" title="잔액채우기" onClose={() => back()} />}
      footer={
        <AoButton className="ao-send-topup__submit" disabled={!sel || !armed || !!from?.blocked} disabledColor="#808080" radius={15} height={56} size={18.5} onPress={submit}>
          잔액채우기
        </AoButton>
      }
    >
      <div className="ao-send-topup__body">
        <h2 className="ao-send-topup__title">
          잔액이 부족할 땐
          <br />
          NH올원뱅크에서 채워보세요
        </h2>

        <p className="ao-send-topup__label ao-send-topup__label--in">입금계좌</p>
        <div className="ao-send-field ao-send-topup__to">
          <span className="ao-send-topup__totext">{to ? `${aoBankName(to.bank)} ${aoAccountNumber(to)}` : ""}</span>
        </div>
        <p className="ao-send-topup__bal">{to ? `잔액${aoNum(to.balance)}원` : ""}</p>

        <p className="ao-send-topup__label ao-send-topup__label--out">출금계좌</p>
        {from ? (
          <button type="button" className={`ao-send-topup__from${t7Up ? " ao-send-topup__from--focus" : ""}`} onClick={openT6}>
            <AoBankLogo code={from.bank.code} bank={logoBank(from.bank)} style={{ position: "absolute", left: 20, top: 32.67 }} />
            <span className="ao-send-topup__pname">{from.label}</span>
            {/* 지급정지 (invented, 녹화에 없음) */}
            {from.blocked && <span className="ao-send-topup__tag">지급정지</span>}
            <span className="ao-send-topup__psub">{aoBankLine(from)}</span>
            <AoChevronDownIcon w={12} h={6.67} stroke={1.5} className="ao-send-topup__pchev" />
            <span className="ao-send-topup__avl">출금가능금액</span>
            <span className="ao-send-topup__avamt">
              <span className="ao-num">{aoNum(from.balance)}</span>
              <span className="ao-send-topup__avwon">원</span>
            </span>
          </button>
        ) : (
          <button type="button" className="ao-send-field ao-send-topup__select" onClick={openT6}>
            <span>출금계좌를 선택해주세요</span>
            <AoChevronDownIcon w={12.3} h={6.7} stroke={1.5} className="ao-send-topup__chev" />
          </button>
        )}

        <p className="ao-send-topup__label ao-send-topup__label--amt">금액</p>
        <button
          type="button"
          className="ao-send-field ao-send-topup__amt"
          onClick={() => {
            if (busy) return;
            if (!sel) return openT6();
            openT7(46);
          }}
        >
          {amount > 0 ? (
            <span className="ao-send-topup__amtval">{aoNum(amount)} 원</span>
          ) : (
            <>
              <span className="ao-send-topup__zero">0</span>
              <span className="ao-send-topup__unit">원</span>
            </>
          )}
        </button>
        {error && (
          <p className="ao-send-topup__error">
            {error}
            {from?.blocked && (
              <button type="button" className="ao-send-topup__errlink" onClick={onBlockNotice}>
                자세히 보기
              </button>
            )}
          </p>
        )}
        {/* 값 숫자는 Roboto 700 (C3 9.2: 숫자 간격 7.33 = Roboto, Pretendard 700 은 8.3 이라 3pt 넓음) */}
        <p className="ao-send-topup__limit ao-send-topup__limit--1">
          1회 한도 {sel ? <><b className="ao-num">{manText(AO_LIMITS.perTransfer)}</b> 원</> : <><b className="ao-num">0</b>원</>}
        </p>
        <p className="ao-send-topup__limit ao-send-topup__limit--2">
          1일 잔여한도 {sel && daily > 0 ? <><b className="ao-num">{manText(daily)}</b> 원</> : <><b className="ao-num">0</b>원</>}
        </p>
      </div>

      {/* T6 출금계좌 선택 */}
      <AoSheet
        open={t6}
        top={453}
        exit={t6Exit}
        title="출금계좌 선택"
        onClose={() => {
          setT6Exit("slide");
          setT6(false);
        }}
        className="ao-send-t6"
        footer={
          <div className="ao-send-t6__btns">
            {/* 계좌 등록은 🔔 관리 패널에서 (녹화의 두 버튼은 누름만) */}
            <AoButton variant="outline" radius={15} height={56} size={18.4} weight={500} width={166.8}>
              농협 계좌등록
            </AoButton>
            <AoButton radius={15} height={56} size={18.4} width={166.6}>
              타행 계좌등록
            </AoButton>
          </div>
        }
      >
        {sources.map((a) => (
          <SendRow
            key={a.id}
            code={a.bank.code}
            bank={a.bank}
            h={63}
            name={a.label}
            sub={a.bank.code === "nh" ? aoBankLine(a) : `${aoBankName(a.bank)} ${(a.number ?? "").replace(/\D/g, "")}`}
            onPress={() => pick(a.id)}
          />
        ))}
      </AoSheet>

      <AmountSheet
        open={t7}
        initial={amount}
        riseDelay={t7Delay}
        onClose={() => setT7(false)}
        onClosed={() => {
          setT7Up(false);
          setArmed(true);
        }}
        onConfirm={(v) => {
          setAmount(v);
          setError(null);
          setT7(false);
        }}
      />
    </AoPage>
  );
}
