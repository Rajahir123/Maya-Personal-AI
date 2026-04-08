
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export type SessionConfig = {
  systemInstruction?: string;
  voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  tools?: any[];
};

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(config: SessionConfig, callbacks: {
    onOpen?: () => void;
    onClose?: () => void;
    onMessage?: (message: LiveServerMessage) => void;
    onError?: (error: any) => void;
  }) {
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            callbacks.onOpen?.();
          },
          onclose: () => {
            console.log("Live session closed");
            callbacks.onClose?.();
          },
          onmessage: (message: LiveServerMessage) => {
            callbacks.onMessage?.(message);
          },
          onerror: (error: any) => {
            console.error("Live session error:", error);
            callbacks.onError?.(error);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: config.voiceName || "Zephyr" }
            },
          },
          systemInstruction: config.systemInstruction || "You are a helpful assistant.",
          tools: config.tools,
        },
      });
      return this.session;
    } catch (error) {
      console.error("Failed to connect to Live API:", error);
      throw error;
    }
  }

  sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  sendToolResponse(functionResponses: any[]) {
    if (this.session) {
      this.session.sendToolResponse({ functionResponses });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}
