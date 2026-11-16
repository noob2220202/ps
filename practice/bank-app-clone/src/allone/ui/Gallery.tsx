// AoGallery: /dev/ui 공용 부품 견본 (녹화에 없는 화면, 기초 단계 확인용 — 영역이 부품 모양 · 상태를 볼 때. 토스 UiGallery 와 같은 생각)
// ?shot=<이름> 이면 한 부품만 녹화 프레임과 같은 자리에 그림 (화면 비교용):
//   nav · close · flow · modal · modal-bold   머리줄 (C2 11.341 · 18.324 · C3 29.2 · 8.5 · 40.546)
//   kb · num                                  키보드 (C3 41.80) · 숫자 패드
//   t6 · t7 · t3                              웹 시트 (C3 4.5) · 금액 입력 네이티브 시트 (C3 6.5) · 계좌 비밀번호 (C3 32.5)
//   alert                                     지급정지 '안내' 팝업 (C3 15.0)
// 내용 글자는 모두 지어낸 것 (녹화의 이름 · 번호 · 금액 없음)
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BlockedAlert } from "../transfer/BlockedAlert";
import { aoLoad } from "../loading";
import { useAoBack } from "../nav";
import { aoToast } from "../toast";
import { AlloneAppIcon } from "./AppIcon";
import { AoBankLogo } from "./BankLogo";
import { AoButton } from "./Button";
import { AoHeader } from "./Header";
import {
  AoBackIcon,
  AoBackspaceIcon,
  AoBellIcon,
  AoCheckCircleIcon,
  AoChevronDownIcon,
  AoChevronRightIcon,
  AoCloseIcon,
  AoGearIcon,
  AoGlobeIcon,
  AoHomeIcon,
  AoKeypadBackIcon,
  AoMagnifierIcon,
  AoMenuSearchIcon,
  AoNhSymbol,
  AoPinIcon,
  AoReshuffleIcon,
  AoStarIcon,
  AoTabIcon,
  AoWalletIcon,
} from "./icons";
import { AoCaret, AoKeyboard } from "./Keyboard";
import { AoNativeSheet } from "./NativeSheet";
import { AoPage } from "./Page";
import { AoSheet } from "./Sheet";
import { AoSkeleton } from "./Skeleton";
import { AoSpinner } from "./Spinner";
import { AoSwitch } from "./Switch";
import { AoWordmark } from "./Wordmark";

const ICONS: [string, () => ReactNode, boolean?][] = [
  ["back nav", () => <AoBackIcon />],
  ["back flow", () => <AoBackIcon variant="flow" />],
  ["close", () => <AoCloseIcon />],
  ["close T7", () => <AoCloseIcon size={16} stroke={1.9} cap="square" color="#656571" />],
  ["chevron md", () => <AoChevronDownIcon />],
  ["chevron sm", () => <AoChevronDownIcon size="sm" />],
  ["chevron T2", () => <AoChevronDownIcon w={13} h={7.67} stroke={1.3} />],
  ["chevron right", () => <AoChevronRightIcon />],
  ["home", () => <AoHomeIcon />],
  ["menu-search", () => <AoMenuSearchIcon />],
  ["globe", () => <AoGlobeIcon />],
  ["gear", () => <AoGearIcon />],
  ["bell", () => <AoBellIcon />],
  ["wallet", () => <AoWalletIcon />],
  ["magnifier", () => <AoMagnifierIcon />],
  ["magnifier 20", () => <AoMagnifierIcon size={19.98} stroke={1.45} />],
  ["star", () => <AoStarIcon />],
  ["star T1", () => <AoStarIcon size={20} stroke={1.5} color="#8f8f8f" />],
  ["star filled", () => <AoStarIcon size={20} stroke={1.5} filled />],
  ["reshuffle", () => <AoReshuffleIcon />],
  ["reshuffle pin", () => <AoReshuffleIcon variant="pin" />],
  ["backspace tag", () => <AoBackspaceIcon />],
  ["backspace pentagon", () => <AoBackspaceIcon variant="pentagon" />],
  ["keypad back", () => <AoKeypadBackIcon />],
  ["check-circle", () => <AoCheckCircleIcon color="#fff" />, true],
  ["checked", () => <AoCheckCircleIcon color="#fff" checked />, true],
  ["globe (PIN)", () => <AoGlobeIcon color="#fff" />, true],
  ["pin", () => <AoPinIcon />],
  ["NH", () => <AoNhSymbol />],
  ["tab 홈", () => <AoTabIcon name="home" />],
  ["tab 금융상품", () => <AoTabIcon name="products" />],
  ["tab 내 자산", () => <AoTabIcon name="assets" />],
  ["tab 포인트", () => <AoTabIcon name="points" />],
  ["tab 생활혜택", () => <AoTabIcon name="benefits" />],
  ["tab 홈 (빈)", () => <AoTabIcon name="home" filled={false} />],
];

