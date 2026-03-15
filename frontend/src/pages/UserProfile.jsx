// individual user profile page - shows lifetime rankings, engagement tier,
// breadth score, top events, time-of-day patterns, and recent monthly trends
import { useParams, Link } from 'react-router-dom';
import { useActiveDataset } from "../contexts/useActiveDataset";
import { computeBreadthScore, generateUserSummary, computeEngagementTier, ordinal } from '../utils/userUtils';
import {
  FiArrowLeft, FiUser, FiAward, FiClock, FiTrendingUp,
  FiZap, FiActivity, FiBarChart2, FiFileText, FiAlertTriangle,
  FiCheckCircle, FiStar
} from 'react-icons/fi';
import { MdOutlineEmojiEvents } from 'react-icons/md';

export default function UserProfile() {
  const { userId } = useParams();
  const { loading: contextLoading, activeDataset, allTime, metrics } = useActiveDataset();

  // all-time total actions for this user and their rank across all users
  const userLifetimeActions  = allTime?.userTotals?.[userId] || 0;
  const totalLifetimeActions = Object.values(allTime?.userTotals || {}).reduce((a, b) => a + b, 0);
  const lifetimePercent      = totalLifetimeActions > 0 ? (userLifetimeActions / totalLifetimeActions * 100).toFixed(1) : 0;
  const allUsersByTotal      = Object.entries(allTime?.userTotals || {}).map(([u,a])=>({user:u,actions:Number(a)})).sort((a,b)=>b.actions-a.actions);
  const userRankTotal        = (allUsersByTotal.findIndex(u=>u.user===userId)+1)||0;

  // same as above but for unique actions - used for the second rank card at the top
  const userLifetimeUnique    = allTime?.userUniqueTotals?.[userId] || 0;
  const totalLifetimeUnique   = Object.values(allTime?.userUniqueTotals||{}).reduce((a,b)=>a+b,0);
  const lifetimeUniquePercent = totalLifetimeUnique>0?(userLifetimeUnique/totalLifetimeUnique*100).toFixed(1):0;
  const allUsersByUnique      = Object.entries(allTime?.userUniqueTotals||{}).map(([u,a])=>({user:u,actions:Number(a)})).sort((a,b)=>b.actions-a.actions);
  const userRankUnique        = (allUsersByUnique.findIndex(u=>u.user===userId)+1)||0;

  const userEvents  = allTime?.userEventTotals?.[userId] || {};
  const userHours   = allTime?.userHourTotals?.[userId]  || {};

  // take the last 6 monthly periods for the trend section at the bottom
  const last6Months = metrics?.all_periods?.monthly?.slice(-6) || [];

  // find the highest action count across the 6 months - used to highlight the peak month
  const peakActions = Math.max(...last6Months.map(p=>p.userTotals?.[userId]||0), 0);

  // compute all derived metrics up front so the jsx stays readable
  const { breadthScore, avgBreadthScore, breadth } = allTime
    ? computeBreadthScore(userId, allTime)
    : { breadthScore:0, avgBreadthScore:0, breadth:{label:'',desc:'',color:'blue'} };
  const engagementTier = allTime ? computeEngagementTier(userId, allTime) : null;
  const summary        = allTime ? generateUserSummary(userId, allTime, last6Months, breadthScore, avgBreadthScore) : [];

  if (contextLoading) return <div className="p-6 text-center text-sm text-gray-500">Computing metrics...</div>;
  if (!activeDataset)  return <div className="p-6 text-center text-sm text-gray-500">No active dataset selected...</div>;
  if (!allTime || !userLifetimeActions) return (
    <div className="p-6 text-center text-gray-500 max-w-md mx-auto">
      <FiUser className="inline w-8 h-8 mb-2" />
      <div className="text-sm mb-3">No activity found for this user</div>
      <Link to="/users" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">← Back to Users</Link>
    </div>
  );

  // returns a medal icon based on the user's percentage share of a given event -
  // gold for top contributors, silver for notable, bronze for minor
  const getMedalIcon = (p) => {
    if (p > 25) return <FiAward className="text-yellow-500 w-4 h-4 shrink-0" />;
    if (p > 15) return <FiAward className="text-gray-400 w-4 h-4 shrink-0" />;
    if (p > 5)  return <FiAward className="text-amber-600 w-4 h-4 shrink-0" />;
    return null;
  };

  // maps a 3-hour bucket key to a readable label with the time range appended
  const hourLabel = (b) => ({
    '00-03':'Late Night','03-06':'Early Morning','06-09':'Morning',
    '09-12':'Late Morning','12-15':'Afternoon','15-18':'Late Afternoon',
    '18-21':'Evening','21-00':'Night',
  }[b] ? `${{'00-03':'Late Night','03-06':'Early Morning','06-09':'Morning','09-12':'Late Morning','12-15':'Afternoon','15-18':'Late Afternoon','18-21':'Evening','21-00':'Night'}[b]} · ${b}` : b);

  // colour map keyed by breadth label colour - keeps the breadth card styling consistent
  const cm = {
    emerald:{bg:'bg-emerald-50',border:'border-emerald-200',text:'text-emerald-700',bar:'bg-emerald-400',badge:'bg-emerald-100 text-emerald-700'},
    indigo: {bg:'bg-indigo-50', border:'border-indigo-200', text:'text-indigo-700', bar:'bg-indigo-400', badge:'bg-indigo-100 text-indigo-700'},
    blue:   {bg:'bg-blue-50',   border:'border-blue-200',   text:'text-blue-700',   bar:'bg-blue-400',   badge:'bg-blue-100 text-blue-700'},
    amber:  {bg:'bg-amber-50',  border:'border-amber-200',  text:'text-amber-700',  bar:'bg-amber-400',  badge:'bg-amber-100 text-amber-700'},
    orange: {bg:'bg-orange-50', border:'border-orange-200', text:'text-orange-700', bar:'bg-orange-400', badge:'bg-orange-100 text-orange-700'},
  };
  const c = cm[breadth.color] || cm.blue;

  // colour and icon config per engagement tier - used to style the tier card
  const tierConfig = {
    'Highly Active':       {bg:'bg-emerald-50',border:'border-emerald-300',text:'text-emerald-800',badge:'bg-emerald-500',icon:<FiStar className="w-4 h-4"/>,         bar:'bg-emerald-400'},
    'High Engagement':     {bg:'bg-indigo-50', border:'border-indigo-300', text:'text-indigo-800', badge:'bg-indigo-500', icon:<FiCheckCircle className="w-4 h-4"/>,  bar:'bg-indigo-400'},
    'Moderate Engagement': {bg:'bg-blue-50',   border:'border-blue-300',   text:'text-blue-800',   badge:'bg-blue-500',   icon:<FiActivity className="w-4 h-4"/>,    bar:'bg-blue-400'},
    'Low Engagement':      {bg:'bg-amber-50',  border:'border-amber-300',  text:'text-amber-800',  badge:'bg-amber-500',  icon:<FiAlertTriangle className="w-4 h-4"/>,bar:'bg-amber-400'},
  };
  const tc = engagementTier ? tierConfig[engagementTier.tier] : null;

  // truncate long event names in the event leadership list
  const truncate = (s, n) => s.length > n ? s.slice(0,n)+'...' : s;

  return (
    <div className="p-3 md:p-6 w-full min-w-0">

      {/* header - avatar, username, and the two lifetime rank cards */}
      <div className="text-center mb-5">
        <Link to="/users" className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 mb-4 text-sm font-medium">
          <FiArrowLeft className="w-4 h-4" /> Back to Users
        </Link>
        <div className="w-16 h-16 md:w-20 md:h-20 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-xl mx-auto">
          <FiUser className="w-7 h-7 md:w-9 md:h-9 text-white" />
        </div>
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 break-all px-2">{userId}</h1>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch px-2">
          <div className="bg-white border border-indigo-200 rounded-xl px-4 py-3 shadow text-center flex-1 sm:flex-none sm:min-w-[180px]">
            <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Total Actions</div>
            <div className="text-lg md:text-2xl font-black text-gray-900">#{userRankTotal} · {userLifetimeActions.toLocaleString()}</div>
            <div className="mt-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full inline-block">{lifetimePercent}% of ALL TIME</div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl px-4 py-3 shadow text-center flex-1 sm:flex-none sm:min-w-[180px]">
            <div className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">Unique Actions</div>
            <div className="text-lg md:text-2xl font-black text-gray-900">#{userRankUnique} · {userLifetimeUnique.toLocaleString()}</div>
            <div className="mt-1.5 text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full inline-block">{lifetimeUniquePercent}% of ALL TIME</div>
          </div>
        </div>
      </div>

      {/* learner summary - plain sentences generated by generateUserSummary */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FiFileText className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-900">Learner Summary</h2>
          <span className="ml-auto text-xs text-gray-400 hidden sm:inline">All-time · last 6 months for trend</span>
        </div>
        <div className="space-y-1.5">
          {summary.map((s,i) => <p key={i} className="text-xs md:text-sm text-gray-700 leading-relaxed">{s}</p>)}
        </div>
      </div>

      {/* engagement tier card - shows percentile rank as a progress bar with tier boundary markers */}
      {engagementTier && tc && (
        <div className={`rounded-xl border-2 p-4 mb-5 ${tc.bg} ${tc.border}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${tc.badge}`}>{tc.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h2 className={`text-base font-black ${tc.text}`}>{engagementTier.tier}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${tc.badge}`}>Cohort-Relative</span>
              </div>
              <p className="text-xs text-gray-500">Based on unique interactions within the cohort</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-2xl font-black ${tc.text}`}>{ordinal(engagementTier.percentileRank)}</div>
              <div className="text-xs text-gray-400">percentile</div>
            </div>
          </div>
          {/* progress bar with vertical markers at the 25th, 75th and 90th percentile boundaries */}
          <div className="relative mb-2">
            <div className="w-full bg-black/10 rounded-full h-2.5 overflow-hidden">
              <div className={`h-2.5 ${tc.bar}`} style={{width:`${engagementTier.percentileRank}%`}} />
            </div>
            <div className="absolute top-0 left-1/4 h-2.5 w-0.5 bg-white/60" />
            <div className="absolute top-0 left-3/4 h-2.5 w-0.5 bg-white/60" />
            <div className="absolute top-0 left-[90%] h-2.5 w-0.5 bg-white/60" />
          </div>
          <div className="flex text-xs text-gray-400 mb-2">
            <span className="w-1/4">Low</span>
            <span className="w-1/2 text-center">Moderate</span>
            <span className="w-[15%] text-right">High</span>
            <span className="w-[10%] text-right">Top</span>
          </div>
          <p className={`text-xs font-medium ${tc.text}`}>{engagementTier.desc}</p>
          <p className="text-xs text-gray-400 mt-1">{engagementTier.userUnique.toLocaleString()} unique · cohort of {engagementTier.cohortSize}</p>
        </div>
      )}

      {/* breadth score card - bar fills to the user's score, avg shown for comparison */}
      <div className={`rounded-xl shadow border p-4 mb-6 ${c.bg} ${c.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <FiBarChart2 className={`w-4 h-4 ${c.text}`} />
          <h2 className={`text-sm font-bold ${c.text}`}>Engagement Breadth Score</h2>
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{breadth.label}</span>
        </div>
        <div className="w-full bg-black/10 rounded-full h-2.5 mb-2 overflow-hidden">
          <div className={`h-2.5 ${c.bar}`} style={{width:`${breadthScore}%`}} />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <span className={`text-2xl md:text-3xl font-black ${c.text}`}>{breadthScore}%</span>
            <span className="text-xs text-gray-500 ml-2">unique interactions</span>
          </div>
          <div className="text-xs text-gray-500">Avg: <span className="font-semibold text-gray-700">{avgBreadthScore}%</span></div>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">{breadth.desc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* event leadership - top 10 events sorted by total count, percentage is the user's
            share of that event across the entire cohort rather than just their own actions */}
        <div className="bg-white rounded-xl shadow border border-indigo-200 p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900">
            <MdOutlineEmojiEvents className="w-4 h-4 text-indigo-500" /> Event Leadership
          </h2>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
            {Object.entries(userEvents)
              .sort(([,a],[,b])=>(Array.isArray(b)?b[0]:b)-(Array.isArray(a)?a[0]:a))
              .slice(0,10)
              .map(([event, countArr]) => {
                const total   = Array.isArray(countArr) ? countArr[0] : countArr;
                const unique  = Array.isArray(countArr) ? countArr[1] : countArr;
                const evTotal = allTime.eventCounts[event] || 0;
                const pct     = evTotal > 0 ? ((total/evTotal)*100).toFixed(1) : 0;
                return (
                  <div key={event} className="p-3 bg-indigo-50 rounded-lg min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900 truncate" title={event}>{truncate(event,40)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {getMedalIcon(Number(pct))}
                        <span className="text-sm font-bold text-indigo-600">{pct}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-black text-gray-900">{total.toLocaleString()}</span>
                      <span className="text-gray-400">total</span>
                      <span className="font-bold text-purple-600">{unique.toLocaleString()}</span>
                      <span className="text-gray-400">unique</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* time patterns - top 8 hour buckets, bar width reflects percentage of lifetime actions */}
        <div className="bg-white rounded-xl shadow border border-indigo-200 p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900">
            <FiClock className="w-4 h-4 text-indigo-500" /> Time Patterns
          </h2>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
            {Object.entries(userHours).sort(([,a],[,b])=>b-a).slice(0,8).map(([bucket,count])=>{
              const pct      = userLifetimeActions > 0 ? ((count/userLifetimeActions)*100).toFixed(1) : 0;
              // clamp bar width to a minimum of 4% so very small values are still visible
              const barWidth = Math.max(4, Number(pct));
              return (
                <div key={bucket} className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-800">{hourLabel(bucket)}</span>
                    <span className="text-xs font-bold text-indigo-600">{pct}%</span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-1 mb-1 overflow-hidden">
                    <div className="bg-indigo-500 h-1" style={{width:`${Math.min(barWidth,100)}%`}} />
                  </div>
                  <div className="text-base font-black text-gray-900">{count.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* period trends - one card per month, highlights the month with the highest action count */}
      <div className="bg-white rounded-xl shadow border border-indigo-200 p-4">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-900">
          <FiTrendingUp className="w-4 h-4 text-indigo-500" /> Period Trends (Last 6 Months)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {last6Months.map(period => {
            const userActions = period.userTotals?.[userId] || 0;
            const userUnique  = Object.values(period.userEventCounts?.[userId]||{})
              .reduce((sum,c)=>sum+(Array.isArray(c)?c[1]:c),0);
            const isPeak = userActions > 0 && userActions === peakActions;
            return (
              <div key={period.start_date} className="p-3 rounded-xl border hover:shadow transition-all bg-gradient-to-br from-gray-50 to-indigo-50">
                <div className="text-xs text-gray-500 mb-1 truncate">{period.period}</div>
                <div className="text-xl font-black text-gray-900">{userActions.toLocaleString()}</div>
                <div className="text-sm font-bold text-purple-600 mb-2">{userUnique.toLocaleString()} <span className="text-xs font-normal text-gray-400">unique</span></div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className={`w-2 h-2 rounded-full ${isPeak?'bg-emerald-500':'bg-indigo-300'}`} />
                  <span className="font-medium text-gray-600">
                    {isPeak ? <><FiZap className="inline text-emerald-500 w-3 h-3 mr-0.5"/>Highest</> : userActions > 0 ? 'Active' : 'Quiet'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
