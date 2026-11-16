import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Route, Routes, useNavigate, type Location } from "react-router-dom";
import { OsSwitch, PhoneFrame } from "./components/PhoneFrame";
import { FakeCursor, RecordingBar } from "./components/RecordingBar";
import { ScreenStack } from "./components/ScreenStack";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { Splash } from "./screens/boot/Splash";
import { BootLoading } from "./screens/boot/BootLoading";
import { HomeScreen } from "./screens/home/HomeScreen";
import { AccountDetailScreen } from "./screens/account/AccountDetailScreen";
import { HistoryScreen } from "./screens/history/HistoryScreen";
import { TxDetailScreen } from "./screens/tx/TxDetailScreen";
import { BankAccountScreen } from "./screens/bank/BankAccountScreen";
import { TransferScreen } from "./screens/transfer/TransferScreen";
import { AmountScreen } from "./screens/transfer/AmountScreen";
import { TransferDoneScreen } from "./screens/transfer/TransferDoneScreen";
import { ProfilePicker } from "./profile/ProfilePicker";
import { ALLONE, APP, KAKAO2, TOSS, currentProfileId } from "./profile/session";
import { NhSplash } from "./nh/NhSplash";
import { NhLoadingLayer } from "./nh/common";
import { HanaLoadingLayer } from "./hana/common";
import { NhHome } from "./nh/NhHome";
import { NhSend } from "./nh/NhSend";
import { NhConfirm } from "./nh/NhConfirm";
import { NhDone } from "./nh/NhDone";
import { NhAccounts, NhRegister } from "./nh/NhAccounts";
import { NhHistory } from "./nh/NhHistory";
import { NhTxDetail } from "./nh/NhTxDetail";
import "./nh/nh-light.css"; // 콕뱅크 라이트모드 (화면 CSS 뒤에)
import { HanaSplash } from "./hana/HanaSplash";
import { HanaHome } from "./hana/HanaHome";
import { HanaSend } from "./hana/HanaSend";
import { HanaDone } from "./hana/HanaDone";
import { HanaHistory } from "./hana/HanaHistory";
import { HanaTxDetail } from "./hana/HanaTxDetail";
import { IbkLoadingLayer } from "./ibk/common";
import { IbkSplash } from "./ibk/IbkSplash";
import { IbkHome } from "./ibk/IbkHome";
import { IbkSend } from "./ibk/IbkSend";
import { IbkDone } from "./ibk/IbkDone";
import { IbkHistory } from "./ibk/IbkHistory";
import { IbkMenu } from "./ibk/IbkMenu";
import { IbkResults } from "./ibk/IbkResults";
import { IbkCertificate } from "./ibk/IbkCertificate";
import "./kbank/kbank.css";
import { KbankSplash } from "./kbank/KbankSplash";
import { KbankHome } from "./kbank/KbankHome";
import { KbankAccount } from "./kbank/KbankAccount";
import { KbankTxDetail } from "./kbank/KbankTxDetail";
import { KbankSend } from "./kbank/KbankSend";
import { KbankDone } from "./kbank/KbankDone";
import { KbankReceipt } from "./kbank/KbankReceipt";
import { renderKakao2Route } from "./kakao2/routes";
import { K2Inset } from "./kakao2/K2Inset";
import { launchReady } from "./kakao2/launch";
import { renderTossRoute } from "./toss/routes";
import { TossInset } from "./toss/Inset";
import { TossOverlay } from "./toss/Overlay";
import { TossSplash } from "./toss/home/TossSplash";
import { renderAlloneRoute } from "./allone/routes";
import { AlloneOverlay } from "./allone/Overlay";
import { AlloneSplash } from "./allone/launch/AlloneSplash";
import { aoLaunchReady } from "./allone/launch";
import { aoHistoryGoFirst } from "./allone/nav";
import { AoNativePortal } from "./allone/ui/NativePortal";
import { prefetch } from "./api/useApi";
import { paths } from "./api/endpoints";
import { RESTART_EVENT } from "./platform/recorder";
import { checkAuth, useAuth } from "./auth/auth";
import { LoginScreen } from "./auth/LoginScreen";
import { useStatusBar } from "./hooks/useStatusBar";

