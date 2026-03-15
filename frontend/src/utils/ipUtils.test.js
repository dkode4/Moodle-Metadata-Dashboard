// unit tests for ipUtils - covers quartile calculation, ip data processing, and subnet extraction

import { quartile, processIPData, getSubnetPrefix } from './ipUtils';

// quartile computes a value at a given position in a sorted array using linear interpolation
describe('quartile', () => {
  it('returns 0 for empty array', () => {
    expect(quartile([], 0.5)).toBe(0);
  });

  it('returns value for single element', () => {
    expect(quartile([5], 0.5)).toBe(5);
  });

  // checks q=0 and q=1 for the boundaries, plus q1/median/q3 for the interpolated values
  // e.g. q1 of [1,2,3,4] -> pos = 3*0.25 = 0.75 -> interpolates between index 0 and 1
  it('computes correct value for multiple quantiles', () => {
    expect(quartile([1,2,3,4], 0)).toBe(1);
    expect(quartile([1,2,3,4], 1)).toBe(4);
    expect(quartile([1,2,3,4], 0.25)).toBe(1.75);
    expect(quartile([1,2,3,4], 0.5)).toBe(2.5);
    expect(quartile([1,2,3,4], 0.75)).toBe(3.25);
  });

  // q=0.33 lands between two indices so the result is interpolated - toBeCloseTo handles floating point
  it('handles non-integer quantiles', () => {
    expect(quartile([10, 20, 30, 40, 50], 0.33)).toBeCloseTo(23.2);
  });
});

// processIPData builds a sorted array of ip entries from a period's ip data -
// each entry includes the ip, action count, user count, and percentage share
describe('processIPData', () => {
  // shared test data - 3 ips (2 ipv4, 1 ipv6) with known counts adding up to 22 actions
  const periodData = {
    ipCounts: {
      '192.168.1.1': 10,
      '192.168.1.2': 5,
      'abcd:1234:5678:9abc:1:2:3:4': 7
    },
    ipUsers: {
      '192.168.1.1': ['a', 'b'],
      '192.168.1.2': ['c'],
      'abcd:1234:5678:9abc:1:2:3:4': ['d', 'e', 'f']
    },
    total_actions: 22
  };

  it('returns empty array if no ipCounts', () => {
    expect(processIPData({}, '', null)).toEqual([]);
    expect(processIPData({ ipCounts: undefined }, '', null)).toEqual([]);
  });

  // checks the sort order, percent calculation per entry, and that percents sum to 100
  it('returns sorted array by actions and asserts all percent values', () => {
    const result = processIPData(periodData);
    expect(result.length).toBe(3);
    expect(result[0].ip).toBe('192.168.1.1');
    expect(result[0].actions).toBe(10);
    expect(result[0].percent).toBe('45.5');
    expect(result[1].ip).toBe('abcd:1234:5678:9abc:1:2:3:4');
    expect(result[1].actions).toBe(7);
    expect(result[1].percent).toBe('31.8');
    expect(result[2].ip).toBe('192.168.1.2');
    expect(result[2].actions).toBe(5);
    expect(result[2].percent).toBe('22.7');
    const totalPercent = result.reduce((acc, r) => acc + parseFloat(r.percent), 0);
    expect(Math.round(totalPercent)).toBe(100);
  });

  // filtering by 'abcd' should only return the ipv6 entry - percent should still be calculated
  // against total_actions from the full period, not just the filtered subset
  it('filters by text and checks percent', () => {
    const result = processIPData(periodData, 'abcd');
    expect(result.length).toBe(1);
    expect(result[0].ip).toBe('abcd:1234:5678:9abc:1:2:3:4');
    expect(result[0].percent).toBe('31.8');
  });

  // limit of 2 should return only the top 2 by action count
  it('returns limited results and checks sorting', () => {
    const result = processIPData(periodData, '', 2);
    expect(result.length).toBe(2);
    expect(result[0].actions).toBeGreaterThanOrEqual(result[1].actions);
  });

  // when total_actions is 0 the function falls back to 1 as the denominator to avoid dividing by zero -
  // a single ip with any action count should come out as 100%
  it('calculates percent correctly for edge cases', () => {
    const result = processIPData(periodData);
    expect(result[0].percent).toBe('45.5');
    expect(result[1].percent).toBe('31.8');
    expect(result[2].percent).toBe('22.7');
    const pd = { ipCounts: { '1.2.3.4': 1 }, total_actions: 0 };
    const edgeResult = processIPData(pd);
    expect(edgeResult[0].percent).toBe('100.0');
    const pd2 = { ipCounts: { '1.2.3.4': 5 }, total_actions: 5 };
    const singleResult = processIPData(pd2);
    expect(singleResult[0].percent).toBe('100.0');
  });

  it('handles IPv6 addresses', () => {
    const result = processIPData(periodData);
    expect(result.some(r => r.ip.includes(':'))).toBe(true);
  });

  // filter matching should work regardless of the case the user types
  it('handles filterText case-insensitively', () => {
    const result = processIPData(periodData, 'ABCD');
    expect(result.length).toBe(1);
  });

  // ipUsers may not be present for every ip - missing entries should default to 0 users
  it('handles missing ipUsers gracefully', () => {
    const pd = { ipCounts: { '1.2.3.4': 1 }, total_actions: 1 };
    const result = processIPData(pd);
    expect(result[0].users).toBe(0);
  });

  // if total_actions is missing the function falls back to 1 as the denominator
  it('handles missing total_actions gracefully', () => {
    const pd = { ipCounts: { '1.2.3.4': 1 }, ipUsers: { '1.2.3.4': ['a'] } };
    const result = processIPData(pd);
    expect(result[0].percent).toBe('100.0');
  });
});

// getSubnetPrefix strips the host portion from an ip address for grouping by subnet -
// ipv4 keeps the first 3 octets, ipv6 keeps the first 4 groups
describe('getSubnetPrefix', () => {
  // 192.168.1.5 -> drops the last octet -> 192.168.1
  it('returns correct prefix for IPv4', () => {
    expect(getSubnetPrefix('192.168.1.5')).toBe('192.168.1');
  });

  // full ipv6 address -> keeps the first 4 colon-separated groups
  it('returns correct prefix for IPv6', () => {
    expect(getSubnetPrefix('abcd:1234:5678:9abc:1:2:3:4')).toBe('abcd:1234:5678:9abc');
  });

  // anything that doesn't match ipv4 or ipv6 format is returned unchanged
  it('returns input for invalid IP', () => {
    expect(getSubnetPrefix('not-an-ip')).toBe('not-an-ip');
    expect(getSubnetPrefix('')).toBe('');
  });
});
