import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';

const APPLICATION = { id: 'app-1', email: 'candidate@example.com' };

/**
 * Minimal Supabase stub: `select(...).eq(...).single()` resolves to the row the
 * test hands in, `update(...).eq(...).select().single()` echoes the patch back
 * and records it so assertions can read what was written.
 */
function makeDb(row: Record<string, unknown> | null) {
  const writes: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve(
              row ? { data: row, error: null } : { data: null, error: { message: 'no rows' } },
            ),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        writes.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...row, ...patch }, error: null }),
            }),
          }),
        };
      },
      insert: () => Promise.resolve({ error: null }),
    }),
  };
  return { client, writes };
}

function build(row: Record<string, unknown> | null, resendApiKey?: string) {
  const { client, writes } = makeDb(row);
  return Test.createTestingModule({
    providers: [
      AdminService,
      { provide: ConfigService, useValue: { get: () => resendApiKey } },
      { provide: SupabaseService, useValue: { getAdminClient: () => client } },
    ],
  })
    .compile()
    .then((module: TestingModule) => ({
      service: module.get<AdminService>(AdminService),
      writes,
    }));
}

describe('AdminService.replyToApplication', () => {
  it('rejects an empty subject or body before touching the database', async () => {
    const { service } = await build(APPLICATION);

    await expect(service.replyToApplication('app-1', 'admin-1', '   ', '<p>hi</p>')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.replyToApplication('app-1', 'admin-1', 'Subject', '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFound for an unknown application', async () => {
    const { service } = await build(null, 're_test');

    await expect(
      service.replyToApplication('missing', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(NotFoundException);
  });

  it('fails loudly when Resend is not configured', async () => {
    const { service } = await build(APPLICATION);

    await expect(
      service.replyToApplication('app-1', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('sends from the support mailbox and stamps the application as contacted', async () => {
    const { service, writes } = await build(APPLICATION, 're_test');
    const send = jest
      .fn()
      .mockResolvedValue({ data: { id: 'sent-1' }, error: null });
    (service as unknown as { resend: { emails: { send: unknown } } }).resend = {
      emails: { send },
    };

    const result = await service.replyToApplication(
      'app-1',
      'admin-1',
      'Your application for Engineer at Creator AI',
      '<p>Thanks for applying.</p>',
    );

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.from).toBe('Creator AI Support <support@trycreatorai.com>');
    expect(payload.replyTo).toBe('support@trycreatorai.com');
    expect(payload.to).toBe('candidate@example.com');
    expect(payload.html).toContain('Thanks for applying.');

    expect(writes).toHaveLength(1);
    expect(writes[0].replied_by).toBe('admin-1');
    expect(typeof writes[0].replied_at).toBe('string');
    expect(result.success).toBe(true);
  });

  it('does not mark the application contacted when the send fails', async () => {
    const { service, writes } = await build(APPLICATION, 're_test');
    (service as unknown as { resend: { emails: { send: unknown } } }).resend = {
      emails: { send: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) },
    };

    await expect(
      service.replyToApplication('app-1', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(InternalServerErrorException);
    expect(writes).toHaveLength(0);
  });
});
