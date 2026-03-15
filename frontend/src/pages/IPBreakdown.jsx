// detailed ip address listing for the period selected on the connections page -
// supports live text filtering and shows action count, user count, and percentage per ip
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveDataset } from '../contexts/useActiveDataset';
import { processIPData } from '../utils/ipUtils';
import { FiArrowLeft, FiGlobe, FiSearch } from 'react-icons/fi';

export default function IPBreakdown() {
  const navigate = useNavigate();
  const { connectionsUI } = useActiveDataset();
  const [filterIP, setFilterIP] = useState('');
  const { selectedPeriod = null, periodType = 'daily' } = connectionsUI || {};

  // memoised so the function reference stays stable across renders
  const handleBack = useCallback(() => navigate('/connections'), [navigate]);

  // this page only makes sense when a period has been selected on the connections page
  if (!selectedPeriod) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-lg font-semibold text-gray-900">No IP Data</h1>
        <p className="text-sm text-gray-500">No period data found.</p>
        <button onClick={handleBack}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
          ← Back to Connections
        </button>
      </div>
    );
  }

  // processIPData sorts by actions descending and applies the filter text if set
  const ipData = processIPData(selectedPeriod, filterIP);
  const totalIPs = Object.keys(selectedPeriod.ipCounts).length;

  return (
    <div className="p-3 md:p-6 w-full min-w-0">

      {/* header - back link, title, and period/type badges */}
      <div className="mb-5">
        <button onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 mb-3 text-sm font-medium">
          <FiArrowLeft className="w-4 h-4" /> Back to Connections
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <FiGlobe className="text-emerald-500 w-5 h-5 shrink-0" />
          <h1 className="text-xl md:text-2xl font-black text-gray-900">IP Breakdown</h1>
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
            {selectedPeriod.period}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2.5 py-1 rounded-full">
            {periodType.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {totalIPs} IPs · {selectedPeriod.total_actions?.toLocaleString()} total actions
        </p>
      </div>

      {/* search input - filters the ip list in real time via processIPData */}
      <div className="mb-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Filter IPs..."
            value={filterIP}
            onChange={e => setFilterIP(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* result count - shows how many ips are visible after filtering */}
      <div className="text-xs text-gray-500 mb-3">
        Showing <span className="font-semibold text-gray-700">{ipData.length}</span> of {totalIPs} IPs
        {filterIP && <span> · filtered by <span className="font-semibold">"{filterIP}"</span></span>}
      </div>

      <div className="bg-white rounded-xl shadow border border-emerald-100 overflow-hidden">
        {/* mobile card list - shown on small screens instead of the table */}
        <div className="md:hidden divide-y divide-gray-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 grid grid-cols-2 gap-2">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">IP Address</span>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-xs font-semibold text-white uppercase tracking-wider text-right">Actions</span>
              <span className="text-xs font-semibold text-white uppercase tracking-wider text-right">Users</span>
              <span className="text-xs font-semibold text-white uppercase tracking-wider text-right">%</span>
            </div>
          </div>
          {ipData.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">No IPs match your filter.</div>
          ) : (
            ipData.map((item, idx) => (
              <div key={item.ip} className="px-4 py-3 hover:bg-gray-50 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <span className="text-xs font-bold text-gray-400 shrink-0">#{idx + 1}</span>
                  {/* title attribute shows the full ip on hover in case it is truncated */}
                  <span className="font-mono text-xs text-gray-900 truncate" title={item.ip}>{item.ip}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pl-5">
                  <div>
                    <div className="text-gray-400 mb-0.5">Actions</div>
                    <div className="font-mono font-bold text-gray-900">{item.actions.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Users</div>
                    <div className="font-semibold text-gray-900">{item.users}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">% Total</div>
                    <div className="font-semibold text-emerald-700">{item.percent}%</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* desktop table - fixed column widths to keep the ip column from overflowing */}
        <table className="hidden md:table w-full table-fixed divide-y divide-gray-100 text-sm">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-24" />
          </colgroup>
          <thead className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider">#</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider">IP Address</th>
              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider">Users</th>
              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ipData.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No IPs match your filter.</td></tr>
            ) : (
              ipData.map((item, idx) => (
                <tr key={item.ip} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-400">#{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-gray-900 truncate" title={item.ip}>{item.ip}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{item.actions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{item.users}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{item.percent}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
        <p className="text-xs text-gray-400">
          IP breakdown for period: <strong>{selectedPeriod.period}</strong>
        </p>
        <button onClick={handleBack}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shrink-0">
          ← Back to Connections
        </button>
      </div>
    </div>
  );
}
