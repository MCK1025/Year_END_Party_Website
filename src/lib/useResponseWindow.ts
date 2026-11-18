import { useEffect, useMemo, useState } from "react";
import { responseWindow } from "./responseWindow";

export function useResponseWindow(schedule: {
  readonly started: boolean;
  readonly start: string | null;
  readonly serverTime?: string | undefined;
}) {
  const { started, start, serverTime } = schedule;
  const offset = useMemo(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0), [serverTime]);
  const [, render] = useState(0);
  const now = Date.now() + offset;
  const remaining = start === null ? 0 : Date.parse(start) - now;
  useEffect(() => {
    if (!started || !(remaining > 0)) return;
    const update = () => render((value) => value + 1);
    const timer = window.setTimeout(update, Math.min(remaining, 2_147_483_647));
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [started, remaining]);
  return responseWindow(schedule, now);
}
