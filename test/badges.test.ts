import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_DEFINITIONS,
  evaluateBadges,
  checkAndUnlockBadges,
  getNextStreakBadge,
  loadUnlockedBadges,
} from '../src/badges.ts';
import { computeStats } from '../src/health.ts';
import type { DayRecord, DoneEntry } from '../src/storage.ts';
import mockAsyncStorage from './mocks/async-storage.mjs';

describe('badges.ts - Badge Definitions & Catalog', () => {
  it('contains at least 10 unique badges across streak, volume, and habit categories', () => {
    assert.ok(BADGE_DEFINITIONS.length >= 10);
    const ids = new Set(BADGE_DEFINITIONS.map((b) => b.id));
    assert.equal(ids.size, BADGE_DEFINITIONS.length);

    const categories = new Set(BADGE_DEFINITIONS.map((b) => b.category));
    assert.ok(categories.has('streak'));
    assert.ok(categories.has('volume'));
    assert.ok(categories.has('habit'));
  });
});

describe('badges.ts - evaluateBadges', () => {
  it('returns all badges as locked with 0 progress for empty history', () => {
    const badges = evaluateBadges([]);
    assert.equal(badges.length, BADGE_DEFINITIONS.length);
    for (const b of badges) {
      assert.equal(b.unlocked, false);
      assert.equal(b.progress, 0);
      assert.equal(b.currentValue, 0);
    }
  });

  it('unlocks 1-day streak badge when goal is met', () => {
    const day: DayRecord = { date: new Date(), ml: 2500, goal: 2000 };
    const badges = evaluateBadges([day]);

    const streak1 = badges.find((b) => b.id === 'streak-1');
    assert.ok(streak1);
    assert.equal(streak1.unlocked, true);
    assert.equal(streak1.progress, 1);

    const streak3 = badges.find((b) => b.id === 'streak-3');
    assert.ok(streak3);
    assert.equal(streak3.unlocked, false);
    assert.equal(streak3.currentValue, 1);
    assert.ok(Math.abs(streak3.progress - 1 / 3) < 0.01);
  });

  it('unlocks 3-day streak badge for 3 consecutive goal days', () => {
    const history: DayRecord[] = [
      { date: new Date('2026-11-20'), ml: 2000, goal: 2000 },
      { date: new Date('2026-11-21'), ml: 2100, goal: 2000 },
      { date: new Date('2026-11-22'), ml: 2200, goal: 2000 },
    ];
    const badges = evaluateBadges(history);

    const streak3 = badges.find((b) => b.id === 'streak-3');
    assert.ok(streak3);
    assert.equal(streak3.unlocked, true);
  });

  it('unlocks weekly and fortnight badges when streak requirements are met', () => {
    const history7: DayRecord[] = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(2026, 10, i + 1),
      ml: 2500,
      goal: 2000,
    }));
    const badges7 = evaluateBadges(history7);
    const weekly = badges7.find((b) => b.id === 'streak-7');
    assert.ok(weekly);
    assert.equal(weekly.unlocked, true);

    const history14: DayRecord[] = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(2026, 10, i + 1),
      ml: 2500,
      goal: 2000,
    }));
    const badges14 = evaluateBadges(history14);
    const fortnight = badges14.find((b) => b.id === 'streak-14');
    assert.ok(fortnight);
    assert.equal(fortnight.unlocked, true);
  });

  it('unlocks volume milestones based on cumulative intake', () => {
    // 5 days of 2500 ml = 12,500 ml total -> unlocks 10 L badge
    const history: DayRecord[] = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(2026, 10, i + 1),
      ml: 2500,
      goal: 2000,
    }));
    const badges = evaluateBadges(history);

    const vol10 = badges.find((b) => b.id === 'volume-10l');
    assert.ok(vol10);
    assert.equal(vol10.unlocked, true);
    assert.equal(vol10.currentValue, 12500);

    const vol50 = badges.find((b) => b.id === 'volume-50l');
    assert.ok(vol50);
    assert.equal(vol50.unlocked, false);
    assert.equal(vol50.progress, 0.25);
  });

  it('unlocks single day High Tide badge when a day hits 3,000 ml or more', () => {
    const history: DayRecord[] = [
      { date: new Date('2026-11-20'), ml: 1800, goal: 2000 },
      { date: new Date('2026-11-21'), ml: 3400, goal: 2000 },
    ];
    const badges = evaluateBadges(history);
    const highTide = badges.find((b) => b.id === 'best-single-day');
    assert.ok(highTide);
    assert.equal(highTide.unlocked, true);
    assert.equal(highTide.currentValue, 3400);
  });

  it('unlocks habit badges based on logged actions in doneLog', () => {
    const doneLog: DoneEntry[] = Array.from({ length: 6 }, (_, i) => ({
      kind: 'water',
      at: Date.now() - i * 60000,
    }));
    const badges = evaluateBadges([], doneLog);

    const habit5 = badges.find((b) => b.id === 'habits-5');
    assert.ok(habit5);
    assert.equal(habit5.unlocked, true);

    const habit25 = badges.find((b) => b.id === 'habits-25');
    assert.ok(habit25);
    assert.equal(habit25.unlocked, false);
    assert.equal(habit25.currentValue, 6);
  });
});

