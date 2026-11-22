import type { DayRecord } from './storage';

export type Level = 'excellent' | 'good' | 'fair' | 'poor';

export interface Stats {
  trackedDays: number;
  avgMl: number;
  avgPct: number;
  metDays: number;
  lowDays: number; // below 50% of goal
  streak: number; // consecutive days goal met, ending today (or yesterday)
  missedStreak: number; // consecutive past days below 70%, ending yesterday
  best?: DayRecord;
  level: Level;
}

/** `history` is oldest-first and includes today. Today is excluded from averages while still in progress. */
export function computeStats(history: DayRecord[]): Stats {
  const today = history[history.length - 1];
  const todayMet = !!today && today.ml >= today.goal;
  // Count today only once its goal is met, so a half-finished day doesn't drag the average down.
  const done = todayMet ? history : history.slice(0, -1);
  const n = done.length;
  const avgMl = n ? Math.round(done.reduce((s, d) => s + d.ml, 0) / n) : 0;
  const avgPct = n ? done.reduce((s, d) => s + Math.min(1.2, d.ml / d.goal), 0) / n : 0;

  let streak = 0;
  for (let i = history.length - (todayMet ? 1 : 2); i >= 0 && history[i].ml >= history[i].goal; i--) streak++;

  let missedStreak = 0;
  for (let i = history.length - 2; i >= 0 && history[i].ml < history[i].goal * 0.7; i--) missedStreak++;

  const best = done.reduce<DayRecord | undefined>((b, d) => (!b || d.ml > b.ml ? d : b), undefined);

  return {
    trackedDays: n,
    avgMl,
    avgPct,
    metDays: done.filter((d) => d.ml >= d.goal).length,
    lowDays: done.filter((d) => d.ml < d.goal * 0.5).length,
    streak,
    missedStreak,
    best: best && best.ml > 0 ? best : undefined,
    level: avgPct >= 0.95 ? 'excellent' : avgPct >= 0.75 ? 'good' : avgPct >= 0.5 ? 'fair' : 'poor',
  };
}

export const LEVEL_INFO: Record<Level, { emoji: string; title: string; text: string }> = {
  excellent: {
    emoji: '🌟',
    title: 'Excellent hydration',
    text: 'You are consistently meeting your goal. Your body, brain and kidneys are thanking you.',
  },
  good: {
    emoji: '🙂',
    title: 'Good, with room to improve',
    text: 'You get most of your water, but some days fall short. Small top-ups can close the gap.',
  },
  fair: {
    emoji: '😐',
    title: 'Mild dehydration risk',
    text: 'You are often drinking only half to three-quarters of your goal. You may notice tiredness or headaches.',
  },
  poor: {
    emoji: '⚠️',
    title: 'High dehydration risk',
    text: 'You are regularly drinking less than half of your goal. This can affect your energy, mood and long-term health.',
  },
};

export interface Issue {
  icon: string;
  title: string;
  detail: string;
}

export const SHORT_TERM_ISSUES: Issue[] = [
  { icon: '🤕', title: 'Headaches', detail: 'Losing even 1–2% of body water can trigger headaches and make migraines worse.' },
  { icon: '😴', title: 'Fatigue & low energy', detail: 'Less fluid means lower blood volume, so your heart works harder to deliver oxygen.' },
  { icon: '🧠', title: 'Poor focus & memory', detail: 'Mild dehydration is linked to weaker concentration, alertness and short-term memory.' },
  { icon: '😠', title: 'Mood changes', detail: 'Irritability, anxiety and low mood increase when you are low on fluids.' },
  { icon: '🌀', title: 'Dizziness', detail: 'Lower blood pressure can make you light-headed, especially when standing up quickly.' },
  { icon: '🦵', title: 'Muscle cramps', detail: 'Fluid and electrolyte imbalance can cause cramps, especially during or after exercise.' },
  { icon: '🚽', title: 'Constipation', detail: 'Your gut pulls water out of stool when you are dehydrated, making it hard and slow.' },
  { icon: '👄', title: 'Dry mouth & bad breath', detail: 'Less saliva lets odour-causing bacteria grow.' },
  { icon: '🍫', title: 'False hunger & cravings', detail: 'Thirst is often mistaken for hunger, especially sugar cravings.' },
];

export const LONG_TERM_ISSUES: Issue[] = [
  { icon: '🪨', title: 'Kidney stones', detail: 'Concentrated urine lets minerals crystallise. Low fluid intake is one of the biggest risk factors.' },
  { icon: '🦠', title: 'Urinary tract infections', detail: 'Less urine means bacteria are flushed out less often.' },
  { icon: '🩺', title: 'Kidney strain', detail: 'Chronically low intake makes your kidneys work harder over time.' },
  { icon: '🧴', title: 'Dry, dull skin', detail: 'Skin can lose moisture and elasticity and look tired.' },
  { icon: '🌡️', title: 'Heat illness', detail: 'In hot weather or during exercise, dehydration raises the risk of heat exhaustion.' },
];

export const BENEFITS: Issue[] = [
  { icon: '⚡', title: 'More energy', detail: 'Good hydration keeps blood volume up and fatigue down.' },
  { icon: '🎯', title: 'Sharper focus', detail: 'Your brain is about 75% water and works best when topped up.' },
  { icon: '✨', title: 'Healthier skin', detail: 'Hydrated skin looks plumper and more elastic.' },
  { icon: '🫘', title: 'Kidney protection', detail: 'Diluted urine lowers the risk of stones and infections.' },
  { icon: '🥗', title: 'Better digestion & appetite', detail: 'Water keeps digestion moving and helps tell thirst apart from hunger.' },
];

export const WARNING_SIGNS = [
  'Dark yellow or strong-smelling urine',
  'Peeing fewer than 4 times a day',
  'Feeling thirsty, dry lips or dry mouth',
  'Tiredness or headache in the afternoon',
];

export const SEE_A_DOCTOR = [
  'Confusion, fainting or a very fast heartbeat',
  'No urine for 8 hours or more',
  'Vomiting or diarrhoea that stops you keeping fluids down',
];

export const TIPS = [
  'Drink a full glass right after you wake up.',
  'Keep a bottle in sight: on your desk, in your bag, by your bed.',
  'Have a glass of water with every meal and every tablet.',
  'Eat water-rich foods: cucumber, watermelon, oranges and soups.',
  'Add lemon, mint or fruit slices if plain water feels boring.',
  'Tap "Drank 250 ml ✅" right on the reminder so logging takes one second.',
];

export const DISCLAIMER =
  'This is general wellness information, not medical advice. If you have heart, kidney or other conditions, follow the fluid guidance from your doctor.';

/** Issues to highlight for a given performance level. */
export function issuesFor(stats: Stats): { short: Issue[]; long: Issue[] } {
  switch (stats.level) {
    case 'excellent':
      return { short: [], long: [] };
    case 'good':
      return { short: SHORT_TERM_ISSUES.slice(0, 3), long: [] };
    case 'fair':
      return { short: SHORT_TERM_ISSUES.slice(0, 6), long: stats.trackedDays >= 14 ? LONG_TERM_ISSUES.slice(0, 2) : [] };
    case 'poor':
      return { short: SHORT_TERM_ISSUES, long: LONG_TERM_ISSUES };
  }
}
