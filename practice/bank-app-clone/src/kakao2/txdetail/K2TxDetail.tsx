import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, paths } from "../../api/endpoints";
import type { HomeData, Transaction, TransactionDetail } from "../../api/types";
import { useApi } from "../../api/useApi";
import { ErrorState } from "../../components/ErrorState";
import { useStatusBar } from "../../hooks/useStatusBar";
import { signedWon, won } from "../../lib/format";
import { K2Chevron, K2Pencil } from "../art";
import { leaveK2Dim } from "../dim";
import "./K2TxDetail.css";

// kakao2 거래상세 (녹화 41.4 – 44.9초 보낸 이체, 46.7 – 49.5초 같은 거래 다시, 60.1 – 62.7초 받은 돈 — txdetail.md + critic.md 17 · C4 · C5 · X16 · X23).
// 통장 목록에서 거래를 누르면 목록이 로딩 막(dim.ts)을 켜고, 이 화면이 그 밑으로 아래에서 올라옴 (ScreenStack layer--k2-detail, nav.css).
// 처음엔 거래 종류에 맞춘 뼈대 (값은 모두 "-", "- 검색하기", 1/N 없음) → 상세를 받고 350ms 가 지나면 한 프레임에 채우고 막을 걷음 (167ms),
// 거래금액 · 1/N 빵나누기는 그다음 프레임 (녹화 41.750 → 41.767초). 태그 줄(#이체) · 사용처 줄 없음. 확인 → 뒤로 (아래로 내려감)
export const K2_TXD = {
  minLoad: 350, // 뼈대 최소 시간, 막이 뜬 때부터 (녹화는 막이 뜨고 335 · 383 · 602ms 에 채워짐 — 화면이 거의 다 올라왔을 때)
  memoMax: 20,
} as const;

// 모양: sent = 내가 보낸 이체 (이체금액 · 수수료 상자, 입금계좌 두 줄, 받는 분에게 표기), card = 체크카드 결제 (녹화에 없음 — 카카오뱅크 화면의
// 카드정보 · 사용처 · 주소 · 전화번호를 그대로), base = 그 밖 (받은 돈 · 자동이체 · 이자). 상세가 오기 전엔 목록이 넘겨준 거래로 정함
type Shape = "sent" | "card" | "base";
const shapeOf = (amount: number, sent: boolean, card: boolean): Shape => (amount < 0 && sent ? "sent" : card ? "card" : "base");

type Row = { label: string; value: ReactNode; className?: string; after?: ReactNode };

// 로딩 막이 뜬 프레임의 시각 = 막 스피너 애니메이션의 시작 시각 (막이 없거나 이 프레임에 막 떴으면 null)
function dimShownAt(): number | null {
  const a = document.querySelector(".k2-dim")?.getAnimations({ subtree: true }).find((x) => typeof x.startTime === "number");
  return a ? (a.startTime as number) : null;
}

