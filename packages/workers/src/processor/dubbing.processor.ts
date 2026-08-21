import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, reportError, SupabaseClient } from '@repo/supabase';
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

// The clone step (Modal GPU) can run for a few minutes — cap the wait so a hung
// request fails the job instead of pinning a worker slot forever.
const MODAL_TIMEOUT_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Dubbing runs on ElevenLabs' /v1/dubbing endpoint, which transcribes, translates,
// clones the speaker and re-times the result in one call.
//
// Voice cloning is on by default (`disable_voice_cloning` is false): the voice in
// the output is cloned from the speaker in the uploaded media. Since creators dub
// their own videos, that is their own voice — which is the whole requirement. It
// also keeps ElevenLabs' timing alignment and multi-speaker handling, both of which
// a translate-then-synthesise pipeline gives up.
//
// The Modal + Chatterbox path is kept commented at the bottom of this file as the
// fallback if ElevenLabs disappoints.
// ─────────────────────────────────────────────────────────────────────────────
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_POLL_INTERVAL_MS = 5_000;
const ELEVENLABS_TIMEOUT_MS = 20 * 60 * 1000;

function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

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
  inputGsUri: string;   // gs:// — kept for the dormant Modal path
  inputUrl: string;     // public GCS URL — ElevenLabs fetches the source from this
  mimeType: string;
  isVideo: boolean;
  targetLanguage: string;
  targetAccent?: string | null;
  durationSeconds: number;
  planName?: string | null;   // for the plan duration cap, re-checked against the vendor's own reading
  reservedCredits: number;    // already deducted at enqueue — this job settles or refunds it
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
      userId, projectId, inputUrl, isVideo, targetLanguage, targetAccent,
      durationSeconds, planName, reservedCredits, outputPutUrl, outputContentType, outputPublicUrl,
    } = job.data;

    // Credits were taken at enqueue. This tracks what the user is currently out of
    // pocket so every exit path — failure, cancellation, a re-priced dub — settles
    // against the real number instead of assuming the reservation was right.
    let chargedCredits = reservedCredits ?? 0;

    await job.updateProgress(0);
    await job.log('Starting dubbing...');

    try {
      const apiKey = getElevenLabsKey();

      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'processing' });
      await job.updateProgress(5);

      const languageLabel = supportedLanguages.find((l) => l.value === targetLanguage)?.label ?? targetLanguage;

      // 1. Hand ElevenLabs the public GCS URL. It fetches, transcribes, translates,
      //    clones the speaker from the source audio and re-times the result. The
      //    bytes never touch this worker on the way in.
      await job.log(`Sending to ElevenLabs for ${languageLabel} dubbing...`);
      const { dubbingId, expectedDurationSec } = await this.createElevenLabsDub(
        apiKey, inputUrl, targetLanguage, targetAccent,
      );

      // durationSeconds came from the browser and set both the price and the plan cap.
      // This is the first independent reading of it, so check before the expensive
      // part runs rather than after.
      if (expectedDurationSec && !isDubDurationAllowed(planName, expectedDurationSec)) {
        throw new Error(
          `This clip is ${Math.round(expectedDurationSec)}s, over the ${maxDubSecondsForPlan(planName)}s limit on your plan.`,
        );
      }

      // Re-price against the vendor's reading too, not just the cap. The browser sets
      // the reservation and a tampered `durationSeconds` would otherwise buy a
      // 45-minute dub for one second's worth of credits.
      if (expectedDurationSec) {
        chargedCredits = await this.settleCredits(userId, chargedCredits, expectedDurationSec, job);
        await this.updateJob(projectId, { credits_consumed: chargedCredits });
      } else {
        // No independent reading available: the browser's number stands as the price.
        this.logger.warn(`Dub ${projectId}: ElevenLabs returned no duration — priced on the client's ${durationSeconds}s.`);
      }

      await this.throwIfCancelled(job.id!);
      await this.updateJob(projectId, { status: 'cloning' });
      await job.log('Cloning your voice and generating the dub...');

      // 2. Poll until it reports done.
      await this.waitForElevenLabsDub(apiKey, dubbingId, job);
      await job.updateProgress(70);

      // 3. Stream the result straight into the signed GCS PUT URL — piped, never
      //    buffered, so a large MP4 stays off the heap.
      await this.throwIfCancelled(job.id!);
      await job.log('Storing the dubbed file...');
      await this.streamDubToGcs(apiKey, dubbingId, targetLanguage, outputPutUrl, outputContentType);
      await job.updateProgress(80);

      // The result is now in GCS at the pre-signed location.
      // Last cancellation window — stopping here refunds and discards a finished dub.
      await this.throwIfCancelled(job.id!);
      const dubbedUrl = outputPublicUrl;
      await job.updateProgress(90);

      // 5. Credits were already settled above — nothing can fail between a finished dub
      //    and the user having it, which is the whole point of reserving at enqueue.
      await this.updateJob(projectId, {
        status: 'completed',
        dubbed_url: dubbedUrl,
        credits_consumed: chargedCredits,
      });
      await job.updateProgress(100);
      await job.log(`Done! ${chargedCredits} credits deducted.`);

      return { dubbedUrl };
    } catch (error: any) {
      const cancelled = error instanceof DubbingCancelledError;
      // Nothing was delivered, so nothing is owed — hand the reservation back before
      // anything else, including before the error is reported.
      await this.refundCredits(userId, chargedCredits);
      chargedCredits = 0;
      await job.log(cancelled ? 'Cancelled by user.' : `Fatal error: ${error.message}`);
      if (!cancelled) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
        // User-initiated cancellations aren't failures — never alert on them.
        void reportError(this.supabase, {
          source: 'worker',
          feature: 'dubbing',
          userId,
          error,
          context: { jobId: job.id, projectId, targetLanguage, targetAccent, durationSeconds, planName, isVideo },
        });
      }
      try {
        await this.updateJob(projectId, {
          status: 'failed',
          error_message: error.message?.slice(0, 5000),
          credits_consumed: 0,
        });
      } catch (updateError: any) {
        this.logger.error(
          `Job ${job.id}: failed to persist failed status for dub ${projectId}: ${updateError?.message}`,
          updateError?.stack,
        );
      }
      throw error;
    }
  }

  /**
   * Bring the amount already deducted in line with what the dub actually costs at the
   * vendor's own duration, and return the new figure.
   *
   * Charging more can fail (the user may not hold the difference) — and it must fail the
   * job rather than deliver, because this runs before the dub is handed over. Refunding
   * the difference cannot fail in a way worth stopping for.
   */
  private async settleCredits(
    userId: string,
    charged: number,
    actualDurationSeconds: number,
    job: Job<DubJobData>,
  ): Promise<number> {
    const multiplier = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
    const owed = calculateDubbingCreditsByDuration(actualDurationSeconds, multiplier);
    const delta = owed - charged;
    if (delta === 0) return owed;

    if (delta > 0) {
      const { error } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -delta,
      });
      if (error) {
        throw new Error(
          `This clip is ${Math.round(actualDurationSeconds)}s and costs ${owed} credits — that is more than your balance covers. Top up or trim the clip.`,
        );
      }
      await job.log(`Clip measured ${Math.round(actualDurationSeconds)}s — ${delta} more credits charged.`);
      return owed;
    }

    await this.refundCredits(userId, -delta);
    await job.log(`Clip measured ${Math.round(actualDurationSeconds)}s — ${-delta} credits returned.`);
    return owed;
  }

  /** Give credits back. Never throws: a failed refund must not mask the original error. */
  private async refundCredits(userId: string, credits: number): Promise<void> {
    if (credits <= 0) return;
    const { error } = await this.supabase.rpc('update_user_credits', {
      user_uuid: userId,
      credit_change: credits,
    });
    if (error) {
      this.logger.error(`Failed to refund ${credits} credits to user ${userId}: ${error.message}`);
    }
  }

  /**
   * Kick off the dub. `source_url` means ElevenLabs pulls the media itself, so we
   * never proxy the upload. Voice cloning is left at its default (on): the output
   * voice is cloned from the speaker in the source, which for a creator dubbing
   * their own video is their own voice.
   */
  private async createElevenLabsDub(
    apiKey: string,
    sourceUrl: string,
    targetLanguage: string,
    targetAccent?: string | null,
  ): Promise<{ dubbingId: string; expectedDurationSec: number | null }> {
    const form = new FormData();
    form.append('source_url', sourceUrl);
    form.append('target_lang', targetLanguage);
    form.append('num_speakers', '0'); // auto-detect, so each speaker gets their own clone
    if (targetAccent) form.append('target_accent', targetAccent);

    const response = await fetch(`${ELEVENLABS_API}/dubbing`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Cloned voices count against the workspace voice limit, and the dub is
      // rejected outright when none are free — worth naming, it is not a retry.
      if (response.status === 403 && /voice/i.test(detail)) {
        throw new Error('Dubbing is temporarily unavailable — our voice capacity is full. Please try again later.');
      }
      throw new Error(`ElevenLabs dubbing failed (${response.status}): ${detail.slice(0, 400)}`);
    }

    const data = (await response.json()) as { dubbing_id?: string; expected_duration_sec?: number };
    if (!data.dubbing_id) throw new Error('ElevenLabs did not return a dubbing id');

    return {
      dubbingId: data.dubbing_id,
      expectedDurationSec: typeof data.expected_duration_sec === 'number' ? data.expected_duration_sec : null,
    };
  }

  /** Poll until the dub reports `dubbed`. Bounded so a stuck job cannot pin a slot. */
  private async waitForElevenLabsDub(apiKey: string, dubbingId: string, job: Job<DubJobData>): Promise<void> {
    const deadline = Date.now() + ELEVENLABS_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await this.throwIfCancelled(job.id!);

      const response = await fetch(`${ELEVENLABS_API}/dubbing/${dubbingId}`, {
        headers: { 'xi-api-key': apiKey },
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`ElevenLabs status check failed (${response.status}): ${detail.slice(0, 300)}`);
      }

      const data = (await response.json()) as { status?: string; error?: string };
      if (data.status === 'dubbed') return;
      if (data.status === 'failed') {
        throw new Error(`Dubbing failed: ${data.error ?? 'ElevenLabs did not say why'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, ELEVENLABS_POLL_INTERVAL_MS));
    }

    throw new Error('Dubbing took too long and timed out. Please try a shorter clip.');
  }

  /**
   * Pipe the finished dub into the pre-signed GCS PUT URL. Passing the response body
   * straight through as the request body streams it, so a dubbed MP4 that can run to
   * hundreds of MB is never buffered here.
   */
  private async streamDubToGcs(
    apiKey: string,
    dubbingId: string,
    targetLanguage: string,
    putUrl: string,
    contentType: string,
  ): Promise<void> {
    const response = await fetch(`${ELEVENLABS_API}/dubbing/${dubbingId}/audio/${targetLanguage}`, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Could not download the dubbed file (${response.status}): ${detail.slice(0, 300)}`);
    }

    const upload = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: response.body,
      duplex: 'half', // required by undici when the body is a stream
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    } as RequestInit & { duplex: 'half' });

    if (!upload.ok) {
      const detail = await upload.text().catch(() => '');
      throw new Error(`Failed to store the dubbed file (${upload.status}): ${detail.slice(0, 300)}`);
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
