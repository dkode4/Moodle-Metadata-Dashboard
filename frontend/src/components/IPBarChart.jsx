// horizontal bar chart showing the top 10 ips by action count -
// the leading ip is highlighted with stronger opacity
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

export default function IPBarChart({ ipData }) {
  if (!ipData || Object.keys(ipData).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        No IP data available
      </div>
    );
  }

  // sort descending and take the top 10 - already sorted so index 0 is the highest
  const topIPs = Object.entries(ipData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([ip, actions]) => ({ ip, actions }));

  const maxVal = topIPs.length > 0 ? topIPs[0].actions : 0;

  const labels = topIPs.map(item => item.ip);

  const data = {
    labels,
    datasets: [
      {
        label: 'Actions',
        data: topIPs.map(item => item.actions),
        // first bar (highest ip) gets full opacity, the rest are faded
        backgroundColor: topIPs.map((_, i) =>
          i === 0
            ? 'rgba(16, 185, 129, 0.85)'
            : 'rgba(16, 185, 129, 0.45)'
        ),
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.75,
        categoryPercentage: 0.85,
      },
    ],
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 4, bottom: 4, left: 0, right: 50 } },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} actions`,
        },
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 6,
      },
      datalabels: {
        anchor: 'end',
        align: 'right',
        formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString(),
        font: { size: 11, weight: '600' },
        color: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          return v === maxVal ? 'rgb(5, 150, 105)' : 'rgb(107, 114, 128)';
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          font: { size: 11 },
          color: 'rgb(107,114,128)',
          callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        },
        title: {
          display: true,
          text: 'Actions',
          font: { size: 11, weight: '600' },
          color: 'rgb(107,114,128)',
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 11, family: 'ui-monospace, monospace' },
          color: 'rgb(55,65,81)',
          autoSkip: false,
          // truncate long ip labels so they don't overflow the chart area
        callback: function (value) {
            const label = this.getLabelForValue(value);
            return label.length > 18 ? label.slice(0, 16) + '...' : label;
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-full min-h-[200px]">
      <Bar data={data} options={options} />
    </div>
  );
}
