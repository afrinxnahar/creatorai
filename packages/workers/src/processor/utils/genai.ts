import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

export { GEMINI_TEXT_MODEL, GEMINI_TEXT_LITE_MODEL, GEMINI_IMAGE_MODEL, GEMINI_EMBEDDING_MODEL, GEMINI_VIDEO_MODEL } from '@repo/validation';

/**
 * Pull the answer text out of a Gemini response.
 *
 * Gemini 3.x returns reasoning as extra parts flagged `thought: true`. Reading
 * `parts[0].text` can therefore hand back reasoning prose instead of the answer, and
 * `response.text` is `undefined` when every text part is a thought (which is what
 * happens when the output budget is spent thinking). Both end as an unhelpful
 * "undefined is not valid JSON" at the parse site.
 *
 * Returns the concatenated non-thought text, or null with the reason it is empty.
 */
export function extractResponseText(
  response: GenerateContentResponse,
): { text: string; reason: null } | { text: null; reason: string } {
  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const text = parts
    .filter((part) => typeof part.text === 'string' && part.thought !== true)
    .map((part) => part.text)
    .join('')
    .trim();

  if (text) return { text, reason: null };

  const finishReason = candidate?.finishReason;
  const blockReason = response?.promptFeedback?.blockReason;
  const thoughtOnly = parts.some((part) => part.thought === true);

  if (blockReason) return { text: null, reason: `blocked by safety filters (${blockReason})` };
  if (finishReason === 'MAX_TOKENS') {
    return {
      text: null,
      reason: thoughtOnly
        ? 'the output limit was reached while the model was still reasoning'
        : 'the output limit was reached before a complete answer',
    };
  }
  if (finishReason && finishReason !== 'STOP') {
    return { text: null, reason: `generation stopped early (${finishReason})` };
  }
  return { text: null, reason: thoughtOnly ? 'only reasoning was returned, no answer' : 'the model returned no content' };
}

let cached: GoogleGenAI | null = null;

/**
 * Returns a singleton Vertex AI–backed GoogleGenAI client.
 *
 * Auth uses Application Default Credentials (ADC): a service-account key referenced by
 * GOOGLE_APPLICATION_CREDENTIALS, an attached service account on GCP, or
 * `gcloud auth application-default login` for local dev. No API key is used.
 */
export function getGenAI(): GoogleGenAI {
  if (cached) return cached;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for Vertex AI)');
  }

  cached = new GoogleGenAI({ vertexai: true, project, location });
  return cached;
}
