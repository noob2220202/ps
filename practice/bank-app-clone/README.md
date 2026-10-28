# 은행 앱 클론코딩 (학습용)

화면 녹화 영상을 프레임 단위로 분석해서 화면 구성, 색상, 애니메이션, 광고, 로딩 순서까지
그대로 재현한 React 클론입니다. 비상업적 학습 목적이며 상표권은 각 소유자에게 있습니다.

## 실행

Node **22.13 이상** 필요 (내장 SQLite 사용).

```bash
npm install
npm run dev        # API 서버 + 화면 동시 실행 → http://localhost:5173  (?skip 붙이면 스플래시 생략)
```

### VPS에 띄우기 (포트 9101)

```bash
npm ci
npm run build
npm start                              # http://서버IP:9101
# 꺼지지 않게: pm2 start "npm start" --name bank   (pm2 save 로 재부팅 후에도)
```

서버 하나가 화면과 API를 같이 줍니다. 포트 변경은 `PORT=8080 npm start`.
데이터는 `server/data/bank.db`(SQLite)에 저장되고 커밋되지 않습니다. 지우면 예시 데이터로 다시 시작.

PC 브라우저에서는 폰 프레임 안에, 폰(폭 500px 이하)으로 열면 전체 화면으로 보입니다.

**갤럭시 / 아이폰 전환**: 프레임 아래 스위치를 누르거나 주소에 `?os=ios` / `?os=android`.
**라이트 / 다크**: 기본은 폰(시스템) 설정을 따름. 스위치나 `?theme=light` / `?theme=dark`로 고정.
아이폰으로 접속하면 자동으로 아이폰 버전. 아이폰 버전은 iOS 27 Liquid Glass 탭바, 다이내믹 아일랜드,
push 화면 전환, 왼쪽 가장자리 스와이프 뒤로가기가 들어가 있습니다.

## 🔔 관리 패널 (홈 오른쪽 위 종 버튼)

화면은 보기 전용이고 **바꾸는 건 전부 여기서** 버튼과 숫자 입력으로 합니다.

- **기본**: Galaxy ↔ iPhone, 시스템/라이트/다크, 이름·mini 계좌번호·카드 끝 4자리, 처음 상태로 되돌리기
- **계좌**: 잔액 수정 / 다른 은행 계좌(국민·신한·우리·하나·농협·기업·토스·케이뱅크·우체국·새마을금고·SC·수협)
  추가·계좌번호 수정·삭제. 추가한 계좌는 홈에 바로 생기고 눌러서 들어갈 수 있음
- **거래**: 계좌 고르고 금액·거래처·종류 고른 뒤 입금하기/출금하기. 최근 거래 삭제

데이터는 `server/`의 Express + SQLite 백엔드가 처리합니다. API 목록과 구조는 `SOLUTION.md` 12번.

## 데이터

이름(`홍길동`), 계좌번호, 잔액, 거래내역, 가게 주소, 카드 정보는 **전부 가상의 예시값**입니다
(초기값: `server/db.mjs`의 `seed()`, 🔔 패널에서 수정 가능). 실제 개인정보는 넣지 마세요 — 공개 저장소입니다.

### 이미지 에셋

저장소에는 무료 에셋(Microsoft Fluent 3D 이모지, MIT)만 들어 있습니다.
농협 로고, 카드 이미지, 티머니 로고, 캐릭터, 광고 사진 같은 **실제 이미지는 `src/assets/local/`에 넣으면**
자동으로 대신 쓰입니다 (`.gitignore` 처리돼 커밋되지 않음).
은행 로고는 `bank-<코드>.png`(예: `bank-shinhan.png`, 코드는 `server/banks.mjs`)로 넣으면 색 동그라미 대신 쓰입니다.

```bash
# 화면 녹화 + 라이트모드 홈 스크린샷에서 자동으로 잘라내기 (ffmpeg 필요)
./scripts/extract-assets.sh 화면녹화.mp4 홈스크린샷.jpg [라이트모드녹화2.mp4] [배너스크린샷2.jpg]
npm run build
```

이미 만들어 둔 에셋 묶음(zip)이 있으면 `src/assets/local/`에 풀고 `npm run build` 하면 됩니다.

## 문서

- `SPEC.md` — 문제지: 영상 타임스탬프별 화면/애니메이션 분석
- `SOLUTION.md` — 해설지: 구현 방법, 실제로 났던 버그와 해결, 체크리스트

## 스택

Vite, React 19, TypeScript, react-router-dom, Pretendard 폰트 / 백엔드 Express 5 + `node:sqlite`. 애니메이션은 라이브러리 없이 CSS + 훅으로 구현.
