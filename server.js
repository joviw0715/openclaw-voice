import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import { webhookHandler } from './routes/webhook.js';
import { streamHandler } from './routes/stream.js';
import { sttHandler } from './routes/stt.js';
import { ttsHandler } from './routes/tts.js';
import { outboundCallHandler } from './routes/call.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/voice/webhook', webhookHandler);
app.post('/voice/call', outboundCallHandler);
app.post('/voice/stt', sttHandler);
app.post('/voice/tts', ttsHandler);
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

// Handle WebSocket connections — delegate to stream route handler
wss.on('connection', (ws, req) => {
  streamHandler(ws, req);
});

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 HTTP: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/voice/stream (wss:// on production)`);
});