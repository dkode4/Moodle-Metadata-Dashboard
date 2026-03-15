// horizontal bar chart showing the top 10 events by action count for the selected period -
// the leading event is highlighted with stronger opacity
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

export default function EventBarChart({ events, periodLabel }) {
  if (!events || events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        No event data available
      </div>
    );
  }

  const top = events.slice(0, 10);
  const maxVal = top[0]?.count || 0;

  // truncate long event names so they don't overflow the y-axis label area
  const labels = top.map(e =>
    e.event.length > 28 ? e.event.slice(0, 26) + '...' : e.event
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'Actions',
        data: top.map(e => e.count),
        // top event gets full opacity, the rest are faded
        backgroundColor: top.map((_, i) =>
          i === 0
            ? 'rgba(249, 115, 22, 0.85)'
            : 'rgba(249, 115, 22, 0.45)'
        ),
        borderColor: 'rgb(249, 115, 22)',
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
          // use the full untruncated event name in the tooltip title
          title: (items) => {
            const idx = items[0]?.dataIndex;
            return idx != null ? top[idx].event : '';
          },
          label: (ctx) => {
            const ev = top[ctx.dataIndex];
            return ` ${ctx.parsed.x.toLocaleString()} actions (${ev.percent.toFixed(1)}%)`;
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
        align: 'right',
        formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString(),
        font: { size: 11, weight: '600' },
        color: (ctx) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          return v === maxVal ? 'rgb(234, 88, 12)' : 'rgb(107, 114, 128)';
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
          font: { size: 11 },
          color: 'rgb(55,65,81)',
          autoSkip: false,
        },
      },
    },
  };

  return (
    <div className="w-full h-full min-h-[280px]">
      <Bar data={data} options={options} />
    </div>
  );
}
