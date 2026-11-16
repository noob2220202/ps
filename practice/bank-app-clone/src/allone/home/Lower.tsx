// 홈 아래 칸들 (home.md §2.5–§2.14, 쪽 550 → 2989). 뼈대 H4 에서 한 프레임에 나타남. 누름은 모두 아무 일 없음 (plan §1.7)
// 자리는 이 칸의 위끝(쪽 550)부터 잰 pt — 녹화의 이어 붙인 긴 화면(long_full, y px/3)에서 잰 잉크 상자
import { memo, useContext, useEffect, useState } from "react";
import { AO_ADS, AO_TICKER } from "../motion";
import { AoNhSymbol } from "../ui";
import { Art, ArtCardAd, ArtHealthTile, ArtMenuSetting, ArtSavingAd, ArtStepsAd } from "./art";
import { HOME_AD, HOME_ADS, HOME_ASSET, HOME_GROUP, HOME_LIFE, HOME_MOIM, HOME_QUICK, HOME_SCHEDULE, HOME_SPEND, HOME_TICKER } from "./content";
import { LowerActive } from "./lowerActive";
import { mod, useLoopPager, visibleSlots } from "./pager";

// 홈이 뼈대 단계마다 다시 그려져도 이 칸은 건너뜀 (단계 시각이 늦어지지 않게). 숨김 · 보임은 바깥 칸(Home)이 정함
export const Lower = memo(function Lower({ freshKey }: { freshKey: number }) {
  return (
    <div className="ao-home-lower">
      <AdBlock />
      <Title top={123.83} chevron>
        오늘의 혜택
      </Title>
      <Ticker key={`ticker-${freshKey}`} />
      <Quick />
      <Title top={475.83} chevron>
        내 모임
      </Title>
      <div className="ao-home-wcard ao-home-moim">
        <p className="ao-home-abs ao-home-moim__sub">{HOME_MOIM.sub}</p>
        <Lines lines={HOME_MOIM.lines} x={20} tops={[41.4, 67.43]} />
        <Art name={HOME_MOIM.art} x={245.61} y={1.1} />
      </div>
      <Ads key={`ads-${freshKey}`} />
      <Title top={821.83}>{HOME_SCHEDULE.title}</Title>
      <div className="ao-home-wcard ao-home-sched">
        <Lines lines={HOME_SCHEDULE.lines} x={20.6} tops={[23.67, 49.67]} />
        <Art name={HOME_SCHEDULE.art} x={248.86} y={17.4} />
      </div>
      <Title top={995.83}>{HOME_SPEND.title}</Title>
      <div className="ao-home-wcard ao-home-spend">
        <Lines lines={HOME_SPEND.lines} x={20.6} tops={[20.7, 46.53]} />
        <Art name={HOME_SPEND.art} x={274.34} y={21.8} />
      </div>
      <Title top={1164.5}>{HOME_ASSET.title}</Title>
      <div className="ao-home-wcard ao-home-asset">
        <Lines lines={HOME_ASSET.lines} x={20} tops={[20.63, 46.63]} />
        <Art name={HOME_ASSET.art} x={275.59} y={19.3} />
        {HOME_ASSET.chips.map((row, r) => (
          <div key={r} className="ao-home-chips" style={{ top: 75.97 + r * 35 }}>
            {row.map((c) => (
              <button key={c} type="button" className="ao-home-chip">
                <b>#</b>
                {c}
              </button>
            ))}
          </div>
        ))}
      </div>
      <Title top={1437.5}>생활자산</Title>
      <div className="ao-home-life">
        {HOME_LIFE.map((c) => (
          <button key={c.title} type="button" className="ao-home-life__card" style={{ background: c.color }}>
            <span className="ao-home-abs ao-home-life__title">{c.title}</span>
            <svg className="ao-home-life__chev" width="4.67" height="8" viewBox="0 0 4.67 8" aria-hidden>
              <path d="M0.65 0.65L4 4L0.65 7.35" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {c.art ? (
              <Art name={c.art} x={51.19} y={75.06} />
            ) : (
              <span className="ao-home-art" style={{ left: 51.6, top: 75 }}>
                <ArtHealthTile />
              </span>
            )}
            {c.lines.map((l, i) => (
              <span key={l} className="ao-home-abs ao-home-life__line" style={{ top: 158.33 + i * 26 }}>
                {l}
              </span>
            ))}
          </button>
        ))}
      </div>
      <Title top={1743.67}>NH금융그룹</Title>
      {HOME_GROUP.map((g, i) => (
        <button
          key={g.title}
          type="button"
          className="ao-home-wcard ao-home-group"
          style={{
            left: i % 2 ? 202.5 : 20,
            top: GROUP_ROWS[Math.floor(i / 2)],
          }}
        >
          <span className="ao-home-abs ao-home-group__title">{g.title}</span>
          {g.lines.map((l, k) => (
            <span key={l} className="ao-home-abs ao-home-group__line" style={{ top: 40.07 + k * 19 }}>
              {l}
            </span>
          ))}
          <Art name={g.art} x={GROUP_ART[i][0]} y={GROUP_ART[i][1]} />
        </button>
      ))}
      <button type="button" className="ao-home-settings">
        <span>홈 화면 설정</span>
      </button>
    </div>
  );
});

