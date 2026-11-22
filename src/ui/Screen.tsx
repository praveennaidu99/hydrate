import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Text } from './primitives';

export const TAB_BAR_SPACE = 110;

/** Scrollable page with an ambient top glow and a large editorial header. */
export function Screen({
  overline,
  title,
  right,
  children,
}: {
  overline?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient
        colors={[c.bgGlow, c.bg]}
        locations={[0, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(500).springify()}
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}
        >
          <View style={{ flex: 1 }}>
            {overline ? (
              <Text variant="overline" tone="soft">
                {overline}
              </Text>
            ) : null}
            <Text variant="title" style={{ marginTop: 2 }} accessibilityRole="header">
              {title}
            </Text>
          </View>
          {right}
        </Animated.View>
        {children}
      </ScrollView>
    </View>
  );
}

/** Stagger helper: children enter one after another. */
export const enter = (i: number) => FadeInDown.delay(80 + i * 70).duration(520).springify().damping(18);
