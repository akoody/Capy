import { BadRequestException } from '@nestjs/common';
import { execFile as execFileCb } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
import type { UploadedAudioFile } from './uploaded-audio-file';

/** Whisper / compatible STT APIs reject WebM; browsers usually record WebM/Opus. */
function isWebmLike(file: UploadedAudioFile): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const name = (file.originalname || '').toLowerCase();
  return (
    mime.includes('webm') ||
    name.endsWith('.webm') ||
    mime === 'video/webm'
  );
}

function bufferStartsWithWebmMatroska(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  );
}

function isMp4LikeUpload(file: UploadedAudioFile): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const name = (file.originalname || '').toLowerCase();
  return (
    mime.includes('mp4') ||
    mime.includes('m4a') ||
    mime === 'audio/x-m4a' ||
    name.endsWith('.m4a') ||
    name.endsWith('.mp4')
  );
}

/** Уже нормализованный нами WAV — не трогаем. */
function looksLikeOurWav(buffer: Buffer): boolean {
  if (buffer.length < 44) return false;
  return (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

/**
 * Порядок попыток ffmpeg: авто, затем явные демуксеры.
 * Второй/третий записи с iOS/WebKit часто дают контейнер, который без -f matroska/webm не читается;
 * раньше при ошибке mp4 мы отдавали сырой файл в OpenAI → «Invalid audio file format».
 */
const FFMPEG_INPUT_ARGS_LIST: readonly (readonly string[])[] = [
  [],
  ['-f', 'webm'],
  ['-f', 'matroska'],
  ['-f', 'mov'],
  ['-f', 'mp4'],
  ['-f', 'aac'],
];

function stderrTail(e: unknown): string {
  const err = e as { stderr?: Buffer; message?: string };
  const tail = err.stderr
    ? String(err.stderr).trim().slice(-500)
    : err.message || '';
  return tail;
}

function resolveFfmpegBinary(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundled = require('ffmpeg-static') as string | null | undefined;
    if (typeof bundled === 'string' && bundled.length > 0) {
      return bundled;
    }
  } catch {
    /* not installed */
  }
  return 'ffmpeg';
}

async function transcodeBufferToWavWithRetries(
  ffmpegBin: string,
  buffer: Buffer,
): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'capy-voice-'));
  const inPath = path.join(tmpDir, 'in.audio');
  const outPath = path.join(tmpDir, 'out.wav');

  try {
    await fs.writeFile(inPath, buffer);
    let lastErr = '';

    for (const pre of FFMPEG_INPUT_ARGS_LIST) {
      try {
        await fs.rm(outPath, { force: true });
      } catch {
        /* ignore */
      }
      try {
        await execFile(
          ffmpegBin,
          [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            ...pre,
            '-i',
            inPath,
            '-acodec',
            'pcm_s16le',
            '-ar',
            '16000',
            '-ac',
            '1',
            outPath,
          ],
          { timeout: 90_000, maxBuffer: 10 * 1024 * 1024 },
        );
        const wav = await fs.readFile(outPath);
        if (wav.length >= 64) {
          return wav;
        }
        lastErr = 'empty wav output';
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === 'ENOENT') {
          throw e;
        }
        lastErr = stderrTail(e);
      }
    }

    throw new BadRequestException(
      `Не удалось распознать или перекодировать аудио (попробованы авто/webm/matroska/mp4). ${lastErr ? `ffmpeg: ${lastErr}` : ''}`.trim(),
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Нужно ли вообще гонять ffmpeg (голос с браузера — почти всегда да).
 */
function shouldTranscode(file: UploadedAudioFile): boolean {
  if (!file.buffer?.length) return false;
  if (looksLikeOurWav(file.buffer)) return false;
  return true;
}

export async function normalizeAudioForWhisper(
  file: UploadedAudioFile,
): Promise<UploadedAudioFile> {
  if (!shouldTranscode(file)) {
    return file;
  }

  const ffmpegBin = resolveFfmpegBinary();

  try {
    const wav = await transcodeBufferToWavWithRetries(ffmpegBin, file.buffer);
    return {
      ...file,
      buffer: wav,
      mimetype: 'audio/wav',
      originalname: 'voice.wav',
      size: wav.length,
    };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ENOENT') {
      const hint =
        isWebmLike(file) ||
        bufferStartsWithWebmMatroska(file.buffer) ||
        isMp4LikeUpload(file);
      if (hint) {
        throw new BadRequestException(
          'Для голоса нужен ffmpeg на сервере или зависимость ffmpeg-static (npm install). Без него WebM/M4A из браузера не обработать.',
        );
      }
      return file;
    }
    if (e instanceof BadRequestException) {
      throw e;
    }
    throw new BadRequestException(stderrTail(e) || 'Ошибка ffmpeg');
  }
}