describe('badges.ts - getNextStreakBadge', () => {
  it('identifies next streak milestone and remaining days', () => {
    const nextFor0 = getNextStreakBadge(0);
    assert.ok(nextFor0);
    assert.equal(nextFor0.nextBadge.id, 'streak-1');
    assert.equal(nextFor0.neededDays, 1);

    const nextFor2 = getNextStreakBadge(2);
    assert.ok(nextFor2);
    assert.equal(nextFor2.nextBadge.id, 'streak-3');
    assert.equal(nextFor2.neededDays, 1);

    const nextFor5 = getNextStreakBadge(5);
    assert.ok(nextFor5);
    assert.equal(nextFor5.nextBadge.id, 'streak-7');
    assert.equal(nextFor5.neededDays, 2);

    const nextFor30 = getNextStreakBadge(30);
    assert.equal(nextFor30, null);
  });
});

describe('badges.ts - checkAndUnlockBadges with persistence', () => {
  beforeEach(async () => {
    await mockAsyncStorage.clear();
  });

  it('detects newly unlocked badges and persists them to storage', async () => {
    const history: DayRecord[] = [
      { date: new Date('2026-11-20'), ml: 2500, goal: 2000 },
      { date: new Date('2026-11-21'), ml: 2500, goal: 2000 },
      { date: new Date('2026-11-22'), ml: 2500, goal: 2000 },
    ];
    const { newBadges } = await checkAndUnlockBadges(history);
    assert.ok(newBadges.some((b) => b.id === 'streak-1'));
    assert.ok(newBadges.some((b) => b.id === 'streak-3'));

    const saved = await loadUnlockedBadges();
    assert.ok(saved['streak-1']);
    assert.ok(saved['streak-3']);

    // Calling again does not re-return already unlocked badges as new
    const secondCheck = await checkAndUnlockBadges(history);
    assert.equal(secondCheck.newBadges.length, 0);
  });
});

describe('health.ts - longestStreak calculation', () => {
  it('tracks longest streak even when current streak was broken', () => {
    const history: DayRecord[] = [
      { date: new Date('2026-11-15'), ml: 2000, goal: 2000 },
      { date: new Date('2026-11-16'), ml: 2000, goal: 2000 },
      { date: new Date('2026-11-17'), ml: 2000, goal: 2000 },
      { date: new Date('2026-11-18'), ml: 2000, goal: 2000 }, // 4 day streak
      { date: new Date('2026-11-19'), ml: 500, goal: 2000 }, // streak broken!
      { date: new Date('2026-11-20'), ml: 2000, goal: 2000 }, // new streak: 1 day
    ];
    const stats = computeStats(history);
    assert.equal(stats.streak, 1);
    assert.equal(stats.longestStreak, 4);
  });
});
