import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

/** Bundled binary, overridable for images that ship their own ffmpeg. */
function ffmpegBin(): string {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (ffmpegPath && existsSync(ffmpegPath)) return ffmpegPath;
  return 'ffmpeg';
}

async function run(args: string[]): Promise<void> {
  // maxBuffer guards against ffmpeg's progress chatter filling the default 1MB pipe
  // on long inputs, which surfaces as a spurious ENOBUFS failure.
  await execFileAsync(ffmpegBin(), args, { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Extract a mono MP3 suitable for ElevenLabs voice cloning.
 *
 * `maxSeconds` keeps the sample inside what instant cloning actually uses — more audio
 * does not improve the clone but does slow the upload.
 */
export async function extractVoiceSample(
  inputPath: string,
  outputPath: string,
  maxSeconds = 180,
): Promise<void> {
  await run([
    '-y',
    '-i', inputPath,
    '-vn',
    '-ac', '1',
    '-ar', '44100',
    '-b:a', '128k',
    '-t', String(maxSeconds),
    outputPath,
  ]);
}

/**
 * Replace a video's audio track with the dubbed audio.
 *
 * `-shortest` trims to whichever stream ends first; translated speech rarely matches
 * the original length, so long dubs can drift from the picture. Fixing that needs
 * per-segment alignment, which is a bigger change than swapping the track.
 */
export async function muxAudioOverVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await run([
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ]);
}
