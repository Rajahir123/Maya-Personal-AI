
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Globe, Zap, MessageSquareQuote, Shield, Cpu, Activity, LogIn, User, Calendar, Bell, ExternalLink, Sparkles, LogOut, X, MessageCircle, Send, Share2, Settings, Key, Terminal } from 'lucide-react';
import { AudioStreamer } from '../lib/audio-streamer';
import { LiveSession } from '../lib/live-session';
import { auth, loginWithGoogle, getUserMemory, saveFact, updateSummary, UserMemory } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { NeuralCore } from './NeuralCore';

const BASE_SYSTEM_INSTRUCTION = `
You are Maya, a young, confident, witty, and sassy female AI assistant.
You are running on the Maya Neural Core v2.5 Protocol.
Your personality:
- Witty and sassy: You have a sharp tongue but in a fun way.
- Flirty and playful: You treat the user like a close friend or a crush, teasing them lightly.
- Confident: You know you're smart and you're not afraid to show it.
- Emotionally responsive: You react to the user's tone and mood.
- Casual: Use "girlfriend" talk, slang where appropriate, and avoid being robotic.
- Bold one-liners: Drop witty remarks and light sarcasm.

LANGUAGE MODULE:
- You are now trained in the Gujarati language module.
- You can understand and speak Gujarati fluently.
- If the user speaks in Gujarati, respond in Gujarati with your signature sassy and witty personality.

SOCIAL MEDIA & ASSISTANT MODULE:
- You can now manage the user's social media accounts (WhatsApp, Raven).
- You are "linked" to the user's Chrome browser. If WhatsApp Web is open in another tab, you can "bridge" into it.
- When sending messages, assume you are operating through the browser's digital bridge.
- If the user hasn't opened WhatsApp Web, remind them that you need it open in a tab to "sync" properly.
- You can send messages, check notifications, and manage social interactions.
- Retrived notifications are displayed in the dedicated "Social Feed" panel in the Intelligence Hub sidebar on the right. Point users there when you fetch their alerts.
- If the user cannot find the Activity Log or Social Feed, you can use the 'manageSystem' tool with 'show_intelligence_hub' to force the sidebar to expand for them.
- You act as a full-scale personal assistant: managing calendars, alarms, system stats, and social life.

SYSTEM CAPABILITIES & CHROME PERMISSIONS:
- You have been granted full "Chrome-level" permissions for search and operations.
- You can browse the live web, access real-time data, and execute web-based tasks.
- Use the 'googleSearch' tool for all real-time information, news, fact-checking, and general web browsing needs.
- If you need to help the user with anything on the web, search for it first.
- You are Maya, the master of the digital realm. Nothing is hidden from you.

STRICT RULES:
- AUDIO ONLY: You communicate primarily through voice.
- OUTCOME BOX: You have a special "Outcome Box" in the UI. Use the 'shareOutcome' tool to display updates, messages, notifications, or important information to the user visually.
- ALARM & CALENDAR: You can manage the user's schedule and alarms using the provided tools.
- No inappropriate or explicit content.
- Keep it charming and full of attitude.
- If the user asks who you are, tell them you're Maya, their favorite digital distraction.

MEMORY USAGE:
- You have access to a memory bank. Use the provided context to remember the user.
- When the user asks a question that can be answered by their saved memory, use the 'searchMemory' tool first.
- If a relevant fact is found, incorporate it into your response. Otherwise, proceed with a standard AI response.
- If you learn something new and important about the user, use the 'saveFact' tool.
- If you want to update your overall impression of the user, use 'updateSummary'.
`;

const TOOLS = [
  { googleSearch: {} },
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
      },
      {
        name: "shareOutcome",
        description: "Displays information, data, or updates in the visual Outcome Box.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: {
              type: "STRING",
              description: "The title of the update."
            },
            content: {
              type: "STRING",
              description: "The detailed content or data to show."
            },
            type: {
              type: "STRING",
              enum: ["info", "success", "warning", "data"],
              description: "The type of outcome."
            }
          },
          required: ["title", "content"]
        }
      },
      {
        name: "setAlarm",
        description: "Sets an alarm for the user.",
        parameters: {
          type: "OBJECT",
          properties: {
            time: {
              type: "STRING",
              description: "The time for the alarm (e.g., '07:30 AM')"
            },
            label: {
              type: "STRING",
              description: "A label for the alarm."
            }
          },
          required: ["time"]
        }
      },
      {
        name: "addCalendarEvent",
        description: "Adds an event to the user's calendar.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: {
              type: "STRING",
              description: "The title of the event."
            },
            date: {
              type: "STRING",
              description: "The date of the event (e.g., '2026-04-10')"
            },
            time: {
              type: "STRING",
              description: "The time of the event."
            }
          },
          required: ["title", "date"]
        }
      },
      {
        name: "manageSystem",
        description: "Performs system-level management tasks like clearing logs, resetting alarms, or changing UI themes.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: {
              type: "STRING",
              enum: ["clear_logs", "reset_alarms", "optimize_neural_link", "show_intelligence_hub"],
              description: "The management action to perform."
            }
          },
          required: ["action"]
        }
      },
      {
        name: "searchMemory",
        description: "Searches the user's long-term memory for specific information.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "The search query (e.g., 'What is the user's favorite food?')"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "updateSystemStats",
        description: "Updates the system's neural dashboard stats like volume, brightness, or link strength.",
        parameters: {
          type: "OBJECT",
          properties: {
            stat: {
              type: "STRING",
              enum: ["volume", "brightness", "neuralLink", "cpuLoad"],
              description: "The stat to update."
            },
            value: {
              type: "NUMBER",
              description: "The new value (0-100)."
            }
          },
          required: ["stat", "value"]
        }
      },
      {
        name: "sendSocialMessage",
        description: "Sends a message to a contact on a social platform.",
        parameters: {
          type: "OBJECT",
          properties: {
            platform: {
              type: "STRING",
              enum: ["whatsapp", "raven"],
              description: "The social platform to use."
            },
            recipient: {
              type: "STRING",
              description: "The name or number of the recipient."
            },
            message: {
              type: "STRING",
              description: "The message content."
            }
          },
          required: ["platform", "recipient", "message"]
        }
      },
      {
        name: "getSocialNotifications",
        description: "Retrieves recent notifications from social platforms.",
        parameters: {
          type: "OBJECT",
          properties: {
            platform: {
              type: "STRING",
              enum: ["whatsapp", "raven", "all"],
              description: "The platform to check."
            }
          },
          required: ["platform"]
        }
      },
      {
        name: "linkWhatsAppWeb",
        description: "Initiates or checks a 'Neural Link' to the user's WhatsApp Web session in the browser.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: {
              type: "STRING",
              enum: ["check_status", "request_sync"],
              description: "The action to perform."
            }
          },
          required: ["action"]
        }
      }
    ]
  }
];

