// 이체 확인 (invented, transfer.md §5.1): 계좌 비밀번호 뒤 password 막(483)으로 들어옴. 녹화에는 이 뒤가 없어서 지어낸 화면.
// 제목 두 줄 (T5 모양) + 상자 (받는 계좌 · 출금 계좌 · 받는 분 통장 표시 › · 내 통장 표시 › · 수수료 면제) + 메모 칸 + 보내기.
// 통장 표시 줄은 입력 시트 (최대 20자, 한국어 키보드). 보내기 → send 막 (max(api, 1000)) 동안 POST /api/transfers → 이체 완료 (replace)
// 그사이 출금계좌가 지급정지됐으면(403 ACCOUNT_BLOCKED) 이동 없이 '안내' 팝업 (막이 걷히기 33ms 전, 잔액채우기와 같게) → 확인 → 이체 확인 그대로
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import type { Bank } from "../../api/types";
import { aoApi, aoPaths, type AoHome, type AoTransferResult } from "../api";
import { useAoFlow } from "../flow";
import { aoBankLast4, aoDigits, aoNum } from "../format";
import { useAoBack } from "../nav";
import { useLayerActive } from "../../platform/LayerContext";
import { isAoBlocked } from "./blocked";
import { BlockedAlert } from "./BlockedAlert";
import { AoButton, AoCaret, AoChevronRightIcon, AoHeader, AoKeyboard, AoPage, AoSheet, aoToast } from "../ui";
import { bankLabel } from "./util";

const MAX = 20;
type Edit = null | "to" | "me";

