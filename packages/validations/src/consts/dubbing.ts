
// Dubbing is available on EVERY plan including Starter — the gate is now duration,
// not access (see maxDubSecondsForPlan). Gate by plan NAME: there is no tier column;
// the active plan is the most-recent active `subscriptions` row joined to `plans`
// (mirror canGenerateVideo).
export const DUBBING_PLANS = ['starter', 'creator', 'pro', 'business', 'scale'] as const;

export function canDub(planName?: string | null): boolean {
  if (!planName) return false;
  return DUBBING_PLANS.includes(planName.toLowerCase() as (typeof DUBBING_PLANS)[number]);
}

/**
 * Longest source clip a plan may dub, in seconds. Starter is capped so the free tier
 * is a real trial rather than an unbounded cost sink — every Starter dub is pure COGS
 * (they pay nothing) and ElevenLabs bills us per source minute.
 *
 * `null` means no cap. Enforced server-side in DubbingService (signUpload + createDub)
 * and re-checked in the worker against ElevenLabs' own `expected_duration_sec`, because
 * durationSeconds arrives from the browser and cannot be trusted on its own.
 */
export const STARTER_MAX_DUB_SECONDS = 60;

export function maxDubSecondsForPlan(planName?: string | null): number | null {
  if (!planName) return STARTER_MAX_DUB_SECONDS;
  return planName.toLowerCase() === 'starter' ? STARTER_MAX_DUB_SECONDS : null;
}

/** True when `durationSeconds` is within the plan's cap. Unknown plan → treated as Starter. */
export function isDubDurationAllowed(planName: string | null | undefined, durationSeconds: number): boolean {
  const cap = maxDubSecondsForPlan(planName);
  return cap === null || durationSeconds <= cap;
}

// Redis key prefix for mid-run cancellation (train-ai pattern). The API sets the
// flag; the worker checks it between pipeline stages and aborts.
export const DUBBING_CANCEL_PREFIX = 'dubbing:cancel:';

/**
 * The 29 languages eleven_multilingual_v2 supports — the model dubbing synthesises
 * with. Offering anything outside this list produces audio in the wrong language
 * rather than an error, so the dropdown must mirror it exactly.
 *
 * Norwegian was dropped when dubbing moved to ElevenLabs: it only exists on
 * eleven_flash_v2_5, which is tuned for latency over long-form stability.
 */
export const supportedLanguages = [
  { value: 'ar', label: 'Arabic' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fil', label: 'Filipino' },
  { value: 'fr', label: 'French' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hr', label: 'Croatian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ms', label: 'Malay' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sv', label: 'Swedish' },
  { value: 'ta', label: 'Tamil' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
] as const;

/** Long-form stable and covers all of the above. */
export const ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2';

export type SupportedLanguage = typeof supportedLanguages[number]['value'];

// murfLocaleMap lived here — a locale table for Murf, which stopped powering dubbing
// two providers ago and had no readers left.
