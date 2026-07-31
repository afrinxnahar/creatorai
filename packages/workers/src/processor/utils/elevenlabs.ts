import { readFile } from 'fs/promises';
import { basename } from 'path';
import { ELEVENLABS_TTS_MODEL } from '@repo/validation';

const API = 'https://api.elevenlabs.io/v1';
const TIMEOUT_MS = 10 * 60 * 1000;

export function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

async function failure(response: Response, action: string): Promise<Error> {
  const body = await response.text().catch(() => '');
  return new Error(`ElevenLabs ${action} failed (${response.status}): ${body.slice(0, 400)}`);
}

/**
 * Instant Voice Clone from an audio sample. Returns the voice id to store against the
 * creator so every later dub speaks in their voice rather than re-cloning per job.
 *
 * `requires_verification` comes back when the account must confirm consent before the
 * voice can be used; treated as a hard failure since synthesising with it would 400.
 */
export async function createVoiceClone(
  apiKey: string,
  samplePath: string,
  voiceName: string,
): Promise<string> {
  const bytes = await readFile(samplePath);
  const form = new FormData();
  form.append('name', voiceName);
  form.append('files', new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }), basename(samplePath));
  form.append('remove_background_noise', 'true');

  const response = await fetch(`${API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw await failure(response, 'voice cloning');

  const data = (await response.json()) as { voice_id?: string; requires_verification?: boolean };
  if (!data.voice_id) throw new Error('ElevenLabs did not return a voice id');
  if (data.requires_verification) {
    throw new Error('This voice needs verification in your ElevenLabs account before it can be used.');
  }
  return data.voice_id;
}

/** True when the voice still exists upstream — it can be deleted outside our control. */
export async function voiceExists(apiKey: string, voiceId: string): Promise<boolean> {
  const response = await fetch(`${API}/voices/${voiceId}`, { headers: { 'xi-api-key': apiKey } });
  return response.ok;
}

export async function deleteVoice(apiKey: string, voiceId: string): Promise<void> {
  await fetch(`${API}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  }).catch(() => undefined);
}

/** eleven_multilingual_v2 caps a request at 10k characters. */
const TTS_CHAR_LIMIT = 9000;

/** Split on sentence ends so a chunk boundary never lands mid-word. */
export function chunkForTts(text: string, limit = TTS_CHAR_LIMIT): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return clean ? [clean] : [];

  const chunks: string[] = [];
  let buffer = '';
  for (const sentence of clean.split(/(?<=[.!?。！？])\s+/)) {
    if (sentence.length > limit) {
      if (buffer) { chunks.push(buffer); buffer = ''; }
      for (let i = 0; i < sentence.length; i += limit) chunks.push(sentence.slice(i, i + limit));
      continue;
    }
    if (buffer.length + sentence.length + 1 > limit) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

/**
 * Synthesise `text` in the creator's cloned voice. Long scripts are chunked and the
 * MP3 frames concatenated — valid for MP3, which has no global header to reconcile.
 */
export async function textToSpeech(
  apiKey: string,
  voiceId: string,
  text: string,
  languageCode: string,
): Promise<Buffer> {
  const chunks = chunkForTts(text);
  if (!chunks.length) throw new Error('There was no speech to dub in this media.');

  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        model_id: ELEVENLABS_TTS_MODEL,
        language_code: languageCode,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw await failure(response, 'speech synthesis');
    parts.push(Buffer.from(await response.arrayBuffer()));
  }
  return Buffer.concat(parts);
}
