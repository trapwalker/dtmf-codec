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

  det = new (DTMFDetector as any)({ minToneStartMs, minSilenceMs, snrDb });
  det.on_tone_start = (c: string) => log(`start: ${c}`);
  det.on_tone_end = (c: string, d: number) => log(`end:   ${c}  duration=${Math.round(d)}ms`);

  try { await det.start(); log('Started. Allow microphone permission.'); }
  catch (e) { log('Start failed: ' + (e as Error).message); det = null; }
};

($('stop') as HTMLButtonElement).onclick = async () => {
  if (!det) return;
  await det.stop();
  det = null;
  log('Stopped.');
};
