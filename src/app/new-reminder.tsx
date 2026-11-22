import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomReminder, Kind, KINDS, ReminderMode, scheduleCustom, sendTest, setupNotifications, SOUNDS } from '../notifications';
import type { SoundName } from '../storage';
import { alpha, F, radius, useTheme } from '../theme';
import { describeReminder, fmtDateTime, fmtTime } from '../ui/describe';
import { KIND_UI } from '../ui/kinds';
import {
  FadeSwap,
  GradientButton,
  IconButton,
  IconTile,
  Pills,
  PressableScale,
  Segmented,
  Stepper,
  Text,
} from '../ui/primitives';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const KIND_DEFAULTS: Record<Kind, { mode: ReminderMode; sound: SoundName; hour?: number; minutes?: number }> = {
  medicine: { mode: 'daily', sound: 'bell', hour: 9 },
  food: { mode: 'daily', sound: 'chime', hour: 16 },
  exercise: { mode: 'every', sound: 'chime', minutes: 120 },
  sleep: { mode: 'daily', sound: 'chime', hour: 22 },
  water: { mode: 'every', sound: 'drop', minutes: 60 },
  custom: { mode: 'in', sound: 'default', minutes: 30 },
};

export default function NewReminder() {
  const { colors: c, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<Kind>('medicine');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<ReminderMode>('daily');
  const [minutes, setMinutes] = useState(30);
  const [date, setDate] = useState(() => new Date(Date.now() + 3600000));
  const [time, setTime] = useState(() => new Date(2000, 0, 1, 9, 0));
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [sound, setSound] = useState<SoundName>('bell');
  const [saving, setSaving] = useState(false);
  const [openedAt] = useState(() => Date.now()); // for the "Once in X min" preview

  const chooseKind = (k: Kind) => {
    setKind(k);
    const d = KIND_DEFAULTS[k];
    setMode(d.mode);
    setSound(d.sound);
    if (d.hour !== undefined) setTime(new Date(2000, 0, 1, d.hour, 0));
    if (d.minutes !== undefined) setMinutes(d.minutes);
  };

  const spec: Omit<CustomReminder, 'id'> = {
    kind,
    message: message.trim() || KINDS[kind].defaultMsg,
    mode,
    sound,
    minutes: mode === 'in' || mode === 'every' ? minutes : undefined,
    at: mode === 'at' ? date.getTime() : undefined,
    hour: mode === 'daily' ? time.getHours() : undefined,
    minute: mode === 'daily' ? time.getMinutes() : undefined,
    days: mode === 'daily' ? days : undefined,
  };

  const create = async () => {
    if (mode === 'daily' && days.length === 0) return Alert.alert('Pick at least one day');
    setSaving(true);
    try {
      if (!(await setupNotifications())) {
        Alert.alert('Notifications are off', 'Allow notifications in your phone settings.');
        return;
      }
      await scheduleCustom(spec);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('Could not set reminder', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pickDateAndroid = () =>
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      minimumDate: new Date(),
      onValueChange: (_e, picked) =>
        DateTimePickerAndroid.open({ value: picked, mode: 'time', onValueChange: (_e2, t) => setDate(t) }),
    });
  const pickTimeAndroid = () => DateTimePickerAndroid.open({ value: time, mode: 'time', onValueChange: (_e, t) => setTime(t) });

  const ui = KIND_UI[kind];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 10, paddingBottom: 8 }}>
        <Text variant="title">New reminder</Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Category */}
        <Label>{"What's it for?"}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(Object.keys(KINDS) as Kind[]).map((k, i) => {
            const active = k === kind;
            const kUi = KIND_UI[k];
            return (
              <Animated.View key={k} entering={FadeInDown.delay(i * 40).springify()} style={{ width: '31.3%' }}>
                <PressableScale
                  onPress={() => chooseKind(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderRadius: radius.md + 2,
                    borderWidth: 2,
                    borderColor: active ? kUi.color : c.line,
                    backgroundColor: active ? alpha(kUi.color, isDark ? 0.16 : 0.08) : c.surface,
                  }}
                >
                  <IconTile icon={kUi.icon} color={kUi.color} size={38} />
                  <Text variant="caption" style={{ marginTop: 6, fontFamily: active ? F.bold : F.semibold, color: active ? kUi.color : c.ink }}>
                    {KINDS[k].label}
                  </Text>
                  {active && (
                    <View style={{ position: 'absolute', top: 6, right: 6 }}>
                      <Ionicons name="checkmark-circle" size={18} color={kUi.color} />
                    </View>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* Message */}
        <Label>Message</Label>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={KINDS[kind].defaultMsg}
          placeholderTextColor={c.inkFaint}
          multiline
          style={{
            fontFamily: F.medium,
            fontSize: 16,
            color: c.ink,
            backgroundColor: c.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.line,
            padding: 14,
            minHeight: 54,
          }}
        />

        {/* When */}
        <Label>When</Label>
        <Segmented<ReminderMode>
          value={mode}
          onChange={setMode}
          options={[
            { label: 'Daily', value: 'daily' },
            { label: 'Once in', value: 'in' },
            { label: 'Repeat', value: 'every' },
            { label: 'Date', value: 'at' },
          ]}
        />

        <FadeSwap k={mode}>
          <View style={{ marginTop: 16, backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.line, gap: 14 }}>
            {mode === 'daily' && (
              <>
                <Row label="Time">
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker value={time} mode="time" display="compact" themeVariant={isDark ? 'dark' : 'light'} onValueChange={(_e, t) => setTime(t)} />
                  ) : (
                    <ValueButton text={fmtTime(time.getHours(), time.getMinutes())} icon="time-outline" onPress={pickTimeAndroid} />
                  )}
                </Row>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {ALL_DAYS.map((d) => {
                    const on = days.includes(d);
                    return (
                      <PressableScale
                        key={d}
                        onPress={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? ui.color : c.surfaceAlt }}
                      >
                        <Text variant="caption" style={{ fontFamily: F.bold, color: on ? '#fff' : c.inkSoft }}>
                          {DAY_LABELS[d - 1]}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </>
            )}

            {(mode === 'in' || mode === 'every') && (
              <>
                <Row label={mode === 'in' ? 'Remind me in' : 'Repeat every'}>
                  <Stepper value={minutes} onChange={setMinutes} step={minutes >= 60 ? 15 : 5} min={1} max={720} format={(m) => (m < 60 ? `${m} min` : `${(m / 60).toFixed(m % 60 ? 1 : 0)} h`)} />
                </Row>
                <Pills
                  value={minutes}
                  onChange={setMinutes}
                  options={[5, 15, 30, 60, 120, 240].map((m) => ({ label: m < 60 ? `${m}m` : `${m / 60}h`, value: m }))}
                />
              </>
            )}

            {mode === 'at' && (
              <Row label="Date & time">
                {Platform.OS === 'ios' ? (
                  <DateTimePicker value={date} mode="datetime" display="compact" minimumDate={new Date()} themeVariant={isDark ? 'dark' : 'light'} onValueChange={(_e, d) => setDate(d)} />
                ) : (
                  <ValueButton text={fmtDateTime(date)} icon="calendar-outline" onPress={pickDateAndroid} />
                )}
              </Row>
            )}
          </View>
        </FadeSwap>

        {/* Sound */}
        <Label>Sound</Label>
        <Pills
          value={sound}
          onChange={(s) => {
            setSound(s);
            sendTest(s).catch(() => {});
          }}
          options={SOUNDS.map((s) => ({ label: s.label.replace(/^\S+\s/, ''), value: s.value, icon: 'musical-note' as const }))}
        />
        <Text variant="caption" tone="faint" style={{ marginTop: 8 }}>
          Tap a sound to preview it.
        </Text>

        {/* Preview */}
        <Label>Preview</Label>
        <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
          <IconTile icon={ui.icon} color={ui.color} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="strong">{KINDS[kind].title}</Text>
            <Text variant="caption" tone="soft">
              {spec.message}
            </Text>
            <Text variant="caption" tone="faint" style={{ marginTop: 4 }}>
              {describeReminder({ ...spec, id: `custom-${openedAt}` })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: alpha(c.bg, 0.94) }}>
        <GradientButton label={saving ? 'Saving…' : 'Create reminder'} icon="checkmark" onPress={create} disabled={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="overline" tone="faint" style={{ marginTop: 24, marginBottom: 10, marginLeft: 2 }}>
      {children}
    </Text>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text variant="strong">{label}</Text>
      {children}
    </View>
  );
}

function ValueButton({ text, icon, onPress }: { text: string; icon: 'time-outline' | 'calendar-outline'; onPress: () => void }) {
  const { colors: c } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}>
      <Ionicons name={icon} size={16} color={c.accent} />
      <Text variant="strong" tone="accent">
        {text}
      </Text>
    </PressableScale>
  );
}
