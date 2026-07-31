/**
 * Runnable self-check for the TTS chunker.
 *   npx tsx packages/workers/src/processor/utils/elevenlabs.check.ts
 */
import assert from 'node:assert';
import { chunkForTts } from './elevenlabs';
import { supportedLanguages, ELEVENLABS_TTS_MODEL } from '@repo/validation';

// Short text stays whole.
assert.deepEqual(chunkForTts('Hello there.'), ['Hello there.']);
assert.deepEqual(chunkForTts('   '), []);
assert.deepEqual(chunkForTts(''), []);

// Splits on sentence ends, never mid-word, and loses no content.
const sentences = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i}.`).join(' ');
const chunks = chunkForTts(sentences, 100);
assert.equal(chunks.length > 1, true);
for (const chunk of chunks) {
  assert.equal(chunk.length <= 100, true, `chunk over limit: ${chunk.length}`);
  assert.equal(chunk, chunk.trim());
}
// Every word survives the split — a dropped word is a dropped word in the dub.
assert.deepEqual(chunks.join(' ').split(/\s+/), sentences.split(/\s+/));

// A single sentence longer than the limit must still be emitted, hard-split.
const runOn = 'x'.repeat(250);
const runOnChunks = chunkForTts(runOn, 100);
assert.equal(runOnChunks.length, 3);
assert.equal(runOnChunks.join(''), runOn);
for (const chunk of runOnChunks) assert.equal(chunk.length <= 100, true);

// CJK sentence enders count as boundaries too.
const cjk = chunkForTts('これはテストです。もう一つの文です。三番目の文です。', 20);
assert.equal(cjk.every((c) => c.length <= 20), true);
assert.equal(cjk.join('').replace(/\s/g, ''), 'これはテストです。もう一つの文です。三番目の文です。');

// ── Language list must match what the TTS model can actually speak ──────────
assert.equal(ELEVENLABS_TTS_MODEL, 'eleven_multilingual_v2');
assert.equal(supportedLanguages.length, 29, 'eleven_multilingual_v2 supports exactly 29 languages');

const codes = supportedLanguages.map((l) => l.value);
assert.equal(new Set(codes).size, codes.length, 'duplicate language code');
// Norwegian is Flash-v2.5-only; offering it would synthesise the wrong language.
assert.equal(codes.includes('no' as never), false);
for (const expected of ['en', 'es', 'ar', 'uk', 'ta', 'fil', 'ms', 'sv']) {
  assert.equal(codes.includes(expected as never), true, `missing ${expected}`);
}

console.log(`elevenlabs self-check OK (${supportedLanguages.length} languages)`);
