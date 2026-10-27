import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockTransactionDetails } from "../data/mockData";
import { Icon } from "../components/Icon";
import { formatWon, signedFormatWon } from "../lib/format";
import "./TransactionDetailPage.css";

// key-value 목록이 항목마다 조금씩 다른 포맷(금액은 굵게, 선택 항목은 있을 때만)이라
// 그냥 JSX를 쭉 나열하는 대신 데이터 배열을 만들고 .map으로 돌리는 게 더 짧고,
// 나중에 항목이 늘어나도 배열에 한 줄만 추가하면 됨.
function buildRows(
  detail: NonNullable<ReturnType<typeof useDetail>>
): { label: string; value: string; emphasize?: boolean }[] {
  const rows = [
    { label: "거래시각", value: detail.transactedAt },
    { label: "거래구분", value: detail.transactionType },
    { label: "거래금액", value: signedFormatWon(detail.amountWon), emphasize: true },
    { label: "거래 후 잔액", value: formatWon(detail.balanceAfterWon) },
  ];
  if (detail.cardInfo) rows.push({ label: "카드정보", value: detail.cardInfo });
  rows.push({ label: "사용처", value: detail.merchant });
  if (detail.merchantAddress) rows.push({ label: "주소", value: detail.merchantAddress });
  if (detail.merchantPhone) rows.push({ label: "전화번호", value: detail.merchantPhone });
  return rows;
}

function useDetail() {
  const { txId } = useParams();
  return txId ? mockTransactionDetails[txId] : undefined;
}

export function TransactionDetailPage() {
  const navigate = useNavigate();
  const detail = useDetail();
  const [memo, setMemo] = useState("");

  if (!detail) {
    return (
      <div className="screen">
        <p>거래 상세 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)}>뒤로</button>
      </div>
    );
  }

  const rows = buildRows(detail);

  return (
    <div className="screen tx-detail">
      <button className="tx-detail__back" onClick={() => navigate(-1)} aria-label="뒤로가기" type="button">
        <Icon name="back" />
      </button>

      <div className="tx-detail__tag">{detail.tag}</div>
      <h1 className="tx-detail__title">{detail.merchant}</h1>

      <label className="tx-detail__memo">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 20))}
          placeholder="메모할 수 있어요. (최대 20자)"
          maxLength={20}
        />
        <Icon name="edit" size={16} />
      </label>

      <dl className="tx-detail__rows">
        {rows.map((row) => (
          <div className="tx-detail__row" key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.emphasize ? "tx-detail__row-value--strong" : ""}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <a className="tx-detail__search-link" href="#">
        '{detail.merchant}' 검색하기
        <Icon name="chevron-right" size={16} />
      </a>

      <div className="tx-detail__footer">
        <button className="tx-detail__share-btn" aria-label="공유" type="button">
          <Icon name="share" />
        </button>
        <button className="tx-detail__confirm-btn" type="button">
          확인
        </button>
      </div>
    </div>
  );
}
