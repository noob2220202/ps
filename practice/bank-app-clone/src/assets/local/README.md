# 실제 에셋 넣는 곳 (커밋되지 않음)

여기 넣은 이미지가 있으면 기본 에셋(Fluent 3D 이모지) 대신 쓰입니다. 파일 이름 = 슬롯 이름.

- `<slot>.light.png` / `<slot>.dark.png` — 테마별 (홈 화면 아이콘처럼 배경색이 테마마다 다른 것)
- `<slot>.png` (또는 .jpg/.webp) — 테마 공통

슬롯 목록은 `src/assets/Asset.tsx`의 `Slot` 타입 참고.
화면 녹화/스크린샷에서 자동으로 잘라 만들려면:

```bash
./scripts/extract-assets.sh 화면녹화.mp4 [라이트모드_홈_스크린샷.jpg]
```

파일을 추가/삭제한 뒤에는 `npm run build`를 다시 해야 반영됩니다 (개발 서버는 자동 반영).
