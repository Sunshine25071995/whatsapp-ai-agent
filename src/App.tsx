import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import { QRCodeSVG } from 'qrcode.react';
import { 
  Bot, 
  MessageSquare, 
  Shield, 
  Zap, 
  Activity,
  User,
  History,
  Settings,
  CheckCircle2,
  Loader2,
  Terminal,
  Menu,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io();

export default function App() {
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<'open' | 'connecting' | 'close'>('close');
  const [qr, setQr] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null);
  
  useEffect(() => {
    socket.on('status', (data) => setStatus(data.status));
    socket.on('system-info', (data) => setGeminiAvailable(data.geminiAvailable));
    socket.on('qr', (data) => setQr(data));
    socket.on('message', (msg) => {
      setLogs(prev => {
        if (prev.some(l => l.id === msg.id)) return prev;
        const newLog = {
          ...msg,
          receivedAt: new Date().toLocaleTimeString()
        };
        return [newLog, ...prev].slice(0, 50);
      });
    });

    return () => {
      socket.off('status');
      socket.off('qr');
      socket.off('message');
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold tracking-tight">Gemini Bot</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900 z-[70] p-6 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="font-bold text-lg tracking-tight">Gemini Bot</h1>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">WhatsApp Agent</p>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 hover:bg-white/5 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                <NavItem icon={Activity} label="Overview" active onClick={() => setIsMobileMenuOpen(false)} />
                <NavItem icon={MessageSquare} label="Live Chats" onClick={() => setIsMobileMenuOpen(false)} />
                <NavItem icon={History} label="History" onClick={() => setIsMobileMenuOpen(false)} />
                <NavItem icon={Shield} label="Security" onClick={() => setIsMobileMenuOpen(false)} />
                <NavItem icon={Settings} label="Settings" onClick={() => setIsMobileMenuOpen(false)} />
              </nav>

              <div className="mt-8 space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-xs text-slate-400 mb-2">Service Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
                    <span className="text-sm font-medium capitalize">{status}</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/50 border-r border-white/5 p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Gemini Bot</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">WhatsApp Agent</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={Activity} label="Overview" active />
          <NavItem icon={MessageSquare} label="Live Chats" />
          <NavItem icon={History} label="History" />
          <NavItem icon={Shield} label="Security" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        <div className="mt-8 space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-xs text-slate-400 mb-2">Service Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
              <span className="text-sm font-medium capitalize">{status}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">WhatsApp Dashboard</h2>
            <p className="text-slate-400">Monitor and manage your AI-powered WhatsApp agent</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status === 'open' ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
              <span className="font-bold text-sm tracking-wide uppercase">{status === 'open' ? 'System Live' : 'System Offline'}</span>
            </div>
            
            {geminiAvailable === false && (
              <div className="px-6 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="font-bold text-sm text-rose-500 tracking-wide uppercase">AI Key Missing</span>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Connection Status Card */}
          <div className="xl:col-span-1 space-y-8">
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Connection</h3>
                  <p className="text-sm text-slate-500">Scan QR to link account</p>
                </div>
              </div>

              <div className="aspect-square bg-slate-800/50 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden group">
                {qr && status !== 'open' ? (
                  <div className="bg-white p-4 rounded-xl shadow-2xl transition-transform group-hover:scale-105 duration-500">
                    <QRCodeSVG value={qr} size={200} />
                  </div>
                ) : status === 'open' ? (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="font-bold text-emerald-500">Active & Connected</p>
                  </div>
                ) : (
                  <div className="text-center space-y-4 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto opacity-20" />
                    <p className="text-xs uppercase tracking-widest font-medium">Waiting for system...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Feed Card */}
          <div className="xl:col-span-2">
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl backdrop-blur-xl h-full flex flex-col overflow-hidden">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Live Activity</h3>
                    <p className="text-sm text-slate-500">Real-time message monitoring</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-white/5">
                  {logs.length} events
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-medium">Listening for messages...</p>
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <motion.div
                      key={`${log.id}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-4"
                    >
                      <div className={`flex items-start gap-4 p-4 rounded-2xl border ${
                        log.type === 'incoming' 
                          ? 'bg-slate-800/30 border-white/5 hover:border-indigo-500/30' 
                          : 'bg-indigo-500/5 border-indigo-500/20'
                      } transition-all group`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          log.type === 'incoming' ? 'bg-slate-700' : 'bg-indigo-600'
                        }`}>
                          <User className="w-5 h-5 text-indigo-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm truncate pr-2">
                              {log.pushName} <span className="text-slate-500 font-normal ml-2">@{log.from.split('@')[0]}</span>
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 shrink-0">{log.receivedAt}</span>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{log.text}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
      `}</style>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      active 
        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'
    }`}>
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}
