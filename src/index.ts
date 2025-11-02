/**
 * DTMF Library — Browser-only DTMF detector and generator using Web Audio API.
 * 
 * This library provides both detection and generation of DTMF tones.
 * - DTMFDetector: Decodes DTMF tones from microphone input
 * - DTMFGenerator: Synthesizes DTMF tones for playback
 */

// Re-export detector
export { default as DTMFDetector } from './detector.js';
export type {
  DTMFDetectorOptions,
  ToneStartHandler,
  ToneEndHandler,
  SequenceEndHandler,
} from './detector.js';

// Re-export generator
export { DTMFGenerator } from './generator.js';
export type { DTMFGeneratorOptions } from './generator.js';

// Re-export constants (optional, for advanced usage)
export {
  DTMF_LOW_FREQUENCIES,
  DTMF_HIGH_FREQUENCIES,
  DTMF_FREQUENCY_TO_CODE,
  DTMF_CODE_TO_FREQUENCIES,
} from './constants.js';

// Default export is DTMFDetector for backward compatibility
export { default } from './detector.js';
