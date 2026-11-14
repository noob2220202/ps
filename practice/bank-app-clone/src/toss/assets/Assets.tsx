// /assets — 자산 (assets.md §2.2, 녹화 B 152.03–161.27 · 164.77–174.54초). 홈 '계좌 · 카드 · 포인트 모두 보기' 에서 push.
// 머리줄(← · 자산 불러오기) 고정, '총 자산' 줄은 스크롤로 사라지고 탭(계좌 · 카드 · 포인트)이 머리줄 밑에 붙음. 밑줄은 미끄러짐(250ms),
// 스크롤 엿보기(맨 끝이면 마지막 칸). 카드 셋(계좌 3줄 · 카드 2줄 · 포인트 1줄 + n개 전체보기). 위에서 당기면 새로고침(물방울 + 머리줄 흐려짐).
// 들어올 때: 머리줄 · 총 자산 · 탭 글자가 먼저, 카드 · 밑줄 · › 는 push 가 끝난 뒤. 바뀐 금액만 숫자 굴림(900ms)
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useApi } from "../../api/useApi";
import { tossPaths, type TossAssetAccount, type TossAssetCard, type TossAssetPoint, type TossAssets } from "../api";
import { useTossFlow } from "../flow";
import { useTossGo } from "../nav";
import { TossAppBar } from "../ui/AppBar";
import { TossOdometer } from "../ui/Odometer";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { useAssetsRevisit } from "./data";
import { AssetsCardPlate, AssetsError, AssetsLogo, PlusGlyph, PullBlob, RChevron } from "./parts";
import { usePullRefresh } from "./usePullRefresh";
import "./assets.css";

// 자리 (본문 기준 = 화면 − 81.6)
const A = {
  tabsH: 51.2, // 탭 (136–187.2, 붙으면 81.6–132.8)
  tabW: 344 / 3, // 탭 칸 (x 20–364)
  indW: 96.8,
  cardsAfter: 12, // 탭 아래끝 → 첫 카드
  under: 8, // 탭을 누르면 그 카드 위끝이 탭 밑 8dp 에 오게
  spy: 221.2, // 엿보기: 카드 위끝이 본문 위에서 이만큼(화면 y 302.8) 안으로 오면 그 칸 (B 156.00–156.09: 스크롤 117 → 161 사이에 카드로 바뀜)
  show: 550, // 카드가 나타나는 때 (push 400ms 가 끝나고 150ms 뒤)
  odo: 900, // 숫자 굴림
} as const;
const TABS = ["계좌", "카드", "포인트"] as const;
// 카드 위끝의 본문(스크롤) 안 자리. offsetTop 은 당김 칸(.toss-assets-pull) 기준이라 그 칸 자리를 더함
const topOf = (s: HTMLElement) => s.offsetTop + ((s.offsetParent as HTMLElement | null)?.offsetTop ?? 0);

type AssetsMemo = { scroll: number };

