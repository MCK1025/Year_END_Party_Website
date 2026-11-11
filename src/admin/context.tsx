import { createContext, useContext } from "react";
import type { Dashboard } from "../../supabase/functions/_shared/contracts";
export const AdminContext = createContext<{
  readonly data: Dashboard;
  readonly refresh: () => Promise<void>;
} | null>(null);
export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("Admin context missing");
  return value;
}
