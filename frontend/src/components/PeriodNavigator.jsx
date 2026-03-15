// left/right navigator for cycling through time periods - used on dashboard, connections,
// events, and users pages. accentColor matches the theme of whichever page uses it
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function PeriodNavigator({ allPeriods, selectedPeriod, onSelect, accentColor = 'indigo' }) {
  // nothing to navigate if there is only one period
  if (!allPeriods || allPeriods.length <= 1) return null;

  const currentIdx = allPeriods.findIndex(p => p.period === selectedPeriod?.period);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allPeriods.length - 1;

  // colour tokens per accent - falls back to indigo if an unrecognised value is passed
  const colorMap = {
    blue:    { text: 'text-blue-600',    border: 'border-blue-200',    hoverBg: 'hover:bg-blue-50',    bg: 'bg-blue-50',    label: 'text-blue-900'   },
    indigo:  { text: 'text-indigo-600',  border: 'border-indigo-200',  hoverBg: 'hover:bg-indigo-50',  bg: 'bg-indigo-50',  label: 'text-indigo-900' },
    emerald: { text: 'text-emerald-600', border: 'border-emerald-200', hoverBg: 'hover:bg-emerald-50', bg: 'bg-emerald-50', label: 'text-emerald-900'},
    orange:  { text: 'text-orange-600',  border: 'border-orange-200',  hoverBg: 'hover:bg-orange-50',  bg: 'bg-orange-50',  label: 'text-orange-900' },
  };
  const c = colorMap[accentColor] || colorMap.indigo;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => hasPrev && onSelect(allPeriods[currentIdx - 1])}
        disabled={!hasPrev}
        className={`p-1.5 rounded-md border ${c.border} ${hasPrev ? `${c.text} ${c.hoverBg} cursor-pointer` : 'text-gray-300 cursor-not-allowed'} transition-colors`}
        aria-label="Previous period"
      >
        <FiChevronLeft className="w-4 h-4" />
      </button>

      <span className={`text-xs font-semibold ${c.label} px-2.5 py-1 rounded-md ${c.bg} ${c.border} border min-w-[80px] text-center select-none`}>
        {selectedPeriod?.period || '-'}
      </span>

      <button
        onClick={() => hasNext && onSelect(allPeriods[currentIdx + 1])}
        disabled={!hasNext}
        className={`p-1.5 rounded-md border ${c.border} ${hasNext ? `${c.text} ${c.hoverBg} cursor-pointer` : 'text-gray-300 cursor-not-allowed'} transition-colors`}
        aria-label="Next period"
      >
        <FiChevronRight className="w-4 h-4" />
      </button>

      <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
        {currentIdx + 1} / {allPeriods.length}
      </span>
    </div>
  );
}
