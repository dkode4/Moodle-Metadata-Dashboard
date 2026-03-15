// unit tests for userUtils - covers ordinal formatting, user ranking,
// all-time aggregation, engagement tiers, breadth scoring, and summary generation

import {
  ordinal,
  getTopUsers,
  getAllTimeUserTotals,
  computeEngagementTier,
  getAllUsersWithTiers,
  computeBreadthScore,
  generateUserSummary
} from './userUtils';

// ordinal appends the correct english suffix to a number - used when displaying
// a user's percentile rank e.g. "ranked in the 42nd percentile"
describe('ordinal', () => {
  it('returns correct suffix for standard cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(24)).toBe('24th');
    expect(ordinal(100)).toBe('100th');
  });

  // 11, 12 and 13 always use -th in english regardless of their last digit -
  // this catches numbers like 111 and 312 where the tens digit is 1
  it('handles the 11th/12th/13th exception (th overrides st/nd/rd)', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(113)).toBe('113th');
    expect(ordinal(211)).toBe('211th');
    expect(ordinal(312)).toBe('312th');
  });
});


// getTopUsers picks the N most active users from a userTotals map and
// returns them sorted highest to lowest - used to populate leaderboard views
describe('getTopUsers', () => {
  const userTotals = { alice: 10, bob: 5, carol: 15 };

  it('returns top N users sorted by actions descending', () => {
    const top = getTopUsers(userTotals, 3);
    expect(top).toEqual([
      { user: 'carol', actions: 15 },
      { user: 'alice', actions: 10 },
      { user: 'bob',   actions: 5  },
    ]);
  });

  it('respects the limit and does not return extra users', () => {
    const top = getTopUsers(userTotals, 2);
    expect(top.length).toBe(2);
    expect(top[0].user).toBe('carol');
    expect(top[1].user).toBe('alice');
  });

  // when no limit is passed the function should fall back to 10 by default
  it('defaults to a limit of 10', () => {
    const many = {};
    for (let i = 0; i < 15; i++) many[`user${i}`] = i;
    expect(getTopUsers(many).length).toBe(10);
  });

  it('returns an empty array for empty input', () => {
    expect(getTopUsers({}, 2)).toEqual([]);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(getTopUsers(null,      5)).toEqual([]);
    expect(getTopUsers(undefined, 5)).toEqual([]);
  });
});


// getAllTimeUserTotals collapses all yearly period entries into a single
// all-time summary - used as the base for engagement and breadth calculations
describe('getAllTimeUserTotals', () => {
  // the main case - two yearly periods with array-format event counts [total, unique]
  // checks that totals are summed and unique counts use the running maximum
  it('aggregates yearly periods when countArr is an [total, unique] array', () => {
    const metrics = {
      all_periods: {
        yearly: [
          {
            userTotals:       { alice: 5 },
            userEventCounts:  { alice: { login: [5, 3] } },
            userHourBuckets:  { alice: { '00-03': 2 } },
          },
          {
            userTotals:       { alice: 7, bob: 4 },
            userEventCounts:  { alice: { login: [7, 4] }, bob: { logout: [4, 2] } },
            userHourBuckets:  { alice: { '06-09': 3 }, bob: { '00-03': 1 } },
          },
        ],
      },
    };
    const allTime = getAllTimeUserTotals(metrics);

    expect(allTime.userTotals.alice).toBe(12);
    expect(allTime.userTotals.bob).toBe(4);

    expect(allTime.userUniqueTotals.alice).toBe(7);
    expect(allTime.userUniqueTotals.bob).toBe(2);

    expect(allTime.userEventTotals.alice.login).toEqual([12, 7]);
    expect(allTime.userEventTotals.bob.logout).toEqual([4, 2]);

    expect(allTime.userHourTotals.alice['00-03']).toBe(2);
    expect(allTime.userHourTotals.alice['06-09']).toBe(3);
    expect(allTime.userHourTotals.bob['00-03']).toBe(1);

    expect(allTime.eventCounts.login).toBe(12);
    expect(allTime.eventCounts.logout).toBe(4);
    expect(allTime.hourBuckets['00-03']).toBe(3);
    expect(allTime.hourBuckets['06-09']).toBe(3);
  });

  // older data may store a plain number rather than [total, unique] -
  // the function should treat the scalar as both total and unique
  it('handles scalar countArr (number instead of [total, unique] array)', () => {
    const metrics = {
      all_periods: {
        yearly: [
          {
            userTotals:      { alice: 5 },
            userEventCounts: { alice: { login: 5 } },
            userHourBuckets: {},
          },
        ],
      },
    };
    const allTime = getAllTimeUserTotals(metrics);
    expect(allTime.userEventTotals.alice.login).toEqual([5, 5]);
    expect(allTime.userUniqueTotals.alice).toBe(5);
    expect(allTime.eventCounts.login).toBe(5);
  });

  // periods that only have some fields should not crash the aggregation -
  // missing keys are treated as empty and skipped
  it('tolerates periods with missing optional fields', () => {
    const metrics = {
      all_periods: {
        yearly: [
          { userTotals: { alice: 3 } },
          { userEventCounts: { bob: { read: [2, 1] } } },
        ],
      },
    };
    const allTime = getAllTimeUserTotals(metrics);
    expect(allTime.userTotals.alice).toBe(3);
    expect(allTime.userEventTotals.bob.read).toEqual([2, 1]);
  });
});