type Boot = "off" | "pick" | "splash" | "loading" | "ready";

// ScreenStack이 화면마다 "그 화면의 주소"로 이 함수를 불러서 그린다
const renderRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<HomeScreen />} />
    <Route path="/account/:accountId" element={<AccountDetailScreen />} />
    <Route path="/account/:accountId/history" element={<HistoryScreen />} />
    <Route path="/account/:accountId/tx/:txId" element={<TxDetailScreen />} />
    <Route path="/bank/:accountId" element={<BankAccountScreen />} />
    <Route path="/transfer" element={<TransferScreen />} />
    <Route path="/transfer/amount" element={<AmountScreen />} />
    <Route path="/transfer/done" element={<TransferDoneScreen />} />
  </Routes>
);

// NH 콕뱅크 (APP=nh 로 띄운 서버, 9103). 데이터도 카카오뱅크와 따로
const renderNhRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<NhHome />} />
    <Route path="/send" element={<NhSend />} />
    <Route path="/send/confirm" element={<NhConfirm />} />
    <Route path="/send/done" element={<NhDone />} />
    <Route path="/accounts" element={<NhAccounts />} />
    <Route path="/register" element={<NhRegister />} />
    <Route path="/history/:accountId" element={<NhHistory />} />
    <Route path="/tx/:txId" element={<NhTxDetail />} />
  </Routes>
);

// 하나원큐 (APP=hana 로 띄운 서버, 9105). 데이터도 따로
const renderHanaRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<HanaHome />} />
    <Route path="/send" element={<HanaSend />} />
    <Route path="/send/done" element={<HanaDone />} />
    <Route path="/history/:accountId" element={<HanaHistory />} />
    <Route path="/tx/:txId" element={<HanaTxDetail />} />
  </Routes>
);
// IBK기업은행 i-ONE Bank (APP=ibk 로 띄운 서버, 9107). 데이터도 따로.
// 거래 상세는 거래내역 화면 위 시트, 이체확인증은 이체결과조회에서 들어감
const renderIbkRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<IbkHome />} />
    <Route path="/send" element={<IbkSend />} />
    <Route path="/send/done" element={<IbkDone />} />
    <Route path="/history/:accountId" element={<IbkHistory />} />
    <Route path="/menu" element={<IbkMenu />} />
    <Route path="/results" element={<IbkResults />} />
    <Route path="/results/:transferId" element={<IbkCertificate />} />
  </Routes>
);
// 케이뱅크 (APP=kbank 9109, 녹화 인트로를 켠 kbank2 9111 — 화면은 같고 데이터는 따로).
// 계좌 화면 = 잔액 카드 + 거래내역, 거래 상세는 아래에서 올라오는 전체 화면
const renderKbankRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<KbankHome />} />
    <Route path="/account/:accountId" element={<KbankAccount />} />
    <Route path="/tx/:txId" element={<KbankTxDetail />} />
    <Route path="/receipt/:txId" element={<KbankReceipt />} />
    <Route path="/send" element={<KbankSend />} />
    <Route path="/send/done" element={<KbankDone />} />
  </Routes>
);
// 토스 (APP=toss 9117): 화면 표는 src/toss/routes.tsx · NH올원뱅크 (APP=allone 9119): src/allone/routes.tsx
const ROUTES = {
  kakao: renderRoute,
  nh: renderNhRoute,
  hana: renderHanaRoute,
  ibk: renderIbkRoute,
  kbank: renderKbankRoute,
  toss: renderTossRoute,
  allone: renderAlloneRoute,
};
// 카카오뱅크 kakao2 (9115): 새 녹화(아이폰) 화면 표 (src/kakao2/routes.tsx). kakao 의 renderRoute 는 그대로
const render = KAKAO2 ? renderKakao2Route : ROUTES[APP];

// 개발 중 매번 스플래시 보기 귀찮으면 주소 뒤에 ?skip
const skipSplash = new URLSearchParams(location.search).has("skip");
// kakao2: 새 녹화엔 시작화면(노란 스플래시 · 로딩)이 없음 → 프로필을 고르면 · 녹화를 시작하면 바로 홈
const warmStart = skipSplash || KAKAO2;

