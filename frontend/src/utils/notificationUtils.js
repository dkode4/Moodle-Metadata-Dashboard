// returns a single severity string for a dataset's alerts object -
// used to decide what colour/icon to show on the notifications badge
// 'error' takes priority over 'warning', and 'clean' means no issues at all
export function severityOf(alerts) {
  if (!alerts) return 'none';
  const { invalidRows = 0, warnings } = alerts;
  const missingDesc = warnings?.missingDescription || 0;
  if (invalidRows > 0) return 'error';
  if (missingDesc > 0) return 'warning';
  return 'clean';
}

// builds the list of notification items shown on the notifications page -
// each item has an id, severity, title, description, and a details array for the breakdown
// items are always returned with the summary at the end - the all-clean card is
// unshifted to the front only when there are no errors or warnings
export function buildNotifications(metrics) {
  if (!metrics) return [];
  const alerts = metrics.dataAlerts;
  const ipStats = metrics.ipStats;
  if (!alerts) return [];

  const items = [];
  const { invalidRows = 0, invalidReasons = {}, warnings = {} } = alerts;

  // invalid rows were rejected entirely during processing - group them into one card
  // and break down the reasons so the user knows which fields were missing
  if (invalidRows > 0) {
    items.push({
      id: 'invalid-summary',
      severity: 'error',
      title: `${invalidRows} invalid row${invalidRows !== 1 ? 's' : ''} found`,
      description: 'These rows were skipped during processing because they were missing required fields.',
      details: [
        invalidReasons.missingTime   && `Missing timestamp: ${invalidReasons.missingTime}`,
        invalidReasons.missingUser   && `Missing user: ${invalidReasons.missingUser}`,
        invalidReasons.badDateFormat  && `Bad date format: ${invalidReasons.badDateFormat}`,
        invalidReasons.missingEvent   && `Missing event name: ${invalidReasons.missingEvent}`,
      ].filter(Boolean),
    });
  }

  // rows with a missing description were still processed but unique-action fingerprinting
  // fell back to a row-number placeholder - list the affected row numbers up to 20
  if (warnings.missingDescription > 0) {
    const rowNums = alerts.missingDescriptionRows || [];
    items.push({
      id: 'missing-desc',
      severity: 'warning',
      title: `${warnings.missingDescription} row${warnings.missingDescription !== 1 ? 's' : ''} with missing description`,
      description: 'These rows were still processed, but unique-action tracking uses a row-number fallback instead of the description field.',
      details: rowNums.length > 0
        ? [`Affected rows: ${rowNums.length > 20 ? rowNums.slice(0, 20).join(', ') + ` ... and ${rowNums.length - 20} more` : rowNums.join(', ')}`]
        : [],
    });
  }

  // ip addresses that could not be parsed as valid ipv4 or ipv6 were stored as "Unknown" -
  // show a warning so the user knows the ip breakdown may be incomplete
  if (ipStats?.unknownIPs > 0) {
    items.push({
      id: 'unknown-ips',
      severity: 'warning',
      title: `${ipStats.unknownIPs} unknown or invalid IP${ipStats.unknownIPs !== 1 ? 's' : ''}`,
      description: `Out of ${ipStats.totalProcessed.toLocaleString()} IP entries, ${ipStats.unknownIPs.toLocaleString()} could not be parsed as valid IPv4/IPv6 addresses and were recorded as "Unknown".`,
      details: [
        `Valid IPs: ${ipStats.validIPs.toLocaleString()}`,
        `Unknown IPs: ${ipStats.unknownIPs.toLocaleString()}`,
      ],
    });
  }

  // the summary card is always included regardless of data quality
  items.push({
    id: 'summary',
    severity: 'info',
    title: 'Dataset processed successfully',
    description: `${alerts.totalRowsRead?.toLocaleString() || 0} total rows read. ${metrics.total_users?.toLocaleString() || 0} unique users identified.`,
    details: [
      `Total rows read: ${alerts.totalRowsRead?.toLocaleString()}`,
      `Invalid rows skipped: ${invalidRows}`,
      `Rows with missing description: ${warnings.missingDescription || 0}`,
      ipStats && `IP entries processed: ${ipStats.totalProcessed?.toLocaleString()}`,
    ].filter(Boolean),
  });

  // only add the all-clean card if there are genuinely no issues - it goes at the top
  if (invalidRows === 0 && (warnings.missingDescription || 0) === 0 && (ipStats?.unknownIPs || 0) === 0) {
    items.unshift({
      id: 'all-clean',
      severity: 'success',
      title: 'No data quality issues detected',
      description: 'All rows passed validation and all IP addresses were correctly parsed.',
      details: [],
    });
  }

  return items;
}
