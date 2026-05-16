/**
 * Text-to-Speech (TTS) Handler
 * Uses ElevenLabs API to convert text to speech
 */

import axios from 'axios';
import { getCallSession } from './session.js';

/**
 * Predefined ElevenLabs voice ID for quick access
 */
export const predefinedVoice = process.env.ELEVENLABS_VOICE || '21m00Tcm4TlvDq8ikWAM';

export async function ttsHandler(req, res) {
  try {
    const { text, CallSid, voice, speed, pitch } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }

    console.log(`🔊 Generating TTS for Call ${CallSid || 'general'}: "${text}"`);

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      console.error('❌ ElevenLabs API key not configured');
      return res.status(500).json({ error: 'ElevenLabs not configured' });
    }

    // Voice options (ElevenLabs voice IDs)
    const availableVoices = [
      '21m00Tcm4TlvDq8ikWAM', // Rachel (default)
      'EXAVITQu4vr4xnSDxMaL', // Adam
      'HzWkd5FlvfDfxH08Kthc', // Bella
      'AZnzlk1XvdvUeBnXmlld', // Conrad
      'JEoC8xnYFwFebhGdnghn', // Drew
      'ilDhdC31VqMovYr2mrCR', // Jessica
      'FIMQrVypsGrQ1a6hkdBS'  // Sarah
    ];

    const selectedVoice = voice || predefinedVoice || availableVoices[0];

    // Generate audio using ElevenLabs
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey
        },
        responseType: 'arraybuffer'
      }
    );

    // Response format: audio bytes for streaming, or base64 for direct API response
    if (req.query.format === 'base64') {
      const base64Audio = Buffer.from(response.data).toString('base64');
      res.json({
        audio: base64Audio,
        format: 'mp3',
        CallSid
      });
    } else {
      // Stream audio back
      res.set('Content-Type', 'audio/mpeg');
      res.send(response.data);
    }

    console.log(`✅ TTS generated successfully (${response.data.length} bytes)`);

  } catch (err) {
    console.error('❌ TTS error:', err.message);
    console.error('Details:', err.response ? err.response.data : err);
    res.status(500).json({
      error: 'TTS generation failed',
      details: err.message
    });
  }
}