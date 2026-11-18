import { useEffect, useId, useRef } from "react";
import type { tasteCardsSchema } from "../../../supabase/functions/_shared/contracts";
import { useBookView } from "../book/preferences";
import { Button } from "../ui";

type PersonCard = ReturnType<typeof tasteCardsSchema.parse>["cards"][number];

export function PersonCardDialog({ card, close }: { readonly card: PersonCard; readonly close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const { still } = useBookView();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="person-card-dialog"
      data-still={still}
      aria-labelledby={title}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          event.currentTarget.querySelector("button")?.focus();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      <header className="person-card-dialog-header">
        <h2 id={title}>
          {card.name} <span>{card.department}</span>
        </h2>
        <Button variant="secondary" onClick={close}>
          닫기
        </Button>
      </header>
      <dl>
        {card.answers.map((answer) => (
          <div className="taste-answer" key={answer.id}>
            <dt>{answer.question}</dt>
            <dd>{answer.answer}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
