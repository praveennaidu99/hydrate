import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStats,
  issuesFor,
  CLINICAL_PACING_GUIDELINES,
  SHORT_TERM_ISSUES,
  LONG_TERM_ISSUES,
} from '../src/health.ts';
import { formatVolume, mlToOz, ozToMl, unitLabel } from '../src/units.ts';
import type { DayRecord } from '../src/storage.ts';

describe('health.ts - computeStats', () => {
  it('returns zeroed stats for empty history', () => {
    const stats = computeStats([]);
    assert.equal(stats.trackedDays, 0);
    assert.equal(stats.avgMl, 0);
    assert.equal(stats.avgPct, 0);
    assert.equal(stats.streak, 0);
    assert.equal(stats.missedStreak, 0);
    assert.equal(stats.level, 'poor');
    assert.equal(stats.best, undefined);
  });

  it('excludes an incomplete today from average so progress does not artificially drag it down', () => {
    const day1: DayRecord = { date: new Date('2026-11-20'), ml: 2500, goal: 2500 };
    const day2: DayRecord = { date: new Date('2026-11-21'), ml: 2500, goal: 2500 };
    // Today has only 500 ml logged so far, goal is 2500 ml
    const today: DayRecord = { date: new Date('2026-11-22'), ml: 500, goal: 2500 };

    const stats = computeStats([day1, day2, today]);
    assert.equal(stats.trackedDays, 2);
    assert.equal(stats.avgMl, 2500);
    assert.equal(stats.metDays, 2);
    assert.equal(stats.level, 'excellent');
  });

  it('includes today in average once goal is met', () => {
    const day1: DayRecord = { date: new Date('2026-11-20'), ml: 2000, goal: 2000 };
    const today: DayRecord = { date: new Date('2026-11-21'), ml: 2200, goal: 2000 };

    const stats = computeStats([day1, today]);
    assert.equal(stats.trackedDays, 2);
    assert.equal(stats.avgMl, 2100);
    assert.equal(stats.metDays, 2);
    assert.equal(stats.streak, 2);
    assert.equal(stats.level, 'excellent');
  });

  it('accurately calculates streak ending yesterday when today is still in progress', () => {
    const day1: DayRecord = { date: new Date('2026-11-18'), ml: 2500, goal: 2500 };
    const day2: DayRecord = { date: new Date('2026-11-19'), ml: 2500, goal: 2500 };
    const day3: DayRecord = { date: new Date('2026-11-20'), ml: 2500, goal: 2500 };
    const today: DayRecord = { date: new Date('2026-11-21'), ml: 300, goal: 2500 };

    const stats = computeStats([day1, day2, day3, today]);
    assert.equal(stats.streak, 3);
  });

  it('calculates missed streaks for consecutive days under 70% of goal', () => {
    const day1: DayRecord = { date: new Date('2026-11-18'), ml: 1000, goal: 2500 }; // 40%
    const day2: DayRecord = { date: new Date('2026-11-19'), ml: 1200, goal: 2500 }; // 48%
    const today: DayRecord = { date: new Date('2026-11-20'), ml: 500, goal: 2500 };

    const stats = computeStats([day1, day2, today]);
    assert.equal(stats.missedStreak, 2);
  });

  it('correctly tiers health level: excellent, good, fair, poor', () => {
    const makeDay = (ml: number, goal = 2000): DayRecord => ({ date: new Date(), ml, goal });

    assert.equal(computeStats([makeDay(2000)]).level, 'excellent'); // 100%
    assert.equal(computeStats([makeDay(1600)]).level, 'good'); // 80%
    assert.equal(computeStats([makeDay(1200)]).level, 'fair'); // 60%
    assert.equal(computeStats([makeDay(800)]).level, 'poor'); // 40%
  });
});

describe('health.ts - issuesFor and recommendations', () => {
  it('returns empty issues for excellent hydration', () => {
    const day: DayRecord = { date: new Date(), ml: 2500, goal: 2500 };
    const stats = computeStats([day]);
    const { short, long } = issuesFor(stats);
    assert.equal(short.length, 0);
    assert.equal(long.length, 0);
  });

  it('surfaces top 3 short term issues for good hydration', () => {
    const day: DayRecord = { date: new Date(), ml: 1600, goal: 2000 };
    const stats = computeStats([day]);
    const { short, long } = issuesFor(stats);
    assert.equal(short.length, 3);
    assert.equal(long.length, 0);
  });

  it('surfaces comprehensive issues including long term risks for poor hydration', () => {
    const day: DayRecord = { date: new Date(), ml: 600, goal: 2000 };
    const stats = computeStats([day]);
    const { short, long } = issuesFor(stats);
    assert.equal(short.length, SHORT_TERM_ISSUES.length);
    assert.equal(long.length, LONG_TERM_ISSUES.length);
  });

  it('defines clinical pacing guidelines for safe hourly kidney excretion', () => {
    assert.equal(CLINICAL_PACING_GUIDELINES.maxHourlyExcretionMl, 1000);
    assert.equal(CLINICAL_PACING_GUIDELINES.highIntakeThresholdMl, 4000);
    assert.ok(CLINICAL_PACING_GUIDELINES.highGoalNotice.includes('4.0 L'));
  });
});

describe('units.ts - Volume conversion and formatting', () => {
  it('converts between ml and US fluid ounces correctly', () => {
    assert.equal(Math.round(mlToOz(250)), 8);
    assert.equal(Math.round(mlToOz(500)), 17);
    assert.equal(Math.round(mlToOz(1000)), 34);

    assert.equal(ozToMl(8), 237);
    assert.equal(ozToMl(17), 503);
  });

  it('formats millilitres and fluid ounces with appropriate labels', () => {
    assert.equal(formatVolume(250, 'ml'), '250 ml');
    assert.equal(formatVolume(2500, 'ml', { compact: true }), '2.5 L');
    assert.equal(formatVolume(250, 'oz'), '8.5 fl oz');
    assert.equal(formatVolume(250, 'oz', { includeUnit: false }), '8.5');

    assert.equal(unitLabel('ml'), 'ml');
    assert.equal(unitLabel('oz'), 'fl oz');
    assert.equal(unitLabel('oz', true), 'oz');
  });
});
