import { Accelerometer } from 'expo-sensors';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { mlToOz, VolumeUnit } from '../units';
import { F, useTheme } from '../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { Text } from './primitives';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

const TAU = Math.PI * 2;

/** Closed SVG path of a sine-wave water surface filling `size` up to `level` (0..1). */
function wavePath(level: number, phase: number, amp: number, size: number, freq: number) {
  'worklet';
  const y0 = size * (1 - level);
  let d = `M 0 ${y0 + amp * Math.sin(phase)}`;
  const steps = 28;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * size;
    d += ` L ${x} ${y0 + amp * Math.sin((x / size) * TAU * freq + phase)}`;
  }
  return `${d} L ${size} ${size + 4} L 0 ${size + 4} Z`;
}

interface Props {
  ml: number;
  goal: number;
  /** Increment to make the water slosh (e.g. after adding a drink). */
  sloshKey: number;
  size?: number;
  unit?: VolumeUnit;
}

/**
 * The hero: a liquid orb with a two-layer sine wave, a gradient progress ring,
 * device-tilt physics and a count-up number.
 */
export function LiquidOrb({ ml, goal, sloshKey, size = 268, unit = 'ml' }: Props) {
  const { colors: c, isDark } = useTheme();
  const reduceMotion = useReducedMotion();

  const ring = 12;
  const gap = 8;
  const inner = size - (ring + gap) * 2;
  const R = (size - ring) / 2;
  const C = TAU * R;
  const pct = goal > 0 ? ml / goal : 0;

  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const amp = useSharedValue(6);
  const tilt = useSharedValue(0);
  const progress = useSharedValue(0);

  // Level & ring: spring to target.
  useEffect(() => {
    const target = Math.min(1, pct);
    // Keep a sliver of water visible at 0% so the wave still reads as "liquid".
    level.value = withSpring(Math.max(0.04, Math.min(0.97, target)), { damping: 14, stiffness: 55 });
    progress.value = withSpring(target, { damping: 18, stiffness: 70 });
  }, [pct, level, progress]);

  // Endless wave motion.
  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(withTiming(TAU, { duration: 3800, easing: Easing.linear }), -1, false);
  }, [phase, reduceMotion]);

  // Slosh after a drink is added.
  useEffect(() => {
    if (sloshKey === 0 || reduceMotion) return;
    amp.value = withSequence(withTiming(16, { duration: 160 }), withSpring(6, { damping: 4, stiffness: 40 }));
  }, [sloshKey, amp, reduceMotion]);

  // Tilt the water with the phone.
  useEffect(() => {
    if (reduceMotion || Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    Accelerometer.isAvailableAsync().then((ok) => {
      if (!ok) return;
      Accelerometer.setUpdateInterval(80);
      sub = Accelerometer.addListener(({ x }) => {
        const clamped = Math.max(-0.6, Math.min(0.6, x));
        tilt.value = withSpring((Platform.OS === 'ios' ? -clamped : clamped) * 28, { damping: 12, stiffness: 60 });
      });
    });
    return () => sub?.remove();
  }, [tilt, reduceMotion]);

  const backWave = useAnimatedProps(() => ({
    d: wavePath(level.value, phase.value + Math.PI, amp.value * 1.25, inner, 1.1),
  }));
  const frontWave = useAnimatedProps(() => ({
    d: wavePath(level.value, phase.value, amp.value, inner, 1.35),
  }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));
  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  // Number sits on top of the water once the water reaches it.
  const textColor = useAnimatedStyle(() => ({
    color: interpolateColor(level.value, [0.42, 0.52], [c.ink, '#FFFFFF']),
  }));
  const subColor = useAnimatedStyle(() => ({
    color: interpolateColor(level.value, [0.3, 0.4], [c.inkSoft, 'rgba(255,255,255,0.86)']),
  }));

  const ids = useMemo(() => ({ clip: 'orbClip', water: 'orbWater', ring: 'orbRing' }), []);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Progress ring */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={ids.ring} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.waterA} />
            <Stop offset="1" stopColor={c.waterB} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={R} stroke={c.line} strokeWidth={ring} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={R}
          stroke={`url(#${ids.ring})`}
          strokeWidth={ring}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Orb body */}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: 'hidden',
          backgroundColor: isDark ? '#0A1C2B' : '#EAF5FF',
        }}
      >
        <Animated.View style={[{ width: inner, height: inner }, tiltStyle]}>
          <Svg width={inner} height={inner}>
            <Defs>
              <ClipPath id={ids.clip}>
                <Circle cx={inner / 2} cy={inner / 2} r={inner / 2} />
              </ClipPath>
              <LinearGradient id={ids.water} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.waterA} />
                <Stop offset="1" stopColor={c.waterB} />
              </LinearGradient>
            </Defs>
            <G clipPath={`url(#${ids.clip})`}>
              <APath animatedProps={backWave} fill={c.waterA} opacity={0.35} />
              <APath animatedProps={frontWave} fill={`url(#${ids.water})`} />
            </G>
          </Svg>
        </Animated.View>

        {/* Glass highlight for depth */}
        <Svg width={inner} height={inner} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse cx={inner * 0.32} cy={inner * 0.24} rx={inner * 0.16} ry={inner * 0.07} fill="#fff" opacity={0.28} transform={`rotate(-32 ${inner * 0.32} ${inner * 0.24})`} />
          <Circle cx={inner / 2} cy={inner / 2} r={inner / 2 - 1} stroke="#fff" strokeOpacity={isDark ? 0.06 : 0.6} strokeWidth={2} fill="none" />
        </Svg>

        {/* Center label */}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <AnimatedNumber
            value={unit === 'oz' ? Math.round(mlToOz(ml)) : ml}
            style={{ fontFamily: F.extrabold, fontSize: 50, letterSpacing: -2, textAlign: 'center', minWidth: 160 }}
            animatedStyle={textColor}
          />
          <Animated.Text style={[{ fontFamily: F.semibold, fontSize: 14, marginTop: -2 }, subColor]}>
            of {unit === 'oz' ? `${Math.round(mlToOz(goal))} fl oz` : `${goal.toLocaleString()} ml`} · {Math.round(pct * 100)}%
          </Animated.Text>
        </View>
      </View>
      <Text variant="caption" tone="faint" style={{ position: 'absolute', bottom: -26 }}>
        Hold the orb to pour
      </Text>
    </View>
  );
}