export function Assets() {
  const { revisit, saved, save } = useAssetsRevisit<AssetsMemo>();
  const q = useApi<TossAssets>(tossPaths.assets);
  const data = q.data;
  const go = useTossGo();
  const { goSend } = useTossFlow();

  // 카드 · 밑줄 · › 는 push 가 끝난 뒤 (데이터가 늦으면 올 때). 뒤로 와서 다시 그리면 바로
  const [timeUp, setTimeUp] = useState(revisit);
  useEffect(() => {
    if (timeUp) return;
    const t = window.setTimeout(() => setTimeUp(true), A.show);
    return () => window.clearTimeout(t);
  }, [timeUp]);
  const shown = timeUp && !!data;
  // 총 자산: 카드가 나타날 때까지는 들어올 때 보이던 값(받아 둔 값) 그대로 → 카드와 같이 새 값으로 굴러감 (녹화 153.40–154.34초)
  const [entryTotal] = useState(() => data?.total);
  const total = shown ? data?.total : (entryTotal ?? data?.total);

  const bodyRef = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([null, null, null]);
  const [tab, setTab] = useState(0);
  const pinned = useRef(0); // 탭을 눌러 부드럽게 스크롤하는 동안 엿보기를 멈춤 (타이머 id)

  // 스크롤 엿보기: 맨 끝이면 마지막 칸, 아니면 위끝이 화면 y 302.8 위로 올라온 마지막 카드 (녹화: 아래로 밀면 계좌 → 카드 → 맨 끝에서 포인트)
  const spy = useCallback((el: HTMLDivElement) => {
    const st = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    const list = sections.current.map((s, i) => [s, i] as const).filter(([s]) => s);
    let pick = 0;
    if (max > 1 && st >= max - 1) pick = list[list.length - 1]?.[1] ?? 0;
    else for (const [s, i] of list) if (topOf(s!) - st <= A.spy) pick = i;
    setTab(pick);
  }, []);
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    save({ scroll: el.scrollTop });
    if (pinned.current) return;
    spy(el);
  };
  const unpin = () => {
    window.clearTimeout(pinned.current);
    pinned.current = 0;
  };

  // 탭 누름: 그 카드 위끝이 탭 밑 8dp 에 오게 부드럽게 (맨 끝에서 멈춤). 밑줄은 바로 그 탭으로
  const pickTab = (i: number) => {
    const el = bodyRef.current;
    const s = sections.current[i];
    if (!el || !s) return;
    setTab(i);
    const max = el.scrollHeight - el.clientHeight;
    const target = Math.max(0, Math.min(max, topOf(s) - A.tabsH - A.under));
    unpin();
    pinned.current = window.setTimeout(() => (pinned.current = 0), 900);
    el.scrollTo({ top: target, behavior: "smooth" });
  };

  // 뒤로 와서 다시 그림: 스크롤 되살림
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!shown || restored.current) return;
    restored.current = true;
    const el = bodyRef.current;
    if (revisit && el && saved.scroll) {
      el.scrollTop = saved.scroll;
      spy(el);
    }
  }, [shown, revisit, saved.scroll, spy]);

  // 당겨서 새로고침: 다시 받고 새 값이 오면(또는 실패하면) 끝냄
  const waitRef = useRef<{ data: TossAssets | undefined; done: () => void } | null>(null);
  useEffect(() => {
    const w = waitRef.current;
    if (w && (q.data !== w.data || q.error)) {
      waitRef.current = null;
      w.done();
    }
  }, [q.data, q.error]);
  const { wrapRef: pullRef, blobRef, phase: pullPhase } = usePullRefresh({
    bodyRef,
    enabled: shown,
    onRefresh: () =>
      new Promise<void>((done) => {
        waitRef.current = { data: q.data, done };
        q.retry();
      }),
  });

  const openAccount = (a: TossAssetAccount) => {
    if (a.role === "money") return; // 토스머니: 누름 표시만
    go(a.bankCode === "toss" ? `/bank/${encodeURIComponent(a.id)}` : `/account/${encodeURIComponent(a.id)}`);
  };
  const sendFrom = (a: TossAssetAccount) => {
    if (a.bankCode === "toss" && a.role !== "money") goSend({ from: a.id });
  };

  const accounts = data?.accounts.items ?? [];
  const cards = data?.cards.items ?? [];
  const points = data?.points.items ?? [];

  return (
    <TossPage
      className="toss-assets-assets"
      header={
        <TossAppBar
          className="toss-assets-assets__bar"
          right={
            <TossPressable className="toss-assets-assets__load" radius={8}>
              자산 불러오기
            </TossPressable>
          }
        />
      }
      bodyRef={bodyRef}
      onScroll={onScroll}
    >
      <div className="toss-assets-assets__content" onPointerDown={unpin} onWheel={unpin}>
        <TossPressable className="toss-assets-total" color="rgba(255,255,255,0.06)" inset="8px 12px 0" radius={12} fadeOut={150}>
          <span className="toss-assets-total__label">총 자산</span>
          {total !== undefined && <TossOdometer id="assets:total" value={total} duration={A.odo} className="toss-assets-total__amt" />}
          {shown && <RChevron />}
        </TossPressable>

        <div className="toss-assets-tabs">
          {TABS.map((t, i) => (
            <TossPressable key={t} className={`toss-assets-tabs__tab${tab === i ? " on" : ""}`} color="transparent" onPress={() => pickTab(i)} role="tab">
              {t}
            </TossPressable>
          ))}
          {shown && <i className="toss-assets-tabs__ind" style={{ transform: `translate3d(${tab * A.tabW}px, 0, 0)` }} />}
        </div>

        <div className="toss-assets-pull" ref={pullRef}>
          {q.status === "error" && !data && <AssetsError onRetry={q.retry} />}
          {shown && (
            <div className={`toss-assets-cards${revisit ? "" : " toss-assets-cards--in"}`}>
              <section className="toss-assets-card" ref={(el) => void (sections.current[0] = el)}>
                {accounts.slice(0, 3).map((a) => (
                  <AccountRow key={a.id} a={a} onPress={() => openAccount(a)} onSend={() => sendFrom(a)} />
                ))}
                <AllButton label={`계좌 ${data!.accounts.count}개 전체보기`} onPress={() => go("/assets/accounts")} />
              </section>
              <section className="toss-assets-card" ref={(el) => void (sections.current[1] = el)}>
                {cards.length ? (
                  <>
                    {cards.slice(0, 2).map((c) => (
                      <CardRow key={c.id} c={c} />
                    ))}
                    <AllButton label={`카드 ${data!.cards.count}개 전체보기`} />
                  </>
                ) : (
                  <p className="toss-assets-card__empty">연결된 카드가 없어요</p>
                )}
              </section>
              <section className="toss-assets-card" ref={(el) => void (sections.current[2] = el)}>
                {points.length ? (
                  <>
                    {points.slice(0, 1).map((p) => (
                      <PointRow key={p.id} p={p} />
                    ))}
                    <AllButton label={`포인트 ${data!.points.count}개 전체보기`} />
                  </>
                ) : (
                  <p className="toss-assets-card__empty">모은 포인트가 없어요</p>
                )}
              </section>
              <TossPressable className="toss-assets-more" color="rgba(255,255,255,0.06)" inset="2px 12px" radius={12} fadeOut={150}>
                <PlusGlyph />
                <span>내 자산 불러오기</span>
              </TossPressable>
            </div>
          )}
        </div>
        <PullBlob phase={pullPhase} blobRef={blobRef} />
      </div>
    </TossPage>
  );
}

