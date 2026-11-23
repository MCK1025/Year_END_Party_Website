import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motionMedia, motionPolicy, observeMotion } from "../../lib/motion";
import { useBookView } from "../book/preferences";
import { turnReadingPage } from "../book/turnReadingPage";
import { usePageSwipe } from "../book/usePageSwipe";
import { Button, Note } from "../ui";
import { AlbumPhoto } from "./AlbumPhoto";
import { BookOpening } from "./BookOpening";
import { type AlbumPage, albumOf, albumPages, type Moment } from "./model";
import "../../styles/recap.css";

// Only opaque page IDs live in this tab. No photos, descriptions or signed URLs are persisted.
function bookmark(key?: string) {
  try {
    return key ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function remember(key: string | undefined, page: string) {
  try {
    if (key) sessionStorage.setItem(key, page);
  } catch {
    /* Reading remains available. */
  }
}

function PageCaption({ page }: { readonly page: AlbumPage }) {
  const title = page.detail ? page.detail.title : page.moment.caption;
  const text = page.detail ? page.detail.description : albumOf(page.moment).introduction;
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Long descriptions can be scrolled with the keyboard.
    <section className="album-caption" tabIndex={0} aria-label="장면 설명">
      {page.detail?.date && <time dateTime={page.detail.date}>{page.detail.date}</time>}
      {title && <h2>{title}</h2>}
      {text && <p>{text}</p>}
    </section>
  );
}

export function AlbumViewer({
  rows,
  storageKey,
  preview = false,
}: {
  readonly rows: readonly Moment[];
  readonly storageKey?: string;
  readonly preview?: boolean;
}) {
  const pages = useMemo(() => albumPages(rows), [rows]);
  const { still } = useBookView();
  const [selected, setSelected] = useState(() => bookmark(storageKey));
  const [opening, setOpening] = useState(
    () =>
      !!pages.length && !bookmark(storageKey) && motionPolicy(motionMedia()?.matches, still) === "ALLOWED",
  );
  const requestedTurn = useRef<{ id: string; forward: boolean } | null>(null);
  const index = Math.max(
    0,
    pages.findIndex((p) => p.id === selected),
  );
  const page = pages[index];
  const pageId = page?.id;
  const paper = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLElement>(null);
  const swipe = usePageSwipe(move);
  useEffect(() => {
    if (!preview) viewer.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [preview]);
  useEffect(() => {
    if (pageId) remember(storageKey, pageId);
  }, [storageKey, pageId]);
  useLayoutEffect(() => {
    const request = requestedTurn.current;
    requestedTurn.current = null;
    if (request && request.id === pageId && paper.current) {
      return turnReadingPage(paper.current, request.forward, still, { duration: 420 });
    }
  }, [pageId, still]);
  useEffect(() => {
    if (!opening) return;
    const media = motionMedia();
    const check = () => {
      if (motionPolicy(media?.matches, still) !== "ALLOWED") setOpening(false);
    };
    check();
    const stop = observeMotion(media, check);
    const timer = window.setTimeout(() => setOpening(false), 3050);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [opening, still]);
  if (!page) return <Note>첫 번째 Moment를 준비하고 있습니다.</Note>;
  function move(by: 1 | -1) {
    const next = pages[index + by];
    if (opening || !next) return;
    requestedTurn.current = { id: next.id, forward: by > 0 };
    setSelected(next.id);
  }
  const album = albumOf(page.moment);
  const adjacent = [
    ...new Set(
      pages
        .slice(Math.max(0, index - 1), index + 2)
        .map((p) => p.photo)
        .filter((path): path is string => !!path),
    ),
  ];
  return (
    <section
      className="recap-album"
      ref={viewer}
      aria-label="1년 회고"
      data-opening={opening}
      data-still={still}
    >
      <header className="album-heading">
        <h1>1년의 장면들</h1>
        <span>MOMENT {String(page.number).padStart(2, "0")}</span>
      </header>
      <div className="album-stage" {...swipe}>
        <div
          className="album-volume"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && e.animationName === "album-unfold") setOpening(false);
          }}
        >
          <div className="album-page" ref={paper} inert={opening} aria-hidden={opening || undefined}>
            <div className="album-picture">
              {adjacent.map((path) => (
                <div className="album-image-slot" key={path} hidden={path !== page.photo}>
                  <AlbumPhoto
                    path={path}
                    alt={
                      path === page.photo
                        ? page.detail?.title || page.detail?.description || page.moment.caption
                        : ""
                    }
                    style={{
                      objectFit: page.detail ? "contain" : album.fit,
                      objectPosition: page.detail ? "center" : `${album.x}% ${album.y}%`,
                    }}
                  />
                </div>
              ))}
              {!page.photo && (
                <div className="album-placeholder">
                  <span aria-hidden="true" className="album-photo-mark">
                    ▧
                  </span>
                  {page.detail ? "등록된 상세 사진이 없습니다." : "등록된 대표 사진이 없습니다."}
                </div>
              )}
            </div>
            <PageCaption key={page.id} page={page} />
          </div>
          {opening && <BookOpening />}
        </div>
      </div>
      <nav className="album-controls" aria-label="회고 슬라이드 이동">
        {opening ? (
          <Button variant="secondary" onClick={() => setOpening(false)}>
            오프닝 건너뛰기
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={index === 0} onClick={() => move(-1)}>
              ← 이전
            </Button>
            <span aria-live="polite" aria-atomic="true">
              {index + 1} / {pages.length}
              {index === pages.length - 1 && <small className="album-end">마지막 장</small>}
            </span>
            <Button variant="secondary" disabled={index === pages.length - 1} onClick={() => move(1)}>
              다음 →
            </Button>
          </>
        )}
      </nav>
    </section>
  );
}
