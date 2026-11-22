import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { emitDataChanged } from './events';
import {
  addIntake,
  HydrationSettings,
  loadSettings,
  loadToday,
  logDone,
  markProcessed,
  SoundName,
} from './storage';

// Identifier prefixes: every scheduled notification belongs to exactly one group.
const P = {
  hydration: 'hydration-',
  custom: 'custom-',
  goalCheck: 'goalcheck-',
  review: 'review-',
  snooze: 'snooze-',
};

// iOS allows max 64 pending notifications per app.
export const IOS_LIMIT = 64;
const MAX_HYDRATION_SLOTS = 36;
const SNOOZE_MIN = 10;
const DRINK_ML = 250;

// ---------- sounds ----------

export const SOUNDS: { value: SoundName; label: string }[] = [
  { value: 'default', label: '🔔 Default' },
  { value: 'drop', label: '💧 Drop' },
  { value: 'chime', label: '🎐 Chime' },
  { value: 'bell', label: '🛎️ Bell' },
];

// Android sounds are fixed per channel, so each sound gets its own channel.
const channelFor = (s: SoundName) => `rem-${s}`;
const soundFile = (s: SoundName) => (s === 'default' ? 'default' : `${s}.wav`);

// ---------- reminder kinds ----------

export type Kind = 'water' | 'food' | 'medicine' | 'exercise' | 'sleep' | 'custom';

export const KINDS: Record<Kind, { emoji: string; label: string; title: string; defaultMsg: string }> = {
  water: { emoji: '💧', label: 'Water', title: 'Drink water', defaultMsg: 'Time to drink a glass of water' },
  food: { emoji: '🥗', label: 'Healthy food', title: 'Healthy eating', defaultMsg: 'Eat something healthy: fruit, nuts or veggies' },
  medicine: { emoji: '💊', label: 'Medicine', title: 'Medicine time', defaultMsg: 'Take your tablet' },
  exercise: { emoji: '🏃', label: 'Exercise', title: 'Move your body', defaultMsg: 'Time to stretch or take a short walk' },
  sleep: { emoji: '😴', label: 'Sleep', title: 'Wind down', defaultMsg: 'Time to get ready for bed' },
  custom: { emoji: '✏️', label: 'Custom', title: 'Reminder', defaultMsg: 'Reminder' },
};

export type ReminderMode = 'in' | 'every' | 'at' | 'daily';

export interface CustomReminder {
  id: string; // base id (one reminder may own several scheduled notifications)
  kind: Kind;
  message: string;
  mode: ReminderMode;
  sound: SoundName;
  minutes?: number; // 'in' / 'every'
  at?: number; // 'at' (timestamp)
  hour?: number; // 'daily'
  minute?: number; // 'daily'
  days?: number[]; // 'daily': 1 = Sunday … 7 = Saturday; empty/all = every day
}

// ---------- setup ----------

// Show alerts even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let setupDone = false;

/** Channels + action buttons. Safe to call many times. */
export async function setupNotifications(askPermission = true): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!setupDone) {
    setupDone = true;
    if (Platform.OS === 'android') {
      await Promise.all(
        SOUNDS.map((s) =>
          Notifications.setNotificationChannelAsync(channelFor(s.value), {
            name: `Reminders (${s.label.replace(/^\S+\s/, '')} sound)`,
            // eslint-disable-next-line import/namespace -- exported at runtime via `export *`; the import plugin can't see it
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: s.value === 'default' ? 'default' : soundFile(s.value),
          }),
        ),
      );
    }
    // On Android the buttons work without opening the app (handled by the background task).
    const opensApp = Platform.OS === 'ios';
    await Notifications.setNotificationCategoryAsync('water', [
      { identifier: 'drink', buttonTitle: `Drank ${DRINK_ML} ml ✅`, options: { opensAppToForeground: opensApp } },
      { identifier: 'snooze', buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: { opensAppToForeground: opensApp } },
    ]);
    await Notifications.setNotificationCategoryAsync('task', [
      { identifier: 'done', buttonTitle: 'Done ✅', options: { opensAppToForeground: opensApp } },
      { identifier: 'snooze', buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: { opensAppToForeground: opensApp } },
    ]);
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !askPermission) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function content(
  title: string,
  body: string,
  sound: SoundName,
  category: 'water' | 'task' | null,
  data: Record<string, unknown>,
): Notifications.NotificationContentInput {
  return {
    title,
    body,
    sound: soundFile(sound),
    categoryIdentifier: category ?? undefined,
    data: { ...data, sound },
  };
}