// 메모 (녹화는 안내 글만): 누르면 입력 (20자), 서버에 저장 — 🔔 패널에서 고친 메모도 여기 보임 (케이뱅크 KbankTxDetail 의 Memo 와 같은 방식)
function Memo({ txId, memo }: { txId: string; memo?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null); // 저장한 값 (서버 데이터가 다시 올 때까지)
  if (saved !== null && (memo ?? "") === saved) setSaved(null);
  const shown = saved ?? memo ?? "";
  const save = (v: string) => {
    if (v === shown) return;
    setSaved(v);
    api
      .updateMemo(txId, v)
      .then((r) => setSaved(r.memo ?? v))
      .catch(() => setSaved(null));
  };
  // 입력 중에 확인으로 닫으면(화면이 사라질 땐 blur 가 안 옴) 그 글을 저장
  const pending = useRef({ draft, shown });
  useEffect(() => {
    pending.current = { draft, shown };
  });
  useEffect(
    () => () => {
      const { draft: d, shown: s } = pending.current;
      const v = (d ?? "").trim();
      if (d !== null && v !== s) void api.updateMemo(txId, v).catch(() => {});
    },
    [txId],
  );

  if (draft !== null)
    return (
      <input
        className="k2txd__memo-input"
        autoFocus
        value={draft}
        maxLength={K2_TXD.memoMax}
        placeholder="메모할 수 있어요 (최대 20자)"
        onChange={(e) => setDraft(e.target.value.slice(0, K2_TXD.memoMax))}
        onBlur={() => {
          const v = draft.trim();
          setDraft(null);
          save(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  return (
    <button className={`k2txd__memo${shown ? " k2txd__memo--set" : ""}`} disabled={memo === undefined} onClick={() => setDraft(shown)}>
      <span>{shown || "메모할 수 있어요 (최대 20자)"}</span>
      <K2Pencil size={11.6} className="k2txd__pen" />
    </button>
  );
}

// 공유 (아래 버튼 가운데 24 상자, 흰 2pt 둥근 끝): 녹화 42.3초 잉크의 가운데선 — 화살표 꼭짓점 y 3.4 · 팔 5 · 대 끝 13.5,
// 받침 x 4 – 20 (가운데선 사이 16) · y 16 – 20
function Share() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 13.5V3.4M7 8.4l5-5 5 5M4 16v4h16v-4" />
    </svg>
  );
}

// 거래시간 값 (YYYY.MM.DD HH:MM:SS): 녹화(SF) 의 '.' · ':' · 띄어쓰기가 Pretendard 보다 넓음 (같은 문자열로 재면 4.4pt 차이, 숫자는 같음)
// → 그 글자 둘레만 조금 띄움
const SEP: Record<string, string> = { ".": "k2txd__dot", ":": "k2txd__colon", " ": "k2txd__gap" };
const timeText = (s: string) => s.split(/([.: ])/).map((p, i) => (SEP[p] ? <span key={i} className={SEP[p]}>{p}</span> : p));

// 줄 하나 = <dl> (이름 · 값). 값이 두 줄이면(입금계좌) 그만큼 줄이 길어짐
function Rows({ rows }: { rows: Row[] }) {
  return (
    <div className="k2txd__group">
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dl className={`k2txd__row${r.className ? ` ${r.className}` : ""}`}>
            <dt>{r.label}</dt>
            <dd className={r.value === "-" ? "k2txd__dash" : undefined}>{r.value}</dd>
          </dl>
          {r.after}
        </Fragment>
      ))}
    </div>
  );
}

