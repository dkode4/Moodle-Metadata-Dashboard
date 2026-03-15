// ip and connection analytics page - shows per-period ip activity, all-time
// subnet concentration, and iqr-based outlier detection for connection patterns
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import IPBarChart from '../components/IPBarChart';
import PeriodNavigator from '../components/PeriodNavigator';
import DeltaIndicator from '../components/DeltaIndicator';
import { useActiveDataset } from '../contexts/useActiveDataset';
import { getSubnetPrefix, quartile, processIPData } from '../utils/ipUtils';
import { FiBarChart2, FiGlobe, FiWifi, FiShield } from 'react-icons/fi';

export default function Connections() {
  const { metrics, loading: contextLoading, activeDataset, connectionsUI, setConnectionsUI } = useActiveDataset();
  const navigate = useNavigate();
  const { periodType = 'daily', selectedPeriod = null } = connectionsUI || {};

  // auto-select the most recent period when metrics load or granularity changes
  useEffect(() => {
    if (metrics?.all_periods?.[periodType]?.length > 0 && !selectedPeriod) {
      setConnectionsUI(prev => ({ ...prev, selectedPeriod: metrics.all_periods[periodType][0] }));
    }
  }, [metrics, periodType, setConnectionsUI]);

  // aggregate ip counts across all yearly periods, then group by /24 subnet prefix -
  // unknown ips are excluded here because they can't be attributed to a real subnet
  const { allTimeData, topAllTimeSubnets } = useMemo(() => {
    const allTimeData = { totalActions: 0, ipCounts: {} };
    if (metrics?.all_periods?.yearly) {
      metrics.all_periods.yearly.forEach(yearData => {
        allTimeData.totalActions += yearData.total_actions;
        Object.entries(yearData.ipCounts || {}).forEach(([ip, actions]) => {
          if (ip !== 'Unknown') allTimeData.ipCounts[ip] = (allTimeData.ipCounts[ip] || 0) + actions;
        });
      });
    }
    const allTimeSubnets = {};
    Object.entries(allTimeData.ipCounts).forEach(([ip, actions]) => {
      const prefix = getSubnetPrefix(ip);
      allTimeSubnets[prefix] = allTimeSubnets[prefix] || { ips: 0, actions: 0 };
      allTimeSubnets[prefix].ips += 1;
      allTimeSubnets[prefix].actions += actions;
    });
    const topAllTimeSubnets = Object.entries(allTimeSubnets)
      .map(([prefix, data]) => ({
        prefix, ips: data.ips, actions: data.actions,
        percent: ((data.actions / allTimeData.totalActions) * 100).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));
    return { allTimeData, topAllTimeSubnets };
  }, [metrics]);

  // build per-user ip sets and action totals by scanning all yearly periods -
  // sets deduplicate ips automatically so a user who reuses an ip isn't double-counted
  const { totalUsers, medianIPs, q1IPs, q3IPs, iqr, upperFence, medianActionsPerIP, outlierCount, summaryInsight, stabilityList } = useMemo(() => {
    const userIPSets = new Map();
    const userActionTotals = new Map();
    if (metrics?.all_periods?.yearly) {
      metrics.all_periods.yearly.forEach(yearData => {
        Object.entries(yearData.ipUsers || {}).forEach(([ip, users]) => {
          if (ip !== 'Unknown') {
            users.forEach(user => {
              if (!userIPSets.has(user)) userIPSets.set(user, new Set());
              userIPSets.get(user).add(ip);
            });
          }
        });
        Object.entries(yearData.userTotals || {}).forEach(([user, actions]) => {
          userActionTotals.set(user, (userActionTotals.get(user) || 0) + actions);
        });
      });
    }

    const userStats = Array.from(userIPSets.entries()).map(([user, ipSet]) => {
      const uniqueIPs = ipSet.size;
      const totalActions = userActionTotals.get(user) || 0;
      // actionsPerIP normalises activity level against the number of locations -
      // helps distinguish high-volume multi-ip users from low-activity ones
      const actionsPerIP = uniqueIPs > 0 ? totalActions / uniqueIPs : 0;
      return { user, uniqueIPs, totalActions, actionsPerIP };
    });

    const totalUsers = userStats.length;

    // iqr outlier detection - upper fence is q3 + 1.5 * iqr, the standard tukey method
    const sortedIPs = userStats.map(u => u.uniqueIPs).sort((a, b) => a - b);
    const q1IPs      = quartile(sortedIPs, 0.25);
    const medianIPs  = quartile(sortedIPs, 0.5);
    const q3IPs      = quartile(sortedIPs, 0.75);
    const iqr        = q3IPs - q1IPs;
    const upperFence = q3IPs + 1.5 * iqr;

    const sortedAPI = userStats.map(u => u.actionsPerIP).sort((a, b) => a - b);
    const medianActionsPerIP = quartile(sortedAPI, 0.5);

    const classified = userStats.map(u => ({
      ...u,
      isOutlier: u.uniqueIPs > upperFence
    }));

    const outlierCount = classified.filter(u => u.isOutlier).length;
    const fenceLabel = upperFence % 1 === 0 ? upperFence : upperFence.toFixed(1);
    const summaryInsight = outlierCount > 0
      ? `${outlierCount} user${outlierCount !== 1 ? 's' : ''} exceed${outlierCount === 1 ? 's' : ''} the upper fence of ${fenceLabel} IPs (Q3 + 1.5×IQR)`
      : 'No statistical outliers - all users within expected range';

    // sort descending by unique ip count, then by total actions as a tiebreaker
    const stabilityList = classified.sort((a, b) => b.uniqueIPs - a.uniqueIPs || b.totalActions - a.totalActions);

    return { totalUsers, medianIPs, q1IPs, q3IPs, iqr, upperFence, medianActionsPerIP, outlierCount, summaryInsight, stabilityList };
  }, [metrics]);

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!metrics)        return <div className="p-6 text-center text-sm text-gray-500">Computing...</div>;

  const allPeriodsForType = metrics.all_periods[periodType] || [];
  const currentPeriodData = selectedPeriod;

  // find the previous period for delta comparison
  const currentIdx = allPeriodsForType.findIndex(p => p.period === selectedPeriod?.period);
  const prevPeriod = currentIdx > 0 ? allPeriodsForType[currentIdx - 1] : null;

  // changing period type resets selectedPeriod so the auto-select effect can pick the right first entry
  const handleViewMoreIPs      = () => navigate('/connections/ip-breakdown');
  const handlePeriodTypeChange = (type) => setConnectionsUI({ ...connectionsUI, periodType: type, selectedPeriod: null });
  const handlePeriodSelect     = (period) => setConnectionsUI({ ...connectionsUI, selectedPeriod: period });

  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">

      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <FiGlobe className="text-emerald-500 w-5 h-5 shrink-0" />
        Connections Overview
      </h1>
      <div className="flex gap-2 flex-wrap">
        {['daily', 'weekly', 'monthly', 'yearly'].map(type => (
          <button key={type} onClick={() => handlePeriodTypeChange(type)}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
              periodType === type
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
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
          onSelect={handlePeriodSelect}
          accentColor="emerald"
        />
      )}
      {/* period-level stats strip - unique ips has no delta because it isn't compared period-to-period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg shadow p-4 border border-emerald-200">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Active Users</div>
          <div className="text-xl font-bold text-gray-900">
            {currentPeriodData?.active_users || 0}
            <DeltaIndicator current={currentPeriodData?.active_users} previous={prevPeriod?.active_users} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Total Users</div>
          <div className="text-xl font-bold text-gray-900">
            {currentPeriodData?.total_users || 0}
            <DeltaIndicator current={currentPeriodData?.total_users} previous={prevPeriod?.total_users} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Total Actions</div>
          <div className="text-xl font-bold text-gray-900">
            {currentPeriodData?.total_actions || 0}
            <DeltaIndicator current={currentPeriodData?.total_actions} previous={prevPeriod?.total_actions} />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Unique IPs</div>
          <div className="text-xl font-bold text-emerald-700">{currentPeriodData?.total_unique_ips || 0}</div>
        </div>
      </div>
      {/* ip chart and table - only rendered when the selected period has ip data */}
      {currentPeriodData?.ipCounts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="bg-white rounded-lg shadow border border-emerald-200 flex flex-col overflow-hidden min-h-[18rem]">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
              <FiBarChart2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                Top IPs by Activity ({Object.keys(currentPeriodData.ipCounts).length} total)
              </h3>
            </div>
            <div className="flex-1 p-3 min-h-0">
              <IPBarChart ipData={currentPeriodData.ipCounts}  />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-emerald-200 flex flex-col overflow-hidden min-h-[18rem] max-h-[26rem]">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
              <FiBarChart2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                Top IPs ({Object.keys(currentPeriodData.ipCounts).length} total)
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full table-fixed divide-y divide-gray-100 text-xs">
                <colgroup>
                  <col className="w-1/2" />
                  <col className="w-1/4" />
                  <col className="w-1/4" />
                </colgroup>
                <thead className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">IP Address</th>
                    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Actions</th>
                    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider">Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* empty filter string means no text filtering - just take the top 10 */}
                  {processIPData(currentPeriodData, '', 10).map(({ ip, actions, users }) => (
                    <tr key={ip} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-900 truncate" title={ip}>{ip}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-gray-900 text-right">{actions}</td>
                      <td className="px-3 py-2 text-gray-500 text-right">{users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* view all button - only shown when there are more ips than fit in the preview */}
            {Object.keys(currentPeriodData.ipCounts).length > 5 && (
              <div className="px-4 py-2.5 border-t border-gray-200 shrink-0">
                <button onClick={handleViewMoreIPs}
                  className="w-full text-emerald-700 hover:bg-emerald-50 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 transition-all">
                  View all {Object.keys(currentPeriodData.ipCounts).length} IPs →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* subnet concentration - aggregated across all time, sorted by share of total actions */}
      {topAllTimeSubnets.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-emerald-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-200 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <FiWifi className="w-4 h-4 text-emerald-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 truncate">All-Time Subnet Network Concentration</h3>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
                {topAllTimeSubnets.length} subnets
              </span>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{allTimeData.totalActions.toLocaleString()} total actions</span>
          </div>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">IP ranges ranked by activity across the full dataset. IPv4 addresses are grouped by their first three octets, IPv6 by their first four groups.</p>
          </div>
          <div className="max-h-64 overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
            {topAllTimeSubnets.map((subnet, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 border-l-4 border-emerald-400 min-w-0"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-mono text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                    {subnet.prefix}.*
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {subnet.ips} IPs | {subnet.actions.toLocaleString()} actions
                  </span>
                </div>
                <div className="text-right shrink-0 w-16">
                  <div className="text-base font-bold text-emerald-700 leading-tight">{subnet.percent}%</div>
                  <div className="text-xs text-gray-400">of all time</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow border border-emerald-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-emerald-200 flex items-center gap-2">
          <FiShield className="w-4 h-4 text-emerald-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900">All-Time Connection Patterns</h3>
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{totalUsers} users</span>
        </div>
        <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
          <div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-700">
              {medianIPs % 1 === 0 ? medianIPs : medianIPs.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">median IPs per user</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-gray-700">
              {q1IPs % 1 === 0 ? q1IPs : q1IPs.toFixed(1)}-{q3IPs % 1 === 0 ? q3IPs : q3IPs.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">typical range (Q1-Q3)</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-700">{medianActionsPerIP.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5">median actions per IP</div>
          </div>
          <div className="flex items-center">
            <div className="text-sm font-semibold text-gray-800 leading-snug">{summaryInsight}</div>
          </div>
        </div>
        <div className="px-4 py-3 flex flex-col gap-1.5 border-b border-gray-100">
          <p className="text-xs text-gray-500"><strong className="text-gray-600">Why median?</strong> Robust to outliers - a better central measure than average for skewed IP distributions.</p>
          <p className="text-xs text-gray-500"><strong className="text-gray-600">Why IQR?</strong> The interquartile range (Q3 − Q1) is a standard statistical method for outlier detection. Unlike arbitrary thresholds, it adapts to the shape of your data.</p>
          <p className="text-xs text-gray-500"><strong className="text-gray-600">Actions per IP</strong> normalises IP count by activity level - a student with 500 actions across 5 IPs has a very different pattern from one with 10 actions across 5 IPs.</p>
          <p className="text-xs text-gray-500"><strong className="text-gray-600">Outlier ≠ risk.</strong> Multiple IPs often reflect mobile access, VPN use, or campus + home connections. Context is needed before drawing conclusions.</p>
          {/* only shown when outliers exist - displays the exact fence value so it can be verified */}
          {outlierCount > 0 && (
            <p className="text-xs text-gray-500"><strong className="text-gray-600">{outlierCount} outlier{outlierCount !== 1 ? 's' : ''} detected</strong> above the upper fence of {upperFence % 1 === 0 ? upperFence : upperFence.toFixed(1)} unique IPs (Q3 {q3IPs % 1 === 0 ? q3IPs : q3IPs.toFixed(1)} + 1.5 × IQR {iqr % 1 === 0 ? iqr : iqr.toFixed(1)}).</p>
          )}
        </div>
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <span className="w-7"></span>
            <span className="flex-1 min-w-0">User</span>
            <span className="w-16 text-right">IPs</span>
            <span className="w-20 text-right hidden sm:block">Actions</span>
            <span className="w-20 text-right hidden sm:block">Acts / IP</span>
          </div>
        </div>
        {/* outlier rows get an amber left border and background tint to stand out */}
        <div className="max-h-64 overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
          {stabilityList.map((entry, idx) => (
            <div
              key={entry.user}
              className={`flex items-center gap-2 px-4 py-3 hover:bg-gray-50 border-l-4 min-w-0 ${
                entry.isOutlier ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-300'
              }`}
            >
              <span className="text-xs font-bold text-gray-400 shrink-0 w-7">#{idx + 1}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-xs text-gray-900 truncate">{entry.user}</span>
                {entry.isOutlier && (
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline">
                    Outlier
                  </span>
                )}
              </div>
              <div className="w-16 text-right shrink-0">
                <div className={`text-sm font-bold leading-tight ${entry.isOutlier ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {entry.uniqueIPs}
                </div>
                <div className="text-xs text-gray-400">IPs</div>
              </div>
              <div className="w-20 text-right shrink-0 hidden sm:block">
                <div className="text-sm font-semibold text-gray-700 leading-tight">{entry.totalActions.toLocaleString()}</div>
                <div className="text-xs text-gray-400">actions</div>
              </div>
              <div className="w-20 text-right shrink-0 hidden sm:block">
                <div className="text-sm font-semibold text-gray-700 leading-tight">{entry.actionsPerIP.toFixed(1)}</div>
                <div className="text-xs text-gray-400">acts/IP</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {currentPeriodData && (
        <div className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-lg flex items-center justify-center gap-2">
          <FiGlobe className="text-emerald-400 w-3 h-3" />
          Period: <strong>{currentPeriodData.period}</strong>
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{periodType}</span>
        </div>
      )}
    </div>
  );
}