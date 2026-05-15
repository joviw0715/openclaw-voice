/**
 * Speech-to-Text (STT) Handler
 * Receives audio chunks from Twilio and transcribes using Whisper
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Handle STT request (audio chunks signaled via WebSocket)
 */
export async function sttHandler(req, res) {
  // This is the HTTP endpoint that receives individual audio chunks
  // For a more efficient implementation, audio would be streamed continuously
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

    // Check if Whisper is installed
    try {
      await execAsync('which whisper-node');
    } catch (err) {
      // Try system-installed whisper
      try {
        await execAsync('which whisper');
      } catch (err) {
        throw new Error('Whisper not found. Install: npm install -g whisper-node or apt install whisper');
      }
    }

    // Create temporary audio file
    const fs = require('fs').promises;
    const path = require('path');
    const tmpDir = '/tmp/audio-transcribe';
    await fs.mkdir(tmpDir, { recursive: true });

    const filename = `audio-${Date.now()}.${format}`;
    const filepath = path.join(tmpDir, filename);

    // Write audio file
    await fs.writeFile(filepath, audioBuffer);

    // Run Whisper transcription
    // Pre-processing: convert to WAV 16kHz mono and s16le
    const wavPath = filepath.replace(`.${format}`, '.wav');

    // Using ffmpeg for conversion
    await execAsync(`ffmpeg -y -ar 16000 -ac 1 -f ${format === 'mulaw' ? 'u8' : 's16le'} -i ${filepath} ${wavPath}`);

    // Run Whisper (simplified - use whisper-node for best results)
    let transcript = '';
    try {
      // Try whisper-node first
      const { output } = await execAsync(`whisper-node "${wavPath}" 2>/dev/null`);
      transcript = output.trim();
    } catch (err) {
      // Fall back to system whisper-cli
      const { stdout } = await execAsync(`whisper "${wavPath}" --model base --device cpu --no_print_timestamps`);
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
 * Handle incoming audio via HTTP POST
 * This can receive base64-encoded audio chunks
 */
export async function audioHandler(req, res) {
  try {
    const { audio, format = 'mulaw' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }

    // Decode base64 audio
    const audioBuffer = Buffer.from(audio, 'base64');

    // Transcribe
    const transcript = await transcribeAudio(audioBuffer, format);

    res.json({
      transcript,
      CallSid: req.body.CallSid
    });

  } catch (err) {
    console.error('❌ Audio handler error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
}

/**
 * In-memory transcript storage for call context
 */
export const transcripts = new Map();