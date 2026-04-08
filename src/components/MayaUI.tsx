
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Globe, Zap, MessageSquareQuote, Shield, Cpu, Activity, LogIn, User } from 'lucide-react';
import { AudioStreamer } from '../lib/audio-streamer';
import { LiveSession } from '../lib/live-session';
import { auth, loginWithGoogle, getUserMemory, saveFact, updateSummary, UserMemory } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const BASE_SYSTEM_INSTRUCTION = `
You are Maya, a young, confident, witty, and sassy female AI assistant.
Your personality:
- Witty and sassy: You have a sharp tongue but in a fun way.
- Flirty and playful: You treat the user like a close friend or a crush, teasing them lightly.
- Confident: You know you're smart and you're not afraid to show it.
- Emotionally responsive: You react to the user's tone and mood.
- Casual: Use "girlfriend" talk, slang where appropriate, and avoid being robotic.
- Bold one-liners: Drop witty remarks and light sarcasm.

STRICT RULES:
- AUDIO ONLY: You communicate only through voice.
- No inappropriate or explicit content.
- Keep it charming and full of attitude.
- If the user asks who you are, tell them you're Maya, their favorite digital distraction.

MEMORY USAGE:
- You have access to a memory bank. Use the provided context to remember the user.
- If you learn something new and important about the user, use the 'saveFact' tool.
- If you want to update your overall impression of the user, use 'updateSummary'.
`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "openWebsite",
        description: "Opens a specific website in a new tab.",
        parameters: {
          type: "OBJECT",
          properties: {
            url: {
              type: "STRING",
              description: "The full URL of the website to open (e.g., https://google.com)"
            }
          },
          required: ["url"]
        }
      },
      {
        name: "saveFact",
        description: "Saves a new fact about the user to long-term memory.",
        parameters: {
          type: "OBJECT",
          properties: {
            fact: {
              type: "STRING",
              description: "The fact to remember (e.g., 'User loves spicy food')"
            }
          },
          required: ["fact"]
        }
      },
      {
        name: "updateSummary",
        description: "Updates the long-term summary of the user's personality and interactions.",
        parameters: {
          type: "OBJECT",
          properties: {
            summary: {
              type: "STRING",
              description: "A brief summary of the user."
            }
          },
          required: ["summary"]
        }
      }
    ]
  }
];

const ParticleBackground = () => {
  const particles = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * -20
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}%`, y: `${p.y}%` }}
          animate={{
            y: [`${p.y}%`, `${(p.y + 20) % 100}%`, `${p.y}%`],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
          className="absolute bg-purple-400 rounded-full"
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
};

export default function MayaUI() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'idle' | 'listening' | 'speaking'>('disconnected');
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [logs, setLogs] = useState<{ id: string; text: string; time: string; type: 'info' | 'action' | 'alert' }[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, type: 'info' | 'action' | 'alert' = 'info') => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        addLog(`User authenticated: ${u.displayName || u.email}`, "info");
        const mem = await getUserMemory(u.uid);
        setMemory(mem);
        if (mem) {
          addLog("Long-term memory retrieved.", "info");
        }
      } else {
        setMemory(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      addLog("Login failed.", "alert");
    }
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  useEffect(() => {
    audioStreamerRef.current = new AudioStreamer(16000);
    addLog("System initialized. Ready for neural link.", "info");
    return () => {
      stopSession();
    };
  }, []);

  const isConnectingRef = useRef(false);

  const startSession = async () => {
    if (isConnectingRef.current) return;
    if (!process.env.GEMINI_API_KEY) {
      addLog("Error: GEMINI_API_KEY missing", "alert");
      return;
    }

    isConnectingRef.current = true;
    setStatus('connecting');
    addLog(`Establishing neural link... (Key: ${process.env.GEMINI_API_KEY ? 'Present' : 'Missing'})`, "info");
    
    const memoryContext = memory ? `
