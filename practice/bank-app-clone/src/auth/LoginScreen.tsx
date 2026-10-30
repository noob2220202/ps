import { useState } from "react";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { useStatusBar } from "../hooks/useStatusBar";
import { THEME } from "../platform/theme";
import { APP, APP_NAME } from "../profile/session";
import { AppIcon } from "../components/AppBrand";
import { login } from "./auth";
import "./auth.css";

// 로그인 (폰 화면 안). 계정은 관리자가 만들어 줌 — 은행(서버)마다 따로
export function LoginScreen({ message }: { message?: string }) {
  useStatusBar(
    APP === "nh" ? "#18171c" : APP === "hana" ? (THEME === "dark" ? "#191a1c" : "#ffffff") : APP === "ibk" ? "#fafafa" : "var(--home-bg)",
    APP === "nh" || (THEME === "dark" && APP !== "ibk") ? "light" : "dark",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message ?? null);
  const submit = async () => {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "서버에 연결하지 못했어요");
      setBusy(false);
    }
  };
  return (
    <div className={`screen login login--${APP}`}>
      <div className="login__brand"><AppIcon size={56} /></div>
      <h1 className="login__title">{APP_NAME[APP]} 클론 로그인</h1>
      <p className="login__desc">관리자에게 받은 아이디로 로그인해 주세요</p>
      <form
        className="login__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디" autoComplete="username" autoCapitalize="off" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" type="password" autoComplete="current-password" />
        {error && <p className="login__error">{error}</p>}
        <button className="login__btn" disabled={!username.trim() || !password || busy}>
          {busy ? <Spinner size={20} color="currentColor" /> : "로그인"}
        </button>
      </form>
    </div>
  );
}
