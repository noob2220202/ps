// NH올원뱅크 시작 흐름 (App boot "splash", launch.md §2.4–2.9, plan.md §1.1): 흰 시작화면 → 스플래시 그림 → 간편비밀번호 → 로그인 로딩 → 홈.
// 시각은 모두 앱이 켜진 때 D 기준 (launch.ts — 녹화 인트로는 녹아 사라지기 시작한 때, 그냥 켜면 이 화면이 뜬 때 − 250ms):
//   D+1450  스플래시 그림이 267ms 동안 나타남 (네이티브 층 y 59–852, 아래 띠까지 덮음) → 2383ms 그대로
//   D+4100  간편비밀번호 화면으로 167ms 교차 페이드 (그림만 사라지고 밑에 미리 그려 둔 초록 화면이 드러남)
//   D+4384  보안 키패드가 한 프레임에 (교차 페이드 끝 + 117ms), 아래 링크 줄이 키패드 위로 뜀
//   6번째 숫자 → +67ms 로딩 막 + 스피너 (그 프레임에 키패드 사라짐, 링크 줄은 다시 아래로) → 홈 데이터를 막 동안 받음
//   → +2033ms 막 밑에서 홈으로 (onDone → ScreenStack) → +2183 스피너 · +2233 막 걷힘 (aoLoad "login", loading.ts)
// 스플래시 · 교차 페이드는 CSS 애니메이션을 그린 때로 박아 둔 것(타이머 흔들림 없음), 화면이 바뀌는 때는 그 시각의 첫 프레임 (frame.ts)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefetch } from "../../api/useApi";
import { localAsset } from "../../assets/Asset";
import { useStatusBar } from "../../hooks/useStatusBar";
import { aoPaths } from "../api";
import { useAoLaunchAt } from "../launch";
import { aoLoad } from "../loading";
import { AO_INTRO, AO_LAUNCH_NO_INTRO_LEAD, AO_SPLASH } from "../motion";
import { AoNativePortal } from "../ui/NativePortal";
import { atFrame, flushNow, pinStart } from "./frame";
import { AlloneLaunchPin } from "./Pin";
import "./launch.css";

const SPLASH = localAsset("allone-launch-splash");

// D 기준 ms
const T_SPLASH = AO_INTRO.splashAt; // 1450 그림 나타나기 시작
const T_SHOWN = T_SPLASH + AO_SPLASH.fade; // 1717 다 나타남 — 이 뒤로는 그림이 화면을 다 덮으므로 밑에 간편비밀번호 화면을 그려 둠
const T_PIN_UNDER = T_SHOWN + 50;
const T_TO_PIN = T_SHOWN + AO_SPLASH.hold; // 4100 교차 페이드
const T_PIN = T_TO_PIN + AO_SPLASH.toPin; // 4267
const T_KEYPAD = T_PIN + AO_SPLASH.keypadAfter; // 4384

// 간편비밀번호 화면 글자 · 키패드 숫자를 미리 받아 둠 (글꼴이 글자 묶음별로 나뉘어 있어 교차 페이드 때 글자가 늦게 뜨지 않게)
function warmFonts() {
  try {
    const f = document.fonts;
    if (!f) return;
    void f.load('500 19px "Pretendard Variable"', "간편비밀번호6자리를입력해주세요").catch(() => {});
    void f.load('400 16.5px "Pretendard Variable"', "자동로그인 방식 변경하기간편비밀번호 재등록").catch(() => {});
    void f.load('500 22.5px "Pretendard Variable"', "0123456789").catch(() => {});
  } catch {
    /* 글꼴 API 가 없으면 그냥 */
  }
}

type Stage = "white" | "under" | "pin"; // under = 그림 밑에 간편비밀번호 화면을 그려 둠, pin = 그림을 걷음

export function AlloneSplash({ onDone }: { onDone: () => void }) {
  useStatusBar("#ffffff", "dark");
  // D: useAoLaunchAt — App 이 useLayoutEffect 로 정하면 그리기 전에 바로 다시 그려 이번 D 를 받음 (첫 그리기의 지난 값은 화면에 안 나감)
  const [base] = useState(() => performance.now());
  const at = useAoLaunchAt();
  const d = at ?? base - AO_LAUNCH_NO_INTRO_LEAD;
  const [stage, setStage] = useState<Stage>("white");
  const [keypad, setKeypad] = useState(false);
  const [loading, setLoading] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(warmFonts, []);

  // 단계 바꾸기: 그 시각의 첫 프레임에
  useEffect(() => {
    const stops = [
      // 그림이 없는 저장소(에셋을 안 만듦)면 흰 화면 그대로 있다가 교차 페이드 때 간편비밀번호 화면
      atFrame(d + (SPLASH ? T_PIN_UNDER : T_TO_PIN), () => setStage((s) => (s === "white" ? "under" : s))),
      atFrame(d + T_PIN, () => setStage("pin")),
      atFrame(d + T_KEYPAD, () => setKeypad(true)),
    ];
    return () => stops.forEach((stop) => stop());
  }, [d]);

  // 스플래시 그림의 두 애니메이션(나타남 · 사라짐)을 그린 때로 박아 둠
  const splashRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    pinStart(splashRef.current, base);
  }, [d, base]);

  // 6번째 숫자: 로딩 막 (login 프로필: +67 막 · 스피너, 그 프레임에 키패드 없앰 → +2033 홈 → +2233 막 걷힘)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const started = useRef(false);
  const [attempt, setAttempt] = useState(0); // 간편비밀번호 화면을 새로 (점 지움 · 키패드 다시 섞음)
  const onComplete = () => {
    if (started.current) return;
    started.current = true;
    let cut = false;
    void aoLoad("login", {
      task: prefetch(aoPaths.home),
      onShow: () => alive.current && flushNow(() => setLoading(true)), // 막이 켜진 그 프레임에 키패드를 없앰
      onCut: () => {
        cut = true;
        if (alive.current) done.current();
      },
    }).then((ok) => {
      // 막 동안 브라우저 뒤로 · 홈 데이터 실패로 홈까지 못 가면: 막만 걷히고 점 6개 · 키패드 없는 화면에 멈추지 않게 처음부터 다시 입력
      if (ok || cut || !alive.current) return;
      started.current = false;
      setLoading(false);
      setAttempt((n) => n + 1);
    });
  };

  const splashStyle = {
    animation:
      `ao-ln-splash-in ${AO_SPLASH.fade}ms ${AO_SPLASH.fadeEase} ${d + T_SPLASH - base}ms both, ` +
      `ao-ln-splash-out ${AO_SPLASH.toPin}ms ${AO_SPLASH.toPinEase} ${d + T_TO_PIN - base}ms forwards`,
  };

  return (
    <div className="ao-ln">
      {stage !== "white" && <AlloneLaunchPin key={attempt} keypad={keypad} locked={loading} onComplete={onComplete} />}
      {stage !== "pin" && SPLASH && (
        <AoNativePortal>
          <img ref={splashRef} className="ao-ln-splash" src={SPLASH} alt="" draggable={false} style={splashStyle} />
        </AoNativePortal>
      )}
    </div>
  );
}
