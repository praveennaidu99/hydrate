import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleWidgetUrl, syncWidgetData, WIDGET_DATA_KEY } from '../src/widgets/widget-sync.ts';
import { loadToday } from '../src/storage.ts';

describe('widget-sync.ts - Widget snapshot and deep link execution', () => {
  it('generates a clean snapshot with accurate percentages and formatted labels', async () => {
    const today = { date: new Date(), ml: 1250, goal: 2500 };
    const snapshot = await syncWidgetData(today, 'ml', 250);

    assert.equal(snapshot.todayMl, 1250);
    assert.equal(snapshot.goalMl, 2500);
    assert.equal(snapshot.pct, 0.5);
    assert.equal(snapshot.formattedToday, '1,250 ml');
    assert.equal(snapshot.formattedGoal, '2,500 ml');
    assert.equal(snapshot.quickAddLabel, '+250 ml');
  });

  it('formats snapshot in fluid ounces when unit is oz', async () => {
    const today = { date: new Date(), ml: 1250, goal: 2500 };
    const snapshot = await syncWidgetData(today, 'oz', 250);

    assert.equal(snapshot.unit, 'oz');
    assert.ok(snapshot.formattedToday.includes('fl oz'));
    assert.ok(snapshot.quickAddLabel.includes('fl oz'));
  });

  it('handles deep link hydrate://quick-add?ml=500 and updates intake', async () => {
    const before = await loadToday();
    const beforeMl = before.ml;

    const handled = await handleWidgetUrl('hydrate://quick-add?ml=500');
    assert.equal(handled, true);

    const after = await loadToday();
    assert.equal(after.ml, beforeMl + 500);
  });

  it('safely ignores irrelevant or malformed URLs', async () => {
    assert.equal(await handleWidgetUrl(null), false);
    assert.equal(await handleWidgetUrl('https://example.com'), false);
    assert.equal(await handleWidgetUrl('hydrate://other-action'), false);
    assert.equal(await handleWidgetUrl('hydrate://quick-add?ml=invalid'), false);
  });
});
