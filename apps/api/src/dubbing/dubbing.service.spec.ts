import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DubbingService } from './dubbing.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DUBBING_CANCEL_PREFIX } from '@repo/validation';

jest.mock('../utils', () => ({
  getSignedUploadUrl: jest.fn().mockResolvedValue('https://signed-upload-url'),
  gcsObjectMetadata: jest.fn().mockResolvedValue({ size: 1000, contentType: 'audio/mpeg' }),
  gcsPublicUrl: jest.fn(() => 'https://storage.googleapis.com/dub-bucket/obj'),
  gcsUri: jest.fn(() => 'gs://dub-bucket/obj'),
  deleteGcsObject: jest.fn().mockResolvedValue(undefined),
  getDubbingBucketName: jest.fn(() => 'dub-bucket'),
}));

/** Chainable supabase query mock: every builder method returns the chain; awaiting it
 *  (or .single()/.maybeSingle()) resolves to the configured result. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';

describe('DubbingService', () => {
  let service: DubbingService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock; getJob: jest.Mock; client: Promise<any> };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  function planResult(name: string | null) {
    return { data: name ? { plans: { name } } : null };
  }

  async function build(overrides: Partial<Record<string, any>> = {}) {
    tables = {
      subscriptions: chain(planResult('Creator')),
      profiles: chain({ data: { credits: 10_000 }, error: null }),
      dubbing_projects: chain({ data: null, error: null }),
      ...overrides,
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    queue = { add: jest.fn(), getJob: jest.fn(), client: Promise.resolve(redis) };

    const mockSupabase = { getClient: () => ({ from: (t: string) => tables[t] }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DubbingService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'GCS_DUBBING_BUCKET' ? 'dub-bucket' : undefined) } },
        { provide: getQueueToken('dubbing'), useValue: queue },
      ],
    }).compile();
    service = module.get(DubbingService);
  }

  describe('getAccess (plan gate)', () => {
    it.each(['Creator', 'Pro', 'Business', 'Scale'])('allows the paid %s plan', async (plan) => {
      await build({ subscriptions: chain(planResult(plan)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: true, plan });
    });

    it('allows Starter, but reports the 60s length cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        allowed: true,
        maxDurationSeconds: 60,
      });
    });

    it('reports no length cap on paid plans', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        allowed: true,
        maxDurationSeconds: null,
      });
    });

    it('still denies users with no subscription at all', async () => {
      await build({ subscriptions: chain(planResult(null)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: false });
    });
  });

  describe('signUpload', () => {
    const input = { filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 30 };

    it('accepts a Starter clip within the 60s cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.signUpload({ ...input, durationSeconds: 45 }, USER)).resolves.toMatchObject({
        success: true,
      });
    });

    it('rejects a Starter clip over the 60s cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.signUpload({ ...input, durationSeconds: 90 }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lets a paid plan exceed the Starter cap', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.signUpload({ ...input, durationSeconds: 900 }, USER)).resolves.toMatchObject({
        success: true,
      });
    });

    it('rejects files over 500MB', async () => {
      await build();
      await expect(
        service.signUpload({ ...input, fileSize: 501 * 1024 * 1024 }, USER),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('returns a signed URL scoped to the user prefix for a paid plan', async () => {
      await build();
      const res = await service.signUpload(input, USER);
      expect(res.uploadUrl).toBe('https://signed-upload-url');
      expect(res.objectName.startsWith(`${USER}/dubbing/`)).toBe(true);
    });
  });

  describe('createDub', () => {
    const input = {
      objectName: `${USER}/dubbing/123_a.mp3`,
      targetLanguage: 'es',
      isVideo: false,
      mediaName: 'My clip',
      durationSeconds: 30,
    };

    it("rejects an object outside the user's prefix", async () => {
      await build();
      await expect(
        service.createDub({ ...input, objectName: 'other-user/dubbing/x.mp3' }, USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when credits are below the floor', async () => {
      await build({ profiles: chain({ data: { credits: 0 }, error: null }) });
      await expect(service.createDub(input, USER)).rejects.toThrow(ForbiddenException);
    });

    // Regression: the old precheck only asked for one second's worth, so a user who
    // could not cover the whole dub still got enqueued and only failed after
    // ElevenLabs had run — at which point we'd already paid for it.
    it('rejects when credits cover the floor but not the full duration', async () => {
      await build({ profiles: chain({ data: { credits: 50 }, error: null }) });
      await expect(service.createDub(input, USER)).rejects.toThrow(/costs 90 credits and you have 50/);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('inserts the project and enqueues the worker job', async () => {
      await build();
      const res = await service.createDub(input, USER);
      expect(res.projectId).toBeTruthy();
      expect(res.jobId).toMatch(/^dubbing-user-1-/);
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ userId: USER, targetLanguage: 'es', durationSeconds: 30 }),
        expect.objectContaining({ jobId: res.jobId }),
      );
    });
  });

  describe('stopDub (cancellation)', () => {
    it('404s when the job does not exist or belongs to someone else', async () => {
      await build();
      queue.getJob.mockResolvedValue(null);
      await expect(service.stopDub(USER, 'nope')).rejects.toThrow(NotFoundException);

      queue.getJob.mockResolvedValue({ data: { userId: 'other' } });
      await expect(service.stopDub(USER, 'job-1')).rejects.toThrow(NotFoundException);
    });

    it('removes a waiting job and marks the row failed', async () => {
      await build();
      const remove = jest.fn();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1' },
        getState: () => Promise.resolve('waiting'),
        remove,
      });
      const res = await service.stopDub(USER, 'job-1');
      expect(remove).toHaveBeenCalled();
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_message: 'Cancelled by user' }),
      );
      expect(res.message).toBe('Dubbing cancelled');
    });

    it('sets the Redis cancel flag for an active job', async () => {
      await build();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1' },
        getState: () => Promise.resolve('active'),
      });
      const res = await service.stopDub(USER, 'job-1');
      expect(redis.set).toHaveBeenCalledWith(`${DUBBING_CANCEL_PREFIX}job-1`, '1', 'EX', 3600);
      expect(res.message).toBe('Cancellation requested');
    });
  });
});
