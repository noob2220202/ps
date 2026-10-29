import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStatusBar } from "../hooks/useStatusBar";
import { localAsset } from "../assets/Asset";
import { NhDots, NhImg } from "./common";
import "./nh-splash.css";

// 콕뱅크 시작화면 (녹화1 0.80~5.35초). 시간은 앱 창이 뜨기 시작한 때(녹화 0.80초)부터 ms:
//   0~249    흰 창이 아이콘 자리에서 화면 전체로 펼쳐지며 가운데 콕 아이콘이 커짐 (안드로이드 실행 애니메이션)
//   432~872  아래 제스처바 손잡이가 흰색 → #afafaf (점점 느려지게)
//   ~840     흰 화면 + 아이콘만 (상태바도 안 보임) → 840부터 125ms 동안 상태바(흰 바탕 어두운 글자)가 나타남
//   1017     어두운 'NH콕뱅크' 화면으로 바뀜 (흰 창이 25ms 동안 사라짐). 점 3개는 처음부터 튐.
//            상태바 아이콘은 1185까지 어두운 색(#08070c, 바탕과 거의 같아 안 보임), 그 뒤 밝은 색.
//            제스처바 손잡이는 1218까지 검정(안 보임), 그 뒤 380ms 동안 #5d5d5d 로
//   1755~2102  'NH'·'뱅크' 사라짐,  2140~2466  '콕' 사라짐 (곡선은 CSS keyframes 에 프레임마다 잰 값)
//   4554     다음 화면 (실제 앱은 이다음 간편비밀번호 로그인이 있지만 연습용이라 바로 홈)
// 그림·움직임은 CSS 애니메이션(시작화면이 뜬 순간부터)이고, 아래 단계는 JS 타이머로 바꿈.
// JS 로 바꾼 단계는 effect·다시 그리기 때문에 화면에 ~22ms 늦게 나타나서 그만큼 앞당겨 둠
const LAG = 22;
const T = {
  statusBar: 840 - LAG,
  dark: 1017 - LAG,
  gone: 1045 - LAG,
  light: 1185 - LAG,
  done: 4554 - LAG,
};
type Phase = "launch" | "white" | "fade" | "brand" | "light";
// 시작화면이 도는 동안 홈 그림을 미리 받아 풀어 둠 → 홈이 처음 뜰 때 무겁지 않아 스켈레톤이 실제처럼 ~160ms 만 보임
const HOME_IMAGES = [
  "nh-account",
  "nh-gh-rec-diary",
  "nh-gh-rec-coin",
  "nh-gh-banner-1",
  "nh-gh-banner-2",
  "nh-gh-tab-1",
  "nh-gh-tab-2",
  "nh-gh-tab-3",
  "nh-gh-tab-4",
  "nh-gh-tab-5",
];

