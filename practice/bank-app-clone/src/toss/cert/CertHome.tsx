import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { tossDepth, useTossGo } from "../nav";
import { TossPage, TOSS_BG, TOSS_BG_DEEP } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { CERT_T } from "./data";
import { CertBar, CertLabel, CertSearchIcon, CertTitle } from "./parts";
import { useCertPhase, useCertRevisit } from "./steps";
import "./cert.css";

// '많이 찾아요' 3줄 (가운데 y 250.9 + 61.8k) — 둘째 줄(송금 확인증)만 다음 화면이 있음
const TOP = ["통장 사본 (계좌개설 확인증)", "송금 확인증 (계좌이체 확인증)", "거래내역서"];
const TRANSFER = "송금 확인증 (계좌이체 확인증)";
// '증명서 전체보기' 묶음. 통장·예적금 앞 6줄은 녹화, 그 아래와 대출 · 카드 · 세금은 지어낸 것 (cert.md §5.1). 모두 누름 표시만, 송금 확인증만 열림
const GROUPS: { title: string; items: string[] }[] = [
  { title: "통장·예적금", items: ["잔액 증명서", "통장 사본 (계좌개설 확인증)", "거래내역서", TRANSFER, "해외 송금 확인증", "자동이체 확인증", "예적금 해지 확인증"] },
  { title: "대출", items: ["부채 증명서", "대출 거래내역서", "이자 납입 증명서", "대출 완제 증명서"] },
  { title: "카드", items: ["체크카드 이용내역서"] },
  { title: "세금", items: ["이자소득 원천징수영수증", "연말정산용 증명서"] },
];
// 본문 좌표 (화면 y − 81.6)
const CARD1_TOP = 80.8; // 162.4
const CARD2_TOP = 393.6; // 475.2
const ITEM_H = 54.88;
const ITEM0 = 57.36; // 카드 위 → 첫 줄 위 (첫 잉크 가운데 560)
const cardH = (n: number) => ITEM0 + n * ITEM_H + 14.08; // 마지막 잉크 가운데 → 카드 아래 41.6 (첫 카드와 같게)
const CARD_GAP = 16;
// 카드 자리 (바뀌지 않음)
const CARDS = GROUPS.reduce<{ title: string; items: string[]; top: number }[]>((out, g) => {
  const prev = out.at(-1);
  out.push({ ...g, top: prev ? prev.top + cardH(prev.items.length) + CARD_GAP : CARD2_TOP });
  return out;
}, []);
const HEIGHT = CARDS.at(-1)!.top + cardH(CARDS.at(-1)!.items.length) + 24;
const PRESS = "rgba(255,255,255,0.045)"; // #171619 카드 위 ≈ #212023

// /cert — H 토스뱅크 증명서 발급하기 (cert.md §2.1, 녹화 A 62.677). 바탕 · 머리줄 #100f12, 상태바 띠 #171619, 카드 #171619.
// 녹화의 웹뷰 버릇(+53.6dp 아래 그렸다가 한 프레임에 올라감)은 따라 하지 않음: 빈 화면 250ms → 내용 (첫 카드 줄은 +130ms), 진행 막대.
// 뒤로 와서 다시 보일 땐 기다림 없이 끝 모습 (POP, 녹화 100.41)
export function CertHome() {
  const go = useTossGo();
  const location = useLocation();
  const { revisit, savedScroll, saveScroll } = useCertRevisit();
  const phase = useCertPhase([CERT_T.homeContent, CERT_T.homeContent + CERT_T.homeRows], true, revisit);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (revisit && body.current) body.current.scrollTop = savedScroll;
  }, [revisit, savedScroll]);
  // 송금 확인증 → I (push). 전체 메뉴처럼 certDepth 없이 들어왔어도 '확인했어요'가 들어온 화면으로 돌아가게 여기를 1로 셈
  const openTransfer = () => go("/cert/transfer", { state: { certDepth: (tossDepth(location.state, "certDepth") || 1) + 1 } });


  return (
    <TossPage
      className="toss-cert-home"
      bg={TOSS_BG_DEEP}
      band={TOSS_BG}
      bodyRef={body}
      onScroll={(e) => saveScroll(e.currentTarget.scrollTop)}
      header={
        <CertBar
          bg={TOSS_BG_DEEP}
          right={
            phase >= 1 && (
              <TossPressable className="toss-cert-home__search" radius={22} inset={-10} ariaLabel="검색">
                <CertSearchIcon />
              </TossPressable>
            )
          }
          progress={<TossProgressBar ready={phase >= 1} />}
        />
      }
    >
      {phase >= 1 && (
        <div className="toss-cert-c" style={{ height: HEIGHT }}>
          <CertTitle>토스뱅크 증명서 발급하기</CertTitle>
          <div className="toss-cert-card" style={{ top: CARD1_TOP, height: 255.2 }}>
            <p className="toss-cert-t toss-cert-card__label">많이 찾아요</p>
            {phase >= 2 &&
              TOP.map((label, i) => (
                <TossPressable
                  key={label}
                  className="toss-cert-home__top"
                  style={{ top: 57.6 + 61.8 * i }}
                  inset="0.4px 3.2px"
                  radius={10}
                  color={PRESS}
                  fadeIn={100}
                  fadeOut={120}
                  onPress={label === TRANSFER ? openTransfer : undefined}
                >
                  <span className="toss-cert-home__rank">{i + 1}</span>
                  <p className="toss-cert-t toss-cert-narrow toss-cert-home__toplabel">
                    <CertLabel text={label} />
                  </p>
                </TossPressable>
              ))}
          </div>
          <p className="toss-cert-t toss-cert-narrow toss-cert-home__sec">증명서 전체보기</p>
          {CARDS.map((c) => (
            <div key={c.title} className="toss-cert-card" style={{ top: c.top, height: cardH(c.items.length) }}>
              <p className="toss-cert-t toss-cert-card__label toss-cert-card__group">
                {c.title.split("·").map((w, i) => (
                  <span key={w}>
                    {i > 0 && <span className="toss-cert-card__dot">·</span>}
                    {w}
                  </span>
                ))}
              </p>
              {c.items.map((label, i) => (
                <TossPressable
                  key={label}
                  className="toss-cert-home__item"
                  style={{ top: ITEM0 + ITEM_H * i }}
                  inset="0.4px 3.2px"
                  radius={10}
                  color={PRESS}
                  fadeIn={100}
                  fadeOut={120}
                  onPress={label === TRANSFER ? openTransfer : undefined}
                >
                  <p className="toss-cert-t toss-cert-narrow toss-cert-home__itemlabel">
                    <CertLabel text={label} />
                  </p>
                </TossPressable>
              ))}
            </div>
          ))}
        </div>
      )}
    </TossPage>
  );
}
