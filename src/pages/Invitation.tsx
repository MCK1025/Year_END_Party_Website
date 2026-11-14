import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvitationFallback } from "../components/invitation/InvitationFallback";
import { InvitationScene } from "../components/invitation/InvitationScene";
import { Button } from "../components/ui";
import {
  enterInvitation,
  type InvitationPhase,
  type InvitationRenderMode,
  invitationCopy,
  invitationMotion,
  invitationThemeParts,
} from "../lib/invitation";

export function Invitation() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<InvitationRenderMode>(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "static" : "webgl",
  );
  const [phase, setPhase] = useState<InvitationPhase>(() => (mode === "static" ? "reading" : "preparing"));
  const phaseRef = useRef(phase);
  const letter = useRef<HTMLElement>(null);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changePhase = useCallback((next: InvitationPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimeout(timer.current);
    enterInvitation();
    navigate("/login", { replace: true, state: { invitationPassed: true, fromInvitation: true } });
  }, [navigate]);
  const fallback = useCallback(() => {
    if (phaseRef.current === "departing") {
      finish();
      return;
    }
    setMode("static");
    changePhase("reading");
  }, [changePhase, finish]);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (motion.matches) fallback();
    };
    motion.addEventListener("change", changed);
    return () => {
      motion.removeEventListener("change", changed);
      clearTimeout(timer.current);
    };
  }, [fallback]);
  function enter() {
    if (phaseRef.current !== "reading" || finished.current) return;
    if (mode === "static") {
      finish();
      return;
    }
    changePhase("departing");
    timer.current = setTimeout(finish, invitationMotion.departureTimeout);
  }
  return (
    <main className="invite-page" data-phase={phase} data-renderer={mode}>
      <header className="invite-top">
        <span className="small">한 걸음 더 가까이 · 2026</span>
        <Button variant="secondary" onClick={finish}>
          {invitationCopy.skip}
        </Button>
      </header>
      <div className="invite-stage">
        {mode === "webgl" && (
          <InvitationScene
            letter={letter}
            departing={phase === "departing"}
            phase={changePhase}
            failed={fallback}
            complete={finish}
          />
        )}
        {(mode === "static" || phase === "preparing") && <InvitationFallback />}
        <p className="invite-arrival" aria-live="polite">
          {phase === "reading" || phase === "departing" ? "" : invitationCopy.arrival}
        </p>
        <article
          ref={letter}
          className="invite-letter"
          inert={phase !== "reading"}
          aria-hidden={phase !== "reading"}
        >
          <p className="overline">{invitationCopy.name}</p>
          <span className="invite-orbit" aria-hidden="true" />
          <h1>
            {invitationThemeParts.map((part, index) => (
              <span key={part}>
                {index > 0 ? " " : ""}
                <span className="invite-phrase">{part}</span>
              </span>
            ))}
          </h1>
          <p className="invite-body">{invitationCopy.body}</p>
          <Button onClick={enter}>{invitationCopy.enter}</Button>
          <span className="invite-year" aria-hidden="true">
            2026
          </span>
        </article>
      </div>
      <p className="invite-bottom small">A LITTLE CLOSER, TOGETHER.</p>
    </main>
  );
}
