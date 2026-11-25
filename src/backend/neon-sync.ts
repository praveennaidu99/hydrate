import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadHistory, loadSettings } from '../storage';

const NEON_URL_KEY = 'neon-database-url';
const NEON_LAST_SYNC_KEY = 'neon-last-sync-timestamp';

export const DEFAULT_NEON_URL =
  'postgresql://neondb_owner:npg_OTJoF7X4xAjs@ep-purple-sun-bi4bnjg3-pooler.c-5.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

/**
 * Neon Serverless Postgres Direct HTTP Query Engine.
 * Runs directly over standard HTTPS POST (https://<host>/sql),
 * requiring zero Node.js polyfills, zero Buffer, and zero WebSocket dependencies.
 * 100% compatible with React Native Hermes on Android & iOS.
 */
export async function executeNeonQuery<T = any>(
  dbUrl: string,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const urlObj = new URL(dbUrl);
  const endpoint = `https://${urlObj.host}/sql`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': dbUrl,
    },
    body: JSON.stringify({ query, params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neon HTTP error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return (data.rows || []) as T[];
}

export async function getNeonUrl(): Promise<string> {
  const custom = await AsyncStorage.getItem(NEON_URL_KEY);
  if (custom && custom.trim() !== '') return custom.trim();
  const envUrl = process.env.EXPO_PUBLIC_DATABASE_URL || process.env.DATABASE_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.trim();
  return DEFAULT_NEON_URL;
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
  try {
    const targetUrl = dbUrl ?? (await getNeonUrl());
    if (!targetUrl) return { ok: false, message: 'No connection string provided' };

    const rows = await executeNeonQuery<{ connected: number }>(targetUrl, 'SELECT 1 as connected;');
    if (rows && rows.length > 0 && rows[0].connected === 1) {
      return { ok: true, message: 'Connected successfully to Neon Lakebase Postgres!' };
    }
    return { ok: false, message: 'No response from database' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/** Ensures tables exist before sync. */
async function ensureTables(dbUrl: string): Promise<void> {
  await executeNeonQuery(
    dbUrl,
    `CREATE TABLE IF NOT EXISTS user_settings (
       user_id TEXT PRIMARY KEY,
       goal_ml INTEGER NOT NULL,
       unit TEXT NOT NULL,
       interval_min INTEGER NOT NULL,
       start_hour INTEGER NOT NULL,
       end_hour INTEGER NOT NULL,
       warnings_enabled BOOLEAN NOT NULL,
       reviews_enabled BOOLEAN NOT NULL,
       water_sound TEXT NOT NULL,
       quick_amounts JSONB,
       updated_at TIMESTAMPTZ DEFAULT NOW()
     );`
  );

  await executeNeonQuery(
    dbUrl,
    `CREATE TABLE IF NOT EXISTS daily_intake (
       user_id TEXT NOT NULL,
       intake_date DATE NOT NULL,
       ml INTEGER NOT NULL,
       goal_ml INTEGER NOT NULL,
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       PRIMARY KEY (user_id, intake_date)
     );`
  );
}

/**
 * Pushes local intake history and settings to Neon serverless database.
 */
export async function pushToNeon(): Promise<{ success: boolean; pushedDays: number }> {
  const dbUrl = await getNeonUrl();
  if (!dbUrl) return { success: false, pushedDays: 0 };

  // 1. Ensure table schema exists
  await ensureTables(dbUrl);

  const history = await loadHistory(30);
  const settings = await loadSettings();

  // 2. Sync settings
  await executeNeonQuery(
    dbUrl,
    `INSERT INTO user_settings (user_id, goal_ml, unit, interval_min, start_hour, end_hour, warnings_enabled, reviews_enabled, water_sound, quick_amounts, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
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
      JSON.stringify(settings.quickAmounts),
    ]
  );

  // 3. Sync daily intake
  let count = 0;
  for (const day of history) {
    const dateStr = day.date.toISOString().split('T')[0];
    await executeNeonQuery(
      dbUrl,
      `INSERT INTO daily_intake (user_id, intake_date, ml, goal_ml, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, intake_date) DO UPDATE SET
         ml = EXCLUDED.ml,
         goal_ml = EXCLUDED.goal_ml,
         updated_at = NOW();`,
      ['default_user', dateStr, day.ml, day.goal]
    );
    count++;
  }

  await AsyncStorage.setItem(NEON_LAST_SYNC_KEY, String(Date.now()));
  return { success: true, pushedDays: count };
}
