import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VolumeUnit } from './units';

export type { VolumeUnit };
export type SoundName = 'default' | 'drop' | 'bubble' | 'chime' | 'crystal' | 'bell' | 'stream';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface HydrationSettings {
  enabled: boolean;
  goalMl: number;
  intervalMin: number;
  startHour: number; // first reminder of the day (0-23)
  endHour: number; // last reminder of the day (0-23)
  warnings: boolean; // "behind on water" alerts
  reviews: boolean; // weekly + monthly review notifications
  waterSound: SoundName;
  unit: VolumeUnit;
  quickAmounts: [number, number, number]; // in ml
  smartPacing: boolean; // calculate medical pacing portion per alert
  taperBeforeBed: boolean; // taper large doses before sleep
}

export const DEFAULT_SETTINGS: HydrationSettings = {
  enabled: false,
  goalMl: 2500,
  intervalMin: 60,
  startHour: 8,
  endHour: 22,
  warnings: true,
  reviews: true,
  waterSound: 'drop',
  unit: 'ml',
  quickAmounts: [150, 250, 500],
  smartPacing: true,
  taperBeforeBed: true,
};

const SETTINGS_KEY = 'hydration-settings';
const THEME_KEY = 'theme-mode';
const FIRST_DAY_KEY = 'first-day';
const DONE_LOG_KEY = 'done-log';
const PROCESSED_KEY = 'processed-responses';

// ---------- settings ----------

export async function loadSettings(): Promise<HydrationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      unit: parsed.unit === 'oz' ? 'oz' : 'ml',
      smartPacing: parsed.smartPacing ?? DEFAULT_SETTINGS.smartPacing,
      taperBeforeBed: parsed.taperBeforeBed ?? DEFAULT_SETTINGS.taperBeforeBed,
      quickAmounts:
        Array.isArray(parsed.quickAmounts) && parsed.quickAmounts.length === 3
          ? parsed.quickAmounts
          : DEFAULT_SETTINGS.quickAmounts,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: HydrationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function loadThemeMode(): Promise<ThemeMode> {
  const v = await AsyncStorage.getItem(THEME_KEY).catch(() => null);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export async function saveThemeMode(m: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, m);
}

// ---------- water intake (one record per day) ----------

export interface DayRecord {
  date: Date;
  ml: number;
  goal: number;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `intake-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function parseDay(raw: string | null, date: Date, fallbackGoal: number): DayRecord {
  if (!raw) return { date, ml: 0, goal: fallbackGoal };
  // v1 stored a plain number, v2 stores {ml, goal}
  if (/^\d+$/.test(raw)) return { date, ml: Number(raw), goal: fallbackGoal };
  try {
    const j = JSON.parse(raw);
    return { date, ml: Number(j.ml) || 0, goal: Number(j.goal) || fallbackGoal };
  } catch {
    return { date, ml: 0, goal: fallbackGoal };
  }
}

export async function loadToday(): Promise<DayRecord> {
  const s = await loadSettings();
  const today = startOfDay(new Date());
  return parseDay(await AsyncStorage.getItem(dayKey(today)), today, s.goalMl);
}

/** Adds (or removes, if negative) water for today. Returns the new total. */
export async function addIntake(deltaMl: number): Promise<DayRecord> {
  const s = await loadSettings();
  const cur = await loadToday();
  const next = { ...cur, ml: Math.max(0, cur.ml + deltaMl), goal: s.goalMl };
  await AsyncStorage.setItem(dayKey(next.date), JSON.stringify({ ml: next.ml, goal: next.goal }));
  return next;
}

/** Last `days` days (oldest first, ending today). Days before first use are excluded. */
export async function loadHistory(days: number): Promise<DayRecord[]> {
  const s = await loadSettings();
  const first = await getFirstDay();
  const today = startOfDay(new Date());
  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d >= first) dates.push(d);
  }
  const rows = await AsyncStorage.multiGet(dates.map(dayKey));
  return rows.map(([, raw], i) => parseDay(raw, dates[i], s.goalMl));
}

export async function getFirstDay(): Promise<Date> {
  const raw = await AsyncStorage.getItem(FIRST_DAY_KEY);
  if (raw) return new Date(Number(raw));
  const today = startOfDay(new Date());
  await AsyncStorage.setItem(FIRST_DAY_KEY, String(today.getTime()));
  return today;
}

// ---------- completed reminders ("Done ✅" taps) ----------

export interface DoneEntry {
  kind: string;
  at: number;
}

export async function logDone(kind: string): Promise<void> {
  const log = await loadDoneLog();
  log.push({ kind, at: Date.now() });
  await AsyncStorage.setItem(DONE_LOG_KEY, JSON.stringify(log.slice(-1000)));
}

export async function loadDoneLog(sinceMs = 0): Promise<DoneEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DONE_LOG_KEY);
    const all: DoneEntry[] = raw ? JSON.parse(raw) : [];
    return all.filter((e) => e.at >= sinceMs);
  } catch {
    return [];
  }
}

// ---------- notification responses already handled (avoid double counting) ----------

export async function markProcessed(key: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PROCESSED_KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  if (list.includes(key)) return false;
  list.push(key);
  await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(list.slice(-200)));
  return true;
}
