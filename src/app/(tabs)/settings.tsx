import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { emitDataChanged } from '../../events';
import { calculatePacedDose, hydrationSlots, scheduleAll, scheduledCount, sendTest, setupNotifications, SOUNDS } from '../../notifications';
import { CLINICAL_PACING_GUIDELINES } from '../../health';
import { DEFAULT_SETTINGS, HydrationSettings, loadSettings, saveSettings, SoundName, ThemeMode } from '../../storage';
import { formatVolume, VolumeUnit } from '../../units';
import { getLastSyncTime, pushToNeon, testNeonConnection } from '../../backend/neon-sync';
import { syncWidgetData } from '../../widgets/widget-sync';
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
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSettings().then((v) => {
      setS(v);
      setLoaded(true);
    });
    scheduledCount().then(setPending);
    getLastSyncTime().then(setLastSync);
  }, []);

  const handleTestAndSaveNeon = async () => {
    setSyncing(true);
    try {
      const res = await testNeonConnection();
      if (res.ok) {
        Alert.alert('Connection Successful 🟢', 'Connected to your Neon Postgres database (Hydrate: plain-math-49378436)!');
      } else {
        Alert.alert('Connection Notice', res.message);
      }
    } catch (err) {
      Alert.alert('Connection Error', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await pushToNeon();
      if (res.success) {
        setLastSync(Date.now());
        Alert.alert('Backup Complete ☁️', `Successfully backed up ${res.pushedDays} days of intake data to Neon Postgres.`);
      } else {
        Alert.alert('Sync Notice', 'Please verify your database connection.');
      }
    } catch (err) {
      Alert.alert('Sync Error', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

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
                <Stepper
                  big
                  value={s.goalMl}
                  onChange={(v) => update({ goalMl: v })}
                  step={s.unit === 'oz' ? 120 : 250}
                  min={1000}
                  max={5000}
                  format={(v) => formatVolume(v, s.unit, { compact: s.unit === 'ml' })}
                />
              </View>
              <Text variant="caption" tone="soft" style={{ marginTop: 8 }}>
                About {Math.round(s.goalMl / (s.quickAmounts?.[1] || 250))} glasses a day
              </Text>
            </Card>
          </Animated.View>

          {/* Unit System */}
          <SectionLabel>Measurement unit</SectionLabel>
          <Animated.View entering={enter(1)}>
            <Segmented<VolumeUnit>
              value={s.unit}
              onChange={(unit) => update({ unit })}
              options={[
                { label: 'Millilitres (ml)', value: 'ml' },
                { label: 'Fluid Ounces (fl oz)', value: 'oz' },
              ]}
            />
          </Animated.View>

          {/* Quick Add Customization */}
          <SectionLabel>Custom drink sizes</SectionLabel>
          <Animated.View entering={enter(2)}>
            <Card padded={false}>
              <Row icon="cafe" color={c.accent} title="Sip size" sub="Quick-add button 1">
                <Stepper
                  value={s.quickAmounts[0]}
                  onChange={(v) => update({ quickAmounts: [v, s.quickAmounts[1], s.quickAmounts[2]] })}
                  step={s.unit === 'oz' ? 30 : 25}
                  min={50}
                  max={Math.max(50, s.quickAmounts[1] - 25)}
                  format={(v) => formatVolume(v, s.unit)}
                />
              </Row>
              <Divider />
              <Row icon="water" color={c.accent} title="Glass size" sub="Quick-add button 2">
                <Stepper
                  value={s.quickAmounts[1]}
                  onChange={(v) => update({ quickAmounts: [s.quickAmounts[0], v, s.quickAmounts[2]] })}
                  step={s.unit === 'oz' ? 30 : 50}
                  min={s.quickAmounts[0] + 25}
                  max={Math.max(s.quickAmounts[0] + 50, s.quickAmounts[2] - 25)}
                  format={(v) => formatVolume(v, s.unit)}
                />
              </Row>
              <Divider />
              <Row icon="flask" color={c.accent} title="Bottle size" sub="Quick-add button 3">
                <Stepper
                  value={s.quickAmounts[2]}
                  onChange={(v) => update({ quickAmounts: [s.quickAmounts[0], s.quickAmounts[1], v] })}
                  step={s.unit === 'oz' ? 60 : 50}
                  min={s.quickAmounts[1] + 25}
                  max={2500}
                  format={(v) => formatVolume(v, s.unit)}
                />
              </Row>
            </Card>
          </Animated.View>

          {/* Water reminders */}
          <SectionLabel>Water reminders</SectionLabel>
          <Animated.View entering={enter(3)}>
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
                  {/* Live Medical Pacing Card */}
                  <View style={{ backgroundColor: c.surfaceAlt, margin: 16, padding: 14, borderRadius: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="speedometer-outline" size={18} color={c.accent} />
                      <Text variant="strong">Automatic Hydration Pacing</Text>
                    </View>
                    <Text variant="caption" tone="soft" style={{ marginTop: 4 }}>
                      For your {formatVolume(s.goalMl, s.unit, { compact: true })} goal, you will receive {perDay} alerts of ~{formatVolume(calculatePacedDose(s.goalMl, perDay), s.unit)} each.
                    </Text>
                    {s.goalMl >= CLINICAL_PACING_GUIDELINES.highIntakeThresholdMl && (
                      <Text variant="caption" tone="warn" style={{ marginTop: 6, fontFamily: F.semibold }}>
                        ⚠️ {CLINICAL_PACING_GUIDELINES.highGoalNotice}
                      </Text>
                    )}
                  </View>
                  <Divider />
                  <Row icon="pulse" color={c.accent} title="Adaptive dose alert" sub="Custom ml/oz target in notifications">
                    <Toggle label="Smart adaptive pacing" value={s.smartPacing} onChange={(v) => update({ smartPacing: v })} />
                  </Row>
                  <Divider />
                  <Row icon="bed" color="#6366F1" title="Evening sleep protection" sub="Tapers volume before bedtime">
                    <Toggle label="Taper before bed" value={s.taperBeforeBed} onChange={(v) => update({ taperBeforeBed: v })} />
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

          {/* Home Screen Widget Section */}
          <SectionLabel>Home Screen Widget</SectionLabel>
          <Animated.View entering={enter(3)}>
            <Card style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="apps" color={c.accent} size={38} />
                <View style={{ flex: 1 }}>
                  <Text variant="strong">One-Tap Quick Logging</Text>
                  <Text variant="caption" tone="soft">
                    Track hydration directly from your phone&apos;s home screen
                  </Text>
                </View>
              </View>

              {/* Live Visual Widget Preview: Left Water Sphere + Right Stats & Actions */}
              <View
                style={{
                  backgroundColor: '#081522',
                  borderRadius: 20,
                  padding: 14,
                  marginTop: 14,
                  borderWidth: 1.5,
                  borderColor: '#1E3852',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {/* Left Side: 3D Liquid Water Sphere */}
                <View
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: 999,
                    backgroundColor: '#071522',
                    borderWidth: 2,
                    borderColor: '#2B5E87',
                    overflow: 'hidden',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                  }}
                >
                  {/* Water Fill */}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '65%',
                      backgroundColor: '#0284C7',
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                    }}
                  >
                    {/* Wave Crest Surface Highlight */}
                    <View style={{ height: 3, backgroundColor: '#BAE6FD' }} />
                  </View>

                  {/* 3D Glass Specular Reflection Highlight */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 12,
                      width: 24,
                      height: 14,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.35)',
                      transform: [{ rotate: '-25deg' }],
                    }}
                  />

                  {/* Percentage in center with drop shadow */}
                  <Text variant="strong" style={{ color: '#FFFFFF', fontSize: 18, fontFamily: F.bold, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 }}>
                    65%
                  </Text>
                </View>

                {/* Right Side: Header + Metric + Pill Buttons */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="strong" style={{ color: '#F0F6FC', fontSize: 15 }}>
                      Hydrate
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#0C2D47',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor: '#1D5682',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#38BDF8', fontSize: 10, fontFamily: F.bold }}>
                        Daily Target
                      </Text>
                    </View>
                  </View>

                  {/* Intake / Goal */}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                    <Text variant="strong" style={{ color: '#FFFFFF', fontSize: 20, fontFamily: F.bold }}>
                      1,625
                    </Text>
                    <Text variant="caption" style={{ color: '#38BDF8', fontFamily: F.bold, marginLeft: 3 }}>
                      {s.unit}
                    </Text>
                    <Text variant="caption" tone="faint" style={{ color: '#94A3B8', marginLeft: 3 }}>
                      / {formatVolume(s.goalMl, s.unit)}
                    </Text>
                  </View>

                  <Text variant="caption" tone="faint" style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>
                    875 {s.unit} remaining
                  </Text>

                  {/* Quick Add Pills (Instant in-place update) */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: '#112A40',
                        paddingVertical: 6,
                        borderRadius: 999,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#214A6F',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#38BDF8', fontFamily: F.bold, fontSize: 11 }}>
                        +{formatVolume(s.quickAmounts[1] ?? 250, s.unit)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: '#112A40',
                        paddingVertical: 6,
                        borderRadius: 999,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#214A6F',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#38BDF8', fontFamily: F.bold, fontSize: 11 }}>
                        +{formatVolume(s.quickAmounts[2] ?? 500, s.unit)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Instructions */}
              <View style={{ marginTop: 14, gap: 4 }}>
                <Text variant="caption" style={{ fontFamily: F.bold }}>
                  📱 How to add to your Android Home Screen:
                </Text>
                <Text variant="caption" tone="soft">
                  1. Go to your phone&apos;s Home Screen
                </Text>
                <Text variant="caption" tone="soft">
                  2. Touch &amp; hold (long-press) any empty space
                </Text>
                <Text variant="caption" tone="soft">
                  3. Tap <Text variant="caption" style={{ fontFamily: F.bold }}>Widgets</Text> and scroll down to <Text variant="caption" style={{ fontFamily: F.bold }}>Hydrate</Text>
                </Text>
                <Text variant="caption" tone="soft">
                  4. Drag the widget and place it on your screen!
                </Text>
              </View>

              <Pressable
                onPress={async () => {
                  await syncWidgetData();
                  Alert.alert('Widget Synced', 'Live widget data refreshed successfully!');
                }}
                style={{
                  backgroundColor: c.accentSoft,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 14,
                }}
              >
                <Text variant="strong" tone="accent">
                  Sync &amp; Test Widget Data ⚡
                </Text>
              </Pressable>
            </Card>
          </Animated.View>

          {/* Appearance */}
          <SectionLabel>Appearance</SectionLabel>
          <Animated.View entering={enter(4)}>
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

          {/* Free Cloud Backup & Sync */}
          <SectionLabel>Cloud backup &amp; sync (Free Tier)</SectionLabel>
          <Animated.View entering={enter(5)}>
            <Card style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="cloud-done" color={c.success} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="strong">Neon Serverless Postgres</Text>
                  <Text variant="caption" tone="faint">
                    {lastSync
                      ? `Last synced: ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Database: Hydrate (plain-math-49378436)'}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                <Pressable
                  onPress={handleTestAndSaveNeon}
                  disabled={syncing}
                  style={{
                    backgroundColor: c.accentSoft,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="strong" tone="accent">
                    {syncing ? 'Connecting…' : 'Test Database Connection ⚡'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleManualSync}
                  disabled={syncing}
                  style={{
                    backgroundColor: c.surfaceAlt,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  <Text variant="strong" tone="soft">
                    {syncing ? 'Backing up…' : 'Backup &amp; Sync to Neon ☁️'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>

          <Text variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: 28 }}>
            Hydrate v1.3.0 (Build 5) · {pending} notifications scheduled
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