// NH금융그룹 줄 위끝 (쪽 2332.6 / 2483.6 / 2634.7 − 550) · 아이콘 자리 (칸 기준)
const GROUP_ROWS = [1782.6, 1933.6, 2084.7];
const GROUP_ART: [number, number][] = [
  [115.64, 92.83],
  [115.82, 97.33],
  [115.89, 91.83],
  [117.07, 92.08],
  [116.64, 92.23],
  [115.82, 95.23],
];

function Title({ top, chevron, children }: { top: number; chevron?: boolean; children: string }) {
  return (
    <h2 className="ao-home-h" style={{ top }}>
      {children}
      {chevron && (
        <svg width="7" height="12.4" viewBox="0 0 7 12.4" aria-hidden style={{ marginLeft: 9.6 }}>
          <path d="M1 1l5 5.2-5 5.2" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </h2>
  );
}

function Lines({ lines, x, tops }: { lines: readonly string[]; x: number; tops: number[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <p key={l} className="ao-home-line" style={{ left: x, top: tops[i] }}>
          {l}
        </p>
      ))}
    </>
  );
}

// 카드 아래 광고 칸 (녹화의 공익 광고 대신 지어낸 NH 광고, 같은 자리)
function AdBlock() {
  return (
    <button type="button" className="ao-home-abs" style={{ left: 0, top: 0, width: 393, height: 96 }} aria-label={HOME_AD.title}>
      <span className="ao-home-abs ao-home-ad__brand">
        <AoNhSymbol color="#0b7a34" size={8.4} />
        {HOME_AD.brand}
      </span>
      <span className="ao-home-ad__pic">
        <ArtSavingAd />
      </span>
      <span className="ao-home-abs ao-home-ad__title">{HOME_AD.title}</span>
      <span className="ao-home-abs ao-home-ad__sub">{HOME_AD.sub}</span>
      <i className="ao-home-ad__info" />
    </button>
  );
}

// 오늘의 혜택 글줄 (§2.6): 2.5초마다 — 옛 글은 한 프레임에 사라지고, 그림이 +34ms 부터 150ms 동안 나타나고,
// 첫 글자는 +217ms, 그다음 띄어쓰기가 아닌 글자마다 67ms (글자는 25ms 동안 나타나므로 반쯤 보이는 때가 그 시각이 되게 12ms 앞당김)
const TICKER_ART: [number, number][] = [
  [46.71, 0.73],
  [44.46, 0.8],
  [43.96, 2.2],
];
function Ticker() {
  const active = useContext(LowerActive);
  const [state, setState] = useState({ i: 0, n: 0 });
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setState((s) => ({ i: (s.i + 1) % HOME_TICKER.length, n: s.n + 1 })), AO_TICKER.period);
    return () => window.clearInterval(t);
  }, [active]);
  const item = HOME_TICKER[state.i];
  const typing = state.n > 0;
  let k = 0;
  return (
    <div className="ao-home-ticker" key={state.n}>
      <span className={`ao-home-ticker__icon${typing ? "" : " ao-home-ticker__icon--still"}`}>
        <Art name={item.art} x={TICKER_ART[state.i][0]} y={TICKER_ART[state.i][1]} />
      </span>
      <span className="ao-home-ticker__text">
        {typing
          ? [...item.text].map((c, j) =>
              c === " " ? (
                " "
              ) : (
                <span
                  key={j}
                  style={{
                    animationDelay: `${AO_TICKER.firstChar - 12 + AO_TICKER.perChar * k++}ms`,
                  }}
                >
                  {c}
                </span>
              ),
            )
          : item.text}
      </span>
    </div>
  );
}

