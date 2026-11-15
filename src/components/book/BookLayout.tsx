import { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigationType } from "react-router-dom";
import type { EventState } from "../../../supabase/functions/_shared/contracts";
import { motionMedia, motionPolicy, safeRoute } from "../../lib/motion";
import { traceMotion } from "../../lib/motionDebug";
import { freezeTurn } from "./bookTurn";
import { useBookView } from "./preferences";
import { useLivePageTurn } from "./useLivePageTurn";
import { BeforeBookMove } from "./useSavedNavigation";

const chapters = [
  { path: "/survey", name: "나의 이야기" },
  { path: "/nominate", name: "고마운 동료" },
  { path: "/forest", name: "이야기 트리" },
  { path: "/event", name: "행사장" },
  { path: "/tree", name: "공개 트리" },
] as const;
export function BookLayout({
  children,
  treeOpen,
  event,
  status,
  scene,
}: {
  readonly children: ReactNode;
  readonly treeOpen: boolean;
  readonly event: EventState;
  readonly status: ReactNode;
  readonly scene: string;
}) {
  const { pathname, state, key } = useLocation();
  const action = useNavigationType();
  const { still, plain } = useBookView();
  const pages = treeOpen ? chapters : chapters.slice(0, -1);
  const index = pages.findIndex((p) => p.path === pathname);
  const paper = useRef<HTMLElement>(null);
  const revision = event.revision;
  const liveTurn = useLivePageTurn(paper, pathname === "/event" ? event : null);
  const turn = useRef<ReturnType<typeof freezeTurn>>(null);
  const destination = useRef("");
  const previous = useRef({ pathname, key, scene, still, plain, revision });
  const scrolls = useRef(new Map<string, number>());
  const composing = useRef(false);
  const pendingIme = useRef<HTMLAnchorElement | null>(null);
  function prepare(to: string) {
    liveTurn.current?.cancel();
    turn.current?.end("ROUTE_SUPERSEDED");
    if (!paper.current || to === pathname || !pages.some((p) => p.path === to)) return;
    const trace = traceMotion("book");
    const policy = motionPolicy(motionMedia()?.matches, still);
    trace("REQUEST", {
      from: safeRoute(pathname),
      to: safeRoute(to),
      navigation: "PUSH",
      bookFromMatches: true,
      pageEffectsOff: still,
      revisionChanged: previous.current.revision !== revision,
      eventChanged: previous.current.scene !== scene,
      reduced: motionMedia()?.matches ?? null,
      hidden: document.hidden,
    });
    if (
      policy !== "ALLOWED" ||
      document.hidden ||
      pathname === "/tree" ||
      to === "/tree" ||
      composing.current
    ) {
      trace(policy !== "ALLOWED" ? policy : document.hidden ? "DOCUMENT_HIDDEN" : "SNAPSHOT_UNSUPPORTED", {
        mode: "none",
      });
      return;
    }
    destination.current = to;
    const surface = paper.current;
    turn.current = freezeTurn(surface, index < pages.findIndex((p) => p.path === to), trace, (reason) => {
      const top = turn.current?.top ?? 0;
      turn.current = null;
      if (
        ![
          "COMPONENT_UNMOUNTED",
          "AUTH_CHANGED",
          "ROUTE_SUPERSEDED",
          "EVENT_STATE_CHANGED",
          "DOCUMENT_HIDDEN",
        ].includes(reason)
      ) {
        window.scrollTo(0, scrollY + surface.getBoundingClientRect().top - top);
        surface.focus({ preventScroll: true });
      }
    });
  }
  useLayoutEffect(() => () => turn.current?.end("COMPONENT_UNMOUNTED"), []);
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, key, scene, still, plain, revision };
    const moved = prior.pathname !== pathname;
    if (moved || prior.scene !== scene) {
      pendingIme.current = null;
      composing.current = false;
    }
    if (prior.scene !== scene) turn.current?.end("EVENT_STATE_CHANGED");
    if (prior.plain !== plain) turn.current?.end("TYPEFACE_CHANGED");
    if (prior.still !== still) turn.current?.end("POLICY_CHANGED");
    if (!moved) return;
    scrolls.current.set(prior.key, window.scrollY);
    if (
      turn.current &&
      destination.current === pathname &&
      state?.bookFrom === prior.pathname &&
      action !== "POP"
    ) {
      turn.current.commit();
      return;
    }
    turn.current?.end("ROUTE_SUPERSEDED");
    if (action === "POP" || !state?.bookFrom)
      traceMotion("book")(action === "POP" ? "NAVIGATION_POP" : "NAVIGATION_NOT_ELIGIBLE", { mode: "none" });
    window.scrollTo(0, action === "POP" ? (scrolls.current.get(key) ?? 0) : 0);
    paper.current?.focus({ preventScroll: true });
  }, [pathname, key, scene, still, plain, revision, state, action]);
  function beforeLink(e: MouseEvent<HTMLElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target instanceof Element && e.target.closest(".book-status button"))
      turn.current?.end("AUTH_CHANGED");
    const link = e.target instanceof Element ? e.target.closest("a") : null;
    if (
      !link ||
      link.hasAttribute("download") ||
      link.target ||
      link.origin !== location.origin ||
      link.pathname !== location.pathname
    )
      return;
    const to = link.hash.slice(1);
    if (!pages.some((p) => p.path === to)) return;
    if (e.detail > 1 || to === pathname) {
      e.preventDefault();
      traceMotion("book")("SAME_PAGE", { mode: "none" });
      return;
    }
    if (composing.current) {
      e.preventDefault();
      pendingIme.current = link;
      return;
    }
    prepare(to);
  }
  const where = { bookFrom: pathname };
  const prev = pages[index - 1],
    next = pages[index + 1];
  return (
    <BeforeBookMove.Provider value={prepare}>
      <main
        className="notebook"
        onClickCapture={beforeLink}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          const link = pendingIme.current;
          pendingIme.current = null;
          if (link)
            queueMicrotask(() => {
              if (link.isConnected) link.click();
            });
        }}
      >
        <aside className="book-index">
          <p className="book-index-label">목차</p>
          <nav aria-label="내 행사 메뉴">
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
          <div className="book-frame">
            <div className="book-binding" aria-hidden="true" />
            <section
              className="book-surface"
              ref={paper}
              aria-label={pages[index]?.name ?? "행사"}
              tabIndex={-1}
            >
              {children}
            </section>
          </div>
          <footer className="book-pager">
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
    </BeforeBookMove.Provider>
  );
}
