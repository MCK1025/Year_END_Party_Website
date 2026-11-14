export const invitationThemeParts = ["한 걸음 더", "가까워진,", "그리고", "가까워질 우리."] as const;
export const invitationCopy = {
  arrival: "함께한 당신에게, 초대장이 도착했습니다.",
  name: "2026 혜성식품 송년의 밤",
  theme: invitationThemeParts.join(" "),
  body: "함께한 시간을 돌아보고,\n서로에게 한 걸음 더 가까워지는 자리에\n여러분을 초대합니다.",
  enter: "행사장으로 가기",
  skip: "바로 입장하기",
} as const;
export const invitationMotion = {
  arrive: 1.2,
  settle: 1.5,
  open: 2.2,
  read: 3,
  departure: 1,
  preparationTimeout: 3000,
  departureTimeout: 2500,
} as const;
export type InvitationPhase =
  | "preparing"
  | "arriving"
  | "settling"
  | "opening"
  | "reading"
  | "departing"
  | "completed";
export type InvitationRenderMode = "webgl" | "static";
export const invitationKey = "hyeseong:2026:invitation:v1:entered";
let entered = false;
export function hasEnteredInvitation() {
  if (entered) return true;
  try {
    return sessionStorage.getItem(invitationKey) === "1";
  } catch {
    return false;
  } // Storage is optional; the in-memory flag preserves navigation.
}
export function enterInvitation() {
  entered = true;
  try {
    sessionStorage.setItem(invitationKey, "1");
  } catch {
    /* The memory flag above remains authoritative for this document. */
  }
}
export function arrivalPhase(seconds: number): InvitationPhase {
  if (seconds < invitationMotion.arrive) return "arriving";
  if (seconds < invitationMotion.settle) return "settling";
  if (seconds < invitationMotion.read) return "opening";
  return "reading";
}
export function progress(time: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
