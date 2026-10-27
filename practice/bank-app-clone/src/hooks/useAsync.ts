import { useEffect, useState } from "react";

type State<T> = { status: "loading" } | { status: "done"; data: T };

// deps가 바뀌면 다시 요청. 응답 전에 화면을 떠나면 cancelled로 setState를 막는다
// (언마운트된 컴포넌트에 setState → 경고/레이스 컨디션 방지).
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fn().then((data) => {
      if (!cancelled) setState({ status: "done", data });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
