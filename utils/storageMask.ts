const MASK_PREFIX = "ctk_";

export function maskValue(value: string): string {
  if (typeof value !== "string") return value;
  if (value.startsWith(MASK_PREFIX)) return value;
  try {
    return `${MASK_PREFIX}${btoa(value)}`;
  } catch {
    return value;
  }
}

export function unmaskValue(value: string): string {
  if (typeof value !== "string") return value;
  if (value.startsWith(MASK_PREFIX)) {
    try {
      return atob(value.slice(MASK_PREFIX.length));
    } catch {
      return value;
    }
  }
  return value;
}
