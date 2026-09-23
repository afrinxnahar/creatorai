
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
 * How long, and how large, a source file may be.
 *
 * Paid plans get ElevenLabs' own API ceiling rather than a number of ours: 3GB and
 * 180 minutes per source file. Past that the dub is refused by the vendor AFTER the
 * browser has pushed the bytes and the credits are reserved, so failing here is
 * strictly cheaper than letting it through.
 *
 * Starter keeps 500MB / 45 min. That is an outer bound, not the shape of the trial:
 * its 500-credit grant runs out first (~2.8 min at the Starter rate), and signUpload
 * checks the balance before issuing the upload URL, so a Starter user is told the clip
 * is unaffordable before uploading rather than after.
 *
 * Enforced server-side in DubbingService (signUpload + createDub) and re-checked in
 * the worker against ElevenLabs' own `expected_duration_sec`, because durationSeconds
 * arrives from the browser and cannot be trusted on its own.
 */
export const STARTER_MAX_DUB_SECONDS = 45 * 60;
export const STARTER_MAX_DUB_BYTES = 500 * 1024 * 1024;
export const PAID_MAX_DUB_SECONDS = 180 * 60;
export const PAID_MAX_DUB_BYTES = 3 * 1024 * 1024 * 1024;

// The dubbing_v1 route (DUBBING_V1_LANGUAGES, below) is a different, smaller endpoint:
// 1GB / 45 min. A paid user picking one of those languages is held to this instead.
export const DUBBING_V1_MAX_SECONDS = 45 * 60;
export const DUBBING_V1_MAX_BYTES = 1024 * 1024 * 1024;

/** Missing or unknown plan is treated as Starter, so the caps fail closed. */
function isStarterPlan(planName?: string | null): boolean {
  return !planName || planName.toLowerCase() === 'starter';
}

/** Longest source clip a plan may dub, tightened by the target language's route. */
export function maxDubSecondsForPlan(planName?: string | null, targetLanguage?: string): number {
  const cap = isStarterPlan(planName) ? STARTER_MAX_DUB_SECONDS : PAID_MAX_DUB_SECONDS;
  return targetLanguage && usesDubbingV1(targetLanguage) ? Math.min(cap, DUBBING_V1_MAX_SECONDS) : cap;
}

/** Largest source file a plan may upload, tightened by the target language's route. */
export function maxDubBytesForPlan(planName?: string | null, targetLanguage?: string): number {
  const cap = isStarterPlan(planName) ? STARTER_MAX_DUB_BYTES : PAID_MAX_DUB_BYTES;
  return targetLanguage && usesDubbingV1(targetLanguage) ? Math.min(cap, DUBBING_V1_MAX_BYTES) : cap;
}

/** True when `durationSeconds` is within the cap. Unknown plan -> treated as Starter. */
export function isDubDurationAllowed(
  planName: string | null | undefined,
  durationSeconds: number,
  targetLanguage?: string,
): boolean {
  return durationSeconds <= maxDubSecondsForPlan(planName, targetLanguage);
}

/** True when `fileSize` is within the cap. Unknown plan -> treated as Starter. */
export function isDubSizeAllowed(
  planName: string | null | undefined,
  fileSize: number,
  targetLanguage?: string,
): boolean {
  return fileSize <= maxDubBytesForPlan(planName, targetLanguage);
}

/** "45 min" / "3 hrs" for limit copy. */
export function formatDubDuration(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  }
  return `${Math.round(seconds / 60)} min`;
}

// Redis key prefix for mid-run cancellation (train-ai pattern). The API sets the
// flag; the worker checks it between pipeline stages and aborts.
export const DUBBING_CANCEL_PREFIX = 'dubbing:cancel:';

/**
 * Every language the dubbing UI offers. Two backends serve this one list:
 *
 *  - the default: POST /v1/dubbing, which accepts 32 languages and is the only route
 *    that takes `target_accent` and renders video for us;
 *  - DUBBING_V1_LANGUAGES below: POST /v1/dubbing/project with `model_id=dubbing_v1`,
 *    whose coverage is Eleven v3's ~85 languages.
 *
 * A language the chosen backend does not accept is rejected outright (400
 * `unsupported_target_language`), so every entry here must be reachable by one of them.
 */
export const supportedLanguages = [
  { value: 'ar', label: 'Arabic' },
  { value: 'bn', label: 'Bengali' },
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

export type SupportedLanguage = typeof supportedLanguages[number]['value'];

export function isSupportedDubLanguage(code: string): boolean {
  return supportedLanguages.some((l) => l.value === code);
}

/**
 * Languages the default /v1/dubbing endpoint refuses — it has no model selector and
 * tops out at its own 32. These route through the dubbing *project* API pinned to
 * `model_id=dubbing_v1`, which reaches everything Eleven v3 speaks.
 *
 * Adding one is two lines: the entry in `supportedLanguages` above and its code here.
 * The cost is that dubbing_v1 renders audio only (the worker muxes it back over the
 * source video) and ignores `target_accent`, so a language with accents worth offering
 * is better left on the default route.
 */
export const DUBBING_V1_LANGUAGES: readonly string[] = ['bn'];

export function usesDubbingV1(code: string): boolean {
  return DUBBING_V1_LANGUAGES.includes(code);
}

/**
 * Accents the dubbing API can aim for, per language. `target_accent` is marked
 * experimental upstream, so treat these as a preference rather than a guarantee —
 * a language with no entry simply offers the default accent.
 */
export const accentsByLanguage: Partial<Record<SupportedLanguage, { value: string; label: string }[]>> = {
  en: [
    { value: 'american', label: 'American' },
    { value: 'british', label: 'British' },
    { value: 'australian', label: 'Australian' },
    { value: 'indian', label: 'Indian' },
  ],
  es: [
    { value: 'castilian', label: 'Spain (Castilian)' },
    { value: 'latin american', label: 'Latin American' },
  ],
  pt: [
    { value: 'brazilian', label: 'Brazilian' },
    { value: 'european', label: 'European' },
  ],
  fr: [
    { value: 'french', label: 'France' },
    { value: 'canadian', label: 'Canadian' },
  ],
  zh: [
    { value: 'mandarin', label: 'Mandarin' },
    { value: 'cantonese', label: 'Cantonese' },
  ],
};

export function accentsFor(language: string): { value: string; label: string }[] {
  return accentsByLanguage[language as SupportedLanguage] ?? [];
}

// murfLocaleMap lived here — a locale table for Murf, which stopped powering dubbing
// two providers ago and had no readers left.
