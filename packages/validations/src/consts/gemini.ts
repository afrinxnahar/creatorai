/**
 * Gemini model ids used across the API and workers. Single source of truth so a
 * model swap is a one-line change. Override per-environment via env vars if needed.
 */
export const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';

// Cheapest tier for classification/extraction work. 3.6 has no Lite variant — 3.5
// Flash-Lite is the newest, shipped alongside 3.6 Flash.
export const GEMINI_TEXT_LITE_MODEL = process.env.GEMINI_TEXT_LITE_MODEL || 'gemini-3.5-flash-lite';

// Nano Banana 2.
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
export const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
// Video generation — Gemini Omni Flash. Native multimodal model that generates and
// (statefully) edits ≤10s 720p clips with audio via the Interactions API. Reached
// through the same GoogleGenAI client as the other Gemini models (allowlisted on our
// Vertex project). Env-overridable so a model bump is a one-line change.
export const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-flash-preview';
