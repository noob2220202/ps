import type { Ref } from "react";
import adPhoto from "../../assets/local/k2-home-ad.jpg";
import { FLOATING_AD } from "./content";
import { K2Info } from "./icons";
import "./K2FloatingAd.css";

// kakao2 홈 아래 떠 있는 광고 (home.md §4.13 고침). 녹화를 프레임마다 재 보면 광고 위끝 + 스크롤 = 1162.5 로 늘 같음 (3.13 – 3.57초 올라올 때도,
// 4.37 – 4.47초 내려갈 때도) → 시간 애니메이션이 아니라 목록 끝 아래에 붙어 스크롤과 같이 움직이고, 맨 끝(최대 스크롤)에서 제자리 667.
// 끝을 넘겨 당겨도 제자리에 멈춤. 탭바 밑 · 아래 가장자리 막 위 (막에 어두워지지 않음). 자리는 K2Home 이 스크롤 프레임마다 ref 로 바로 옮김
export function K2FloatingAd({ adRef }: { adRef: Ref<HTMLElement> }) {
  return (
    <aside className="k2-ad" ref={adRef}>
      <strong className="k2-ad__title">{FLOATING_AD.title}</strong>
      <span className="k2-ad__desc">{FLOATING_AD.desc}</span>
      <img className="k2-ad__photo" src={adPhoto} alt="" draggable={false} />
      <span className="k2-ad__info" aria-label="광고 정보">
        <K2Info />
      </span>
    </aside>
  );
}
