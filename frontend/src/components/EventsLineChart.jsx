// dual-axis line chart showing active users and total actions over time -
// the data window adjusts to the period type so daily shows two days,
// weekly shows each day in the week, monthly shows its weeks, and yearly shows its months
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export default function EventsLineChart({
  metrics,
  periodType,
  selectedPeriod,
}) {
  if (!metrics) return null;

  let chartPoints = [];

  if (periodType === "daily") {
    if (!selectedPeriod || !metrics?.all_periods?.daily) return null;

    const selectedDate = new Date(selectedPeriod.period);
    if (isNaN(selectedDate.getTime())) return null;

    const yesterday = new Date(selectedDate);
    yesterday.setDate(selectedDate.getDate() - 1);
    if (isNaN(yesterday.getTime())) return null;

    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    // if the previous day has no data, fall back to a zero-filled entry so the chart still renders
    const yesterdayData = metrics.all_periods.daily.find(p => p.period === yesterdayKey) || {
      period: yesterdayKey, active_users: 0, total_actions: 0, total_users: selectedPeriod.total_users, percent_active: 0
    };
    const todayData = selectedPeriod;

    chartPoints = [yesterdayData, todayData];
  } else if (periodType === "weekly") {
    if (!selectedPeriod) return null;
    
    const [startStr, endStr] = selectedPeriod.period.split(" → ");
    if (!startStr || !endStr) return null;
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    // set end to end of day so daily entries that fall on the last day of the week are included
    end.setHours(23, 59, 59, 999);

    chartPoints = (metrics.all_periods.daily || []).filter((p) => {
      const d = new Date(p.period);
      return !isNaN(d.getTime()) && d >= start && d <= end;
    });
  } else if (periodType === "monthly") {
    if (!selectedPeriod) return null;
    
    if (!selectedPeriod.period) return null;
    
    const monthKey = selectedPeriod.period;
    chartPoints = (metrics.all_periods.weekly || []).filter((p) =>
      p.start_date?.startsWith(monthKey)
    );
  } else if (periodType === "yearly") {
    if (!selectedPeriod) return null;
    
    if (!selectedPeriod.period) return null;
    
    const yearKey = selectedPeriod.period; 
    chartPoints = (metrics.all_periods.monthly || []).filter((p) =>
      p.period?.startsWith(yearKey)
    );
  }

  if (!chartPoints || chartPoints.length === 0) return null;

  // for weekly periods the label is "start → end" - just show the start date to keep labels short
  const labels = chartPoints.map((p) => {
    const raw = p.period || '';
    if (raw.includes(' → ')) return raw.split(' → ')[0];
    return raw;
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Active users",
        data: chartPoints.map((p) => p.active_users),
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.15)",
        tension: 0.3,
        pointRadius: 3,
        yAxisID: 'yRight',
      },
      {
        label: "Total actions",
        data: chartPoints.map((p) => p.total_actions),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.15)",
        tension: 0.3,
        pointRadius: 3,
        yAxisID: 'yLeft',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", labels: { boxWidth: 12, padding: 16, font: { size: 11 } } },
      tooltip: { enabled: true },
      datalabels: { display: false },
    },
    scales: {
      x: {
        ticks: { autoSkip: true, maxRotation: 45, maxTicksLimit: 8, font: { size: 10 } },
        grid: { display: false },
      },
      yLeft: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: { display: true, text: 'Actions', font: { size: 10 }, color: '#3b82f6' },
        ticks: { font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      yRight: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: { display: true, text: 'Users', font: { size: 10 }, color: '#10b981' },
        ticks: { font: { size: 10 } },
        // drawOnChartArea false prevents the right axis grid lines from overlapping the left ones
        grid: { drawOnChartArea: false },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-blue-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12V4a1 1 0 00-1-1H4a1 1 0 00-1 1v16a1 1 0 001 1h16" /></svg>
        <h3 className="text-sm font-semibold text-gray-900">Engagement Over Time</h3>
        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          {periodType}
        </span>
      </div>
      <div className="p-3 h-56 md:h-80">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}