import { ArrowRightIcon, AsteriskIcon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";

export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: "primary" | "secondary" | "danger";
  readonly busy?: boolean;
}) {
  return (
    <button type="button" className={`button ${variant}`} {...props} disabled={busy || props.disabled}>
      {busy ? "처리 중…" : children}
    </button>
  );
}
export function Field({
  label,
  hint,
  id: suppliedId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { readonly label: string; readonly hint?: string }) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input {...props} id={id} aria-describedby={hint ? `${id}-hint` : props["aria-describedby"]} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { readonly label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={3} maxLength={500} {...props} />
    </label>
  );
}
export function Panel({
  children,
  title,
  dark = false,
}: {
  readonly children: ReactNode;
  readonly title?: string;
  readonly dark?: boolean;
}) {
  return (
    <section className={`panel ${dark ? "dark-panel" : ""}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Note({
  children,
  error = false,
}: {
  readonly children: ReactNode;
  readonly error?: boolean;
}) {
  return (
    <p className={`notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </p>
  );
}
export function Check({
  children,
  checked,
  onChange,
  disabled = false,
}: {
  readonly children: ReactNode;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{children}</span>
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}
export function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <AsteriskIcon weight="light" size={24} />
    </span>
  );
}
export function Forward() {
  return <ArrowRightIcon aria-hidden="true" size={18} />;
}
export function Confirm({
  title,
  children,
  action,
  onClose,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly action: () => Promise<void>;
  readonly onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" onCancel={onClose}>
      <h2 id="confirm-title">{title}</h2>
      <div>{children}</div>
      <div className="actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button
          busy={busy}
          onClick={() => {
            setBusy(true);
            void action().finally(() => {
              setBusy(false);
              onClose();
            });
          }}
        >
          확인
        </Button>
      </div>
    </dialog>
  );
}
