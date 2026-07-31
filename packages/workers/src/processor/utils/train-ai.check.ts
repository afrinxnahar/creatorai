/**
 * Runnable self-check for the train-AI pure logic — the sampling maths that decides
 * how much video we pay Gemini to watch. No framework, no network.
 *   npx tsx packages/workers/src/processor/utils/train-ai.check.ts
 */
import assert from 'node:assert';
import {
  estimateTrainingCredits,
  TRAIN_AI_MAX_VIDEOS,
  TRAIN_AI_SECONDS_PER_VIDEO,
  TRAIN_AI_HOOK_WINDOW_SECONDS,
} from '@repo/validation';
import {
  parseIsoDurationSeconds,
  buildVideoParts,
  selectVideosForTraining,
  extractYouTubeVideoId,
  assertStyleAnalysisComplete,
  assertVideoWasActuallyRead,
  isTrainingFree,
} from './train-ai';
import type { VideoData, StyleAnalysis, Transcript } from '@repo/validation';

const URL_A = 'https://www.youtube.com/watch?v=aaa';

// ── ISO-8601 durations off the YouTube API ──────────────────────────────────
assert.equal(parseIsoDurationSeconds('PT10M30S'), 630);
assert.equal(parseIsoDurationSeconds('PT1H2M3S'), 3723);
assert.equal(parseIsoDurationSeconds('PT45S'), 45);
assert.equal(parseIsoDurationSeconds('PT2H'), 7200);
assert.equal(parseIsoDurationSeconds(undefined), 0);
assert.equal(parseIsoDurationSeconds('garbage'), 0); // must not throw or NaN

// ── Sampling: cost must NOT scale with the length the user picked ───────────
const tenMin = buildVideoParts(URL_A, 630);
const twoHour = buildVideoParts(URL_A, 7200);
const sampled = (parts: Record<string, any>[]) =>
  parts.reduce((total, p) => {
    const start = Number(String(p.videoMetadata.startOffset).replace('s', ''));
    const end = Number(String(p.videoMetadata.endOffset).replace('s', ''));
    return total + (end - start);
  }, 0);

assert.equal(tenMin.length, 2); // hook + mid window
assert.equal(twoHour.length, 2);
assert.equal(
  sampled(tenMin),
  sampled(twoHour),
  'a 10-minute and a 2-hour video must cost exactly the same to analyse',
);
assert.equal(sampled(twoHour) <= TRAIN_AI_SECONDS_PER_VIDEO, true);

// The hook window always starts at 0 — that is where style is densest.
assert.equal(twoHour[0]!.videoMetadata.startOffset, '0s');
assert.equal(twoHour[0]!.videoMetadata.endOffset, `${TRAIN_AI_HOOK_WINDOW_SECONDS}s`);
// The mid window samples the middle, not more of the intro.
assert.equal(Number(String(twoHour[1]!.videoMetadata.startOffset).replace('s', '')) > 3000, true);

// Short videos collapse to one whole-video part, and windows never overlap.
const short = buildVideoParts(URL_A, 100);
assert.equal(short.length, 1);
assert.equal(short[0]!.videoMetadata.endOffset, '100s');

const midShort = buildVideoParts(URL_A, 200);
const hookEnd = Number(String(midShort[0]!.videoMetadata.endOffset).replace('s', ''));
const midStart = Number(String(midShort[1]!.videoMetadata.startOffset).replace('s', ''));
assert.equal(midStart >= hookEnd, true, 'windows must not overlap');

// A missing/zero duration must stay bounded rather than requesting the whole video.
const unknown = buildVideoParts(URL_A, 0);
assert.equal(unknown.length, 1);
assert.equal(sampled(unknown) <= TRAIN_AI_SECONDS_PER_VIDEO, true);

// Every part carries a fileData URI — this is the bug that made training fabricate
// transcripts: the URL used to be interpolated into the prompt text instead.
// mimeType is mandatory on Vertex: without it the request 400s and no video is read.
for (const part of [...tenMin, ...twoHour, ...short]) {
  assert.equal(part.fileData.fileUri, URL_A);
  assert.equal(part.fileData.mimeType, 'video/mp4');
  assert.equal(typeof part.videoMetadata.fps, 'number');
}

// ── Video selection: bounded count, most-viewed wins ────────────────────────
const video = (id: string, views: number): VideoData => ({
  id, title: id, description: '', tags: [], duration: 'PT5M', viewCount: views,
  likeCount: 0, commentCount: 0, publishedAt: '2026-01-01T00:00:00Z', categoryId: '1',
  topicDetails: {}, thumbnailUrl: '',
});

