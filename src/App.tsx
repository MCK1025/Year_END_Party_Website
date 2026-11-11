import { lazy, Suspense } from "react";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Showcase } from "./components/Showcase";
import { Mark, Note } from "./components/ui";
import { Event } from "./pages/Event";
import { Login } from "./pages/Login";
import { Nominate } from "./pages/Nominate";
import { Participant } from "./pages/Participant";
import { Survey } from "./pages/Survey";

const Admin = lazy(() => import("./admin/Admin").then((m) => ({ default: m.Admin })));
export function App() {
  return (
    <HashRouter>
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
      <header className="site-header">
        <Link to="/login" className="brand">
          <Mark />한 걸음 더 가까이
        </Link>
        <span className="overline">2026 · 함께의 기록</span>
      </header>
      <div id="content" tabIndex={-1}>
        <Suspense
          fallback={
            <main className="guest">
              <Note>화면을 준비하고 있습니다.</Note>
            </main>
          }
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin />} />
            <Route element={<Participant />}>
              <Route path="/survey" element={<Survey />} />
              <Route path="/nominate" element={<Nominate />} />
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
      <footer className="footer">A LITTLE CLOSER, TOGETHER. · 2026</footer>
    </HashRouter>
  );
}