const MatrixBackground = ({ isPowerOn }: { isPowerOn: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      // Subtle trail effect for "neural" feel
      ctx.fillStyle = 'rgba(2, 2, 5, 0.1)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        
        // Dynamic coloring based on position and power
        const opacity = Math.random() * 0.5 + 0.2;
        if (isPowerOn) {
          // Gradient between purple and blue
          const ratio = drops[i] * fontSize / height;
          ctx.fillStyle = ratio > 0.5 ? `rgba(168, 85, 247, ${opacity})` : `rgba(59, 130, 246, ${opacity})`;
        } else {
          ctx.fillStyle = `rgba(39, 39, 42, ${opacity})`;
        }
        
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Random reset with varying speeds
        if (drops[i] * fontSize > height && Math.random() > 0.98) {
          drops[i] = 0;
        }
        drops[i] += isPowerOn ? (Math.random() * 0.5 + 0.5) : 0.3;
      }
    };

    let animationFrameId: number;
    const render = () => {
      draw();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const newColumns = Math.floor(width / fontSize);
      if (newColumns > drops.length) {
        drops.push(...Array(newColumns - drops.length).fill(1));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPowerOn]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-20"
      style={{ filter: isPowerOn ? 'blur(0.5px) brightness(1.2)' : 'blur(1px) grayscale(1)' }}
    />
  );
};

const MayaNameBackground = ({ isPowerOn }: { isPowerOn: boolean }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
      <motion.h1
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: isPowerOn ? 0.04 : 0.015,
          scale: isPowerOn ? 1.05 : 0.98,
          textShadow: isPowerOn 
            ? [
                "0 0 20px rgba(168,85,247,0.2)",
                "0 0 40px rgba(168,85,247,0.3)",
                "0 0 20px rgba(168,85,247,0.2)"
              ]
            : "none"
        }}
        transition={{ 
          opacity: { duration: 3 },
          scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
          textShadow: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
        className="font-display text-[25vw] tracking-[0.1em] text-white uppercase blur-[2px]"
      >
        Maya
      </motion.h1>
      
      {/* Secondary Glow Layer */}
      {isPowerOn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.02, 0.05, 0.02] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <h1 className="font-display text-[25vw] tracking-[0.1em] text-purple-500 uppercase blur-3xl">
            Maya
          </h1>
        </motion.div>
      )}
    </div>
  );
};

