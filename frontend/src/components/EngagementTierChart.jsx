// doughnut chart showing the cohort-wide engagement tier breakdown -
// legend, tooltip, and datalabels are all disabled in favour of the custom
// legend rendered alongside the chart
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// tier order and colours are fixed so the chart segments are always consistent
const TIERS = [
  { key: 'Highly Active',       color: '#10b981' },
  { key: 'High Engagement',     color: '#6366f1' },
  { key: 'Moderate Engagement', color: '#3b82f6' },
  { key: 'Low Engagement',      color: '#f59e0b' },
];

export default function EngagementTierChart({ allUsersWithTiers }) {
  if (!allUsersWithTiers || allUsersWithTiers.length === 0) return null;

  const total = allUsersWithTiers.length;
  // count how many users fall into each tier
  const counts = TIERS.map(t => ({
    ...t,
    count: allUsersWithTiers.filter(u => u.tier === t.key).length,
  }));

  const data = {
    labels: counts.map(c => c.key),
    datasets: [{
      data: counts.map(c => c.count),
      backgroundColor: counts.map(c => c.color),
      hoverBackgroundColor: counts.map(c => c.color),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: { display: false },
    },
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="w-40 h-40 sm:w-44 sm:h-44 shrink-0">
        <Doughnut data={data} options={options} />
      </div>
      {/* custom legend - shows colour dot, tier name, count, and percentage */}
      <div className="flex flex-col gap-3 w-full sm:w-auto">
        {counts.map(c => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-sm text-gray-700 font-medium min-w-0 truncate">{c.key}</span>
            <span className="text-base font-bold text-gray-900 ml-auto sm:ml-3">{c.count}</span>
            <span className="text-xs text-gray-400 shrink-0">
              ({total > 0 ? ((c.count / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
