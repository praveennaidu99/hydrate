import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { emitDataChanged } from '../events';
import { handleResponse, refreshGoalChecks, scheduleAll, setupNotifications } from '../notifications';
import { getFirstDay, loadSettings } from '../storage';
import { ThemeProvider, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  useNotificationLifecycle();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-reminder" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

/** Notification setup, button handling, deep links from notifications, refresh on resume. */
function useNotificationLifecycle() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const open = async (r: Notifications.NotificationResponse) => {
      const screen = await handleResponse(r);
      const period = (r.notification.request.content.data as { period?: string } | undefined)?.period;
      if (screen === 'insights') router.navigate({ pathname: '/insights', params: period ? { period } : {} });
      else if (screen === 'water') router.navigate('/');
    };

    (async () => {
      await getFirstDay();
      await setupNotifications(false);
      // Re-create automatic notifications so "behind on water" warnings use today's numbers.
      const settings = await loadSettings();
      if (settings.enabled) await scheduleAll(settings);
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) await open(last);
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(open);
    const appState = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        refreshGoalChecks();
        emitDataChanged(); // picks up water logged from notification buttons, or a new day
      }
    });
    return () => {
      sub.remove();
      appState.remove();
    };
  }, []);
}
