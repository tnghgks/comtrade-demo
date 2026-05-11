export interface ComtradeChannel {
  name: string;
  unit: string;
  data: [number, number][]; // [timestamp_ms, value]
}

export interface ComtradeRecord {
  stationName: string;
  frequency: number;
  sampleRate: number;
  triggerTime: number; // ms
  channels: ComtradeChannel[];
}

export function generateMockComtrade(): ComtradeRecord {
  const SAMPLE_RATE = 3600; // samples/sec (60 samples per cycle)
  const DURATION = 0.1;    // 100ms total
  const FREQ = 60;          // Hz
  const TRIGGER = 50;       // fault trigger at 50ms
  const SAMPLES = Math.floor(SAMPLE_RATE * DURATION);
  const TWO_PI_OVER_3 = (2 * Math.PI) / 3;

  const makeWaveform = (
    amplitude: number,
    phaseOffset: number,
    faultAmplitude: number
  ): [number, number][] =>
    Array.from({ length: SAMPLES }, (_, i) => {
      const t = i / SAMPLE_RATE;
      const ms = parseFloat((t * 1000).toFixed(3));
      const amp = ms >= TRIGGER ? faultAmplitude : amplitude;
      return [ms, parseFloat((amp * Math.sin(2 * Math.PI * FREQ * t + phaseOffset)).toFixed(3))];
    });

  return {
    stationName: 'Sample Station',
    frequency: FREQ,
    sampleRate: SAMPLE_RATE,
    triggerTime: TRIGGER,
    channels: [
      { name: 'Va', unit: 'kV', data: makeWaveform(100, 0, 20) },
      { name: 'Vb', unit: 'kV', data: makeWaveform(100, -TWO_PI_OVER_3, 20) },
      { name: 'Vc', unit: 'kV', data: makeWaveform(100, TWO_PI_OVER_3, 100) },
      { name: 'Ia', unit: 'A',  data: makeWaveform(50, -0.3, 250) },
      { name: 'Ib', unit: 'A',  data: makeWaveform(50, -TWO_PI_OVER_3 - 0.3, 250) },
      { name: 'Ic', unit: 'A',  data: makeWaveform(50, TWO_PI_OVER_3 - 0.3, 50) },
    ],
  };
}
