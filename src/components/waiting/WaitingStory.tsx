import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { usePlaybackEnvironment } from "../../lib/usePlaybackEnvironment";
import { useBookView } from "../book/preferences";
import { usePageSwipe } from "../book/usePageSwipe";
import { usePaperPageTurn } from "../book/usePaperPageTurn";
import { FrameReadout } from "./FrameReadout";
import { StoryLight } from "./StoryLight";
import { imageUrl, scenes, storyAsset, unitPoint } from "./story";
import { useStoryPlayback } from "./useStoryPlayback";
import "./waiting.css";

export function WaitingStory({
  book = false,
  eventPaused = false,
  inspect = false,
}: {
  readonly book?: boolean;
  eventPaused?: boolean;
  inspect?: boolean;
}) {
  const plate = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPage, setManualPage] = useState(false);
  const [seek, setSeek] = useState<number | null>(null);
  const [markers, setMarkers] = useState(false);
  const [ready, setReady] = useState("");
  const [errors, setErrors] = useState<Record<string, true>>({});
  const scene = scenes[index] ?? scenes[0];
  const final = index === scenes.length - 1;
  const primary = imageUrl(index);
  const url = errors[primary] ? storyAsset(`scene-${index + 1}.jpg`) : primary;
  const loaded = ready === url;
  const { still } = useBookView();
  const { visible, reduced } = usePlaybackEnvironment(plate);
  const motionOff = reduced || still || typeof Element.prototype.animate !== "function";
  const staticView = motionOff || (manualPage && (paused || eventPaused) && seek === null);
  const playing =
    !staticView && !paused && !eventPaused && visible && seek === null && (loaded || !!errors[url]);
  const { sheet, prepare } = usePaperPageTurn(index, book, still);
  const move = useCallback(
    (delta: 1 | -1) => {
      prepare(delta > 0);
      setIndex((i) => (i + delta + scenes.length) % scenes.length);
    },
    [prepare],
  );
  const advance = useCallback(() => move(1), [move]);
  const clock = useStoryPlayback(sheet, scene, playing, staticView, seek, advance);
  useEffect(() => {
    if (!visible || !loaded) return;
    const next = (index + 1) % scenes.length;
    const urls = [imageUrl(next)];
    if (book) urls.push(imageUrl((index - 1 + scenes.length) % scenes.length));
    if (next === scenes.length - 1) urls.push(storyAsset("masero.png"), storyAsset("hyeseong.png"));
    for (const src of urls) new Image().src = src;
  }, [index, visible, loaded, book]);
  const [fx, fy] = unitPoint(scene.focus, scene.size);
  const go = (delta: 1 | -1) => {
    setManualPage(paused || eventPaused);
    move(delta);
  };
  const swipe = usePageSwipe(go);
  return (
    <section
      className="work-story"
      data-book={book || undefined}
      aria-label="혜성식품 업무 이야기"
      data-scene={index + 1}
      data-playing={playing}
      data-static={staticView}
    >
      {!motionOff && (
        <button
          className="work-story-play"
          type="button"
          onClick={() => {
            setSeek(null);
            setManualPage(false);
            setPaused(!paused);
          }}
          aria-label={paused ? "이야기 재생" : "이야기 일시 정지"}
        >
          {paused ? "재생" : "잠시 멈춤"}
        </button>
      )}
      <div className="work-story-spread" {...(book ? swipe : {})}>
        <div className="work-story-sheet" ref={sheet}>
          <header className="work-story-heading">
            <h2>{scene.title}</h2>
          </header>
          <div className="work-story-stage" ref={plate}>
            <div className="work-story-plate">
              <div
                className="work-story-art"
                style={
                  {
                    "--art-ratio": scene.size[0] / scene.size[1],
                    transformOrigin: `${fx * 100}% ${fy * 100}%`,
                  } as CSSProperties
                }
              >
                {!errors[url] ? (
                  <img
                    key={url}
                    className="work-story-image"
                    src={url}
                    alt={scene.alt}
                    onLoad={() => setReady(url)}
                    onError={() => setErrors((prev) => ({ ...prev, [url]: true }))}
                  />
                ) : (
                  <p className="work-story-missing">{scene.alt}</p>
                )}
                {!staticView && !errors[url] && (
                  <StoryLight scene={scene} clock={clock} seek={seek} paused={!playing} />
                )}
                {import.meta.env.DEV && inspect && markers && (
                  <svg
                    className="work-story-markers"
                    aria-label="원본 좌표와 효과 범위"
                    viewBox={`0 0 ${scene.size.join(" ")}`}
                  >
                    <rect width="100%" height="100%" fill="none" stroke="white" strokeDasharray="5 3" />
                    {scene.surface?.kind === "calendar" ? (
                      <rect
                        x={scene.surface.center[0] - scene.surface.radii[0]}
                        y={scene.surface.center[1] - scene.surface.radii[1]}
                        width={scene.surface.radii[0] * 2}
                        height={scene.surface.radii[1] * 2}
                        fill="#ffdd6666"
                        stroke="white"
                      />
                    ) : (
                      scene.surface && (
                        <ellipse
                          cx={scene.surface.center[0]}
                          cy={scene.surface.center[1]}
                          rx={scene.surface.radii[0]}
                          ry={scene.surface.radii[1]}
                          fill="#ffdd6666"
                          stroke="white"
                        />
                      )
                    )}
                    {Object.entries(scene.anchors).map(([name, [x, y]], i) => (
                      <g key={name}>
                        <circle cx={x} cy={y} r={scene.size[0] * 0.006} fill="#092c2e" stroke="white" />
                        <text
                          x={x + 4}
                          y={y - 5}
                          fontSize={scene.size[0] * 0.028}
                          fill="white"
                          stroke="#102628"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>
          <div className="work-story-copy">
            <p className={final ? "work-story-finale-message" : undefined}>{scene.caption}</p>
            {final && (
              <div className="work-story-brands">
                <img className="work-story-masero" src={storyAsset("masero.png")} alt="마세로" />
                <img
                  className="work-story-company"
                  src={storyAsset("hyeseong.png")}
                  alt="주식회사 혜성식품"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <fieldset className="work-story-nav">
        <legend className="sr-only">업무 이야기 장면</legend>
        <button type="button" aria-label="이전 장면" onClick={() => go(-1)}>
          ←
        </button>
        <div className="work-story-position">
          <span>{String(index + 1).padStart(2, "0")} / 06</span>
          <div aria-hidden="true">
            {scenes.map((s, i) => (
              <span key={s.alt} className={i === index ? "current" : undefined} />
            ))}
          </div>
        </div>
        <button type="button" aria-label="다음 장면" onClick={() => go(1)}>
          →
        </button>
      </fieldset>
      {import.meta.env.DEV && inspect && (
        <fieldset className="work-story-debug">
          <legend>원본 정합성 확인</legend>
          <FrameReadout plate={plate} />
          <label>
            <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} /> 앵커
            표시
          </label>
          <label>
            장면 진행률{" "}
            <input
              type="range"
              min="0"
              max="100"
              value={(seek ?? 0) * 100}
              onChange={(e) => {
                setPaused(true);
                setSeek(Number(e.target.value) / 100);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              setSeek(0);
            }}
          >
            첫 프레임
          </button>
          <p>
            원본 {scene.size.join(" × ")} · 표시 영역 전체 · 줌{" "}
            {((scene.scale[0] + (scene.scale[1] - scene.scale[0]) * (seek ?? 0)) * 100).toFixed(1)}% (검사
            프레임)
          </p>
          <p>
            {Object.entries(scene.anchors)
              .map(([label, xy], i) => `${i + 1}. ${label} (${xy.join(", ")})`)
              .join(" · ")}
          </p>
          <p>
            {scene.surface ? "표시한 영역 안에서만 빛이 움직입니다." : "장비와 음식은 원본 안에 고정됩니다."}{" "}
            원본의 가림 순서를 유지합니다.
          </p>
        </fieldset>
      )}
    </section>
  );
}
