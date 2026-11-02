import { useKbankStatusBar } from "./theme";

// (작업 중) 케이뱅크 화면 자리
export function KbankHome() {
  useKbankStatusBar();
  return <div className="kb">Home</div>;
}
