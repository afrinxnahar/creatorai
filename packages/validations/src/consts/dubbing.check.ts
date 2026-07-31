/**
 * Runnable self-check for the dubbing pure logic. No framework.
 *   npx tsx packages/validations/src/consts/dubbing.check.ts
 */
import assert from 'node:assert';
import {
  canDub,
  DUBBING_PLANS,
  DUBBING_CANCEL_PREFIX,
  STARTER_MAX_DUB_SECONDS,
  maxDubSecondsForPlan,
  isDubDurationAllowed,
} from './dubbing';
import {
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
} from './credits';
import { SignDubUploadSchema, CreateDubSchema } from '../schema/dubbing.schema';

// Plan gating: EVERY plan can dub now (Starter included) — the limit is duration,
// not access. Case-insensitive, null-safe.
assert.equal(canDub('Creator'), true);
assert.equal(canDub('pro'), true);
assert.equal(canDub('Business'), true);
assert.equal(canDub('SCALE'), true);
assert.equal(canDub('Starter'), true);
assert.equal(canDub('starter'), true);
assert.equal(canDub(null), false); // no active plan at all → still blocked
assert.equal(canDub(undefined), false);
assert.equal(canDub(''), false);
assert.deepEqual([...DUBBING_PLANS], ['starter', 'creator', 'pro', 'business', 'scale']);

// Duration cap: Starter is capped, every paid plan is uncapped. An unknown/missing
// plan must fail CLOSED (treated as Starter), never open.
assert.equal(maxDubSecondsForPlan('Starter'), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan('starter'), 60);
assert.equal(maxDubSecondsForPlan('Creator'), null);
assert.equal(maxDubSecondsForPlan('scale'), null);
assert.equal(maxDubSecondsForPlan(null), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan(undefined), STARTER_MAX_DUB_SECONDS);

assert.equal(isDubDurationAllowed('Starter', 60), true); // exactly at the cap is fine
assert.equal(isDubDurationAllowed('Starter', 60.5), false);
assert.equal(isDubDurationAllowed('Starter', 600), false);
assert.equal(isDubDurationAllowed('Pro', 6000), true);
assert.equal(isDubDurationAllowed(null, 61), false); // fails closed

// Duration-based credits: cost = ceil(seconds) × multiplier, floored at one second.
assert.equal(calculateDubbingCreditsByDuration(60, 3), 180);
assert.equal(calculateDubbingCreditsByDuration(59.2, 3), 180); // rounds up
assert.equal(calculateDubbingCreditsByDuration(0, 3), 3); // floor: never free
assert.equal(calculateDubbingCreditsByDuration(1, 3), 3);
assert.equal(getMinimumCreditsForDubbing(3), 3);
assert.equal(getMinimumCreditsForDubbing(), DUBBING_CREDIT_MULTIPLIER);

// A Starter user's 500 credits must buy two full-length trial dubs at the cap.
assert.equal(calculateDubbingCreditsByDuration(STARTER_MAX_DUB_SECONDS, DUBBING_CREDIT_MULTIPLIER) * 2 <= 500, true);

// Sign-upload schema: audio/video only, positive size and duration required.
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
  }).success,
  true,
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.pdf', contentType: 'application/pdf', fileSize: 1000, isVideo: false, durationSeconds: 10,
  }).success,
  false, // not audio/* or video/*
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 0,
  }).success,
  false, // duration must be positive
);

// Create schema: objectName-based (no raw client URL); numbers coerce, booleans don't.
const created = CreateDubSchema.parse({
  objectName: 'user-1/dubbing/123_a.mp3',
  targetLanguage: 'es',
  isVideo: false,
  mediaName: 'My clip',
  durationSeconds: '42',
});
assert.equal(created.isVideo, false);
assert.equal(created.durationSeconds, 42);
// The string "false" must be rejected, not silently coerced to true.
assert.equal(
  CreateDubSchema.safeParse({
    objectName: 'user-1/dubbing/123_a.mp3', targetLanguage: 'es', isVideo: 'false', mediaName: 'x', durationSeconds: 5,
  }).success,
  false,
);
assert.equal(CreateDubSchema.safeParse({ targetLanguage: 'es', isVideo: false, mediaName: 'x', durationSeconds: 5 }).success, false); // objectName required

// Cancel prefix is stable — the API sets it, the worker polls it.
assert.equal(DUBBING_CANCEL_PREFIX, 'dubbing:cancel:');

console.log('dubbing self-check OK');