// computeEngagementTier ranks a user against the full cohort using unique action
// counts and assigns one of four tiers based on their percentile position
describe('computeEngagementTier', () => {
  // uses a 10-user cohort so each step is exactly 10 percentile points apart -
  // checks that the tier boundaries and colours are applied correctly
  it('assigns all four tiers with correct percentile ranks and colours', () => {
    const allTime = {
      userUniqueTotals: { a:10, b:9, c:8, d:7, e:6, f:5, g:4, h:3, i:2, j:1 },
    };

    const a = computeEngagementTier('a', allTime);
    const b = computeEngagementTier('b', allTime);
    const e = computeEngagementTier('e', allTime);
    const h = computeEngagementTier('h', allTime);

    expect(a).toMatchObject({ tier: 'Highly Active',       color: 'emerald', percentileRank: 90, userUnique: 10, cohortSize: 10 });
    expect(b).toMatchObject({ tier: 'High Engagement',     color: 'indigo',  percentileRank: 80 });
    expect(e).toMatchObject({ tier: 'Moderate Engagement', color: 'blue',    percentileRank: 50 });
    expect(h).toMatchObject({ tier: 'Low Engagement',      color: 'amber',   percentileRank: 20 });
  });

  // the desc string shown in the ui should include the user's ordinal rank
  it('desc field references the user\'s ordinal percentile', () => {
    const allTime = { userUniqueTotals: { alice: 10, bob: 0 } };
    const alice = computeEngagementTier('alice', allTime);
    expect(alice.desc).toContain('50th');
  });

  it('returns null for an empty cohort', () => {
    expect(computeEngagementTier('alice', { userUniqueTotals: {} })).toBeNull();
  });

  // with only one user there is nobody to rank against so percentile should be 0
  it('handles a single-user cohort', () => {
    const allTime = { userUniqueTotals: { solo: 5 } };
    const result  = computeEngagementTier('solo', allTime);
    expect(result.percentileRank).toBe(0);
    expect(result.tier).toBe('Low Engagement');
    expect(result.cohortSize).toBe(1);
  });

  // a user with no recorded actions should still get a result rather than crashing -
  // they are treated as having 0 unique actions and fall into low engagement
  it('handles a user absent from userUniqueTotals', () => {
    const allTime = { userUniqueTotals: { alice: 10, bob: 5 } };
    const result  = computeEngagementTier('ghost', allTime);
    expect(result.userUnique).toBe(0);
    expect(result.tier).toBe('Low Engagement');
    expect(result.cohortSize).toBe(2);
  });
});

