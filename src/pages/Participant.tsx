import { createContext, useContext } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import type { Bootstrap } from "../../supabase/functions/_shared/contracts";
import { Button, Note } from "../components/ui";
import { supabase } from "../lib/api";
import { useParticipant } from "../lib/useParticipant";

const Context = createContext<{ readonly data: Bootstrap; readonly refresh: () => Promise<void> } | null>(
  null,
);
export function useGuest() {
  const value = useContext(Context);
  if (!value) throw new Error("Participant context missing");
  return value;
}
export function Participant() {
  const { data, error, connection, refresh } = useParticipant();
  const navigate = useNavigate();
  if (!data)
    return (
      <main className="guest stack">
        <h1>우리의 자리로.</h1>
        {error ? (
          <>
            <Note error>{error}</Note>
            <Link to="/login" className="button primary">
              다시 본인 확인하기
            </Link>
            <Button variant="secondary" onClick={() => void refresh()}>
              다시 연결하기
            </Button>
          </>
        ) : (
          <Note>초대장을 확인하는 중입니다.</Note>
        )}
      </main>
    );
  return (
    <Context.Provider value={{ data, refresh }}>
      <main className="guest">
        <div className="actions" style={{ marginBottom: "var(--s6)", justifyContent: "space-between" }}>
          <span className="status">{connection}</span>
          <span className="small">{data.self.name} 님</span>
        </div>
        {error && <Note error>{error}</Note>}
        <nav aria-label="내 행사 메뉴" className="guest-nav">
          <NavLink to="/survey">나의 이야기</NavLink>
          <NavLink to="/nominate">고마운 동료</NavLink>
          <NavLink to="/event">행사장</NavLink>
        </nav>
        <Outlet />
        <div style={{ marginTop: "var(--s12)" }}>
          <Button
            variant="secondary"
            onClick={() => {
              void supabase.auth.signOut().then(() => navigate("/login"));
            }}
          >
            로그아웃
          </Button>
        </div>
      </main>
    </Context.Provider>
  );
}
