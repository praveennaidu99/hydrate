import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { addIntake, type DayRecord, loadSettings, loadToday } from '../storage';
import { formatVolume, type VolumeUnit } from '../units';
import { emitDataChanged } from '../events';
import { refreshGoalChecks } from '../notifications';

export const WIDGET_DATA_KEY = 'hydrate_widget_snapshot';
export const WIDGET_APP_GROUP = 'group.com.praveeng.hydrate';

export interface WidgetSnapshot {
  todayMl: number;
  goalMl: number;
  pct: number;
  unit: VolumeUnit;
  formattedToday: string;
  formattedGoal: string;
  quickAddMl: number;
  quickAddLabel: string;
  updatedAt: number;
}

/**
 * Syncs the latest hydration progress to the widget data store.
 * Both iOS (App Group UserDefaults) and Android (AppWidget data) read this snapshot.
 */
export async function syncWidgetData(
  todayRecord?: DayRecord,
  unitSetting?: VolumeUnit,
  quickAmountMl?: number,
): Promise<WidgetSnapshot> {
  const today = todayRecord ?? (await loadToday());
  const settings = await loadSettings();
  const unit = unitSetting ?? settings.unit;
  const quickMl = quickAmountMl ?? settings.quickAmounts[1] ?? 250;
  const pct = settings.goalMl > 0 ? Math.min(1.5, today.ml / settings.goalMl) : 0;

  const snapshot: WidgetSnapshot = {
    todayMl: today.ml,
    goalMl: settings.goalMl,
    pct,
    unit,
    formattedToday: formatVolume(today.ml, unit),
    formattedGoal: formatVolume(settings.goalMl, unit),
    quickAddMl: quickMl,
    quickAddLabel: `+${formatVolume(quickMl, unit)}`,
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(snapshot));

  // Sync to native Android AppWidget
  if (Platform.OS === 'android' && NativeModules?.HydrationWidgetModule) {
    try {
      NativeModules.HydrationWidgetModule.updateWidget(today.ml, settings.goalMl, unit);
    } catch {}
  }

  return snapshot;
}

/**
 * Handles widget tap deep links (e.g. `hydrate://quick-add?ml=250`).
 * Returns true if the URL was a widget quick-add action.
 */
export async function handleWidgetUrl(url: string | null): Promise<boolean> {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    if (parsed.scheme === 'hydrate' && (parsed.hostname === 'quick-add' || parsed.path === 'quick-add')) {
      const mlParam = parsed.queryParams?.ml;
      const ml = typeof mlParam === 'string' ? Number(mlParam) : 250;
      if (ml > 0 && !isNaN(ml)) {
        await addIntake(ml);
        await refreshGoalChecks();
        emitDataChanged();
        await syncWidgetData();
        return true;
      }
    }
  } catch (err) {
    console.warn('Error processing widget deep link:', err);
  }
  return false;
}