// getAllUsersWithTiers builds the full user list shown in the users table -
// each entry includes the tier, percentile, and both total and unique action counts
describe('getAllUsersWithTiers', () => {
  it('returns every user with correctly calculated tier, percentile, total and unique', () => {
    const allTime = {
      userTotals:       { alice: 10, bob: 5 },
      userUniqueTotals: { alice: 10, bob: 5 },
    };
    const users = getAllUsersWithTiers(allTime);
    expect(users.length).toBe(2);

    const alice = users.find(u => u.user === 'alice');
    const bob   = users.find(u => u.user === 'bob');

    expect(alice).toMatchObject({ user: 'alice', total: 10, unique: 10, percentileRank: 50, tier: 'Moderate Engagement' });
    expect(bob  ).toMatchObject({ user: 'bob',   total: 5,  unique: 5,  percentileRank:  0, tier: 'Low Engagement'      });
  });

  // uses a 10-user cohort to push users a and b into the top two tier brackets
  it('correctly reaches the Highly Active (>=90th) and High Engagement (>=75th) tiers', () => {
    const allTime = {
      userTotals:       { a:100,b:80,c:50,d:40,e:30,f:20,g:10,h:5,i:3,j:1 },
      userUniqueTotals: { a:100,b:80,c:50,d:40,e:30,f:20,g:10,h:5,i:3,j:1 },
    };
    const users = getAllUsersWithTiers(allTime);
    const a = users.find(u => u.user === 'a');
    const b = users.find(u => u.user === 'b');
    expect(a.tier).toBe('Highly Active');
    expect(b.tier).toBe('High Engagement');
  });

  it('returns an empty array when there are no users', () => {
    expect(getAllUsersWithTiers({ userTotals: {}, userUniqueTotals: {} })).toEqual([]);
  });
});

// computeBreadthScore measures how varied a user's actions are relative to their
// total - a high score means they do many different things, a low score means repetition
describe('computeBreadthScore', () => {
  // alice has 8 unique out of 10 total = 80%, bob has 2/5 = 40%, average is 60%
  it('computes breadthScore and avgBreadthScore correctly', () => {
    const allTime = {
      userTotals:       { alice: 10, bob: 5 },
      userUniqueTotals: { alice: 8,  bob: 2 },
    };
    const result = computeBreadthScore('alice', allTime);
    expect(result.breadthScore).toBe(80);
    expect(result.avgBreadthScore).toBe(60);
  });

  it('label: Broad Explorer  when score >= 80', () => {
    const allTime = { userTotals: { u: 10 }, userUniqueTotals: { u: 8 } };
    const { breadth } = computeBreadthScore('u', allTime);
    expect(breadth.label).toBe('Broad Explorer');
    expect(breadth.color).toBe('emerald');
  });

  it('label: Above Average Breadth  when score >= avg + 10', () => {
    const allTime = {
      userTotals:       { u: 10, v: 10 },
      userUniqueTotals: { u: 7,  v: 1  },
    };
    const { breadth } = computeBreadthScore('u', allTime);
    expect(breadth.label).toBe('Above Average Breadth');
    expect(breadth.color).toBe('indigo');
  });

  it('label: Typical Engagement  when score is within avg +/- 10', () => {
    const allTime = {
      userTotals:       { u: 10, v: 10 },
      userUniqueTotals: { u: 5,  v: 5  },
    };
    const { breadth } = computeBreadthScore('u', allTime);
    expect(breadth.label).toBe('Typical Engagement');
    expect(breadth.color).toBe('blue');
  });

  it('label: Focused Learner  when score < avg - 10 but >= 30', () => {
    const allTime = {
      userTotals:       { u: 10, v: 10 },
      userUniqueTotals: { u: 3,  v: 9  },
    };
    const { breadth } = computeBreadthScore('u', allTime);
    expect(breadth.label).toBe('Focused Learner');
    expect(breadth.color).toBe('amber');
  });

  it('label: Highly Repetitive  when score < 30', () => {
    const allTime = {
      userTotals:       { u: 10, v: 10 },
      userUniqueTotals: { u: 2,  v: 9  },
    };
    const { breadth } = computeBreadthScore('u', allTime);
    expect(breadth.label).toBe('Highly Repetitive');
    expect(breadth.color).toBe('orange');
  });

  // a user with no actions at all should return 0 rather than NaN from 0/0
  it('handles zero total actions without dividing by zero', () => {
    const allTime = { userTotals: { alice: 0 }, userUniqueTotals: { alice: 0 } };
    const result  = computeBreadthScore('alice', allTime);
    expect(result.breadthScore).toBe(0);
  });
});

