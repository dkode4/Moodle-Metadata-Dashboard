// event activity analysis page - shows period event breakdowns, Pareto concentration
// analysis across all time, and per-user event diversity classified by IQR thresholds
import { useEffect, useMemo, useState } from 'react';
import { useActiveDataset } from '../contexts/useActiveDataset';
import PeriodNavigator from '../components/PeriodNavigator';
import DeltaIndicator from '../components/DeltaIndicator';
import EventBarChart from '../components/EventBarChart';
import { quartile } from '../utils/ipUtils';
import { FiActivity, FiBarChart2, FiChevronDown, FiChevronUp, FiList, FiTrendingUp, FiUsers } from 'react-icons/fi';

export default function Events() {
  const { metrics, loading: contextLoading, activeDataset, connectionsUI, setConnectionsUI, allTime } = useActiveDataset();
  const { periodType = 'daily', selectedPeriod = null } = connectionsUI || {};

  // auto-select the first period when the type changes and nothing is selected
  useEffect(() => {
    if (metrics?.all_periods?.[periodType]?.length > 0 && !selectedPeriod) {
      setConnectionsUI(prev => ({ ...prev, selectedPeriod: metrics.all_periods[periodType][0] }));
    }
  }, [metrics, periodType, selectedPeriod, setConnectionsUI]);

  // build the sorted event list for the selected period with percent and running cumulative
  // cumulative is computed in a single pass so each row knows the total coverage so far
  const periodEvents = useMemo(() => {
    if (!selectedPeriod?.eventCounts) return [];
    const total = selectedPeriod.total_actions || 1;
    let cumulative = 0;
    return Object.entries(selectedPeriod.eventCounts)
      .map(([event, count]) => ({ event, count, percent: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .map(item => {
        cumulative += item.percent;
        return { ...item, cumulative };
      });
  }, [selectedPeriod]);

  // same as periodEvents but across all time - also finds the Pareto threshold,
  // which is the number of event types needed for their cumulative share to reach 80%
  const { allTimeEvents, paretoThreshold, totalAllTimeActions } = useMemo(() => {
    if (!allTime?.eventCounts) return { allTimeEvents: [], paretoThreshold: 0, totalAllTimeActions: 0 };
    const totalAllTimeActions = Object.values(allTime.eventCounts).reduce((s, c) => s + c, 0);
    let cumulative = 0;
    let paretoThreshold = 0;
    const allTimeEvents = Object.entries(allTime.eventCounts)
      .map(([event, count]) => ({ event, count, percent: (count / totalAllTimeActions) * 100 }))
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => {
        cumulative += item.percent;
        // record the first index where cumulative hits 80% - idx+1 converts to a count
        if (paretoThreshold === 0 && cumulative >= 80) paretoThreshold = idx + 1;
        return { ...item, cumulative };
      });
    return { allTimeEvents, paretoThreshold, totalAllTimeActions };
  }, [allTime]);

  // compute per-user diversity stats and classify each user into a breadth category
  const diversity = useMemo(() => {
    if (!allTime?.userEventTotals) return null;

    const userStats = Object.entries(allTime.userEventTotals).map(([user, events]) => {
      const distinctEvents  = Object.keys(events).length;
      const totalActions    = Object.values(events).reduce((s, c) => s + (Array.isArray(c) ? c[0] : c), 0);
      const uniqueActions   = Object.values(events).reduce((s, c) => s + (Array.isArray(c) ? c[1] : c), 0);
      // revisit rate of 1.0 means every action was unique, higher values mean repeated behaviour
      const repetitionRatio = uniqueActions > 0 ? totalActions / uniqueActions : 0;
      return { user, distinctEvents, totalActions, uniqueActions, repetitionRatio };
    });

    // compute quartiles on the sorted distinct event counts for the category boundaries
    const sortedDiv = userStats.map(u => u.distinctEvents).sort((a, b) => a - b);
    const divQ1     = quartile(sortedDiv, 0.25);
    const divMedian = quartile(sortedDiv, 0.5);
    const divQ3     = quartile(sortedDiv, 0.75);
    const divIQR    = divQ3 - divQ1;
    // upper fence is the standard IQR outlier threshold - anything above this is flagged
    const divUpper  = divQ3 + 1.5 * divIQR;

    const sortedRatio = userStats.map(u => u.repetitionRatio).filter(r => r > 0).sort((a, b) => a - b);
    const ratMedian   = quartile(sortedRatio, 0.5);

    // assign each user to a category based on where their distinct event count falls
    // relative to the IQR thresholds derived from the cohort
    const classified = userStats.map(u => {
      let category;
      if (u.distinctEvents > divUpper)    category = 'Outlier';
      else if (u.distinctEvents > divQ3)  category = 'Broad';
      else if (u.distinctEvents >= divQ1) category = 'Typical';
      else                                category = 'Narrow';
      return { ...u, category };
    });

    // split into four groups and sort each so the most interesting users appear first
    const narrow  = classified.filter(u => u.category === 'Narrow').sort((a, b) => a.distinctEvents - b.distinctEvents || a.totalActions - b.totalActions);
    const typical = classified.filter(u => u.category === 'Typical');
    const broad   = classified.filter(u => u.category === 'Broad').sort((a, b) => b.distinctEvents - a.distinctEvents);
    const outlier = classified.filter(u => u.category === 'Outlier').sort((a, b) => b.distinctEvents - a.distinctEvents);

    return {
      total: userStats.length,
      divQ1, divMedian, divQ3, divUpper,
      ratMedian,
      narrow, typical, broad, outlier,
    };
  }, [allTime]);

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!metrics)        return <div className="p-6 text-center text-sm text-gray-500">Computing...</div>;

  const allPeriodsForType = metrics.all_periods[periodType] || [];
  const currentPeriodData = selectedPeriod;

  const currentIdx = allPeriodsForType.findIndex(p => p.period === selectedPeriod?.period);
  const prevPeriod = currentIdx > 0 ? allPeriodsForType[currentIdx - 1] : null;

  const currentEventTypes = currentPeriodData?.eventCounts ? Object.keys(currentPeriodData.eventCounts).length : 0;
  const prevEventTypes    = prevPeriod?.eventCounts ? Object.keys(prevPeriod.eventCounts).length : null;

  // top event share from the previous period - used by the delta indicator on the stat card
  const prevTopEventShare = (() => {
    if (!prevPeriod?.eventCounts) return null;
    const prevTotal = prevPeriod.total_actions || 1;
    const maxCount = Math.max(...Object.values(prevPeriod.eventCounts));
    return (maxCount / prevTotal) * 100;
  })();

  // how many event types are needed to cover 80% of this period's actions
  const periodParetoIdx   = periodEvents.findIndex(e => e.cumulative >= 80);
  const periodParetoCount = periodParetoIdx >= 0 ? periodParetoIdx + 1 : periodEvents.length;
  const allTimeTopEvent   = allTimeEvents.length > 0 ? allTimeEvents[0] : null;

  // format helper - shows integers without a decimal, floats with one decimal place
  const fmt = (n) => n % 1 === 0 ? n : n.toFixed(1);

  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">

      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <FiActivity className="text-orange-500 w-5 h-5 shrink-0" />
        Event Activity
      </h1>

      {/* period type selector */}
      <div className="flex gap-2 flex-wrap">
        {['daily', 'weekly', 'monthly', 'yearly'].map(type => (
          <button key={type}
            onClick={() => setConnectionsUI({ ...connectionsUI, periodType: type, selectedPeriod: null })}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
              periodType === type
                ? 'bg-orange-500 text-white shadow'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
            }`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      {/* only render the navigator when there is more than one period to scroll between */}
      {allPeriodsForType.length > 1 && (
        <PeriodNavigator
          allPeriods={allPeriodsForType}
          selectedPeriod={selectedPeriod}
          onSelect={(period) => setConnectionsUI({ ...connectionsUI, selectedPeriod: period })}
          accentColor="orange"
        />
      )}

      {/* stats grid for the selected period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg shadow p-4 border border-orange-200">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Active Users</div>
          <div className="text-xl font-bold text-gray-900">
            {currentPeriodData?.active_users || 0}
            <DeltaIndicator current={currentPeriodData?.active_users} previous={prevPeriod?.active_users} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Total Actions</div>
          <div className="text-xl font-bold text-gray-900">
            {(currentPeriodData?.total_actions || 0).toLocaleString()}
            <DeltaIndicator current={currentPeriodData?.total_actions} previous={prevPeriod?.total_actions} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Event Types</div>
          <div className="text-xl font-bold text-orange-700">
            {currentEventTypes}
            <DeltaIndicator current={currentEventTypes} previous={prevEventTypes} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Top Event Share</div>
          <div className="text-xl font-bold text-gray-900">
            {periodEvents.length > 0 ? periodEvents[0].percent.toFixed(1) + '%' : '-'}
            <DeltaIndicator current={periodEvents[0]?.percent} previous={prevTopEventShare} mode="absolute" />
          </div>
        </div>
      </div>

      {/* period event breakdown table - rows in the Pareto set are highlighted */}
      {periodEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-orange-200 overflow-hidden">

          <div className="px-4 py-3 border-b border-orange-200 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <FiList className="w-4 h-4 text-orange-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 truncate">Period Event Breakdown</h3>
              <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">
                {periodEvents.length} types
              </span>
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {periodParetoCount} type{periodParetoCount !== 1 ? 's' : ''} = 80% of activity
            </span>
          </div>

          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              Events ranked by frequency for the selected period. The <strong className="text-gray-600">running total</strong> column
              adds up each event's share from top to bottom - it shows what percentage of all activity is covered so
              far. Highlighted rows are the minimum set needed to reach 80%.
            </p>
          </div>

          <div className="max-h-[26rem] overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed divide-y divide-gray-100 text-xs">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-20" />
                <col className="w-14" />
                <col className="w-28" />
                <col className="w-28" />
              </colgroup>
              <thead className="bg-orange-500 text-white sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">Event</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Count</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">%</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Running Total</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodEvents.map((ev, idx) => (
                  // rows within the Pareto set get an orange tint, the rest are plain
                  <tr key={ev.event} className={idx < periodParetoCount ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-900 truncate" title={ev.event}>{ev.event}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-900 text-right">{ev.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500 text-right">{ev.percent.toFixed(1)}</td>
                    <td className="px-3 py-2 text-gray-500 text-right">{ev.cumulative.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-orange-400 h-2 rounded-full"
                          style={{ width: `${ev.percent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* bar chart for the top events in the selected period */}
      {periodEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-orange-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-orange-200 flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4 text-orange-500 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Top Events - {currentPeriodData?.period || 'Selected Period'}</h3>
          </div>
          <div className="p-4">
            <EventBarChart events={periodEvents} periodLabel={currentPeriodData?.period} />
          </div>
        </div>
      )}

      {/* all-time event concentration table with Pareto summary stats */}
      {allTimeEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-orange-200 overflow-hidden">

          <div className="px-4 py-3 border-b border-orange-200 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <FiTrendingUp className="w-4 h-4 text-orange-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 truncate">All-Time Event Concentration</h3>
              <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">
                {allTimeEvents.length} types
              </span>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{totalAllTimeActions.toLocaleString()} total actions</span>
          </div>

          <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-orange-700">{paretoThreshold}</div>
              <div className="text-xs text-gray-500 mt-0.5">event types for 80%</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-gray-700">{allTimeEvents.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">total event types</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-orange-700">
                {((paretoThreshold / allTimeEvents.length) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">of types = 80% activity</div>
            </div>
            <div>
              {/* truncate very long event names with a title tooltip for the full value */}
              <div className="text-2xl md:text-3xl font-bold text-gray-700 truncate" title={allTimeTopEvent?.event}>
                {allTimeTopEvent ? allTimeTopEvent.event.length > 18 ? allTimeTopEvent.event.slice(0, 18) + '...' : allTimeTopEvent.event : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">top event (all time)</div>
            </div>
          </div>

          <div className="px-4 py-3 flex flex-col gap-1.5 border-b border-gray-100">
            <p className="text-xs text-gray-500"><strong className="text-gray-600">Pareto analysis</strong> shows how concentrated activity is across event types, whether platform use is driven by a handful of interactions or spread across many. In Moodle, navigation events like course views tend to dominate, so the event types behind the threshold matter as much as the number.</p>
          </div>

          <div className="max-h-64 overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed divide-y divide-gray-100 text-xs">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-24" />
                <col className="w-14" />
                <col className="w-28" />
              </colgroup>
              <thead className="bg-orange-500 text-white sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">Event</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Count</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">%</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Running Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allTimeEvents.map((ev, idx) => (
                  <tr key={ev.event} className={idx < paretoThreshold ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-900 truncate" title={ev.event}>{ev.event}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-900 text-right">{ev.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500 text-right">{ev.percent.toFixed(1)}</td>
                    <td className="px-3 py-2 text-gray-500 text-right">{ev.cumulative.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* breadth section is only rendered when diversity data is available */}
      {diversity && <BreadthSection diversity={diversity} fmt={fmt} />}

      {currentPeriodData && (
        <div className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-lg flex items-center justify-center gap-2">
          <FiActivity className="text-orange-400 w-3 h-3" />
          Period: <strong>{currentPeriodData.period}</strong>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{periodType}</span>
        </div>
      )}
    </div>
  );
}

// collapsible panel for a single breadth category - shows nothing if the category has no users
function CategoryPanel({ label, subtitle, users, borderColor, bgColor, textColor, badgeColor, badgeBg, fmt }) {
  const [open, setOpen] = useState(false);
  if (users.length === 0) return null;

  return (
    <div className={`border ${borderColor} rounded-lg overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 ${bgColor} hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-bold ${textColor}`}>{users.length}</span>
          <span className="text-xs font-semibold text-gray-800">{label}</span>
          {subtitle && <span className="text-xs text-gray-500 hidden sm:inline">- {subtitle}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs font-medium ${badgeBg} ${badgeColor} px-2 py-0.5 rounded-full`}>
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
          {open ? <FiChevronUp className="w-4 h-4 text-gray-500" /> : <FiChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>
      {open && (
        <div className="max-h-52 overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
          {users.map((entry, idx) => (
            <div key={entry.user} className={`flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 border-l-4 ${borderColor} min-w-0`}>
              <span className="text-xs font-bold text-gray-400 shrink-0 w-7">#{idx + 1}</span>
              <span className="font-mono text-xs text-gray-900 truncate flex-1 min-w-0">{entry.user}</span>
              <div className="w-14 text-right shrink-0">
                <div className={`text-sm font-bold leading-tight ${textColor}`}>{entry.distinctEvents}</div>
                <div className="text-xs text-gray-400">types</div>
              </div>
              {/* total actions and revisit rate are hidden on mobile to save space */}
              <div className="w-20 text-right shrink-0 hidden sm:block">
                <div className="text-sm font-semibold text-gray-700 leading-tight">{entry.totalActions.toLocaleString()}</div>
                <div className="text-xs text-gray-400">actions</div>
              </div>
              <div className="w-16 text-right shrink-0 hidden sm:block">
                <div className="text-sm font-semibold text-gray-700 leading-tight">{entry.repetitionRatio.toFixed(1)}×</div>
                <div className="text-xs text-gray-400">revisit</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// renders the full breadth section including the summary stats row,
// methodology explanation, and one collapsible CategoryPanel per tier
function BreadthSection({ diversity, fmt }) {
  return (
    <div className="bg-white rounded-lg shadow border border-orange-200 overflow-hidden">

      <div className="px-4 py-3 border-b border-orange-200 flex items-center gap-2">
        <FiUsers className="w-4 h-4 text-orange-500 shrink-0" />
        <h3 className="text-sm font-semibold text-gray-900">Resource Exploration Breadth</h3>
        <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{diversity.total} users</span>
      </div>

      {/* category counts with their threshold ranges derived from the cohort quartiles */}
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
        <div>
          <div className="text-2xl md:text-3xl font-bold text-amber-600">{diversity.narrow.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Narrow <span className="text-gray-400">({'<'}{fmt(diversity.divQ1)} types)</span></div>
          <div className="text-xs text-amber-600 mt-0.5">Limited resource exploration</div>
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-bold text-blue-600">{diversity.typical.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Typical <span className="text-gray-400">({fmt(diversity.divQ1)}-{fmt(diversity.divQ3)} types)</span></div>
          <div className="text-xs text-blue-600 mt-0.5">Expected engagement range</div>
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-600">{diversity.broad.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Broad <span className="text-gray-400">({'>'}{fmt(diversity.divQ3)} types)</span></div>
          <div className="text-xs text-emerald-600 mt-0.5">Wide resource exploration</div>
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-bold text-purple-600">{diversity.outlier.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Outlier <span className="text-gray-400">({'>'}{fmt(diversity.divUpper)} types)</span></div>
          <div className="text-xs text-purple-600 mt-0.5">Unusual breadth (staff?)</div>
        </div>
      </div>

      {/* secondary stats row showing median values and the raw quartile boundaries */}
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-orange-700">{fmt(diversity.divMedian)}</div>
          <div className="text-xs text-gray-500">median types / user</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-orange-700">{fmt(diversity.ratMedian)}×</div>
          <div className="text-xs text-gray-500">median revisit rate</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Q1={fmt(diversity.divQ1)}</span>{' '}
            <span className="font-semibold text-gray-700">Q3={fmt(diversity.divQ3)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            Upper fence: <span className="font-semibold text-gray-700">{fmt(diversity.divUpper)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1.5 border-b border-gray-100">
        <p className="text-xs text-gray-500"><strong className="text-gray-600">What this measures:</strong> How many distinct types of activity (viewing, submitting, reviewing, etc.) each user performed across the entire course. Users who interact with more resource types have broader platform engagement.</p>
        <p className="text-xs text-gray-500"><strong className="text-gray-600">How thresholds are calculated:</strong> Q1 (25th percentile) and Q3 (75th percentile) define the "Typical" range, computed from this dataset. Below Q1 = Narrow, above Q3 = Broad. The upper fence (Q3 + 1.5 × IQR) flags statistical outliers.</p>
        <p className="text-xs text-gray-500"><strong className="text-gray-600">Narrow engagement</strong> users interact with fewer resource types than 75% of the cohort - they may be focused on a single activity (e.g. only quizzes) or may not be exploring available resources.</p>
        <p className="text-xs text-gray-500"><strong className="text-gray-600">Revisit rate</strong> = total actions ÷ unique actions. A rate of 1.0× means every action was unique; higher values indicate repeated interactions with the same content.</p>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <CategoryPanel
          label="Narrow Engagement"
          subtitle={`< ${fmt(diversity.divQ1)} event types`}
          users={diversity.narrow}
          borderColor="border-amber-300"
          bgColor="bg-amber-50"
          textColor="text-amber-600"
          badgeColor="text-amber-700"
          badgeBg="bg-amber-100"
          fmt={fmt}
        />
        <CategoryPanel
          label="Typical Engagement"
          subtitle={`${fmt(diversity.divQ1)}-${fmt(diversity.divQ3)} event types`}
          users={diversity.typical}
          borderColor="border-blue-300"
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          badgeColor="text-blue-700"
          badgeBg="bg-blue-100"
          fmt={fmt}
        />
        <CategoryPanel
          label="Broad Engagement"
          subtitle={`> ${fmt(diversity.divQ3)} event types`}
          users={diversity.broad}
          borderColor="border-emerald-300"
          bgColor="bg-emerald-50"
          textColor="text-emerald-600"
          badgeColor="text-emerald-700"
          badgeBg="bg-emerald-100"
          fmt={fmt}
        />
        <CategoryPanel
          label="Outlier"
          subtitle={`> ${fmt(diversity.divUpper)} event types (may include staff)`}
          users={diversity.outlier}
          borderColor="border-purple-300"
          bgColor="bg-purple-50"
          textColor="text-purple-600"
          badgeColor="text-purple-700"
          badgeBg="bg-purple-100"
          fmt={fmt}
        />
      </div>
    </div>
  );
}
