import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { emitDataChanged } from '../../events';
import { hydrationSlots, scheduleAll, scheduledCount, sendTest, setupNotifications, SOUNDS } from '../../notifications';
import { DEFAULT_SETTINGS, HydrationSettings, loadSettings, saveSettings, SoundName, ThemeMode } from '../../storage';
import { F, useTheme } from '../../theme';
import type { IconName } from '../../ui/kinds';
import { Card, IconTile, Pills, Segmented, SectionLabel, Stepper, Text, Toggle } from '../../ui/primitives';
import { enter, Screen } from '../../ui/Screen';

const fmtHour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function Settings() {
  const { colors: c, mode, setMode } = useTheme();
  const [s, setS] = useState<HydrationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSettings().then((v) => {
      setS(v);
      setLoaded(true);
    });
    scheduledCount().then(setPending);
  }, []);

  // Auto-save: debounce, then persist + reschedule notifications.
  const update = (patch: Partial<HydrationSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (next.enabled && !(await setupNotifications())) {
        Alert.alert('Notifications are off', 'Allow notifications in your phone settings to get reminders.');
        return;
      }
      await saveSettings(next);
      await scheduleAll(next);
      setPending(await scheduledCount());
      emitDataChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 600);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const perDay = hydrationSlots(s).length;

  return (
    <Screen
      overline="Personalise"
      title="Settings"
      right={
        saved ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.successSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Ionicons name="checkmark" size={14} color={c.success} />
            <Text variant="caption" tone="success" style={{ fontFamily: F.bold }}>
              Saved
            </Text>
          </Animated.View>
        ) : undefined
      }
    >
      {loaded && (
        <>
          {/* Goal */}
          <Animated.View entering={enter(0)}>
            <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Text variant="overline" tone="faint">
                Daily goal
              </Text>
              <View style={{ marginTop: 10 }}>
                <Stepper big value={s.goalMl} onChange={(v) => update({ goalMl: v })} step={250} min={1000} max={5000} format={(v) => `${+(v / 1000).toFixed(2)} L`} />
              </View>
              <Text variant="caption" tone="soft" style={{ marginTop: 8 }}>
                About {Math.round(s.goalMl / 250)} glasses a day
              </Text>
            </Card>
          </Animated.View>

          {/* Water reminders */}
          <SectionLabel>Water reminders</SectionLabel>
          <Animated.View entering={enter(1)}>
            <Card padded={false}>
              <Row icon="notifications" color={c.accent} title="Remind me to drink" sub={s.enabled ? `${perDay} gentle nudges a day` : 'Off'}>
                <Toggle label="Water reminders" value={s.enabled} onChange={(v) => update({ enabled: v })} />
              </Row>
              {s.enabled && (
                <Animated.View entering={FadeIn.duration(250)}>
                  <Divider />
                  <View style={{ padding: 16, gap: 12 }}>
                    <Text variant="strong">Every</Text>
                    <Segmented
                      value={s.intervalMin}
                      onChange={(v) => update({ intervalMin: v })}
                      options={[30, 45, 60, 90, 120].map((v) => ({ label: v < 60 ? `${v}m` : `${v / 60}h`, value: v }))}
                    />
                  </View>
                  <Divider />
                  <Row icon="sunny" color="#F59E0B" title="Start" sub="First reminder">
                    <Stepper value={s.startHour} onChange={(h) => update({ startHour: Math.min(h, s.endHour - 1) })} step={1} min={0} max={22} format={fmtHour} />
                  </Row>
                  <Divider />
                  <Row icon="moon" color="#6366F1" title="End" sub="Last reminder">
                    <Stepper value={s.endHour} onChange={(h) => update({ endHour: Math.max(h, s.startHour + 1) })} step={1} min={1} max={23} format={fmtHour} />
                  </Row>
                  <Divider />
                  <View style={{ padding: 16, gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="strong">Sound</Text>
                      <Pressable onPress={() => sendTest(s.waterSound)} hitSlop={10} accessibilityRole="button">
                        <Text variant="caption" tone="accent" style={{ fontFamily: F.bold }}>
                          <Ionicons name="play" size={12} /> Test
                        </Text>
                      </Pressable>
                    </View>
                    <Pills<SoundName>
                      value={s.waterSound}
                      onChange={(v) => update({ waterSound: v })}
                      options={SOUNDS.map((x) => ({ label: x.label.replace(/^\S+\s/, ''), value: x.value, icon: 'musical-note' as const }))}
                    />
                  </View>
                </Animated.View>
              )}
            </Card>
          </Animated.View>

          {/* Alerts */}
          <SectionLabel>Alerts & reviews</SectionLabel>
          <Animated.View entering={enter(2)}>
            <Card padded={false}>
              <Row icon="warning" color={c.warn} title="Behind-on-goal warnings" sub="An evening nudge if you're short">
                <Toggle label="Goal warnings" value={s.warnings} onChange={(v) => update({ warnings: v })} />
              </Row>
              <Divider />
              <Row icon="stats-chart" color="#8B5CF6" title="Weekly & monthly reviews" sub="Sundays 7 PM · 1st of the month">
                <Toggle label="Reviews" value={s.reviews} onChange={(v) => update({ reviews: v })} />
              </Row>
            </Card>
          </Animated.View>

          {/* Appearance */}
          <SectionLabel>Appearance</SectionLabel>
          <Animated.View entering={enter(3)}>
            <Segmented<ThemeMode>
              value={mode}
              onChange={setMode}
              options={[
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
            />
          </Animated.View>

          <Text variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: 28 }}>
            Hydrate {Constants.expoConfig?.version ?? ''} · {pending} notifications scheduled
          </Text>
        </>
      )}
    </Screen>
  );
}

function Row({ icon, color, title, sub, children }: { icon: IconName; color: string; title: string; sub: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
      <IconTile icon={icon} color={color} size={36} />
      <View style={{ flex: 1 }}>
        <Text variant="strong">{title}</Text>
        <Text variant="caption" tone="faint">
          {sub}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Divider() {
  const { colors: c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line, marginLeft: 64 }} />;
}
