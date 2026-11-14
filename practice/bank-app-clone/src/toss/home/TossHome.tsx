// '/' — 토스 홈 (home.md §2.3–§2.5 · §3, 녹화 A 10.40–13.65 · B 136.05–152.03). 바탕 #100f12, 머리줄(28–84) 고정, 탭바(780–) 고정.
// 위에서부터: 리워드 배너(× 로 닫힘) · 계좌 카드(토스뱅크 통장 · 토스머니 · 포인트 + 모두 보기) · 소비 카드({M}월에 쓴 돈 · {D}일 낼 카드값) ·
// 최근 본 상품 카드 · 광고 카드 · 반쪽 카드 둘 · 목록 카드 · (녹화 밖, 지어냄) 목록 카드 + 화면 편집하기.
// 줄을 누르면 카드 폭 전체 #2a2b30 (작은 버튼은 #3b3c41), 손 떼면 170ms 에 사라지고 120ms 뒤 이동 (useTossGo).
// 다른 화면에서 돌아오면 바뀐 금액만 숫자 굴림 (boot.ts useRollValue). 시작화면에서 넘어오면 300ms 교차 + 포인트 줄 펼침.
// 데이터: GET /api/home (accounts · toss 블록). 녹화에 있던 개인 기록(본 상품 · 방문 서비스 · 광고 문구)은 지어낸 예시로 바꿈.
// 성인 계정 예시: 소비 카드 둘째 줄 = 신용카드 카드값, 반쪽 카드 왼쪽 = 대출 비교 (SOLUTION 27장 '성인 계정') — 자리 · 글자 크기는 녹화 그대로
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { paths } from "../../api/endpoints";
import { prefetch, useApi } from "../../api/useApi";
import { localAsset } from "../../assets/Asset";
import { DevPanel } from "../../dev-panel/DevPanel";
import { currentProfileId } from "../../profile/session";
import { tossApi, tossPaths, type TossHomeData } from "../api";
import { useTossFlow } from "../flow";
import { showTossWaitBox } from "../loading";
import { useTossBackStep, useTossGo } from "../nav";
import { TossOdometer } from "../ui/Odometer";
import { TossPage, TOSS_BG_DEEP } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { useTossPageRoot } from "../ui/shared";
import { TossSymbol } from "../ui/TossSymbol";
import { clearSplashHandoff, HOME_BOOT, isSplashHandoff, useHomeMounted, useRollValue } from "./boot";
import {
  AdThumb,
  Bell,
  FaceId,
  GaugeIcon,
  GREY_MARK_FILTER,
  GreyMarkFilter,
  HeadChevron,
  LoanArt,
  PayBrackets,
  PlusSquircle,
  PointIcon,
  RowChevron,
  ShopThumb,
  SmallClose,
  SnackThumb,
} from "./icons";
import { TabBar } from "./TabBar";
import { SplashLogo } from "./TossSplash";
import "./home.css";

const ROW_PRESS = "#2a2b30";
// '모두 보기' 누름: 가운데가 밝은 가로 띠 (B 151.10 평균: 가운데 (43, 42, 45) → 가장자리 (30, 29, 32))
const FOOT_PRESS = "linear-gradient(90deg, #1e1d20, #2a292c 48%, #1e1d20)";
// 숫자 굴림: 맨 왼쪽 자리가 +355ms, 맨 오른쪽이 +520ms 에 멈춤 (B 149.445–149.97, 자리마다 ≈55ms)
const ROLL = { duration: 520, stagger: 55 };
const noop = () => {};

// 이름 세 글자면 성을 뺀 이름 (plan.md §2.2)
const givenName = (n: string) => (n.length === 3 ? n.slice(1) : n);
const monthOf = (ym: string | undefined) => Number((ym ?? "").split("-")[1]) || new Date().getMonth() + 1;
// 가운뎃점: 토스 글꼴의 '·' 는 양옆이 조금 더 넓음 (녹화 '송금·결제')
const dotted = (text: string) =>
  text.split("·").flatMap((part, i) => (i ? [<span key={i} className="toss-home-dot">·</span>, part] : [part]));
