// /tab/all — 전체 메뉴 (녹화에 없음, 지어냄 — assets.md §5.4 · plan.md §1.2). 바탕 #171619, 탭바(전체 채움).
// 머리줄: '전체' 22 B (x 24), 오른쪽 돋보기 · ⚙ (누름만). 구역 제목 15 SB #8a898c + 56dp 줄 (36dp 초타원 그림, 17 M, ›):
//  자산: 내 자산 · 소비 · 내 계좌 / 토스뱅크: 토스뱅크 통장 · 거래내역 · 송금 · 증명서 발급 / 설정: 관리 패널
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DevPanel } from "../../dev-panel/DevPanel";
import { useTossFlow } from "../flow";
import { useTossBackStep, useTossGo } from "../nav";
import { GearIcon, SearchIcon } from "../ui/icons";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { useTossPageRoot } from "../ui/shared";
import { TossSymbol } from "../ui/TossSymbol";
import { RowChevron } from "./icons";
import { TabBar } from "./TabBar";
import "./home.css";

const noop = () => {};
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// 36dp 초타원 + 선 그림 (지어냄)
function Tile({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span className="toss-home-all__ic" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
const G = ({ d }: { d: string }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
    <path d={d} {...stroke} />
  </svg>
);

type Item = { label: string; icon: ReactNode; run: () => void };

export function AllMenu() {
  const go = useTossGo();
  const { goBank, goSend } = useTossFlow();
  const [panel, setPanel] = useState(false);
  const sections: [string, Item[]][] = [
    [
      "자산",
      [
        { label: "내 자산", icon: <Tile bg="#1f2b45" fg="#5d9cf8"><G d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z M14.5 2.8v6.7h6.7a6.7 6.7 0 0 0-6.7-6.7Z" /></Tile>, run: () => go("/assets") },
        { label: "소비", icon: <Tile bg="#2b2433" fg="#b48af7"><G d="M3.5 6.5h17v11h-17Z M3.5 10.2h17 M7 14.3h4" /></Tile>, run: () => go("/spend") },
        { label: "내 계좌", icon: <Tile bg="#1d2d2a" fg="#3ec7a1"><G d="M3.5 9 12 4l8.5 5M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17" /></Tile>, run: () => go("/assets/accounts") },
      ],
    ],
    [
      "토스뱅크",
      [
        {
          label: "토스뱅크 통장",
          icon: (
            <span className="toss-home-all__ic" style={{ background: "#22375c" }}>
              <TossSymbol height={18} />
            </span>
          ),
          run: () => goBank("main", { toast: true }),
        },
        { label: "거래내역", icon: <Tile bg="#26262c" fg="#c3c3c8"><G d="M8 6.5h11M8 12h11M8 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1" /></Tile>, run: () => go("/bank/main/history") },
        { label: "송금", icon: <Tile bg="#1f2b45" fg="#5d9cf8"><G d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4Z" /></Tile>, run: () => goSend({ from: "main", toastFromHome: true }) },
        { label: "증명서 발급", icon: <Tile bg="#2c2a22" fg="#e2b84a"><G d="M6 3.5h8.5L18.5 7.5V20.5H6ZM14 3.5V8h4.5M9 12h6M9 15.5h6" /></Tile>, run: () => go("/cert") },
      ],
    ],
    [
      "설정",
      [
        {
          label: "관리 패널",
          icon: (
            <Tile bg="#2c2425" fg="#f06b75">
              <G d="M12 4.2c-3.4 0-5.6 2.6-5.6 6v4L4.8 16.6h14.4L17.6 14.2v-4c0-3.4-2.2-6-5.6-6ZM10 19.2a2.2 2.2 0 0 0 4 0" />
            </Tile>
          ),
          run: () => setPanel(true),
        },
      ],
    ],
  ];
  return (
    <TossPage
      className="toss-home toss-home-all"
      bodyClassName="toss-home__body"
      header={
        <div className="toss-home-head" style={{ background: "#171619" }}>
          <span className="toss-home-ph__title">전체</span>
          <div className="toss-home-all__icons">
            <TossPressable className="toss-home-all__ib" radius={22} onPress={noop} ariaLabel="검색">
              <SearchIcon size={24} />
            </TossPressable>
            <TossPressable className="toss-home-all__ib" radius={22} onPress={noop} ariaLabel="설정">
              <GearIcon size={24} />
            </TossPressable>
          </div>
        </div>
      }
      dock={<TabBar />}
    >
      {sections.map(([title, items], i) => (
        <section key={title}>
          {i > 0 && <div className="toss-home-all__gap" />}
          <h2 className="toss-home-all__sec">{title}</h2>
          {items.map((it) => (
            <TossPressable key={it.label} className="toss-home-all__row" color="#2a2b30" onPress={it.run}>
              {it.icon}
              <span className="toss-home-all__label">{it.label}</span>
              <RowChevron />
            </TossPressable>
          ))}
        </section>
      ))}
      <PanelMount open={panel} onClose={() => setPanel(false)} />
    </TossPage>
  );
}

function PanelMount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useTossPageRoot();
  useTossBackStep(open, onClose); // 갤럭시 뒤로 = 패널 닫기 (plan.md §1.4)
  const node = <DevPanel open={open} onClose={onClose} />;
  return root ? createPortal(node, root) : node;
}
