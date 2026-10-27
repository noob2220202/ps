import type { ReactNode } from "react";

// 라인 아이콘은 stroke, 채워진 아이콘은 fill. 색은 currentColor라 부모 color를 따라감.
const LINE: Record<string, ReactNode> = {
  back: <path d="M20 12H5m6-7-7 7 7 7" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8 14 4.6l2.6-.4.9 2.5 2.5.9-.4 2.6 1.8 1.8-1.8 1.8.4 2.6-2.5.9-.9 2.5-2.6-.4-2 1.8-2-1.8-2.6.4-.9-2.5-2.5-.9.4-2.6L2.6 12l1.8-1.8L4 7.6l2.5-.9.9-2.5 2.6.4Z" />
    </>
  ),
  bell: <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15ZM10 21h4" />,
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="12" rx="2" />
      <path d="M12 8.5v12M8 3.5l4 5 4-5" />
    </>
  ),
  ai: (
    <>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
      <path d="M12.6 7.5 10.3 12.4h3.3L11.4 16.5" />
    </>
  ),
  invest: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="m7 15 3.5-3.5 2.5 2.5L17 9.5m-3 0h3v3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  search: <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 14v5h14v-5" />,
  sliders: <path d="M4 8h9m4 0h3M4 16h3m4 0h9M15 6v4M9 14v4" />,
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
};

const FILL: Record<string, ReactNode> = {
  home: <path d="M3 10.6 12 3l9 7.6V20a1 1 0 0 1-1 1h-5.2v-6h-5.6v6H4a1 1 0 0 1-1-1Z" />,
  pencil: <path d="m15.5 4.5 4 4L9 19l-5 1 1-5Zm1.4-1.4 1.4-1.4 4 4-1.4 1.4Z" />,
  text: <path d="M5 4h14v4h-2V6.5h-3.8V18H15v2H9v-2h1.8V6.5H7V8H5Z" />,
};

interface IconProps {
  name: keyof typeof LINE | keyof typeof FILL;
  size?: number;
  stroke?: number;
  className?: string;
}

export function Icon({ name, size = 24, stroke = 1.9, className }: IconProps) {
  const filled = name in FILL;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {filled ? FILL[name] : LINE[name]}
    </svg>
  );
}
