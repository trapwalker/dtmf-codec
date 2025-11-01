import DTMFDetector from '../dist/index.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const log = (msg: string) => {
  const el = $('log');
  el.textContent = (el.textContent ? el.textContent + '\n' : '') + msg;
};

let det: DTMFDetector | null = null;

($('start') as HTMLButtonElement).onclick = async () => {
  if (det) return;
  const minToneStartMs = Number((document.getElementById('minToneStartMs') as HTMLInputElement).value);
  const minSilenceMs   = Number((document.getElementById('minSilenceMs') as HTMLInputElement).value);
  const snrDb          = Number((document.getElementById('snrDb') as HTMLInputElement).value);
  const sequenceTimeoutMsInput = (document.getElementById('sequenceTimeoutMs') as HTMLInputElement).value;
  const sequenceTimeoutMs = sequenceTimeoutMsInput ? Number(sequenceTimeoutMsInput) : undefined;

  const opts: any = { minToneStartMs, minSilenceMs, snrDb };
  if (sequenceTimeoutMs !== undefined) {
    opts.sequenceTimeoutMs = sequenceTimeoutMs;
  }

  det = new (DTMFDetector as any)(opts);
  det.on_tone_start = (c: string) => log(`start: ${c}`);
  det.on_tone_end = (c: string, d: number) => log(`end:   ${c}  duration=${Math.round(d)}ms`);
  det.on_sequence_end = (sequence: string) => log(`sequence: "${sequence}"`);

  try { await det.start(); log('Started. Allow microphone permission.'); }
  catch (e) { log('Start failed: ' + (e as Error).message); det = null; }
};

($('stop') as HTMLButtonElement).onclick = async () => {
  if (!det) return;
  await det.stop();
  det = null;
  log('Stopped.');
};
