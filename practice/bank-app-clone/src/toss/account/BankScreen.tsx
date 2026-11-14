import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import { useLayerActive } from "../../platform/LayerContext";
import type { TossAccount, TossHomeData, TossTransaction } from "../api";
import { useTossFlow } from "../flow";
import { md, num, signedWon } from "../format";
import { useTossGo } from "../nav";
import { tossToastReady } from "../toast";
import { TossAppBar } from "../ui/AppBar";
import { GearIcon } from "../ui/icons";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { TossRedirect } from "../ui/Redirect";
import { TossSkeleton } from "../ui/Skeleton";
import { TossSymbol } from "../ui/TossSymbol";
import { BankBanner } from "./BankBanner";
import { useBankBanner } from "./banner";
import { ACCT_INFO, ACCT_MENU, ACCT_RECO, type AcctMenuSection } from "./menu";
import { AcctAdLogo, AcctBolt, AcctButton, AcctChevron, AcctChevronDown, AcctPic, AcctRow } from "./parts";
import { acctInterest, ACCT_BANK, useAcctPhases, useAcctRevisit } from "./timeline";
import "./account.css";

// /bank/:accountId — 토스뱅크 통장 (account.md §2.2–2.4, 녹화 A 18.9–45.3초 · B 0–6.9초).
// 한 화면: 머리줄(투명 + 뒤 흐림, 스크롤하면 가운데 제목) · 배너 · 통장 카드(이름 · 계좌 · 잔액 · 이자 · 최근 3건 · 채우기/보내기) ·
// 체크카드/비상금/자동이체 · 추천 · 광고 · 새 예금 · 긴 상품 메뉴 · 유용한 정보.
// 들어올 때 웹뷰처럼 단계별로 그려짐 (ACCT_BANK.steps: 뼈대 → 잔액 → 목록 뼈대 → 이자 줄 → 전부 → 배너). 잔액이 그려지면 tossToastReady()
// 누르면 되는 것: 잔액 · 최근 거래 → 거래내역, 보내기 → 송금, 배너 × · 더 보기 1/2. 나머지는 누름 표시만 (plan.md §1.6)
export function BankScreen() {
  const { accountId = "main" } = useParams();
  const go = useTossGo();
  const { goSend } = useTossFlow();
  const active = useLayerActive();

  const account = useApi<TossAccount>(paths.account(accountId));
  const txs = useApi<TossTransaction[]>(paths.transactions(accountId));
  const home = useApi<TossHomeData>(paths.home);
  const ready = account.status === "done" && txs.status === "done";
  const failed = !ready && (account.status === "error" || txs.status === "error");
  const { revisit, key, bodyRef, savedScroll, saveScroll } = useAcctRevisit();
  const { phase, barReady } = useAcctPhases(ready, ACCT_BANK, revisit);

  // 잔액이 보이면 토스트("토스뱅크로 이동했어요")가 나갈 수 있음 (실패해도 붙잡지 않게)
  useEffect(() => {
    if (phase >= 2 || failed) tossToastReady();
  }, [phase, failed]);

  const banner = useBankBanner(key, phase >= 5);

  // 머리줄 가운데 제목: 이자 줄이 머리줄 밑으로 다 들어가면 나타남 (배너가 있으면 그만큼 더)
  const threshold = ACCT_BANK.titleAt + (banner.shown ? ACCT_BANK.bannerH : 0);
  const [titleOn, setTitleOn] = useState(() => savedScroll > threshold);
  const thresholdRef = useRef(threshold);
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);
  const onScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const st = e.currentTarget.scrollTop;
      setTitleOn(st > thresholdRef.current);
      saveScroll(st);
    },
    [saveScroll],
  );

  const [recoPage, setRecoPage] = useState(0);
  const toHistory = () => go(`/bank/${encodeURIComponent(accountId)}/history`);

  const a = account.data;
  const list = txs.data ?? [];
  const recent = list.slice(0, 3);
  const assetCount = home.data?.accounts.filter((x) => x.bank.code === "toss").length;
  const name = a?.label ?? "토스뱅크 통장";

  const header = (
    <TossAppBar
      mode="blur"
      center
      titleVisible={titleOn && phase >= 5}
      className="toss-acct-bank__bar"
      title={
        <span className="toss-acct-bank__bartitle">
          {name}
          <AcctChevronDown className="toss-acct-bank__barchev" w={8} h={4.8} />
        </span>
      }
      right={
        phase >= 5 ? (
          <TossPressable className="toss-acct-bank__gear" radius={24} ariaLabel="설정">
            <GearIcon size={24.4} stroke={1.5} color="#cecdd2" />
          </TossPressable>
        ) : undefined
      }
      progress={<TossProgressBar ready={barReady || failed} />}
    />
  );

  // 다른 은행 계좌를 이 주소로 바로 열었음 → 다른 은행 계좌 화면
  if (a && a.bank.code !== "toss") return <TossRedirect to={`/account/${encodeURIComponent(accountId)}`} />;
  return (
    <TossPage className="toss-acct-bank" header={header} headerOverlay onScroll={onScroll} bodyRef={bodyRef} bodyClassName="toss-acct-bank__body">
      <div className="toss-acct-bank__top" />
      {banner.variant && <BankBanner banner={banner} active={active} />}
      <div className={`toss-acct-sheet${banner.shown ? " toss-acct-sheet--cap" : ""}`}>
        {failed && (
          <TossPressable className="toss-acct-fail" onPress={() => (account.status === "error" ? account.retry() : txs.retry())}>
            {account.error?.status === 404 ? "계좌를 찾을 수 없어요" : "잠시 후 다시 시도해 주세요"}
          </TossPressable>
        )}
        {phase >= 1 && (
          <>
            {/* 이름 줄 (93.6–123.2) + 아래 선 133.6 */}
            <div className="toss-acct-title">
              <span className="toss-acct-title__tile">
                <TossSymbol size={19.5} />
              </span>
              <span className="toss-acct-title__name">{name}</span>
              {phase >= 5 && assetCount !== undefined ? (
                <TossPressable className="toss-acct-title__assets" radius={8} inset="-6px -6px">
                  내 자산 {assetCount}개
                  <AcctChevronDown className="toss-acct-title__assetschev" />
                </TossPressable>
              ) : (
                phase >= 3 && <TossSkeleton className="toss-acct-title__skel" w={80} h={14} r={7} />
              )}
            </div>
            {/* 계좌 · 잔액 (누르면 거래내역) */}
            <AcctRow className="toss-acct-balance" onPress={phase >= 5 ? toHistory : undefined} inset="0 8px" ariaLabel="거래내역">
              {phase >= 2 && a && (
                <>
                  <span className="toss-acct-balance__acct">
                    {a.bank.name} {a.number}
                  </span>
                  <span className="toss-acct-balance__amt">{num(a.balance)}원</span>
                  <AcctChevron className="toss-acct-balance__chev" color="#67666b" />
                </>
              )}
            </AcctRow>
            {/* 어제까지 쌓인 이자 (4단계에 끼어들며 아래를 밀어냄) */}
            {phase >= 4 && a && (
              <AcctRow className="toss-acct-interest" inset="0 4px" ariaLabel="어제까지 쌓인 이자">
                <AcctBolt className="toss-acct-interest__icon" />
                <span className="toss-acct-interest__cap">어제까지 쌓인 이자</span>
                <span className="toss-acct-interest__amt">{num(acctInterest(a.balance))}원</span>
                <AcctChevron className="toss-acct-interest__chev" color="#69686d" />
              </AcctRow>
            )}
            {/* 최근 3건 */}
            <div className={`toss-acct-mini${phase >= 3 ? " toss-acct-mini--full" : ""}`}>
              {phase >= 5 ? (
                recent.length ? (
                  recent.map((t, i) => (
                    <AcctRow key={t.id} className="toss-acct-mini__row" onPress={toHistory} inset="1px 3.2px" radius={10} color="rgba(255,255,255,0.055)">
                      <span className="toss-acct-mini__date">{i === 0 || recent[i - 1].date !== t.date ? md(t.at) : ""}</span>
                      <span className="toss-acct-mini__name">{t.merchant}</span>
                      <span className={`toss-acct-mini__amt${t.amount > 0 ? " toss-acct-mini__amt--in" : ""}`}>{signedWon(t.amount)}</span>
                    </AcctRow>
                  ))
                ) : (
                  <div className="toss-acct-mini__empty">아직 거래내역이 없어요</div>
                )
              ) : (
                phase >= 3 &&
                [0, 1, 2].map((i) => (
                  <div key={i} className="toss-acct-mini__skel">
                    <TossSkeleton w={24} h={12} r={6} />
                    <TossSkeleton w={80} h={14} r={7} />
                    <TossSkeleton className="toss-acct-skel-fade" w={60} h={14} r={7} />
                  </div>
                ))
              )}
            </div>
            {/* 채우기 / 보내기 + 아래 선 */}
            <div className="toss-acct-btns">
              <AcctButton className="toss-acct-btns__btn">채우기</AcctButton>
              <AcctButton className="toss-acct-btns__btn" onPress={() => goSend({ from: accountId })}>
                보내기
              </AcctButton>
            </div>
            {/* 체크카드 · 비상금 · 자동이체 */}
            <div className="toss-acct-tiles">
              {phase >= 5
                ? (
                    [
                      ["checkcard", "체크카드", ""],
                      ["emergency", "비상금", "보관하기"],
                      ["autotransfer", "자동이체", "등록하기"],
                    ] as const
                  ).map(([tile, title, right]) => (
                    <AcctRow key={tile} className="toss-acct-tilerow" inset="0 8px">
                      <AcctPic className="toss-acct-tilerow__tile" name={`tile-${tile}`} w={32} />
                      <span className="toss-acct-tilerow__title">{title}</span>
                      {right && <span className="toss-acct-tilerow__right">{right}</span>}
                      <AcctChevron className="toss-acct-tilerow__chev" />
                    </AcctRow>
                  ))
                : phase >= 3 &&
                  [0, 1, 2].map((i) => (
                    <div key={i} className="toss-acct-tilerow toss-acct-tilerow--skel">
                      <TossSkeleton className="toss-acct-tilerow__sktile" w={29.6} h={29.6} r={9} />
                      <TossSkeleton className="toss-acct-tilerow__skbar" w={100} h={17} r={8} />
                      <TossSkeleton className="toss-acct-tilerow__skright toss-acct-skel-fade" w={56} h={14} r={7} />
                    </div>
                  ))}
            </div>
            <div className="toss-acct-band" />
            {/* 추천 (1/2 ↔ 2/2) */}
            <div className="toss-acct-reco">
              {phase >= 5 ? (
                <>
                  <span className="toss-acct-reco__cap">추천</span>
                  {ACCT_RECO[recoPage].map((x, i) => (
                    <AcctRow key={`${recoPage}-${i}`} className={`toss-acct-reco__row${x.caption ? " toss-acct-reco__row--two" : ""}`} inset="0 8px">
                      {x.tile ? (
                        <AcctPic className="toss-acct-reco__tile" name={`tile-${x.tile}`} w={32} />
                      ) : (
                        <span className="toss-acct-reco__tile toss-acct-reco__tile--css">
                          <AcctPic name={`m-${x.menu}`} w={24} />
                        </span>
                      )}
                      {x.caption && <span className="toss-acct-reco__sub">{x.caption}</span>}
                      <span className="toss-acct-reco__title">{x.title}</span>
                      <AcctChevron className="toss-acct-reco__chev" />
                    </AcctRow>
                  ))}
                  <TossPressable className="toss-acct-reco__more" radius={10} inset="2px 0" onPress={() => setRecoPage((p) => (p + 1) % ACCT_RECO.length)}>
                    더 보기 <span>{recoPage + 1}/2</span>
                  </TossPressable>
                </>
              ) : (
                <>
                  <TossSkeleton className="toss-acct-reco__skcap" w={30} h={16} r={6} />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="toss-acct-reco__skrow" style={{ top: [64, 108.8, 154.4, 200.8][i] }}>
                      <TossSkeleton w={28.8} h={28.8} r={9} />
                      <TossSkeleton w={156} h={18} r={8} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
        {phase >= 5 && (
          <>
            <div className="toss-acct-band" />
            {/* 광고 (지어낸 광고 · 로고) */}
            <AcctRow className="toss-acct-ad" inset="0 8px">
              <AcctAdLogo className="toss-acct-ad__logo" kind="letter" size={36.8} />
              <span className="toss-acct-ad__title">샘플마켓 가을 세일</span>
              <span className="toss-acct-ad__sub">이번 주까지 최대 40% 할인 • AD</span>
            </AcctRow>
            {/* 새로운 예금 */}
            <AcctRow className="toss-acct-promo" inset="0 8px">
              <AcctPic className="toss-acct-promo__tile" name="promo" w={97.5} h={98.5} />
              <span className="toss-acct-promo__title">새로운 예금이 나왔어요</span>
              <span className="toss-acct-promo__body">1년 보관하면 연 3.8% 받아요. (세전)</span>
              <span className="toss-acct-promo__link">
                더보기 <AcctChevron w={4} h={7.2} s={1.4} color="currentColor" />
              </span>
            </AcctRow>
            {ACCT_MENU.map((s) => (
              <MenuSection key={s.title} s={s} />
            ))}
            {/* 유용한 정보 */}
            <section className="toss-acct-sec toss-acct-info">
              <div className="toss-acct-sec__head">
                <h2 className="toss-acct-sec__title">유용한 정보</h2>
                <AcctButton className="toss-acct-info__more">더보기</AcctButton>
              </div>
              {ACCT_INFO.map((x) => (
                <AcctRow key={x.thumb} className="toss-acct-info__row" inset="0 8px">
                  <AcctPic className="toss-acct-info__thumb" name={x.thumb} w={60.8} h={57.5} />
                  <span className="toss-acct-info__title">{x.title}</span>
                </AcctRow>
              ))}
            </section>
            <AcctRow className="toss-acct-foot toss-acct-foot--easy" inset="0 8px">
              <AcctPic className="toss-acct-foot__icon" name="m-easy-home-T" w={32} />
              <span className="toss-acct-foot__cap">큰 글씨로 보고싶다면</span>
              <span className="toss-acct-foot__title">간편홈 보기</span>
            </AcctRow>
            <AcctRow className="toss-acct-foot toss-acct-foot--voice" inset="0 8px">
              <AcctPic className="toss-acct-foot__icon" name="m-feedback-mailbox" w={32} />
              <span className="toss-acct-foot__cap">의견을 알려주세요</span>
              <span className="toss-acct-foot__title">바뀐 토스뱅크 화면, 어떠셨나요?</span>
            </AcctRow>
            <div className="toss-acct-bank__end" />
          </>
        )}
      </div>
    </TossPage>
  );
}

function MenuSection({ s }: { s: AcctMenuSection }) {
  return (
    <section className={`toss-acct-sec${s.sub ? " toss-acct-sec--sub" : ""}`}>
      <div className="toss-acct-sec__head">
        <h2 className="toss-acct-sec__title">{s.title}</h2>
        {s.caption && <span className="toss-acct-sec__cap">{s.caption}</span>}
      </div>
      {s.rows.map((x) => (
        <AcctRow key={x.icon} className={`toss-acct-prod${x.sub ? " toss-acct-prod--two" : ""}`} inset="0 8px">
          <AcctPic className="toss-acct-prod__icon" name={`m-${x.icon}`} w={32} />
          <span className="toss-acct-prod__title">{x.title}</span>
          {x.right &&
            (x.tone === "pill" ? (
              <span className="toss-acct-prod__pill">{x.right}</span>
            ) : (
              <span className={`toss-acct-prod__right${x.tone === "grey" ? " toss-acct-prod__right--grey" : ""}`}>
                {x.right}
                {x.sub && <span className="toss-acct-prod__sub">{x.sub}</span>}
              </span>
            ))}
        </AcctRow>
      ))}
    </section>
  );
}
