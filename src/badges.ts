import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeStats, type Stats } from './health';
import type { DayRecord, DoneEntry } from './storage';
import type { IconName } from './ui/kinds';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type BadgeCategory = 'streak' | 'volume' | 'habit';

export interface BadgeDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
  category: BadgeCategory;
  tier: BadgeTier;
  target: number;
  unitSuffix?: string;
}

export interface BadgeState extends BadgeDefinition {
  unlocked: boolean;
  unlockedAt?: number; // epoch ms
  progress: number; // 0..1
  currentValue: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // --- Streaks ---
  {
    id: 'streak-1',
    title: 'First Drop',
    subtitle: '1-Day Goal Met',
    description: 'Met your daily hydration goal for the first time.',
    icon: 'water',
    category: 'streak',
    tier: 'bronze',
    target: 1,
    unitSuffix: 'day',
  },
  {
    id: 'streak-3',
    title: '3-Day Spark',
    subtitle: '3-Day Streak',
    description: 'Kept your hydration streak alive for 3 consecutive days.',
    icon: 'flame',
    category: 'streak',
    tier: 'bronze',
    target: 3,
    unitSuffix: 'days',
  },
  {
    id: 'streak-7',
    title: 'Weekly Wave',
    subtitle: '7-Day Streak',
    description: 'Achieved a perfect 7-day hydration week.',
    icon: 'flash',
    category: 'streak',
    tier: 'silver',
    target: 7,
    unitSuffix: 'days',
  },
  {
    id: 'streak-14',
    title: 'Fortnight Flow',
    subtitle: '14-Day Streak',
    description: 'Consistently reached your goal for 14 straight days.',
    icon: 'sparkles',
    category: 'streak',
    tier: 'gold',
    target: 14,
    unitSuffix: 'days',
  },
  {
    id: 'streak-30',
    title: 'Ocean Master',
    subtitle: '30-Day Streak',
    description: 'A legendary 30-day streak of complete hydration.',
    icon: 'trophy',
    category: 'streak',
    tier: 'platinum',
    target: 30,
    unitSuffix: 'days',
  },

  // --- Volume & Single-Day Milestones ---
  {
    id: 'volume-10l',
    title: 'Stream Starter',
    subtitle: '10 L Logged',
    description: 'Accumulated 10,000 ml of total water tracked in the app.',
    icon: 'leaf',
    category: 'volume',
    tier: 'bronze',
    target: 10000,
    unitSuffix: 'ml',
  },
  {
    id: 'volume-50l',
    title: 'River Runner',
    subtitle: '50 L Logged',
    description: 'Accumulated 50,000 ml of total water tracked.',
    icon: 'boat',
    category: 'volume',
    tier: 'silver',
    target: 50000,
    unitSuffix: 'ml',
  },
  {
    id: 'volume-100l',
    title: 'Aquifer Champion',
    subtitle: '100 L Logged',
    description: 'Reached a monumental 100,000 ml of logged water.',
    icon: 'medal',
    category: 'volume',
    tier: 'platinum',
    target: 100000,
    unitSuffix: 'ml',
  },
  {
    id: 'best-single-day',
    title: 'High Tide',
    subtitle: '3,000 ml Single Day',
    description: 'Drank 3,000 ml or more in a single calendar day.',
    icon: 'rocket',
    category: 'volume',
    tier: 'silver',
    target: 3000,
    unitSuffix: 'ml',
  },

  // --- Habits & Notifications ---
  {
    id: 'habits-5',
    title: 'Habit Builder',
    subtitle: '5 Reminders Logged',
    description: 'Completed 5 reminder actions via the app or alerts.',
    icon: 'checkmark-circle',
    category: 'habit',
    tier: 'bronze',
    target: 5,
    unitSuffix: 'actions',
  },
  {
    id: 'habits-25',
    title: 'Ritual Master',
    subtitle: '25 Reminders Logged',
    description: 'Completed 25 reminder actions across your daily habits.',
    icon: 'ribbon',
    category: 'habit',
    tier: 'silver',
    target: 25,
    unitSuffix: 'actions',
  },
  {
    id: 'habits-50',
    title: 'Zen Hydrator',
    subtitle: '50 Reminders Logged',
    description: 'Completed 50 reminder actions. Staying hydrated is second nature.',
    icon: 'infinite',
    category: 'habit',
    tier: 'gold',
    target: 50,
    unitSuffix: 'actions',
  },
];

const UNLOCKED_KEY = 'hydration-unlocked-badges';

/** Loads persistent map of badgeId -> unlocked timestamp (epoch ms) */
export async function loadUnlockedBadges(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Saves unlock timestamps into AsyncStorage */
export async function saveUnlockedBadges(unlocked: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
  } catch {}
}

/** Evaluates all badge states from historical data and unlock map */
export function evaluateBadges(
  history: DayRecord[],
  doneLog: DoneEntry[] = [],
  unlockedMap: Record<string, number> = {},
): BadgeState[] {
  const stats: Stats = computeStats(history);
  const activeStreak = Math.max(stats.streak, stats.longestStreak);
  const totalVolume = history.reduce((sum, d) => sum + d.ml, 0);
  const bestSingleDay = history.reduce((max, d) => Math.max(max, d.ml), 0);
  const totalHabits = doneLog.length;

  return BADGE_DEFINITIONS.map((badge) => {
    let currentValue = 0;

    switch (badge.id) {
      case 'streak-1':
      case 'streak-3':
      case 'streak-7':
      case 'streak-14':
      case 'streak-30':
        currentValue = activeStreak;
        break;
      case 'volume-10l':
      case 'volume-50l':
      case 'volume-100l':
        currentValue = totalVolume;
        break;
      case 'best-single-day':
        currentValue = bestSingleDay;
        break;
      case 'habits-5':
      case 'habits-25':
      case 'habits-50':
        currentValue = totalHabits;
        break;
      default:
        currentValue = 0;
    }

    const hasMetTarget = currentValue >= badge.target;
    const previouslyUnlocked = unlockedMap[badge.id] !== undefined;
    const unlocked = hasMetTarget || previouslyUnlocked;

    const progress = Math.min(1, Math.max(0, currentValue / badge.target));

    return {
      ...badge,
      unlocked,
      unlockedAt: unlockedMap[badge.id],
      progress,
      currentValue,
    };
  });
}

/** Checks and updates newly unlocked badges in storage. Returns any badges just unlocked. */
export async function checkAndUnlockBadges(
  history: DayRecord[],
  doneLog: DoneEntry[] = [],
): Promise<{ newBadges: BadgeState[]; allBadges: BadgeState[] }> {
  const existingMap = await loadUnlockedBadges();
  const currentStates = evaluateBadges(history, doneLog, existingMap);

  const updatedMap = { ...existingMap };
  const newBadges: BadgeState[] = [];
  const now = Date.now();

  for (const state of currentStates) {
    if (state.unlocked && existingMap[state.id] === undefined) {
      updatedMap[state.id] = now;
      state.unlockedAt = now;
      newBadges.push(state);
    }
  }

  if (newBadges.length > 0) {
    await saveUnlockedBadges(updatedMap);
  }

  return { newBadges, allBadges: currentStates };
}

/** Finds the next upcoming streak badge */
export function getNextStreakBadge(currentStreak: number): { nextBadge: BadgeDefinition; neededDays: number } | null {
  const streakBadges = BADGE_DEFINITIONS.filter((b) => b.category === 'streak').sort(
    (a, b) => a.target - b.target,
  );
  const next = streakBadges.find((b) => b.target > currentStreak);
  if (!next) return null;
  return { nextBadge: next, neededDays: next.target - currentStreak };
}
