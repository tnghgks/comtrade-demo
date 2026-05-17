import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import type { ComtradeChannel, ComtradeRecord } from '../utils/comtradeMock';

interface Props {
  data: ComtradeRecord;
}

function lowerBound(points: [number, number][], value: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid][0] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function makeSeries(
  channels: ComtradeChannel[],
  axisIdx: number,
  triggerTime: number,
  xMin: number,
) {
  return channels.map((ch, i) => ({
    name: ch.name,
    type: 'line' as const,
    data: ch.data,
    xAxisIndex: axisIdx,
    yAxisIndex: axisIdx,
    showSymbol: false,
    clip: true,
    ...(i === 0 && triggerTime > xMin && {
      markLine: {
        silent: true,
        symbol: ['none', 'none'] as const,
        data: [{ xAxis: triggerTime }],
        label: { formatter: 'Trigger', position: 'insideEndTop' as const },
        lineStyle: { color: '#f1c40f', type: 'dashed' as const, width: 2 },
      },
    }),
  }));
}

function buildSeries(
  channels: ComtradeChannel[],
  triggerTime: number,
  xMin: number,
) {
  const voltage = channels.filter(c => c.unit === 'kV' || c.unit === 'V');
  const current = channels.filter(c => c.unit === 'A');
  return [
    ...makeSeries(voltage, 0, triggerTime, xMin),
    ...makeSeries(current, 1, triggerTime, xMin),
  ];
}

function buildOption(data: ComtradeRecord): EChartsOption {
  const points = data.channels[0]?.data ?? [];
  const xMin = points[0]?.[0] ?? 0;
  const xMax = points[points.length - 1]?.[0] ?? 100;
  const voltageUnit =
    data.channels.find(c => c.unit === 'kV' || c.unit === 'V')?.unit ?? 'V';

  return {
    animation: false,
    title: {
      text: `COMTRADE — ${data.stationName}`,
      subtext: `${data.frequency} Hz  |  ${data.sampleRate} samples/s  |  ${(xMax / 1000).toFixed(2)} s`,
      left: 'center',
      top: 8,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
    },
    legend: {
      data: data.channels.map(ch => ch.name),
      top: 60,
      type: 'scroll',
    },
    grid: [
      { left: 80, right: 20, top: 100, height: '36%' },
      { left: 80, right: 20, top: '60%', height: '24%' },
    ],
    xAxis: [
      { type: 'value', gridIndex: 0, min: xMin, max: xMax, axisLabel: { show: false } },
      { type: 'value', gridIndex: 1, min: xMin, max: xMax, name: 'Time (ms)' },
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, name: `Voltage (${voltageUnit})` },
      { type: 'value', gridIndex: 1, name: 'Current (A)' },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], filterMode: 'none' },
    ],
    series: buildSeries(data.channels, data.triggerTime, xMin),
  };
}

export function ComtradeChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chart.setOption(buildOption(data));

    const points = data.channels[0]?.data ?? [];
    const xMin = points[0]?.[0] ?? 0;
    const xMax = points[points.length - 1]?.[0] ?? 100;
    const span = xMax - xMin;

    chart.on('datazoom', () => {
      const dz = (chart.getOption() as { dataZoom: Array<{ start?: number; end?: number }> }).dataZoom[0];
      const startVal = xMin + (span * (dz.start ?? 0)) / 100;
      const endVal = xMin + (span * (dz.end ?? 100)) / 100;

      const visible = data.channels.map(ch => {
        const s = Math.max(0, lowerBound(ch.data, startVal) - 1);
        const e = Math.min(ch.data.length, lowerBound(ch.data, endVal) + 1);
        return { ...ch, data: ch.data.slice(s, e) };
      });

      chart.setOption({ series: buildSeries(visible, data.triggerTime, xMin) });
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [data]);

  return (
    <div className="comtrade-chart">
      <div ref={containerRef} style={{ width: '100%', height: 580 }} />
    </div>
  );
}
