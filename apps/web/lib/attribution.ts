/**
 * Referral (?ref=) and promo (?promo=) attribution, kept for 30 days.
 *
 * Both are captured on the first page the visitor lands on and read again when
 * checkout starts, so the credit survives the signup detour in between.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PARAMS = {
  ref: "affiliate_ref",
  promo: "promo_code",
} as const;

export type AttributionKey = (typeof PARAMS)[keyof typeof PARAMS];

export function captureAttribution() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [param, storageKey] of Object.entries(PARAMS)) {
    const code = params.get(param)?.trim();
    if (code) {
      localStorage.setItem(storageKey, JSON.stringify({ code, ts: Date.now() }));
    }
  }
}

export function readAttribution(key: AttributionKey): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { code, ts } = JSON.parse(raw) as { code: string; ts: number };
    if (Date.now() - ts < TTL_MS) return code;
    localStorage.removeItem(key);
  } catch {
    /* ignore malformed data */
  }
  return undefined;
}