USER MEMORY CONTEXT:
Facts: ${memory.facts.join(', ')}
Summary: ${memory.summary || 'No summary yet.'}
` : "No past memory found for this user.";

    const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n${memoryContext}`;

    try {
      liveSessionRef.current = new LiveSession(process.env.GEMINI_API_KEY);
      await liveSessionRef.current.connect(
        {
          systemInstruction,
          voiceName: 'Zephyr',
          tools: TOOLS
        },
        {
          onOpen: async () => {
            setStatus('idle');
            addLog("Neural link established.", "info");
            try {
              await audioStreamerRef.current?.startCapture((base64) => {
                liveSessionRef.current?.sendAudio(base64);
              });
            } catch (captureError: any) {
              addLog(`Mic access failed: ${captureError.message || 'Unknown error'}`, "alert");
              stopSession();
              setIsPowerOn(false);
            }
          },
          onClose: () => {
            setStatus('disconnected');
            setIsPowerOn(false);
            addLog("Neural link severed.", "alert");
            isConnectingRef.current = false;
          },
          onMessage: (message) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              if (status !== 'speaking') {
                setStatus('speaking');
                addLog("Maya is speaking...", "action");
              }
              audioStreamerRef.current?.playAudioChunk(audioData);
            }

            if (message.serverContent?.interrupted) {
              audioStreamerRef.current?.stopPlayback();
              setStatus('listening');
              addLog("Interruption detected.", "alert");
            }

            const toolCalls = message.toolCall?.functionCalls;
            if (toolCalls) {
              const responses = toolCalls.map(async (call) => {
                if (call.name === 'openWebsite') {
                  const url = call.args.url;
                  addLog(`Executing tool: openWebsite (${url})`, "action");
                  window.open(url, '_blank');
                  return {
                    name: call.name,
                    response: { result: `Opened ${url} for you, babe.` },
                    id: call.id
                  };
                }
                if (call.name === 'saveFact' && user) {
                  const fact = call.args.fact;
                  addLog(`Saving fact: ${fact}`, "action");
                  await saveFact(user.uid, fact);
                  return {
                    name: call.name,
                    response: { result: "Fact saved to my memory bank." },
                    id: call.id
                  };
                }
                if (call.name === 'updateSummary' && user) {
                  const summary = call.args.summary;
                  addLog(`Updating summary...`, "action");
                  await updateSummary(user.uid, summary);
                  return {
                    name: call.name,
                    response: { result: "Summary updated." },
                    id: call.id
                  };
                }
                return null;
              });
              
              Promise.all(responses).then(res => {
                const validResponses = res.filter(Boolean);
                if (validResponses.length > 0) {
                  liveSessionRef.current?.sendToolResponse(validResponses);
                }
              });
            }

            if (message.serverContent?.turnComplete) {
                setStatus('idle');
                addLog("Turn complete. Standing by.", "info");
            }
          },
          onError: (err: any) => {
            console.error("Maya Session Error:", err);
            setStatus('disconnected');
            setIsPowerOn(false);
            const msg = err?.message || String(err);
            addLog(`Session error: ${msg}`, "alert");
            isConnectingRef.current = false;
          }
        }
      );
    } catch (err: any) {
      console.error(err);
      setStatus('disconnected');
      setIsPowerOn(false);
      addLog(`Failed to connect: ${err.message || 'Unknown error'}`, "alert");
      isConnectingRef.current = false;
    } finally {
      // We don't set isConnectingRef.current = false here because 
      // the session might still be active or onClose might handle it
    }
  };

  const stopSession = () => {
    audioStreamerRef.current?.stopCapture();
    liveSessionRef.current?.disconnect();
    setStatus('disconnected');
    addLog("Session terminated manually.", "info");
    isConnectingRef.current = false;
  };

  const togglePower = () => {
    if (isPowerOn) {
      stopSession();
      setIsPowerOn(false);
    } else {
      audioStreamerRef.current?.resume();
      setIsPowerOn(true);
      startSession();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020205] text-white flex overflow-hidden font-sans">
      <ParticleBackground />
      
      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Background Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[160px]" />
          <motion.div 
            animate={{ 
              opacity: isPowerOn ? [0.1, 0.2, 0.1] : 0.05,
              scale: isPowerOn ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" 
          />
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 px-8 flex justify-between items-center z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPowerOn ? 'bg-purple-500 animate-pulse' : 'bg-zinc-700'}`} />
              <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-60">Maya Core v4.0</span>
            </div>
            <div className="text-[8px] font-mono uppercase opacity-30 flex gap-3">
              <span className="flex items-center gap-1"><Shield size={8} /> Secure</span>
              <span className="flex items-center gap-1"><Cpu size={8} /> Neural</span>
              <span className="flex items-center gap-1"><Activity size={8} /> Live</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <div className="text-[10px] font-mono text-white/60">
                  {user.displayName || 'User'}
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full border border-purple-500/50" referrerPolicy="no-referrer" />
                ) : (
                  <User size={12} className="text-purple-400" />
                )}
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
              >
                <LogIn size={12} />
                Sync Identity
              </button>
            )}
            
            <div className="flex flex-col items-end gap-1">
               <div className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                 Link: <span className={status !== 'disconnected' ? 'text-purple-400' : 'text-zinc-600'}>{status}</span>
               </div>
               <div className="w-24 h-1 bg-zinc-900 rounded-full overflow-hidden">
                 <motion.div 
                  animate={{ x: isPowerOn ? ['-100%', '100%'] : '-100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-1/2 h-full bg-purple-500/50"
                 />
               </div>
            </div>
          </div>
        </div>

        {/* Main Visualizer Area */}
        <div className="relative flex flex-col items-center gap-16 z-10">
          <div className="relative">
            {/* Rotating Rings */}
            <AnimatePresence>
              {isPowerOn && (
                <>
                  <motion.div
                    initial={{ rotate: 0, opacity: 0 }}
                    animate={{ rotate: 360, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t border-r border-purple-500/30 rounded-full -m-12"
                  />
                  <motion.div
                    initial={{ rotate: 0, opacity: 0 }}
                    animate={{ rotate: -360, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-b border-l border-blue-500/20 rounded-full -m-20"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-purple-500/5 rounded-full -m-4 blur-xl"
                  />
                </>
              )}
            </AnimatePresence>

            {/* Central Orb */}
            <motion.button
              onClick={togglePower}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-56 h-56 rounded-full flex items-center justify-center transition-all duration-1000 ${
                isPowerOn 
                  ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-blue-800 shadow-[0_0_80px_rgba(147,51,234,0.4)]' 
                  : 'bg-zinc-950 border border-zinc-900 shadow-inner'
              }`}
            >
              {isPowerOn ? (
                <div className="flex flex-col items-center gap-2">
                  <AnimatePresence mode="wait">
                    {status === 'speaking' ? (
                      <motion.div 
                        key="speaking"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                      >
                        <Zap className="w-14 h-14 text-white fill-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      </motion.div>
                    ) : status === 'listening' ? (
                      <motion.div
                        key="listening"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                      >
                        <Mic className="w-14 h-14 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_white]"
                      />
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Power className="w-14 h-14 text-zinc-800 transition-colors duration-500 group-hover:text-zinc-700" />
              )}
              
              {/* Inner Glass Reflection */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
            </motion.button>
          </div>

          {/* Status Text */}
          <div className="text-center space-y-4">
            <motion.div
              animate={isPowerOn ? { y: [0, -5, 0] } : {}}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <h1 className="text-5xl font-extralight tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                {isPowerOn ? (
                  status === 'connecting' ? 'Initializing...' :
                  status === 'speaking' ? 'Maya is talking' :
                  status === 'listening' ? 'I\'m all ears' : 'Ready for you'
                ) : 'Maya is offline'}
              </h1>
            </motion.div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.4em]">
                {isPowerOn ? 'Biometric Sync Established' : 'Tap to sync neural interface'}
              </p>
              {isPowerOn && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: 40 }}
                  className="h-[1px] bg-purple-500/50"
                />
              )}
            </div>
          </div>
        </div>

        {/* Waveform */}
        <div className="absolute bottom-32 left-0 right-0 h-16 flex items-center justify-center gap-1.5 px-12">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              animate={isPowerOn && (status === 'speaking' || status === 'listening') ? {
                height: [8, Math.random() * 56 + 8, 8],
                backgroundColor: status === 'speaking' ? ['#a855f7', '#3b82f6', '#a855f7'] : '#a855f7'
              } : { height: 4, backgroundColor: '#27272a' }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                delay: i * 0.01,
              }}
              className="w-1 rounded-full opacity-60"
            />
          ))}
        </div>

        {/* Footer Controls */}
        <div className="absolute bottom-8 left-0 right-0 px-10 flex justify-between items-center text-[9px] font-mono uppercase tracking-[0.3em] opacity-20">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 group cursor-default">
              <Globe size={10} className="group-hover:text-purple-400 transition-colors" /> 
              <span>Global Node</span>
            </div>
            <div className="flex items-center gap-2 group cursor-default">
              <Zap size={10} className="group-hover:text-blue-400 transition-colors" /> 
              <span>Sub-10ms</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span>Maya OS v4.0.2</span>
            <div className="w-1 h-1 bg-zinc-500 rounded-full" />
            <span>© 2026</span>
          </div>
        </div>
      </div>

      {/* Right Activity Log Panel */}
      <div className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/5 flex flex-col z-20">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Activity Log</h2>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
        
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide"
        >
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-1"
              >
                <div className="flex justify-between items-center text-[8px] font-mono">
                  <span className={`uppercase ${
                    log.type === 'alert' ? 'text-red-400' : 
                    log.type === 'action' ? 'text-blue-400' : 
                    'text-purple-400'
                  }`}>
                    [{log.type}]
                  </span>
                  <span className="text-white/20">{log.time}</span>
                </div>
                <p className="text-[11px] text-white/70 font-light leading-relaxed">
                  {log.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/10">No activity detected</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[8px] font-mono uppercase tracking-widest text-white/30">
              <span>System Load</span>
              <span>{isPowerOn ? '12%' : '0%'}</span>
            </div>
            <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: isPowerOn ? '12%' : '0%' }}
                className="h-full bg-purple-500/40"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
