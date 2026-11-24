// node:crypto — randomUUID 만 (프로필 · 계좌 id). 로그인용 scrypt 는 auth 대체 모듈이 안 쓴다
export const randomUUID = () => crypto.randomUUID();