// generateUserSummary builds the plain-english bullet points shown on a user's
// profile page - each sentence covers a different aspect of their activity pattern
describe('generateUserSummary', () => {
  const baseAllTime = {
    userTotals:       { alice: 100, bob: 50 },
    userUniqueTotals: { alice: 80,  bob: 20 },
    userEventTotals:  { alice: { login: [100, 80] } },
    userHourTotals:   { alice: { '06-09': 60, '09-12': 40 } },
  };
  const consistentLast6 = Array(6).fill({ userTotals: { alice: 10 } });

  // sanity check - the output should always be a non-empty array of strings
  it('returns a non-empty array of strings', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 80, 50);
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.every(s => typeof s === 'string')).toBe(true);
  });

  // alice is the top user in a 2-user cohort so she ranks in the top 50% but not top 20%
  it('activity sentence: "above-average" when rank puts user in top 50% (not top 20%)', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 80, 50);
    expect(summary[0]).toContain('above-average');
    expect(summary[0]).toContain('100');
  });

  // 6-user cohort - alice has the highest count so she is in the top ~17% which crosses the 20% threshold
  it('activity sentence: "top 20%" when user is in the top 20th percentile', () => {
    const allTime6 = { ...baseAllTime, userTotals: { alice: 100 } };
    for (let i = 1; i <= 5; i++) allTime6.userTotals[`u${i}`] = i;
    const summary = generateUserSummary('alice', allTime6, consistentLast6, 80, 50);
    expect(summary[0]).toContain('top 20%');
  });

  // 26-user cohort - alice at the top is in roughly the top 4% which crosses the 5% threshold
  it('activity sentence: "top 5%" when user is in the top 5th percentile', () => {
    const allTime26 = { ...baseAllTime, userTotals: { alice: 100 } };
    for (let i = 1; i <= 25; i++) allTime26.userTotals[`u${i}`] = i;
    const summary = generateUserSummary('alice', allTime26, consistentLast6, 80, 50);
    expect(summary[0]).toContain('top 5%');
  });

  it('activity sentence: "below-average" when user is outside the top 50%', () => {
    const allTimeBelow = {
      ...baseAllTime,
      userTotals: { alice: 50, topuser: 100 },
    };
    const summary = generateUserSummary('alice', allTimeBelow, consistentLast6, 80, 50);
    expect(summary[0]).toContain('below-average');
  });

  // 06-09 accounts for 60% of alice's hours so it should be labelled as morning
  it('includes the peak hour label and correct percentage', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 80, 50);
    const timeSentence = summary.find(s => s.includes('morning'));
    expect(timeSentence).toBeDefined();
    expect(timeSentence).toContain('60%');
  });

  it('includes the top event name with correct total and unique counts', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 80, 50);
    const eventSentence = summary.find(s => s.includes('"login"'));
    expect(eventSentence).toBeDefined();
    expect(eventSentence).toContain('100');
    expect(eventSentence).toContain('80');
  });

  // alice's breadth score of 80 is 30 points above the cohort average of 50
  it('breadth sentence: broad exploratory when score > avg + 10', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 80, 50);
    const s = summary.find(sent => sent.includes('breadth score'));
    expect(s).toBeDefined();
    expect(s).toContain('80%');
    expect(s).toContain('50%');
    expect(s).toContain('broad exploratory');
  });

  // score of 20 is 30 points below average of 50 so the wording suggests revisiting content
  it('breadth sentence: revisit when score < avg - 10', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 20, 50);
    const s = summary.find(sent => sent.includes('breadth score'));
    expect(s).toBeDefined();
    expect(s).toContain('revisit');
  });

  it('breadth sentence: typical mix when score is within avg +/- 10', () => {
    const summary = generateUserSummary('alice', baseAllTime, consistentLast6, 50, 50);
    const s = summary.find(sent => sent.includes('breadth score'));
    expect(s).toBeDefined();
    expect(s).toContain('typical mix');
  });

  // trend is detected by comparing the first 3 months against the last 3
  it('trend: "increasing" when latter half of 6 months > 1.2x earlier half', () => {
    const last6 = [
      { userTotals: { alice:  5 } }, { userTotals: { alice:  5 } }, { userTotals: { alice:  5 } },
      { userTotals: { alice: 10 } }, { userTotals: { alice: 10 } }, { userTotals: { alice: 10 } },
    ];
    const summary = generateUserSummary('alice', baseAllTime, last6, 50, 50);
    expect(summary.some(s => s.includes('increasing'))).toBe(true);
  });

  it('trend: "declining" when latter half < 0.8x earlier half', () => {
    const last6 = [
      { userTotals: { alice: 10 } }, { userTotals: { alice: 10 } }, { userTotals: { alice: 10 } },
      { userTotals: { alice:  3 } }, { userTotals: { alice:  3 } }, { userTotals: { alice:  3 } },
    ];
    const summary = generateUserSummary('alice', baseAllTime, last6, 50, 50);
    expect(summary.some(s => s.includes('declining'))).toBe(true);
  });

  it('trend: "consistent" when halves are within 20% of each other', () => {
    const last6 = Array(6).fill({ userTotals: { alice: 10 } });
    const summary = generateUserSummary('alice', baseAllTime, last6, 50, 50);
    expect(summary.some(s => s.includes('consistent'))).toBe(true);
  });

  it('trend: "No activity" when user has zero actions in all 6 months', () => {
    const last6 = Array(6).fill({ userTotals: {} });
    const summary = generateUserSummary('alice', baseAllTime, last6, 50, 50);
    expect(summary.some(s => s.includes('No activity'))).toBe(true);
  });

  it('trend: "single month" when only one of the 6 months has activity', () => {
    const last6 = [
      { userTotals: { alice: 10 } },
      ...Array(5).fill({ userTotals: {} }),
    ];
    const summary = generateUserSummary('alice', baseAllTime, last6, 50, 50);
    expect(summary.some(s => s.includes('single month'))).toBe(true);
  });

  // if there are no hour buckets for the user the time-pattern sentence should be skipped entirely
  it('omits the time-pattern sentence when the user has no hour data', () => {
    const allTimeNoHours = {
      ...baseAllTime,
      userHourTotals: {},
    };
    const summary = generateUserSummary('alice', allTimeNoHours, consistentLast6, 80, 50);
    expect(summary.every(s => !s.includes('concentrated'))).toBe(true);
  });

  // if there are no event totals for the user the top-event sentence should be skipped entirely
  it('omits the top-event sentence when the user has no event data', () => {
    const allTimeNoEvents = {
      ...baseAllTime,
      userEventTotals: {},
    };
    const summary = generateUserSummary('alice', allTimeNoEvents, consistentLast6, 80, 50);
    expect(summary.every(s => !s.includes('"'))).toBe(true);
  });
});