import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중에는 화면(Vite, 5173)과 API 서버(Express, 8787)가 따로 돈다.
// 화면에서 /api 로 보낸 요청을 API 서버로 넘겨줌 → 화면 코드는 배포 때와 똑같이 "/api/..."만 쓰면 됨
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
