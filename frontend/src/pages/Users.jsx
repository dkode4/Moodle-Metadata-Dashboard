// user analytics page - shows period leaderboards ranked by total and unique actions,
// all-time power user grids, a peak hours chart, and a low-engagement alert
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveDataset } from "../contexts/useActiveDataset";
import { getTopUsers } from '../utils/userUtils';
import PeakHoursChart from '../components/PeakHoursChart';
import PeriodNavigator from '../components/PeriodNavigator';
import DeltaIndicator from '../components/DeltaIndicator';
import { FiClock, FiUsers, FiStar, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { MdOutlineEmojiEvents } from 'react-icons/md';
import { HiOutlineTrophy } from 'react-icons/hi2';
import { RiVipCrownLine } from 'react-icons/ri';

export default function Users() {
  const navigate = useNavigate();
  const { metrics, loading: contextLoading, activeDataset, connectionsUI, setConnectionsUI, allTime, allUsersWithTiers } = useActiveDataset();
  const { periodType = 'daily', selectedPeriod = null } = connectionsUI || {};

  // when the period type changes and no period is selected, default to the first available one
  useEffect(() => {
    if (metrics?.all_periods?.[periodType]?.length > 0 && !selectedPeriod) {
      setConnectionsUI(prev => ({ ...prev, selectedPeriod: metrics.all_periods[periodType][0] }));
    }
  }, [metrics, periodType, selectedPeriod, setConnectionsUI]);

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!metrics)        return <div className="p-6 text-center text-sm text-gray-500">Computing...</div>;

  const allPeriodsForType = metrics.all_periods[periodType] || [];
  const currentPeriodData = selectedPeriod;

  // switching period type resets the selected period so the effect above picks the first one
  const handlePeriodTypeChange = (type) => setConnectionsUI({ ...connectionsUI, periodType: type, selectedPeriod: null });
  const handlePeriodSelect = (period) => setConnectionsUI({ ...connectionsUI, selectedPeriod: period });

  // top 10 users for the selected period ranked by total action count
  const topUsersByTotal = currentPeriodData ? getTopUsers(currentPeriodData.userTotals, 10) : [];

  // build a per-user unique action count for the selected period by summing the second
  // element of each [total, unique] event count pair across all event types
  const periodUniqueMap = {};
  if (currentPeriodData?.userEventCounts) {
    Object.entries(currentPeriodData.userEventCounts).forEach(([user, events]) => {
      periodUniqueMap[user] = Object.values(events).reduce((sum, c) => sum + (Array.isArray(c) ? c[1] : c), 0);
    });
  }

  const topUsersByUnique   = getTopUsers(periodUniqueMap, 10);
  const allTimeTopByUnique = allTime ? getTopUsers(allTime.userUniqueTotals, 6) : [];
  const allTimeTopByTotal  = allTime ? getTopUsers(allTime.userTotals, 6) : [];
  const totalActionsInPeriod = currentPeriodData?.total_actions || 0;
  const totalUniqueInPeriod  = Object.values(periodUniqueMap).reduce((a, b) => a + b, 0);

  // find the period immediately before the selected one so delta indicators can compare
  const currentIdx = allPeriodsForType.findIndex(p => p.period === selectedPeriod?.period);
  const prevPeriod = currentIdx > 0 ? allPeriodsForType[currentIdx - 1] : null;

  // sum unique actions across all users in the previous period for the unique delta indicator
  const prevUniqueTotal = (() => {
    if (!prevPeriod?.userEventCounts) return null;
    return Object.values(prevPeriod.userEventCounts).reduce((sum, events) =>
      sum + Object.values(events).reduce((s, c) => s + (Array.isArray(c) ? c[1] : c), 0), 0);
  })();

  const prevAvg    = prevPeriod?.active_users > 0 ? Math.round((prevPeriod?.total_actions || 0) / prevPeriod.active_users) : null;
  const currentAvg = currentPeriodData?.active_users > 0 ? Math.round(totalActionsInPeriod / currentPeriodData.active_users) : 0;

  const lowEngagementUsers = allUsersWithTiers.filter(u => u.tier === 'Low Engagement');

  // renders a ranked leaderboard table for the selected period -
  // mobile shows a condensed card list, desktop shows a full table with headers
  const UserTable = ({ users, grandTotal, label, mode, sortParam }) => (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-indigo-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 min-w-0">
          {mode === 'unique' ? <FiStar className="w-4 h-4 text-purple-500 shrink-0" /> : <MdOutlineEmojiEvents className="w-4 h-4 text-indigo-500 shrink-0" />}
          <span className="truncate">Top by {label}</span>
        </h3>
        <button onClick={() => navigate(`/users/all?sort=${sortParam}`)}
          className="shrink-0 text-xs font-semibold text-indigo-600 flex items-center gap-1 px-2 py-1 rounded-full border border-indigo-200 hover:bg-indigo-50">
          All <FiArrowRight className="w-3 h-3" />
        </button>
      </div>
      {/* mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {users.map((user, i) => {
          const pct = grandTotal > 0 ? ((user.actions / grandTotal) * 100).toFixed(1) : 0;
          return (
            <div key={user.user} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold shrink-0 ${mode === 'unique' ? 'text-purple-400' : 'text-indigo-400'}`}>#{i+1}</span>
                <Link to={`/users/${user.user}`} className="text-indigo-600 font-medium text-sm truncate">{user.user}</Link>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-gray-900">{user.actions.toLocaleString()}</div>
                <div className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-block ${mode === 'unique' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className={`text-white text-xs ${mode === 'unique' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
            <tr>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">{label}</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user, i) => {
              const pct = grandTotal > 0 ? ((user.actions / grandTotal) * 100).toFixed(1) : 0;
              return (
                <tr key={user.user} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-indigo-400 text-sm">#{i+1}</td>
                  <td className="px-4 py-3"><Link to={`/users/${user.user}`} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm truncate block max-w-[200px]">{user.user}</Link></td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-sm">{user.actions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mode === 'unique' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'}`}>{pct}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // renders the all-time top 6 users as a grid of cards with their count and percentage share
  const PowerUsersGrid = ({ users, totalActions, label, mode }) => (
    <div className={`rounded-lg shadow-lg border p-4 md:p-6 ${mode === 'unique' ? 'bg-purple-50 border-purple-200' : 'bg-indigo-50 border-indigo-200'}`}>
      <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        {mode === 'unique' ? <RiVipCrownLine className="w-4 h-4 text-purple-500" /> : <HiOutlineTrophy className="w-4 h-4 text-indigo-500" />}
        All-Time Power Users - {label}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {users.map((user, i) => {
          const pct = totalActions > 0 ? ((user.actions / totalActions) * 100).toFixed(1) : 0;
          return (
            <div key={user.user} className="p-3 md:p-4 bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-3xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${mode === 'unique' ? 'bg-purple-500' : 'bg-indigo-500'}`}>#{i+1}</div>
              <div className="min-w-0">
                <Link to={`/users/${user.user}`} className="font-bold text-sm text-indigo-700 hover:underline block truncate">{user.user}</Link>
                <div className="text-lg font-bold text-gray-900">{user.actions.toLocaleString()}</div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded inline-block mt-0.5 ${mode === 'unique' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{pct}% of all time</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">
      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <FiUsers className="text-indigo-500 w-5 h-5 shrink-0" /> User Analytics
      </h1>

      {/* period type selector - daily / weekly / monthly / yearly */}
      <div className="flex gap-2 flex-wrap">
        {['daily', 'weekly', 'monthly', 'yearly'].map(type => (
          <button key={type} onClick={() => handlePeriodTypeChange(type)}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${periodType === type ? 'bg-indigo-500 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* only show the navigator when there is more than one period to pick from */}
      {allPeriodsForType.length > 1 && (
        <PeriodNavigator
          allPeriods={allPeriodsForType}
          selectedPeriod={selectedPeriod}
          onSelect={handlePeriodSelect}
          accentColor="indigo"
        />
      )}

      {/* stats grid for the selected period - each stat shows a delta vs the previous period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg shadow p-4 border border-indigo-200">
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
            {totalActionsInPeriod.toLocaleString()}
            <DeltaIndicator current={totalActionsInPeriod} previous={prevPeriod?.total_actions} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Unique Actions</div>
          <div className="text-xl font-bold text-gray-900">
            {totalUniqueInPeriod.toLocaleString()}
            <DeltaIndicator current={totalUniqueInPeriod} previous={prevUniqueTotal} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Avg / User</div>
          <div className="text-xl font-bold text-gray-900">
            {currentAvg}
            <DeltaIndicator current={currentAvg} previous={prevAvg} />
          </div>
          <div className="text-xs text-gray-400 mt-1">Unique avg</div>
          <div className="text-base font-bold text-purple-700">{currentPeriodData?.active_users > 0 ? Math.round(totalUniqueInPeriod / currentPeriodData.active_users) : 0}</div>
        </div>
      </div>

      {/* peak hours chart for the selected period */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-indigo-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <FiClock className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900">Peak Activity by Hour</h3>
        </div>
        <div className="p-3 h-56 md:h-64">
          <PeakHoursChart hourBuckets={currentPeriodData?.hourBuckets} totalActions={totalActionsInPeriod} />
        </div>
      </div>

      {/* low engagement alert - only shown when at least one user falls in the bottom 25th percentile */}
      {lowEngagementUsers.length > 0 && (() => {
        const lowCount = allUsersWithTiers.filter(u => u.tier === 'Low Engagement').length;
        return (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
            <FiAlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {lowCount} Low Engagement {lowCount === 1 ? 'user' : 'users'} in dataset
              </p>
              <p className="text-xs text-amber-700 mt-0.5">Based on unique interactions - bottom 25th percentile of the cohort.</p>
            </div>
            <button onClick={() => navigate('/users/all?tier=Low Engagement')}
              className="shrink-0 text-xs font-semibold text-amber-700 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors">
              View all <FiArrowRight className="w-3 h-3" />
            </button>
          </div>
        );
      })()}

      {/* side-by-side leaderboards for the selected period */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UserTable users={topUsersByTotal} grandTotal={totalActionsInPeriod} label="Total Actions" mode="total" sortParam="total_desc" />
        <UserTable users={topUsersByUnique} grandTotal={totalUniqueInPeriod} label="Unique Actions" mode="unique" sortParam="unique_desc" />
      </div>

      {/* all-time power user grids - shown below the period leaderboards */}
      {allTime && <PowerUsersGrid users={allTimeTopByTotal} totalActions={Object.values(allTime.userTotals).reduce((a,b)=>a+b,0)} label="Total Actions" mode="total" />}
      {allTime && <PowerUsersGrid users={allTimeTopByUnique} totalActions={Object.values(allTime.userUniqueTotals).reduce((a,b)=>a+b,0)} label="Unique Actions" mode="unique" />}

      {currentPeriodData && (
        <div className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-lg flex items-center justify-center gap-2">
          <FiUsers className="text-indigo-400 w-3 h-3" /> Period: <strong>{currentPeriodData.period}</strong>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{periodType}</span>
        </div>
      )}
    </div>
  );
}
