import type { ReactNode } from "react";
import { THEME } from "../platform/theme";
import { AiDiamond, AlbumLogo } from "../components/art";
import wave from "./fluent/wave.png";
import target from "./fluent/target.png";
import coin from "./fluent/coin.png";
import card from "./fluent/card.png";
import bus from "./fluent/bus.png";
import boy from "./fluent/boy.png";
import girl from "./fluent/girl.png";
import child from "./fluent/child.png";
import star from "./fluent/star.png";
import calendar from "./fluent/calendar.png";
import building from "./fluent/building.png";
import shoe from "./fluent/shoe.png";
import moneyBag from "./fluent/money-bag.png";
import "./Asset.css";

// 화면에 들어가는 이미지 "자리(slot)" 목록.
// 실무에선 디자이너가 준 이미지 파일을 넣는데, 공개 저장소엔 브랜드 로고/사진을 올릴 수 없으니
//  1) src/assets/local/<slot>.<light|dark>.png  (테마별 실제 이미지, .gitignore 처리)
//  2) src/assets/local/<slot>.png               (테마 공통 실제 이미지)
//  3) 아래 FALLBACK (저장소에 포함된 무료 에셋: Microsoft Fluent 3D 이모지, MIT)
// 순서로 찾는다. 실제 이미지는 scripts/extract-assets.sh 로 화면 녹화에서 잘라 만들 수 있다.
export type Slot =
  | "hand"
  | "hand-tile"
  | "ai-saving"
  | "star"
  | "card"
  | "tmoney"
  | "coin"
  | "ai-diamond"
  | "friends"
  | "friends-avatar"
  | "banner-and2ble"
  | "banner-mcard"
  | "banner-pcbang"
  | "banner-friday"
  | "shortcut-subsidy"
  | "shortcut-timetable"
  | "shortcut-allowance"
  | "shortcut-coupon"
  | "ad-product";

// import.meta.glob은 "빌드할 때" 폴더를 훑어서 있는 파일만 번들에 넣는다.
// 그래서 실행 중에 없는 파일을 요청(404)하거나, 대체 이미지로 바뀌며 깜빡이는 일이 없다.
const files = import.meta.glob<string>("./local/*.{png,jpg,jpeg,webp}", { eager: true, import: "default" });
const local = new Map(Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]));

// 슬롯 목록에 없는 이름(예: 은행 로고 "bank-shinhan")도 찾을 수 있게 문자열로 받는다
export const localAsset = (name: string) => local.get(`${name}.${THEME}`) ?? local.get(name);
const localUrl = (slot: Slot) => localAsset(slot);

const emoji = (src: string, scale = 0.62) => (
  <img className="asset__emoji" src={src} alt="" style={{ width: `${scale * 100}%` }} draggable={false} />
);

const FALLBACK: Record<Slot, () => ReactNode> = {
  hand: () => emoji(wave),
  "hand-tile": () => emoji(wave),
  "ai-saving": () => emoji(target),
  star: () => emoji(star, 1),
  card: () => <img className="asset__card-fallback" src={card} alt="" draggable={false} />,
  tmoney: () => emoji(bus),
  coin: () => emoji(coin, 1),
  "ai-diamond": () => <AiDiamond size={18} />,
  friends: () => (
    <span className="asset__friends">
      <img src={girl} alt="" className="asset__friend asset__friend--left" />
      <img src={boy} alt="" className="asset__friend asset__friend--right" />
      <img src={child} alt="" className="asset__friend asset__friend--front" />
    </span>
  ),
  "friends-avatar": () => (
    <span className="asset__friends">
      <img src={girl} alt="" className="asset__friend asset__friend--left" />
      <img src={boy} alt="" className="asset__friend asset__friend--right" />
      <img src={child} alt="" className="asset__friend asset__friend--front" />
    </span>
  ),
  "banner-and2ble": () => (
    <span className="asset__ad-fallback">
      <AlbumLogo size={22} />
      <small>MINI ALBUM</small>
    </span>
  ),
  "banner-mcard": () => emoji(card, 0.8),
  "banner-pcbang": () => emoji(coin, 0.8),
  "banner-friday": () => emoji(moneyBag, 0.8),
  "shortcut-subsidy": () => emoji(building, 1),
  "shortcut-timetable": () => emoji(calendar, 1),
  "shortcut-allowance": () => emoji(coin, 1),
  "shortcut-coupon": () => emoji(moneyBag, 1),
  "ad-product": () => emoji(shoe, 0.6),
};

export function Asset({ slot, className = "" }: { slot: Slot; className?: string }) {
  const url = localUrl(slot);
  return (
    <span className={`asset asset--${slot} ${url ? "asset--local" : ""} ${className}`}>
      {url ? <img src={url} alt="" draggable={false} /> : FALLBACK[slot]()}
    </span>
  );
}
