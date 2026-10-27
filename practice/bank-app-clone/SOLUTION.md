# 해설지

`SPEC.md`가 문제지라면 이 문서 + 실제 코드(`src/`)가 해설지입니다.
막혔던 부분이나 "내가 짠 거랑 뭐가 다르지?" 싶은 부분을 찾아보는 용도로 쓰세요.
전체 구조를 다시 설명하진 않고, **헷갈리기 쉬운 지점 / 대안이 있는 지점** 위주로 적었습니다.

## 전체 데이터 흐름

```
src/types/bank.ts      타입 정의 (Account, Transaction, TransactionDetail, ...)
src/data/mockData.ts   가짜 데이터 (실제 API라고 치고 쓰는 곳)
src/lib/format.ts      금액 포맷 공용 함수
src/components/        화면에 재사용되는 조각들
src/pages/              라우트 하나당 페이지 하나
```

페이지(`pages/`)가 `data/mockData.ts`에서 데이터를 가져와서, `components/`에 props로 내려주는
단방향 흐름입니다. 컴포넌트는 "어디서 데이터가 왔는지" 몰라도 되게 짜는 게 포인트 —
나중에 mock 대신 실제 API(`fetch`)로 바꿀 때 `pages/`만 고치면 되게 하기 위함입니다.

## 화면별 해설

### 1. Home (`pages/HomePage.tsx`)

- **배너 문구 자동 전환**: `useState`로 현재 인덱스를 들고, `useEffect` 안에서
  `setInterval`로 3초마다 인덱스를 돌립니다. **흔한 실수**: `useEffect`의 cleanup
  함수(`return () => clearInterval(id)`)를 빼먹으면, 페이지를 벗어났다가 다시 들어올 때마다
  interval이 하나씩 더 쌓여서 결국 문구가 미친 듯이 빠르게 바뀝니다. 꼭 정리해주세요.
- **계좌 카드 전체가 클릭 영역**: `AccountCard`에 `onClick`을 카드 전체 `div`에 걸었습니다.
  그 안에 있는 "이체" 버튼까지 같이 눌려서 상세 페이지로 이동해버리는 게 실제로는 버그입니다.
  제대로 하려면 버튼 클릭 핸들러에서 `e.stopPropagation()`을 호출해 이벤트 버블링을
  막아야 합니다 (연습 범위라 일부러 생략, 주석으로 남겨둠).
- **리스트 렌더링**: `mockAccounts.map(...)` 할 때 `key`를 꼭 고유한 값(`account.id`)으로
  줘야 합니다. `index`를 key로 쓰면 리스트 순서가 바뀔 때 React가 엉뚱한 DOM을 재사용해서
  애니메이션이 깨지거나 state가 섞이는 버그가 생길 수 있어요.

### 2. 계좌 상세 (`pages/AccountDetailPage.tsx`)

- **URL 파라미터로 데이터 찾기**: `useParams()`로 `:accountId`를 꺼내서
  `mockAccounts.find(a => a.id === accountId)`로 찾습니다. **이 find가 실패할 수 있다는 것**
  (오타 URL, 존재하지 않는 계좌 등)을 꼭 처리해야 합니다 — `account`가 `undefined`인 채로
  `account.balanceWon`을 읽으면 바로 런타임 에러가 납니다. 그래서 `if (!account) return ...`을
  제일 먼저 둡니다.
- **거래내역 필터링**: 전체 `mockTransactions`에서 `tx.accountId === accountId`인 것만
  걸러서 `TransactionList`에 넘깁니다. 이 필터링을 컴포넌트가 아니라 **페이지에서** 하는 이유는,
  `TransactionList`를 "주어진 배열을 그릴 뿐"인 순수한 컴포넌트로 유지하기 위해서입니다 —
  나중에 다른 화면에서도 재사용하기 쉬워집니다.

### 3. 거래내역 그룹핑 (`components/TransactionList.tsx`)

가장 "로직"이 들어간 부분입니다.

```ts
function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    (acc[tx.date] ??= []).push(tx);
    return acc;
  }, {});
  return Object.entries(grouped);
}
```

