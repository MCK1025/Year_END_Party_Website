import { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigationType } from "react-router-dom";
import { motionMedia, motionPolicy, safeRoute } from "../../lib/motion";
import { traceMotion } from "../../lib/motionDebug";
import { startTurn } from "./bookTurn";
import { useBookView } from "./preferences";

const chapters = [
  { path: "/survey", name: "나의 이야기" },
  { path: "/nominate", name: "고마운 동료" },
  { path: "/forest", name: "대나무숲" },
  { path: "/event", name: "행사장" },
  { path: "/tree", name: "마음 트리" },
] as const;
export function BookLayout({
  children,
  treeOpen,
  status,
  revision,
  scene,
}: {
  readonly children: ReactNode;
  readonly treeOpen: boolean;
  readonly status: ReactNode;
  readonly revision: number;
  readonly scene: string;
}) {
  const { pathname, state, key } = useLocation();
  const action = useNavigationType();
  const { still } = useBookView();
  const pages = treeOpen ? chapters : chapters.slice(0, -1);
  const index = pages.findIndex((p) => p.path === pathname);
  const paper = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const previous = useRef({ pathname, key, revision, scene, still });
  const cancel = useRef<((reason: string) => void) | null>(null);
  const scrolls = useRef(new Map<string, number>());
  useLayoutEffect(() => () => cancel.current?.("COMPONENT_UNMOUNTED"), []);
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, key, revision, scene, still };
    const moved = prior.pathname !== pathname,
      changed = prior.scene !== scene;
    if (moved || changed || prior.still !== still) {
      cancel.current?.(changed ? "EVENT_STATE_CHANGED" : moved ? "ROUTE_SUPERSEDED" : "POLICY_CHANGED");
      cancel.current = null;
    }
    const trace = traceMotion("book");
    if (!moved) {
      if (changed || prior.still !== still || prior.key !== key)
        trace(
          changed ? "EVENT_STATE_CHANGED" : still ? "USER_PAGE_EFFECTS_DISABLED" : "NAVIGATION_NOT_ELIGIBLE",
          { mode: "none" },
        );
      return;
    }
    scrolls.current.set(prior.key, window.scrollY);
    paper.current?.focus({ preventScroll: true });
    window.scrollTo(0, action === "POP" ? (scrolls.current.get(key) ?? 0) : 0);
    const policy = motionPolicy(motionMedia()?.matches, still);
    const matches = state?.bookFrom === prior.pathname;
    trace("REQUEST", {
      from: safeRoute(prior.pathname),
      to: safeRoute(pathname),
      navigation: action,
      bookFromMatches: matches,
      revisionChanged: revision !== prior.revision,
      eventChanged: changed,
      pageEffectsOff: still,
      reduced: motionMedia()?.matches ?? null,
      hidden: document.hidden,
    });
    const reason =
      policy !== "ALLOWED"
        ? policy
        : changed
          ? "EVENT_STATE_CHANGED"
          : action === "POP"
            ? "NAVIGATION_POP"
            : !matches
              ? "NAVIGATION_NOT_ELIGIBLE"
              : document.hidden
                ? "DOCUMENT_HIDDEN"
                : null;
    if (reason || !sheet.current) {
      trace(reason ?? "ZERO_SIZE", { mode: "none" });
      return;
    }
    cancel.current = startTurn(
      sheet.current,
      chapters.findIndex((p) => p.path === prior.pathname) < index,
      trace,
    );
  }, [pathname, key, revision, scene, still, action, index, state]);
  function ignoreRepeatedClick(event: MouseEvent<HTMLElement>) {
    if (event.detail > 1 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
      event.preventDefault();
  }
  const where = { bookFrom: pathname };
  const prev = pages[index - 1],
    next = pages[index + 1];
  return (
    <main className="notebook">
      <aside className="book-index">
        <p className="book-index-label">목차</p>
        <nav aria-label="내 행사 메뉴" onClickCapture={ignoreRepeatedClick}>
          {pages.map((p, i) => (
            <NavLink
              key={p.path}
              to={p.path}
              state={where}
              onClick={(e) => {
                if (p.path === pathname && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                  traceMotion("book")("SAME_PAGE", { mode: "none", from: safeRoute(pathname) });
                  e.preventDefault();
                }
              }}
            >
              <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              {p.name}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="book-leaf">
        <div className="book-status">{status}</div>
        <section className="book-surface" ref={paper} aria-label={pages[index]?.name ?? "행사"} tabIndex={-1}>
          {children}
          <div className="book-turn" ref={sheet} aria-hidden="true" />
        </section>
        <footer className="book-pager" onClickCapture={ignoreRepeatedClick}>
          {prev && (
            <Link to={prev.path} state={where}>
              ← 이전 장
            </Link>
          )}
          <span aria-hidden="true">{index >= 0 ? String(index + 1).padStart(2, "0") : "—"}</span>
          {next && (
            <Link to={next.path} state={where}>
              다음 장 →
            </Link>
          )}
        </footer>
      </div>
    </main>
  );
}
