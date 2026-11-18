import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { tasteCardsSchema } from "../../../supabase/functions/_shared/contracts";
import { api, message } from "../../lib/api";

type Cards = ReturnType<typeof tasteCardsSchema.parse>["cards"];
const Data = createContext<{ cards: Cards | null; error: string; retry: () => void } | null>(null);

export function CardData({
  completed,
  revision,
  children,
}: {
  readonly completed: boolean;
  readonly revision: number;
  readonly children: ReactNode;
}) {
  const { pathname } = useLocation();
  const [attempt, retry] = useState(0);
  const [loaded, setLoaded] = useState<{ revision: number; cards: Cards; attempt: number } | null>(null);
  const [failure, setFailure] = useState<{ revision: number; error: string } | null>(null);
  const cached = loaded?.revision === revision && loaded.attempt === attempt;
  const refresh = useCallback(() => retry((v) => v + 1), []);
  useEffect(() => {
    if (!completed || pathname !== "/cards" || cached) return;
    let live = true;
    setFailure(null);
    void api({ action: "taste_cards", payload: {} }, tasteCardsSchema).then(
      (result) => {
        if (live)
          setLoaded({
            revision,
            attempt,
            cards: [...result.cards].sort(
              (a, b) =>
                a.name.localeCompare(b.name, "ko") ||
                a.department.localeCompare(b.department, "ko") ||
                a.id.localeCompare(b.id),
            ),
          });
      },
      (error: unknown) => {
        if (live) setFailure({ revision, error: message(error) });
      },
    );
    return () => {
      live = false;
    };
  }, [completed, pathname, revision, cached, attempt]);
  return (
    <Data.Provider
      value={{
        cards: completed && cached ? loaded.cards : null,
        error: failure?.revision === revision ? failure.error : "",
        retry: refresh,
      }}
    >
      {children}
    </Data.Provider>
  );
}

export function useCards() {
  const value = useContext(Data);
  if (!value) throw new Error("Card data context missing");
  return value;
}
