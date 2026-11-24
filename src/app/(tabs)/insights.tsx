import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { onDataChanged } from '../../events';
import {
  BENEFITS,
  computeStats,
  DISCLAIMER,
  Issue,
  issuesFor,
  Level,
  LEVEL_INFO,
  SEE_A_DOCTOR,
  TIPS,
  WARNING_SIGNS,
} from '../../health';
import { Kind, KINDS } from '../../notifications';
import { DayRecord, DEFAULT_SETTINGS, HydrationSettings, loadDoneLog, loadHistory, loadSettings } from '../../storage';
import { formatVolume } from '../../units';
import { alpha, Colors, F, useTheme } from '../../theme';
import { BarChart, ScoreRing } from '../../ui/Charts';
import { IconName, KIND_UI } from '../../ui/kinds';
import { Card, IconTile, Segmented, SectionLabel, Text } from '../../ui/primitives';
import { enter, Screen } from '../../ui/Screen';

type Period = 'week' | 'month';

const LEVEL_ICON: Record<Level, IconName> = {
  excellent: 'sparkles',
  good: 'happy-outline',
  fair: 'alert-circle-outline',
  poor: 'warning',
};

const levelColors = (l: Level, c: Colors): { fg: string; bg: string; ring: [string, string] } =>
  ({
    excellent: { fg: c.success, bg: c.successSoft, ring: [c.success, '#22D3EE'] as [string, string] },
    good: { fg: c.accent, bg: c.accentSoft, ring: [c.waterA, c.waterB] as [string, string] },
    fair: { fg: c.warn, bg: c.warnSoft, ring: ['#FBBF24', c.warn] as [string, string] },
    poor: { fg: c.danger, bg: c.dangerSoft, ring: ['#FB7185', c.danger] as [string, string] },
  })[l];

