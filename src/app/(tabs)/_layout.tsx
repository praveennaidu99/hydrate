import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../theme';
import { TabBar } from '../../ui/TabBar';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="reminders" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