export function NhSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("launch");
  const dark = phase === "fade" || phase === "brand" || phase === "light";
  useStatusBar(
    dark ? "#18171c" : "#ffffff",
    phase === "light" ? "light" : "dark",
  );
  useEffect(() => {
    for (const name of HOME_IMAGES) {
      const src = localAsset(name);
      if (!src) continue;
      const img = new Image();
      img.src = src;
      img.decode().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase("white"), T.statusBar),
      setTimeout(() => setPhase("fade"), T.dark),
      setTimeout(() => setPhase("brand"), T.gone),
      setTimeout(() => setPhase("light"), T.light),
      setTimeout(onDone, T.done),
    ];
    return () => ts.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`screen nh nh-splash nh-splash--${phase}`}>
      {/* 어두운 화면 (흰 창 아래에 미리 깔아 둠). 그림은 녹화(480px)에서 잘라 온 자리 그대로 */}
      <Px at={[196, 108]} top={28}>
        <NhImg name="nh-nonghyup" w={88} h={54} fallback={null} />
      </Px>
      <p className="nh-splash__tag">
        금융, 정보, 쇼핑을 <b>한 번에</b>
      </p>
      <Px
        at={[118, 430]}
        top={28}
        className="nh-splash__word nh-splash__word--nh"
      >
        <NhImg name="nh-wordmark-nh" w={88} h={48} fallback={<b>NH</b>} />
      </Px>
      <Px
        at={[206, 412]}
        top={28}
        className="nh-splash__word nh-splash__word--kok"
      >
        <NhImg name="nh-wordmark-kok" w={73} h={86} fallback={<b>콕</b>} />
      </Px>
      <Px
        at={[279, 427]}
        top={28}
        className="nh-splash__word nh-splash__word--bank"
      >
        <NhImg name="nh-wordmark-bank" w={83} h={56} fallback={<b>뱅크</b>} />
      </Px>
      {/* 점 3개: 로딩 막과 같은 자리 (상태바 아래~제스처바 위의 가운데에서 0.8 위) */}
      <span className="nh-splash__dots">
        <NhDots />
      </span>
      <Px at={[196, 894]} top={28}>
        <NhImg name="nh-ma" w={88} h={60} fallback={null} />
      </Px>
      {(phase === "launch" || phase === "white" || phase === "fade") && (
        <Launch phase={phase} />
      )}
      <NavCover />
    </div>
  );
}

// 어두운 화면으로 바뀐 뒤 제스처바 손잡이가 늦게(1218ms부터) 나타나는 것: 폰 제스처바 위를 검정으로 덮었다가 걷어냄
function NavCover() {
  const phone = document.querySelector(".phone");
  const el = <i className="nh-splash__navcover" />;
  return phone ? createPortal(el, phone) : null;
}

// 흰 창: 상태바·아래 제스처바까지 폰 전체를 덮어야 해서 .phone 에 직접 그림
function Launch({ phase }: { phase: "launch" | "white" | "fade" }) {
  const phone = document.querySelector(".phone");
  const layer = (
    <div className={`nh-splash__launch nh-splash__launch--${phase}`}>
      <div className="nh-splash__window">
        {/* 아이콘 (녹화 1.5초 x 188~284, y 484~580) — 바깥 상자가 커지며 내려오는 애니메이션 */}
        <span className="nh-splash__icon">
          <Px at={[188, 484]} top={0} origin={[150, 387]}>
            <NhImg
              name="nh-splash-icon"
              w={96}
              h={96}
              fallback={<b className="nh-splash__icon-fallback">콕</b>}
            />
          </Px>
        </span>
        <i className="nh-splash__handle" />
      </div>
      {/* 840ms 부터 창은 상태바 아래만, 상태바 자리는 흰 덮개가 125ms 동안 걷힘 */}
      {phase !== "launch" && <i className="nh-splash__sbcover" />}
    </div>
  );
  return phone ? createPortal(layer, phone) : layer;
}

const S = 1.25; // 녹화 px / dp

// 녹화(480px)에서 잘라 온 그림(안의 NhImg w/h = 그림 px)을 녹화 px 자리 (x, y)에 정확히: 정수 CSS px + translate + scale(0.8)
// top: 부모 상자의 화면 위 위치(dp), origin: 부모가 이미 옮겨 둔 만큼(dp)
function Px({
  at: [x, y],
  top,
  origin: [ox, oy] = [0, 0],
  className = "",
  children,
}: {
  at: [number, number];
  top: number;
  origin?: [number, number];
  className?: string;
  children: ReactNode;
}) {
  const l = Math.floor(x / S);
  const t = Math.floor(y / S);
  return (
    <span
      className={`nh-splash__px ${className}`}
      style={{
        left: l - ox,
        top: t - top - oy,
        transform: `translate(${(x / S - l).toFixed(4)}px, ${(y / S - t).toFixed(4)}px) scale(${1 / S})`,
      }}
    >
      {children}
    </span>
  );
}
