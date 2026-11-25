import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../ui/primitives';
import { useTheme } from '../theme';

export default function NotFoundScreen() {
  const { colors: c } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      <Text variant="display">🌊</Text>
      <Text variant="title">Hydrate</Text>
      <Text variant="body" tone="faint" style={{ textAlign: 'center' }}>
        Returning to your hydration dashboard…
      </Text>
      <Pressable
        onPress={() => router.replace('/')}
        style={{
          marginTop: 12,
          backgroundColor: c.accent,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 12,
        }}
      >
        <Text variant="strong" style={{ color: '#fff' }}>
          Back to Today
        </Text>
      </Pressable>
    </View>
  );
}
