// inline up/down indicator showing change between the current and previous period value -
// relative mode shows percentage change, absolute mode shows point difference (used for
// values that are already percentages, e.g. percent_active going from 65% to 70% = +5pp)
export default function DeltaIndicator({ current, previous, mode = 'relative' }) {
  if (previous == null || current == null) return null;

  if (mode === 'absolute') {
    const diff = current - previous;
    // suppress tiny differences to avoid showing noise like ▲0.0pp
    if (Math.abs(diff) < 0.1) return null;
    const isUp = diff > 0;
    return (
      <span className={`inline-flex items-center text-xs font-semibold ml-1.5 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
        {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}pp
      </span>
    );
  }

  // guard against division by zero when the previous value was 0
  const base = previous === 0 ? 1 : previous;
  const change = ((current - previous) / base) * 100;
  // suppress changes under 0.5% to avoid showing ▲0% which looks misleading
  if (Math.abs(change) < 0.5) return null;
  const isUp = change > 0;
  return (
    <span className={`inline-flex items-center text-xs font-semibold ml-1.5 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
    </span>
  );
}
