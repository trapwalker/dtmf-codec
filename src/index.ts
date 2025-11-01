/**
 * DTMF Detector — Browser-only decoder using Web Audio + Goertzel.
 * Emits on_tone_start(code), on_tone_end(code, durationMs), and on_sequence_end(sequence).
 */

export type ToneStartHandler = (code: string) => void;
export type ToneEndHandler = (code: string, durationMs: number) => void;
export type SequenceEndHandler = (sequence: string) => void;

export interface DTMFDetectorOptions {
  /** Minimum stable detection time before firing on_tone_start (ms). Default 50 */
  minToneStartMs?: number;
  /** Minimum silence duration to treat tone as ended (ms). Default 60 */
  minSilenceMs?: number;
  /** Required SNR (dB) of selected pair vs residual. Default 8 dB */
  snrDb?: number;
  /** Analysis window size in samples. Default 1024 */
  frameSize?: number;
  /** Hop size in samples (overlap = frameSize - hopSize). Default 512 */
  hopSize?: number;
  /** Dominance (dB) winner vs runner-up inside each group. Default 6 dB */
  dominanceDb?: number;
  /** Minimal RMS to consider the frame non-silent. Default 1e-5 */
  rmsFloor?: number;
  /** Silence duration after tone sequence to fire on_sequence_end (ms). Default: 0 (disabled), or 1000 if on_sequence_end handler is set */
  sequenceTimeoutMs?: number;
}

export default class DTMFDetector {
  public on_tone_start: ToneStartHandler = () => {};
  public on_tone_end:   ToneEndHandler   = () => {};
  private readonly _defaultSequenceHandler: SequenceEndHandler = () => {};
  public on_sequence_end: SequenceEndHandler = this._defaultSequenceHandler;

  private minToneStartMs: number;
  private minSilenceMs: number;
  private snrDb: number;
  private frameSize: number;
  private hopSize: number;
  private dominanceDb: number;
  private rmsFloor: number;
  private sequenceTimeoutMs: number;
  private _sequenceTimeoutMsExplicit: boolean;

  private _ctx: AudioContext | null = null;
  private _procNode: AudioWorkletNode | null = null;
  private _mic: MediaStream | null = null;
  private _running = false;

  private _sampleRate = 48000;
  private _frameDurationMs = 0;
  private _pendingCode: string | null = null;
  private _pendingMs = 0;
  private _activeCode: string | null = null;
  private _activeMs = 0;
  private _silenceMs = 0;
  private _sequenceBuffer: string = '';
  private _sequenceSilenceMs = 0;

  private _lowFreqs = [697, 770, 852, 941];
  private _highFreqs = [1209, 1336, 1477, 1633];
  private _codeMap: Record<string, string> = {
    '697-1209': '1', '697-1336': '2', '697-1477': '3', '697-1633': 'A',
    '770-1209': '4', '770-1336': '5', '770-1477': '6', '770-1633': 'B',
    '852-1209': '7', '852-1336': '8', '852-1477': '9', '852-1633': 'C',
    '941-1209': '*', '941-1336': '0', '941-1477': '#', '941-1633': 'D',
  };

  private _window: Float32Array;

  constructor(opts: DTMFDetectorOptions = {}) {
    this.minToneStartMs = opts.minToneStartMs ?? 50;
    this.minSilenceMs   = opts.minSilenceMs   ?? 60;
    this.snrDb          = opts.snrDb          ?? 8;
    this.frameSize      = opts.frameSize      ?? 1024;
    this.hopSize        = opts.hopSize        ?? 512;
    this.dominanceDb    = opts.dominanceDb    ?? 6;
    this.rmsFloor       = opts.rmsFloor       ?? 1e-5;
    
    // Сохраняем, был ли sequenceTimeoutMs явно указан
    this._sequenceTimeoutMsExplicit = opts.sequenceTimeoutMs !== undefined;
    this.sequenceTimeoutMs = opts.sequenceTimeoutMs ?? 0;

    this._window = new Float32Array(this.frameSize);
    for (let n = 0; n < this.frameSize; n++) {
      this._window[n] = 0.54 - 0.46 * Math.cos((2*Math.PI*n)/(this.frameSize-1));
    }
  }

