// bar chart showing activity split across 3-hour time buckets -
// the busiest bucket is highlighted in stronger indigo so it stands out
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, ChartDataLabels);

export default function PeakHoursChart({ hourBuckets, totalActions }) {
  if (!hourBuckets || Object.keys(hourBuckets).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No hour data available
      </div>
    );
  }

  // sort buckets chronologically by the leading hour - handles both "HH:MM" and "HH-HH" formats
  const sorted = Object.entries(hourBuckets).sort(([a], [b]) => {
    const hourA = parseInt(a.split(':')[0] || a.split('-')[0], 10);
    const hourB = parseInt(b.split(':')[0] || b.split('-')[0], 10);
    return hourA - hourB;
  });

  const labels = sorted.map(([bucket]) => bucket);
  const values = sorted.map(([, count]) => count);
  const maxVal = Math.max(...values);

  const data = {
    labels,
    datasets: [
      {
        label: 'Actions',
        data: values,
        // peak bucket gets full opacity, all others are faded
        backgroundColor: values.map((v) =>
          v === maxVal
            ? 'rgba(99, 102, 241, 0.85)'
            : 'rgba(99, 102, 241, 0.40)'
        ),
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
        borderRadius: 5,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24, bottom: 4, left: 4, right: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Hours: ${items[0]?.label || ''}`,
          // tooltip shows both raw count and percentage share of all-time actions
          label: (ctx) => {
            const count = ctx.parsed.y;
            const pct = totalActions > 0 ? ((count / totalActions) * 100).toFixed(1) : 0;
            return ` ${count.toLocaleString()} actions (${pct}%)`;
          },
        },
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 6,
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        // abbreviate large numbers to keep labels from overflowing the bar
        formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString(),
        font: { size: 11, weight: '600' },
        // peak bar label uses a darker indigo to match its bar colour
        color: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          return v === maxVal ? 'rgb(67, 56, 202)' : 'rgb(107, 114, 128)';
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11, weight: '600' },
          color: 'rgb(75, 85, 99)',
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        // y-axis tick labels also abbreviated for large values
        ticks: {
          font: { size: 11 },
          color: 'rgb(107, 114, 128)',
          callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        },
      },
    },
  };

  return (
    <div className="w-full h-full min-h-[180px]">
      <Bar data={data} options={options} />
    </div>
  );
}
