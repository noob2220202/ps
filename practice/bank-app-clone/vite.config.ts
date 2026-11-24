import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

// 개발 중에는 화면(Vite, 5173)과 API 서버(Express, 8787)가 따로 돈다.
// 화면에서 /api 로 보낸 요청을 API 서버로 넘겨줌 → 화면 코드는 배포 때와 똑같이 "/api/..."만 쓰면 됨
// npm run dev:nh (= vite --mode nh) 는 콕뱅크: 화면 5174 + API 8788. VITE_APP=nh 는 .env.nh 에서
// npm run dev:hana (= vite --mode hana) 는 하나원큐: 화면 5175 + API 8789. VITE_APP=hana 는 .env.hana 에서
// npm run dev:ibk (= vite --mode ibk) 는 IBK기업은행 i-ONE Bank: 화면 5176 + API 8790. VITE_APP=ibk 는 .env.ibk 에서
// npm run dev:kbank (= vite --mode kbank) 는 케이뱅크: 화면 5177 + API 8791. dev:kbank2 는 녹화 인트로를 켠 케이뱅크: 화면 5178 + API 8792
// npm run dev:kakao2 (= vite --mode kakao2) 는 카카오뱅크 새 녹화(아이폰) + 녹화 인트로: 화면 5180 + API 8794. VITE_APP=kakao · VITE_INTRO=1 은 .env.kakao2 에서
// npm run dev:toss (= vite --mode toss) 는 토스 / 토스뱅크 (갤럭시 · 다크 고정): 화면 5181 + API 8795. VITE_APP=toss 는 .env.toss 에서
// npm run dev:allone (= vite --mode allone) 는 NH올원뱅크 (아이폰 · 라이트 고정) + 녹화 인트로: 화면 5182 + API 8796. VITE_APP=allone · VITE_INTRO=1 은 .env.allone 에서
// npm run build:allone-apk (= vite build --mode allone-apk): NH올원뱅크를 서버 없이 폰 안에서 도는 APK 로 (apk-allone/, src/apk/).
// 서버 코드(server/*.mjs)를 웹뷰에서 그대로 돌리려고, 이 빌드에서만 Node 모듈 · express · 로그인 모듈을 src/apk/shim/ 의 껍데기로 바꿔 끼운다. 다른 빌드는 그대로.
const SHIM = `${ROOT}/src/apk/shim`
const apkAliases = [
  ...['sqlite', 'fs', 'path', 'url', 'crypto', 'async_hooks'].map((m) => ({ find: `node:${m}`, replacement: `${SHIM}/node-${m.replace('_', '-')}.ts` })),
  { find: /^express$/, replacement: `${SHIM}/express.js` },
  { find: /^\.\/auth\.mjs$/, replacement: `${SHIM}/auth.mjs` },
]

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  ...(mode === 'allone-apk' && {
    resolve: { alias: apkAliases },
    // 서버 코드의 process.env.X 는 빌드가 {}.X 로 바꿔 버린다 → 쓰는 값은 여기서 직접 정함. GET 지연(API_DELAY_MS)은 0: 요청 처리가 동기여야 해서 (같은 지연은 src/apk/local.ts 가 fetch 쪽에서 준다)
    define: { 'process.env.APP': '"allone"', 'process.env.API_DELAY_MS': '"0"', 'process.env.DATA_DIR': '"/allone"' },
    build: { outDir: 'apk-allone/www', emptyOutDir: true },
  }),
  server: {
    // 개발 서버가 프로젝트 폴더를 통째로 내주므로 서버 데이터(DB·세션·관리자 비밀번호 파일)·서버 코드·압축본은 막음
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', `${ROOT}/server/**`, '**/*.db', '**/*.db-*', '**/admin-password.txt', `${ROOT}/*.zip`] },
    // API_TARGET=http://localhost:포트 로 바꿀 수 있음 (여러 앱·여러 벌을 동시에 띄워 검사할 때)
    proxy: { '/api': process.env.API_TARGET ?? { nh: 'http://localhost:8788', hana: 'http://localhost:8789', ibk: 'http://localhost:8790', kbank: 'http://localhost:8791', kbank2: 'http://localhost:8792', ibk2: 'http://localhost:8793', kakao2: 'http://localhost:8794', toss: 'http://localhost:8795', allone: 'http://localhost:8796' }[mode] ?? 'http://localhost:8787' },
  },
}))
