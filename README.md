# @your-scope/dtmf-detector

Browser DTMF decoder (Web Audio + Goertzel). Works locally on the client, no servers.

## Features
- Pure browser, uses microphone via Web Audio API
- Robust to moderate noise using SNR + dominance checks
- Simple event API: `on_tone_start(code)`, `on_tone_end(code, durationMs)`
- TypeScript types included

## Install

```bash
npm i @your-scope/dtmf-detector
# or
yarn add @your-scope/dtmf-detector
# or
pnpm add @your-scope/dtmf-detector
```

## Usage

```ts
import DTMFDetector from '@your-scope/dtmf-detector';

const det = new DTMFDetector({
  minToneStartMs: 50,
  minSilenceMs: 60,
  snrDb: 8,
});

det.on_tone_start = (code) => console.log('start', code);
det.on_tone_end = (code, dur) => console.log('end', code, 'ms');

await det.start();
// ... later: await det.stop();
```

## API

### class `DTMFDetector(options?: DTMFDetectorOptions)`

**Options:**
- `minToneStartMs` — minimum stable detection time before `on_tone_start` (default 50 ms)
- `minSilenceMs` — minimum silence to consider tone ended (default 60 ms)
- `snrDb` — required signal-to-noise ratio in dB (default 8 dB)
- `frameSize` — analysis window size in samples (default 1024)
- `hopSize` — hop size in samples (default 512)
- `dominanceDb` — dominance of the winning frequency vs runner-up (default 6 dB)
- `rmsFloor` — minimal RMS to treat a frame as non-silent (default 1e-5)

**Events (settable handlers):**
- `on_tone_start: (code: string) => void`
- `on_tone_end: (code: string, durationMs: number) => void`

**Methods:**
- `start(): Promise<void>` — requests mic permission and starts decoding
- `stop(): Promise<void>` — stops mic and ends an active tone if any

## Security / Permissions
This package needs access to the microphone. Browser will prompt the user.

## Demo
Run local demo:

```bash
npm i
npm run build
npm run demo
```

Then open the printed local URL (Vite dev server). The demo uses the built ESM in `dist/`.

## License
MIT
