// 보내는 중(S7) 동전 · 완료(S8) 체크 — 로티를 CSS/SVG 로 흉내 (transfer.md §2.9 · §3.3, 녹화 B 115.6–118.1). 움직임은 send.css
//  동전: 0.2초 빈자리 → 은빛 ₩ 원판이 튀어나옴 → 오른쪽으로 늘어나 날아감(주황 불꽃) → 파란 고리 사이로 돌아옴, ≈1.1초마다
//  체크: 0.2초 빈자리 → 은빛 물방울 → 뒤집힌 버섯 → 파랗게 + 체크 → 둥근 원판으로 출렁이며 멈춤 (650ms)
export function SendCoin() {
  return (
    <div className="toss-send-coin" aria-hidden>
      <i className="toss-send-coin__spark" />
      <i className="toss-send-coin__ring" />
      <i className="toss-send-coin__ring" />
      <div className="toss-send-coin__disc">
        <svg width="38" height="26" viewBox="0 0 38 26" fill="none" stroke="#56535f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4l6.5 18L19 6l7.5 16L33 4" />
          <path d="M3 12h32" strokeWidth="3.2" />
        </svg>
      </div>
    </div>
  );
}

export function SendCheck({ still }: { still?: boolean }) {
  return (
    <div className={`toss-send-check${still ? " toss-send-check--still" : ""}`} aria-hidden>
      <div className="toss-send-check__drop" />
      <svg width="68.4" height="68.4" viewBox="0 0 68.4 68.4" fill="none">
        <path d="M17.8 34.6 29.2 44l18.2-18.4" stroke="#ffffff" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