// ---------- water reminders ----------

/** Times (hh:mm) between startHour and endHour, every intervalMin minutes. */
export function hydrationSlots(s: HydrationSettings): { hour: number; minute: number }[] {
  const slots: { hour: number; minute: number }[] = [];
  for (let t = s.startHour * 60; t <= s.endHour * 60 && slots.length < MAX_HYDRATION_SLOTS; t += s.intervalMin) {
    slots.push({ hour: Math.floor(t / 60), minute: t % 60 });
  }
  return slots;
}

const HYDRATION_MESSAGES = [
  'Time for a glass of water 💧',
  'Stay hydrated! Take a few sips 🚰',
  'Your body needs water, so drink up 💦',
  'Hydration check! Have some water 🥤',
  'A glass now keeps the afternoon headache away 🙂',
];

async function scheduleHydration(s: HydrationSettings) {
  await cancelByPrefix(P.hydration);
  if (!s.enabled) return 0;
  const slots = hydrationSlots(s);
  await Promise.all(
    slots.map((slot, i) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${P.hydration}${slot.hour}-${slot.minute}`,
        content: content('Drink water', HYDRATION_MESSAGES[i % HYDRATION_MESSAGES.length], s.waterSound, 'water', {
          kind: 'water',
        }),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
          channelId: channelFor(s.waterSound),
        },
      }),
    ),
  );
  return slots.length;
}

// ---------- "behind on water" warnings ----------

/**
 * Schedules an evening check for today and the next 3 days.
 * Today's text uses real numbers; it is rescheduled every time water is logged.
 */
export async function refreshGoalChecks(settings?: HydrationSettings) {
  if (Platform.OS === 'web') return;
  const s = settings ?? (await loadSettings());
  await cancelByPrefix(P.goalCheck);
  if (!s.enabled || !s.warnings) return;
  const today = await loadToday();
  const checkHour = Math.min(23, Math.max(s.startHour + 1, s.endHour - 2));
  for (let i = 0; i < 4; i++) {
    const at = new Date();
    at.setDate(at.getDate() + i);
    at.setHours(checkHour, 0, 0, 0);
    if (at.getTime() <= Date.now()) continue;
    let body: string;
    if (i === 0) {
      if (today.ml >= today.goal) continue;
      const left = today.goal - today.ml;
      body = `You've had ${today.ml} of ${today.goal} ml today. Drink ${left} ml more to reach your goal before bed.`;
    } else {
      body = "You haven't logged any water today. Skipping water causes headaches and tiredness, so drink a glass now.";
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `${P.goalCheck}${i}`,
      content: content('⚠️ Behind on your water goal', body, s.waterSound, 'water', { kind: 'water', warning: true }),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: channelFor(s.waterSound) },
    });
  }
}

// ---------- weekly / monthly review notifications ----------

async function scheduleReviews(s: HydrationSettings) {
  await cancelByPrefix(P.review);
  if (!s.reviews) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `${P.review}weekly`,
    content: content('📊 Your weekly hydration review', 'See how you did this week and what it means for your health.', 'chime', null, {
      kind: 'review',
      screen: 'insights',
      period: 'week',
    }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 19,
      minute: 0,
      channelId: channelFor('chime'),
    },
  });
  await Notifications.scheduleNotificationAsync({
    identifier: `${P.review}monthly`,
    content: content('🗓️ Your monthly health review', "Your month in water: trends, health risks and tips. Take a look!", 'chime', null, {
      kind: 'review',
      screen: 'insights',
      period: 'month',
    }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: 10,
      minute: 0,
      channelId: channelFor('chime'),
    },
  });
}

/** Re-creates every automatic notification from settings. Returns number of water reminders per day. */
export async function scheduleAll(s: HydrationSettings): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const count = await scheduleHydration(s);
  await refreshGoalChecks(s);
  await scheduleReviews(s);
  return count;
}

// ---------- custom reminders ----------

