import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePacedDose,
  hydrationSlots,
  IOS_LIMIT,
  SOUNDS,
  KINDS,
  scheduleAll,
  scheduleCustom,
  cancelReminder,
  listCustom,
  handleResponse,
} from '../src/notifications.ts';
import { DEFAULT_SETTINGS, type HydrationSettings, loadToday } from '../src/storage.ts';
import { __resetScheduled } from './mocks/expo-notifications.mjs';

describe('notifications.ts - hydrationSlots', () => {
  it('calculates expected slots for standard hourly schedule (8:00 to 22:00)', () => {
    const s: HydrationSettings = { ...DEFAULT_SETTINGS, startHour: 8, endHour: 22, intervalMin: 60 };
    const slots = hydrationSlots(s);
    assert.equal(slots.length, 15);
    assert.deepEqual(slots[0], { hour: 8, minute: 0 });
    assert.deepEqual(slots[1], { hour: 9, minute: 0 });
    assert.deepEqual(slots[14], { hour: 22, minute: 0 });
  });

  it('calculates expected slots for 2-hour intervals', () => {
    const s: HydrationSettings = { ...DEFAULT_SETTINGS, startHour: 9, endHour: 17, intervalMin: 120 };
    const slots = hydrationSlots(s);
    assert.equal(slots.length, 5); // 9:00, 11:00, 13:00, 15:00, 17:00
    assert.deepEqual(slots[0], { hour: 9, minute: 0 });
    assert.deepEqual(slots[4], { hour: 17, minute: 0 });
  });

  it('calculates fractional hours accurately (e.g. 45 min intervals)', () => {
    const s: HydrationSettings = { ...DEFAULT_SETTINGS, startHour: 8, endHour: 10, intervalMin: 45 };
    const slots = hydrationSlots(s);
    assert.equal(slots.length, 3);
    assert.deepEqual(slots[0], { hour: 8, minute: 0 });
    assert.deepEqual(slots[1], { hour: 8, minute: 45 });
    assert.deepEqual(slots[2], { hour: 9, minute: 30 });
  });

  it('caps slots at MAX_HYDRATION_SLOTS (36) to preserve iOS notification budget', () => {
    const s: HydrationSettings = { ...DEFAULT_SETTINGS, startHour: 6, endHour: 23, intervalMin: 15 };
    const slots = hydrationSlots(s);
    assert.equal(slots.length, 36);
  });
});

describe('notifications.ts - calculatePacedDose (Clinical Pacing)', () => {
  it('calculates portion per alert accurately for standard and high goals', () => {
    // 2500 ml over 10 alerts = 250 ml
    assert.equal(calculatePacedDose(2500, 10), 250);

    // 3000 ml over 15 alerts = 200 ml
    assert.equal(calculatePacedDose(3000, 15), 200);

    // 5000 ml (5L) over 16 alerts = ~310 ml
    assert.equal(calculatePacedDose(5000, 16), 310);

    // 5000 ml over 32 alerts (every 30m) = ~160 ml
    assert.equal(calculatePacedDose(5000, 32), 160);
  });

  it('bounds doses within clinical safety limits (50 ml min, 750 ml max)', () => {
    // Very low goal: clamped at 50 ml
    assert.equal(calculatePacedDose(200, 10), 50);

    // Extreme goal: clamped at 750 ml to protect kidney excretion rate
    assert.equal(calculatePacedDose(10000, 5), 750);
  });
});

describe('notifications.ts - Metadata & constants', () => {
  it('preserves the iOS budget limit constant at 64', () => {
    assert.equal(IOS_LIMIT, 64);
  });

  it('contains all 7 notification sound options with non-empty labels', () => {
    assert.equal(SOUNDS.length, 7);
    const soundValues = SOUNDS.map((s) => s.value);
    assert.ok(soundValues.includes('default'));
    assert.ok(soundValues.includes('drop'));
    assert.ok(soundValues.includes('bubble'));
    assert.ok(soundValues.includes('chime'));
    assert.ok(soundValues.includes('crystal'));
    assert.ok(soundValues.includes('bell'));
    assert.ok(soundValues.includes('stream'));
  });

  it('contains complete metadata for each reminder kind', () => {
    const expectedKinds = ['water', 'food', 'medicine', 'exercise', 'sleep', 'custom'] as const;
    for (const kind of expectedKinds) {
      const def = KINDS[kind];
      assert.ok(def, `Kind ${kind} must be defined`);
      assert.ok(def.emoji.length > 0);
      assert.ok(def.label.length > 0);
      assert.ok(def.title.length > 0);
      assert.ok(def.defaultMsg.length > 0);
    }
  });
});

describe('notifications.ts - Scheduling & response flows', () => {
  beforeEach(() => {
    __resetScheduled();
  });

  it('schedules hydration, goal checks, and review notifications when enabled', async () => {
    const s: HydrationSettings = { ...DEFAULT_SETTINGS, enabled: true, startHour: 8, endHour: 18, intervalMin: 60 };
    const count = await scheduleAll(s);
    assert.equal(count, 11); // 8:00 to 18:00 inclusive = 11 slots
  });

  it('schedules and cancels custom reminders', async () => {
    const id = await scheduleCustom({
      kind: 'medicine',
      message: 'Take vitamin D',
      mode: 'daily',
      sound: 'bell',
      hour: 9,
      minute: 30,
      days: [],
    });

    assert.ok(id.startsWith('custom-'));
    const list = await listCustom();
    assert.equal(list.length, 1);
    assert.equal(list[0].message, 'Take vitamin D');

    await cancelReminder(id);
    const afterCancel = await listCustom();
    assert.equal(afterCancel.length, 0);
  });

  it('handles notification response "drink" button by adding water intake', async () => {
    const todayBefore = await loadToday();
    const beforeMl = todayBefore.ml;

    const mockResponse: any = {
      actionIdentifier: 'drink',
      notification: {
        date: Date.now(),
        request: {
          identifier: 'test-hydration-notif',
          content: {
            title: 'Drink water',
            body: 'Time to drink',
            data: { kind: 'water' },
          },
        },
      },
    };

    await handleResponse(mockResponse);
    const todayAfter = await loadToday();
    assert.equal(todayAfter.ml, beforeMl + 250);
  });

  it('handles smart paced dose from notification data when user taps drink', async () => {
    const todayBefore = await loadToday();
    const beforeMl = todayBefore.ml;

    const mockResponse: any = {
      actionIdentifier: 'drink',
      notification: {
        date: Date.now(),
        request: {
          identifier: 'test-hydration-paced-notif',
          content: {
            title: 'Water Dose',
            body: 'Time for ~330 ml',
            data: { kind: 'water', pacedMl: 330 },
          },
        },
      },
    };

    await handleResponse(mockResponse);
    const todayAfter = await loadToday();
    assert.equal(todayAfter.ml, beforeMl + 330);
  });
});
