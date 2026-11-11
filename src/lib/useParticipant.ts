import { useCallback, useEffect, useRef, useState } from "react";
import { type Bootstrap, bootstrapSchema, stateSchema } from "../../supabase/functions/_shared/contracts";
import { ApiError, api, message, supabase } from "./api";
import { latestState } from "./snapshot";

export function useParticipant() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("연결 중");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await api({ action: "bootstrap", payload: {} }, bootstrapSchema);
      if (request !== generation.current) return;
      setData((old) => ({ ...next, state: latestState(old?.state, next.state) }));
      setError("");
    } catch (error) {
      if (request !== generation.current) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setData(null);
      setError(message(error));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel("published-event")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_public_state" }, (event) => {
        const state = stateSchema.safeParse(event.new);
        if (state.success)
          setData((old) =>
            old && state.data.revision >= old.state.revision ? { ...old, state: state.data } : old,
          );
      })
      .subscribe((status) => {
        setConnection(status === "SUBSCRIBED" ? "실시간 연결됨" : "재연결 중 · 자동 확인");
        if (status === "SUBSCRIBED") void refresh();
      });
    const timer = window.setInterval(() => {
      void refresh();
    }, 20000);
    const recover = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", recover);
    return () => {
      generation.current++;
      clearInterval(timer);
      void supabase.removeChannel(channel);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [refresh]);
  return { data, error, connection, refresh };
}