export async function scheduleCustom(r: Omit<CustomReminder, 'id'>): Promise<string> {
  const id = `${P.custom}${Date.now()}`;
  const info = KINDS[r.kind];
  const spec: CustomReminder = { ...r, id };
  const c = content(`${info.emoji} ${info.title}`, r.message, r.sound, r.kind === 'water' ? 'water' : 'task', {
    kind: r.kind,
    spec,
  });
  const channelId = channelFor(r.sound);
  const T = Notifications.SchedulableTriggerInputTypes;

  const pending = (await Notifications.getAllScheduledNotificationsAsync()).length;
  const needed = r.mode === 'daily' && r.days && r.days.length > 0 && r.days.length < 7 ? r.days.length : 1;
  if (Platform.OS === 'ios' && pending + needed > IOS_LIMIT) {
    throw new Error('Too many reminders scheduled. Delete some or set water reminders to a longer interval.');
  }

  switch (r.mode) {
    case 'at':
      if (!r.at || r.at <= Date.now()) throw new Error('Pick a date and time in the future.');
      await Notifications.scheduleNotificationAsync({ identifier: id, content: c, trigger: { type: T.DATE, date: r.at, channelId } });
      break;
    case 'in':
    case 'every': {
      const minutes = r.minutes ?? 0;
      if (!(minutes >= 1)) throw new Error('Minutes must be at least 1.');
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: c,
        trigger: { type: T.TIME_INTERVAL, seconds: Math.round(minutes * 60), repeats: r.mode === 'every', channelId },
      });
      break;
    }
    case 'daily': {
      const hour = r.hour ?? 9;
      const minute = r.minute ?? 0;
      if (needed === 1) {
        await Notifications.scheduleNotificationAsync({ identifier: id, content: c, trigger: { type: T.DAILY, hour, minute, channelId } });
      } else {
        await Promise.all(
          r.days!.map((weekday) =>
            Notifications.scheduleNotificationAsync({
              identifier: `${id}~${weekday}`,
              content: c,
              trigger: { type: T.WEEKLY, weekday, hour, minute, channelId },
            }),
          ),
        );
      }
      break;
    }
  }
  return id;
}

/** Pending custom reminders (fired one-time reminders disappear automatically). */
export async function listCustom(): Promise<CustomReminder[]> {
  if (Platform.OS === 'web') return [];
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const byId = new Map<string, CustomReminder>();
  for (const n of all) {
    if (!n.identifier.startsWith(P.custom)) continue;
    const base = n.identifier.split('~')[0];
    const spec = (n.content.data as { spec?: CustomReminder } | undefined)?.spec;
    if (spec && !byId.has(base)) byId.set(base, { ...spec, id: base });
  }
  return [...byId.values()].sort((a, b) => b.id.localeCompare(a.id));
}

export async function cancelReminder(baseId: string) {
  await cancelByPrefix(baseId);
}

export async function scheduledCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** Sends a sample notification in 2 seconds, to preview a sound. */
export async function sendTest(sound: SoundName) {
  await Notifications.scheduleNotificationAsync({
    identifier: `${P.snooze}test-${Date.now()}`,
    content: content('💧 Test reminder', 'This is how your reminders will look and sound.', sound, 'water', { kind: 'water', test: true }),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: channelFor(sound) },
  });
}

async function cancelByPrefix(prefix: string) {
  if (Platform.OS === 'web') return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// ---------- handling taps on notification buttons ----------

const handled = new Set<string>();

/**
 * Handles "Drank water", "Done" and "Snooze" buttons.
 * Called from the foreground listener AND the Android background task, so it de-duplicates.
 * Returns the screen to open (if any).
 */
export async function handleResponse(resp: Notifications.NotificationResponse): Promise<string | undefined> {
  const { request, date } = resp.notification;
  const data = (request.content.data ?? {}) as Record<string, unknown>;
  const key = `${request.identifier}@${date}@${resp.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  if (!(await markProcessed(key))) return;

  switch (resp.actionIdentifier) {
    case 'drink':
      await addIntake(DRINK_ML);
      await refreshGoalChecks();
      break;
    case 'done':
      await logDone(String(data.kind ?? 'custom'));
      break;
    case 'snooze': {
      const sound = (data.sound as SoundName) ?? 'default';
      await Notifications.scheduleNotificationAsync({
        identifier: `${P.snooze}${Date.now()}`,
        content: {
          title: request.content.title ?? 'Reminder',
          body: request.content.body ?? '',
          sound: soundFile(sound),
          categoryIdentifier: request.content.categoryIdentifier ?? undefined,
          data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: SNOOZE_MIN * 60,
          channelId: channelFor(sound),
        },
      });
      break;
    }
    default:
      return typeof data.screen === 'string' ? data.screen : data.kind === 'water' ? 'water' : undefined;
  }
  // Remove the notification from the tray after a button was used.
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
  emitDataChanged();
}
