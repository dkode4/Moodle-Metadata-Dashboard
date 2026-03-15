// firebase and node core imports
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");
const csv = require("csv-parser");
const { isIPv4, isIPv6 } = require('net');

// initialise the firebase admin sdk and get a reference to the default storage bucket
admin.initializeApp();
const bucket = admin.storage().bucket();

// converts a date object to an iso-style string key in the format yyyy-mm-dd
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// cloud function entry point - callable from the react frontend
// configured with 2gib memory and a 540 second timeout to handle large csv files
exports.computeDatasetMetrics = onCall({
  region: "us-central1",
  memory: "2GiB",
  timeoutSeconds: 540,
}, async (request) => {

  // reject unauthenticated requests before any data is accessed
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { datasetId, userId } = request.data;
  const csvFolder = datasetId;

  // construct the firebase storage path where the csv file is stored
  const filePath = `userFiles/${userId}/${csvFolder}/${csvFolder}`;

  try {
    // check if a metrics.json already exists for this dataset - if so return it immediately
    // without reprocessing the csv
    const metricsRef = bucket.file(`userFiles/${userId}/${csvFolder}/metrics.json`);
    const [metricsExists] = await metricsRef.exists();
    if (metricsExists) {
      const [file] = await metricsRef.download();
      return {
        success: true,
        message: "Metrics already exist",
        metrics: JSON.parse(file.toString()),
      };
    }

    // verify the csv file exists before attempting to download it
    const csvFile = bucket.file(filePath);
    const [csvExists] = await csvFile.exists();
    if (!csvExists) {
      throw new HttpsError("not-found", `CSV file not found at ${filePath}`);
    }

    // download the csv to a temporary local directory for streaming processing
    const tempCsvPath = path.join(os.tmpdir(), `${datasetId}.csv`);
    await csvFile.download({ destination: tempCsvPath });

    // process the csv and compute all engagement metrics
    const results = await processCsv(tempCsvPath);

    // persist the computed metrics as metrics.json back to firebase storage
    await metricsRef.save(JSON.stringify(results, null, 2), {
      contentType: 'application/json',
      metadata: { cacheControl: 'public, max-age=3600' }
    });

    // remove the temporary csv file from the cloud function runtime once processing is done
    fs.unlinkSync(tempCsvPath);

    return {
      success: true,
      message: "Metrics computed successfully",
      metrics: results,
    };
  } catch (error) {
    console.error("Error in computeDatasetMetrics:", error);
    throw new HttpsError("internal", error.message);
  }
});