// 시트 안 줄 (지어낸 계좌)
function SheetRows() {
  return (
    <>
      {[
        ["kb", "KB 연습통장", "국민은행 000000-00-000000"],
        ["kbank", "케이 연습통장", "케이뱅크 000-000-000000"],
        ["nh", "NH 연습통장", "NH농협은행 000-0000-0000-00"],
      ].map(([code, name, sub]) => (
        <div key={code} className="ao-gal__sheet-row">
          <AoBankLogo code={code} />
          <div>
            {name}
            <small>{sub}</small>
          </div>
        </div>
      ))}
    </>
  );
}

function T6Footer({ onClose }: { onClose: () => void }) {
  return (
    <div className="ao-gal__pair">
      <AoButton variant="outline" radius={15} height={56.67} size={18.4} weight={500} letterSpacing={-0.6} onPress={onClose}>
        농협 계좌등록
      </AoButton>
      <AoButton radius={15} height={56.67} size={18.4} letterSpacing={-0.6} onPress={onClose}>
        타행 계좌등록
      </AoButton>
    </div>
  );
}

// 한 부품만 (화면 비교용)
function Shot({ name }: { name: string }) {
  const [text, setText] = useState("");
  const noop = () => {};
  if (name === "nav") return <AoPage header={<AoHeader variant="nav" title="거래내역조회" />} />;
  if (name === "close") return <AoPage header={<AoHeader variant="close" title="거래내역 상세" />} />;
  if (name === "flow") return <AoPage header={<AoHeader variant="flow" />} />;
  if (name === "modal") return <AoPage header={<AoHeader variant="modal" title="잔액채우기" />} />;
  if (name === "modal-bold") return <AoPage header={<AoHeader variant="modal" weight={700} title="통합검색" />} />;
  if (name === "kb" || name === "num")
    return (
      <AoPage header={<AoHeader variant="modal" weight={700} title="통합검색" />}>
        <AoKeyboard open kind={name === "num" ? "num" : "ko"} value={text} onChange={setText} onDone={noop} dismissOnOutside={false} />
      </AoPage>
    );
  if (name === "t6")
    return (
      <AoPage header={<AoHeader variant="modal" title="잔액채우기" />}>
        <AoSheet open enter="pop" top={453} title="출금계좌 선택" footer={<T6Footer onClose={noop} />}>
          <SheetRows />
        </AoSheet>
      </AoPage>
    );
  if (name === "t7" || name === "t3")
    return (
      <AoPage header={<AoHeader variant="modal" title="잔액채우기" />}>
        <AoNativeSheet open level={name === "t7" ? "amount" : "password"} title={name === "t7" ? "금액 입력" : "계좌 비밀번호 입력"} onClose={noop} />
      </AoPage>
    );
  if (name === "alert")
    return (
      <AoPage header={<AoHeader variant="modal" title="잔액채우기" />}>
        <BlockedAlert open onClose={noop} />
      </AoPage>
    );
  return <AoPage header={<AoHeader variant="close" title={`모르는 shot: ${name}`} />} />;
}

export function AoGallery() {
  const shot = new URLSearchParams(useLocation().search).get("shot");
  return shot ? <Shot name={shot} /> : <Gallery />;
}

