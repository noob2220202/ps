// 아이콘 라이브러리(예: lucide-react)를 설치할 수도 있지만, 연습 프로젝트라
// 의존성을 늘리지 않고 인라인 SVG 몇 개만 손으로 그려서 씀.
// name으로 어떤 path를 그릴지 switch하는 간단한 패턴 — 아이콘이 10개 넘어가면
// 파일을 쪼개거나 라이브러리로 바꾸는 게 낫다.

export type IconName =
  | "search"
  | "bell"
  | "home"
  | "gift"
  | "sparkle"
  | "chart"
  | "menu"
  | "back"
  | "settings"
  | "share"
  | "edit"
  | "chevron-right"
  | "wave";

interface IconProps {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, string> = {
  search: "M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm11 3-5.6-5.6",
  bell: "M12 3a5 5 0 0 0-5 5v3.4c0 .6-.2 1.2-.6 1.7L5 15h14l-1.4-1.9a2.8 2.8 0 0 1-.6-1.7V8a5 5 0 0 0-5-5ZM10 18a2 2 0 0 0 4 0",
  home: "m4 11 8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z",
  gift: "M4 10h16v10H4Zm0-4h16v4H4Zm8-3c-1.5 0-3 1-3 3h3Zm0 0c1.5 0 3 1 3 3h-3ZM12 10v10",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z",
  chart: "M5 20V10m7 10V4m7 16v-7",
  menu: "M4 6h16M4 12h16M4 18h16",
  back: "m15 18-6-6 6-6",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-1.8-.6a6.9 6.9 0 0 0-.7-1.7L18.5 8l-1.4-1.4-1.7 1a6.9 6.9 0 0 0-1.7-.7L13 5h-2l-.6 1.9a6.9 6.9 0 0 0-1.7.7l-1.7-1L5.5 8l1 1.7a6.9 6.9 0 0 0-.7 1.7L4 12l1.9.6c.1.6.4 1.2.7 1.7l-1 1.7 1.4 1.4 1.7-1c.5.3 1.1.6 1.7.7L11 19h2l.6-1.9c.6-.1 1.2-.4 1.7-.7l1.7 1 1.4-1.4-1-1.7c.3-.5.6-1.1.7-1.7Z",
  share: "M18 16a3 3 0 1 0-2.8-4.2L9.9 8.6a3 3 0 1 0 0 2.8l5.3 3.2A3 3 0 0 0 18 16Z",
  edit: "m16.5 3.5 4 4L8 20H4v-4ZM15 5l4 4",
  "chevron-right": "m9 6 6 6-6 6",
  wave: "M3 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0",
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
