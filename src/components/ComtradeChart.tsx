import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { ComtradeChannel, ComtradeRecord } from '../utils/comtradeMock';

interface Props {
  data: ComtradeRecord;
}

const PALETTE = [
  '#e74c3c', '#27ae60', '#2980b9', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#16a085',
  '#8e44ad', '#d35400', '#2ecc71', '#3498db', '#e91e63',
];

function getColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function makeSeries(
  channels: ComtradeChannel[],
  axisIdx: number,
  triggerTime: number,
  xMin: number,
  colorOffset: number,
) {
  return channels.map((ch, i) => ({
    name: ch.name,
    type: 'line' as const,
    data: ch.data,
    xAxisIndex: axisIdx,
    yAxisIndex: axisIdx,
    showSymbol: false,
    sampling: 'lttb' as const,
    lineStyle: { width: 1.5, color: getColor(colorOffset + i) },
    itemStyle: { color: getColor(colorOffset + i) },
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

export function ComtradeChart({ data }: Props) {
  const voltageChannels = data.channels.filter(
    ch => ch.unit === 'kV' || ch.unit === 'V',
  );
  const currentChannels = data.channels.filter(ch => ch.unit === 'A');

  const allPoints = data.channels[0]?.data ?? [];
  const xMin = allPoints[0]?.[0] ?? 0;
  const xMax = allPoints[allPoints.length - 1]?.[0] ?? 100;

  const voltageUnit = voltageChannels[0]?.unit ?? 'V';

  const option: EChartsOption = {
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
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: [number, number]; color: string }>;
        if (!items.length) return '';
        const time = items[0].value[0].toFixed(3);
        const rows = items
          .map(p => `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value[1].toFixed(2)}</b>`)
          .join('<br/>');
        return `<b>${time} ms</b><br/>${rows}`;
      },
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
      {
        type: 'value',
        gridIndex: 0,
        min: xMin,
        max: xMax,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#eee' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        min: xMin,
        max: xMax,
        name: 'Time (ms)',
        nameLocation: 'end',
        axisLabel: { formatter: (v: number) => `${v}` },
        splitLine: { lineStyle: { color: '#eee' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: `Voltage (${voltageUnit})`,
        nameTextStyle: { fontSize: 11 },
        splitLine: { lineStyle: { color: '#eee' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Current (A)',
        nameTextStyle: { fontSize: 11 },
        splitLine: { lineStyle: { color: '#eee' } },
      },
    ],
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        bottom: 15,
        height: 20,
      },
      {
        type: 'inside',
        xAxisIndex: [0, 1],
      },
    ],
    series: [
      ...makeSeries(voltageChannels, 0, data.triggerTime, xMin, 0),
      ...makeSeries(currentChannels, 1, data.triggerTime, xMin, voltageChannels.length),
    ],
  };

  return (
    <div className="comtrade-chart">
      <ReactECharts option={option} style={{ height: 580 }} />
    </div>
  );
}