function Gallery() {
  const back = useAoBack();
  const [sw1, setSw1] = useState(false);
  const [sw2, setSw2] = useState(true);
  const [sheet, setSheet] = useState<null | "rise" | "pop">(null);
  const [native, setNative] = useState<null | "amount" | "password">(null);
  const [field, setField] = useState<null | "ko" | "num">(null);
  const [ko, setKo] = useState("");
  const [num, setNum] = useState("");
  const [pin, setPin] = useState(""); // 계좌 비밀번호 견본: 이 화면 상태에만 (보내지 · 저장하지 않음)
  useEffect(() => {
    if (native !== "password" || pin.length < 4) return;
    const t = window.setTimeout(() => {
      setNative(null);
      setPin("");
    }, 50);
    return () => window.clearTimeout(t);
  }, [native, pin]);

  return (
    <AoPage
      header={<AoHeader variant="nav" title="공용 부품" onBack={back} onHome={back} />}
      footer={
        <AoButton pressed="dark" onPress={() => aoToast("토스트 견본이에요")}>
          토스트
        </AoButton>
      }
    >
      <div className="ao-gal">
        <h2 className="ao-gal__h">AoHeader</h2>
        <div className="ao-gal__frame">
          <AoHeader variant="nav" title="거래내역조회" />
        </div>
        <div className="ao-gal__frame">
          <AoHeader variant="close" title="거래내역 상세" />
        </div>
        <div className="ao-gal__frame">
          <AoHeader variant="flow" />
        </div>
        <div className="ao-gal__frame">
          <AoHeader variant="modal" title="잔액채우기" />
        </div>
        <div className="ao-gal__frame">
          <AoHeader variant="modal" weight={700} title="통합검색" />
        </div>

        <h2 className="ao-gal__h">icons</h2>
        <div className="ao-gal__icons">
          {ICONS.map(([name, icon, dark]) => (
            <div key={name} className={`ao-gal__icon${dark ? " ao-gal__icon--dark" : ""}`}>
              <div>{icon()}</div>
              {name}
            </div>
          ))}
        </div>

        <h2 className="ao-gal__h">AoButton</h2>
        <div className="ao-gal__col">
          <AoButton>확인 (primary, 누름 light #12a434)</AoButton>
          <AoButton active>light 누른 모양</AoButton>
          <AoButton active pressed="dark">
            dark 누른 모양 #004511
          </AoButton>
          <AoButton active pressed="native" radius={8.5} size={18.8}>
            native 누른 모양 #003e0e
          </AoButton>
          <AoButton disabled radius={8.5} size={18.8}>
            다음 (비활성, 흰 글자)
          </AoButton>
          <AoButton disabled disabledColor="#808080" size={17.5} weight={400}>
            다음 (비활성, 회색 글자)
          </AoButton>
          <div className="ao-gal__pair">
            <AoButton variant="outline" radius={10} height={42.5} size={16} weight={500}>
              계좌관리
            </AoButton>
            <AoButton variant="outlineGreen" radius={10} height={42.5} size={16} weight={500}>
              이체
            </AoButton>
          </div>
          <div className="ao-gal__pair">
            <AoButton variant="outline" radius={10} height={42.5} size={16} weight={500} active>
              outline 누름
            </AoButton>
            <AoButton variant="outlineGreen" radius={10} height={42.5} size={16} weight={500} active>
              outlineGreen 누름
            </AoButton>
          </div>
          <AoButton variant="outline" width={80.6} height={30} radius={8} size={13} weight={400} style={{ padding: 0 }}>
            다시보내기
          </AoButton>
        </div>

        <h2 className="ao-gal__h">AoSwitch · AoSkeleton</h2>
        <div className="ao-gal__row">
          잔액 숨기기 <AoSwitch checked={sw1} onChange={setSw1} aria-label="잔액 숨기기" />
          <span style={{ width: 16 }} />
          자동완성 <AoSwitch size="lg" checked={sw2} onChange={setSw2} aria-label="자동완성" />
        </div>
        <div className="ao-gal__col" style={{ marginTop: 14 }}>
          <AoSkeleton height={69} />
          <AoSkeleton height={24} width="70%" />
          <AoSkeleton height={24} width="45%" />
        </div>

        <h2 className="ao-gal__h">AoSheet (웹) · AoNativeSheet</h2>
        <div className="ao-gal__col">
          <div className="ao-gal__pair">
            <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => setSheet("rise")}>
              rise · slide
            </AoButton>
            <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => setSheet("pop")}>
              pop · cut
            </AoButton>
          </div>
          <div className="ao-gal__pair">
            <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => setNative("amount")}>
              금액 입력 (T7)
            </AoButton>
            <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => setNative("password")}>
              계좌 비밀번호 (T3)
            </AoButton>
          </div>
        </div>

        <h2 className="ao-gal__h">AoKeyboard</h2>
        <div
          className={`ao-gal__field${field === "ko" ? " ao-gal__field--focus" : ""}`}
          data-ao-kb-field
          onClick={() => setField("ko")}
        >
          {ko ? <span>{ko}</span> : field !== "ko" && <span className="ao-gal__ph">검색어를 입력해 주세요</span>}
          {field === "ko" && <AoCaret />}
        </div>
        <div style={{ height: 10 }} />
        <div
          className={`ao-gal__field${field === "num" ? " ao-gal__field--focus" : ""}`}
          data-ao-kb-field
          onClick={() => setField("num")}
        >
          {num ? <span className="ao-num">{num}</span> : field !== "num" && <span className="ao-gal__ph">계좌번호 입력</span>}
          {field === "num" && <AoCaret color="#0c8f2d" />}
        </div>

        <h2 className="ao-gal__h">기초 담당 부품 (AppIcon · Wordmark · Spinner · BankLogo · 로딩)</h2>
        <div className="ao-gal__row">
          <AlloneAppIcon size={64} />
          <span style={{ background: "#0c8f2d", padding: 6, borderRadius: 8 }}>
            <AoWordmark width={60} />
          </span>
          <AoSpinner size={61} />
        </div>
        <div className="ao-gal__row" style={{ marginTop: 10 }}>
          {["jb", "shinhan", "kakao", "hana", "kb", "kbank", "nh", "woori", "ibk", "toss"].map((c) => (
            <AoBankLogo key={c} code={c} />
          ))}
        </div>
        <div className="ao-gal__col" style={{ marginTop: 14 }}>
          <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => void aoLoad("history")}>
            로딩 막 (history 1000ms)
          </AoButton>
        </div>
      </div>

      <AoSheet
        open={sheet === "rise"}
        top={453}
        title="출금계좌 선택"
        onClose={() => setSheet(null)}
        footer={<T6Footer onClose={() => setSheet(null)} />}
      >
        <SheetRows />
      </AoSheet>
      <AoSheet open={sheet === "pop"} enter="pop" exit="cut" top={490.6} radius={24} onClose={() => setSheet(null)}>
        <div style={{ padding: "40px 31px", fontSize: 17.5, fontWeight: 600 }}>
          pop · cut 견본 (정기점검 시트처럼)
          <div style={{ marginTop: 160 }}>
            <AoButton variant="outline" height={46} size={15} weight={500} onPress={() => setSheet(null)}>
              닫기
            </AoButton>
          </div>
        </div>
      </AoSheet>

      <AoNativeSheet open={native === "amount"} level="amount" title="금액 입력" onClose={() => setNative(null)}>
        <div className="ao-gal__nbody">
          (영역이 금액 · 칩 · 키패드를 그림)
          <AoButton pressed="native" radius={5.5} height={56} size={17.6} weight={500} onPress={() => setNative(null)}>
            확인
          </AoButton>
        </div>
      </AoNativeSheet>
      <AoNativeSheet
        open={native === "password"}
        level="password"
        title="계좌 비밀번호 입력"
        onClose={() => {
          setNative(null);
          setPin("");
        }}
      >
        <div className="ao-gal__nbody" style={{ top: 140, textAlign: "center" }}>
          {"●".repeat(pin.length) || "숫자 4개 (보이기만, 아무 데도 안 보냄)"}
          <div className="ao-gal__pair" style={{ marginTop: 20 }}>
            {["1", "2", "3", "4"].map((d) => (
              <AoButton key={d} variant="outline" height={46} size={20} weight={400} onPress={() => setPin((p) => (p + d).slice(0, 4))}>
                {d}
              </AoButton>
            ))}
          </div>
        </div>
      </AoNativeSheet>

      <AoKeyboard open={field === "ko"} value={ko} onChange={setKo} maxLength={20} onDone={() => setField(null)} />
      <AoKeyboard open={field === "num"} kind="num" value={num} onChange={setNum} maxLength={16} onDone={() => setField(null)} />
    </AoPage>
  );
}
