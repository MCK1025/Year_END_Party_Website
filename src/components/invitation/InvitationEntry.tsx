import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasEnteredInvitation } from "../../lib/invitation";
import { traceMotion } from "../../lib/motionDebug";
import { Login } from "../../pages/Login";

export function InvitationEntry() {
  const location = useLocation();
  const fromApp = location.state?.invitationPassed === true;
  const allowed = fromApp || hasEnteredInvitation();
  useEffect(() => {
    traceMotion("invitation")(allowed ? "ENTRY_ALREADY_PASSED" : "FIRST_VISIT", {
      mode: allowed ? "login" : "invite",
    });
    if (allowed && location.state?.fromInvitation) document.getElementById("content")?.focus();
  }, [allowed, location.state]);
  return allowed ? (
    <Login fromInvitation={location.state?.fromInvitation === true} />
  ) : (
    <Navigate to="/invite" replace />
  );
}
