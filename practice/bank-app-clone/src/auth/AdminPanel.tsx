import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { APP } from "../profile/session";
import { admin, changePassword, remaining, type ManagedUser, type Plan } from "./auth";
import "./auth.css";

const PLAN_LABEL: Record<Plan, string> = { "1": "1일", "7": "7일", "30": "30일", forever: "영구" };
const PLANS: Plan[] = ["1", "7", "30", "forever"];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-");

// 관리자 화면 (폰 밖, 페이지 위에 뜨는 창): 계정 만들기 · 기간 바꾸기/연장 · 정지 · 비밀번호 초기화 · 삭제
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    admin.users().then(setUsers, (e) => setError(e instanceof ApiError ? e.message : "불러오지 못했어요"));
  }, []);
  useEffect(load, [load]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };

  // 새 계정
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<Plan>("7");

  return (
    <div className="admin" role="dialog" aria-label="계정 관리">
      <div className="admin__box">
        <header className="admin__head">
          <h2>{APP === "nh" ? "NH콕뱅크" : "카카오뱅크"} 계정 관리</h2>
          <button onClick={onClose}>닫기</button>
        </header>

        <section className="admin__create">
          <h3>새 계정</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await admin.create({ username: username.trim(), password, plan });
                setUsername("");
                setPassword("");
              }, `${username.trim()} 계정을 만들었어요 (${PLAN_LABEL[plan]})`);
            }}
          >
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디 (영문·숫자 3~20자)" autoCapitalize="off" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (4자 이상)" />
            <div className="admin__plans">
              {PLANS.map((p) => (
                <button type="button" key={p} className={p === plan ? "on" : ""} onClick={() => setPlan(p)}>
                  {PLAN_LABEL[p]}
                </button>
              ))}
            </div>
            <button className="admin__primary" disabled={!username.trim() || !password}>
              만들기
            </button>
          </form>
          <p className="admin__hint">기간은 만든 순간부터 줄어들어요. 끝나면 로그인이 막히고, 연장하면 다시 쓸 수 있어요 (데이터는 그대로).</p>
        </section>

        {error && <p className="admin__error">{error}</p>}
        {notice && <p className="admin__notice">{notice}</p>}

        <section>
          <h3>계정 {users ? `(${users.length})` : ""}</h3>
          {!users ? (
            <p className="admin__hint">불러오는 중…</p>
          ) : (
            <div className="admin__list">
              {users.map((u) => (
                <UserRow key={u.id} u={u} run={run} />
              ))}
            </div>
          )}
        </section>

        <MyPassword run={run} />
      </div>
    </div>
  );
}

function UserRow({ u, run }: { u: ManagedUser; run: (fn: () => Promise<unknown>, ok?: string) => void }) {
  const isAdmin = u.role === "admin";
  const status = u.disabled ? "정지" : u.expired ? "기간 끝남" : remaining(u);
  return (
    <div className={`admin__user${u.disabled || u.expired ? " off" : ""}`}>
      <div className="admin__user-main">
        <b>{u.username}</b>
        {isAdmin && <em>관리자</em>}
        <span className={`admin__status${u.disabled || u.expired ? " off" : ""}`}>{status}</span>
      </div>
      <div className="admin__meta">
        {isAdmin ? "기간 없음" : `${PLAN_LABEL[u.plan]} · 끝: ${fmt(u.expiresAt)}`} · 만든 날 {fmt(u.createdAt)} · 마지막 로그인 {fmt(u.lastLogin)} · 프로필 {u.profiles}개
      </div>
      <div className="admin__actions">
        {!isAdmin && (
          <>
            <span>연장</span>
            {PLANS.map((p) => (
              <button key={p} onClick={() => run(() => admin.update(u.id, { extend: p }), `${u.username}: ${PLAN_LABEL[p]} 연장`)}>
                +{PLAN_LABEL[p]}
              </button>
            ))}
            <button onClick={() => run(() => admin.update(u.id, { disabled: !u.disabled }), `${u.username}: ${u.disabled ? "정지 풀림" : "정지됨"}`)}>
              {u.disabled ? "정지 풀기" : "정지"}
            </button>
          </>
        )}
        <button
          onClick={() => {
            const pw = prompt(`${u.username}의 새 비밀번호 (4자 이상)`);
            if (pw) run(() => admin.update(u.id, { password: pw }), `${u.username}: 비밀번호를 바꿨어요`);
          }}
        >
          비밀번호 바꾸기
        </button>
        {!isAdmin && (
          <button
            className="danger"
            onClick={() => {
              if (confirm(`${u.username} 계정을 지울까요?\n프로필과 은행 데이터도 모두 지워져요.`)) run(() => admin.remove(u.id), `${u.username} 계정을 지웠어요`);
            }}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function MyPassword({ run }: { run: (fn: () => Promise<unknown>, ok?: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <section className="admin__create">
      <h3>내(관리자) 비밀번호 바꾸기</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await changePassword(current, next);
            setCurrent("");
            setNext("");
          }, "비밀번호를 바꿨어요");
        }}
      >
        <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="지금 비밀번호" type="password" />
        <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="새 비밀번호 (4자 이상)" type="password" />
        <button className="admin__primary" disabled={!current || !next}>
          바꾸기
        </button>
      </form>
    </section>
  );
}
