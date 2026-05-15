import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import { webhookHandler } from './routes/webhook.js';
import { streamHandler } from './routes/stream.js';
import { sttHandler } from './routes/stt.js';
import { ttsHandler } from './routes/tts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/voice/webhook', webhookHandler);
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'openclaw-voice' });
});

// Route not found handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// HTTP Server
const httpServer = createServer(app);

// WebSocket Server (for Media Stream)
const wss = new WebSocketServer({
  server: httpServer,
  path: '/voice/stream'
});

console.log(`✅ WebSocket server listening on /voice/stream`);

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log(`🔗 WebSocket connected from ${req.socket.remoteAddress}`);

  // Call side identifier from query param or socket ID
  const callSid = req.url.split('?')[1]?.split('=')[1] || `WS-${ws.socket.id}`;
  const from = req.url.split('?')[2]?.split('=')[1] || null;

  ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({
    type: 'connected',
    callSid,
    from
  }));

  ws.on('message', (data) => {
    try {
      const message = typeof data === 'string' ? { text: data } : JSON.parse(data);
      console.log(`📤 WS message for ${callSid}:`, message.type || 'audio');

      // Handle different message types
      if (message.type === 'start') {
        console.log(`🎤 Call started: ${callSid}`);
      } else if (message.type === 'end') {
        console.log(`⏹️ Call ended: ${callSid}`);
      } else if (message.type === 'stt') {
        // Forward transcript to separate handler
        sttHandler(req, {
          json: (data) => ({
            CallSid: callSid,
            ...data
          })
        }, {
          send: (res) => {
            res.status(200).json(res);
          }
        });
      }
    } catch (err) {
      console.error('❌ WS message error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`❌ WebSocket disconnected: ${callSid}`);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
  });
});

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 HTTP: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/voice/stream (wss:// on production)`);
});