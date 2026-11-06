import adPhoto from "../../assets/local/k2-home-ad.jpg";
import { FLOATING_AD } from "./content";
import { K2Info } from "./icons";
import "./K2FloatingAd.css";

export type K2AdState = "hidden" | "shown" | "gone";

// kakao2 홈 아래 떠 있는 광고 (home.md §4.13): 목록 끝까지 내리면 탭바 뒤에서 올라오고(450ms), 위로 올리면 내려가 사라짐(100ms).
// 한 번 내려가면 이번 방문 동안은 다시 안 나옴 (상태는 K2Home 이 스크롤로 정함)
export function K2FloatingAd({ state }: { state: K2AdState }) {
  return (
    <aside className={`k2-ad k2-ad--${state}`} aria-hidden={state !== "shown"}>
      <strong className="k2-ad__title">{FLOATING_AD.title}</strong>
      <span className="k2-ad__desc">{FLOATING_AD.desc}</span>
      <img className="k2-ad__photo" src={adPhoto} alt="" draggable={false} />
      <span className="k2-ad__info" aria-label="광고 정보">
        <K2Info />
      </span>
    </aside>
  );
}
