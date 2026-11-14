import { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigationType } from "react-router-dom";
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
}: {
  readonly children: ReactNode;
  readonly treeOpen: boolean;
  readonly status: ReactNode;
  readonly revision: number;
}) {
  const { pathname, state, key } = useLocation();
  const action = useNavigationType();
  const { still } = useBookView();
  const pages = treeOpen ? chapters : chapters.slice(0, -1);
  const index = pages.findIndex((p) => p.path === pathname);
  const paper = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const previous = useRef({ pathname, key, revision });
  const scrolls = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, key, revision };
    const surface = paper.current;
    const leaf = sheet.current;
    if (!surface || !leaf || prior.pathname === pathname) return;
    scrolls.current.set(prior.key, window.scrollY);
    surface.focus({ preventScroll: true });
    window.scrollTo(0, action === "POP" ? (scrolls.current.get(key) ?? 0) : 0);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (
      prior.revision !== revision ||
      still ||
      reduced.matches ||
      action === "POP" ||
      state?.bookFrom !== prior.pathname ||
      document.hidden ||
      !leaf.animate
    )
      return;
    const forward = chapters.findIndex((p) => p.path === prior.pathname) < index;
    let animation: Animation;
    try {
      animation = leaf.animate(
        forward
          ? [
              { transform: "rotateY(0deg)", opacity: 1 },
              { transform: "rotateY(-91deg)", opacity: 0 },
            ]
          : [
              { transform: "rotateY(-91deg)", opacity: 0 },
              { transform: "rotateY(-12deg)", opacity: 0.85, offset: 0.72 },
              { transform: "rotateY(0deg)", opacity: 0 },
            ],
        { duration: 480, easing: "ease-in-out" },
      );
    } catch {
      return;
    }
    leaf.dataset.turn = forward ? "forward" : "backward";
    function stop() {
      animation.cancel();
      if (leaf) delete leaf.dataset.turn;
    }
    const timer = window.setTimeout(stop, 850);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      stop();
      reduced.removeEventListener("change", finish);
      window.removeEventListener("resize", finish);
      document.removeEventListener("visibilitychange", finish);
    };
    reduced.addEventListener("change", finish);
    window.addEventListener("resize", finish);
    document.addEventListener("visibilitychange", finish);
    void animation.finished.then(finish, finish);
    return finish;
  }, [action, index, key, pathname, state, still, revision]);
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
                if (p.path === pathname && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey)
                  e.preventDefault();
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
