import { useState } from "react";
import { createPortal } from "react-dom";
import { logout, remaining, useAuth } from "../auth/auth";
import { AdminPanel } from "../auth/AdminPanel";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { AppProfile } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Sheet } from "../components/Sheet";
import { Spinner } from "../components/Spinner";
import { Icon } from "../components/icons/Icon";
import { useStatusBar } from "../hooks/useStatusBar";
import { OS } from "../platform/platform";
import { THEME, THEME_CHOICE } from "../platform/theme";
import { AVATAR_COLORS, AVATAR_NAMES } from "./avatars";
import { ProfileAvatar } from "./ProfileAvatar";
import { APP, setCurrentProfile } from "./session";
import { AppIcon } from "../components/AppBrand";
import "./ProfilePicker.css";
import "../auth/auth.css";

const MAX = 5; // 서버 MAX_PROFILES 와 같게

// 접속하면 제일 먼저 나오는 프로필 고르기 (넷플릭스 "누가 시청하나요?"를 카카오뱅크 느낌으로)
// 프로필마다 은행 데이터(계좌·거래·받는 분)와 기기/테마 설정이 따로 저장된다.
export function ProfilePicker({ onEnter }: { onEnter: () => void }) {
  // 콕뱅크는 다크 화면뿐 → 프로필 고르기도 콕뱅크 바탕색
  useStatusBar(APP === "nh" ? "#18171c" : APP === "hana" ? (THEME === "dark" ? "#191a1c" : "#ffffff") : "var(--home-bg)", APP === "nh" || THEME === "dark" ? "light" : "dark");
  const list = useApi<AppProfile[]>(paths.profiles);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<AppProfile | "new" | null>(null);

  const enter = (p: AppProfile) => {
    setCurrentProfile(p.id);
    // 이 프로필이 지난번에 쓰던 기기/테마가 지금과 다르면 그걸로 다시 연다
    // (OS/THEME는 앱이 켜질 때 한 번 정해지는 값이라 새로 불러와야 바뀜)
    const os = p.os ?? OS;
    const theme = p.theme ?? THEME_CHOICE;
    if (os !== OS || theme !== THEME_CHOICE) location.assign(`/?os=${os}&theme=${theme}`);
    else onEnter();
  };

  const profiles = list.data ?? [];
  return (
    <div className={`screen picker picker--${APP}`}>
      <div className="picker__brand">
        {/* 콕뱅크 서버면 콕 아이콘 */}
        <AppIcon size={46} />
      </div>
      <h1 className="picker__title">{managing ? "프로필 관리" : "누구의 은행을 열까요?"}</h1>
      <p className="picker__desc">{managing ? "수정할 프로필을 눌러 주세요" : "프로필마다 계좌와 거래내역이 따로 저장돼요"}</p>

      {list.status === "loading" ? (
        <div className="picker__loading">
          <Spinner size={26} color="#9a9a9a" />
        </div>
      ) : list.status === "error" ? (
        <p className="picker__desc">서버에 연결하지 못했어요. 새로고침해 주세요.</p>
      ) : (
        <div className="picker__grid fade-in">
          {profiles.map((p) => (
            <button key={p.id} className="picker__item" onClick={() => (managing ? setEditing(p) : enter(p))}>
              <span className="picker__avatar-wrap">
                <ProfileAvatar profile={p} size={92} />
                {managing && (
                  <span className="picker__pencil">
                    <Icon name="pencil" size={18} />
                  </span>
                )}
              </span>
              <span className="picker__name">{p.name}</span>
            </button>
          ))}
          {profiles.length < MAX && (
            <button className="picker__item" onClick={() => setEditing("new")}>
              <span className="picker__add">
                <Icon name="plus" size={34} stroke={1.6} />
              </span>
              <span className="picker__name picker__name--sub">프로필 추가</span>
            </button>
          )}
        </div>
      )}

      <button className="picker__manage" onClick={() => setManaging(!managing)}>
        {managing ? "완료" : "프로필 관리"}
      </button>
      <AccountRow />

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ProfileForm
            // 다른 프로필을 열면 폼을 새로 만들어 값 초기화
            key={editing === "new" ? "new" : editing.id}
            target={editing}
            canDelete={profiles.length > 1}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function ProfileForm({ target, canDelete, onDone }: { target: AppProfile | "new"; canDelete: boolean; onDone: () => void }) {
  const isNew = target === "new";
  const [name, setName] = useState(isNew ? "" : target.name);
  const [avatar, setAvatar] = useState(isNew ? AVATAR_NAMES[0] : target.avatar);
  const [color, setColor] = useState(isNew ? AVATAR_COLORS[0] : target.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    call(() => (isNew ? api.addProfile({ name, avatar, color }) : api.updateProfileCard(target.id, { name, avatar, color })));

  return (
    <div className="profile-form">
      <h2>{isNew ? "새 프로필" : "프로필 수정"}</h2>
      <div className="profile-form__preview">
        <ProfileAvatar profile={{ avatar, color }} size={84} />
      </div>
      <input
        className="profile-form__name"
        value={name}
        maxLength={10}
        placeholder="이름 (10자까지)"
        onChange={(e) => setName(e.target.value)}
      />
      <div className="profile-form__avatars">
        {AVATAR_NAMES.map((a) => (
          <button key={a} className={a === avatar ? "on" : ""} onClick={() => setAvatar(a)} aria-label={a}>
            <ProfileAvatar profile={{ avatar: a, color }} size={44} />
          </button>
        ))}
      </div>
      <div className="profile-form__colors">
        {AVATAR_COLORS.map((c) => (
          <button key={c} className={c === color ? "on" : ""} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
        ))}
      </div>
      {isNew && <p className="profile-form__hint">새 프로필은 카카오뱅크 통장 0원만 있는 빈 상태로 시작해요.</p>}
      <button className="cta" disabled={!name.trim() || busy} onClick={save}>
        {isNew ? "만들기" : "저장"}
      </button>
      {!isNew && canDelete && (
        <button className="profile-form__delete" onClick={() => setConfirmDelete(true)}>
          프로필 삭제
        </button>
      )}
      <Dialog
        message={confirmDelete ? `${name || "이 프로필"}을(를) 삭제할까요?\n계좌·거래내역도 모두 지워져요.` : null}
        onCancel={() => setConfirmDelete(false)}
        onClose={() => {
          setConfirmDelete(false);
          if (!isNew) call(() => api.deleteProfile(target.id));
        }}
      />
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

// 로그인한 계정: 아이디 · 남은 기간 · 로그아웃 (관리자는 계정 관리 창)
function AccountRow() {
  const auth = useAuth();
  const [adminOpen, setAdminOpen] = useState(false);
  if (auth.status !== "in") return null;
  const u = auth.user;
  return (
    <div className="picker__account">
      <span>
        {u.username} · {remaining(u)}
      </span>
      {u.role === "admin" && <button onClick={() => setAdminOpen(true)}>계정 관리</button>}
      <button onClick={logout}>로그아웃</button>
      {adminOpen && createPortal(<AdminPanel onClose={() => setAdminOpen(false)} />, document.body)}
    </div>
  );
}