// streams the csv file row by row and accumulates engagement statistics across
// four temporal granularities: daily, weekly, monthly, yearly
async function processCsv(csvPath) {
  const dailyStats = new Map();
  const weeklyStats = new Map();
  const monthlyStats = new Map();
  const yearlyStats = new Map();

  // tracks all distinct users seen across the entire dataset
  const userSet = new Set();

  // arrays for storing rows that failed validation
  const invalidRows = [];
  const missingDescriptionRows = [];

  let rowCount = 0;

  // skip the header row on first iteration
  let firstRowSkipped = false;

  // data quality counters surfaced to the frontend via the notifications view
  const dataAlerts = {
    totalRowsRead: 0,
    invalidRows: 0,
    invalidReasons: {
      missingTime: 0,
      missingUser: 0,
      badDateFormat: 0,
      missingEvent: 0,
    },
    warnings: {
      missingDescription: 0,
    },
    missingDescriptionRows,
  };

  // ip-level summary counters
  let ipStats = {
    totalProcessed: 0,
    validIPs: 0,
    unknownIPs: 0
  };

  return new Promise((resolve, reject) => {
    // stream the csv incrementally - avoids loading the full file into memory at once
    fs.createReadStream(csvPath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        dataAlerts.totalRowsRead++;

        // skip the header row
        if (!firstRowSkipped) {
          firstRowSkipped = true;
          return;
        }

        // extract fields by zero-based column index matching the moodle csv export structure
        const timeStr = row['0'];
        const userName = String(row['1'] || '').trim();
        const ipRaw = row['8'];
        const eventName = String(row['5'] || '').trim();
        const description = String(row['6'] || '').trim();

        // hard failure: missing timestamp - row cannot be placed on any time axis
        if (!timeStr) {
          dataAlerts.invalidReasons.missingTime++;
          dataAlerts.invalidRows++;
          invalidRows.push({ row: dataAlerts.totalRowsRead, reason: 'missingTime', raw: row });
          return;
        }

        // hard failure: missing username - row cannot be attributed to any user
        if (!userName) {
          dataAlerts.invalidReasons.missingUser++;
          dataAlerts.invalidRows++;
          invalidRows.push({ row: dataAlerts.totalRowsRead, reason: 'missingUser', raw: row });
          return;
        }

        // hard failure: timestamp cannot be parsed - row has no usable date
        const date = parseDate(timeStr);
        if (!date) {
          dataAlerts.invalidReasons.badDateFormat++;
          dataAlerts.invalidRows++;
          invalidRows.push({ row: dataAlerts.totalRowsRead, reason: 'badDateFormat', timeStr, raw: row });
          return;
        }

        // hard failure: missing event name - row has no identifiable action type
        if (!eventName) {
          dataAlerts.invalidReasons.missingEvent++;
          dataAlerts.invalidRows++;
          invalidRows.push({ row: dataAlerts.totalRowsRead, reason: 'missingEvent', raw: row });
          return;
        }

        // soft warning: missing description degrades unique action tracking accuracy
        // the row is still processed but flagged
        if (!description) {
          dataAlerts.warnings.missingDescription++;
          missingDescriptionRows.push(dataAlerts.totalRowsRead);
        }

        // build a fingerprint to distinguish unique actions from repeated ones.
        // when description is present: eventName + description identifies the specific interaction.
        // when description is absent: a fallback using the row index ensures every missing-description
        // row is treated as unique, which may slightly inflate unique action counts.
        const actionFingerprint = description
          ? `${eventName}||${description}`
          : `${eventName}||__no_desc__${dataAlerts.totalRowsRead}`;

        // normalise the ip address - invalid or absent values are bucketed as 'unknown'
        const normalizedIP = normalizeIP(ipRaw);
        ipStats.totalProcessed++;
        if (normalizedIP !== 'Unknown') ipStats.validIPs++;
        else ipStats.unknownIPs++;

        // assign the event to a 3-hour bucket for peak hour analysis
        const hour = date.getHours();
        const hourBucket = getHourBucket(hour);

        rowCount++;
        userSet.add(userName);

        // accumulate stats into all four temporal period maps in a single pass
        const dayKey = toDateKey(date);
        updateStats(dailyStats, dayKey, userName, normalizedIP, eventName, hourBucket, actionFingerprint);

        const weekStart = getWeekStartDate(date);
        const weekKey = toDateKey(weekStart);
        updateStats(weeklyStats, weekKey, userName, normalizedIP, eventName, hourBucket, actionFingerprint);

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        updateStats(monthlyStats, monthKey, userName, normalizedIP, eventName, hourBucket, actionFingerprint);

        const yearKey = date.getFullYear().toString();
        updateStats(yearlyStats, yearKey, userName, normalizedIP, eventName, hourBucket, actionFingerprint);
      })
      .on('end', () => {
        // once streaming is complete, build the final serialisable results object
        const results = buildResults({
          dailyStats, weeklyStats, monthlyStats, yearlyStats,
          totalUsers: userSet.size,
          dataAlerts,
          invalidRows,
          ipStats
        });

        resolve(results);
      })
      .on('error', (err) => {
        console.error('CSV Stream Error:', err.message);
        reject(err);
      });
  });
}

// normalises an ip address field - trims whitespace, rejects placeholder values,
// and validates against ipv4 and ipv6 formats. returns 'unknown' for anything invalid.
function normalizeIP(ipRaw) {
  if (!ipRaw || typeof ipRaw !== 'string') return 'Unknown';
  const trimmed = ipRaw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '' || trimmed === 'NULL' || trimmed === 'null') {
    return 'Unknown';
  }
  return (isIPv4(trimmed) || isIPv6(trimmed)) ? trimmed : 'Unknown';
}

