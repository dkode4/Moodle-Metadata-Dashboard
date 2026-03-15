// course overview dashboard - shows all-time kpis, period-level stats,
// top events, top users, peak hours, and engagement tier distribution
import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Chart from '../components/Chart';
import EventsLineChart from '../components/EventsLineChart';
import PeriodNavigator from '../components/PeriodNavigator';
import DeltaIndicator from '../components/DeltaIndicator';
import EngagementTierChart from '../components/EngagementTierChart';
import PeakHoursChart from '../components/PeakHoursChart';
import { useActiveDataset } from '../contexts/useActiveDataset';
import { getTopUsers } from '../utils/userUtils';
import { MdOutlineSchool } from 'react-icons/md';
import { FiPieChart, FiClock, FiActivity, FiAlertTriangle, FiArrowRight,  FiUsers } from 'react-icons/fi';

export default function Dashboard() {
  const navigate = useNavigate();
  const { metrics, loading: contextLoading, activeDataset, connectionsUI, setConnectionsUI, allTime, allUsersWithTiers } = useActiveDataset();
  const { periodType = 'daily', selectedPeriod = null } = connectionsUI || {};

  // auto-select the first period when metrics load or the period type changes -
  // only fires if no period is already selected so it doesn't reset the user's choice
  useEffect(() => {
    if (metrics?.all_periods?.[periodType]?.length > 0 && !selectedPeriod) {
      setConnectionsUI(prev => ({ ...prev, selectedPeriod: metrics.all_periods[periodType][0] }));
    }
  }, [metrics, periodType, selectedPeriod, setConnectionsUI]);

  // four headline kpi numbers derived from all-time data - recalculated only when allTime changes
  const allTimeSummary = useMemo(() => {
    if (!allTime) return null;
    const totalActions = Object.values(allTime.userTotals).reduce((s, v) => s + v, 0);
    const totalUsers = Object.keys(allTime.userTotals).length;
    const avgPerUser = totalUsers > 0 ? Math.round(totalActions / totalUsers) : 0;
    const uniqueEventTypes = Object.keys(allTime.eventCounts).length;
    return { totalActions, totalUsers, avgPerUser, uniqueEventTypes };
  }, [allTime]);

  // top 5 events for the selected period - sorted by count and annotated with % share
  const periodTopEvents = useMemo(() => {
    if (!selectedPeriod?.eventCounts) return [];
    const total = selectedPeriod.total_actions || 1;
    return Object.entries(selectedPeriod.eventCounts)
      .map(([event, count]) => ({ event, count, percent: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [selectedPeriod]);

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!metrics)        return <div className="p-6 text-center text-sm text-gray-500">Computing...</div>;

  const allPeriodsForType = metrics.all_periods[periodType] || [];
  const currentPeriodData = selectedPeriod;

  // find the previous period so delta indicators can compare against it
  const currentIdx = allPeriodsForType.findIndex(p => p.period === selectedPeriod?.period);
  const prevPeriod = currentIdx > 0 ? allPeriodsForType[currentIdx - 1] : null;

  const topUsersForPeriod = currentPeriodData ? getTopUsers(currentPeriodData.userTotals, 5) : [];
  const totalActionsInPeriod = currentPeriodData?.total_actions || 0;

  // count low-engagement users so the alert banner knows whether to render
  const lowEngagementCount = allUsersWithTiers.filter(u => u.tier === 'Low Engagement').length;

  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">

      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <MdOutlineSchool className="text-blue-500 w-5 h-5 shrink-0" />
        Course Overview
      </h1>

      {/* amber alert banner - only shown when at least one user falls in the low engagement tier */}
      {lowEngagementCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
          <FiAlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {lowEngagementCount} Low Engagement {lowEngagementCount === 1 ? 'user' : 'users'} detected
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Bottom 25th percentile of the cohort by unique interactions - may need attention.</p>
          </div>
          <button onClick={() => navigate('/users/all?tier=Low Engagement')}
            className="shrink-0 text-xs font-semibold text-amber-700 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors">
            View <FiArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* all-time kpi strip - hidden until allTimeSummary is available */}
      {allTimeSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">All-Time Actions</div>
            <div className="text-xl font-bold text-blue-700">{allTimeSummary.totalActions.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Total Users</div>
            <div className="text-xl font-bold text-gray-900">{allTimeSummary.totalUsers}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Event Types</div>
            <div className="text-xl font-bold text-indigo-700">{allTimeSummary.uniqueEventTypes}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Avg Actions / User</div>
            <div className="text-xl font-bold text-gray-900">{allTimeSummary.avgPerUser.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* period type selector - switching granularity resets selectedPeriod to null so the
          auto-select effect picks the first period in the new type's list */}
      <div className="flex gap-2 flex-wrap">
        {['daily', 'weekly', 'monthly', 'yearly'].map(type => (
          <button key={type}
            onClick={() => setConnectionsUI({ ...connectionsUI, periodType: type, selectedPeriod: null })}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
              periodType === type
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
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
          accentColor="blue"
        />
      )}

      {/* period-level stats - each metric shows the current value plus a delta vs the prior period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg shadow p-4 border border-blue-200">
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
          <div className="text-xs text-gray-500 font-medium mb-1">Avg Actions / User</div>
          <div className="text-xl font-bold text-gray-900">
            {currentPeriodData?.active_users > 0 ? Math.round(currentPeriodData.total_actions / currentPeriodData.active_users).toLocaleString() : 0}
            <DeltaIndicator
              current={currentPeriodData?.active_users > 0 ? currentPeriodData.total_actions / currentPeriodData.active_users : 0}
              previous={prevPeriod?.active_users > 0 ? prevPeriod.total_actions / prevPeriod.active_users : null}
            />
          </div>
        </div>
        <div>
          {/* percent_active is a ratio so delta uses absolute mode - e.g. 70% vs 65% shows +5pp */}
          <Chart percent={currentPeriodData?.percent_active || 0} />
          {prevPeriod && (
            <DeltaIndicator current={currentPeriodData?.percent_active} previous={prevPeriod?.percent_active} mode="absolute" />
          )}
        </div>
      </div>

      <EventsLineChart
        metrics={metrics}
        periodType={periodType}
        selectedPeriod={selectedPeriod}
      />

      {/* side-by-side cards for top events and top users - each links through to the full page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {periodTopEvents.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-blue-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FiActivity className="w-4 h-4 text-blue-500 shrink-0" />
                Top Events - {currentPeriodData?.period || 'Period'}
              </h3>
              <button onClick={() => navigate('/events')}
                className="shrink-0 text-xs font-semibold text-blue-600 flex items-center gap-1 px-2 py-1 rounded-full border border-blue-200 hover:bg-blue-50">
                All <FiArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {periodTopEvents.map((ev, i) => (
                <div key={ev.event} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-blue-400 shrink-0">#{i + 1}</span>
                    <span className="text-sm text-gray-900 truncate" title={ev.event}>{ev.event}</span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-gray-900">{ev.count.toLocaleString()}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{ev.percent.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {topUsersForPeriod.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-blue-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FiUsers className="w-4 h-4 text-blue-500 shrink-0" />
                Most Active Users - {currentPeriodData?.period || 'Period'}
              </h3>
              <button onClick={() => navigate('/users/all?sort=total_desc')}
                className="shrink-0 text-xs font-semibold text-blue-600 flex items-center gap-1 px-2 py-1 rounded-full border border-blue-200 hover:bg-blue-50">
                All <FiArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {/* each user's share is calculated against total period actions so the percentages add up to 100 */}
              {topUsersForPeriod.map((user, i) => {
                const pct = totalActionsInPeriod > 0 ? ((user.actions / totalActionsInPeriod) * 100).toFixed(1) : 0;
                return (
                  <div key={user.user} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-blue-400 shrink-0">#{i + 1}</span>
                      <Link to={`/users/${user.user}`} className="text-sm text-indigo-600 font-medium truncate">{user.user}</Link>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-gray-900">{user.actions.toLocaleString()}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* peak hours uses all-time hour buckets rather than a single period for a more stable pattern */}
      {allTime?.hourBuckets && Object.keys(allTime.hourBuckets).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-blue-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <FiClock className="w-4 h-4 text-blue-500 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Peak Activity Hours</h3>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">all-time</span>
          </div>
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">When students are most active on the platform - the busiest 3-hour window is highlighted</p>
          </div>
          <div className="p-3 h-56 md:h-64">
            <PeakHoursChart hourBuckets={allTime.hourBuckets} totalActions={allTimeSummary?.totalActions || 0} />
          </div>
        </div>
      )}

      {/* engagement tier chart - based on all-time unique-action percentile rank across the full cohort */}
      {allUsersWithTiers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-blue-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <FiPieChart className="w-4 h-4 text-blue-500 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Engagement Tier Distribution</h3>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {allUsersWithTiers.length} users
            </span>
          </div>
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">All-time cohort breakdown by unique-action percentile rank: Top 10% = Highly Active, Top 25% = High, 25th-75th = Moderate, Bottom 25% = Low.</p>
          </div>
          <div className="p-4 md:p-6">
            <EngagementTierChart allUsersWithTiers={allUsersWithTiers} />
          </div>
        </div>
      )}

      {currentPeriodData && (
        <div className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-lg flex items-center justify-center gap-2">
          <MdOutlineSchool className="text-blue-400 w-3 h-3" />
          Period: <strong>{currentPeriodData.period}</strong>
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{periodType}</span>
        </div>
      )}
    </div>
  );
}