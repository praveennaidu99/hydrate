import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { emitDataChanged, onDataChanged } from '../../events';
import { computeStats } from '../../health';
import { hydrationSlots, refreshGoalChecks, scheduleAll, setupNotifications } from '../../notifications';
import { addIntake, DayRecord, DEFAULT_SETTINGS, HydrationSettings, loadHistory, loadSettings, saveSettings } from '../../storage';
import { formatVolume, unitLabel, VolumeUnit } from '../../units';
import { F, useTheme } from '../../theme';
import { WeekRings } from '../../ui/Charts';
import { Confetti } from '../../ui/Confetti';
import { LiquidOrb } from '../../ui/LiquidOrb';
import { Banner, BannerTone, Card, PressableScale, SectionLabel, Text } from '../../ui/primitives';
import { enter, Screen } from '../../ui/Screen';
import type { IconName } from '../../ui/kinds';
import { Ionicons } from '@expo/vector-icons';

const POUR_STEP = 25;
const POUR_EVERY_MS = 110;

export default function Today() {
  const { colors: c } = useTheme();
  const [settings, setSettings] = useState<HydrationSettings>(DEFAULT_SETTINGS);
  const [week, setWeek] = useState<DayRecord[]>([]);
  const [slosh, setSlosh] = useState(0);
  const [burst, setBurst] = useState(0);
  const [pour, setPour] = useState(0);
  const pourTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pourRef = useRef(0);

  const load = useCallback(
    () =>
      Promise.all([loadSettings(), loadHistory(7)]).then(([s, w]) => {
        setSettings(s);
        setWeek(w);
      }),
    [],
  );

  useEffect(() => {
    load();
    return onDataChanged(load);
  }, [load]);

  const today = week[week.length - 1] ?? { date: new Date(), ml: 0, goal: settings.goalMl };
  const goal = settings.goalMl;
  const stats = computeStats(week);

  const add = async (ml: number) => {
    const before = today.ml;
    const rec = await addIntake(ml);
    setSlosh((k) => k + 1);
    Haptics.impactAsync(ml > 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    if (before < goal && rec.ml >= goal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBurst((b) => b + 1);
    }
    await refreshGoalChecks();
    emitDataChanged();
  };

  // Hold-to-pour: water rises while the finger stays on the orb.
  const startPour = () => {
    pourRef.current = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pourTimer.current = setInterval(() => {
      pourRef.current += POUR_STEP;
      setPour(pourRef.current);
      Haptics.selectionAsync();
      if (pourRef.current >= 1000) stopPour();
    }, POUR_EVERY_MS);
  };
  const stopPour = () => {
    if (!pourTimer.current) return;
    clearInterval(pourTimer.current);
    pourTimer.current = null;
    const amount = pourRef.current;
    pourRef.current = 0;
    setPour(0);
    if (amount > 0) add(amount);
  };
  useEffect(() => () => {
    if (pourTimer.current) clearInterval(pourTimer.current);
  }, []);

  const enableReminders = async () => {
    if (!(await setupNotifications())) return;
    const next = { ...settings, enabled: true };
    await saveSettings(next);
    await scheduleAll(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    load();
  };

  const shownMl = today.ml + pour;
  const nextAt = nextReminder(settings);
  const alerts = buildAlerts(today.ml, goal, settings, stats.missedStreak);

  return (
    <Screen
      overline={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      title={greeting()}
      right={stats.streak > 0 ? <StreakChip n={stats.streak} /> : undefined}
    >
      {/* Hero orb */}
      <Animated.View entering={enter(0)} style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 30 }}>
        <Pressable
          onLongPress={startPour}
          delayLongPress={220}
          onPressOut={stopPour}
          onPress={() => setSlosh((k) => k + 1)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Water today ${formatVolume(today.ml, settings.unit)} of ${formatVolume(goal, settings.unit)}. Hold to pour more.`}
        >
          <LiquidOrb ml={shownMl} goal={goal} sloshKey={slosh} unit={settings.unit} />
        </Pressable>
        <Confetti burstKey={burst} />
        {pour > 0 && <PourBadge ml={pour} unit={settings.unit} />}
      </Animated.View>

      {/* Status line */}
      <Animated.View entering={enter(1)} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <InfoPill icon="flag-outline" text={today.ml >= goal ? 'Goal reached' : `${formatVolume(goal - today.ml, settings.unit)} to go`} />
        {settings.enabled && nextAt && <InfoPill icon="notifications-outline" text={`Next ${nextAt}`} />}
      </Animated.View>

      {/* Quick add */}
      <Animated.View entering={enter(2)} style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        {[
          { ml: settings.quickAmounts[0], label: 'Sip', icon: 'cafe-outline' as IconName },
          { ml: settings.quickAmounts[1], label: 'Glass', icon: 'water-outline' as IconName },
          { ml: settings.quickAmounts[2], label: 'Bottle', icon: 'flask-outline' as IconName },
        ].map((b) => (
          <PressableScale key={b.label} onPress={() => add(b.ml)} style={{ flex: 1 }} accessibilityLabel={`Add ${formatVolume(b.ml, settings.unit)}`}>
            <Card style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={b.icon} size={21} color={c.accent} />
              </View>
              <Text variant="headline" style={{ marginTop: 10 }}>
                +{formatVolume(b.ml, settings.unit, { includeUnit: false })}
              </Text>
              <Text variant="caption" tone="faint">
                {b.label} · {unitLabel(settings.unit)}
              </Text>
            </Card>
          </PressableScale>
        ))}
      </Animated.View>
      {today.ml > 0 && (
        <Animated.View entering={enter(3)} style={{ alignItems: 'center', marginTop: 12 }}>
          <Pressable onPress={() => add(-(settings.quickAmounts[1] || 250))} hitSlop={10} accessibilityRole="button">
            <Text variant="caption" tone="faint" style={{ fontFamily: F.bold }}>
              <Ionicons name="arrow-undo" size={12} /> Undo {formatVolume(settings.quickAmounts[1] || 250, settings.unit)}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Smart alerts */}
      {(!settings.enabled || alerts.length > 0) && <SectionLabel>For you</SectionLabel>}
      <View style={{ gap: 12 }}>
        {!settings.enabled && (
          <Animated.View entering={enter(4)}>
            <Banner
              tone="info"
              icon="notifications"
              title="Turn on smart reminders"
              text={`Gentle nudges every hour from ${settings.startHour}:00 to ${settings.endHour}:00, with one-tap logging.`}
              action="Enable now"
              onPress={enableReminders}
            />
          </Animated.View>
        )}
        {alerts.map((a, i) => (
          <Animated.View key={a.title} entering={enter(5 + i)}>
            <Banner
              tone={a.tone}
              icon={a.icon}
              title={a.title}
              text={a.text}
              action={a.insights ? 'See health impact' : undefined}
              onPress={a.insights ? () => router.navigate('/insights') : undefined}
            />
          </Animated.View>
        ))}
      </View>

      {/* Week */}
      <SectionLabel
        right={
          <Pressable onPress={() => router.navigate('/insights')} hitSlop={10}>
            <Text variant="caption" tone="accent" style={{ fontFamily: F.bold }}>
              Insights →
            </Text>
          </Pressable>
        }
      >
        This week
      </SectionLabel>
      <Animated.View entering={enter(7)}>
        <Card>
          <WeekRings days={week} />
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
            <MiniStat label="Daily avg" value={formatVolume(stats.avgMl, settings.unit, { compact: true })} />
            <MiniStat label="Goals hit" value={`${stats.metDays}/${Math.max(stats.trackedDays, 1)}`} />
            <MiniStat label="Streak" value={`${stats.streak}d`} />
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

// ---------------------------------------------------------------- pieces

function StreakChip({ n }: { n: number }) {
  const { colors: c } = useTheme();
  const s = useSharedValue(0.6);
  useEffect(() => {
    s.value = withSequence(withTiming(1.15, { duration: 260 }), withSpring(1, { damping: 8 }));
  }, [n, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.warnSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }, st]}>
      <Ionicons name="flame" size={16} color={c.warn} />
      <Text variant="strong" tone="warn">
        {n}
      </Text>
    </Animated.View>
  );
}

function PourBadge({ ml, unit }: { ml: number; unit: VolumeUnit }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ position: 'absolute', top: -6, backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 }}>
      <Text variant="strong" tone="onAccent">
        Pouring +{formatVolume(ml, unit)}
      </Text>
    </View>
  );
}

function InfoPill({ icon, text }: { icon: IconName; text: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}>
      <Ionicons name={icon} size={14} color={c.inkSoft} />
      <Text variant="caption" tone="soft" style={{ fontFamily: F.semibold }}>
        {text}
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}>
      <Text variant="strong">{value}</Text>
      <Text variant="caption" tone="faint" style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function nextReminder(s: HydrationSettings): string | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const next = hydrationSlots(s).find((t) => t.hour * 60 + t.minute > mins);
  if (!next) return null;
  return new Date(2000, 0, 1, next.hour, next.minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface AlertInfo {
  tone: BannerTone;
  icon: IconName;
  title: string;
  text: string;
  insights?: boolean;
}

function buildAlerts(ml: number, goal: number, st: HydrationSettings, missedStreak: number): AlertInfo[] {
  const out: AlertInfo[] = [];
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = st.startHour * 60;
  const end = st.endHour * 60;

  if (ml >= goal) {
    out.push({ tone: 'success', icon: 'trophy', title: 'Daily goal complete', text: 'Your body is well hydrated today. Keep sipping when thirsty.' });
  } else if (mins > end) {
    out.push({
      tone: 'danger',
      icon: 'alert-circle',
      title: `Missed today's goal by ${formatVolume(goal - ml, st.unit)}`,
      text: 'Start tomorrow with a big glass of water right after waking up.',
      insights: true,
    });
  } else if (mins > start) {
    const expected = Math.round((goal * (mins - start)) / Math.max(1, end - start));
    if (ml < expected - (st.quickAmounts[1] || 250)) {
      out.push({
        tone: 'warn',
        icon: 'time',
        title: `You're ${formatVolume(expected - ml, st.unit)} behind`,
        text: `By now you'd ideally be near ${formatVolume(expected, st.unit)}. A glass now gets you back on pace.`,
      });
    } else {
      out.push({ tone: 'info', icon: 'thumbs-up', title: 'Right on pace', text: 'You are keeping up with your goal. Nice rhythm!' });
    }
  }

  if (missedStreak >= 2) {
    out.push({
      tone: 'danger',
      icon: 'pulse',
      title: `Goal missed ${missedStreak} days in a row`,
      text: 'Ongoing low intake can cause headaches, tiredness and constipation, and over time raises kidney stone risk.',
      insights: true,
    });
  }
  return out;
}