// 바로가기 4 × 2 (§2.7): 그림은 녹화 잉크 자리 그대로 (카드 기준), 글 가운데 x 52.2 / 135 / 219 / 301.5 (카드 기준)
const QUICK_X = [52.2, 135, 219, 301.5];
const QUICK_ART: [number, number][] = [
  [38.7, 21.68],
  [124.38, 20.18],
  [207.15, 20.18],
  [287.33, 18.68],
  [40.95, 100.93],
  [122.13, 100.68],
  [203.9, 105.68],
  [292.58, 106.68],
];
function Quick() {
  return (
    <div className="ao-home-wcard ao-home-quick">
      {HOME_QUICK.map((q, i) => {
        const left = QUICK_X[i % 4] - 41.5;
        const top = i < 4 ? 10 : 92;
        const [ax, ay] = QUICK_ART[i];
        return (
          <button key={q.label} type="button" className="ao-home-quick__btn" style={{ left, top }}>
            {q.art ? (
              <Art name={q.art} x={ax - left} y={ay - top} />
            ) : (
              <span className="ao-home-art" style={{ left: ax - left, top: ay - top }}>
                <ArtMenuSetting />
              </span>
            )}
            <span className="ao-home-quick__label" style={{ top: (i < 4 ? 55 : 137) - top }}>
              {q.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// 광고 넘기기 (§2.9): 4초마다 (지어낸 간격) 180ms ease-out 으로 옆으로, ❚❚ ↔ ▶, 손으로도 넘김
function Ads() {
  const active = useContext(LowerActive);
  const [paused, setPaused] = useState(false);
  const pager = useLoopPager({
    count: HOME_ADS.length,
    pitch: 393,
    snapMs: AO_ADS.slide,
    stepMs: AO_ADS.slide,
  });
  const { step } = pager;
  useEffect(() => {
    if (paused || !active) return;
    const t = window.setInterval(() => step(1), AO_ADS.interval);
    return () => window.clearInterval(t);
  }, [paused, active, step]);
  const n = HOME_ADS.length;
  return (
    <div className="ao-home-ads" {...pager.bind}>
      {visibleSlots(pager.pos, n).map((k) => {
        const s = HOME_ADS[mod(k, n)];
        return (
          <div key={k} className="ao-home-ads__slide" style={{ transform: `translateX(${(k - pager.pos) * 393}px)` }}>
            <p className="ao-home-abs ao-home-ads__sub">{s.sub}</p>
            <Lines lines={s.lines} x={40} tops={[47.33, 73.33]} />
            {s.art === "card" ? (
              <span className="ao-home-art" style={{ left: 266, top: 14 }}>
                <ArtCardAd />
              </span>
            ) : s.art === "steps" ? (
              <span className="ao-home-art" style={{ left: 266, top: 14 }}>
                <ArtStepsAd />
              </span>
            ) : (
              <Art name={s.art} x={271.37} y={22} />
            )}
          </div>
        );
      })}
      <div className="ao-home-pager ao-home-ads__pager">
        <button type="button" className="ao-home-pager__btn ao-home-pager__btn--prev" aria-label="이전 광고" onClick={() => step(-1)}>
          <PagerChevron dir={-1} />
        </button>
        <span className="ao-home-pager__num ao-home-pager__num--i">{pager.index + 1}</span>
        <i className="ao-home-pager__bar" />
        <span className="ao-home-pager__num ao-home-pager__num--n">{n}</span>
        <button type="button" className="ao-home-pager__btn ao-home-pager__btn--next" aria-label="다음 광고" onClick={() => step(1)}>
          <PagerChevron dir={1} />
        </button>
      </div>
      <button
        type="button"
        className={`ao-home-ads__pause${paused ? " ao-home-ads__pause--play" : ""}`}
        aria-label={paused ? "자동 넘기기 켜기" : "자동 넘기기 멈춤"}
        onClick={() => setPaused((p) => !p)}
      />
    </div>
  );
}

function PagerChevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="5" height="9.33" viewBox="0 0 5 9.33" aria-hidden style={{ overflow: "visible" }}>
      <path d={dir > 0 ? "M0.7 0.7L4.3 4.67L0.7 8.63" : "M4.3 0.7L0.7 4.67L4.3 8.63"} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
