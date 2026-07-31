import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import {
  calculateDubbingCreditsByDuration,
  DUBBING_CREDIT_MULTIPLIER,
  DUBBING_CANCEL_PREFIX,
  isDubDurationAllowed,
  maxDubSecondsForPlan,
  supportedLanguages,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import { getGenAI, GEMINI_TEXT_MODEL } from './utils/genai';
import {
  createVoiceClone,
  deleteVoice,
  getElevenLabsKey,
  textToSpeech,
  voiceExists,
} from './utils/elevenlabs';
import { extractVoiceSample, muxAudioOverVideo } from './utils/media';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// The clone step (Modal GPU) can run for a few minutes — cap the wait so a hung
// request fails the job instead of pinning a worker slot forever.
const MODAL_TIMEOUT_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Dubbing: Gemini translates, ElevenLabs speaks in the creator's own cloned voice.
//
// ElevenLabs' one-shot /v1/dubbing endpoint is deliberately NOT used: it has no
// parameter for a target voice, so it re-clones whoever is speaking in each upload.
// That gives a creator a different voice per job. Cloning once and synthesising with
// that voice every time is what keeps one identity across every language.
//
// The Modal + Chatterbox path is kept commented at the bottom of this file as the
// fallback if ElevenLabs disappoints.
// ─────────────────────────────────────────────────────────────────────────────
const ELEVENLABS_TIMEOUT_MS = 20 * 60 * 1000;

class DubbingCancelledError extends Error {
  constructor() {
    super('Dubbing cancelled by user');
    this.name = 'DubbingCancelledError';
  }
}

interface DubJobData {
  userId: string;
  projectId: string;
  bullJobId: string;
  inputGsUri: string;   // gs:// — Vertex transcribes/translates directly from this
  inputUrl: string;     // public GCS URL — the clone service fetches the reference from this
  mimeType: string;
  isVideo: boolean;
  targetLanguage: string;
  durationSeconds: number;
  planName?: string | null;   // for the plan duration cap, re-checked against the vendor's own reading
  outputPutUrl: string;       // signed PUT URL — the dubbed file goes straight to GCS
  outputContentType: string;  // must match the URL's signed Content-Type (video/mp4 | audio/mpeg)
  outputPublicUrl: string;    // public GCS URL of the result, recorded once the upload confirms
}

@Processor('dubbing', { concurrency: 2 })
export class DubbingProcessor extends WorkerHost {
  private readonly logger = new Logger(DubbingProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor(@InjectQueue('dubbing') private readonly queue: Queue) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = getGenAI();
  }

  /** Cancellation flag set by POST /dubbing/stop/:jobId — checked between stages. */
  private async throwIfCancelled(jobId: string): Promise<void> {
    const client = await this.queue.client;
    const cancelled = await client.get(`${DUBBING_CANCEL_PREFIX}${jobId}`);
    if (cancelled) {
      await client.del(`${DUBBING_CANCEL_PREFIX}${jobId}`);
      throw new DubbingCancelledError();
    }
  }

  async process(job: Job<DubJobData>): Promise<{ dubbedUrl: string }> {
    const {
      userId, projectId, inputGsUri, inputUrl, mimeType, isVideo, targetLanguage,
      durationSeconds, planName, outputPutUrl, outputContentType, outputPublicUrl,
    } = job.data;

    await job.updateProgress(0);
    await job.log('Starting dubbing...');

    let workDir: string | null = null;

    try {
      const apiKey = getElevenLabsKey();

      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'processing' });
      await job.updateProgress(5);

      const languageLabel = supportedLanguages.find((l) => l.value === targetLanguage)?.label ?? targetLanguage;
      workDir = await mkdtemp(join(tmpdir(), `dub-${projectId}-`));

      // 1. Translate. Vertex reads the media straight from gs:// — no download needed
      //    for this step, and no 50MB inline ceiling.
      await job.log(`Transcribing and translating to ${languageLabel}...`);
      const translatedText = await this.transcribeAndTranslate(inputGsUri, mimeType, languageLabel);
      await job.updateProgress(25);

      // 2. Make sure this creator has a voice. The first dub they run is what the
      //    clone is built from; every dub after reuses it, so the voice stays theirs
      //    across languages.
      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'cloning' });
      const voiceId = await this.ensureVoiceClone(apiKey, userId, inputUrl, workDir, job);
      await job.updateProgress(45);

      // 3. Speak the translation in that voice.
      await this.throwIfCancelled(job.id!);
      await job.log('Generating dubbed audio in your voice...');
      const dubbedAudio = await textToSpeech(apiKey, voiceId, translatedText, targetLanguage);
      const audioPath = join(workDir, 'dubbed.mp3');
      await writeFile(audioPath, dubbedAudio);
      await job.updateProgress(70);

      // 4. Audio in → ship the MP3. Video in → put the new track over the original.
      await this.throwIfCancelled(job.id!);
      let outputPath = audioPath;
      if (isVideo) {
        await job.log('Rebuilding the video with the dubbed audio...');
        const sourcePath = join(workDir, 'source');
        await this.downloadToFile(inputUrl, sourcePath);
        outputPath = join(workDir, 'dubbed.mp4');
        await muxAudioOverVideo(sourcePath, audioPath, outputPath);
      }

      await job.log('Storing the dubbed file...');
      await this.uploadToGcs(outputPath, outputPutUrl, outputContentType);
      await job.updateProgress(80);

      // The result is now in GCS at the pre-signed location.
      // Last cancellation window — after this we charge credits and persist.
      await this.throwIfCancelled(job.id!);
      const dubbedUrl = outputPublicUrl;
      await job.updateProgress(90);

      // 5. Deduct duration-based credits — only after a successful dub.
      const multiplier = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
      const creditsConsumed = calculateDubbingCreditsByDuration(durationSeconds, multiplier);

      const { error: creditError } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });
      if (creditError) {
        this.logger.error(`Credit deduction failed for user ${userId}: ${creditError.message}`);
        await this.updateJob(projectId, { status: 'failed', error_message: 'Insufficient credits' });
        throw new Error('Insufficient credits. Please upgrade your plan.');
      }

      await this.updateJob(projectId, {
        status: 'completed',
        dubbed_url: dubbedUrl,
        credits_consumed: creditsConsumed,
      });
      await job.updateProgress(100);
      await job.log(`Done! ${creditsConsumed} credits deducted.`);

      return { dubbedUrl };
    } catch (error: any) {
      const cancelled = error instanceof DubbingCancelledError;
      await job.log(cancelled ? 'Cancelled by user.' : `Fatal error: ${error.message}`);
      if (!cancelled) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      }
      try {
        await this.updateJob(projectId, { status: 'failed', error_message: error.message?.slice(0, 5000) });
      } catch (updateError: any) {
        this.logger.error(
          `Job ${job.id}: failed to persist failed status for dub ${projectId}: ${updateError?.message}`,
          updateError?.stack,
        );
      }
      throw error;
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * The creator's voice, cloned once and reused forever.
   *
   * The clone is built from the first media they dub. A stored id can still be stale —
   * voices are deletable from the ElevenLabs dashboard — so it is verified before use
   * and rebuilt from this job's audio when it has gone.
   */
  private async ensureVoiceClone(
    apiKey: string,
    userId: string,
    inputUrl: string,
    workDir: string,
    job: Job<DubJobData>,
  ): Promise<string> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('elevenlabs_voice_id, full_name')
      .eq('user_id', userId)
      .single();

    const existing = profile?.elevenlabs_voice_id as string | undefined;
    if (existing && (await voiceExists(apiKey, existing))) {
      await job.log('Using your saved voice.');
      return existing;
    }

    await job.log('Creating your voice clone from this recording — this is a one-time step.');
    const sourcePath = join(workDir, 'voice-source');
    await this.downloadToFile(inputUrl, sourcePath);

    const samplePath = join(workDir, 'voice-sample.mp3');
    await extractVoiceSample(sourcePath, samplePath);

    const voiceName = `creator-${userId.slice(0, 8)}`;
    const voiceId = await createVoiceClone(apiKey, samplePath, voiceName);

    const { error } = await this.supabase
      .from('profiles')
      .update({
        elevenlabs_voice_id: voiceId,
        voice_sample_url: inputUrl,
        voice_cloned_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // A voice we cannot persist would be re-cloned on the next dub and leak a slot.
    if (error) {
      await deleteVoice(apiKey, voiceId);
      throw new Error('We could not save your voice profile. Please try again.');
    }

    return voiceId;
  }

  private async downloadToFile(url: string, destination: string): Promise<void> {
    const response = await fetch(url, { signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Could not read the uploaded media (${response.status}).`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }

  private async uploadToGcs(path: string, putUrl: string, contentType: string): Promise<void> {
    const { readFile } = await import('fs/promises');
    const body = await readFile(path);
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Failed to store the dubbed file (${response.status}): ${detail.slice(0, 300)}`);
    }
  }

  // The one-shot /v1/dubbing helpers lived here (createElevenLabsDub,
  // waitForElevenLabsDub, streamDubToGcs). That endpoint re-clones the speaker from
  // each upload and takes no target voice, so it cannot keep one voice per creator.

  // ───────────────────────────────────────────────────────────────────────────
  // PREVIOUS BACKEND — Gemini transcribe/translate + Modal (Chatterbox on an L4).
  // Kept intact, not deleted: if ElevenLabs disappoints we flip back here. The
  // Modal app itself still lives at modal/dubbing_app.py and is still deployable.
  //
  // To restore: uncomment both methods, re-add the MODAL_API_URL guard and the
  // transcribe → callModalDub steps in process(), and revert dubOutput() in
  // apps/api/src/dubbing/dubbing.service.ts to .wav / audio/wav (Modal returned WAV
  // for audio input; ElevenLabs returns MP3).
  // ───────────────────────────────────────────────────────────────────────────

  private async transcribeAndTranslate(gsUri: string, mimeType: string, targetLanguage: string): Promise<string> {
    const result = await this.genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Transcribe the spoken audio from this file, then translate the full transcript into ${targetLanguage}. Return ONLY the translated text as a single continuous paragraph. No timestamps, no formatting, no labels — just the translated text.`,
            },
            { fileData: { fileUri: gsUri, mimeType } },
          ],
        },
      ],
    });

    const text = result.text?.trim();
    if (!text) throw new Error('Empty transcription/translation result from Gemini');
    return text;
  }

  /**
   * Modal contract: JSON { text, reference_url, is_video, language, output_put_url,
   * output_content_type } → Modal uploads the dubbed file straight to GCS via the signed
   * PUT URL and returns a small JSON ack. MODAL_API_URL is the exact URL `modal deploy`
   * printed for the /dub endpoint — Modal gives each web endpoint its own dedicated
   * hostname with no path routing, so we POST to modalUrl directly (no path appended).
   * Modal fetches reference_url (public GCS URL), extracts audio if is_video, clones the
   * voice, synthesizes `text` in `language`, muxes over the original video when is_video,
   * and PUTs the result to output_put_url. Keeping the bytes off the worker is the point:
   * the dubbed media never transits this process.
   */
  private async callModalDub(
    modalUrl: string,
    text: string,
    referenceUrl: string,
    isVideo: boolean,
    language: string,
    outputPutUrl: string,
    outputContentType: string,
  ): Promise<void> {
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        reference_url: referenceUrl,
        is_video: isVideo,
        language,
        output_put_url: outputPutUrl,
        output_content_type: outputContentType,
      }),
      signal: AbortSignal.timeout(MODAL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Modal API error ${response.status}: ${errBody.slice(0, 500)}`);
    }
  }

  private async updateJob(projectId: string, fields: Record<string, any>) {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .update({ ...fields })
      .eq('project_id', projectId)
      .select('project_id')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update dubbing_projects project_id=${projectId}. fields=${Object.keys(fields).join(', ')} error=${error?.message ?? 'no rows updated (RLS or missing row)'}`,
      );
      throw new Error(`dubbing_projects update failed: ${error?.message ?? 'row not found or RLS blocked'}`);
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
