# 은행 앱 클론코딩 (학습용)

화면 녹화 영상을 프레임 단위로 분석해서 화면 구성, 색상, 애니메이션, 광고, 로딩 순서까지
그대로 재현한 React 클론입니다. 비상업적 학습 목적이며 상표권은 각 소유자에게 있습니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173  (주소 뒤에 ?skip 붙이면 스플래시 생략)
```

PC 브라우저에서는 폰 프레임 안에, 폰(폭 500px 이하)으로 열면 전체 화면으로 보입니다.

**갤럭시 / 아이폰 전환**: 프레임 아래 스위치를 누르거나 주소에 `?os=ios` / `?os=android`.
**라이트 / 다크**: 기본은 폰(시스템) 설정을 따름. 스위치나 `?theme=light` / `?theme=dark`로 고정.
아이폰으로 접속하면 자동으로 아이폰 버전. 아이폰 버전은 iOS 27 Liquid Glass 탭바, 다이내믹 아일랜드,
push 화면 전환, 왼쪽 가장자리 스와이프 뒤로가기가 들어가 있습니다.

## 데이터

이름(`홍길동`), 계좌번호, 잔액, 거래내역, 가게 주소, 카드 정보는 **전부 가상의 예시값**입니다
(`src/config/profile.ts`, `src/api/db.ts`). 실제 개인정보는 넣지 마세요 — 공개 저장소입니다.

### 이미지 에셋

저장소에는 무료 에셋(Microsoft Fluent 3D 이모지, MIT)만 들어 있습니다.
농협 로고, 카드 이미지, 티머니 로고, 캐릭터, 광고 사진 같은 **실제 이미지는 `src/assets/local/`에 넣으면**
자동으로 대신 쓰입니다 (`.gitignore` 처리돼 커밋되지 않음).

```bash
# 화면 녹화 + 라이트모드 홈 스크린샷에서 자동으로 잘라내기 (ffmpeg 필요)
./scripts/extract-assets.sh 화면녹화.mp4 홈스크린샷.jpg
npm run build
```

이미 만들어 둔 에셋 묶음(zip)이 있으면 `src/assets/local/`에 풀고 `npm run build` 하면 됩니다.

## 문서

- `SPEC.md` — 문제지: 영상 타임스탬프별 화면/애니메이션 분석
- `SOLUTION.md` — 해설지: 구현 방법, 실제로 났던 버그와 해결, 체크리스트

## 스택

Vite, React 19, TypeScript, react-router-dom, Pretendard 폰트. 애니메이션은 라이브러리 없이 CSS + 훅으로 구현.
