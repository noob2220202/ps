import "./platform/platform"; // 제일 먼저: <html data-os> 를 정해야 CSS가 맞게 적용됨
import "./platform/theme";
import "./platform/capture";
import { prefetch } from "./api/useApi";
import { api, paths } from "./api/endpoints";
import { ApiError } from "./api/client";
import { currentProfileId, setCurrentProfile } from "./profile/session";
import { OS } from "./platform/platform";
import { THEME_CHOICE } from "./platform/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App.tsx";

const profile = currentProfileId();
if (profile) {
  // 스플래시가 도는 동안 홈 데이터를 미리 받아 둔다 → 홈이 로딩 없이 바로 뜸
  prefetch(paths.home);
  // 지금 기기/테마를 이 프로필 설정으로 저장 (스위치나 🔔에서 바꾼 뒤 다시 불러온 경우 포함)
  // 그 사이 프로필이 지워졌으면 프로필 고르기로
  api.updateProfileCard(profile, { os: OS, theme: THEME_CHOICE }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) {
      setCurrentProfile(null);
      location.assign("/");
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
