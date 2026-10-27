import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import { getLocalIpAddress, PORT, HOST } from './src/config.js';
import { RoomManager } from './src/server/rooms.js';
import { setupSocketHandlers } from './src/server/socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS-friendly relative origin and fast heartbeat intervals
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 8000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

// Serve static frontend files
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.json());

const roomManager = new RoomManager();
setupSocketHandlers(io, roomManager);

// Health check endpoint
app.get('/health', (req, res) => {
  const ipInfo = getLocalIpAddress();
  res.json({
    status: 'ok',
    game: 'UNDERCOVER',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeRooms: roomManager.rooms.size,
    lanIp: ipInfo.ip,
    interface: ipInfo.interfaceName,
    port: PORT
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start listening on 0.0.0.0
server.listen(PORT, HOST, () => {
  const { ip, interfaceName } = getLocalIpAddress();

  console.log('===============================================================');
  console.log('  🎭 UNDERCOVER — WI-FI MULTIPLAYER PARTY GAME (LOCAL SERVER)  ');
  console.log('===============================================================');
  console.log(`  Status:       ONLINE & READY FOR PLAYERS`);
  console.log(`  Listening on: http://${HOST}:${PORT}`);
  console.log(`  Localhost:    http://localhost:${PORT}`);
  console.log('---------------------------------------------------------------');
  console.log(`  ★ PHONE & WI-FI URL:`);
  console.log(`  👉 http://${ip}:${PORT}`);
  console.log(`  (Network Adapter: ${interfaceName})`);
  console.log('---------------------------------------------------------------');
  console.log('  How phones connect:');
  console.log('  1. Connect phones to the same Wi-Fi as this laptop.');
  console.log(`  2. Open browser on phone and go to: http://${ip}:${PORT}`);
  console.log('  3. Create a room on laptop or phone, enter 4-letter code & play!');
  console.log('===============================================================');
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping Undercover game server (SIGINT)...');
  server.close(() => {
    console.log('Server stopped cleanly. Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nStopping Undercover game server (SIGTERM)...');
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, roomManager, io };
