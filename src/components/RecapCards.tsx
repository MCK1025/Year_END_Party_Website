import { useEffect, useState } from "react";
import { z } from "zod";
import { recapSchema } from "../../supabase/functions/_shared/contracts";
import { api, message } from "../lib/api";
import { PrivateImage } from "./PrivateImage";
import { Note, Panel } from "./ui";

export function RecapCards() {
  const [cards, setCards] = useState<z.infer<typeof recapSchema>[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api({ action: "recaps", payload: {} }, z.array(recapSchema))
      .then((rows) => {
        if (live) setCards(rows);
      })
      .catch((error: unknown) => {
        if (live) setError(message(error));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      {error && <Note error>{error}</Note>}
      {cards.length === 0 && !error && (
        <Panel>
          <p className="empty">첫 번째 장면을 준비하고 있습니다.</p>
        </Panel>
      )}
      {cards.map((card, i) => (
        <Panel key={card.id}>
          <p className="overline">MOMENT {String(i + 1).padStart(2, "0")}</p>
          {card.asset_path && <PrivateImage path={card.asset_path} alt={card.caption} />}
          <p>{card.caption}</p>
        </Panel>
      ))}
    </>
  );
}