// 신용카드 다음 결제일 → '{D}일 낼 카드값' (결제일을 모르면 '낼 카드값')
const billLabel = (dueDate: string | null) => (dueDate ? `${Number(dueDate.slice(8, 10))}일 낼 카드값` : "낼 카드값");

export function TossHome() {
  const q = useApi<TossHomeData>(paths.home);
  const data = q.data;
  const t = data?.toss;
  const { goBank, goSend } = useTossFlow();
  const go = useTossGo();
  const [boot] = useState(isSplashHandoff);
  useEffect(clearSplashHandoff, []);
  useHomeMounted();
  const [panel, setPanel] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const main = data?.accounts.find((a) => a.id === "main") ?? data?.accounts.find((a) => a.kind === "main");
  const money = data?.accounts.find((a) => a.role === "money");
  const reward = t?.reward;
  const banner = useBanner(reward);
  const name = data?.profile.userName ?? "";
  const spendMonth = monthOf(t?.spend?.month ?? reward?.month);

  // 계좌 · 카드 · 포인트 모두 보기 → 자산 (자산 데이터를 미리 받고, 300ms 넘게 걸리면 '잠시만 기다려주세요.')
  const toAssets = () => {
    const t0 = performance.now();
    const hide = showTossWaitBox(300);
    prefetch(tossPaths.assets).finally(() => {
      const wait = Math.max(0, 120 - (performance.now() - t0));
      if (!go("/assets", { delay: wait })) return hide();
      window.setTimeout(hide, wait);
    });
  };

  return (
    <>
      <TossPage
        bg={TOSS_BG_DEEP}
        className="toss-home"
        bodyClassName="toss-home__body"
        header={<Header scrolled={scrolled} onTitle={() => goBank("main", { toast: true })} onBell={() => setPanel(true)} />}
        dock={<TabBar />}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
      >
        <div className="toss-home__col">
          {q.status === "error" && !data ? (
            <div className="toss-home-card toss-home-err">
              <span>잠시 후 다시 시도해 주세요</span>
              <TossPressable className="toss-home-err__btn" radius={8} onPress={q.retry}>
                다시 시도
              </TossPressable>
            </div>
          ) : (
            <>
              {banner.data && banner.show && <RewardBanner month={banner.data.month} max={banner.data.max} name={givenName(name)} closing={banner.closing} onClose={banner.close} onClosed={banner.closed} />}
              <div className="toss-home-card toss-home-acc">
                <AccountRow
                  icon={<AccIcon />}
                  amount={<Amount id="main" value={main?.balance} />}
                  label="토스뱅크 통장"
                  btn="송금"
                  onPress={() => goBank("main", { toast: true })}
                  onBtn={() => goSend({ from: "main", toastFromHome: true })}
                />
                <AccountRow icon={<AccIcon />} amount={<Amount id="money" value={money?.balance} />} label="토스머니" btn="송금" />
                <AccountRow
                  icon={<PointIcon />}
                  amount={<Amount id="points" value={data ? (t?.pointChances ?? data.profile.pointChances ?? 0) : undefined} suffix="번" />}
                  label={dotted("송금·결제 후 받는 포인트")}
                  dim
                  btn="받기"
                  insert={boot}
                />
                <div className="toss-home-acc__div" />
                <TossPressable className="toss-home-acc__foot" color={FOOT_PRESS} inset="0 19.5px 0 20.5px" fadeIn={50} scale={0.97} onPress={toAssets}>
                  계좌<span className="toss-home-foot__d1"> · </span>카드<span className="toss-home-foot__d2"> · </span>포인트
                  <span className="toss-home-foot__w"> 모두 보기</span>
                </TossPressable>
              </div>
              <div className="toss-home-card toss-home-spend">
                <AccountRow
                  amount={<Amount id="spend" value={data ? (t?.spend?.total ?? data.monthlyCardSpend) : undefined} />}
                  label={`${spendMonth}월에 쓴 돈`}
                  variant="spend"
                  btn="내역"
                  onPress={() => go("/spend")}
                  onBtn={() => go("/spend")}
                />
                {t?.cardBill && <AccountRow amount={<Amount id="bill" value={t.cardBill.amount} />} label={billLabel(t.cardBill.dueDate)} variant="bill" btn="내역" />}
              </div>
              <RecentCard />
              <AdCard />
              <HalfCards />
              <LinksCard />
              <MoreCard />
              <TossPressable className="toss-home-edit" color="transparent" scale={0.97} onPress={noop}>
                화면 편집하기
              </TossPressable>
            </>
          )}
        </div>
        <PanelMount open={panel} onClose={() => setPanel(false)} />
      </TossPage>
      {boot && <SplashFade />}
    </>
  );
}

