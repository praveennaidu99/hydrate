import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { alpha, elevation, F, radius, useTheme } from '../theme';
import type { IconName } from './kinds';

// ---------------------------------------------------------------- Typography

const VARIANTS = {
  display: { fontFamily: F.extrabold, fontSize: 52, lineHeight: 58, letterSpacing: -2 },
  title: { fontFamily: F.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  headline: { fontFamily: F.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: F.medium, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: F.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: F.medium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: F.bold, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type Variant = keyof typeof VARIANTS;
type Tone = 'ink' | 'soft' | 'faint' | 'accent' | 'onAccent' | 'success' | 'warn' | 'danger';

export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors: c } = useTheme();
  const color = {
    ink: c.ink,
    soft: c.inkSoft,
    faint: c.inkFaint,
    accent: c.accent,
    onAccent: c.onAccent,
    success: c.success,
    warn: c.warn,
    danger: c.danger,
  }[tone];
  return <RNText {...rest} style={[VARIANTS[variant], { color, fontVariant: ['tabular-nums'] }, style]} />;
}

// ---------------------------------------------------------------- Pressable with spring scale

const APressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean; children?: ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        s.set(withSpring(scaleTo, { damping: 18, stiffness: 420 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, { damping: 12, stiffness: 300 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
}

// ---------------------------------------------------------------- Surfaces

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors: c, isDark } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.lg, padding: padded ? 18 : 0 },
        elevation(c, isDark),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconTile({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: alpha(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function GradientButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient
        colors={[c.waterA, c.waterB]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradBtn}
      >
        {icon && <Ionicons name={icon} size={20} color="#fff" />}
        <RNText style={styles.gradLabel}>{label}</RNText>
      </LinearGradient>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  tone = 'soft',
  size = 40,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: 'soft' | 'accent' | 'danger';
  size?: number;
  label: string;
}) {
  const { colors: c } = useTheme();
  const bg = tone === 'accent' ? c.accent : tone === 'danger' ? c.dangerSoft : c.surfaceAlt;
  const fg = tone === 'accent' ? c.onAccent : tone === 'danger' ? c.danger : c.inkSoft;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={size * 0.48} color={fg} />
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Segmented control (sliding thumb)

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors: c, isDark } = useTheme();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const segW = w / options.length;

  useEffect(() => {
    x.value = withSpring(idx * segW, { damping: 20, stiffness: 260 });
  }, [idx, segW, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)}
      style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 4 }}
    >
      {w > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: segW,
              borderRadius: radius.md - 4,
              backgroundColor: c.surface,
            },
            elevation(c, isDark),
            thumb,
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              if (!active) Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text variant="caption" tone={active ? 'ink' : 'soft'} style={{ fontFamily: active ? F.bold : F.semibold }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Toggle (custom switch)

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors: c } = useTheme();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 240 });
  }, [value, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [c.surfaceAlt, c.accent]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 20 }, { scale: 1 + Math.sin(p.value * Math.PI) * 0.12 }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={10}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.track, { borderColor: c.line }, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Stepper

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format,
  big,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  big?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 18 : 10 }}>
      <IconButton icon="remove" label="Decrease" size={big ? 44 : 34} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant={big ? 'title' : 'strong'} style={{ minWidth: big ? 110 : 78, textAlign: 'center' }}>
        {format(value)}
      </Text>
      <IconButton icon="add" label="Increase" size={big ? 44 : 34} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

// ---------------------------------------------------------------- Pill chips

export function Pills<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: active ? c.accent : c.surfaceAlt,
            }}
          >
            {o.icon && <Ionicons name={o.icon} size={15} color={active ? c.onAccent : c.inkSoft} />}
            <Text variant="caption" tone={active ? 'onAccent' : 'soft'} style={{ fontFamily: F.bold }}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Banner

export type BannerTone = 'success' | 'warn' | 'danger' | 'info';

export function Banner({
  tone,
  icon,
  title,
  text,
  action,
  onPress,
}: {
  tone: BannerTone;
  icon: IconName;
  title: string;
  text: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors: c } = useTheme();
  const fg = { success: c.success, warn: c.warn, danger: c.danger, info: c.accent }[tone];
  const bg = { success: c.successSoft, warn: c.warnSoft, danger: c.dangerSoft, info: c.accentSoft }[tone];
  return (
    <PressableScale onPress={onPress} disabled={!onPress} haptic={!!onPress} scaleTo={0.98}>
      <View style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: bg }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: alpha(fg.slice(0, 7), 0.16), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="strong" style={{ color: fg }}>
            {title}
          </Text>
          <Text variant="caption" tone="ink" style={{ marginTop: 2, opacity: 0.85 }}>
            {text}
          </Text>
          {action && (
            <Text variant="caption" style={{ color: fg, fontFamily: F.bold, marginTop: 8 }}>
              {action} →
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Section label

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }}>
      <Text variant="overline" tone="faint">
        {children}
      </Text>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- Fade/slide swap (for content that changes)

export function FadeSwap({ k, children }: { k: string | number; children: ReactNode }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = 0;
    o.value = withTiming(1, { duration: 260 });
  }, [k, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 8 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  gradBtn: {
    height: 58,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gradLabel: { color: '#fff', fontFamily: F.bold, fontSize: 16, letterSpacing: 0.2 },
  track: { width: 52, height: 32, borderRadius: 16, padding: 3, borderWidth: 1 },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
