// notifications page - shows data quality alerts for the active dataset including
// invalid row diagnostics, missing description warnings, and ip parsing issues
import { useActiveDataset } from '../contexts/useActiveDataset';
import { FiBell, FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiInfo, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useState } from 'react';
import { severityOf, buildNotifications } from '../utils/notificationUtils';

// expandable table showing the individual invalid rows from the dataset -
// collapsed by default to show 5 rows, expands to show up to 100
function InvalidRowsTable({ rows }) {
  const [expanded, setExpanded] = useState(false);
  if (!rows || rows.length === 0) return null;

  const display = expanded ? rows.slice(0, 100) : rows.slice(0, 5);

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2 hover:underline"
      >
        {expanded ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Collapse' : 'Expand'} invalid rows ({rows.length} total)
      </button>

      <div className="overflow-x-auto rounded-lg border border-red-200">
        <table className="w-full text-xs divide-y divide-red-100">
          <thead className="bg-red-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-red-800">Row #</th>
              <th className="px-3 py-2 text-left font-semibold text-red-800">Reason</th>
              {/* raw data column is hidden on mobile to save space */}
              <th className="px-3 py-2 text-left font-semibold text-red-800 hidden sm:table-cell">Raw Data (preview)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-50">
            {display.map((r, i) => (
              <tr key={i} className="hover:bg-red-50/50">
                <td className="px-3 py-2 font-mono text-gray-700">{r.row}</td>
                <td className="px-3 py-2">
                  {/* colour-coded badge per rejection reason */}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    r.reason === 'missingTime'    ? 'bg-orange-100 text-orange-700' :
                    r.reason === 'missingUser'    ? 'bg-amber-100 text-amber-700'  :
                    r.reason === 'badDateFormat'  ? 'bg-red-100 text-red-700'      :
                    r.reason === 'missingEvent'   ? 'bg-purple-100 text-purple-700':
                    'bg-gray-100 text-gray-700'
                  }`}>{r.reason}</span>
                </td>
                {/* show the first 4 non-empty field values as a pipe-separated preview */}
                <td className="px-3 py-2 font-mono text-gray-500 truncate max-w-[260px] hidden sm:table-cell" title={JSON.stringify(r.raw)}>
                  {r.raw ? Object.values(r.raw).filter(Boolean).slice(0, 4).join(' | ') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > display.length && (
        <p className="text-xs text-gray-400 mt-1.5">{expanded ? `Showing first 100 of ${rows.length}` : `Showing first 5 of ${rows.length}`}</p>
      )}
    </div>
  );
}

// colour and icon config keyed by severity level - used to style each notification card
const SEVERITY = {
  error:   { icon: FiAlertCircle,   border: 'border-red-200',    bg: 'bg-red-50',    iconColor: 'text-red-500',    titleColor: 'text-red-900',    badge: 'bg-red-100 text-red-700' },
  warning: { icon: FiAlertTriangle, border: 'border-amber-200',  bg: 'bg-amber-50',  iconColor: 'text-amber-500',  titleColor: 'text-amber-900',  badge: 'bg-amber-100 text-amber-700' },
  info:    { icon: FiInfo,          border: 'border-blue-200',   bg: 'bg-blue-50',   iconColor: 'text-blue-500',   titleColor: 'text-blue-900',   badge: 'bg-blue-100 text-blue-700' },
  success: { icon: FiCheckCircle,   border: 'border-emerald-200',bg: 'bg-emerald-50',iconColor: 'text-emerald-500',titleColor: 'text-emerald-900',badge: 'bg-emerald-100 text-emerald-700' },
};

export default function Notifications() {
  const { metrics, loading: contextLoading, activeDataset } = useActiveDataset();

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Loading...</div>;
  if (!activeDataset)  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">
      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <FiBell className="text-blue-500 w-5 h-5 shrink-0" /> Notifications
      </h1>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-sm text-gray-500">
        No active dataset selected. Upload and activate a dataset to see data quality alerts.
      </div>
    </div>
  );
  if (!metrics) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;

  const notifications = buildNotifications(metrics);
  // overall severity drives the badge shown next to the page title
  const severity = severityOf(metrics.dataAlerts);
  const invalidRows = metrics.invalidRows || [];

  return (
    <div className="p-3 md:p-6 flex flex-col gap-5 w-full min-w-0">

      {/* page title with a severity badge - only one badge is shown at a time */}
      <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2 text-gray-900">
        <FiBell className="text-blue-500 w-5 h-5 shrink-0" />
        Notifications
        {severity === 'error'   && <span className="ml-2 text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full">Issues found</span>}
        {severity === 'warning' && <span className="ml-2 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">Warnings</span>}
        {severity === 'clean'   && <span className="ml-2 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">All clear</span>}
      </h1>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200 flex items-center gap-2 flex-wrap">
        <span className="font-medium text-gray-700">Dataset:</span>
        <span className="font-mono">{activeDataset.filename}</span>
      </div>

      {/* notification cards - each card is styled by its severity via the SEVERITY lookup */}
      <div className="flex flex-col gap-4">
        {notifications.map(n => {
          const s = SEVERITY[n.severity];
          const Icon = s.icon;
          return (
            <div key={n.id} className={`bg-white rounded-lg shadow overflow-hidden border ${s.border}`}>
              <div className={`px-4 py-3 flex items-start gap-3 ${s.bg}`}>
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${s.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-sm font-semibold ${s.titleColor}`}>{n.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
                      {n.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{n.description}</p>
                </div>
              </div>
              {/* detail lines shown below the card header when details exist */}
              {n.details.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <ul className="flex flex-col gap-1">
                    {n.details.map((d, i) => (
                      <li key={i} className="text-xs text-gray-600">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* attach the expandable invalid rows table only to the invalid-summary card */}
              {n.id === 'invalid-summary' && invalidRows.length > 0 && (
                <div className="px-4 pb-4">
                  <InvalidRowsTable rows={invalidRows} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* static explainer card describing how each type of issue is handled during processing */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FiInfo className="w-4 h-4 text-blue-500 shrink-0" /> How Data Quality Is Assessed
          </h3>
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-600">Invalid rows</strong> - Rows missing a timestamp, username, valid date, or event name are skipped entirely and do not appear in your analytics.
          </p>
          <p className="text-xs text-gray-500">
            <strong className="text-gray-600">Missing descriptions</strong> - Rows with no description are still fully processed. However, unique-action tracking uses a per-row fallback ID
            instead of the description, meaning those interactions may each count as unique even if they represent the same underlying action.
          </p>
          <p className="text-xs text-gray-500">
            <strong className="text-gray-600">Unknown IPs</strong> - Entries that are empty, null, or not valid IPv4/IPv6 addresses are recorded as "Unknown" in IP analytics.
          </p>
        </div>
      </div>
    </div>
  );
}
