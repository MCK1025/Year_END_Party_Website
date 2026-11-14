import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasEnteredInvitation } from "../../lib/invitation";
import { Login } from "../../pages/Login";

export function InvitationEntry() {
  const location = useLocation();
  const fromApp = location.state?.invitationPassed === true;
  const allowed = fromApp || hasEnteredInvitation();
  useEffect(() => {
    if (allowed && location.state?.fromInvitation) document.getElementById("content")?.focus();
  }, [allowed, location.state]);
  return allowed ? (
    <Login fromInvitation={location.state?.fromInvitation === true} />
  ) : (
    <Navigate to="/invite" replace />
  );
}
