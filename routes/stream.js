/**
 * Media Stream WebSocket Handler
 * Bi-directional audio streaming between Twilio and Whisper/TTS
 */

export function streamHandler(ws, req) {
  // Call side identifier
  const callSid = req.url.split('?')[1]?.split('=')[1] || `WS-${Math.random().toString(36).substr(2, 9)}`;
  const from = req.url.split('?')[2]?.split('=')[1] || null;
  const to = req.url.split('?')[3]?.split('=')[1] || null;

  console.log(`🔗 WS stream connected: ${callSid}`);
  console.log(`  From: ${from}`);
  console.log(`  To: ${to}`);
  console.log(`  Direction: ${from ? 'INBOUND' : 'OUTBOUND'}`);

  // Store this connection per call
  req.callSid = callSid;

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    callSid,
    from,
    to,
    timestamp: new Date().toISOString()
  }));

  // Handle WebSocket messages (audio or control)
  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        console.log(`📤 Received audio chunk (${data.length} bytes) for ${callSid}`);
        // Forward to STT processor
        // In production, you'd send this to whisper-node processor
      } else {
        const message = JSON.parse(data);
        console.log(`🗣️ Message for ${callSid}:`, message);

        if (message.type === 'say') {
          console.log(`🎤 Speaking: "${message.text}"`);
          // Send audio using ElevenLabs TTS (via separate channel or here)
          await sendTTSAudio(ws, message.text);
        }
      }
    } catch (err) {
      console.error('❌ WS message error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`❌ WS stream closed: ${callSid}`);
  });

  ws.on('error', (err) => {
    console.error('❌ WS stream error:', err);
  });
}

async function sendTTSAudio(ws, text) {
  try {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      console.error('❌ ElevenLabs API key not configured');
      return;
    }

    // Call ElevenLabs TTS endpoint (standard voice)
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`,
      {
        text: text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
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

    // Send audio back to Twilio via WebSocket
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(Buffer.from(response.data));
      console.log(`✅ Sent TTS audio to Twilio (${response.data.length} bytes)`);
    }
  } catch (err) {
    console.error('❌ TTS error:', err.message);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: 'TTS failed' }));
    }
  }
}