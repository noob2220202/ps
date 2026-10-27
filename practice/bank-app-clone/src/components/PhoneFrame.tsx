import { useEffect, useState, type ReactNode } from "react";
import { useStatusBarStyle } from "../hooks/useStatusBar";
import "./PhoneFrame.css";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function StatusBar() {
  const { bg, fg } = useStatusBarStyle();
  const time = useClock();
  return (
    <div className={`statusbar statusbar--${fg}`} style={{ background: bg }}>
      <span>{time}</span>
      <span className="statusbar__right">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 9.5a14 14 0 0 1 18 0l-2 2.3a11 11 0 0 0-14 0Zm4 4.6a8 8 0 0 1 10 0l-2 2.3a5 5 0 0 0-6 0ZM12 20l-2.3-2.6a3.5 3.5 0 0 1 4.6 0Z" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 20h3v-4H3Zm5 0h3v-8H8Zm5 0h3V8h-3Zm5 0h3V4h-3Z" />
        </svg>
        <span>62%</span>
        <span className="statusbar__battery" />
      </span>
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      <StatusBar />
      <div className="phone__viewport">{children}</div>
      <div className="phone__home-indicator" />
    </div>
  );
}
