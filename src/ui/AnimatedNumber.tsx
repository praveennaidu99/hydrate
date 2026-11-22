import { useEffect } from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

const ATextInput = Animated.createAnimatedComponent(TextInput);

const fmt = (n: number) => {
  'worklet';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** A number that counts up/down smoothly on the UI thread. */
export function AnimatedNumber({
  value,
  style,
  suffix = '',
  animatedStyle,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  animatedStyle?: object;
}) {
  const v = useSharedValue(value);
  useEffect(() => {
    v.value = withTiming(value, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [value, v]);

  const props = useAnimatedProps(() => ({ text: fmt(v.value) + suffix }) as object);

  return (
    <ATextInput
      editable={false}
      underlineColorAndroid="transparent"
      defaultValue={fmt(value) + suffix}
      animatedProps={props}
      accessibilityLabel={`${Math.round(value)}${suffix}`}
      style={[{ padding: 0, margin: 0, fontVariant: ['tabular-nums'] }, style, animatedStyle]}
    />
  );
}