export function SendConfirm() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  const back = useAoBack();
  const home = useApi<AoHome>(aoPaths.home);
  const banks = useApi<Bank[]>(aoPaths.banks).data;

  const fromId = params.get("from") ?? "main";
  const bankCode = params.get("bank") ?? "";
  const number = aoDigits(params.get("number"));
  const holder = params.get("holder") ?? "";
  const amount = Number(params.get("amount")) || 0;
  const from = home.data?.accounts.find((a) => a.id === fromId);
  const me = home.data?.profile.userName ?? "";

  // 통장 표시: 빈 값 = 기본 (받는 분 쪽 = 내 이름, 내 쪽 = 받는 분 이름 — 서버 기본과 같음)
  const [memoTo, setMemoTo] = useState("");
  const [memoMe, setMemoMe] = useState("");
  const [memo, setMemo] = useState("");
  const [edit, setEdit] = useState<Edit>(null);
  const [draft, setDraft] = useState("");
  const [memoFocus, setMemoFocus] = useState(false);
  const [blocked, setBlocked] = useState(false); // 지급정지 '안내'
  const bodyRef = useRef<HTMLDivElement>(null);
  const active = useLayerActive();
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => () => void (activeRef.current = false), []); // 뒤로로 떠나 사라진 뒤 막이 끝나도 (도착한 화면에 토스트)

  // 메모 칸에 들어가면 키보드(위 490) 위로 보이게 올림
  useEffect(() => {
    if (memoFocus) bodyRef.current?.scrollTo({ top: 120 });
  }, [memoFocus]);

  const openEdit = (k: Exclude<Edit, null>) => {
    setMemoFocus(false);
    setDraft(k === "to" ? memoTo || me : memoMe || holder);
    setEdit(k);
  };
  const applyEdit = () => {
    const v = draft.trim().slice(0, MAX);
    if (edit === "to") setMemoTo(v === me ? "" : v);
    if (edit === "me") setMemoMe(v === holder ? "" : v);
    setEdit(null);
  };

  const send = () => {
    if (!from) return;
    setMemoFocus(false);
    let result: AoTransferResult | null = null;
    const note = memo.trim();
    void flow.go(
      () => {
        const q = new URLSearchParams({ from: fromId, bank: bankCode, number, holder, amount: String(amount), after: String(result?.balanceAfter ?? "") });
        if (note) q.set("memo", note);
        return `/send/done?${q}`;
      },
      {
        via: "send",
        replace: true,
        task: () =>
          aoApi
            .transfer({ fromAccountId: fromId, bankCode, number, amount, ...(memoTo && { memoTo }), ...(memoMe && { memoMe }) })
            .then((r) => {
              result = r;
              return note ? aoApi.updateMemo(r.outTxId, note) : undefined;
            }),
        onError: (e) => {
          // 지급정지: 이 화면이 맨 위면 '안내'. 막 동안 뒤로로 떠났으면(send 는 뒤로를 무시하고 끝까지 돎) 도착한 화면에 토스트
          if (isAoBlocked(e) && activeRef.current) setBlocked(true);
          else aoToast(e instanceof Error && e.message ? e.message : "잠시 후 다시 시도해 주세요");
        },
      },
    );
  };

  const rows: [string, string, (() => void)?][] = [
    ["받는 계좌", `${bankLabel(banks, bankCode)} ${number}`],
    ["출금 계좌", from ? aoBankLast4(from) : ""],
    ["받는 분 통장 표시", memoTo || me, () => openEdit("to")],
    ["내 통장 표시", memoMe || holder, () => openEdit("me")],
    ["수수료", "면제"],
  ];

  return (
    <AoPage
      className={`ao-send-confirm${memoFocus ? " ao-send-confirm--kb" : ""}`}
      bodyRef={bodyRef}
      header={<AoHeader variant="flow" onBack={() => back()} onCancel={() => void flow.goHomeFresh()} />}
      footer={
        <AoButton className="ao-send-confirm__send" disabled={!from || amount <= 0} radius={15} height={56} size={18.5} onPress={send}>
          보내기
        </AoButton>
      }
    >
      <div className="ao-send-confirm__body">
        <h2 className="ao-send-confirm__title">
          {holder}님에게
          <br />
          <span className="ao-num">{aoNum(amount)}</span>원을 보낼까요?
        </h2>
        <div className="ao-send-box ao-send-confirm__box">
          {rows.map(([label, value, onPress]) =>
            onPress ? (
              <button key={label} type="button" className="ao-send-box__row ao-send-box__row--link" onClick={onPress}>
                <span className="ao-send-box__label">{label}</span>
                <span className="ao-send-box__value">{value}</span>
                <AoChevronRightIcon w={6} h={10.5} stroke={1.4} className="ao-send-box__chev" />
              </button>
            ) : (
              <div key={label} className="ao-send-box__row">
                <span className="ao-send-box__label">{label}</span>
                <span className="ao-send-box__value">{value}</span>
              </div>
            ),
          )}
        </div>
        <div
          className={`ao-send-field ao-send-confirm__memo${memoFocus ? " ao-send-field--focus" : ""}`}
          data-ao-kb-field
          role="textbox"
          aria-label="메모"
          onClick={() => setMemoFocus(true)}
        >
          {memo ? (
            <span className="ao-send-confirm__memotext">
              {memo}
              {memoFocus && <AoCaret height={20} color="#0c8f2d" className="ao-send-field__caret" />}
            </span>
          ) : (
            <>
              {memoFocus && <AoCaret height={20} color="#0c8f2d" className="ao-send-confirm__caret0" />}
              <span className="ao-send-confirm__memotext ao-send-confirm__memotext--ph">메모 입력 (최대 20자)</span>
            </>
          )}
        </div>
      </div>

      <BlockedAlert open={blocked} enter="cut" onClose={() => setBlocked(false)} />

      <AoKeyboard open={memoFocus} value={memo} maxLength={MAX} onChange={setMemo} onDone={() => setMemoFocus(false)} />

      {/* 통장 표시 입력 (invented): 위 330, 칸은 키보드(위 490) 위에. ✓ · ↵ = 넣기, × · 바깥 = 그대로 */}
      <AoSheet open={edit !== null} top={330} title={edit === "me" ? "내 통장 표시" : "받는 분 통장 표시"} onClose={() => setEdit(null)} className="ao-send-namesheet">
        <div className="ao-send-field ao-send-field--focus ao-send-namesheet__field" data-ao-kb-field>
          <span className="ao-send-confirm__memotext">
            {draft}
            <AoCaret height={20} color="#0c8f2d" className="ao-send-field__caret" />
          </span>
        </div>
        <p className="ao-send-namesheet__help">
          {[...draft].length}/{MAX}자
        </p>
      </AoSheet>
      <AoKeyboard open={edit !== null} value={draft} maxLength={MAX} onChange={setDraft} onDone={applyEdit} dismissOnOutside={false} />
    </AoPage>
  );
}