// 계좌 줄 57.6: 로고 30.4 · 잔액 17 B · 이름(· 주계좌) 13 R · 송금
function AccountRow({ a, onPress, onSend }: { a: TossAssetAccount; onPress: () => void; onSend: () => void }) {
  return (
    <TossPressable className="toss-assets-row" color="#303136" radius={8} fadeIn={50} pressedClassName="toss-assets-row--on" onPress={onPress}>
      <AssetsLogo code={a.bankCode} surface="card" />
      <div className="toss-assets-row__text">
        <TossOdometer id={`assets:acct:${a.id}`} value={a.balance} duration={A.odo} className="toss-assets-row__amt" />
        <p className="toss-assets-row__name">
          {a.name}
          {a.isMain && (
            <>
              <span className="toss-assets-row__dot"> · </span>
              <span className="toss-assets-row__main">주계좌</span>
            </>
          )}
        </p>
      </div>
      <TossPressable className="toss-assets-send" radius={8} fadeOut={150} onPress={onSend}>
        송금
      </TossPressable>
    </TossPressable>
  );
}

// 카드 줄 58.4: 세로 카드 그림 29.6 × 43.2 · 이번 달 쓴 돈 · 카드 이름
function CardRow({ c }: { c: TossAssetCard }) {
  return (
    <TossPressable className="toss-assets-row toss-assets-row--card" color="#303136" radius={8} fadeIn={50}>
      <span className="toss-assets-row__plate">
        <AssetsCardPlate art={c.art} bankCode={c.bankCode} />
      </span>
      <div className="toss-assets-row__text">
        <TossOdometer id={`assets:card:${c.id}`} value={c.monthAmount} duration={A.odo} className="toss-assets-row__amt" />
        <p className="toss-assets-row__name">{c.name}</p>
      </div>
    </TossPressable>
  );
}

// 포인트 줄 57.6
function PointRow({ p }: { p: TossAssetPoint }) {
  const code = p.icon?.startsWith("hana") ? "hana" : "toss";
  return (
    <TossPressable className="toss-assets-row" color="#303136" radius={8} fadeIn={50}>
      <AssetsLogo code={code} surface="card" />
      <div className="toss-assets-row__text">
        <TossOdometer id={`assets:point:${p.id}`} value={p.balance} duration={A.odo} className="toss-assets-row__amt" />
        <p className="toss-assets-row__name">{p.name}</p>
      </div>
    </TossPressable>
  );
}

// 'n개 전체보기' (40, #2b2a2d → 누르면 #373b3f, 떼면 150ms)
function AllButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TossPressable className="toss-assets-all" color="#373b3f" radius={10} fadeOut={150} onPress={onPress}>
      {label}
    </TossPressable>
  );
}
