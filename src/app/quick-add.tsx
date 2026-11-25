import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { handleWidgetUrl } from '../widgets/widget-sync';
import { Text } from '../ui/primitives';
import { useTheme } from '../theme';

/**
 * Route handler for widget quick-add deep links:
 * `hydrate://quick-add?ml=250` or `hydrate://quick-add?ml=500`
 */
export default function QuickAddScreen() {
  const { ml } = useLocalSearchParams<{ ml?: string }>();
  const { colors: c } = useTheme();

  useEffect(() => {
    const amount = typeof ml === 'string' ? parseInt(ml, 10) : 250;
    const url = `hydrate://quick-add?ml=${amount > 0 ? amount : 250}`;

    handleWidgetUrl(url).finally(() => {
      // Smoothly navigate directly to the Today dashboard
      router.replace('/');
    });
  }, [ml]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <ActivityIndicator size="large" color={c.accent} />
      <Text variant="strong">Logging {ml ? `${ml} ml` : 'water'}…</Text>
    </View>
  );
}
