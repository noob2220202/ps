// /assets/accounts — 내 계좌 (과제의 '계좌 편집', assets.md §2.3, 녹화 B 166.49–171.66초). 자산 '계좌 n개 전체보기' 에서 push.
// 머리줄 가운데 분절(내 계좌 | 계좌 개설) · 웹 진행 막대 · '입출금' 합계 · 계좌 줄(피치 56.5) · 아래 떠 있는 알약(화면 편집하기 | 계좌 불러오기).
// 들어올 때: ← 만 있는 빈 화면 → 진행 막대 70% → 내용이 한 번에 → 막대가 차고 사라짐. 계좌 개설 칸은 비어 있음 (plan.md §1.6)
import { useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useApi } from "../../api/useApi";
import { tossPaths, type TossAssetAccount, type TossAssets } from "../api";
import { useTossFlow } from "../flow";
import { num } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar } from "../ui/AppBar";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { useAssetsRevisit } from "./data";
import { AssetsError, AssetsLogo } from "./parts";
import "./assets.css";

const MY = {
  show: 350, // 내용이 나타나는 때 (녹화 1.8초를 줄인 값)
  barDone: 600, // 내용이 나타나고 이만큼 뒤에 진행 막대가 참
} as const;

type MyMemo = { scroll: number; seg: 0 | 1 };

export function MyAccounts() {
  const { revisit, saved, save } = useAssetsRevisit<MyMemo>();
  const q = useApi<TossAssets>(tossPaths.assets);
  const data = q.data;
  const go = useTossGo();
  const { goSend } = useTossFlow();
  const [seg, setSeg] = useState<0 | 1>(saved.seg ?? 0);

  const [timeUp, setTimeUp] = useState(revisit);
  useEffect(() => {
    if (timeUp) return;
    const t = window.setTimeout(() => setTimeUp(true), MY.show);
    return () => window.clearTimeout(t);
  }, [timeUp]);
  const shown = timeUp && !!data;
  const [barReady, setBarReady] = useState(revisit);
  useEffect(() => {
    if (!shown || barReady) return;
    const t = window.setTimeout(() => setBarReady(true), MY.barDone);
    return () => window.clearTimeout(t);
  }, [shown, barReady]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!shown || restored.current) return;
    restored.current = true;
    if (revisit && bodyRef.current && saved.scroll) bodyRef.current.scrollTop = saved.scroll;
  }, [shown, revisit, saved.scroll]);
  const onScroll = (e: UIEvent<HTMLDivElement>) => save({ scroll: e.currentTarget.scrollTop });
  const pickSeg = (i: 0 | 1) => {
    setSeg(i);
    save({ seg: i });
  };

  const open = (a: TossAssetAccount) => {
    if (a.role === "money") return;
    go(a.bankCode === "toss" ? `/bank/${encodeURIComponent(a.id)}` : `/account/${encodeURIComponent(a.id)}`);
  };
  const send = (a: TossAssetAccount) => {
    if (a.bankCode === "toss" && a.role !== "money") goSend({ from: a.id });
  };

  const accounts = data?.accounts.items ?? [];
  return (
    <TossPage
      className="toss-assets-my"
      header={
        <>
          <TossAppBar progress={<TossProgressBar ready={barReady} />} />
          {shown && (
            <div className="toss-assets-seg" role="tablist">
              <i className={`toss-assets-seg__thumb${seg ? " toss-assets-seg__thumb--2" : ""}`} />
              <TossPressable className={`toss-assets-seg__item${seg === 0 ? " on" : ""}`} color="transparent" onPress={() => pickSeg(0)} role="tab">
                내 계좌
              </TossPressable>
              <TossPressable className={`toss-assets-seg__item toss-assets-seg__item--2${seg === 1 ? " on" : ""}`} color="transparent" onPress={() => pickSeg(1)} role="tab">
                계좌 개설
              </TossPressable>
            </div>
          )}
        </>
      }
      dock={
        shown && seg === 0 ? (
          <div className="toss-assets-pill">
            <TossPressable className="toss-assets-pill__btn toss-assets-pill__btn--l" radius={20} fadeOut={150}>
              화면 편집하기
            </TossPressable>
            <i className="toss-assets-pill__div" />
            <TossPressable className="toss-assets-pill__btn toss-assets-pill__btn--r" radius={20} fadeOut={150}>
              계좌 불러오기
            </TossPressable>
          </div>
        ) : undefined
      }
      bodyRef={bodyRef}
      onScroll={onScroll}
    >
      {q.status === "error" && !data && timeUp && <AssetsError onRetry={q.retry} />}
      {shown && seg === 0 && (
        <div className="toss-assets-my__content">
          <p className="toss-assets-my__sec">입출금</p>
          <p className="toss-assets-my__total">{num(data!.accounts.total)}원</p>
          {accounts.map((a) => (
            <TossPressable key={a.id} className="toss-assets-myrow" pressedClassName="toss-assets-myrow--on" color="rgba(255,255,255,0.07)" onPress={() => open(a)}>
              <AssetsLogo code={a.bankCode} surface="page" />
              <p className="toss-assets-myrow__amt">{num(a.balance)}원</p>
              <p className="toss-assets-myrow__name">
                {a.name}
                {a.isMain && (
                  <>
                    <span className="toss-assets-row__dot"> · </span>
                    <span className="toss-assets-row__main">주계좌</span>
                  </>
                )}
              </p>
              <TossPressable className="toss-assets-send toss-assets-send--page" radius={8} fadeOut={150} onPress={() => send(a)}>
                송금
              </TossPressable>
            </TossPressable>
          ))}
        </div>
      )}
    </TossPage>
  );
}