// 시작화면 그림을 덮었다 300ms 에 걷음 (= 교차). 홈 층 맨 위 (상태바 · 내비 띠는 그 위)
function SplashFade() {
  const [on, setOn] = useState(true);
  if (!on) return null;
  return (
    <div className="toss-home-xfade" onAnimationEnd={(e) => e.animationName === "toss-home-xfade" && setOn(false)}>
      <SplashLogo />
    </div>
  );
}

// ---------- 머리줄 ----------
function Header({ scrolled, onTitle, onBell }: { scrolled: boolean; onTitle: () => void; onBell: () => void }) {
  return (
    <div className={`toss-home-head${scrolled ? " toss-home-head--line" : ""}`}>
      <TossPressable className="toss-home-head__title" radius={10} color="rgba(255,255,255,0.06)" onPress={onTitle} ariaLabel="토스뱅크">
        <GreyMarkFilter />
        <TossSymbol height={18.7} className="toss-home-head__logo" style={{ filter: `url(#${GREY_MARK_FILTER})` }} />
        <span className="toss-home-head__name">토스뱅크</span>
        <HeadChevron />
      </TossPressable>
      <TossPressable className="toss-home-pay" radius={10} color="rgba(255,255,255,0.06)" onPress={noop} ariaLabel="Pay">
        <PayBrackets />
        <span className="toss-home-pay__t">Pay</span>
      </TossPressable>
      <TossPressable className="toss-home-bellbtn" radius={18} color="rgba(255,255,255,0.06)" onPress={onBell} ariaLabel="관리 패널">
        <Bell dot />
      </TossPressable>
    </div>
  );
}

// ---------- 리워드 배너 (× → 120ms 흐려지고 칸이 300ms 에 접힘, 이번 달은 다시 안 보임) ----------
// 닫는 동안은 서버 값(rewardDismissed)이 먼저 바뀌어도 움직임이 끝날 때까지 그대로 그림. 🔔 '다시 보이기' 로 풀리면 다시 나타남
type Reward = NonNullable<TossHomeData["toss"]>["reward"];
function useBanner(reward: Reward | undefined) {
  const [held, setHeld] = useState<{ month: string; max: number; closing: boolean } | null>(null);
  const [ack, setAck] = useState(false);
  const dismissed = !!reward?.dismissed;
  if (held && !held.closing && dismissed && !ack) setAck(true);
  if (held && !held.closing && ack && !dismissed) {
    setHeld(null);
    setAck(false);
  }
  const live = reward && reward.max != null && !reward.dismissed ? { month: reward.month, max: reward.max } : null;
  return {
    data: held ?? live,
    show: held ? held.closing : !!live,
    closing: !!held?.closing,
    close: () => {
      if (!live || held) return;
      setHeld({ ...live, closing: true });
      tossApi.updateProfile({ rewardDismissed: live.month }).catch(() => {});
    },
    closed: () => setHeld((h) => (h ? { ...h, closing: false } : h)),
  };
}

