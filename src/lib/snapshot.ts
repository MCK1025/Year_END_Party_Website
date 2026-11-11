import type { EventState } from "../../supabase/functions/_shared/contracts";

export function latestState(current: EventState | undefined, incoming: EventState): EventState {
  return current && current.revision > incoming.revision ? current : incoming;
}
