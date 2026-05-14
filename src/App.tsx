/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { 
  MessageSquare, 
  Settings, 
  Activity, 
  Bot, 
  User, 
  ShieldCheck, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Terminal,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface LogMessage {
  id: string;
  from: string;
  pushName: string;
  text: string;
  reply?: string;
  timestamp: number;
  status: 'received' | 'processing' | 'replied' | 'error';
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'close' | 'qr'>('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful and polite personal WhatsApp assistant. Respond naturally and helpfully to messages. Use the user's language (Hindi, English, etc).");
  
  // Memory to store history for each chat
  const chatHistories = useRef<Map<string, any[]>>(new Map());
  const aiRef = useRef<GoogleGenAI | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aiRef.current && process.env.GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('status', (data) => {
      setStatus(data.status);
      setQrCode(data.qr);
    });

    newSocket.on('message_received', async (msg) => {
      console.log('Message received:', msg);
      
      // Check for Admin Commands
      if (msg.text.toLowerCase() === '.off') {
        setIsAiEnabled(false);
        newSocket.emit('send_reply', { to: msg.from, text: "AI Agent turning OFF. (Admin Command)", replyTo: msg.id });
        return;
      }
      if (msg.text.toLowerCase() === '.on') {
        setIsAiEnabled(true);
        newSocket.emit('send_reply', { to: msg.from, text: "AI Agent turning ON. (Admin Command)", replyTo: msg.id });
        return;
      }

      const newLog: LogMessage = {
        ...msg,
        status: isAiEnabled ? 'processing' : 'received'
      };
      
      setLogs(prev => [newLog, ...prev].slice(0, 50));

      if (isAiEnabled && aiRef.current) {
        try {
          // Get or create history for this user
          const history = chatHistories.current.get(msg.from) || [];
          
          const model = aiRef.current.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            systemInstruction: systemPrompt 
          });

          // Create a chat session with history
          const chat = model.startChat({
            history: history,
          });

          const result = await chat.sendMessage(msg.text);
          const replyText = result.response.text();

          // Update local history (keep last 10 messages for memory)
          const updatedHistory = [
            ...history,
            { role: "user", parts: [{ text: msg.text }] },
            { role: "model", parts: [{ text: replyText }] }
          ].slice(-10);
          
          chatHistories.current.set(msg.from, updatedHistory);
          
          // Send reply back to server
          newSocket.emit('send_reply', {
            to: msg.from,
            text: replyText,
            replyTo: msg.id
          });

          setLogs(prev => prev.map(l => 
            l.id === msg.id ? { ...l, reply: replyText, status: 'replied' } : l
          ));
        } catch (error) {
          console.error('Gemini error:', error);
          setLogs(prev => prev.map(l => 
            l.id === msg.id ? { ...l, status: 'error' } : l
          ));
        }
      }
    });

    return () => {
      newSocket.close();
    };
  }, [isAiEnabled, systemPrompt]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusIcon = () => {
    switch (status) {
      case 'open': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'qr': return <RefreshCcw className="w-5 h-5 text-amber-500 animate-spin" />;
      case 'connecting': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <XCircle className="w-5 h-5 text-rose-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'open': return 'Active';
      case 'qr': return 'Scan QR Code';
      case 'connecting': return 'Connecting...';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="h-screen w-full bg-[#0a0a0c] text-slate-200 font-sans flex flex-col overflow-hidden select-none">
      {/* Header / Navigation */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0f0f13] shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white uppercase">
            GEMINI<span className="text-indigo-400">AGENT</span> <span className="text-[10px] text-slate-500 font-medium ml-1">v1.2</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 ${status === 'open' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'} px-3 py-1.5 rounded-full border transition-colors`}>
            <div className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'} ${status === 'connecting' || status === 'qr' ? 'animate-pulse' : ''}`}></div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${status === 'open' ? 'text-emerald-400' : 'text-rose-400'}`}>
              WhatsApp {getStatusText()}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <button className="text-xs font-medium text-slate-400 hover:text-white transition-colors">Settings</button>
          <button className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-md hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">System Logs</button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Active Sessions / Status */}
        <aside className="w-72 border-r border-white/10 flex flex-col bg-[#0d0d12] z-10">
          <div className="p-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Connection Hub</h2>
            
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Device Link</span>
                {getStatusIcon()}
              </div>

              {status === 'qr' && qrCode ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-3 rounded-xl flex items-center justify-center shadow-2xl shadow-indigo-500/10"
                >
                  <QRCodeSVG value={qrCode} size={140} />
                </motion.div>
              ) : (
                <div className="py-4 text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 ${status === 'open' ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                    <ShieldCheck className={`w-6 h-6 ${status === 'open' ? 'text-emerald-500' : 'text-slate-600'}`} />
                  </div>
                  <p className="text-xs font-medium text-slate-400">
                    {status === 'open' ? 'Secure Session Active' : 'Waiting for link...'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Flow Highlights</h2>
              <div className="space-y-2">
                {logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="p-3 hover:bg-white/5 border border-transparent rounded-xl flex items-center gap-3 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                      {log.pushName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-300 truncate group-hover:text-white">{log.pushName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{log.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-white/5">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Gemini Credits</p>
                <p className="text-[10px] font-mono text-indigo-400">6.4k/10k</p>
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 w-[64%] h-full rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content: Chat / Log View */}
        <section className="flex-1 flex flex-col bg-[radial-gradient(circle_at_top_right,_#1a1b26_0%,_#0a0a0c_100%)]">
          <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Active Pulse</h3>
                <p className="text-sm text-slate-400">Monitoring incoming WhatsApp streams...</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></div>
                  Latency: 1.2s
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p className="text-sm font-medium">Listening for messages...</p>
                  </div>
                ) : (
                  [...logs].reverse().map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-4"
                    >
                      {/* User Message */}
                      <div className="self-start max-w-[85%] flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{log.pushName}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{new Date(log.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                        <div className="bg-[#1c1c24] px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 text-sm text-slate-300 leading-relaxed shadow-lg">
                          {log.text}
                        </div>
                      </div>

                      {/* AI Response Block */}
                      {log.status === 'processing' && (
                        <div className="self-center flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-500 font-bold uppercase animate-pulse">
                          <Brain className="w-3 h-3 text-indigo-400" />
                          Gemini is thinking...
                        </div>
                      )}

                      {log.reply && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="self-end max-w-[85%] flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-end gap-2 mr-2">
                            <span className="text-[9px] text-indigo-500/50 font-mono">1.2s logic</span>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">GEMINI AGENT</span>
                          </div>
                          <div className="bg-indigo-600/10 px-4 py-3 rounded-2xl rounded-tr-none border border-indigo-500/30 text-sm text-slate-200 leading-relaxed shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                            {log.reply}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))
                )}
                <div ref={logsEndRef} />
              </AnimatePresence>
            </div>
          </div>

          {/* Input Indicator Area */}
          <div className="p-6 bg-[#0f0f13]/80 backdrop-blur-md border-t border-white/10">
            <div className="flex gap-4 items-center">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-500 italic text-sm flex items-center gap-3">
                <Activity className="w-4 h-4 opacity-30" />
                <span>Monitoring conversation... Agent is waiting for new triggers.</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 group">
                <div className="w-3 h-3 rounded-sm border-2 border-white rotate-45 group-hover:rotate-135 transition-transform duration-500"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Engine Configuration */}
        <aside className="w-72 border-l border-white/10 bg-[#0d0d12] p-8 flex flex-col overflow-y-auto">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">Agent Engine</h2>
          
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Engine Model</label>
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between group hover:border-indigo-500/30 transition-all cursor-pointer">
                <span className="text-xs text-indigo-300 font-mono">gemini-3-flash</span>
                <Bot className="w-3 h-3 text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI Autonomous Mode</label>
                <button 
                  onClick={() => setIsAiEnabled(!isAiEnabled)}
                  className={`w-9 h-5 rounded-full p-1 transition-all duration-300 relative ${isAiEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${isAiEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Core Personality</label>
              <textarea 
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-slate-300 leading-relaxed focus:border-indigo-500/50 outline-none h-48 transition-all resize-none font-sans"
                placeholder="Describe how the agent should think and respond..."
              />
              <p className="text-[9px] text-slate-600 italic">Adjusts the linguistic flavor and helpfulness of responses.</p>
            </div>

            <div className="pt-8 border-t border-white/5 mt-auto">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <p className="text-xs font-bold text-white uppercase tracking-tighter">Live Status</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                  Session mirroring active on AI Studio Cloud. All keys secured via environment secrets.
                </p>
                <button 
                  className="w-full py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase rounded-xl hover:bg-rose-500/20 transition-all"
                  onClick={() => window.location.reload()}
                >
                  Hard Reset Session
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

