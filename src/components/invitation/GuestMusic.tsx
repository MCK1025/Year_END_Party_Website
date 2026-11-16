import { SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import track from "../../assets/audio/year-end-night.mp3";
import { hasEnteredInvitation } from "../../lib/invitation";

const muteKey = "hyeseong:2026:music-muted";
type Status = "idle" | "starting" | "playing" | "blocked" | "error";
const Music = createContext<{ start: () => void; toggle: () => void; status: Status } | null>(null);

function savedMute() {
  try {
    return localStorage.getItem(muteKey) === "1";
  } catch {
    return false;
  }
}

export function GuestMusic({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (
    pathname === "/admin" ||
    pathname.startsWith("/preview/") ||
    pathname.startsWith("/dev/") ||
    pathname === "/showcase"
  )
    return children;
  return <MusicSession>{children}</MusicSession>;
}

function MusicSession({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [initialMute] = useState(savedMute);
  const muted = useRef(initialMute);
  const attempt = useRef(0);
  const [status, setStatus] = useState<Status>("idle");
  const { pathname } = useLocation();
  const resumeOnMount = useRef(pathname !== "/invite" && hasEnteredInvitation());

  const start = useCallback(() => {
    const player = audio.current;
    if (!player || muted.current || !player.paused) return;
    const id = ++attempt.current;
    player.muted = false;
    player.volume = 0.4;
    setStatus("starting");
    void player.play().catch((error: unknown) => {
      if (attempt.current === id) {
        setStatus(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
      }
    });
  }, []);

  useEffect(() => {
    const player = audio.current;
    if (resumeOnMount.current) start();
    return () => {
      attempt.current++;
      player?.pause();
    };
  }, [start]);

  useEffect(() => {
    if (status !== "blocked") return;
    const retry = (event: MouseEvent) => {
      if (event.isTrusted && !(event.target instanceof Element && event.target.closest(".music-control")))
        start();
    };
    window.addEventListener("click", retry, true);
    return () => window.removeEventListener("click", retry, true);
  }, [status, start]);

  function toggle() {
    const off = status === "playing" || status === "starting";
    muted.current = off;
    try {
      localStorage.setItem(muteKey, off ? "1" : "0");
    } catch {
      // The in-memory choice still applies to subsequent pages.
    }
    if (off && audio.current) {
      attempt.current++;
      audio.current.muted = true;
      audio.current.pause();
      setStatus("idle");
    } else start();
  }
  return (
    <Music.Provider value={{ start, toggle, status }}>
      {/* biome-ignore lint/a11y/useMediaCaption: Optional background music. All invitation and event information is presented in HTML. */}
      <audio
        ref={audio}
        src={track}
        preload="none"
        loop
        onPlaying={() => {
          if (!muted.current) setStatus("playing");
        }}
        onPause={() => {
          if (audio.current?.paused) setStatus("idle");
        }}
        onError={() => setStatus("error")}
      />
      {children}
    </Music.Provider>
  );
}

export const useStartMusic = () => useContext(Music)?.start;

export function MusicControl() {
  const music = useContext(Music);
  if (!music) return null;
  const on = music.status === "playing" || music.status === "starting";
  const Icon = on ? SpeakerHighIcon : SpeakerSlashIcon;
  return (
    <button
      type="button"
      className="music-control"
      onClick={music.toggle}
      title={music.status === "error" ? "배경음악 다시 재생" : "배경음악 · 연말의 밤"}
    >
      <Icon size={18} aria-hidden="true" />
      {on ? "음소거" : "음악 켜기"}
    </button>
  );
}