  /** Ask mic permission and start decoding */
  async start(): Promise<void> {
    if (this._running) return;
    this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    this._sampleRate = this._ctx.sampleRate;
    this._frameDurationMs = 1000 * (this.hopSize / this._sampleRate);
    
    // Если обработчик задан и sequenceTimeoutMs не был явно указан, использовать значение по умолчанию 1 секунда
    if (!this._sequenceTimeoutMsExplicit && this.on_sequence_end !== this._defaultSequenceHandler) {
      this.sequenceTimeoutMs = 1000;
    }
    
    // Сброс буфера последовательности при старте
    this._sequenceBuffer = '';
    this._sequenceSilenceMs = 0;

    this._mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });

    const src = this._ctx.createMediaStreamSource(this._mic);

    await this._ensureWorkletModule();
    this._procNode = new AudioWorkletNode(this._ctx, 'dtmf-frame-worklet', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { frameSize: this.frameSize, hopSize: this.hopSize }
    });

    this._procNode.port.onmessage = (ev: MessageEvent) => {
      const data = (ev as any).data;
      if (data?.type === 'frame') {
        const frame: Float32Array = data.payload;
        this._processFrame(frame);
      }
    };

    src.connect(this._procNode).connect(this._ctx.destination);
    this._running = true;
  }

  /** Stop mic and processing */
  async stop(): Promise<void> {
    this._running = false;
    try { this._procNode?.port.postMessage({ type: 'stop' }); this._procNode?.disconnect(); } catch {}
    if (this._ctx) await this._ctx.close();
    this._mic?.getTracks().forEach(t => t.stop());
    this._ctx = null; this._procNode = null; this._mic = null;

    if (this._activeCode) {
      const code = this._activeCode; const dur = this._activeMs;
      this._activeCode = null; this._activeMs = 0; this._silenceMs = 0; this._pendingCode = null; this._pendingMs = 0;
      try { this.on_tone_end(code, dur); } catch {}
      this._addToSequence(code);
    }
    
    // Очистить буфер последовательности
    this._sequenceBuffer = '';
    this._sequenceSilenceMs = 0;
  }

  private _ensureWorkletModule(): Promise<void> {
    const code = `
      class DTMFFrameProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          const { frameSize = 1024, hopSize = 512 } = options?.processorOptions || {};
          this.frameSize = frameSize;
          this.hopSize = hopSize;
          this.buffer = new Float32Array(frameSize);
          this.writePos = 0;
        }
        process(inputs) {
          const input = inputs[0];
          if (!input || input.length === 0) return true;
          const ch0 = input[0];
          if (!ch0) return true;
          let offset = 0;
          while (offset < ch0.length) {
            const toCopy = Math.min(ch0.length - offset, this.hopSize - (this.writePos % this.hopSize));
            if ((this.writePos % this.hopSize) === 0 && this.writePos > 0) {
              this.buffer.copyWithin(0, this.hopSize);
              this.writePos = this.frameSize - this.hopSize;
            }
            this.buffer.set(ch0.subarray(offset, offset + toCopy), this.writePos);
            this.writePos += toCopy;
            offset += toCopy;
            if (this.writePos >= this.frameSize) {
              this.port.postMessage({ type: 'frame', payload: this.buffer.slice(0) });
            }
          }
          return true;
        }
      }
      registerProcessor('dtmf-frame-worklet', DTMFFrameProcessor);
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return (this._ctx as AudioContext).audioWorklet.addModule(url) as unknown as Promise<void>;
  }

  private _db10(x: number) { return 10 * Math.log10(Math.max(x, 1e-20)); }

  private _processFrame(frame: Float32Array) {
    const N = this.frameSize;
    let rmsAcc = 0;
    for (let i = 0; i < N; i++) {
      const s = frame[i] * this._window[i];
      frame[i] = s; rmsAcc += s*s;
    }
    const framePower = rmsAcc / N;
    const frameRms = Math.sqrt(framePower);

    if (frameRms < this.rmsFloor) { this._advanceSilence(); return; }

    const low = this._goertzelGroup(frame, this._lowFreqs);
    const high = this._goertzelGroup(frame, this._highFreqs);

    const lowSorted = [...low].sort((a,b)=>b.power-a.power);
    const highSorted = [...high].sort((a,b)=>b.power-a.power);
    const bestLow = lowSorted[0], secondLow = lowSorted[1];
    const bestHigh = highSorted[0], secondHigh = highSorted[1];

    const lowDomDb = this._db10(bestLow.power / Math.max(secondLow.power, 1e-20));
    const highDomDb = this._db10(bestHigh.power / Math.max(secondHigh.power, 1e-20));
    if (lowDomDb < this.dominanceDb || highDomDb < this.dominanceDb) { this._advanceSilence(); return; }

    const tonePower = bestLow.power + bestHigh.power;
    const noisePower = Math.max(framePower - tonePower, framePower * 0.05);
    const snrDb = this._db10(tonePower / noisePower);
    if (snrDb < this.snrDb) { this._advanceSilence(); return; }

    const key = `${bestLow.freq}-${bestHigh.freq}`;
    const code = this._codeMap[key] || null;
    if (!code) { this._advanceSilence(); return; }

    const frameMs = this._frameDurationMs;

    if (this._activeCode === code) {
      this._activeMs += frameMs; this._silenceMs = 0; 
      this._sequenceSilenceMs = 0; // Сброс таймера паузы при активном тоне
      return;
    }

    if (this._activeCode && this._activeCode !== code) {
      if (this._pendingCode === code) this._pendingMs += frameMs; else { this._pendingCode = code; this._pendingMs = frameMs; }
      if (this._pendingMs >= this.minToneStartMs) {
        const oldCode = this._activeCode!, oldDur = this._activeMs;
        this._activeCode = code; this._activeMs = 0; this._silenceMs = 0; this._pendingCode = null; this._pendingMs = 0;
        try { this.on_tone_end(oldCode, oldDur); } catch {}
        this._addToSequence(oldCode);
        this._sequenceSilenceMs = 0; // Сброс таймера паузы при переходе к новому тону
        try { this.on_tone_start(code); } catch {}
      }
      return;
    }

    if (this._pendingCode === code) this._pendingMs += frameMs; else { this._pendingCode = code; this._pendingMs = frameMs; }
    if (this._pendingMs >= this.minToneStartMs) {
      this._activeCode = code; this._activeMs = 0; this._silenceMs = 0; this._pendingCode = null; this._pendingMs = 0;
      this._sequenceSilenceMs = 0; // Сброс таймера паузы при начале нового тона
      try { this.on_tone_start(code); } catch {}
    }
  }

  private _advanceSilence() {
    const frameMs = this._frameDurationMs;
    if (this._activeCode) {
      this._silenceMs += frameMs; this._activeMs += frameMs;
      if (this._silenceMs >= this.minSilenceMs) {
        const code = this._activeCode, dur = this._activeMs;
        this._activeCode = null; this._activeMs = 0; this._silenceMs = 0; this._pendingCode = null; this._pendingMs = 0;
        try { this.on_tone_end(code!, dur); } catch {}
        this._addToSequence(code!);
        this._sequenceSilenceMs = 0; // Начинаем отсчёт паузы после завершения тона
      }
    } else {
      this._pendingCode = null; this._pendingMs = 0;
      
      // Проверяем паузу после серии тонов
      if (this.sequenceTimeoutMs > 0 && this._sequenceBuffer.length > 0) {
        this._sequenceSilenceMs += frameMs;
        if (this._sequenceSilenceMs >= this.sequenceTimeoutMs) {
          const sequence = this._sequenceBuffer;
          this._sequenceBuffer = '';
          this._sequenceSilenceMs = 0;
          try { this.on_sequence_end(sequence); } catch {}
        }
      }
    }
  }
  
  private _addToSequence(code: string) {
    this._sequenceBuffer += code;
  }

  private _goertzelGroup(frame: Float32Array, freqs: number[]) {
    const sr = this._sampleRate, N = this.frameSize;
    return freqs.map((f) => {
      const k = Math.round(0.5 + (N * f) / sr);
      const w = (2 * Math.PI / N) * k;
      const cosine = Math.cos(w), sine = Math.sin(w);
      const coeff = 2 * cosine;
      let q0 = 0, q1 = 0, q2 = 0;
      for (let i = 0; i < N; i++) { q0 = coeff * q1 - q2 + frame[i]; q2 = q1; q1 = q0; }
      const real = q1 - q2 * cosine; const imag = q2 * sine; const power = real*real + imag*imag;
      return { freq: f, power } as const;
    });
  }
}