function RewardBanner({ month, max, name, closing, onClose, onClosed }: { month: string; max: number; name: string; closing: boolean; onClose: () => void; onClosed: () => void }) {
  return (
    <div className={`toss-home-bslot${closing ? " toss-home-bslot--closing" : ""}`} onAnimationEnd={(e) => e.animationName === "toss-home-bslot-close" && onClosed()}>
      <TossPressable className="toss-home-banner" color="rgba(255,255,255,0.04)" onPress={noop}>
        <FaceId />
        <span className="toss-home-banner__l1">
          {name}님의 {monthOf(month)}월 최대 적립금
        </span>
        <span className="toss-home-banner__l2">{max.toLocaleString("ko-KR")}원</span>
        <TossPressable className="toss-home-banner__btn" color="rgba(0,0,0,0.12)" scale={0.97} onPress={noop}>
          확인하기
        </TossPressable>
      </TossPressable>
      <TossPressable className="toss-home-banner__x" radius={12.1} color="rgba(255,255,255,0.1)" onPress={onClose} ariaLabel="닫기">
        <SmallClose />
      </TossPressable>
    </div>
  );
}

// ---------- 줄 ----------
function AccIcon() {
  return (
    <span className="toss-home-acc-ic">
      <TossSymbol height={16.6} />
    </span>
  );
}

// 금액 (바뀐 자리만 굴림). 아직 데이터가 없으면 회색 막대
function Amount({ id, value, suffix = "원" }: { id: string; value: number | undefined; suffix?: string }) {
  const shown = useRollValue(`home:${id}`, value);
  if (shown === undefined) return <span className="toss-home-skel" />;
  return <TossOdometer id={`toss-home:${currentProfileId() ?? ""}:${id}`} value={shown} suffix={suffix} {...ROLL} />;
}

function AccountRow({
  icon,
  amount,
  label,
  btn,
  dim,
  variant,
  insert,
  onPress = noop,
  onBtn = noop,
}: {
  icon?: ReactNode;
  amount: ReactNode;
  label: ReactNode;
  btn: string;
  dim?: boolean;
  variant?: "spend" | "bill";
  insert?: boolean;
  onPress?: () => void;
  onBtn?: () => void;
}) {
  const left = variant === "spend";
  return (
    <TossPressable
      className={`toss-home-row${insert ? " toss-home-row--insert" : ""}`}
      style={insert ? { animationDelay: `${HOME_BOOT.pointsAt}ms` } : undefined}
      color={ROW_PRESS}
      pressedClassName="toss-home-row--on"
      onPress={onPress}
    >
      {icon}
      <span className={`toss-home-row__amt${left ? " toss-home-row__amt--left" : variant === "bill" ? " toss-home-row__amt--bill" : ""}`}>{amount}</span>
      <span
        className={`toss-home-row__lbl${dim ? " toss-home-row__lbl--dim" : ""}${left ? " toss-home-row__lbl--left" : variant === "bill" ? " toss-home-row__lbl--bill" : ""}`}
      >
        {label}
      </span>
      <TossPressable className="toss-home-sbtn" color="transparent" scale={0.96} onPress={onBtn}>
        {btn}
      </TossPressable>
    </TossPressable>
  );
}

