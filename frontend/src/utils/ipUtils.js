// computes a quartile value from a pre-sorted array using linear interpolation
// q should be 0.25 for q1, 0.5 for median, or 0.75 for q3
export function quartile(sortedArr, q) {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  // if pos lands exactly on an index return that value, otherwise interpolate between neighbours
  return lo === hi ? sortedArr[lo] : sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (pos - lo);
}

// builds a sorted array of ip address entries from a period's ipCounts data
// each entry includes the ip, total actions, number of distinct users, and percentage share of period actions
// optionally filters by a search string and caps results to a limit
export function processIPData(periodData, filterText = '', limit = null) {
  if (!periodData?.ipCounts) return [];

  const ipData = Object.entries(periodData.ipCounts)
    .map(([ip, actions]) => ({
      ip,
      actions,
      // default to 0 if ipUsers entry is missing for this ip
      users: periodData.ipUsers?.[ip]?.length || 0,
      percent: ((actions / (periodData.total_actions || 1)) * 100).toFixed(1)
    }))
    .sort((a, b) => b.actions - a.actions)
    .filter(item =>
      item.ip.toLowerCase().includes(filterText.toLowerCase()) || filterText === ''
    );

  return limit ? ipData.slice(0, limit) : ipData;
}

// extracts the subnet prefix from an ip address for grouping purposes
// for ipv4 returns the first three octets e.g. 192.168.1
// for ipv6 returns the first four groups e.g. abcd:1234:5678:9abc
// returns the input unchanged if it does not match either format
export function getSubnetPrefix(ip) {
  if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.');
  if (ip.includes(':')) {
    const groups = ip.split(':').filter(g => g);
    return groups.slice(0, 4).join(':');
  }
  return ip;
}
