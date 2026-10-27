import type { MonthlyCardSpend as MonthlyCardSpendType } from "../types/bank";
import { formatWon } from "../lib/format";
import "./MonthlyCardSpend.css";

interface MonthlyCardSpendProps {
  spend: MonthlyCardSpendType;
}

export function MonthlyCardSpend({ spend }: MonthlyCardSpendProps) {
  return (
    <div className="card-spend">
      <div className="card-spend__info">
        <span className="card-spend__label">{spend.label}</span>
        <span className="card-spend__amount">{formatWon(spend.totalWon)}</span>
      </div>
      <button className="card-spend__btn" type="button">
        내역 보기
      </button>
    </div>
  );
}
