import postgres from "postgres";
import { env } from "../integration/helpers";

export function localDatabase() {
  if (!env.DB_URL || !["127.0.0.1", "localhost"].includes(new URL(env.DB_URL).hostname)) {
    throw new Error("Local database required");
  }
  return postgres(env.DB_URL);
}
