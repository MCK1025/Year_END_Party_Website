import { createContext, type ReactNode, useContext, useState } from "react";
import type { ForestPost } from "../../../supabase/functions/_shared/forest";

type Fields = {
  answers: Record<string, string>;
  consent: boolean;
  selected: string;
  reason: string;
  nomEditing: boolean;
  forestEditing: number | null;
  "body:new": string;
  [key: `body:${number}`]: string;
  "kind:new": ForestPost["kind"];
  [key: `kind:${number}`]: ForestPost["kind"];
};
const Drafts = createContext<Partial<Fields> | null>(null);
export function EmployeeDrafts({ children }: { readonly children: ReactNode }) {
  const [cache] = useState<Partial<Fields>>(() => ({}));
  return <Drafts.Provider value={cache}>{children}</Drafts.Provider>;
}
export function useBookDraft<K extends keyof Fields>(key: K, initial: Fields[K]) {
  const cache = useContext(Drafts);
  const [value, setValue] = useState<Fields[K]>(() => cache?.[key] ?? initial);
  function set(next: Fields[K]) {
    if (cache) cache[key] = next;
    setValue(next);
  }
  function forget() {
    if (cache && cache[key] === value) delete cache[key];
  }
  return [value, set, forget] as const;
}
