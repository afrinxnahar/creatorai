import { reportError } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The value of error reporting is entirely in the grouping: if the same bug
 * produced a new fingerprint every time, the alert cooldown would never fire and
 * a single bad deploy would send thousands of emails.
 */
function mockClient(options: { alertedRecently?: boolean } = {}) {
  const inserted: Record<string, unknown>[] = [];

  const client = {
    from: () => ({
      // reportError's occurrence count and cooldown lookup
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          return {
            eq: () => ({ gte: () => Promise.resolve({ count: 0 }) }),
          };
        }
        return {
          eq: () => ({
            gte: () => ({
              limit: () => Promise.resolve({ data: options.alertedRecently ? [{ id: 'x' }] : [] }),
            }),
          }),
        };
      },
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'row-1' }, error: null }) }) };
      },
    }),
  } as unknown as SupabaseClient;

  return { client, inserted };
}

describe('reportError fingerprinting', () => {
  const base = { source: 'worker' as const, feature: 'ideation', userId: 'u1' };
  const realKey = process.env.RESEND_API_KEY;

  // Never let a developer's real key turn a test run into outbound email.
  beforeAll(() => { delete process.env.RESEND_API_KEY; });
  afterAll(() => { if (realKey) process.env.RESEND_API_KEY = realKey; });

  it('groups the same failure across users, ids and numbers', async () => {
    const { client, inserted } = mockClient({ alertedRecently: true });

    await reportError(client, {
      ...base,
      error: new Error('Failed to parse idea synthesis response for job 8f1c2d3e-1111-4222-8333-444455556666'),
    });
    await reportError(client, {
      ...base,
      userId: 'u2',
      error: new Error('Failed to parse idea synthesis response for job aaaabbbb-2222-4333-8444-555566667777'),
    });

    expect(inserted).toHaveLength(2);
    expect(inserted[0]!.fingerprint).toBe(inserted[1]!.fingerprint);
  });

  it('separates different failures in the same feature', async () => {
    const { client, inserted } = mockClient({ alertedRecently: true });

    await reportError(client, { ...base, error: new Error('Insufficient credits') });
    await reportError(client, { ...base, error: new TypeError('genAI.models is undefined') });

    expect(inserted[0]!.fingerprint).not.toBe(inserted[1]!.fingerprint);
  });

  it('marks alerted_at only when the cooldown has expired', async () => {
    const muted = mockClient({ alertedRecently: true });
    await reportError(muted.client, { ...base, error: new Error('boom') });
    expect(muted.inserted[0]!.alerted_at).toBeNull();

    const fresh = mockClient({ alertedRecently: false });
    // No RESEND_API_KEY in tests: the row is still flagged, the send is skipped.
    await reportError(fresh.client, { ...base, error: new Error('boom') });
    expect(fresh.inserted[0]!.alerted_at).toEqual(expect.any(String));
  });

  it('captures the stack and never throws on a non-Error value', async () => {
    const { client, inserted } = mockClient({ alertedRecently: true });

    await reportError(client, { ...base, error: new Error('with stack') });
    expect(inserted[0]!.stack).toContain('Error: with stack');

    await expect(reportError(client, { ...base, error: 'plain string failure' })).resolves.toBeUndefined();
    expect(inserted[1]!.message).toBe('plain string failure');
  });
});
