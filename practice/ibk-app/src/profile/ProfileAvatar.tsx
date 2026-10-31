import type { AppProfile } from "../api/types";
import { AVATAR_IMAGES } from "./avatars";
import "./ProfileAvatar.css";

export function ProfileAvatar({ profile, size }: { profile: Pick<AppProfile, "avatar" | "color">; size: number }) {
  return (
    <span className="profile-avatar" style={{ width: size, height: size, background: profile.color }}>
      <img src={AVATAR_IMAGES[profile.avatar]} alt="" width={size * 0.62} height={size * 0.62} />
    </span>
  );
}
