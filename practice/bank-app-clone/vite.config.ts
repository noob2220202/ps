import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중에는 화면(Vite, 5173)과 API 서버(Express, 8787)가 따로 돈다.
// 화면에서 /api 로 보낸 요청을 API 서버로 넘겨줌 → 화면 코드는 배포 때와 똑같이 "/api/..."만 쓰면 됨
// npm run dev:nh (= vite --mode nh) 는 콕뱅크: 화면 5174 + API 8788. VITE_APP=nh 는 .env.nh 에서
// npm run dev:hana (= vite --mode hana) 는 하나원큐: 화면 5175 + API 8789. VITE_APP=hana 는 .env.hana 에서
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: { '/api': mode === 'nh' ? 'http://localhost:8788' : mode === 'hana' ? 'http://localhost:8789' : 'http://localhost:8787' },
  },
}))
