import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { TransactionDetailPage } from "./pages/TransactionDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/account/:accountId" element={<AccountDetailPage />} />
      <Route path="/account/:accountId/transaction/:txId" element={<TransactionDetailPage />} />
    </Routes>
  );
}
