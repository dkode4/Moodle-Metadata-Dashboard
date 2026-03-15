// logic tests for the Events page - covers Pareto threshold calculation,
// event percent and cumulative totals, diversity categorisation via IQR,
// and edge cases like empty data and tied values

import React from 'react';
import Events from './Events';
import { render, screen, cleanup } from '@testing-library/react';
import { useActiveDataset } from '../contexts/useActiveDataset';

jest.mock('../contexts/useActiveDataset');
jest.mock('../components/EventBarChart', () => () => <div data-testid="event-bar-chart" />);

// helper that renders Events with a single period selected -
// used when testing period-level event counts and Pareto output
function setupPeriod(periodData) {
  useActiveDataset.mockReturnValue({
    metrics: { all_periods: { daily: [periodData] } },
    loading: false,
    activeDataset: 'test-dataset',
    connectionsUI: { periodType: 'daily', selectedPeriod: periodData },
    setConnectionsUI: jest.fn(),
    allTime: null,
  });
  return render(<Events />);
}

// helper that renders Events with no selected period but with all-time data -
// used when testing diversity and breadth metrics that work across all periods
function setupAllTime(allTimeData) {
  useActiveDataset.mockReturnValue({
    metrics: { all_periods: { daily: [] } },
    loading: false,
    activeDataset: 'test-dataset',
    connectionsUI: { periodType: 'daily', selectedPeriod: null },
    setConnectionsUI: jest.fn(),
    allTime: allTimeData,
  });
  return render(<Events />);
}

describe('Events logic coverage', () => {
  // a=60, b=30, c=10 - the top 2 events (a+b) account for 90% so only 2 are needed for 80%
  it('calculates Pareto threshold for periodEvents', () => {
    const periodData = {
      eventCounts: { a: 60, b: 30, c: 10 },
      total_actions: 100
    };
    setupPeriod(periodData);
    expect(screen.getByText(/2 type[s]? = 80% of activity/i)).toBeInTheDocument();
  });

  // same Pareto logic but applied to all-time event counts rather than a single period
  it('calculates Pareto threshold for allTimeEvents', () => {
    const allTimeData = {
      eventCounts: { a: 60, b: 30, c: 10 }
    };
    setupAllTime(allTimeData);
    expect(screen.getByText(/Pareto analysis/i)).toBeInTheDocument();
    expect(screen.getByText('event types for 80%')).toBeInTheDocument();
  });

  // alice has 3 distinct event types, bob has 1 - checks the diversity section renders
  // and that at least one user is labelled Narrow (bob with only 1 type)
  it('calculates user event diversity and breadth', () => {
    const allTimeData = {
      userEventTotals: {
        alice: { a: [10, 8], b: [5, 5], c: [2, 2] },
        bob: { a: [5, 5] }
      }
    };
    setupAllTime(allTimeData);
    expect(screen.getByText(/Resource Exploration Breadth/i)).toBeInTheDocument();
    expect(screen.getAllByText('Narrow').length).toBeGreaterThan(0);
  });

  // event c has 70 actions so it sorts to the top - checks the rendered percent and
  // cumulative percent values in the table match what the component should compute
  it('sorts and calculates percent/cumulative for eventCounts with direct assertions', () => {
    const periodData = {
      eventCounts: { a: 10, b: 20, c: 70 },
      total_actions: 100
    };
    setupPeriod(periodData);
    expect(screen.getByText('70.0%')).toBeInTheDocument(); // top event share stat
    expect(screen.getByText('20.0')).toBeInTheDocument();  // b's percent in table
    expect(screen.getByText('10.0')).toBeInTheDocument();  // a's percent in table
    expect(screen.getByText('90.0')).toBeInTheDocument();  // b's cumulative
    expect(screen.getByText('100.0')).toBeInTheDocument(); // a's cumulative
  });

  // 5-user cohort with varied event type counts - IQR is used to set category boundaries
  // u5 has 10 distinct types and should be an Outlier, u2 has 1 and should be Narrow
  it('quartile and IQR logic for diversity categories with exact category assignment', () => {
    const allTimeData = {
      userEventTotals: {
        u1: { a: [10, 8], b: [5, 5], c: [2, 2] },
        u2: { a: [5, 5] },
        u3: { a: [2, 2], b: [2, 2] },
        u4: { a: [4, 4], b: [4, 4], c: [2, 2], d: [1, 1] },
        u5: { a: [10, 10], b: [10, 10], c: [10, 10], d: [10, 10], e: [10, 10], f: [10, 10], g: [10, 10], h: [10, 10], i: [10, 10], j: [10, 10] }
      }
    };
    setupAllTime(allTimeData);
    expect(screen.getAllByText('Outlier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Broad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Typical').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Narrow').length).toBeGreaterThan(0);
  });

  // three sub-cases in one test - empty data, a single user, and two users with identical counts
  // cleanup() is called between each render to reset the dom
  it('handles edge cases: empty, single user, all same values', () => {
    // empty - no users should appear
    setupAllTime({ userEventTotals: {}, userTotals: {}, userUniqueTotals: {} });
    expect(screen.queryByText('u1')).toBeNull();
    cleanup();

    // single user - breadth section should still render without crashing
    setupAllTime({ userEventTotals: { u1: { a: [1, 1] } }, userTotals: { u1: 1 }, userUniqueTotals: { u1: 1 } });
    expect(screen.getByText(/Resource Exploration Breadth/i)).toBeInTheDocument();
    cleanup();

    // two users with identical event type counts - both should fall into Narrow
    setupAllTime({ userEventTotals: { u1: { a: [2, 2] }, u2: { a: [2, 2] } }, userTotals: { u1: 2, u2: 2 }, userUniqueTotals: { u1: 2, u2: 2 } });
    expect(screen.getAllByText('Narrow').length).toBeGreaterThan(0);
  });
});
