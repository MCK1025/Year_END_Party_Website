import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookSettings } from "../components/book/preferences";
import { CompanyLogo } from "../components/CompanyLogo";
import { MusicControl, useStartMusic } from "../components/invitation/GuestMusic";
import { InvitationFallback } from "../components/invitation/InvitationFallback";
import { InvitationScene } from "../components/invitation/InvitationScene";
import { LetterHeart } from "../components/invitation/LetterHeart";
import { Button } from "../components/ui";
import {
  enterInvitation,
  type InvitationPhase,
  type InvitationRenderMode,
  invitationCopy,
  invitationMotion,
} from "../lib/invitation";
import { motionMedia, motionPolicy, observeMotion } from "../lib/motion";
import { traceMotion } from "../lib/motionDebug";

export function Invitation() {
  const [attempt, setAttempt] = useState(0);
  return <InvitationAttempt key={attempt} replay={() => setAttempt((n) => n + 1)} />;
}
function InvitationAttempt({ replay }: { readonly replay: () => void }) {
  const navigate = useNavigate();
  const startMusic = useStartMusic();
  const [trace] = useState(() => traceMotion("invitation"));
  const [reason, setReason] = useState<string>(() => motionPolicy(motionMedia()?.matches));
  const [mode, setMode] = useState<InvitationRenderMode>(() =>
    motionPolicy(motionMedia()?.matches) === "ALLOWED" ? "webgl" : "static",
  );
  const [phase, setPhase] = useState<InvitationPhase>(() => (mode === "static" ? "reading" : "preparing"));
  const phaseRef = useRef(phase);
  const letter = useRef<HTMLElement>(null);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (phase === "opening" || phase === "reading") startMusic?.();
  }, [phase, startMusic]);
  const changePhase = useCallback(
    (next: InvitationPhase) => {
      trace(next === "reading" ? "READING_PAUSED" : "PHASE", { phase: next });
      phaseRef.current = next;
      setPhase(next);
    },
    [trace],
  );
  const finish = useCallback(() => {
    if (finished.current) return;
    startMusic?.();
    finished.current = true;
    trace("LOGIN_NAVIGATION");
    clearTimeout(timer.current);
    enterInvitation();
    navigate("/login", { replace: true, state: { invitationPassed: true, fromInvitation: true } });
  }, [navigate, trace, startMusic]);
  const fallback = useCallback(
    (failure: string) => {
      setReason(failure);
      if (phaseRef.current === "departing") {
        trace(failure, { mode: "login" });
        finish();
        return;
      }
      const simple = motionPolicy(motionMedia()?.matches) === "ALLOWED" && phaseRef.current !== "reading";
      trace(failure, { mode: simple ? "simple" : "static" });
      setMode(simple ? "simple" : "static");
      changePhase(simple ? "opening" : "reading");
    },
    [changePhase, finish, trace],
  );
  useEffect(() => {
    const motion = motionMedia();
    const policy = motionPolicy(motion?.matches);
    trace(policy, { mode: policy === "ALLOWED" ? "webgl" : "static" });
    const finishHiddenDeparture = () => {
      if (document.hidden && phaseRef.current === "departing") {
        trace("DOCUMENT_HIDDEN", { mode: "login" });
        finish();
      }
    };
    document.addEventListener("visibilitychange", finishHiddenDeparture);
    const stop = observeMotion(motion, () => {
      if (motion?.matches) fallback("SYSTEM_REDUCED_MOTION");
      else {
        trace("POLICY_CHANGED", { reduced: false });
        setReason("REPLAY_AVAILABLE");
      }
    });
    return () => {
      document.removeEventListener("visibilitychange", finishHiddenDeparture);
      stop();
      clearTimeout(timer.current);
    };
  }, [fallback, trace, finish]);
  useEffect(() => {
    if (mode !== "simple" || phase !== "opening") return;
    const id = setTimeout(() => changePhase("reading"), 520);
    return () => clearTimeout(id);
  }, [mode, phase, changePhase]);
  function enter() {
    if (phaseRef.current !== "reading" || finished.current) return;
    if (document.hidden) {
      trace("DOCUMENT_HIDDEN", { mode: "login" });
      finish();
      return;
    }
    if (mode !== "webgl") {
      finish();
      return;
    }
    changePhase("departing");
    timer.current = setTimeout(() => {
      trace(document.hidden ? "DOCUMENT_HIDDEN" : "DEPARTURE_TIMEOUT");
      finish();
    }, invitationMotion.departureTimeout);
  }
  return (
    <main className="invite-page" data-phase={phase} data-renderer={mode}>
      <header className="invite-top">
        <div className="invite-identity">
          <CompanyLogo />
          <p className="overline">{invitationCopy.name}</p>
        </div>
        <div className="guest-tools">
          <MusicControl />
          <BookSettings />
        </div>
        <Button variant="secondary" onClick={finish}>
          {invitationCopy.skip}
        </Button>
      </header>
      <div className="invite-stage">
        {mode === "webgl" && (
          <InvitationScene
            trace={trace}
            letter={letter}
            departing={phase === "departing"}
            phase={changePhase}
            failed={fallback}
            complete={finish}
          />
        )}
        {(mode !== "webgl" || phase === "preparing") && <InvitationFallback />}
        <p className="invite-arrival" aria-live="polite">
          {phase === "reading" || phase === "departing" ? "" : invitationCopy.arrival}
        </p>
        <article
          ref={letter}
          className="invite-letter"
          inert={phase !== "reading"}
          aria-hidden={phase !== "reading"}
        >
          <div className="invite-message">
            <h1>{invitationCopy.theme}</h1>
            <p className="invite-body">{invitationCopy.body}</p>
            {phase === "reading" && <LetterHeart motionAllowed={mode !== "static"} />}
          </div>
          <Button onClick={enter}>{invitationCopy.enter}</Button>
          <span className="invite-year" aria-hidden="true">
            2026
          </span>
        </article>
      </div>
      {mode !== "webgl" && (
        <p className="invite-bottom small">
          {reason === "SYSTEM_REDUCED_MOTION"
            ? "기기의 동작 줄이기 설정에 따라 편지를 펼쳐 두었습니다."
            : mode === "simple"
              ? "간단한 봉투 효과로 표시합니다."
              : "정적 초대장으로 표시합니다."}
        </p>
      )}
      {mode === "static" && reason === "REPLAY_AVAILABLE" && (
        <Button variant="secondary" onClick={replay}>
          초대장 다시 보기
        </Button>
      )}
      <p className="invite-bottom small">A LITTLE CLOSER, TOGETHER.</p>
    </main>
  );
}