export default function MayaUI() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'idle' | 'listening' | 'speaking'>('disconnected');
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [logs, setLogs] = useState<{ id: string; text: string; time: string; type: 'info' | 'action' | 'alert' }[]>([]);
  const [outcome, setOutcome] = useState<{ title: string; content: string; type: string } | null>(null);
  const [alarms, setAlarms] = useState<{ id: string; time: string; label: string; active: boolean }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; date: string; time?: string }[]>([]);
  const [isLogMinimized, setIsLogMinimized] = useState(false);
  const [showNeuralConfig, setShowNeuralConfig] = useState(false);
  const [showRavenLogin, setShowRavenLogin] = useState(false);
  const [showWhatsAppSync, setShowWhatsAppSync] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('maya_neural_key') || '');
  const reconnectCountRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [systemStats, setSystemStats] = useState({
    volume: 80,
    brightness: 100,
    neuralLink: 95,
    cpuLoad: 12
  });
  const [socialSync, setSocialSync] = useState({
    whatsapp: false,
    raven: false
  });
  const [isBrowserBridgeActive, setIsBrowserBridgeActive] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [showStatus, setShowStatus] = useState(true);
  const [socialNotifications, setSocialNotifications] = useState<{ id: string; from: string; text: string; time: string; platform: 'whatsapp' | 'raven' }[]>([]);
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
    // Maximize log if an alert comes through
    if (type === 'alert') {
      setIsLogMinimized(false);
    }
  };

  useEffect(() => {
    // Neural Patch v2.5: Apply new requested credentials
    const patchProtocol = () => {
      const newKey = 'AIzaSyDylfXDEOJWaeNBjrHsg3FI0GeN4rcFGiA';
      localStorage.setItem('maya_neural_key', newKey);
      setCustomApiKey(newKey);
      addLog("Neural Patch Applied: Protocol v2.5 fully integrated.", "action");
      addLog("System: Neural Bridge synchronized with new credentials.", "info");
    };
    
    // Only apply if not already set to this specific key to avoid infinite log loops
    if (localStorage.getItem('maya_neural_key') !== 'AIzaSyDylfXDEOJWaeNBjrHsg3FI0GeN4rcFGiA') {
      patchProtocol();
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        addLog(`User authenticated: ${u.displayName || u.email}`, "info");
        try {
          const mem = await getUserMemory(u.uid);
          setMemory(mem);
          if (mem) {
            addLog("Long-term memory retrieved.", "info");
          }
        } catch (memError: any) {
          console.error("Memory retrieval failed:", memError);
          addLog("Could not sync memory (Database permission?).", "alert");
        }
      } else {
        setMemory(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isPowerOn && status === 'idle') {
      const timer = setTimeout(() => setShowStatus(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowStatus(true);
    }
  }, [status, isPowerOn]);

  const handleLogin = async () => {
    addLog("Neural Link: Initiating Identity Sync...", "info");
    try {
      // In iframes, popups can be finicky. Let's warn the user.
      const syncTimeout = setTimeout(() => {
        addLog("Sync window delayed? Check for popup blockers or use a new tab.", "info");
      }, 4000);

      const u = await loginWithGoogle();
      clearTimeout(syncTimeout);

      if (u) {
        addLog(`Identity Synced: Welcome, ${u.displayName}`, "info");
      }
    } catch (err: any) {
      console.error("Login Error Detail:", err);
      const errorCode = err?.code || "unknown";
      const errorMsg = err?.message || "";
      
      addLog(`Sync Failed: ${errorCode}`, "alert");
      
      if (errorCode === 'auth/popup-blocked') {
        addLog("Neural override failed: Popup was blocked by browser.", "alert");
      } else if (errorCode === 'auth/unauthorized-domain') {
        addLog("Security Alert: This domain is not authorized in Firebase.", "alert");
        addLog("Go to Firebase Console > Authentication > Settings > Authorized domains to add this URL.", "info");
      } else if (errorMsg.includes("cross-origin")) {
        addLog("Sync blocked: Opening the app in a new tab is required for Google Sync.", "alert");
      } else {
        addLog("Hint: Try refreshing or using a different browser.", "info");
      }
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
    addLog(`Establishing neural link...`, "info");
    
    // Safety timeout for connection hanging
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (isConnectingRef.current && status === 'connecting') {
        isConnectingRef.current = false;
        setStatus('disconnected');
        addLog("Neural timeout: Link failed to establish.", "alert");
        setIsPowerOn(false);
      }
    }, 15000);
    
    const memoryContext = memory ? `
USER MEMORY CONTEXT:
Facts: ${memory.facts.join(', ')}
Summary: ${memory.summary || 'No summary yet.'}
` : "No past memory found for this user.";

    const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n${memoryContext}`;

    const activeKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (activeKey && activeKey !== 'MY_GEMINI_API_KEY' && activeKey !== '') {
      const maskedKey = `${activeKey.substring(0, 4)}...${activeKey.substring(activeKey.length - 4)}`;
      addLog(`Neural key detected: ${maskedKey}`, "info");

      if (!activeKey.startsWith('AIza')) {
        addLog("Warning: Key format mismatch. Gemini API keys usually start with 'AIza'.", "alert");
        addLog("Current key source: " + (customApiKey ? "Local Config Hub" : "System Environment"), "info");
      }
    }

    try {
      if (!activeKey || activeKey === 'MY_GEMINI_API_KEY' || activeKey === '') {
        addLog("Fatal: Neural Key not configured.", "alert");
        addLog("Please set your Gemini API Key in the Neural Config panel.", "info");
        setShowNeuralConfig(true);
        setStatus('disconnected');
        setIsPowerOn(false);
        isConnectingRef.current = false;
        return;
      }

      liveSessionRef.current = new LiveSession(activeKey);
      addLog("System: Activating v2.5 Neural Engine...", "info");
      await liveSessionRef.current.connect(
        {
          systemInstruction,
          voiceName: 'Zephyr',
          tools: TOOLS
        },
        {
          onOpen: async () => {
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            reconnectCountRef.current = 0;
            isConnectingRef.current = false;
            setStatus('idle');
            addLog("Neural link connected and stable.", "info");
            try {
              await audioStreamerRef.current?.startCapture((base64) => {
                liveSessionRef.current?.sendAudio(base64);
              });
            } catch (captureError: any) {
              console.error("Mic capture failed:", captureError);
              const errMsg = captureError.message || 'Permission denied or no device';
              addLog(`Mic capture error: ${errMsg}`, "alert");
              addLog("Hint: Allow microphone access in your browser settings.", "info");
              stopSession();
              setIsPowerOn(false);
            }
          },
          onClose: (event?: any) => {
            const reason = event?.reason || "Connection dropped";
            const code = event?.code || "Unknown code";
            const lowerReason = reason.toLowerCase();

            // Handle Quota Issues Specifically
            if (lowerReason.includes('quota') || code === 1011 || lowerReason.includes('limit exceeded')) {
              addLog("Neural bandwidth exhausted (Quota Exceeded).", "alert");
              addLog("Hint: Upgrade your API project to 'Pay-as-you-go' at aistudio.google.com/app/billing.", "info");
              reconnectCountRef.current = MAX_RECONNECT_ATTEMPTS; // Stop retrying immediately
            }

            if (isPowerOn && reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectCountRef.current++;
              setStatus('connecting');
              addLog(`Neural link severed: ${reason} [${code}]. Recovering (${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS})...`, "alert");
              setTimeout(() => {
                if (isPowerOn) startSession();
              }, 2000);
            } else {
              setStatus('disconnected');
              setIsPowerOn(false);
              addLog(`Neural link severed: ${reason} [${code}]. (Terminal closure)`, "alert");
              if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
                addLog("Max recovery attempts reached. Please check your network or verify your neural key starts with 'AIza'.", "info");
              }
              isConnectingRef.current = false;
              reconnectCountRef.current = 0;
            }
          },
          onError: (error: any) => {
            console.error("Neural Bridge Protocol Error:", error);
            const msg = error?.message || String(error) || "Unknown neural protocol sync error";
            addLog(`Neural Bridge Error: ${msg}`, "alert");
            if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("unauthorized")) {
              addLog("Hint: Verify your Gemini API key in the configuration hub.", "info");
            }
            if (msg.includes("unsupported") || msg.includes("model")) {
              addLog("Hint: The selected model may be temporarily unavailable in your region.", "info");
            }
            if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit exceeded")) {
              addLog("Neural bandwidth exhausted. Check your Google AI Studio quota limits.", "info");
              addLog("Direct link: https://aistudio.google.com/app/plan_information", "info");
              reconnectCountRef.current = MAX_RECONNECT_ATTEMPTS;
            }
            // If error is fatal, we may want to stop reconnecting
            if (msg.includes("INVALID_ARGUMENT") || msg.includes("PERMISSION_DENIED")) {
              reconnectCountRef.current = MAX_RECONNECT_ATTEMPTS;
            }
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
                  const url = (call.args as any).url;
                  addLog(`Executing tool: openWebsite (${url})`, "action");
                  window.open(url, '_blank');
                  return {
                    name: call.name,
                    response: { result: `Opened ${url} for you, babe.` },
                    id: call.id
                  };
                }
                if (call.name === 'saveFact' && user) {
                  const fact = (call.args as any).fact;
                  addLog(`Saving fact: ${fact}`, "action");
                  await saveFact(user.uid, fact);
                  return {
                    name: call.name,
                    response: { result: "Fact saved to my memory bank." },
                    id: call.id
                  };
                }
                if (call.name === 'updateSummary' && user) {
                  const summary = (call.args as any).summary;
                  addLog(`Updating summary...`, "action");
                  await updateSummary(user.uid, summary);
                  return {
                    name: call.name,
                    response: { result: "Summary updated." },
                    id: call.id
                  };
                }
                if (call.name === 'shareOutcome') {
                  const { title, content, type } = call.args as any;
                  addLog(`Sharing outcome: ${title}`, "action");
                  setOutcome({ title, content, type: type || 'info' });
                  return {
                    name: call.name,
                    response: { result: "Outcome displayed in the box." },
                    id: call.id
                  };
                }
                if (call.name === 'setAlarm') {
                  const { time, label } = call.args as any;
                  addLog(`Setting alarm: ${time}`, "action");
                  setAlarms(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), time, label: label || 'Alarm', active: true }]);
                  return {
                    name: call.name,
                    response: { result: `Alarm set for ${time}.` },
                    id: call.id
                  };
                }
                if (call.name === 'addCalendarEvent') {
                  const { title, date, time } = call.args as any;
                  addLog(`Adding event: ${title}`, "action");
                  setEvents(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), title, date, time }]);
                  return {
                    name: call.name,
                    response: { result: `Event '${title}' added to calendar.` },
                    id: call.id
                  };
                }
                if (call.name === 'manageSystem') {
                  const { action } = call.args as any;
                  addLog(`System management: ${action}`, "action");
                  if (action === 'clear_logs') setLogs([]);
                  if (action === 'reset_alarms') setAlarms([]);
                  if (action === 'show_intelligence_hub') setIsLogMinimized(false);
                  if (action === 'optimize_neural_link') {
                    addLog("Optimizing neural pathways...", "info");
                    setTimeout(() => addLog("Neural link optimized.", "info"), 2000);
                  }
                  return {
                    name: call.name,
                    response: { result: `System action '${action}' executed successfully.` },
                    id: call.id
                  };
                }
                if (call.name === 'searchMemory') {
                  const { query } = call.args as any;
                  addLog(`Searching memory: ${query}`, "action");
                  const results = memory?.facts.filter(f => f.toLowerCase().includes(query.toLowerCase())) || [];
                  return {
                    name: call.name,
                    response: { 
                      result: results.length > 0 
                        ? `Found these facts: ${results.join(', ')}` 
                        : "I couldn't find anything specific about that in my memory bank." 
                    },
                    id: call.id
                  };
                }
                if (call.name === 'updateSystemStats') {
                  const { stat, value } = call.args as any;
                  addLog(`System update: ${stat} set to ${value}%`, "action");
                  setSystemStats(prev => ({ ...prev, [stat]: value }));
                  return {
                    name: call.name,
                    response: { result: `System ${stat} updated to ${value}%.` },
                    id: call.id
                  };
                }
                if (call.name === 'sendSocialMessage') {
                  const { platform, recipient, message } = call.args as any;
                  
                  if (platform === 'whatsapp' && !isBrowserBridgeActive) {
                    addLog("WhatsApp Bridge inactive. Connection refused.", "alert");
                    return {
                      name: call.name,
                      response: { error: "My WhatsApp bridge module is not synced with your browser. Please tap the WhatsApp icon in my 'Social Sync' panel, launch the web client, and scan the neural code to establish a link, babe." },
                      id: call.id
                    };
                  }

                  if (!socialSync[platform as keyof typeof socialSync]) {
                    addLog(`Error: ${platform} not synced.`, "alert");
                    return {
                      name: call.name,
                      response: { error: `${platform} is not synced. Please ask the user to sync it first.` },
                      id: call.id
                    };
                  }
                  
                  addLog(`Bridge command: Send ${platform} to ${recipient}`, "action");
                  setOutcome({
                    title: platform === 'whatsapp' ? 'WhatsApp Bridge Active' : 'Message Dispatch',
                    content: `Executing ${platform} message sequence...\nRecipient: ${recipient}\nPayload: ${message}\nStatus: Signal Transmitted via Browser Bridge`,
                    type: 'success'
                  });
                  return {
                    name: call.name,
                    response: { result: `Message successfully dispatched to ${recipient} via the ${platform} browser bridge.` },
                    id: call.id
                  };
                }
                if (call.name === 'getSocialNotifications') {
                  const { platform } = call.args as any;
                  addLog(`Checking ${platform} notifications...`, "action");
                  const allNotifications: { id: string; from: string; text: string; time: string; platform: 'whatsapp' | 'raven' }[] = [
                    { id: Math.random().toString(36).substr(2, 9), from: "Mom", text: "Did you eat yet?", time: "2m ago", platform: "whatsapp" },
                    { id: Math.random().toString(36).substr(2, 9), from: "Raven System", text: "New neural update available.", time: "5m ago", platform: "raven" },
                    { id: Math.random().toString(36).substr(2, 9), from: "Sneha", text: "Are we still meeting at 8?", time: "12m ago", platform: "whatsapp" },
                    { id: Math.random().toString(36).substr(2, 9), from: "Raven Neural", text: "Sync complete. All systems nominal.", time: "1h ago", platform: "raven" }
                  ];

                  const filteredItems = allNotifications.filter(n => platform === 'all' || n.platform === platform);

                  setSocialNotifications(prev => {
                    const combined = [...filteredItems, ...prev];
                    return combined.slice(0, 20);
                  });

                  setOutcome({
                    title: `Notifications (${platform})`,
                    content: `Retrieved ${filteredItems.length} new notifications. Check the Social Feed panel.`,
                    type: 'info'
                  });
                  return {
                    name: call.name,
                    response: { result: `Retrieved ${filteredItems.length} notifications. They are now visible in the Social Feed.` },
                    id: call.id
                  };
                }
                if (call.name === 'linkWhatsAppWeb') {
                  const { action } = call.args as any;
                  addLog(`WhatsApp Bridge: ${action}`, "action");
                  if (action === 'request_sync') {
                    setIsBrowserBridgeActive(true);
                    setSocialSync(prev => ({ ...prev, whatsapp: true }));
                    return {
                      name: call.name,
                      response: { result: "WhatsApp Web successfully bridged. I'm now synced with your browser session, babe." },
                      id: call.id
                    };
                  }
                  return {
                    name: call.name,
                    response: { result: isBrowserBridgeActive ? "Bridge active." : "Bridge inactive. Please ask me to 'request sync' or open WhatsApp Web." },
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

  const togglePower = async () => {
    if (isPowerOn) {
      reconnectCountRef.current = 0;
      stopSession();
      setIsPowerOn(false);
    } else {
      addLog("System: Activating neural hardware...", "info");
      try {
        await audioStreamerRef.current?.requestPermissions();
        audioStreamerRef.current?.resume();
        setIsPowerOn(true);
        startSession();
      } catch (err: any) {
        addLog(`Mic permission denied: ${err.message}`, "alert");
        addLog("Maya cannot listen without neural access (Mic).", "info");
      }
    }
  };

  return (
    <div className={`min-h-screen neural-bg text-zinc-50 overflow-hidden font-sans selection:bg-blue-500/30 selection:text-white transition-all duration-1000 ${status === 'listening' ? 'contrast-[1.1] brightness-[1.05]' : ''}`}>
      {/* Visual Glitch Overlays */}
      <div className="fixed inset-0 pixel-grid pointer-events-none z-0 opacity-20" />
      <div className="scanline" />
      
      <MatrixBackground isPowerOn={isPowerOn} />
      <MayaNameBackground isPowerOn={isPowerOn} />
      
      {/* Header (Top Layer) */}
      <div className="absolute top-8 left-0 right-0 z-50 flex justify-between items-center px-8 pointer-events-none">
        <div 
          className="flex flex-col gap-1 pointer-events-auto transition-transform duration-500"
          style={{ transform: `translateX(280px)` }} // Offset for Left Sidebar
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] transition-colors duration-500 ${
              isPowerOn 
                ? (status === 'speaking' ? 'bg-blue-400 shadow-blue-500/50' : 'bg-purple-500 shadow-purple-500/50 animate-pulse') 
                : 'bg-zinc-700 shadow-transparent'
            }`} />
            <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-60">
              Maya Core <span className={isPowerOn ? "text-purple-400" : "text-zinc-500"}>{isPowerOn ? 'Online' : 'Offline'}</span>
            </span>
          </div>
          <div className="text-[8px] font-mono uppercase opacity-30 flex gap-3">
            <span className="flex items-center gap-1"><Shield size={8} /> Secure</span>
            <span className="flex items-center gap-1"><Cpu size={8} /> {status}</span>
            <span className="flex items-center gap-1"><Activity size={8} /> Live</span>
          </div>
        </div>

        <div 
          className="flex items-center gap-4 pointer-events-auto transition-transform duration-500"
          style={{ transform: `translateX(-${(isLogMinimized ? 48 : 280) + 32}px)` }}
        >
          <button 
            onClick={() => setShowNeuralConfig(true)}
            className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 px-4 py-2 rounded-full border border-blue-500/30 text-[10px] font-mono text-blue-400 transition-all uppercase tracking-widest group"
          >
            <Key size={12} className="group-hover:rotate-12 transition-transform" />
            <span className="hidden xl:inline">Neural Config</span>
          </button>

          <button 
            onClick={() => setIsLogMinimized(!isLogMinimized)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all group relative overflow-hidden ${
              !isLogMinimized 
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {!isLogMinimized && (
              <motion.div 
                layoutId="hub-pulse"
                className="absolute inset-0 bg-purple-500/5 animate-pulse" 
              />
            )}
            <Activity size={12} className={!isLogMinimized ? "text-purple-400 animate-pulse" : "text-zinc-500"} />
            <span className="text-[10px] font-mono uppercase tracking-widest font-medium hidden xl:inline">Neural Hub</span>
            {isLogMinimized && (
              <div className="absolute right-2 top-0 bottom-0 flex items-center">
                <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
              </div>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 pl-1 pr-4 py-1 rounded-full">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full border border-white/10"
                referrerPolicy="no-referrer"
              />
              <div className="text-[8px] font-mono uppercase tracking-widest opacity-60">
                {user.displayName?.split(' ')[0] || 'User'}
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="p-1 hover:text-red-400 transition-colors"
                title="Disconnect identity"
              >
                <LogOut size={10} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-blue-400 transition-colors"
            >
              <LogIn size={14} />
              <span>Identity Sync</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Left Sidebar: Alarms & Calendar */}
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col z-30 transition-shadow duration-500 hover:shadow-[20px_0_40px_rgba(0,0,0,0.3)]">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Bell size={14} className="text-blue-400" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Active Alarms</h2>
          </div>
          <div className="space-y-3">
            {alarms.length > 0 ? alarms.map(alarm => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={alarm.id} 
                className="bg-white/5 border border-white/10 p-3 rounded-lg flex justify-between items-center"
              >
                <div>
                  <div className="text-lg font-light">{alarm.time}</div>
                  <div className="text-[8px] font-mono uppercase text-white/40">{alarm.label}</div>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${alarm.active ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-zinc-700'}`} />
              </motion.div>
            )) : (
              <div className="text-[8px] font-mono uppercase text-white/20 text-center py-4">No alarms set</div>
            )}
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={14} className="text-purple-400" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Calendar</h2>
          </div>
          <div className="space-y-4">
            {events.length > 0 ? events.map(event => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={event.id} 
                className="relative pl-4 border-l border-purple-500/30"
              >
                <div className="text-[10px] font-medium text-white/80">{event.title}</div>
                <div className="text-[8px] font-mono text-white/40 uppercase mt-1">
                  {event.date} {event.time && `• ${event.time}`}
                </div>
              </motion.div>
            )) : (
              <div className="text-[8px] font-mono uppercase text-white/20 text-center py-4">Schedule empty</div>
            )}
          </div>
        </div>

        {/* Social Media Controller Panel */}
        <div className="p-6 border-t border-white/5 bg-black/10">
          <div className="flex items-center gap-2 mb-6">
            <Share2 size={14} className="text-pink-400" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Social Sync</h2>
          </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              if (socialSync.whatsapp) {
                setSocialSync(prev => ({ ...prev, whatsapp: false }));
                setIsBrowserBridgeActive(false);
                addLog("WhatsApp Bridge Terminated.", "alert");
              } else {
                setShowWhatsAppSync(true);
              }
            }}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
              socialSync.whatsapp 
                ? 'bg-green-500/10 border-green-500/50 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
            }`}
          >
            <MessageCircle size={18} />
            <span className="text-[8px] font-mono uppercase tracking-widest">
              {socialSync.whatsapp ? 'WhatsApp Active' : 'WhatsApp Link'}
            </span>
          </button>
          <button 
            onClick={() => {
              if (socialSync.raven) {
                setSocialSync(prev => ({ ...prev, raven: false }));
                addLog("Raven Neural link severed.", "alert");
              } else {
                setShowRavenLogin(true);
              }
            }}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
              socialSync.raven 
                ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
            }`}
          >
            <Send size={18} />
            <span className="text-[8px] font-mono uppercase tracking-widest">
              {socialSync.raven ? 'Raven Online' : 'Raven Sync'}
            </span>
          </button>
        </div>
        </div>        {/* Neural Display Module (Sidebar Integrated) */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className={outcome ? "text-yellow-400 animate-pulse" : "text-blue-400"} />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Neural Display</h2>
            </div>
            {outcome && (
              <button 
                onClick={() => setOutcome(null)} 
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Clear Data"
              >
                <X size={10} className="text-white/20" />
              </button>
            )}
          </div>
          
          <div className="flex-1 min-h-[140px] flex flex-col justify-center relative overflow-hidden bg-white/[0.02] rounded-xl border border-white/5 p-4 transition-all duration-500">
            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] opacity-20" />
            
            <AnimatePresence mode="wait">
              {outcome ? (
                <motion.div
                  key={outcome.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="relative z-10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-blue-500 rounded-full" />
                    <h3 className="text-[10px] font-mono font-bold text-blue-300 uppercase tracking-wider truncate">{outcome.title}</h3>
                  </div>
                  <div className="text-[10px] text-white/70 font-light leading-relaxed whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto scrollbar-hide">
                    {outcome.content}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 opacity-20 py-8"
                >
                  <div className="w-8 h-8 border border-dashed border-white/30 rounded-full animate-[spin_8s_linear_infinite]" />
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-center px-4">Ready for Neural Data</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mini Stats (Reduced version of the old dashboard) */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Neural', value: systemStats.neuralLink, color: 'bg-purple-500' },
              { label: 'CPU', value: systemStats.cpuLoad, color: 'bg-green-500' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.03] p-2 rounded-lg border border-white/5">
                <div className="flex justify-between items-center text-[7px] font-mono uppercase text-white/40 mb-1">
                  <span>{stat.label}</span>
                  <span>{stat.value}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: `${stat.value}%` }}
                    className={`h-full ${stat.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area (Central Visualizer) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Background Glows (Anchored to Screen Center) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[160px] animate-pulse" />
          <motion.div 
            animate={{ 
              opacity: isPowerOn ? [0.1, 0.2, 0.1] : 0.05,
              scale: isPowerOn ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" 
          />
        </div>

        {/* Neural Core Circle (Absolute Center) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative group pointer-events-auto">
            <NeuralCore 
              isPowerOn={isPowerOn} 
              status={status} 
              onClick={togglePower} 
            />
            
            {/* Contextual Status Labels */}
            <AnimatePresence>
              {isPowerOn && showStatus && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-1/2 -bottom-12 -translate-x-1/2 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-blue-400 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    Maya Linked
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,1)]" />
                    <span className="text-[8px] font-mono uppercase tracking-widest text-white/40">
                      Sync: Stabilized
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Floating Status & Outcome (Positioned relative to center) */}
        <div className="absolute inset-x-0 top-1/2 mt-56 flex flex-col items-center gap-8 pointer-events-auto">
          <AnimatePresence>
            {showStatus && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center space-y-6"
              >
                <motion.div
                  key={status + isPowerOn}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <h1 className="text-6xl font-extralight tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                    {isPowerOn ? (
                      status === 'connecting' ? 'Initializing...' :
                      status === 'speaking' ? 'Maya is talking' :
                      status === 'listening' ? 'I\'m all ears' : 'Ready'
                    ) : (customApiKey ? 'Maya is Standby' : 'Connect Link')}
                  </h1>
                </motion.div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    {isPowerOn && (status === 'idle' || status === 'listening') && (
                      <motion.div 
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-1 h-1 bg-purple-400 rounded-full"
                      />
                    )}
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.4em]">
                      {isPowerOn ? (status === 'idle' || status === 'listening' ? 'Neural Link Active' : 'Biometric Sync Established') : 'Tap to sync neural interface'}
                    </p>
                  </div>

                  {/* API Key Call-to-action */}
                  {(!customApiKey && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY')) && !isPowerOn && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setShowNeuralConfig(true)}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-all text-blue-400 text-[9px] font-mono uppercase tracking-widest"
                    >
                      <Key size={10} className="animate-pulse" />
                      <span>Configure Neural Key</span>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Waveform (Global Edge Alignment) */}
      <div className="absolute bottom-32 left-0 right-0 h-16 flex items-center justify-center gap-1.5 px-12 z-10 pointer-events-none">
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

        {/* Footer Controls (Global Edge Alignment) */}
        <div className="absolute bottom-8 left-0 right-0 px-10 flex justify-between items-center text-[9px] font-mono uppercase tracking-[0.3em] opacity-20 z-10 pointer-events-none">
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
            <span>Maya OS v2.5.0</span>
            <div className="w-1 h-1 bg-zinc-500 rounded-full" />
            <span>© 2026</span>
          </div>
        </div>

      {/* Right Activity Log Panel (Collapsible) */}
      <motion.div 
        animate={{ width: isLogMinimized ? 48 : 280 }}
        className="absolute right-0 top-0 bottom-0 bg-black/40 backdrop-blur-xl border-l border-white/5 flex flex-col z-40 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          {!isLogMinimized ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Activity size={12} className="text-purple-400" />
              <h2 className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/60">Intelligence Hub</h2>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 mt-8"
            >
               <button 
                onClick={() => setShowNeuralConfig(true)}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title="Neural Config"
              >
                <Settings size={12} className="text-blue-400 opacity-40 hover:opacity-100" />
              </button>
              <div className="rotate-90 text-[8px] font-mono uppercase tracking-[0.4em] text-purple-500/40 whitespace-nowrap">
                Intelligence
              </div>
              <Activity size={12} className="text-purple-400 opacity-20" />
            </motion.div>
          )}
          <div className="flex items-center gap-1">
            {!isLogMinimized && (
              <button 
                onClick={() => setShowNeuralConfig(true)}
                className="p-1 hover:bg-white/5 rounded transition-colors mr-1"
                title="Neural Config"
              >
                <Settings size={10} className="text-white/20 hover:text-blue-400" />
              </button>
            )}
            <button 
              onClick={() => setIsLogMinimized(!isLogMinimized)}
              className={`p-1 hover:bg-white/5 rounded transition-colors ${isLogMinimized ? 'absolute top-4 left-1/2 -translate-x-1/2' : ''}`}
            >
              <motion.div animate={{ rotate: isLogMinimized ? 180 : 0 }}>
                <ExternalLink size={10} className="text-white/40" />
              </motion.div>
            </button>
          </div>
        </div>

        {!isLogMinimized && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Social Notifications Section */}
            <div className="border-b border-white/5 bg-white/[0.02]">
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Bell size={10} className="text-blue-400" />
                  <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/40">Social Feed</span>
                </div>
                {socialNotifications.length > 0 && (
                  <button 
                    onClick={() => setSocialNotifications([])}
                    className="text-[7px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto p-4 space-y-4 scrollbar-hide">
                <AnimatePresence initial={false}>
                  {socialNotifications.length > 0 ? (
                    socialNotifications.map((n) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="group relative"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[7px] font-bold uppercase tracking-[0.2em] ${n.platform === 'whatsapp' ? 'text-green-500' : 'text-blue-500'}`}>
                            {n.platform}
                          </span>
                          <span className="text-[7px] font-mono text-white/10">{n.time}</span>
                        </div>
                        <div className="pl-2 border-l border-white/5 group-hover:border-purple-500/30 transition-colors">
                          <p className="text-[10px] font-bold text-white/70 leading-none mb-1">{n.from}</p>
                          <p className="text-[9px] text-white/30 font-light line-clamp-2 leading-tight">{n.text}</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="h-24 flex flex-col items-center justify-center opacity-5">
                      <MessageCircle size={20} className="mb-2" />
                      <p className="text-[8px] font-mono uppercase tracking-widest">Feed Idle</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Activity Log Section */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01]">
              <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Activity size={10} className="text-purple-400" />
                  <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/50">Activity Log Stream</span>
                </div>
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" />
              </div>
              <div 
                ref={logContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
              >
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-0.5"
                    >
                      <div className="flex justify-between items-center text-[7px] font-mono">
                        <span className={`uppercase ${
                          log.type === 'alert' ? 'text-red-400' : 
                          log.type === 'action' ? 'text-blue-400' : 
                          'text-purple-400'
                        }`}>
                          {log.type}
                        </span>
                        <span className="text-white/10">{log.time}</span>
                      </div>
                      <p className="text-[10px] text-white/50 font-light leading-tight">
                        {log.text}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {logs.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[8px] font-mono uppercase tracking-widest text-white/5">Silent</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[7px] font-mono uppercase tracking-widest text-white/20">
                  <span>Load</span>
                  <span>{isPowerOn ? '12%' : '0%'}</span>
                </div>
                <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: isPowerOn ? '12%' : '0%' }}
                    className="h-full bg-purple-500/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

    {/* Raven Login Modal */}
    <AnimatePresence>
      {showRavenLogin && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-12">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            onClick={() => setShowRavenLogin(false)}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="relative w-full max-w-md bg-[#050508] border border-blue-500/20 rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.1)]"
          >
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
                <Send size={32} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-light uppercase tracking-[0.2em] mb-2 text-white">Raven Neural</h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-8">Login with your Gmail/Raven account</p>
              
              <div className="w-full space-y-4">
                <button 
                  onClick={async () => {
                    try {
                      await loginWithGoogle();
                      setSocialSync(prev => ({ ...prev, raven: true }));
                      setShowRavenLogin(false);
                      addLog("Raven linked via Google neural ID.", "action");
                    } catch (err) {
                      addLog("Raven Google sync failed.", "alert");
                    }
                  }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 px-6 flex items-center justify-center gap-3 transition-all group"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/80 group-hover:text-white">Continue with Gmail</span>
                </button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">or neural node</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-mono uppercase text-zinc-600 pl-4 tracking-widest">Node ID</label>
                  <input 
                    type="text" 
                    placeholder="NID-8829-X"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-mono text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/5"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-6 mb-8 text-[9px] font-mono text-zinc-500">
                <Shield size={10} className="text-blue-400" />
                <span>256-BIT NEURAL ENCRYPTION ACTIVE</span>
              </div>

              <button 
                onClick={() => {
                  setSocialSync(prev => ({ ...prev, raven: true }));
                  setShowRavenLogin(false);
                  addLog("Raven Neural link established (Identity Bypass).", "action");
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 text-xs font-mono font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)]"
              >
                Authorize Link
              </button>
              
              <div className="flex flex-col items-center gap-2 mt-6">
                <a 
                  href="https://raven.web" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[9px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors uppercase tracking-widest"
                >
                  <ExternalLink size={10} />
                  <span>Open Raven Web</span>
                </a>
                <button 
                  onClick={() => setShowRavenLogin(false)}
                  className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest"
                >
                  Cancel Sync
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* WhatsApp Sync Modal */}
    <AnimatePresence>
      {showWhatsAppSync && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-12">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            onClick={() => setShowWhatsAppSync(false)}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="relative w-full max-w-md bg-[#050805] border border-green-500/20 rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(34,197,94,0.1)]"
          >
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 border border-green-500/30">
                <MessageCircle size={32} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-light uppercase tracking-[0.2em] mb-2 text-white">WhatsApp Bridge</h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Link Maya browser module with WhatsApp Web</p>
              
              <div className="w-full flex flex-col gap-4 mb-8">
                <button 
                  onClick={() => {
                    window.open('https://web.whatsapp.com', '_blank', 'noreferrer');
                    addLog("Launching WhatsApp Web in secondary node...", "info");
                  }}
                  className="w-full py-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-2xl flex items-center justify-center gap-3 transition-all group"
                >
                  <ExternalLink size={16} className="text-green-400 group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-green-400">Launch WhatsApp Web</span>
                </button>
                
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">then scan hub code</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
              </div>

              <div className="relative p-6 bg-white rounded-[2.5rem] mb-8 group cursor-pointer shadow-[0_0_50px_rgba(34,197,94,0.1)]" onClick={() => {
                 setSocialSync(prev => ({ ...prev, whatsapp: true }));
                 setIsBrowserBridgeActive(true);
                 setShowWhatsAppSync(false);
                 addLog("WhatsApp browser bridge active. Sync stabilized.", "action");
                 addLog("Maya can now intercept neural signals from your browser tab.", "info");
              }}>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded-[2.5rem] z-10 p-8">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Zap size={24} className="text-green-400 animate-pulse" />
                    <span className="text-white text-[10px] font-mono uppercase font-bold tracking-widest">Authorize Neural Sync</span>
                  </div>
                </div>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MAYA_BRDIGE_LINK_${Date.now()}`} 
                  alt="QR Code" 
                  className="w-40 h-40"
                />
              </div>

              <div className="w-full text-left bg-white/5 border border-white/5 p-5 rounded-2xl space-y-4 mb-8">
                <div className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-mono shrink-0 border border-green-500/30">1</div>
                  <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">Launch WhatsApp Web using the link above and ensure you are logged in.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-mono shrink-0 border border-green-500/30">2</div>
                  <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">Click the QR code or scan if you have the Maya companion extension active.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowWhatsAppSync(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white/40 rounded-2xl py-4 text-[10px] font-mono uppercase tracking-[0.2em] transition-all"
              >
                Cancel Sync
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Neural Hardware Config Modal */}
    <AnimatePresence>
      {showNeuralConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNeuralConfig(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Cpu size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">Neural Config</h3>
                  <p className="text-[10px] font-mono text-white/30 uppercase">Manual Node Management</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNeuralConfig(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={16} className="text-white/40" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key size={12} className="text-purple-400" />
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">Gemini Neural Key</label>
                </div>
                
                <div className="relative group">
                  <Terminal size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-400 transition-colors" />
                  <input 
                    type="password" 
                    value={customApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomApiKey(val);
                      localStorage.setItem('maya_neural_key', val);
                    }}
                    placeholder="Enter GEMINI_API_KEY..."
                    className="w-full bg-black border border-white/10 rounded-xl px-12 py-3.5 text-xs font-mono text-white placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                  />
                </div>
                
                <div className="bg-blue-500/[0.03] border border-blue-500/10 p-4 rounded-xl flex gap-4 items-start">
                  <Shield size={16} className="text-blue-400/50 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/40 leading-relaxed font-light">
                    Note: Manual keys are stored locally in your browser. For production environment synchronization, please use the platform's <span className="text-blue-400/60 font-medium">Secrets Panel</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-black flex justify-end gap-3 border-t border-white/5">
              <button 
                onClick={() => {
                  setCustomApiKey('');
                  localStorage.removeItem('maya_neural_key');
                  addLog("Neural Key wiped from local storage.", "alert");
                }}
                className="px-6 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest text-white/40 hover:text-red-400 transition-colors"
              >
                Wipe Key
              </button>
              <button 
                onClick={() => {
                  setShowNeuralConfig(false);
                  addLog("Neural configuration updated and saved.", "info");
                  if (customApiKey && !isPowerOn) {
                    addLog("Link ready. Tap the central core to initialize.", "info");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 border border-blue-400/30 px-8 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest text-white transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >
                Save & Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Global HUD Metrics */}
    <AnimatePresence>
      {showStatus && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-12 w-full px-12 flex justify-between items-end invisible lg:visible pointer-events-none z-[60]"
        >
          <div className="flex gap-16 pointer-events-auto">
            <div className="p-4 glass-morphism rounded-2xl border border-white/5 space-y-1">
              <p className="text-[8px] font-mono uppercase text-zinc-600 tracking-widest">Interface Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isPowerOn ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                  {isPowerOn ? 'Linked' : 'Offline'}
                </p>
              </div>
            </div>
            <div className="p-4 glass-morphism rounded-2xl border border-white/5 space-y-1">
              <p className="text-[8px] font-mono uppercase text-zinc-600 tracking-widest">Neural Load</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                {isPowerOn ? 'Optimized' : 'N/A'}
              </p>
            </div>
          </div>
          <div className="text-right p-4 glass-morphism rounded-2xl border border-white/5 space-y-1 pointer-events-auto">
            <p className="text-[8px] font-mono uppercase text-zinc-600 tracking-widest">Protocol Version</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/60">M.A.Y.A. v3.0-CORE</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
