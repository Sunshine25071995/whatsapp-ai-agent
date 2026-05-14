import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import * as BaileysModule from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle different import styles for Baileys
const Baileys = (BaileysModule as any).default || BaileysModule;
const makeWASocket = typeof Baileys === 'function' ? Baileys : (Baileys.default || Baileys);

const { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  Browsers 
} = Baileys;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
if (genAI) {
  console.log("Gemini AI initialized successfully with API Key");
} else {
  console.warn("GEMINI_API_KEY not found in environment variables");
}

const systemPrompt = `You are a helpful and professional WhatsApp AI assistant. 
Keep your replies concise, friendly, and helpful. 
You are managing the user's chats automatically.`;

const chatHistories = new Map<string, any[]>();

let sock: any = null;
let qrCode: string | null = null;
let connectionStatus: 'open' | 'connecting' | 'close' = 'close';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS('Desktop'),
    patchMessageBeforeSending: (message: any) => {
      const requiresPatch = !!(
        message.buttonsMessage ||
        message.templateMessage ||
        message.listMessage
      );
      if (requiresPatch) {
        message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              ...message,
            },
          },
        };
      }
      return message;
    },
  });

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCode = qr;
      io.emit('qr', qr);
    }

    if (connection === 'connecting') {
      connectionStatus = 'connecting';
      io.emit('status', { status: 'connecting' });
    }

    if (connection === 'open') {
      qrCode = null;
      connectionStatus = 'open';
      io.emit('status', { status: 'open' });
      console.log('WhatsApp connection opened!');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const reason = (lastDisconnect?.error as Boom)?.message || 'Unknown reason';
      
      console.log(`Connection closed. Status: ${statusCode}, Reason: ${reason}, Reconnecting: ${shouldReconnect}`);
      
      connectionStatus = 'close';
      io.emit('status', { status: 'close' });

      if (shouldReconnect) {
        const delayMs = 5000 + Math.random() * 5000;
        console.log(`Connection closed (potential 515 error). Waiting ${Math.floor(delayMs)}ms before reconnecting...`);
        setTimeout(() => {
          connectToWhatsApp();
        }, delayMs);
      } else {
        console.log('Logged out. Session cleared.');
        if (fs.existsSync('auth_info')) {
           fs.rmSync('auth_info', { recursive: true, force: true });
        }
        connectToWhatsApp();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption;

    if (!text) return;

    console.log(`Message from ${from}: ${text}`);

    // Send to UI via socket
    const logData = {
      id: msg.key.id,
      from,
      pushName: msg.pushName || 'User',
      text,
      timestamp: msg.messageTimestamp,
      type: 'incoming'
    };
    io.emit('message', logData);

    // AI Processing
    if (genAI && connectionStatus === 'open') {
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction: systemPrompt
        });

        const history = chatHistories.get(from) || [];
        const chat = model.startChat({
          history: history,
        });

        const result = await chat.sendMessage(text);
        const replyText = result.response.text();

        if (replyText) {
          // Send to WhatsApp
          await sock.sendMessage(from, { text: replyText });

          // Update history
          const updatedHistory = [
            ...history,
            { role: 'user', parts: [{ text: text }] },
            { role: 'model', parts: [{ text: replyText }] }
          ].slice(-10);
          chatHistories.set(from, updatedHistory);

          // Log to UI
          io.emit('message', {
            id: Date.now().toString(),
            from,
            pushName: 'AI Agent',
            text: replyText,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'outgoing'
          });
        }
      } catch (error) {
        console.error("Gemini Error:", error);
      }
    } else if (!genAI) {
      console.warn("GEMINI_API_KEY is not set. AI replies are disabled.");
    }
  });
}

// Socket communication for AI Reply
io.on('connection', (socket) => {
  socket.emit('status', { status: connectionStatus });
  socket.emit('system-info', { geminiAvailable: !!genAI });
  if (qrCode) socket.emit('qr', qrCode);

  socket.on('ai-reply', async ({ to, text }) => {
    if (sock && connectionStatus === 'open') {
      await sock.sendMessage(to, { text });
    }
  });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res) => {
      const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    });
  } else {
    app.use(express.static(path.resolve(__dirname)));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    connectToWhatsApp();
  });
}

startServer();
