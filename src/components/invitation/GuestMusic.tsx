import { SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import track from "../../assets/audio/year-end-night.mp3";
import { hasEnteredInvitation } from "../../lib/invitation";

const muteKey = "hyeseong:2026:music-muted";
type PlaybackIssue = "blocked" | "error";
const Music = createContext<{
  muted: boolean;
  issue: PlaybackIssue | null;
  toggle: () => void;
  start: () => void;
} | null>(null);

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
  const [muted, setMuted] = useState(savedMute);
  const attempt = useRef(0);
  const [issue, setIssue] = useState<PlaybackIssue | null>(null);
  const { pathname } = useLocation();
  const requested = useRef(pathname !== "/invite" && hasEnteredInvitation());

  const start = useCallback(() => {
    requested.current = true;
    const player = audio.current;
    if (!player || player.muted || !player.paused) return;
    const id = ++attempt.current;
    if (player.error) player.load();
    player.volume = 0.4;
    void player.play().catch((error: unknown) => {
      if (attempt.current !== id) return;
      setIssue(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
    });
  }, []);

  useEffect(() => {
    const player = audio.current;
    if (requested.current) start();
    const retry = (event: MouseEvent) => {
      if (!requested.current || !event.isTrusted || player?.error) return;
      if (event.target instanceof Element && event.target.closest(".music-tools")) return;
      start();
    };
    window.addEventListener("click", retry, true);
    return () => {
      window.removeEventListener("click", retry, true);
      attempt.current++;
      player?.pause();
    };
  }, [start]);

  function toggle() {
    const player = audio.current;
    if (!player) return;
    const off = !player.muted;
    player.muted = off;
    setMuted(off);
    setIssue(null);
    try {
      localStorage.setItem(muteKey, off ? "1" : "0");
    } catch {
      // The in-memory choice still applies to subsequent pages.
    }
    if (off) {
      attempt.current++;
      player.pause();
    } else start();
  }
  return (
    <Music.Provider value={{ start, toggle, muted, issue }}>
      <audio
        ref={audio}
        src={track}
        muted={muted}
        preload={muted ? "none" : "auto"}
        loop
        onPlaying={() => setIssue(null)}
        onError={() => setIssue("error")}
      />
      {children}
    </Music.Provider>
  );
}

export const useStartMusic = () => useContext(Music)?.start;

export function MusicControl() {
  const music = useContext(Music);
  if (!music) return null;
  const Icon = music.muted ? SpeakerSlashIcon : SpeakerHighIcon;
  return (
    <div className="music-tools">
      <button
        type="button"
        className="music-control"
        onClick={music.toggle}
        aria-label="배경음악"
        aria-pressed={!music.muted}
        title={music.muted ? "음악 켜기" : "음소거하기"}
      >
        <Icon size={18} aria-hidden="true" />
        {music.muted ? "음악 꺼짐" : "음악 켜짐"}
      </button>
      {!music.muted && music.issue && (
        <button type="button" className="music-retry" onClick={music.start}>
          {music.issue === "blocked" ? "탭하여 재생" : "재생 다시 시도"}
        </button>
      )}
    </div>
  );
}