export function K2TxDetail() {
  const { accountId = "main", txId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  useStatusBar("#fff", "dark");

  const passed = (location.state as { tx?: Transaction } | null)?.tx;
  const preview = passed?.id === txId ? passed : undefined;
  const detail = useApi<TransactionDetail>(paths.transaction(txId));
  const home = useApi<HomeData>(paths.home); // 받는 분에게 표기 기본값 = 내 이름

  // 올라오기 · 뼈대 시간을 막이 뜬 프레임에 맞춤: 목록은 누른 프레임에 막을 그리지만 이 층은 라우터 전환(startTransition)으로 1–2프레임 뒤에
  // 붙음 (빌드 · 기기마다 다름) → k2-modal-up 의 시작 시각을 막과 같게 (nav.css 의 −24ms 는 그대로, critic.md C4)
  const root = useRef<HTMLDivElement>(null);
  const shownAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = (shownAt.current = dimShownAt());
    const up = root.current
      ?.closest(".layer")
      ?.getAnimations()
      .find((a) => (a as CSSAnimation).animationName === "k2-modal-up");
    if (at !== null && up) up.startTime = at;
  }, []);
  // 뼈대 최소 시간 (막이 뜬 때부터, 막이 없으면 들어온 때부터. 받아 둔 상세가 있어도 들어올 때마다)
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const at = shownAt.current;
    const t = setTimeout(() => setMinDone(true), K2_TXD.minLoad - (at === null ? 0 : performance.now() - at));
    return () => clearTimeout(t);
  }, []);
  const loaded = minDone && detail.status === "done" && home.status !== "loading";
  const failed = minDone && detail.status === "error";
  // 거래금액 · 1/N 은 나머지가 그려진 다음 프레임
  const [amountIn, setAmountIn] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const r = requestAnimationFrame(() => setAmountIn(true));
    return () => cancelAnimationFrame(r);
  }, [loaded]);
  // 데이터를 그린 그 프레임에 로딩 막을 걷기 시작 (167ms, critic.md C5). 막이 없으면(주소로 바로 열기) 아무것도 안 함
  useLayoutEffect(() => {
    if (loaded || failed) leaveK2Dim();
  }, [loaded, failed]);

  const d = loaded ? detail.data : undefined;
  const shape = d
    ? shapeOf(d.amount, !!d.transfer, !!d.cardInfo)
    : preview
      ? shapeOf(preview.amount, !!preview.toBank, preview.tag === "#체크카드")
      : "base";
  const v = (s: string | undefined) => (d ? s || "-" : "-");
  const t = d?.transfer;
  const showAmount = d && amountIn;

  const groups: Row[][] = [
    [
      { label: "거래시간", value: d?.transactedAt ? timeText(d.transactedAt) : "-" },
      { label: "거래구분", value: v(d?.kind), className: "k2txd__row--ko" },
    ],
    [
      {
        label: "거래금액",
        value: showAmount ? signedWon(d.amount) : "-",
        className: `k2txd__amt${showAmount && d.amount > 0 ? " k2txd__amt--in" : ""}`,
        // 보낸 이체: 거래금액 바로 밑 회색 상자 (이체금액 · 수수료)
        after: shape === "sent" && (
          <div className="k2txd__fee">
            <dl className="k2txd__fee-row">
              <dt>이체금액</dt>
              <dd>{d ? won(Math.abs(d.amount)) : "-"}</dd>
            </dl>
            <dl className="k2txd__fee-row">
              <dt>수수료</dt>
              <dd>{d ? won(0) : "-"}</dd>
            </dl>
          </div>
        ),
      },
      { label: "거래 후 잔액", value: v(d && won(d.balanceAfter)) },
      ...(shape === "card" ? [{ label: "카드정보", value: v(d?.cardInfo) }] : []),
      ...(shape === "sent"
        ? [
            // 두 줄: 예금주 / 은행 계좌번호 (은행 정식 이름, 계좌번호는 '-' 없이)
            {
              label: "입금계좌",
              value: t ? (
                <>
                  <span className="k2txd__ko">{t.holder}</span>
                  {`\n${t.bank.name} ${t.number}`}
                </>
              ) : (
                "-"
              ),
              className: t ? "k2txd__row--top k2txd__acct" : "k2txd__row--top", // 뼈대 "-" 는 한 줄 (아래 줄들이 13.7pt 위)
            },
            { label: "받는 분에게 표기", value: v(d && (d.memoTo || home.data?.profile.userName)), className: "k2txd__row--top k2txd__row--ko" },
          ]
        : []),
    ],
    ...(shape === "card"
      ? [
          [
            { label: "사용처", value: v(d?.merchant) },
            { label: "주소", value: v(d?.address) },
            { label: "전화번호", value: v(d?.phone) },
          ],
        ]
      : []),
  ];

  // 확인: 앱 안에서 열었으면 뒤로 (모달이 내려감), 주소로 바로 열었으면 통장으로. 두 번 눌러 두 칸 뒤로 가지 않게
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(`/account/${accountId}`, { replace: true });
  };

  return (
    <div className="k2txd" ref={root}>
      <div className="k2txd__scroll">
        <div className="k2txd__page">
          <h1 className={`k2txd__title${d ? "" : " k2txd__dash"}`}>{d ? d.merchant : "-"}</h1>
          <Memo key={txId} txId={txId} memo={d?.memo} />
          <div className="k2txd__hr" />
          {failed && !d ? (
            detail.error.status === 404 ? (
              <p className="k2txd__empty">거래 정보를 찾을 수 없습니다.</p>
            ) : (
              <ErrorState error={detail.error} onRetry={detail.retry} />
            )
          ) : (
            <>
              {groups.map((rows, i) => (
                <Fragment key={i}>
                  {i > 0 && <div className="k2txd__line" />}
                  <Rows rows={rows} />
                </Fragment>
              ))}
              <button className="k2txd__search">
                <span>{d ? `\`${d.merchant}\` 검색하기` : "- 검색하기"}</span>
                <K2Chevron width={5.7} height={10} stroke={0.9} color="#7b7b7b" className="k2txd__chev" />
              </button>
              {showAmount && d.amount < 0 && (
                <button className="k2txd__split">
                  <span>1/N 빵나누기</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="k2txd__foot">
        <button className="k2txd__share" aria-label="공유">
          <Share />
        </button>
        <button className="k2txd__ok" onClick={close}>
          <span>확인</span>
        </button>
      </div>
    </div>
  );
}
