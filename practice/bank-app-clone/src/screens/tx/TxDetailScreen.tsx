import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { paths } from "../../api/endpoints";
import { ErrorState } from "../../components/ErrorState";
import type { Transaction, TransactionDetail } from "../../api/types";
import { useStatusBar } from "../../hooks/useStatusBar";
import { signedWon, won } from "../../lib/format";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/icons/Icon";
import "./TxDetail.css";

// 메모는 화면을 나갔다 와도 남아있게 모듈 변수에 보관 (실서비스라면 서버 저장)
const memos = new Map<string, string>();

type Row = { label: string; value?: string; strong?: boolean };

function groups(d: TransactionDetail): Row[][] {
  return [
    [
      { label: "거래시각", value: d.transactedAt },
      { label: "거래구분", value: d.kind },
    ],
    [
      { label: "거래금액", value: signedWon(d.amount), strong: true },
      { label: "거래 후 잔액", value: won(d.balanceAfter) },
      { label: "카드정보", value: d.cardInfo },
    ],
    [
      { label: "사용처", value: d.merchant },
      { label: "주소", value: d.address },
      { label: "전화번호", value: d.phone },
    ],
  ].map((g) => g.filter((row) => row.value));
}

function Memo({ txId }: { txId: string }) {
  const [value, setValue] = useState(memos.get(txId) ?? "");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        className="tx__memo-input"
        autoFocus
        value={value}
        maxLength={20}
        placeholder="메모할 수 있어요. (최대 20자)"
        onChange={(e) => setValue(e.target.value.slice(0, 20))}
        onBlur={() => {
          memos.set(txId, value);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button className="tx__memo" onClick={() => setEditing(true)}>
      {value || "메모할 수 있어요. (최대 20자)"}
      <Icon name="pencil" size={15} />
    </button>
  );
}

export function TxDetailScreen() {
  const { txId = "" } = useParams();
  const navigate = useNavigate();
  // 목록에서 넘겨준 거래 요약(state)이 있으면 제목부터 바로 그림 → 상세만 로딩
  const preview = (useLocation().state as { tx?: Transaction } | null)?.tx;
  const detail = useApi<TransactionDetail>(paths.transaction(txId));
  useStatusBar("#fff", "dark");

  const head = detail.status === "done" ? detail.data : preview;

  return (
    <div className="screen tx">
      {head && (
        <div className="tx__head">
          <span className="tx__tag">{head.tag}</span>
          <h1 className="tx__title">{head.merchant}</h1>
          <Memo txId={txId} />
        </div>
      )}

      {detail.status === "loading" ? (
        <div className="tx__loading">
          <Spinner size={24} color="#b8b8b8" />
        </div>
      ) : detail.status === "error" ? (
        detail.error.status === 404 ? (
          <p className="tx__empty">거래 정보를 찾을 수 없습니다.</p>
        ) : (
          <ErrorState error={detail.error} onRetry={detail.retry} />
        )
      ) : (
        <div className="tx__body fade-in">
          {groups(detail.data).map((rows, i) => (
            <dl key={i} className="tx__group">
              {rows.map((r) => (
                <div key={r.label} className="tx__row">
                  <dt>{r.label}</dt>
                  <dd className={r.strong ? "tx__strong" : ""}>{r.value}</dd>
                </div>
              ))}
            </dl>
          ))}
          <button className="tx__search row-press">
            '{detail.data.merchant}' 검색하기
            <Icon name="chevron-right" size={15} stroke={1.6} />
          </button>
          <button className="tx__split pressable">1/N 빵나누기</button>
        </div>
      )}

      <div className="tx__footer">
        <button className="tx__share pressable" aria-label="공유">
          <Icon name="upload" size={21} stroke={2} />
        </button>
        <button className="tx__confirm" onClick={() => navigate(-1)}>
          확인
        </button>
      </div>
    </div>
  );
}
