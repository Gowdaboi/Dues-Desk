export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const IST_TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST_TZ });
}
