import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Keypad } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { applyKey } from "../lib/keypad";
import { BackArrowKey, NhAccountIcon, NhHeader } from "./common";
import { nhWon } from "./hangul";

// 전체계좌 조회: 계좌마다 카드 (이름·번호·잔액) + [거래내역][송금]. "넓게" 켜면 카드 사이 간격이 넓어짐
export function NhAccounts() {
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const home = useApi<HomeData>(paths.home);
  const [wide, setWide] = useState(false);
  useStatusBar("#18171c", "light");
  const accounts = home.data?.accounts ?? [];
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="screen nh nh-accounts">
      <NhHeader title="전체계좌 조회" onBack={() => navigate(-1)} home={() => navigate("/")} />
      <div className="nh-accounts__summary">
        <span>
          입출금 <b>{accounts.length}</b>
        </span>
        <span className="nh-accounts__total">{nhWon(total)}</span>
        <label className="nh-toggle">
          넓게
          <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} />
          <i />
        </label>
      </div>
      <div className={`nh-accounts__list ${wide ? "wide" : ""}`}>
        {accounts.map((a) => (
          <div key={a.id} className="nh-acard">
            <button className="nh-acard__top" onClick={() => go(`/history/${a.id}`)}>
              <NhAccountIcon size={28} />
              <span>
                <b>{a.label}</b>
                <small>{a.number}</small>
              </span>
            </button>
            <p className="nh-acard__balance">{nhWon(a.balance)}</p>
            <div className="nh-acard__btns">
              <button onClick={() => go(`/history/${a.id}`)}>거래내역</button>
              <button onClick={() => go(`/send?from=${a.id}`)}>송금</button>
            </div>
          </div>
        ))}
        <button className="nh-accounts__add" onClick={() => go("/register")}>
          + 농협계좌 등록
        </button>
      </div>
    </div>
  );
}

// 농협계좌 등록: 계좌번호(14자리 농축협 또는 13자리 농협은행) + 잔액 → 내 계좌 목록에 추가
export function NhRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"number" | "balance">("number");
  const [digits, setDigits] = useState("");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  useStatusBar("#18171c", "light");

  const submit = async () => {
    try {
      await api.addBankAccount({ bankCode: "nh", number: digits, balance: Number(balance || 0) });
      navigate(-1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };

  return (
    <div className="screen nh nh-register">
      <NhHeader title="농협계좌 등록" onBack={() => (step === "balance" ? setStep("number") : navigate(-1))} />
      <h2 className="nh-register__title">{step === "number" ? "등록할 농협 계좌번호를\n입력해 주세요" : "지금 잔액을\n입력해 주세요"}</h2>
      <div className="nh-number__box on">
        <span>{step === "number" ? digits || <i>계좌번호 입력</i> : balance ? nhWon(Number(balance)) : <i>0원</i>}</span>
      </div>
      <p className="nh-register__hint">{step === "number" ? "농축협 14자리, 농협은행 13자리" : "연습용이라 실제 잔액과 상관없어요"}</p>
      <div className="nh-register__pad">
        <Keypad
          kok={step === "number"}
          doubleZero={step === "balance"}
          rowHeight={53}
          back={<BackArrowKey />}
          onKey={(k) => (step === "number" ? setDigits((v) => applyKey(v, k, 14)) : setBalance((v) => applyKey(v, k, 9)))}
        />
        <button
          className="nh-btn nh-sheet-btn"
          disabled={step === "number" && digits.length < 13}
          onClick={() => (step === "number" ? setStep("balance") : submit())}
        >
          {step === "number" ? "다음" : "등록"}
        </button>
      </div>
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}
