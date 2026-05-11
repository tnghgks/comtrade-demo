import type { ComtradeChannel, ComtradeRecord } from './comtradeMock';

interface AnalogChannelDef {
  index: number;
  name: string;
  unit: string;
  multiplier: number;
  offset: number;
}

interface ParsedCfg {
  stationName: string;
  analogChannels: AnalogChannelDef[];
  lineFreq: number;
  sampleRate: number;
  nSamples: number;
  timeMult: number;
  triggerOffsetMs: number;
}

function parseCfg(text: string): ParsedCfg {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const stationName = lines[0].split(',')[0].trim();

  // "24,24A, 0D"
  const channelCountLine = lines[1].split(',');
  const nAnalog = parseInt(channelCountLine[1]);
  const nDigital = parseInt(channelCountLine[2] ?? '0');

  const analogChannels: AnalogChannelDef[] = [];
  for (let i = 0; i < nAnalog; i++) {
    const parts = lines[2 + i].split(',');
    analogChannels.push({
      index: parseInt(parts[0]),
      name: parts[1].trim(),
      unit: parts[4].trim(),
      multiplier: parseFloat(parts[5]),
      offset: parseFloat(parts[6]),
    });
  }

  const freqIdx = 2 + nAnalog + nDigital;
  const lineFreq = parseFloat(lines[freqIdx]);
  const nRates = parseInt(lines[freqIdx + 1]);

  const sampLine = lines[freqIdx + 2].split(',');
  const sampleRate = parseFloat(sampLine[0]);
  const nSamples = parseInt(sampLine[1]);

  const startTimeStr = lines[freqIdx + 2 + nRates];
  const triggerTimeStr = lines[freqIdx + 3 + nRates];
  const timeMult = parseFloat(lines[lines.length - 1]);

  const triggerOffsetMs = computeOffsetMs(startTimeStr, triggerTimeStr);

  return { stationName, analogChannels, lineFreq, sampleRate, nSamples, timeMult, triggerOffsetMs };
}

function parseTimeUs(dateTimeStr: string): number {
  const [, timePart] = dateTimeStr.split(',');
  if (!timePart) return 0;
  const [hStr, mStr, sStr] = timePart.split(':');
  const h = parseInt(hStr ?? '0');
  const m = parseInt(mStr ?? '0');
  const s = parseFloat(sStr ?? '0');
  return (h * 3600 + m * 60 + s) * 1_000_000;
}

function computeOffsetMs(startStr: string, triggerStr: string): number {
  return (parseTimeUs(triggerStr) - parseTimeUs(startStr)) / 1000;
}

function parseDat(
  text: string,
  channels: AnalogChannelDef[],
  timeMult: number,
): ComtradeChannel[] {
  const rows = text.split('\n');
  const channelData: [number, number][][] = channels.map(() => []);

  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) continue;

    const values = trimmed.split(',');
    if (values.length < 2 + channels.length) continue;

    const rawTs = parseInt(values[1]);
    if (!Number.isFinite(rawTs)) continue;
    const timestampMs = (rawTs * timeMult) / 1000;

    for (let i = 0; i < channels.length; i++) {
      const raw = parseInt(values[2 + i]);
      if (!Number.isFinite(raw)) continue;
      const actual = channels[i].multiplier * raw + channels[i].offset;
      channelData[i].push([
        parseFloat(timestampMs.toFixed(3)),
        parseFloat(actual.toFixed(4)),
      ]);
    }
  }

  return channels.map((ch, i) => ({
    name: ch.name,
    unit: ch.unit,
    data: channelData[i],
  }));
}

export function parseComtrade(cfgText: string, datText: string): ComtradeRecord {
  const cfg = parseCfg(cfgText);
  const channels = parseDat(datText, cfg.analogChannels, cfg.timeMult);

  return {
    stationName: cfg.stationName,
    frequency: cfg.lineFreq,
    sampleRate: cfg.sampleRate,
    triggerTime: cfg.triggerOffsetMs,
    channels,
  };
}
