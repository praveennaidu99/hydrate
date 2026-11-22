import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const COLORS = ['#4CC9FF', '#2563EB', '#34D399', '#FBBF24', '#F472B6', '#A78BFA'];

interface Particle {
  angle: number;
  dist: number;
  size: number;
  color: string;
  spin: number;
  round: boolean;
}

/** Deterministic pseudo-random in [0,1): keeps render pure but varies per burst. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** One-shot celebration burst. Change `burstKey` (>0) to fire. */
export function Confetti({ burstKey }: { burstKey: number }) {
  const p = useSharedValue(0);
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const s = burstKey * 100 + i;
        return {
          angle: (i / 34) * Math.PI * 2 + rand(s) * 0.4,
          dist: 110 + rand(s + 0.1) * 120,
          size: 6 + rand(s + 0.2) * 6,
          color: COLORS[i % COLORS.length],
          spin: (rand(s + 0.3) - 0.5) * 720,
          round: i % 3 === 0,
        };
      }),
    [burstKey],
  );

  useEffect(() => {
    if (!burstKey) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) });
  }, [burstKey, p]);

  if (!burstKey) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {particles.map((pt, i) => (
        <Piece key={`${burstKey}-${i}`} pt={pt} p={p} />
      ))}
    </View>
  );
}

function Piece({ pt, p }: { pt: Particle; p: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t === 0 ? 0 : 1 - t * t * t,
      transform: [
        { translateX: Math.cos(pt.angle) * pt.dist * t },
        { translateY: Math.sin(pt.angle) * pt.dist * t + 160 * t * t },
        { rotate: `${pt.spin * t}deg` },
        { scale: 1 - t * 0.4 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: pt.size, height: pt.round ? pt.size : pt.size * 0.45, borderRadius: pt.round ? pt.size : 2, backgroundColor: pt.color },
        style,
      ]}
    />
  );
}
