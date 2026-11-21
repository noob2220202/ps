// ESLint 9 flat config — TypeScript + React Hooks(React Compiler 규칙 포함) + Vite Fast Refresh (하나 답지와 같은 구성)
//   npm run lint       검사
//   npm run lint:fix   자동 수정 가능한 것 고치기
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // dist-apk · android = APK(로컬 모드) 빌드 산출물·Capacitor 네이티브 프로젝트 (tools/build-apk.sh)
  globalIgnores(['dist', 'dist-apk', 'android']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // 사용하지 않는 인자는 _ 로 시작하면 허용 (콜백 시그니처를 맞출 때)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // 공용 부품 모듈: 컴포넌트와 도우미 함수/훅·상수를 한 파일에서 함께 내보낸다 (평평한 구조, 하위 폴더·파일 쪼개기 없음).
    // 이 파일들을 고치면 Fast Refresh 대신 전체 새로고침이 될 뿐이라 규칙을 끈다.
    files: ['src/WooriSpinner.tsx', 'src/WooriLoadingPage.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
])
