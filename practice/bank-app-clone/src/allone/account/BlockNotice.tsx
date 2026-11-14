// /account/:accountId/notice — 지급정지 안내 + 이의제기 (invented, 녹화에 없음. 사용자 요청으로 공부하려고 추가한 화면).
// 다른 앱의 카카오뱅크 '계좌 지급정지'(🔔 패널 profile.suspended, SuspendedDialog) 와 같은 개념을 계좌 단위로: 이 계좌에서는
// 보낼 수 없고(서버도 403 ACCOUNT_BLOCKED 로 막음), 받는 건 그대로 됨. 안내 → 동의 체크 → 제출 하나뿐 (서류 · 개인정보 입력 없음).
// 제출해도 바로 풀리지 않음 — 🔔 패널에서 관리자가 직접 풀어야 다시 보낼 수 있음 (신청과 처리가 다른 사람 몫이라는 걸 보여주려고).
// 진입: 홈 카드 · T2 출금계좌 줄 · 잔액채우기 출금계좌 줄의 "지급정지" 글자를 누르면 (flow.goBlockNotice)
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoApi, aoPaths, type AoAccount } from "../api";
import { useAoBack } from "../nav";
import { AoButton, AoHeader, AoPage, AoSwitch, aoToast } from "../ui";
import "./account.css";

// 느낌표 원 (생각나는 실제 은행 아이콘을 베끼지 않은 자리표시용 도형)
function NoticeIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="ao-block__icon">
      <circle cx="32" cy="32" r="30" fill="none" stroke="#d93025" strokeWidth="3" />
      <rect x="29.3" y="16" width="5.3" height="26" rx="2.6" fill="#d93025" />
      <circle cx="32" cy="48" r="3.2" fill="#d93025" />
    </svg>
  );
}

export function BlockNotice() {
  const { accountId = "main" } = useParams();
  const back = useAoBack();
  const account = useApi<AoAccount>(aoPaths.account(accountId));
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const a = account.data;
  const submit = () => {
    if (!agree || busy || !a) return;
    setBusy(true);
    void aoApi
      .dispute(a.id)
      .catch(() => aoToast("잠시 후 다시 시도해 주세요"))
      .finally(() => setBusy(false));
  };

  return (
    <AoPage className="ao-block" header={<AoHeader variant="modal" title="지급정지 안내" onClose={() => back()} />}>
      {a && (
        <div className="ao-block__body">
          <NoticeIcon />
          {!a.blocked ? (
            <>
              <h2 className="ao-block__title">지금은 제한이 없어요</h2>
              <p className="ao-block__desc">이 계좌는 자유롭게 보내고 받을 수 있어요.</p>
            </>
          ) : (
            <>
              <h2 className="ao-block__title">입출금이 제한된 계좌예요</h2>
              <ul className="ao-block__list">
                <li>보이스피싱 등 금융사고를 막으려고, 이상 거래가 확인되면 계좌 이용이 제한될 수 있어요.</li>
                <li>제한된 계좌에서는 돈을 보낼 수 없어요. 돈을 받는 건 그대로 돼요.</li>
                <li>본인이 신청한 제한이 아니라면 아래에서 이의제기를 넣어 주세요.</li>
              </ul>
              {a.disputed ? (
                <p className="ao-block__status">이의제기가 접수됐어요. 확인하는 대로 제한을 풀어드릴게요.</p>
              ) : (
                <>
                  <label className="ao-block__agree">
                    <AoSwitch checked={agree} onChange={setAgree} aria-label="이의제기 동의" />
                    <span>위 안내를 확인했고 이의제기에 동의해요</span>
                  </label>
                  <p className="ao-block__hint">신청만으로 제한이 바로 풀리지는 않아요. 접수 뒤 확인해서 처리해요.</p>
                  <AoButton disabled={!agree || busy} disabledColor="#e0e0e0" radius={15} height={56} size={17} onPress={submit}>
                    이의제기 신청
                  </AoButton>
                </>
              )}
            </>
          )}
        </div>
      )}
    </AoPage>
  );
}
