import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import * as Baileys from "@whiskeysockets/baileys";
const { 
  default: makeWASocket,
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  jidDecode,
  delay
} = Baileys as any;
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";

const logger = pino({ level: 'silent' });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = Number(process.env.PORT) || 3000;

  let sock: any = null;
  let qrCode: string | null = null;
  let connectionStatus: 'connecting' | 'open' | 'close' | 'qr' = 'connecting';

  async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger,
      browser: ["Gemini Agent", "Chrome", "1.0.0"]
    });

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = qr;
        connectionStatus = 'qr';
        io.emit('status', { status: 'qr', qr });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const reason = (lastDisconnect?.error as Boom)?.message || 'Unknown reason';
        
        console.log(`Connection closed. Status: ${statusCode}, Reason: ${reason}, Reconnecting: ${shouldReconnect}`);
        
        connectionStatus = 'close';
        io.emit('status', { status: 'close' });

        if (shouldReconnect) {
          // Add random jitter to avoid rapid retry cycles
          const delayMs = 5000 + Math.random() * 5000;
          console.log(`Waiting ${Math.floor(delayMs)}ms before reconnecting...`);
          setTimeout(() => {
            connectToWhatsApp();
          }, delayMs);
        } else {
          console.log('Logged out. Session cleared.');
          if (fs.existsSync('auth_info')) {
             fs.rmSync('auth_info', { recursive: true, force: true });
          }
          setTimeout(() => {
            connectToWhatsApp();
          }, 2000);
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        connectionStatus = 'open';
        qrCode = null;
        io.emit('status', { status: 'open' });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key.fromMe) return; // Don't respond to self

      const from = msg.key.remoteJid;
      const pushName = msg.pushName || "Anonymous";
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      if (!text) return;

      console.log(`Received message from ${from}: ${text}`);
      
      // Emit to frontend for processing
      io.emit('message_received', {
        id: msg.key.id,
        from,
        pushName,
        text,
        timestamp: msg.messageTimestamp
      });
    });
  }

  // Handle send reply from frontend
  io.on('connection', (socket) => {
    console.log('Client connected to socket');
    
    // Send current status immediately
    socket.emit('status', { status: connectionStatus, qr: qrCode });

    socket.on('send_reply', async (data: { to: string, text: string, replyTo?: string }) => {
      if (!sock) return;
      
      try {
        await sock.sendMessage(data.to, { text: data.text }, { quoted: data.replyTo ? { key: { id: data.replyTo } } : undefined });
        console.log(`Sent reply to ${data.to}: ${data.text}`);
      } catch (err) {
        console.error('Error sending message:', err);
      }
    });
  });

  connectToWhatsApp();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