export default function Insights() {
  const { colors: c } = useTheme();
  const params = useLocalSearchParams<{ period?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const period: Period = params.period === 'month' || params.period === 'week' ? params.period : selectedPeriod;
  const [days, setDays] = useState<DayRecord[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<HydrationSettings>(DEFAULT_SETTINGS);

  const load = useCallback(() => {
    const n = period === 'week' ? 7 : 30;
    return Promise.all([loadHistory(n), loadDoneLog(Date.now() - n * 86400000), loadSettings()]).then(([h, log, s]) => {
      const counts: Record<string, number> = {};
      log.forEach((e) => (counts[e.kind] = (counts[e.kind] ?? 0) + 1));
      setDays(h);
      setDone(counts);
      setSettings(s);
    });
  }, [period]);

  useEffect(() => {
    load();
    return onDataChanged(load);
  }, [load]);

  const stats = computeStats(days);
  const info = LEVEL_INFO[stats.level];
  const lc = levelColors(stats.level, c);
  const { short, long } = issuesFor(stats);
  const label = period === 'week' ? 'this week' : 'this month';
  const enough = stats.trackedDays >= 2;
  const score = Math.round(Math.min(1, stats.avgPct) * 100);

  return (
    <Screen overline={period === 'week' ? 'Weekly review' : 'Monthly review'} title="Insights">
      <Animated.View entering={enter(0)}>
        <Segmented<Period>
          value={period}
          onChange={setSelectedPeriod}
          options={[
            { label: 'This week', value: 'week' },
            { label: 'This month', value: 'month' },
          ]}
        />
      </Animated.View>

      {/* Hero: health score */}
      <Animated.View entering={enter(1)} style={{ marginTop: 16 }}>
        <Card style={{ backgroundColor: enough ? lc.bg : c.surface, borderWidth: 0 }}>
          {enough ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <ScoreRing score={score} colors={lc.ring} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={LEVEL_ICON[stats.level]} size={18} color={lc.fg} />
                  <Text variant="overline" style={{ color: lc.fg }}>
                    Hydration health
                  </Text>
                </View>
                <Text variant="headline" style={{ marginTop: 4 }}>
                  {info.title}
                </Text>
                <Text variant="caption" tone="soft" style={{ marginTop: 4 }}>
                  {info.text}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <IconTile icon="leaf-outline" color={c.success} size={52} />
              <Text variant="headline" style={{ marginTop: 12 }}>
                Your review is growing
              </Text>
              <Text variant="caption" tone="soft" style={{ textAlign: 'center', marginTop: 4, maxWidth: 280 }}>
                Log water for a couple of days to unlock your health score, risks and personal tips.
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={enter(2)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        <Stat icon="water" color={c.accent} value={formatVolume(stats.avgMl, settings.unit, { compact: true })} label="Daily average" />
        <Stat icon="checkmark-done" color={c.success} value={`${stats.metDays}/${Math.max(stats.trackedDays, 1)}`} label="Goal days" />
        <Stat icon="flame" color={c.warn} value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`} label="Current streak" />
        <Stat
          icon="trophy"
          color="#8B5CF6"
          value={stats.best ? formatVolume(stats.best.ml, settings.unit, { compact: true }) : '—'}
          label={stats.best ? `Best · ${stats.best.date.toLocaleDateString(undefined, { weekday: 'short' })}` : 'Best day'}
        />
      </Animated.View>

      {/* Chart */}
      <SectionLabel>{`Intake ${label}`}</SectionLabel>
      <Animated.View entering={enter(3)}>
        <Card>
          <BarChart key={period} days={days} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            <Legend color={c.success} text="Goal met" />
            <Legend color={c.waterB} text="50–99%" />
            <Legend color={c.warn} text="Under 50%" />
          </View>
          {enough && stats.lowDays > 0 && (
            <Text variant="caption" tone="soft" style={{ marginTop: 12 }}>
              {stats.lowDays} {stats.lowDays === 1 ? 'day' : 'days'} {label} were under half your goal.
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* Health knowledge */}
      <SectionLabel>Your health</SectionLabel>
      <View style={{ gap: 10 }}>
        {enough && short.length > 0 && (
          <Accordion i={4} icon="alert-circle" color={c.warn} title="What skipping water can cause" subtitle={`${short.length} effects you may notice`} defaultOpen>
            <IssueList items={short} />
          </Accordion>
        )}
        {enough && long.length > 0 && (
          <Accordion i={5} icon="medical" color={c.danger} title="Long-term health risks" subtitle="If low intake keeps happening">
            <IssueList items={long} />
          </Accordion>
        )}
        {enough && (stats.level === 'excellent' || stats.level === 'good') && (
          <Accordion i={5} icon="heart" color={c.success} title="What you're gaining" subtitle="Benefits of staying hydrated" defaultOpen>
            <IssueList items={BENEFITS} />
          </Accordion>
        )}
        <Accordion i={6} icon="eye" color={c.accent} title="Signs you need more water" subtitle="Check these through the day">
          <Bullets items={WARNING_SIGNS} />
        </Accordion>
        <Accordion i={7} icon="medkit" color={c.danger} title="When to get medical help" subtitle="Don't wait on these">
          <Bullets items={SEE_A_DOCTOR} />
        </Accordion>
        <Accordion i={8} icon="bulb" color="#F59E0B" title="Tips to drink more" subtitle="Small habits, big difference">
          <Bullets items={TIPS} />
        </Accordion>
      </View>

      {/* Habits */}
      {Object.keys(done).length > 0 && (
        <>
          <SectionLabel>{`Healthy habits ${label}`}</SectionLabel>
          <Animated.View entering={enter(9)}>
            <Card style={{ gap: 12 }}>
              {Object.entries(done).map(([k, n]) => {
                const ui = KIND_UI[k as Kind] ?? KIND_UI.custom;
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <IconTile icon={ui.icon} color={ui.color} size={36} />
                    <Text variant="strong" style={{ flex: 1 }}>
                      {KINDS[k as Kind]?.label ?? k}
                    </Text>
                    <Text variant="strong" style={{ color: ui.color }}>
                      {n}× done
                    </Text>
                  </View>
                );
              })}
            </Card>
          </Animated.View>
        </>
      )}

      <Text variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: 24, paddingHorizontal: 12 }}>
        {DISCLAIMER}
      </Text>
    </Screen>
  );
}

// ---------------------------------------------------------------- pieces

function Stat({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  return (
    <Card style={{ width: '48.4%', flexGrow: 1, padding: 14 }}>
      <IconTile icon={icon} color={color} size={32} />
      <Text variant="headline" style={{ marginTop: 10 }}>
        {value}
      </Text>
      <Text variant="caption" tone="faint">
        {label}
      </Text>
    </Card>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" tone="soft">
        {text}
      </Text>
    </View>
  );
}

function Accordion({
  i,
  icon,
  color,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  i: number;
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rot = useSharedValue(defaultOpen ? 1 : 0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));
  const { colors: c } = useTheme();
  return (
    <Animated.View entering={enter(i)} layout={LinearTransition.springify().damping(20)}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <Pressable
          onPress={() => {
            rot.value = withSpring(open ? 0 : 1, { damping: 16 });
            setOpen(!open);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
        >
          <IconTile icon={icon} color={color} size={38} />
          <View style={{ flex: 1 }}>
            <Text variant="strong">{title}</Text>
            <Text variant="caption" tone="faint">
              {subtitle}
            </Text>
          </View>
          <Animated.View style={chevron}>
            <Ionicons name="chevron-down" size={20} color={c.inkFaint} />
          </Animated.View>
        </Pressable>
        {open && (
          <Animated.View entering={FadeIn.duration(260)} style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: alpha(color, 0.18) }}>
            {children}
          </Animated.View>
        )}
      </Card>
    </Animated.View>
  );
}

function IssueList({ items }: { items: Issue[] }) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      {items.map((it) => (
        <View key={it.title} style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 20, lineHeight: 26 }}>{it.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="strong">{it.title}</Text>
            <Text variant="caption" tone="soft" style={{ marginTop: 1 }}>
              {it.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      {items.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 8 }} />
          <Text variant="body" style={{ flex: 1, fontFamily: F.medium }}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}
