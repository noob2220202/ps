import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// 포트는 환경 변수로 바꾼다 (에이전트·도구마다 따로 띄울 수 있게, tools/README.md '포트 · DB'):
//   WOORI_WEB_PORT  이 Vite 서버 (기본 5273, 사용 중이면 실패: strictPort)
//   WOORI_API_PORT  백엔드 Express (기본 4100) — /api 아래만 그쪽으로 프록시
const webPort = Number(process.env.WOORI_WEB_PORT ?? 5273)
const apiPort = Number(process.env.WOORI_API_PORT ?? 4100)

const apiProxy = {
  '/api': {
    target: `http://localhost:${apiPort}`,
    changeOrigin: true,
  },
}

// src/WooriTheme.ts 가 ../spec/tokens.json 을 (있으면) import.meta.glob 으로 읽는다 → dev 서버가 frontend/ 밖의 spec/ 을 내줄 수 있게 연다
const SPEC_DIR = fileURLToPath(new URL('../spec', import.meta.url))

// 로컬 빌드 (VITE_WOORI_LOCAL=1 — 서버 없는 APK, tools/build-apk.sh · src/WooriLocal.ts):
//   'woori-backend/…' = ../backend 의 순수 로직 모듈 (CommonJS 그대로 번들), 그 안의 require('express'|'cors') 는 브라우저용 작은 껍데기로.
//   index.html 의 viewport-fit=cover 를 뺀다 → Capacitor SystemBars(insetsHandling 'native')가 웹뷰를 진짜 상태바·내비 바 사이에 둔다.
//   웹 빌드(플래그 없음)는 별칭 'woori-backend' 하나만 (src/WooriLocal.ts 를 타입·의존성 검사기가 따라가도 풀리게) — 실제 번들은 그대로.
const LOCAL = process.env.VITE_WOORI_LOCAL === '1'
const BACKEND_DIR = fileURLToPath(new URL('../backend', import.meta.url))
const localAliases = LOCAL
  ? [
      { find: /^express$/, replacement: fileURLToPath(new URL('./src/WooriLocalExpress.cjs', import.meta.url)) },
      { find: /^cors$/, replacement: fileURLToPath(new URL('./src/WooriLocalCors.cjs', import.meta.url)) },
    ]
  : []

export default defineConfig({
  plugins: [
    react(),
    LOCAL && {
      name: 'woori-local',
      enforce: 'pre' as const,
      transformIndexHtml: (html: string) => html.replace(/,\s*viewport-fit=cover/, ''),
      // backend/seed.js 끝의 CLI(`node seed.js …`, require.main 일 때만)가 부르는 ./db(node:sqlite)는 브라우저에서 돌지 않는다 → 빈 자리
      resolveId: (source: string, importer?: string) =>
        source === './db' && importer?.startsWith(BACKEND_DIR) ? '\0woori-local-no-db' : null,
      load: (id: string) =>
        id === '\0woori-local-no-db' ? "export function openDb() { throw new Error('로컬 모드에는 node:sqlite 가 없다') }" : null,
    },
  ],
  resolve: {
    alias: [{ find: /^woori-backend\//, replacement: `${BACKEND_DIR}/` }, ...localAliases],
  },
  build: LOCAL ? { outDir: 'dist-apk', emptyOutDir: true } : undefined,
  server: {
    port: webPort,
    strictPort: true,
    host: true,
    proxy: apiProxy,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), SPEC_DIR] },
  },
  preview: {
    port: 4273,
    strictPort: true,
    host: true,
    proxy: apiProxy,
  },
})
