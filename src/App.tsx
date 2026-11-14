import { lazy, Suspense } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { InvitationEntry } from "./components/invitation/InvitationEntry";
import { Showcase } from "./components/Showcase";
import { Mark, Note } from "./components/ui";
import { Event } from "./pages/Event";
import { Forest } from "./pages/Forest";
import { Invitation } from "./pages/Invitation";
import { Nominate } from "./pages/Nominate";
import { Participant } from "./pages/Participant";
import { Survey } from "./pages/Survey";

const Admin = lazy(() => import("./admin/Admin").then((m) => ({ default: m.Admin })));
const Tree = lazy(() => import("./pages/Tree").then((m) => ({ default: m.Tree })));
export function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
function AppShell() {
  const location = useLocation();
  const inviting = location.pathname === "/invite";
  return (
    <>
      <button
        type="button"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("content")?.focus();
        }}
      >
        본문으로 이동
      </button>
      {!inviting && (
        <header className="site-header">
          <Link to="/login" state={{ invitationPassed: true }} className="brand">
            <Mark />한 걸음 더 가까이
          </Link>
          <span className="overline">2026 · 함께의 기록</span>
        </header>
      )}
      <div id="content" tabIndex={-1}>
        <Suspense
          fallback={
            <main className="guest">
              <Note>화면을 준비하고 있습니다.</Note>
            </main>
          }
        >
          <Routes>
            <Route path="/invite" element={<Invitation />} />
            <Route path="/login" element={<InvitationEntry />} />
            <Route path="/admin" element={<Admin />} />
            <Route element={<Participant />}>
              <Route path="/survey" element={<Survey />} />
              <Route path="/nominate" element={<Nominate />} />
              <Route path="/forest" element={<Forest />} />
              <Route path="/tree" element={<Tree />} />
              <Route path="/event" element={<Event />} />
              {["waiting", "memories", "game/who-am-i", "game/tastes", "awards", "end"].map((path) => (
                <Route key={path} path={`/${path}`} element={<Navigate to="/event" replace />} />
              ))}
            </Route>
            {import.meta.env.DEV && <Route path="/showcase" element={<Showcase />} />}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </div>
      {!inviting && <footer className="footer">A LITTLE CLOSER, TOGETHER. · 2026</footer>}
    </>
  );
}
