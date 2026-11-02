import { useKbankStatusBar } from "./theme";

// (작업 중) 케이뱅크 화면 자리
export function KbankAccount() {
  useKbankStatusBar();
  return <div className="kb">Account</div>;
}
