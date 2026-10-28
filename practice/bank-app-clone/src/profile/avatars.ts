import type { AvatarName } from "../api/types";
import boy from "../assets/fluent/boy.png";
import girl from "../assets/fluent/girl.png";
import child from "../assets/fluent/child.png";
import grandma from "../assets/fluent/grandma.png";
import wave from "../assets/fluent/wave.png";
import star from "../assets/fluent/star.png";
import coin from "../assets/fluent/coin.png";
import moneyBag from "../assets/fluent/money-bag.png";

// 프로필 아바타: 파스텔 동그라미 + 3D 이모지 (Fluent, MIT). 서버 목록(server/db.mjs AVATARS/COLORS)과 같아야 함
export const AVATAR_IMAGES: Record<AvatarName, string> = {
  boy,
  girl,
  child,
  grandma,
  wave,
  star,
  coin,
  "money-bag": moneyBag,
};
export const AVATAR_NAMES = Object.keys(AVATAR_IMAGES) as AvatarName[];
export const AVATAR_COLORS = ["#FFE45C", "#BDEBD8", "#CFE3FF", "#FFD3DC", "#E2D9FF", "#FFDCC2"];
