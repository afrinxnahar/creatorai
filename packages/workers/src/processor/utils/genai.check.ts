/**
 * Runnable self-check for extractResponseText.
 *   npx tsx packages/workers/src/processor/utils/genai.check.ts
 */
import assert from 'node:assert';
import type { GenerateContentResponse } from '@google/genai';
import { extractResponseText } from './genai';

const res = (candidate: unknown, promptFeedback?: unknown) =>
  ({ candidates: candidate ? [candidate] : [], promptFeedback }) as unknown as GenerateContentResponse;

// Plain answer.
assert.deepEqual(
  extractResponseText(res({ content: { parts: [{ text: '{"a":1}' }] }, finishReason: 'STOP' })),
  { text: '{"a":1}', reason: null },
);

// Reasoning first, answer second — reading parts[0] would return the reasoning and
// then fail to parse. Thought parts must be skipped, not concatenated.
assert.deepEqual(
  extractResponseText(
    res({
      content: { parts: [{ text: 'Let me think about the tone...', thought: true }, { text: '{"a":1}' }] },
      finishReason: 'STOP',
    }),
  ),
  { text: '{"a":1}', reason: null },
);

// Split answer across parts.
assert.equal(
  extractResponseText(res({ content: { parts: [{ text: '{"a":' }, { text: '1}' }] }, finishReason: 'STOP' })).text,
  '{"a":1}',
);

// Thought-only: the exact production failure — `.text` is undefined and
// JSON.parse(undefined) throws '"undefined" is not valid JSON'.
const thoughtOnly = extractResponseText(
  res({ content: { parts: [{ text: 'thinking...', thought: true }] }, finishReason: 'MAX_TOKENS' }),
);
assert.equal(thoughtOnly.text, null);
assert.match(thoughtOnly.reason!, /output limit.*reasoning/i);

// Truncated mid-answer.
const truncated = extractResponseText(
  res({ content: { parts: [{ text: '{"a":' }] }, finishReason: 'MAX_TOKENS' }),
);
assert.equal(truncated.text, '{"a":'); // partial text still returned; JSON.parse reports it
assert.equal(truncated.reason, null);

// Safety block.
const blocked = extractResponseText(res({ content: { parts: [] } }, { blockReason: 'SAFETY' }));
assert.equal(blocked.text, null);
assert.match(blocked.reason!, /safety/i);

// Non-STOP finish reason is named so the log says why.
const recitation = extractResponseText(res({ content: { parts: [] }, finishReason: 'RECITATION' }));
assert.equal(recitation.text, null);
assert.match(recitation.reason!, /RECITATION/);

// Empty / malformed responses must not throw.
assert.equal(extractResponseText(res(null)).text, null);
assert.equal(extractResponseText({} as GenerateContentResponse).text, null);
assert.equal(extractResponseText(res({ content: {} })).text, null);
assert.equal(extractResponseText(res({ content: { parts: [{ text: '   ' }] } })).text, null);

console.log('genai self-check OK');