export default function App() {
  // 이번 세션에 고른 프로필이 없으면 프로필 고르기부터
  const [boot, setBoot] = useState<Boot>(!currentProfileId() ? "pick" : warmStart ? "ready" : "splash");
  const toSplash = useCallback(() => {
    prefetch(paths.home); // 스플래시 도는 동안 그 프로필의 홈 데이터를 미리 받아 둠
    setBoot(warmStart ? "ready" : "splash");
  }, []);
  // onDone이 렌더마다 새 함수면 Splash의 effect가 다시 돌아서 타이머가 리셋됨 → useCallback
  const toLoading = useCallback(() => setBoot("loading"), []);
  const toReady = useCallback(() => setBoot("ready"), []);
  // allone: 로그인 cut(+2033) 250ms 전에 홈을 간편비밀번호 화면 밑에 숨겨 미리 그려 둠 (AlloneSplash onPrepare) → cut 에는 보이기만.
  // cut 에 처음 그리면 배치에 40ms 남짓 걸려 막 밑의 홈이 4프레임쯤 늦게 보였음. 시작 흐름을 벗어나면(꺼짐 · 프로필 고르기) 지움
  const [aoPre, setAoPre] = useState(false);
  const aoPrepare = useCallback(() => setAoPre(true), []);
  if (aoPre && boot !== "splash" && boot !== "ready") setAoPre(false);
  // 로그인: 켜질 때 확인 → 안 돼 있으면 로그인 화면. 로그인하면 (다른 계정일 수 있으니) 프로필 고르기부터
  const auth = useAuth();
  const userId = auth.status === "in" ? auth.user.id : null;
  useEffect(() => {
    checkAuth();
  }, []);
  const [seenUser, setSeenUser] = useState<string | null | undefined>(undefined);
  if (userId !== seenUser) {
    if (seenUser !== undefined && userId) setBoot(currentProfileId() ? boot : "pick"); // 방금 로그인
    setSeenUser(userId);
  }
  // 녹화 시작: 검은 화면(off) → 앱을 처음부터 (시작화면). 녹화에 앱이 켜지는 모습까지 찍히게
  const navigate = useNavigate();
  useEffect(() => {
    const onRestart = (e: Event) => {
      if ((e as CustomEvent).detail === "off" && ALLONE) {
        // allone: 앱의 첫 칸으로 돌아가 "/" 로 바꿈 — 다시 켠 앱에서 뒤로가 녹화 전 화면(이체 흐름 등)으로 가지 않게 (그 칸들은 앞으로 가기 칸이 되어 버려짐)
        setBoot("off");
        void aoHistoryGoFirst().then(() => navigate("/", { replace: true }));
      } else if ((e as CustomEvent).detail === "off") {
        navigate("/", { replace: true });
        setBoot("off");
      } else {
        prefetch(paths.home);
        setBoot(currentProfileId() ? (KAKAO2 ? "ready" : "splash") : "pick");
      }
    };
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, [navigate]);
  // kakao2: 홈이 뜨는 때 = 앱이 켜진 때 (상태바 위치 표시 · 홈 인디케이터 · 홈 AI 알약이 여기서부터, src/kakao2/launch.ts).
  // 녹화 인트로는 영상을 트는 동안 잡아 두었다가(holdLaunch) 영상이 끝날 때 정함
  const ready = auth.status === "in" && boot === "ready";
  useEffect(() => {
    if (KAKAO2 && ready) launchReady();
  }, [ready]);
  // allone: 앱이 켜진 때 D = 시작 흐름(boot "splash")이 뜬 때 − 250ms (홈 인디케이터, src/allone/launch.ts). 녹화 인트로는 인트로가 D 를 정해 둠.
  // useLayoutEffect: 자식(AlloneSplash)의 useEffect 보다 먼저 정해 두어야 시작화면이 D 를 읽음 (useEffect 면 자식 효과가 먼저 돌아 배포판에서 250ms 늦었음)
  const splash = auth.status === "in" && boot === "splash";
  useLayoutEffect(() => {
    if (ALLONE && splash) aoLaunchReady();
  }, [splash]);

  return (
    <StatusBarProvider>
      <PhoneFrame
        overlay={
          {
            nh: <NhLoadingLayer />,
            hana: <HanaLoadingLayer />,
            ibk: <IbkLoadingLayer />,
            kbank: undefined,
            kakao: undefined,
            toss: <TossOverlay />,
            allone: <AlloneOverlay />,
          }[APP]
        }
      >
        {auth.status === "checking" && (ALLONE ? <AlloneOff /> : <PhoneOff />)}
        {/* kakao2 는 상태바가 화면 위에 겹치므로 카카오뱅크 로그인 · 프로필 고르기를 54pt 띠 아래에 (K2Inset). 토스도 같은 이유로 28dp 띠 아래에 (TossInset).
            allone 은 웹뷰(.phone__viewport)가 이미 흰 띠 59 / 34 사이라 감싸지 않음 (아래 그냥 갈래) */}
        {auth.status === "out" &&
          (KAKAO2 ? (
            <K2Inset>
              <LoginScreen message={auth.message} />
            </K2Inset>
          ) : TOSS ? (
            <TossInset>
              <LoginScreen message={auth.message} />
            </TossInset>
          ) : (
            <LoginScreen message={auth.message} />
          ))}
        {auth.status === "in" && boot === "off" && (ALLONE ? <AlloneOff /> : <PhoneOff />)}
        {auth.status === "in" &&
          boot === "pick" &&
          (KAKAO2 ? (
            <K2Inset>
              <ProfilePicker onEnter={toSplash} />
            </K2Inset>
          ) : TOSS ? (
            <TossInset>
              <ProfilePicker onEnter={toSplash} />
            </TossInset>
          ) : (
            <ProfilePicker onEnter={toSplash} />
          ))}
        {auth.status === "in" &&
          boot === "splash" &&
          (APP === "nh" ? (
            <NhSplash onDone={toReady} />
          ) : APP === "hana" ? (
            <HanaSplash onDone={toReady} />
          ) : APP === "ibk" ? (
            <IbkSplash onDone={toReady} />
          ) : APP === "kbank" ? (
            <KbankSplash onDone={toReady} />
          ) : APP === "toss" ? (
            // 토스: 시작화면 1.2초 → 홈 (잠금 화면 없음, plan.md §0.12). 진짜 시작화면은 home 영역 (src/toss/home/TossSplash.tsx)
            <TossSplash onDone={toReady} />
          ) : APP === "allone" ? (
            // NH올원뱅크: 흰 시작화면 → 스플래시 → 간편비밀번호 → 로그인 로딩 → 홈 (launch 영역, src/allone/launch/AlloneSplash.tsx)
            <AlloneSplash onDone={toReady} onPrepare={aoPrepare} />
          ) : (
            <Splash onDone={toLoading} />
          ))}
        {auth.status === "in" && boot === "loading" && <BootLoading onDone={toReady} />}
        {auth.status === "in" &&
          (boot === "ready" || (aoPre && boot === "splash")) &&
          (ALLONE ? (
            <div className={`ao-stack${boot === "ready" ? "" : " ao-stack--pre"}`}>
              <ScreenStack render={render} />
            </div>
          ) : (
            <ScreenStack render={render} />
          ))}
      </PhoneFrame>
      <OsSwitch />
      <RecordingBar />
      <FakeCursor />
    </StatusBarProvider>
  );
}

// 앱이 꺼진 상태 (녹화 시작 직전): 검은 화면
function PhoneOff() {
  useStatusBar("#000000", "light");
  return <div style={{ position: "absolute", inset: 0, background: "#000" }} />;
}
// allone: 웹뷰가 흰 띠 사이라 띠까지 창 전체를 검정으로 (네이티브 층). 녹화 인트로가 켜져 있으면 그 위에 장면이 덮음
function AlloneOff() {
  useStatusBar("#000000", "light");
  return (
    <AoNativePortal>
      <div className="ao-off" />
    </AoNativePortal>
  );
}