const five = [video('a', 10), video('b', 500), video('c', 20), video('d', 900), video('e', 5)];
const urls = five.map((v) => `https://youtu.be/${v.id}`);
const picked = selectVideosForTraining(five, urls);

assert.equal(picked.videos.length, TRAIN_AI_MAX_VIDEOS);
assert.deepEqual(picked.videos.map((v) => v.id), ['d', 'b', 'c']); // by views, descending
// URLs must stay paired with their video — a mismatch would analyse the wrong clip.
assert.deepEqual(picked.urls, ['https://youtu.be/d', 'https://youtu.be/b', 'https://youtu.be/c']);

const three = five.slice(0, 3);
const kept = selectVideosForTraining(three, urls.slice(0, 3));
assert.deepEqual(kept.videos.map((v) => v.id), ['a', 'b', 'c']); // at/under the cap → original order

// ── Cost: a training must fit inside the free tier's 500 credits ────────────
const estimate = estimateTrainingCredits(3);
assert.equal(estimate <= 500, true, `training must fit in a Starter balance, got ${estimate}`);
assert.equal(estimate, estimateTrainingCredits(10), 'selecting more videos must not cost more');
assert.equal(estimate > 0, true);

// ── URL parsing: every YouTube form, and no silent pass on junk ─────────────
assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.equal(extractYouTubeVideoId('not a url'), null); // must not throw
assert.equal(extractYouTubeVideoId(''), null);
assert.equal(extractYouTubeVideoId('https://example.com/'), null);

// ── Validation: a profile must never be saved half-empty ────────────────────
const fullStyle = {
  style_analysis: 'A detailed narrative overview.',
  tone: 'conversational',
  vocabulary_level: 'accessible',
  pacing: 'brisk',
  themes: ['tech', 'tutorials'],
  humor_style: 'dry asides',
  narrative_structure: 'hook, build, payoff',
  visual_style: 'clean b-roll',
  audience_engagement: ['direct questions'],
  recommendations: { script_generation: 'x', research_topics: 'x', thumbnails: 'x', subtitles: 'x', audio_conversion: 'x', story_builder: 'x' },
} as unknown as StyleAnalysis;

assert.doesNotThrow(() => assertStyleAnalysisComplete(fullStyle));

// The two fields that were silently missing in production must now be caught.
for (const field of ['humor_style', 'narrative_structure', 'tone', 'themes', 'recommendations'] as const) {
  const broken = { ...(fullStyle as object), [field]: undefined } as unknown as StyleAnalysis;
  assert.throws(() => assertStyleAnalysisComplete(broken), new RegExp(field), `missing ${field} must fail`);
}
// Empty string / empty array / empty object count as missing, not present.
assert.throws(() => assertStyleAnalysisComplete({ ...(fullStyle as object), humor_style: '   ' } as unknown as StyleAnalysis), /humor_style/);
assert.throws(() => assertStyleAnalysisComplete({ ...(fullStyle as object), themes: [] } as unknown as StyleAnalysis), /themes/);
assert.throws(() => assertStyleAnalysisComplete({ ...(fullStyle as object), recommendations: {} } as unknown as StyleAnalysis), /recommendations/);

// ── The video-was-actually-read guard ───────────────────────────────────────
const spoken: Transcript[] = [
  { videoId: 'a', transcriptText: 'Hey everyone, welcome back.', segments: [] },
  { videoId: 'b', transcriptText: '', segments: [] },
];
assert.doesNotThrow(() => assertVideoWasActuallyRead(spoken)); // one with speech is enough

// All empty = Gemini answered from metadata, never opened the video. This is the
// exact failure that previously saved a hollow profile and reported success.
assert.throws(
  () => assertVideoWasActuallyRead([
    { videoId: 'a', transcriptText: '', segments: [] },
    { videoId: 'b', transcriptText: '   ', segments: [] },
  ]),
  /could not hear any speech/i,
);
assert.throws(() => assertVideoWasActuallyRead([]), /could not hear any speech/i);

// ── The free run is once per ACCOUNT, not once per connected channel ────────
assert.equal(isTrainingFree({}), true); // brand-new account
assert.equal(isTrainingFree({ free_training_used: false }), true);
assert.equal(isTrainingFree({ free_training_used: true }), false); // already spent
// Disconnect clears ai_trained but never free_training_used, so a reconnected user
// still pays — this is the whole point of the separate column.
assert.equal(isTrainingFree({ free_training_used: true } as any), false);

console.log(`train-ai self-check OK (a training estimates at ${estimate} credits)`);