// maps an hour of the day to a 3-hour bucket label for activity pattern analysis
function getHourBucket(hour) {
  if (hour < 3) return '00-03';
  if (hour < 6) return '03-06';
  if (hour < 9) return '06-09';
  if (hour < 12) return '09-12';
  if (hour < 15) return '12-15';
  if (hour < 18) return '15-18';
  if (hour < 21) return '18-21';
  return '21-00';
}

// updates the stats entry for a given period key within a stats map.
// initialises the entry if it does not yet exist, then increments all
// relevant counters: total actions, ip counts, event counts, hour buckets,
// per-user totals, and per-user unique action tracking via the action fingerprint.
function updateStats(statsMap, key, userName, ip, eventName, hourBucket, actionFingerprint) {
  let stats = statsMap.get(key);
  if (!stats) {
    stats = {
      users: new Set(),
      actions: 0,
      ipCounts: {},
      ipUsers: {},
      eventCounts: {},
      hourBuckets: {},
      userTotals: {},
      userHourBuckets: {},
      userEventCounts: {},
      // internal set used only during processing to track which fingerprints have been seen 
      // stripped from the output before metrics.json is written
      _userEventSeen: {}
    };
    statsMap.set(key, stats);
  }

  stats.users.add(userName);
  stats.actions++;

  // track total actions originating from each ip address
  stats.ipCounts[ip] = (stats.ipCounts[ip] || 0) + 1;

  // track which users have been seen from each ip address
  if (!stats.ipUsers[ip]) stats.ipUsers[ip] = [];
  if (!stats.ipUsers[ip].includes(userName)) stats.ipUsers[ip].push(userName);

  stats.eventCounts[eventName] = (stats.eventCounts[eventName] || 0) + 1;
  stats.hourBuckets[hourBucket] = (stats.hourBuckets[hourBucket] || 0) + 1;
  stats.userTotals[userName] = (stats.userTotals[userName] || 0) + 1;

  stats.userHourBuckets[userName] = stats.userHourBuckets[userName] || {};
  stats.userHourBuckets[userName][hourBucket] = (stats.userHourBuckets[userName][hourBucket] || 0) + 1;

  stats.userEventCounts[userName] = stats.userEventCounts[userName] || {};

  // userEventCounts stores [totalCount, uniqueCount] per user per event type
  const prev = stats.userEventCounts[userName][eventName] || [0, 0];

  // check whether this specific fingerprint has been seen before for this user and event
  stats._userEventSeen[userName] = stats._userEventSeen[userName] || {};
  stats._userEventSeen[userName][eventName] = stats._userEventSeen[userName][eventName] || new Set();
  const isUnique = !stats._userEventSeen[userName][eventName].has(actionFingerprint);
  if (isUnique) stats._userEventSeen[userName][eventName].add(actionFingerprint);

  // increment total count always; increment unique count only if this is a new fingerprint
  stats.userEventCounts[userName][eventName] = [
    prev[0] + 1,
    prev[1] + (isUnique ? 1 : 0)
  ];
}

// parses a moodle-format timestamp string (dd/mm/yy, hh:mm:ss) into a js date object.
// returns null if the string does not match the expected format or produces an invalid date.
function parseDate(timeStr) {
  const match = timeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}),\s+(\d{1,2}):(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, d, m, y, H, M, S] = match.map(Number);
  const date = new Date(2000 + y, m - 1, d, H, M, S);
  return isNaN(date.getTime()) ? null : date;
}

// returns the monday of the week containing the given date,
// used to align weekly period keys consistently across the dataset
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// formats a week period as a human-readable label showing the monday and sunday dates
function formatWeekPeriod(startDate) {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(start.getDate() + 6);
  return `${toDateKey(start)} → ${toDateKey(end)}`;
}

