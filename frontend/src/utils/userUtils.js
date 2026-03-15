// converts a number to its english ordinal form e.g. 1 -> 1st, 11 -> 11th, 42 -> 42nd
// the lookup handles st/nd/rd and falls back to th for everything else
// modulo 100 is used first so that 11/12/13 always resolve to th before modulo 10 runs
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// returns the N most active users from a userTotals map sorted by action count descending
// defaults to a limit of 10 if none is provided
export function getTopUsers(userTotals, limit = 10) {
  return Object.entries(userTotals || {})
    .map(([user, actions]) => ({ user, actions: Number(actions) }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, limit);
}

// collapses all yearly period entries from metrics into a single all-time summary object
// userTotals and userUniqueTotals are summed across periods
// userEventTotals accumulates [total, unique] pairs per user per event type
// userHourTotals tracks action counts per user across 3-hour time windows
// eventCounts and hourBuckets are the cohort-wide equivalents of those two breakdowns
export function getAllTimeUserTotals(metrics) {
  const allTime = {
    userTotals: {},
    userUniqueTotals: {},
    userEventTotals: {},
    userHourTotals: {},
    eventCounts: {},
    hourBuckets: {}
  };

  metrics.all_periods.yearly.forEach(period => {
    Object.entries(period.userTotals || {}).forEach(([user, actions]) => {
      allTime.userTotals[user] = (allTime.userTotals[user] || 0) + actions;
    });

    Object.entries(period.userEventCounts || {}).forEach(([user, events]) => {
      Object.entries(events).forEach(([event, countArr]) => {
        // event counts may be stored as a plain number in older data or as [total, unique] -
        // normalise both formats so the rest of the code always works with an array
        const total  = Array.isArray(countArr) ? countArr[0] : countArr;
        const unique = Array.isArray(countArr) ? countArr[1] : countArr;

        allTime.userEventTotals[user] = allTime.userEventTotals[user] || {};
        const prev = allTime.userEventTotals[user][event] || [0, 0];
        allTime.userEventTotals[user][event] = [prev[0] + total, prev[1] + unique];

        allTime.userUniqueTotals[user] = (allTime.userUniqueTotals[user] || 0) + unique;
        allTime.eventCounts[event] = (allTime.eventCounts[event] || 0) + total;
      });
    });

    Object.entries(period.userHourBuckets || {}).forEach(([user, hours]) => {
      Object.entries(hours).forEach(([hourBucket, count]) => {
        allTime.userHourTotals[user] = allTime.userHourTotals[user] || {};
        allTime.userHourTotals[user][hourBucket] = (allTime.userHourTotals[user][hourBucket] || 0) + count;
        allTime.hourBuckets[hourBucket] = (allTime.hourBuckets[hourBucket] || 0) + count;
      });
    });
  });

  return allTime;
}

// ranks a single user against the full cohort using unique action counts
// percentile rank is the fraction of users who scored strictly below this user
// returns null if the cohort is empty
export function computeEngagementTier(userId, allTime) {
  const uniqueTotals = allTime?.userUniqueTotals || {};
  const allValues = Object.values(uniqueTotals).map(Number).sort((a, b) => a - b);
  const userUnique = uniqueTotals[userId] || 0;
  const n = allValues.length;

  if (n === 0) return null;

  // count how many users scored below this user to derive their percentile rank
  const below = allValues.filter(v => v < userUnique).length;
  const percentileRank = Math.round((below / n) * 100);

  let tier, color, desc;

  if (percentileRank >= 90) {
    tier  = 'Highly Active';
    color = 'emerald';
    desc  = `This user is in the top 10% of the cohort by unique interactions (${ordinal(percentileRank)} percentile).`;
  } else if (percentileRank >= 75) {
    tier  = 'High Engagement';
    color = 'indigo';
    desc  = `This user is in the top 25% of the cohort by unique interactions (${ordinal(percentileRank)} percentile).`;
  } else if (percentileRank >= 25) {
    tier  = 'Moderate Engagement';
    color = 'blue';
    desc  = `This user is within the middle 50% of the cohort by unique interactions (${ordinal(percentileRank)} percentile).`;
  } else {
    tier  = 'Low Engagement';
    color = 'amber';
    desc  = `This user is in the bottom 25% of the cohort by unique interactions (${ordinal(percentileRank)} percentile). This may indicate limited course resource exploration.`;
  }

  return { tier, color, percentileRank, userUnique, cohortSize: n, desc };
}

// builds the full user list with tiers for the users table -
// mirrors computeEngagementTier but processes all users in one pass to avoid
// re-sorting allValues on every individual call
export function getAllUsersWithTiers(allTime) {
  const uniqueTotals = allTime?.userUniqueTotals || {};
  const allValues    = Object.values(uniqueTotals).map(Number).sort((a, b) => a - b);
  const n            = allValues.length;

  return Object.keys(allTime?.userTotals || {}).map(user => {
    const total  = allTime.userTotals[user] || 0;
    const unique = uniqueTotals[user] || 0;
    const below  = allValues.filter(v => v < unique).length;
    const percentileRank = n > 0 ? Math.round((below / n) * 100) : 0;

    let tier;
    if (percentileRank >= 90)      tier = 'Highly Active';
    else if (percentileRank >= 75) tier = 'High Engagement';
    else if (percentileRank >= 25) tier = 'Moderate Engagement';
    else                           tier = 'Low Engagement';

    return { user, total, unique, percentileRank, tier };
  });
}

// breadth score is the ratio of unique actions to total actions expressed as a percentage -
// a score of 80 means 80% of this user's actions were distinct rather than repeated
// avgBreadthScore is the mean across all users and is used to contextualise the label
export function computeBreadthScore(userId, allTime) {
  const userTotal  = allTime?.userTotals?.[userId] || 0;
  const userUnique = allTime?.userUniqueTotals?.[userId] || 0;

  const breadthScore = userTotal > 0
    ? Math.round((userUnique / userTotal) * 100)
    : 0;

  const allScores = Object.keys(allTime?.userTotals || {}).map(user => {
    const t = allTime.userTotals[user] || 0;
    const u = allTime.userUniqueTotals[user] || 0;
    return t > 0 ? (u / t) * 100 : 0;
  });

  const avgBreadthScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // absolute thresholds (>= 80) are checked before the cohort-relative ones so a broad
  // explorer is always labelled correctly regardless of what the average happens to be
  const getBreadthLabel = (score, avg) => {
    if (score >= 80)          return { label: 'Broad Explorer',        desc: 'Interacts with a wide variety of distinct resources',                         color: 'emerald' };
    if (score >= avg + 10)    return { label: 'Above Average Breadth', desc: 'Explores more varied resources than most users',                              color: 'indigo'  };
    if (score >= avg - 10)    return { label: 'Typical Engagement',    desc: 'Mix of revisiting familiar resources and exploring new ones',                 color: 'blue'    };
    if (score >= 30)          return { label: 'Focused Learner',       desc: 'Tends to revisit and repeat interactions with fewer resources',               color: 'amber'   };
    return                           { label: 'Highly Repetitive',     desc: 'Most interactions are repeated - few distinct resources accessed',            color: 'orange'  };
  };

  return {
    breadthScore,
    avgBreadthScore,
    breadth: getBreadthLabel(breadthScore, avgBreadthScore),
  };
}

// builds an array of summary sentences describing this user's activity patterns -
// covers overall volume rank, peak activity window, top event type, breadth vs cohort,
// and recent 6-month trend
// last6Months is the array of the six most recent monthly period objects in ascending order
// breadthScore and avgBreadthScore are passed in pre-computed from computeBreadthScore
export function generateUserSummary(userId, allTime, last6Months, breadthScore, avgBreadthScore) {
  const sentences = [];

  const userLifetimeActions = allTime?.userTotals?.[userId] || 0;
  const userEvents          = allTime?.userEventTotals?.[userId] || {};
  const userHours           = allTime?.userHourTotals?.[userId]  || {};

  // rank this user by total actions against everyone else in the dataset
  const allUsersByTotal = Object.entries(allTime?.userTotals || {}).sort(([, a], [, b]) => b - a);
  const userRankTotal   = (allUsersByTotal.findIndex(([u]) => u === userId) + 1) || 0;
  const totalUserCount  = allUsersByTotal.length;

  const topPercent = totalUserCount > 0 ? (userRankTotal / totalUserCount) * 100 : 50;
  if (topPercent <= 5) {
    sentences.push(`This user is among the top 5% most active in the dataset, with ${userLifetimeActions.toLocaleString()} total actions recorded.`);
  } else if (topPercent <= 20) {
    sentences.push(`This user is in the top 20% by activity, with ${userLifetimeActions.toLocaleString()} total actions recorded.`);
  } else if (topPercent <= 50) {
    sentences.push(`This user has above-average activity, recording ${userLifetimeActions.toLocaleString()} total actions.`);
  } else {
    sentences.push(`This user has below-average activity relative to the dataset, with ${userLifetimeActions.toLocaleString()} total actions recorded.`);
  }

  // map each 3-hour bucket key to a human-readable time-of-day label
  const hourLabels = {
    '00-03': 'late night (00-03)', '03-06': 'early morning (03-06)',
    '06-09': 'morning (06-09)',    '09-12': 'late morning (09-12)',
    '12-15': 'afternoon (12-15)', '15-18': 'late afternoon (15-18)',
    '18-21': 'evening (18-21)',   '21-00': 'night (21-00)',
  };
  const topHour = Object.entries(userHours).sort(([, a], [, b]) => b - a)[0];
  if (topHour) {
    const timeLabel   = hourLabels[topHour[0]] || topHour[0];
    const timePercent = userLifetimeActions > 0 ? Math.round((topHour[1] / userLifetimeActions) * 100) : 0;
    sentences.push(`Their activity is most concentrated during the ${timeLabel}, accounting for ${timePercent}% of all recorded actions.`);
  }

  // sort events by total count - countArr may be [total, unique] or a plain number
  const topEvent = Object.entries(userEvents)
    .sort(([, a], [, b]) => (Array.isArray(b) ? b[0] : b) - (Array.isArray(a) ? a[0] : a))[0];
  if (topEvent) {
    const topTotal  = Array.isArray(topEvent[1]) ? topEvent[1][0] : topEvent[1];
    const topUnique = Array.isArray(topEvent[1]) ? topEvent[1][1] : topEvent[1];
    sentences.push(`Their most frequent activity type is "${topEvent[0]}", with ${topTotal.toLocaleString()} occurrences across ${topUnique.toLocaleString()} distinct interactions.`);
  }

  if (breadthScore >= avgBreadthScore + 10) {
    sentences.push(`With a breadth score of ${breadthScore}% (dataset average: ${avgBreadthScore}%), this user engages with a wider variety of resources than most, suggesting broad exploratory behaviour.`);
  } else if (breadthScore <= avgBreadthScore - 10) {
    sentences.push(`With a breadth score of ${breadthScore}% (dataset average: ${avgBreadthScore}%), this user tends to revisit the same resources repeatedly rather than exploring broadly.`);
  } else {
    sentences.push(`Their breadth score of ${breadthScore}% is close to the dataset average of ${avgBreadthScore}%, indicating a typical mix of revisiting familiar content and exploring new resources.`);
  }

  // trend is detected by comparing the total of the first 3 months to the last 3 -
  // a 20% swing in either direction is treated as a meaningful increase or decline
  const recentCounts = last6Months.map(p => p.userTotals?.[userId] || 0);
  const activeCounts = recentCounts.filter(c => c > 0);

  if (activeCounts.length === 0) {
    sentences.push(`No activity has been recorded for this user in the last 6 months of the dataset.`);
  } else if (activeCounts.length === 1) {
    sentences.push(`Activity in the last 6 months was limited to a single month.`);
  } else {
    const firstHalf  = recentCounts.slice(0, 3).reduce((a, b) => a + b, 0);
    const secondHalf = recentCounts.slice(3).reduce((a, b) => a + b, 0);
    if (secondHalf > firstHalf * 1.2) {
      sentences.push(`Over the last 6 months of the dataset, activity has been increasing, with more actions recorded in the latter period.`);
    } else if (secondHalf < firstHalf * 0.8) {
      sentences.push(`Over the last 6 months of the dataset, activity has been declining, with fewer actions recorded in the more recent period.`);
    } else {
      sentences.push(`Activity has remained relatively consistent across the last 6 months of the dataset.`);
    }
  }

  return sentences;
}
