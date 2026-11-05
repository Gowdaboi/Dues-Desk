export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^\+?\d{11,15}$/.test(digits))
    return digits.startsWith("+") ? digits : `+${digits}`;
  return digits;
}
