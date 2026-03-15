// full user roster with tier filter buttons, live search, sortable columns,
// and percentile rank - tiers are cohort-relative based on unique action count
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useActiveDataset } from "../contexts/useActiveDataset";
import { ordinal } from '../utils/userUtils';
import { FiArrowLeft, FiUsers, FiSearch, FiAlertTriangle, FiCheckCircle, FiActivity, FiStar } from 'react-icons/fi';

// tier order goes low to high - used to render filter buttons in a consistent order
const TIER_ORDER  = ['Low Engagement', 'Moderate Engagement', 'High Engagement', 'Highly Active'];
const TIER_COLORS = {
  'Highly Active':       { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  'High Engagement':     { badge: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500'  },
  'Moderate Engagement': { badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-400'    },
  'Low Engagement':      { badge: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500'   },
};
const TIER_ICON = {
  'Highly Active':       <FiStar className="w-3 h-3" />,
  'High Engagement':     <FiCheckCircle className="w-3 h-3" />,
  'Moderate Engagement': <FiActivity className="w-3 h-3" />,
  'Low Engagement':      <FiAlertTriangle className="w-3 h-3" />,
};
const TIER_SHORT = {
  'Highly Active': 'Active', 'High Engagement': 'High',
  'Moderate Engagement': 'Moderate', 'Low Engagement': 'Low',
};

export default function AllUsers() {
  const [searchParams] = useSearchParams();
  const { loading: contextLoading, activeDataset, allTime, allUsersWithTiers: allUsers } = useActiveDataset();

  const [search,     setSearch]     = useState('');
  // tier and sort can be pre-set via url params - the dashboard low engagement alert uses this
  const [tierFilter, setTierFilter] = useState(searchParams.get('tier') || 'all');
  const [sortBy,     setSortBy]     = useState(searchParams.get('sort') || 'unique_desc');

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!allTime)        return <div className="p-6 text-center text-sm text-gray-500">Computing...</div>;

  // apply tier filter first, then text search, then sort - all client-side
  const filtered = allUsers
    .filter(u => tierFilter === 'all' || u.tier === tierFilter)
    .filter(u => !search || u.user.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total_desc')      return b.total - a.total;
      if (sortBy === 'total_asc')       return a.total - b.total;
      if (sortBy === 'unique_desc')     return b.unique - a.unique;
      if (sortBy === 'unique_asc')      return a.unique - b.unique;
      if (sortBy === 'percentile_desc') return b.percentileRank - a.percentileRank;
      if (sortBy === 'percentile_asc')  return a.percentileRank - b.percentileRank;
      return 0;
    });

  // count per tier for the filter button labels - always counts against the full list, not the filtered one
  const tierCounts = TIER_ORDER.reduce((acc, t) => ({ ...acc, [t]: allUsers.filter(u => u.tier === t).length }), {});

  return (
    <div className="p-3 md:p-6 w-full min-w-0">
      <div className="mb-5">
        <Link to="/users" className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 mb-3 text-sm font-medium">
          <FiArrowLeft className="w-4 h-4" /> Back to User Analytics
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <FiUsers className="text-indigo-500 w-5 h-5 shrink-0" />
          <h1 className="text-xl md:text-2xl font-black text-gray-900">All Users</h1>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">{allUsers.length}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Tiers by percentile | Bottom 25% = Low | 25-75% = Moderate | 75-90% = High | Top 10% = Highly Active
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setTierFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${tierFilter === 'all' ? 'bg-gray-800 text-white shadow' : 'bg-white border border-gray-200 text-gray-600'}`}>
          All ({allUsers.length})
        </button>
        {TIER_ORDER.map(tier => {
          const tc = TIER_COLORS[tier];
          const active = tierFilter === tier;
          return (
            <button key={tier} onClick={() => setTierFilter(tier)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${active ? `${tc.badge} shadow ring-2 ring-offset-1 ring-current` : 'bg-white border border-gray-200 text-gray-600'}`}>
              {TIER_ICON[tier]}
              <span className="hidden sm:inline">{tier}</span>
              <span className="sm:hidden">{TIER_SHORT[tier]}</span>
              ({tierCounts[tier]})
            </button>
          );
        })}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="unique_desc">Unique - High to Low</option>
          <option value="unique_asc">Unique - Low to High</option>
          <option value="total_desc">Total - High to Low</option>
          <option value="total_asc">Total - Low to High</option>
          <option value="percentile_desc">Percentile - High to Low</option>
          <option value="percentile_asc">Percentile - Low to High</option>
        </select>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of {allUsers.length} users
        {tierFilter !== 'all' && <span> | <span className="font-semibold">{tierFilter}</span></span>}
      </div>
      <div className="bg-white rounded-xl shadow border border-indigo-100 overflow-hidden">
        {/* mobile card list - shown instead of the table on small screens */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0
            ? <div className="px-4 py-10 text-center text-sm text-gray-400">No users match your filters.</div>
            : filtered.map((u, i) => {
                const tc = TIER_COLORS[u.tier];
                return (
                  <div key={u.user} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 shrink-0">#{i+1}</span>
                        <Link to={`/users/${u.user}`} className="text-indigo-600 font-semibold text-sm truncate">{u.user}</Link>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${tc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                        {TIER_SHORT[u.tier]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><div className="text-gray-400 mb-0.5">Total</div><div className="font-mono font-bold text-gray-900">{u.total.toLocaleString()}</div></div>
                      <div><div className="text-gray-400 mb-0.5">Unique</div><div className="font-mono font-bold text-purple-700">{u.unique.toLocaleString()}</div></div>
                      <div><div className="text-gray-400 mb-0.5">Percentile</div><div className="font-semibold text-gray-700">{ordinal(u.percentileRank)}</div></div>
                    </div>
                  </div>
                );
              })}
        </div>
        {/* desktop table - fixed column widths stop the username column from pushing others out */}
        <table className="hidden md:table w-full divide-y divide-gray-100 table-fixed">
          <colgroup>
            <col className="w-12" /><col /><col className="w-32" /><col className="w-32" /><col className="w-24" /><col className="w-36" />
          </colgroup>
          <thead className="bg-indigo-500  text-white text-xs">
            <tr>
              <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider">#</th>
              <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider">User</th>
              <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider">Total</th>
              <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider">Unique</th>
              <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider">Percentile</th>
              <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No users match your filters.</td></tr>
              : filtered.map((u, i) => {
                  const tc = TIER_COLORS[u.tier];
                  return (
                    <tr key={u.user} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-gray-400">#{i+1}</td>
                      <td className="px-4 py-3"><Link to={`/users/${u.user}`} className="font-medium text-indigo-600 hover:text-indigo-800 text-sm truncate block">{u.user}</Link></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-sm text-gray-900">{u.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-sm text-purple-700">{u.unique.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-600">{ordinal(u.percentileRank)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tc.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />{u.tier}
                        </span>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Engagement tiers are cohort-relative - classifications reflect standing within this dataset only.
      </p>
    </div>
  );
}