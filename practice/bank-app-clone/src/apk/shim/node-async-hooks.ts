// node:async_hooks AsyncLocalStorage — 서버가 요청마다 runWithDb(그 프로필 DB, next) 로 감싸 두고 안에서 db() 로 꺼내 쓴다.
// 이 앱의 요청 처리는 전부 동기(express 껍데기 · 동기 sqlite)라 전역 변수 하나를 쓰고 끝나면 되돌리면 같은 효과.
export class AsyncLocalStorage<T> {
  private cur: T | undefined;
  run<R>(store: T, fn: () => R): R {
    const prev = this.cur;
    this.cur = store;
    try {
      return fn();
    } finally {
      this.cur = prev;
    }
  }
  getStore(): T | undefined {
    return this.cur;
  }
}
