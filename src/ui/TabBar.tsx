import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { alpha, F, useTheme } from '../theme';
import type { IconName } from './kinds';
import { Text } from './primitives';

const META: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Today', icon: 'water-outline', iconActive: 'water' },
  reminders: { label: 'Reminders', icon: 'alarm-outline', iconActive: 'alarm' },
  insights: { label: 'Insights', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Floating, blurred pill tab bar with a spring-animated active indicator. */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { colors: c, isDark } = useTheme();
  const [w, setW] = useState(0);
  const itemW = w / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(state.index * itemW, { damping: 18, stiffness: 220, mass: 0.8 });
  }, [state.index, itemW, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View
        style={[
          styles.bar,
          {
            borderColor: c.line,
            shadowColor: '#0B2540',
            backgroundColor: Platform.OS === 'android' ? alpha(c.surface.slice(0, 7), isDark ? 0.96 : 0.94) : 'transparent',
          },
        ]}
        onLayout={(e) => setW(e.nativeEvent.layout.width - 12)}
      >
        {Platform.OS === 'ios' && <BlurView intensity={60} tint={c.tabTint} style={StyleSheet.absoluteFill} />}
        {w > 0 && (
          <Animated.View style={[styles.indicator, { width: itemW }, indicator]}>
            <LinearGradient colors={[c.waterA, c.waterB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.indicatorFill} />
          </Animated.View>
        )}
        {state.routes.map((route, i) => {
          const meta = META[route.name] ?? { label: route.name, icon: 'ellipse-outline', iconActive: 'ellipse' };
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={() => {
                if (!focused) {
                  Haptics.selectionAsync();
                  navigateToTab(route.key);
                }
              }}
              style={styles.item}
            >
              <Ionicons name={focused ? meta.iconActive : meta.icon} size={21} color={focused ? '#fff' : c.inkSoft} />
              <Text variant="caption" style={{ fontSize: 10.5, fontFamily: F.bold, color: focused ? '#fff' : c.inkSoft, marginTop: 1 }}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'stretch' },
  bar: {
    flexDirection: 'row',
    height: 66,
    borderRadius: 33,
    padding: 6,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  indicator: { position: 'absolute', top: 6, bottom: 6, left: 6, padding: 0 },
  indicatorFill: { flex: 1, borderRadius: 27 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
