export function responseWindow(
  schedule: { readonly started: boolean; readonly start: string | null },
  now: number,
) {
  return !schedule.started || (schedule.start !== null && Date.parse(schedule.start) > now);
}