// 카드 3: 최근 본 상품 · 방문한 서비스 · 오늘의 딜 (모두 누름만)
function RecentCard() {
  const deal = localAsset("toss-home-deal");
  const rows: [string, string, ReactNode][] = [
    ["최근 본 상품", "바삭 감자칩 오리지널 3봉, 오늘만 특가 모음", <SnackThumb key="t" />],
    ["방문한 서비스", "토스쇼핑", <ShopThumb key="t" />],
  ];
  return (
    <div className="toss-home-card toss-home-c3">
      {rows.map(([title, sub, thumb]) => (
        <C3Row key={title} title={title} sub={sub} thumb={thumb} />
      ))}
      <div className="toss-home-c3__div" />
      <C3Row title="오늘의 딜" sub="최대 1만원 꽝 없는 쿠폰 뽑기" thumb={deal ? <img className="toss-home-deal" src={deal} alt="" draggable={false} /> : null} />
    </div>
  );
}
function C3Row({ title, sub, thumb }: { title: string; sub: string; thumb: ReactNode }) {
  return (
    <TossPressable className="toss-home-c3row" color={ROW_PRESS} onPress={noop}>
      <span className="toss-home-c3row__t">{title}</span>
      <span className="toss-home-c3row__s">{sub}</span>
      {thumb}
      <RowChevron />
    </TossPressable>
  );
}

// 카드 4: 광고 (문구 · 광고주는 지어냄 — plan.md Q7)
function AdCard() {
  return (
    <TossPressable className="toss-home-card toss-home-ad" color={ROW_PRESS} onPress={noop}>
      <span className="toss-home-ad__t">내 신용점수 30초 만에 확인</span>
      <span className="toss-home-ad__s">조회해도 점수 영향 없어요 · AD</span>
      <AdThumb />
    </TossPressable>
  );
}

// 반쪽 카드 둘 (브랜드콘 3D 그림은 녹화에서 잘라 4배 — scripts/toss-crops/home.py. 대출 비교 그림은 지어낸 SVG — icons.tsx LoanArt)
function HalfCards() {
  const coffee = localAsset("toss-home-half-coffee");
  const cards: [string, string, ReactNode][] = [
    ["loan", "대출 조건\n1분 만에 비교", <LoanArt key="art" />],
    ["coffee", "토스 브랜드콘\n구매하기", coffee && <img key="art" className="toss-home-half__art toss-home-half__art--coffee" src={coffee} alt="" draggable={false} />],
  ];
  return (
    <div className="toss-home-halves">
      {cards.map(([k, title, art]) => (
        <TossPressable key={k} className="toss-home-half" color={ROW_PRESS} scale={0.98} onPress={noop}>
          {art}
          <span className="toss-home-half__t">{title}</span>
        </TossPressable>
      ))}
    </div>
  );
}

// 목록 카드 (계좌 개설 · 토스쇼핑 · 카드 혜택 추천)
function LinksCard() {
  const rows: [string, string][] = [
    ["account", "계좌 개설"],
    ["shopping", "토스쇼핑"],
    ["checkcard", "카드 혜택 추천"],
  ];
  return (
    <div className="toss-home-card toss-home-list">
      {rows.map(([k, label]) => {
        const src = localAsset(`toss-home-li-${k}`);
        return (
          <ListRow key={k} label={label} icon={src ? <img className={`toss-home-li__ic toss-home-li__ic--${k}`} src={src} alt="" draggable={false} /> : null} />
        );
      })}
    </div>
  );
}
// 그 아래 (녹화 밖, 지어냄 — home.md §5)
function MoreCard() {
  return (
    <div className="toss-home-card toss-home-list">
      <ListRow label="내 신용점수 보기" icon={<GaugeIcon />} />
      <ListRow label="자산 추가하기" icon={<PlusSquircle />} />
    </div>
  );
}
function ListRow({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <TossPressable className="toss-home-li" color={ROW_PRESS} onPress={noop}>
      {icon}
      <span className="toss-home-li__t">{label}</span>
      <RowChevron />
    </TossPressable>
  );
}

// 🔔 관리 패널을 화면 뿌리(28dp 띠까지)에 붙임
function PanelMount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useTossPageRoot();
  useTossBackStep(open, onClose); // 갤럭시 뒤로 = 패널 닫기 (plan.md §1.4)
  const node = <DevPanel open={open} onClose={onClose} />;
  return root ? createPortal(node, root) : node;
}
