// 흔한 목록 줄: [아이콘] 제목 / 부제 … [오른쪽]. 모양이 녹화와 다르면 영역 CSS 로 덮거나 자기 줄을 따로 그림 (잰 줄 높이 · 글자는 영역 스펙)
import type { CSSProperties, ReactNode } from "react";
import { TossPressable, type TossPressableProps } from "./Pressable";

export interface TossRowProps extends Omit<TossPressableProps, "children"> {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  height?: number;
  padX?: number; // 좌우 여백 (기본 24)
  gap?: number; // 아이콘과 글자 사이 (기본 16)
  titleStyle?: CSSProperties;
  subStyle?: CSSProperties;
}

export function TossRow({ icon, title, sub, right, height, padX = 24, gap = 16, titleStyle, subStyle, className, style, ...press }: TossRowProps) {
  const body = (
    <div className="toss-row__in" style={{ minHeight: height, padding: `0 ${padX}px`, gap }}>
      {icon && <div className="toss-row__icon">{icon}</div>}
      <div className="toss-row__text">
        <div className="toss-row__title" style={titleStyle}>
          {title}
        </div>
        {sub != null && (
          <div className="toss-row__sub" style={subStyle}>
            {sub}
          </div>
        )}
      </div>
      {right != null && <div className="toss-row__right">{right}</div>}
    </div>
  );
  if (!press.onPress)
    return (
      <div className={`toss-row${className ? ` ${className}` : ""}`} style={style}>
        {body}
      </div>
    );
  return (
    <TossPressable className={`toss-row${className ? ` ${className}` : ""}`} style={style} {...press}>
      {body}
    </TossPressable>
  );
}
