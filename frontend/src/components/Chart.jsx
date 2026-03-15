// small two-segment pie showing active vs inactive users for the selected period -
// legend and tooltip are disabled because the percentage is shown as text alongside it
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Chart({ percent }) {
  const pieData = {
    labels: ['Active', 'Inactive'],
    datasets: [{
      // remainder of 100 fills the inactive segment
      data: [percent, 100 - percent],
      backgroundColor: ['#3b82f6', '#e5e7eb'],
      borderWidth: 0,
    }],
  };

  return (
    <>
      <div className="text-xs text-gray-500 font-medium mb-1">Percent Active</div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0">
          <Pie data={pieData} options={{ plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } } }} />
        </div>
        <div className="text-xl font-bold text-gray-900">{percent}%</div>
      </div>
    </>
  );
}