/**
 * Speech-to-Text (STT) Handler
 * Receives audio chunks from Twilio and transcribes using Whisper
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Only allow known, safe audio format values
const ALLOWED_FORMATS = new Set(['mulaw', 'pcm']);

/**
 * Handle STT request — accepts base64-encoded audio via HTTP POST
 * Body: { audio: <base64 string>, format: 'mulaw'|'pcm', CallSid: string }
 */
export async function sttHandler(req, res) {
  try {
    const { audio, format = 'mulaw', CallSid } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }

    if (!ALLOWED_FORMATS.has(format)) {
      return res.status(400).json({ error: `Unsupported audio format: ${format}. Allowed: mulaw, pcm` });
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    const transcript = await transcribeAudio(audioBuffer, format);

    res.json({ transcript, CallSid });
  } catch (err) {
    console.error('❌ STT handler error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
}

/**
 * Transcribe audio using Whisper (local)
 * @param {Buffer} audioBuffer - Raw audio data
 * @param {string} format - Audio format (mulaw, pcm, etc.)
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioBuffer, format = 'mulaw') {
  try {
    console.log(`🎙️ Transcribing audio (${audioBuffer.length} bytes, format: ${format})`);

    // Validate format against the allow-list before using it anywhere
    if (!ALLOWED_FORMATS.has(format)) {
      throw new Error(`Unsupported audio format: ${format}`);
    }

    // Check if Whisper is installed
    try {
      await execFileAsync('which', ['whisper-node']);
    } catch (err) {
      // Try system-installed whisper
      try {
        await execFileAsync('which', ['whisper']);
      } catch (err) {
        throw new Error('Whisper not found. Install: npm install -g whisper-node or apt install whisper');
      }
    }

    // Create temporary audio file using a fixed extension derived from the validated format
    const tmpDir = '/tmp/audio-transcribe';
    await fs.mkdir(tmpDir, { recursive: true });

    // Use a numeric timestamp-based name; extension comes from the validated format value only
    const filename = `audio-${Date.now()}.${format}`;
    const filepath = join(tmpDir, filename);

    // Write audio file
    await fs.writeFile(filepath, audioBuffer);

    // Pre-processing: convert to WAV 16kHz mono using ffmpeg via execFile (no shell)
    const wavPath = join(tmpDir, `audio-${Date.now()}.wav`);
    const ffmpegInputFormat = format === 'mulaw' ? 'u8' : 's16le';
    await execFileAsync('ffmpeg', [
      '-y', '-ar', '16000', '-ac', '1',
      '-f', ffmpegInputFormat,
      '-i', filepath,
      wavPath
    ]);

    // Run Whisper transcription via execFile (no shell) to avoid command injection
    let transcript = '';
    try {
      // Try whisper-node first
      const { stdout } = await execFileAsync('whisper-node', [wavPath]);
      transcript = stdout.trim();
    } catch (err) {
      // Fall back to system whisper-cli
      const { stdout } = await execFileAsync('whisper', [
        wavPath,
        '--model', 'base',
        '--device', 'cpu',
        '--no_print_timestamps'
      ]);
      transcript = stdout.replace(/.*Speech Transcript:|Transcript:/g, '').trim();
    }

    // Cleanup
    await fs.unlink(filepath).catch(() => {});
    await fs.unlink(wavPath).catch(() => {});

    console.log(`📝 Transcript: "${transcript}"`);
    return transcript;

  } catch (err) {
    console.error('❌ STT error:', err);
    throw err;
  }
}

/**
 * In-memory transcript storage for call context
 */
export const transcripts = new Map();