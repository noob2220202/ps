import type { HomeData } from "../../api/types";
import { Asset } from "../../assets/Asset";
import { Icon } from "../../components/icons/Icon";

export function AdBanner({ ad, onClose }: { ad: HomeData["ad"]; onClose: () => void }) {
  return (
    <div className="ad">
      <div className="ad__text">
        <strong>{ad.title}</strong>
        <strong>{ad.subtitle}</strong>
        <span className="ad__when">{ad.when}</span>
        <button className="ad__cta pressable">{ad.cta}</button>
      </div>
      <div className="ad__media">
        <Asset slot="ad" className="ad__photo" />
        <span className="ad__badge">AD</span>
      </div>
      <button className="ad__close" aria-label="광고 닫기" onClick={onClose}>
        <Icon name="close" size={17} stroke={1.8} />
      </button>
    </div>
  );
}
