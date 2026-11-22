import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import type { DayRecord } from '../storage';
import { Colors, F, useTheme } from '../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { Text } from './primitives';

const ACircle = Animated.createAnimatedComponent(Circle);
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toneFor = (pct: number, c: Colors): [string, string] =>
  pct >= 1 ? [c.success, c.success] : pct >= 0.5 ? [c.waterA, c.waterB] : [c.warn, c.warn];

// ---------------------------------------------------------------- Ring (generic animated arc)

export function Ring({
  pct,
  size,
  stroke,
  colors,
  track,
  delay = 0,
  id,
}: {
  pct: number;
  size: number;
  stroke: number;
  colors: [string, string];
  track: string;
  delay?: number;
  id: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withSpring(Math.min(1, pct), { damping: 18, stiffness: 70 }));
  }, [pct, delay, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </SvgGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <ACircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={`url(#${id})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${C} ${C}`}
        animatedProps={props}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------- Week rings (activity-style)

export function WeekRings({ days }: { days: DayRecord[] }) {
  const { colors: c } = useTheme();
  const todayIdx = days.length - 1;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d, i) => {
        const pct = d.ml / d.goal;
        return (
          <Animated.View key={d.date.getTime()} entering={ZoomIn.delay(120 + i * 60).springify()} style={{ alignItems: 'center', gap: 6 }}>
            <View>
              <Ring pct={pct} size={38} stroke={5} colors={toneFor(pct, c)} track={c.line} delay={200 + i * 60} id={`wr${i}`} />
              {pct >= 1 && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.success }} />
                </View>
              )}
            </View>
            <Text variant="caption" tone={i === todayIdx ? 'accent' : 'faint'} style={{ fontFamily: i === todayIdx ? F.extrabold : F.semibold }}>
              {WEEKDAY[d.date.getDay()]}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Score ring (Insights hero)

export function ScoreRing({ score, colors }: { score: number; colors: [string, string] }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFill}>
        <Ring pct={score / 100} size={132} stroke={12} colors={colors} track={c.line} id="score" delay={150} />
      </View>
      <AnimatedNumber value={score} style={{ fontFamily: F.extrabold, fontSize: 38, letterSpacing: -1.5, color: c.ink, textAlign: 'center', minWidth: 80 }} />
      <Text variant="overline" tone="faint" style={{ marginTop: -4 }}>
        score
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- Bar chart (spring bars + tap tooltip)

export function BarChart({ days, height = 170 }: { days: DayRecord[]; height?: number }) {
  const { colors: c } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  // Reset the selection when the range changes (adjust state during render, no effect).
  const [range, setRange] = useState(days.length);
  if (range !== days.length) {
    setRange(days.length);
    setSel(null);
  }
  if (days.length === 0) return null;

  const goal = days[days.length - 1].goal;
  const max = Math.max(goal, ...days.map((d) => d.ml)) * 1.12;
  const goalY = height * (goal / max);
  const many = days.length > 10;
  const selDay = sel !== null ? days[sel] : null;

  return (
    <View>
      <View style={{ height: 34, justifyContent: 'center' }}>
        {selDay ? (
          <Animated.View key={sel} entering={FadeIn.duration(180)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="headline">{selDay.ml.toLocaleString()} ml</Text>
            <Text variant="caption" tone="soft">
              {selDay.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {Math.round((selDay.ml / selDay.goal) * 100)}% of goal
            </Text>
          </Animated.View>
        ) : (
          <Text variant="caption" tone="faint">
            Tap a bar for details
          </Text>
        )}
      </View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: many ? 3 : 10, marginTop: 6 }}>
        {days.map((d, i) => (
          <Bar
            key={d.date.getTime()}
            h={Math.max(4, height * (d.ml / max))}
            colors={toneFor(d.ml / d.goal, c)}
            delay={i * (many ? 18 : 55)}
            radius={many ? 4 : 10}
            dim={sel !== null && sel !== i}
            onPress={() => {
              Haptics.selectionAsync();
              setSel(sel === i ? null : i);
            }}
          />
        ))}
        <View pointerEvents="none" style={[styles.goalLine, { bottom: goalY, borderColor: c.inkFaint }]} />
        <View pointerEvents="none" style={[styles.goalTag, { bottom: goalY - 9, backgroundColor: c.surfaceAlt }]}>
          <Text variant="caption" tone="soft" style={{ fontSize: 10, fontFamily: F.bold }}>
            GOAL
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: many ? 3 : 10, marginTop: 8 }}>
        {days.map((d, i) => (
          <Text key={i} variant="caption" tone={sel === i ? 'accent' : 'faint'} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {!many ? WEEKDAY[d.date.getDay()] : i % 5 === 0 || i === days.length - 1 ? d.date.getDate() : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({
  h,
  colors,
  delay,
  radius,
  dim,
  onPress,
}: {
  h: number;
  colors: [string, string];
  delay: number;
  radius: number;
  dim: boolean;
  onPress: () => void;
}) {
  const v = useSharedValue(0);
  const o = useSharedValue(1);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(h, { damping: 16, stiffness: 120 }));
  }, [h, delay, v]);
  useEffect(() => {
    o.value = withSpring(dim ? 0.35 : 1);
  }, [dim, o]);
  const st = useAnimatedStyle(() => ({ height: v.value, opacity: o.value }));
  return (
    <Pressable onPress={onPress} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }} hitSlop={4}>
      <Animated.View style={[{ borderRadius: radius, overflow: 'hidden' }, st]}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  goalTag: { position: 'absolute', right: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
