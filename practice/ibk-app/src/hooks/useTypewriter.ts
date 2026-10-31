import { useEffect, useState } from "react";
import { TIMING } from "../config/timing";

// text를 한 글자씩 늘려가며 반환. start=false면 빈 문자열 유지.
// Array.from으로 쪼개야 이모지/서로게이트 문자도 반 토막 안 남.
export function useTypewriter(text: string, start = true, speed = TIMING.typeSpeed) {
  const [count, setCount] = useState(0);
  const chars = Array.from(text);

  useEffect(() => {
    setCount(0);
    if (!start) return;
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= chars.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, start, speed]);

  return { typed: chars.slice(0, count).join(""), done: count >= chars.length };
}
