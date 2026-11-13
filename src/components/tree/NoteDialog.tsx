import { useEffect, useId, useRef } from "react";
import { type ForestPost, forestKinds } from "../../../supabase/functions/_shared/forest";
import { Button } from "../ui";

export function NoteDialog({ note, close }: { readonly note: ForestPost; readonly close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`tree-note-dialog ${note.kind}`}
      aria-labelledby={title}
      onCancel={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close();
      }}
    >
      <div className="stack">
        <p className="overline">A little note, a little closer</p>
        <h2 id={title}>{forestKinds[note.kind]}</h2>
        <p className="tree-note-body">{note.body}</p>
        <p className="small">
          이름 없이 전하는 마음 · <span className="keep-phrase">{note.day}</span>
        </p>
        <Button variant="secondary" onClick={close}>
          트리로 돌아가기
        </Button>
      </div>
    </dialog>
  );
}
