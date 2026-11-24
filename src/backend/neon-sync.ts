import AsyncStorage from '@react-native-async-storage/async-storage';
import { neon } from '@neondatabase/serverless';
import { loadHistory, loadSettings } from '../storage';

const NEON_URL_KEY = 'neon-database-url';
const NEON_LAST_SYNC_KEY = 'neon-last-sync-timestamp';

/**
 * Neon Serverless Postgres Client (Lakebase Postgres).
 * Powered by @neondatabase/serverless over HTTP for serverless, edge, and mobile runtimes.
 * 100% free serverless tier: scale to zero, 1 GB storage, $0 cost.
 */
export async function getNeonUrl(): Promise<string | null> {
  const custom = await AsyncStorage.getItem(NEON_URL_KEY);
  if (custom && custom.trim() !== '') return custom.trim();
  const envUrl = process.env.EXPO_PUBLIC_DATABASE_URL || process.env.DATABASE_URL;
  return envUrl && envUrl.trim() !== '' ? envUrl.trim() : null;
}

export async function setNeonUrl(url: string | null): Promise<void> {
  if (!url || url.trim() === '') {
    await AsyncStorage.removeItem(NEON_URL_KEY);
  } else {
    await AsyncStorage.setItem(NEON_URL_KEY, url.trim());
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(NEON_LAST_SYNC_KEY);
  return raw ? Number(raw) : null;
}

/** Tests whether the configured Neon Postgres database is reachable. */
export async function testNeonConnection(dbUrl?: string): Promise<{ ok: boolean; message: string }> {
  const targetUrl = dbUrl ?? (await getNeonUrl());
  if (!targetUrl) return { ok: false, message: 'No connection string provided' };

  try {
    const sql = neon(targetUrl);
    const res = await sql`SELECT 1 as connected;`;
    if (res && res.length > 0) {
      return { ok: true, message: 'Connected successfully to Neon Lakebase Postgres!' };
    }
    return { ok: false, message: 'No response from database' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * Pushes local intake history and settings to Neon serverless database.
 */
export async function pushToNeon(): Promise<{ success: boolean; pushedDays: number }> {
  const dbUrl = await getNeonUrl();
  if (!dbUrl) return { success: false, pushedDays: 0 };

  const sql = neon(dbUrl);
  const history = await loadHistory(30);
  const settings = await loadSettings();

  // 1. Sync settings
  await sql.query(
    `INSERT INTO user_settings (user_id, goal_ml, unit, interval_min, start_hour, end_hour, warnings_enabled, reviews_enabled, water_sound, quick_amounts, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       goal_ml = EXCLUDED.goal_ml,
       unit = EXCLUDED.unit,
       interval_min = EXCLUDED.interval_min,
       start_hour = EXCLUDED.start_hour,
       end_hour = EXCLUDED.end_hour,
       warnings_enabled = EXCLUDED.warnings_enabled,
       reviews_enabled = EXCLUDED.reviews_enabled,
       water_sound = EXCLUDED.water_sound,
       quick_amounts = EXCLUDED.quick_amounts,
       updated_at = NOW();`,
    [
      'default_user',
      settings.goalMl,
      settings.unit,
      settings.intervalMin,
      settings.startHour,
      settings.endHour,
      settings.warnings,
      settings.reviews,
      settings.waterSound,
      settings.quickAmounts,
    ],
  );

  // 2. Sync daily intake
  let count = 0;
  for (const day of history) {
    const dateStr = day.date.toISOString().split('T')[0];
    await sql.query(
      `INSERT INTO daily_intake (user_id, intake_date, ml, goal_ml, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, intake_date) DO UPDATE SET
         ml = EXCLUDED.ml,
         goal_ml = EXCLUDED.goal_ml,
         updated_at = NOW();`,
      ['default_user', dateStr, day.ml, day.goal],
    );
    count++;
  }

  await AsyncStorage.setItem(NEON_LAST_SYNC_KEY, String(Date.now()));
  return { success: true, pushedDays: count };
}
