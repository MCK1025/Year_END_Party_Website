import { createContext, useContext, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Bootstrap } from "../../supabase/functions/_shared/contracts";
import { BookLayout } from "../components/book/BookLayout";
import { EmployeeDrafts } from "../components/book/drafts";
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
  const { data, error, connection, refresh, refreshAfterSave } = useParticipant();
  const navigate = useNavigate();
  const location = useLocation();
  const treeSeen = useRef(false);
  const treeOpen = data?.state.tree_open ?? false;
  useEffect(() => {
    if (treeOpen && !treeSeen.current) navigate("/tree");
    if (!treeOpen && treeSeen.current && location.pathname === "/tree") navigate("/event", { replace: true });
    treeSeen.current = treeOpen;
  }, [treeOpen, navigate, location.pathname]);
  useEffect(() => {
    let authId: string | undefined;
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user.id;
      if (event === "SIGNED_OUT" || (authId && next !== authId)) {
        navigate("/login", { replace: true, state: { invitationPassed: true } });
      }
      authId = next;
    });
    return () => auth.subscription.unsubscribe();
  }, [navigate]);
  if (!data)
    return (
      <main className="guest stack">
        <h1>우리의 자리로.</h1>
        {error ? (
          <>
            <Note error>{error}</Note>
            <Link to="/login" state={{ invitationPassed: true }} className="button primary">
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
    <Context.Provider value={{ data, refresh: refreshAfterSave }}>
      <EmployeeDrafts key={data.self.id}>
        <BookLayout
          treeOpen={treeOpen}
          revision={data.state.revision}
          status={
            <>
              <span className="status">{connection}</span>
              <span className="small">{data.self.name} 님</span>

              <Button
                variant="secondary"
                onClick={() => {
                  void supabase.auth
                    .signOut()
                    .then(() => navigate("/login", { state: { invitationPassed: true } }));
                }}
              >
                로그아웃
              </Button>
            </>
          }
        >
          {error && <Note error>{error}</Note>}
          <Outlet />
        </BookLayout>
      </EmployeeDrafts>
    </Context.Provider>
  );
}
