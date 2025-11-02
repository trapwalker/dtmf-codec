/**
 * DTMF Generator — Browser-only DTMF tone synthesizer using Web Audio API.
 */

import { DTMF_CODE_TO_FREQUENCIES } from './constants.js';

export interface DTMFGeneratorOptions {
  /** Длительность одного кода в миллисекундах. По умолчанию 100 */
  defaultToneDurationMs?: number;
  /** Пауза между кодами в миллисекундах. По умолчанию 20 */
  defaultPauseMs?: number;
  /** Громкость в процентах (0-100). По умолчанию 100 */
  defaultVolume?: number;
}

export class DTMFGenerator {
  /** Длительность одного кода по умолчанию в миллисекундах */
  public defaultToneDurationMs: number;
  /** Пауза между кодами по умолчанию в миллисекундах */
  public defaultPauseMs: number;
  /** Громкость по умолчанию в процентах (0-100) */
  public defaultVolume: number;

  private _ctx: AudioContext | null = null;
  
  // Активные источники звука для возможности остановки (неблокирующий режим)
  private _activeSources: AudioBufferSourceNode[] = [];
  private _activeTimeouts: number[] = [];
  
  // Маппинг символов DTMF на пары частот [низкая, высокая]
  private readonly _freqMap = { ...DTMF_CODE_TO_FREQUENCIES };

  constructor(opts: DTMFGeneratorOptions = {}) {
    this.defaultToneDurationMs = opts.defaultToneDurationMs ?? 100;
    this.defaultPauseMs = opts.defaultPauseMs ?? 20;
    this.defaultVolume = opts.defaultVolume ?? 100;
  }

  /**
   * Останавливает все активные источники звука (для неблокирующего режима)
   */
  stop(): void {
    // Останавливаем все активные источники
    this._activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Источник уже остановлен, игнорируем ошибку
      }
    });
    this._activeSources = [];
    
    // Очищаем все запланированные таймеры
    this._activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this._activeTimeouts = [];
  }

  /**
   * Синтез DTMF кода или последовательности кодов
   * 
   * @param codes - строка из одного или более символов DTMF (0-9, *, #, A-D). Пустая строка или пробел останавливает текущее воспроизведение
   * @param toneDurationMs - длительность одного кода в миллисекундах (по умолчанию из defaultToneDurationMs)
   * @param pauseMs - пауза между кодами в миллисекундах (по умолчанию из defaultPauseMs)
   * @param volume - громкость в процентах 0-100 (по умолчанию из defaultVolume)
   * @param blocking - если true, метод будет ждать завершения воспроизведения (по умолчанию false)
   * @returns Promise, который разрешается после завершения воспроизведения (если blocking=true)
   */
  async synthesize(
    codes: string,
    toneDurationMs?: number,
    pauseMs?: number,
    volume?: number,
    blocking: boolean = false
  ): Promise<void> {
    // Очистка пробелов
    const trimmedCodes = codes?.trim() || '';
    
    // Если пустая строка или только пробелы - останавливаем текущее воспроизведение
    if (!trimmedCodes || trimmedCodes.length === 0) {
      if (!blocking) {
        this.stop();
      }
      return;
    }

    const duration = toneDurationMs ?? this.defaultToneDurationMs;
    const pause = pauseMs ?? this.defaultPauseMs;
    const vol = volume ?? this.defaultVolume;

    // Инициализируем AudioContext при первом использовании
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Если неблокирующий режим, останавливаем предыдущее воспроизведение
    if (!blocking) {
      this.stop();
    }

    // Функция для генерации одного тона
    const playTone = (code: string): Promise<void> => {
      return new Promise((resolve) => {
        const freqs = this._freqMap[code];
        if (!freqs) {
          // Игнорируем неизвестные символы
          resolve();
          return;
        }

        const [lowFreq, highFreq] = freqs;
        const sampleRate = this._ctx!.sampleRate;
        const durationSeconds = duration / 1000;
        const numSamples = Math.floor(sampleRate * durationSeconds);
        
        // Создаем буфер для тона
        const buffer = this._ctx!.createBuffer(1, numSamples, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // Генерируем смешанный сигнал двух частот
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const lowTone = Math.sin(2 * Math.PI * lowFreq * t);
          const highTone = Math.sin(2 * Math.PI * highFreq * t);
          // Смешиваем тоны с нормализацией (делим на 2, чтобы избежать клиппинга)
          channelData[i] = (lowTone + highTone) / 2;
        }

        // Создаем источник и применяем громкость
        const source = this._ctx!.createBufferSource();
        const gainNode = this._ctx!.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, vol / 100));
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this._ctx!.destination);
        
        // В неблокирующем режиме сохраняем источник для возможности остановки
        if (!blocking) {
          this._activeSources.push(source);
        }
        
        source.onended = () => {
          // Удаляем источник из активных при завершении
          if (!blocking) {
            const index = this._activeSources.indexOf(source);
            if (index > -1) {
              this._activeSources.splice(index, 1);
            }
          }
          resolve();
        };
        source.start();
      });
    };

    // Функция для паузы
    const wait = (ms: number): Promise<void> => {
      return new Promise((resolve) => setTimeout(resolve, ms));
    };

    if (blocking) {
      // Блокирующий режим: играем тоны последовательно с паузами
      for (let i = 0; i < trimmedCodes.length; i++) {
        await playTone(trimmedCodes[i]);
        if (i < trimmedCodes.length - 1 && pause > 0) {
          await wait(pause);
        }
      }
    } else {
      // Неблокирующий режим: запускаем все тоны с задержками, но не ждем
      for (let i = 0; i < trimmedCodes.length; i++) {
        const delay = i * (duration + pause);
        const timeoutId = window.setTimeout(() => {
          playTone(trimmedCodes[i]).catch(() => {
            // Игнорируем ошибки в неблокирующем режиме
          });
        }, delay);
        this._activeTimeouts.push(timeoutId);
      }
    }
  }
}

