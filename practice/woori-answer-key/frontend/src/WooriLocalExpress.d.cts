// WooriLocalExpress.cjs 의 타입 (로컬 모드에서 TS 가 쓰는 dispatch 만)
interface WooriLocalDispatchResult {
  status: number
  /** JSON 문자열 (res.json) */
  body: string
  headers: Record<string, string>
}

declare function express(): unknown
declare namespace express {
  function dispatch(
    app: unknown,
    req: { method: string; url: string; headers?: Record<string, string>; body?: string },
  ): WooriLocalDispatchResult
}

export = express