// assembles the final results object from all four temporal stats maps.
// determines the date bounds of the dataset and expands them to clean month boundaries
// before delegating to buildPeriodResults for each granularity.
function buildResults({dailyStats, weeklyStats, monthlyStats, yearlyStats, totalUsers, dataAlerts, invalidRows, ipStats}) {
  const results = {
    total_users: totalUsers,
    all_periods: {},
    dataAlerts,
    invalidRows: invalidRows || [],
    ipStats
  };

  // extract all daily keys as date objects to determine the dataset's date range
  const dailyKeys = Array.from(dailyStats.keys())
    .map(k => {
      const [y, m, d] = k.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return isNaN(dateObj.getTime()) ? null : dateObj;
    })
    .filter(d => d !== null);

  // return empty period arrays if no valid rows were processed
  if (dailyKeys.length === 0) {
    results.all_periods = { daily: [], weekly: [], monthly: [], yearly: [] };
    return results;
  }

  // find the earliest and latest dates in the dataset
  const firstDate = new Date(Math.min(...dailyKeys.map(d => d.getTime())));
  const lastDate = new Date(Math.max(...dailyKeys.map(d => d.getTime())));

  // expand the range to cover full calendar months so charts have a clean time axis
  firstDate.setDate(1);
  lastDate.setMonth(lastDate.getMonth() + 1, 0);

  results.all_periods.daily = buildPeriodResults(dailyStats, firstDate, lastDate, totalUsers, 'day');
  results.all_periods.weekly = buildPeriodResults(weeklyStats, firstDate, lastDate, totalUsers, 'week');
  results.all_periods.monthly = buildPeriodResults(monthlyStats, firstDate, lastDate, totalUsers, 'month');
  results.all_periods.yearly = buildPeriodResults(yearlyStats, firstDate, lastDate, totalUsers, 'year');

  return results;
}

// iterates through every period between firstDate and lastDate at the given granularity.
// periods with no activity are filled with zero-value entries so the output always covers
// the full date range - this prevents gaps in time-series charts on the frontend.
function buildPeriodResults(statsMap, firstDate, lastDate, totalUsers, periodType) {
  const results = [];
  const cursor = new Date(firstDate);

  while (cursor <= lastDate) {
    let key, periodLabel;

    if (periodType === 'day') {
      key = toDateKey(cursor);
      periodLabel = key;
    } else if (periodType === 'week') {
      const weekStart = getWeekStartDate(cursor);
      key = toDateKey(weekStart);
      periodLabel = formatWeekPeriod(weekStart);
    } else if (periodType === 'month') {
      key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      periodLabel = key;
    } else if (periodType === 'year') {
      key = cursor.getFullYear().toString();
      periodLabel = key;
    }

    // destructure to strip _userEventSeen from the output - it is only needed during processing
    const { _userEventSeen, ...stats } = statsMap.get(key) || {
      users: new Set(),
      actions: 0,
      ipCounts: {},
      ipUsers: {},
      eventCounts: {},
      hourBuckets: {},
      userTotals: {},
      userHourBuckets: {},
      userEventCounts: {},
      _userEventSeen: {}
    };

    // calculate what percentage of the total cohort was active in this period
    const percent = totalUsers === 0 ? 0 : Math.round((stats.users.size / totalUsers) * 1000) / 10;

    results.push({
      period: periodLabel,
      start_date: key,
      active_users: stats.users.size,
      total_users: totalUsers,
      percent_active: percent,
      total_actions: stats.actions,
      ipCounts: stats.ipCounts,
      ipUsers: stats.ipUsers,
      total_unique_ips: Object.keys(stats.ipCounts).length,
      eventCounts: stats.eventCounts,
      hourBuckets: stats.hourBuckets,
      userTotals: stats.userTotals,
      userHourBuckets: stats.userHourBuckets,
      userEventCounts: stats.userEventCounts
    });

    // advance the cursor by the appropriate interval for this granularity
    if (periodType === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (periodType === 'week') cursor.setDate(cursor.getDate() + 7);
    else if (periodType === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else if (periodType === 'year') cursor.setFullYear(cursor.getFullYear() + 1);
  }

  return results;
}