- `acc[tx.date] ??= []`는 `acc[tx.date] = acc[tx.date] ?? []`의 축약형입니다
  ("해당 키가 없으면 빈 배열로 초기화"). 처음 보면 낯설 수 있는데, "그룹핑" 패턴에서
  정말 자주 나오는 관용구라 익혀두면 좋습니다.
- **날짜 재정렬이 필요 없는 이유**: mock 데이터가 이미 최신순으로 정렬돼서 들어오기 때문에,
  `reduce`로 순서대로 쌓으면 그룹의 등장 순서도 자연히 최신순이 됩니다. 만약 데이터가
  정렬 안 된 채로 온다면, `Object.entries(grouped)`를 날짜 기준으로 `.sort()`까지
  해줘야 맞습니다.
- **더 짧은 대안**: ES2024+ 환경이면 `Object.groupBy(transactions, tx => tx.date)`
  한 줄로 끝낼 수 있습니다. 이 프로젝트의 TypeScript 타입 설정이 아직 그 API 타입을
  완전히 지원하지 않을 수 있어서 호환성 걱정 없는 `reduce` 버전을 썼습니다. 타입스크립트
  lib을 `ES2024`로 올리고 직접 바꿔보는 것도 좋은 연습이 됩니다.

### 4. 거래 상세 (`pages/TransactionDetailPage.tsx`)

- **key-value 리스트를 배열로 뽑아서 map 돌리기**: "카드정보", "주소", "전화번호"처럼
  **있을 때만 보여줘야 하는 항목**이 섞여 있어서, JSX에 `{detail.cardInfo && <div>...}`를
  4번 반복해서 쓰는 대신 `buildRows()` 함수에서 조건부로 배열에 `push`하고
  한 번에 `.map()`으로 렌더링했습니다. **왜 이게 더 나은가**: 항목이 하나 더 늘어나도
  JSX를 안 건드리고 배열에 한 줄만 추가하면 되고, "레이아웃(map)"과 "어떤 데이터를
  보여줄지(배열 구성)"가 분리돼서 나중에 디자인만 바꾸기도 쉽습니다.
- **입력창 글자수 제한**: `onChange`에서 `e.target.value.slice(0, 20)`으로 20자를
  넘으면 잘라버립니다. `maxLength={20}` 속성만으로도 브라우저가 입력을 막아주긴 하지만,
  붙여넣기(paste)로 20자를 초과해서 넣는 경우까지 막으려면 JS 쪽에서도 자르는 게 안전합니다.

## 공통 패턴

- **`lib/format.ts`**: `formatWon`/`signedFormatWon`처럼 "숫자 → 화면에 보여줄 문자열"
  변환을 컴포넌트 밖으로 빼뒀습니다. 컴포넌트 3곳(`AccountCard`, `TransactionItem`,
  `TransactionDetailPage`)에서 똑같은 포맷팅 로직을 복붙하지 않게 하기 위함 — "같은 로직이
  3번 이상 반복되면 함수로 뽑는다"는 기준을 하나의 예시로 보여주는 겁니다.
- **`components/Icon.tsx`**: 아이콘 라이브러리를 설치하는 대신 `name` prop으로 SVG
  path를 스위치하는 패턴을 썼습니다. 아이콘이 10개 안팎일 땐 이 방식이 번들 크기도 작고
  의존성도 안 늘어서 괜찮지만, 아이콘이 많아지거나 디자이너가 주기적으로 아이콘을
  추가한다면 `lucide-react` 같은 라이브러리로 바꾸는 게 유지보수에 낫습니다.

## 자주 하는 실수 체크리스트

- [ ] `useParams()`로 받은 값이 `undefined`일 수 있다는 걸 타입/런타임 양쪽에서 처리했는가
- [ ] 리스트 렌더링 시 `key`를 `index`가 아니라 고유 id로 줬는가
- [ ] `useEffect` 안에서 `setInterval`/`setTimeout`/이벤트 리스너를 등록했으면 cleanup을 했는가
- [ ] 음수/양수 금액 색상 분기를 금액 부호로 했는가 (하드코딩한 거래 타입 문자열로 분기하면
      데이터가 바뀔 때 깨지기 쉬움)
- [ ] 클릭 가능한 영역 안에 또 다른 클릭 가능한 버튼이 있으면 이벤트 버블링을 고려했는가
