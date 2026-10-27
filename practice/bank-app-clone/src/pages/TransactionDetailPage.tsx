import { useNavigate, useParams } from "react-router-dom";
import { mockTransactionDetails } from "../data/mockData";

// SPEC.md의 "3. 거래 상세 화면" 참고
// 이미 연결된 것: URL의 :txId로 상세 데이터 찾기
// 직접 채울 것: 거래처명, 메모 입력란, key-value 형태의 상세 정보 목록, 하단 버튼 2개

export function TransactionDetailPage() {
  const { txId } = useParams();
  const navigate = useNavigate();

  const detail = txId ? mockTransactionDetails[txId] : undefined;

  if (!detail) return <div>거래 상세 데이터가 mockData에 없습니다 (tx-1만 있음)</div>;

  return (
    <div className="screen">
      <button onClick={() => navigate(-1)}>뒤로</button>
      TODO: {detail.merchant} 상세 정보 레이아웃 구현
    </div>
  );
}
