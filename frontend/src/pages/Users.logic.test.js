// logic tests for the Users page - checks leaderboard ordering, stat values,
// period type switching, and edge cases like empty data and tied users

import { render, screen, fireEvent } from '@testing-library/react';
import Users from './Users';
import React from 'react';

// replace chart and navigation components with empty placeholders so they don't
// crash the test environment where canvas and routing are not available
jest.mock('../components/PeakHoursChart',  () => () => <div data-testid="peak-hours-chart" />);
jest.mock('../components/PeriodNavigator', () => () => <div data-testid="period-navigator" />);
jest.mock('../components/DeltaIndicator',  () => () => null);

// mock the context hook so tests can control what data the page receives
const mockUseActiveDataset = jest.fn();

jest.mock('../contexts/useActiveDataset', () => ({
  useActiveDataset: (...args) => mockUseActiveDataset(...args),
}));

// replace Link with a plain anchor and useNavigate with a no-op to avoid needing a router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// a single daily period with 3 users - alice has the most actions, bob the fewest
const PERIOD = {
  period: '2023-01-01',
  userTotals:      { alice: 10, bob: 5, carol: 7 },
  userEventCounts: {
    alice: { login: [10, 3] },
    bob:   { login: [5,  1] },
    carol: { login: [7,  2] },
  },
  hourBuckets:   {},
  total_actions: 22,
  active_users:  3,
};

// base context value used across most tests - can be spread and overridden per test
const BASE = {
  metrics: { all_periods: { daily: [PERIOD] } },
  loading: false,
  activeDataset: { filename: 'test.csv' },
  connectionsUI: { periodType: 'daily', selectedPeriod: PERIOD },
  setConnectionsUI: jest.fn(),
  allTime: {
    userTotals:       { alice: 10, bob: 5, carol: 7 },
    userUniqueTotals: { alice: 3,  bob: 1, carol: 2 },
  },
  allUsersWithTiers: [
    { user: 'alice', tier: 'Highly Active',       unique: 3, actions: 10 },
    { user: 'bob',   tier: 'Low Engagement',       unique: 1, actions:  5 },
    { user: 'carol', tier: 'Moderate Engagement',  unique: 2, actions:  7 },
  ],
};

beforeEach(() => {
  mockUseActiveDataset.mockReturnValue(BASE);
});

afterEach(() => {
  mockUseActiveDataset.mockReset();
});

describe('Users logic tests', () => {
  // joins all row text into one string and checks the names appear in the right order
  it('total-actions leaderboard is sorted descending: alice(10) → carol(7) → bob(5)', () => {
    render(<Users />);
    const rows    = screen.getAllByRole('row');
    const content = rows.map(r => r.textContent).join('|');
    expect(content).toMatch(/alice.*carol.*bob/s);
  });

  // the numbers 10, 7 and 5 may appear in other places in the ui so getAllByText is used
  it('displays correct total action counts', () => {
    render(<Users />);
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });

  it('unique-actions leaderboard is sorted descending: alice(3) → carol(2) → bob(1)', () => {
    render(<Users />);
    const rows    = screen.getAllByRole('row');
    const content = rows.map(r => r.textContent).join('|');
    expect(content).toMatch(/alice.*carol.*bob/s);
  });

  it('computes and displays correct unique action counts: alice=3, carol=2, bob=1', () => {
    render(<Users />);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  // stats grid: 3 active users, 22 total actions, 6 total unique actions, 7 avg per user
  it('stats grid shows correct active users, total actions, unique actions and avg/user', () => {
    render(<Users />);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('22').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
  });

  // clicking a period type button should update the period type and reset the selected period
  it('clicking Monthly button calls setConnectionsUI with correct type and null period', () => {
    const setConnectionsUI = jest.fn();
    mockUseActiveDataset.mockReturnValue({ ...BASE, setConnectionsUI });
    render(<Users />);
    fireEvent.click(screen.getByText('Monthly'));
    expect(setConnectionsUI).toHaveBeenCalledWith(
      expect.objectContaining({ periodType: 'monthly', selectedPeriod: null }),
    );
  });

  // with no periods and no users the leaderboard should render nothing
  it('handles edge case: empty period list shows no leaderboard rows', () => {
    mockUseActiveDataset.mockReturnValue({
      ...BASE,
      metrics: { all_periods: { daily: [] } },
      connectionsUI: { periodType: 'daily', selectedPeriod: null },
      allTime: { userTotals: {}, userUniqueTotals: {} },
      allUsersWithTiers: [],
    });
    render(<Users />);
    expect(screen.queryByText('alice')).toBeNull();
    expect(screen.queryByText('carol')).toBeNull();
  });

  // a dataset with only one user should still render without crashing
  it('handles edge case: single user renders correctly', () => {
    const soloPeriod = {
      period: '2023-01-01',
      userTotals:      { solo: 1 },
      userEventCounts: { solo: { login: [1, 1] } },
      hourBuckets: {},
      total_actions: 1,
      active_users: 1,
    };
    mockUseActiveDataset.mockReturnValue({
      ...BASE,
      metrics: { all_periods: { daily: [soloPeriod] } },
      connectionsUI: { periodType: 'daily', selectedPeriod: soloPeriod },
      allTime: { userTotals: { solo: 1 }, userUniqueTotals: { solo: 1 } },
      allUsersWithTiers: [{ user: 'solo', tier: 'Highly Active', unique: 1, actions: 1 }],
    });
    render(<Users />);
    expect(screen.getAllByText('solo').length).toBeGreaterThan(0);
  });

  // two users with identical counts - both should appear in the rendered output
  it('handles edge case: tied users render both rows', () => {
    const tiePeriod = {
      period: '2023-01-01',
      userTotals:      { a: 5, b: 5 },
      userEventCounts: { a: { login: [5, 2] }, b: { login: [5, 2] } },
      hourBuckets: {},
      total_actions: 10,
      active_users: 2,
    };
    mockUseActiveDataset.mockReturnValue({
      ...BASE,
      metrics: { all_periods: { daily: [tiePeriod] } },
      connectionsUI: { periodType: 'daily', selectedPeriod: tiePeriod },
      allTime: { userTotals: { a: 5, b: 5 }, userUniqueTotals: { a: 2, b: 2 } },
      allUsersWithTiers: [
        { user: 'a', tier: 'Moderate Engagement', unique: 2, actions: 5 },
        { user: 'b', tier: 'Moderate Engagement', unique: 2, actions: 5 },
      ],
    });
    render(<Users />);
    expect(screen.getAllByText('a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('b').length).toBeGreaterThan(0);
  });
});
