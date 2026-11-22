import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { onDataChanged } from '../../events';
import { cancelReminder, CustomReminder, KINDS, listCustom, scheduleCustom, setupNotifications } from '../../notifications';
import { F, useTheme } from '../../theme';
import { describeReminder } from '../../ui/describe';
import { KIND_UI } from '../../ui/kinds';
import { Card, IconButton, IconTile, PressableScale, SectionLabel, Text } from '../../ui/primitives';
import { enter, Screen } from '../../ui/Screen';

type Template = Omit<CustomReminder, 'id'> & { title: string };

/** One-tap starting points for the most common healthy habits. */
const TEMPLATES: Template[] = [
  { title: 'Morning tablet', kind: 'medicine', message: 'Take your morning tablet with a glass of water', mode: 'daily', hour: 9, minute: 0, days: [], sound: 'bell' },
  { title: 'Healthy snack', kind: 'food', message: 'Snack time: fruit, nuts or yoghurt', mode: 'daily', hour: 16, minute: 0, days: [], sound: 'chime' },
  { title: 'Stretch break', kind: 'exercise', message: 'Stand up, stretch and walk for 2 minutes', mode: 'every', minutes: 120, sound: 'chime' },
  { title: 'Night tablet', kind: 'medicine', message: 'Take your night tablet', mode: 'daily', hour: 21, minute: 0, days: [], sound: 'bell' },
  { title: 'Wind down', kind: 'sleep', message: 'Screens off. Time to get ready for bed', mode: 'daily', hour: 22, minute: 30, days: [], sound: 'chime' },
];

export default function Reminders() {
  const { colors: c } = useTheme();
  const [items, setItems] = useState<CustomReminder[]>([]);

  const refresh = useCallback(() => listCustom().then(setItems), []);
  useEffect(() => {
    refresh();
    return onDataChanged(refresh);
  }, [refresh]);

  const addTemplate = async (t: Template) => {
    if (!(await setupNotifications())) {
      return Alert.alert('Notifications are off', 'Allow notifications in your phone settings to get reminders.');
    }
    const { title: _t, ...spec } = t;
    try {
      await scheduleCustom(spec);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (e) {
      Alert.alert('Could not add reminder', (e as Error).message);
    }
  };

  const remove = (r: CustomReminder) =>
    Alert.alert('Delete this reminder?', r.message, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelReminder(r.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          refresh();
        },
      },
    ]);

  return (
    <Screen
      overline={items.length ? `${items.length} active` : 'Build healthy habits'}
      title="Reminders"
      right={<IconButton icon="add" tone="accent" size={46} label="New reminder" onPress={() => router.push('/new-reminder')} />}
    >
      <Animated.View entering={enter(0)}>
        <SectionLabel>Quick add</SectionLabel>
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ marginHorizontal: -20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {TEMPLATES.map((t) => {
            const ui = KIND_UI[t.kind];
            return (
              <PressableScale key={t.title} onPress={() => addTemplate(t)} accessibilityLabel={`Add ${t.title} reminder`}>
                <Card style={{ width: 150, padding: 14 }}>
                  <IconTile icon={ui.icon} color={ui.color} size={36} />
                  <Text variant="strong" style={{ marginTop: 10 }} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text variant="caption" tone="faint" numberOfLines={1}>
                    {describeReminder({ ...t, id: '' }, true)}
                  </Text>
                  <View style={{ position: 'absolute', top: 12, right: 12 }}>
                    <Ionicons name="add-circle" size={20} color={c.accent} />
                  </View>
                </Card>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Animated.View>

      <SectionLabel>Your reminders</SectionLabel>
      {items.length === 0 ? (
        <Animated.View entering={enter(2)}>
          <Card style={{ alignItems: 'center', paddingVertical: 34 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['medicine', 'food', 'exercise'] as const).map((k, i) => (
                <View key={k} style={{ transform: [{ rotate: `${(i - 1) * 10}deg` }, { translateY: i === 1 ? -6 : 0 }] }}>
                  <IconTile icon={KIND_UI[k].icon} color={KIND_UI[k].color} size={48} />
                </View>
              ))}
            </View>
            <Text variant="headline" style={{ marginTop: 18 }}>
              No reminders yet
            </Text>
            <Text variant="caption" tone="soft" style={{ textAlign: 'center', marginTop: 4, maxWidth: 260 }}>
              Tablets, healthy meals, movement, bedtime: tap a quick add above or create your own.
            </Text>
            <PressableScale onPress={() => router.push('/new-reminder')} style={{ marginTop: 16, backgroundColor: c.accentSoft, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }}>
              <Text variant="strong" tone="accent">
                Create reminder
              </Text>
            </PressableScale>
          </Card>
        </Animated.View>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((r, i) => {
            const ui = KIND_UI[r.kind] ?? KIND_UI.custom;
            return (
              <Animated.View key={r.id} entering={enter(2 + Math.min(i, 6))} exiting={FadeOut.duration(200)} layout={LinearTransition.springify().damping(18)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
                  <IconTile icon={ui.icon} color={ui.color} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text variant="strong" numberOfLines={2}>
                      {r.message}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Text variant="caption" style={{ color: ui.color, fontFamily: F.bold }}>
                        {KINDS[r.kind]?.label ?? 'Reminder'}
                      </Text>
                      <Text variant="caption" tone="faint">
                        · {describeReminder(r)}
                      </Text>
                    </View>
                  </View>
                  <IconButton icon="trash-outline" tone="danger" size={36} label="Delete reminder" onPress={() => remove(r)} />
                </Card>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
