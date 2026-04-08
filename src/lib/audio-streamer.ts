
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private playbackQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor(private sampleRate: number = 16000) {}

  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async startCapture(onAudioData: (base64Data: string) => void) {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessorNode for simplicity in this environment
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToInt16(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData.buffer);
      onAudioData(base64Data);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stopCapture() {
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
  }

  private activeSources: AudioBufferSourceNode[] = [];

  async playAudioChunk(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const pcmData = new Int16Array(arrayBuffer);
    const floatData = this.int16ToFloat32(pcmData);

    const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
    audioBuffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
    };
  }

  stopPlayback() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source might have already stopped
      }
    });
    this.activeSources = [];
    this.nextStartTime = 0;
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const res = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      res[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7FFF;
    }
    return res;
  }

  private int16ToFloat32(buffer: Int16Array): Float32Array {
    const l = buffer.length;
    const res = new Float32Array(l);
    for (let i = 0; i < l; i++) {
      res[i] = buffer[i] / 0x7FFF;
    }
    return res;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
