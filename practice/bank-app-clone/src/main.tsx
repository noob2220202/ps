import "./platform/platform"; // 제일 먼저: <html data-os> 를 정해야 CSS가 맞게 적용됨
import "./platform/theme";
import { prefetch } from "./api/useApi";
import { paths } from "./api/endpoints";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App.tsx";

// 스플래시가 도는 동안 홈 데이터를 미리 받아 둔다 → 홈이 로딩 없이 바로 뜸
prefetch(paths.home);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
