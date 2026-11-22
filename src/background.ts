// Runs the notification-button logic when the app is in the background or closed (Android).
// Must be imported at the top of index.ts so the task is defined before the app starts.
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { handleResponse } from './notifications';

const TASK = 'NOTIFICATION_ACTION_TASK';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ('actionIdentifier' in data) {
    await handleResponse(data);
  }
});

if (Platform.OS !== 'web') {
  Notifications.registerTaskAsync(TASK).catch(() => {
    // Not available in Expo Go; buttons still work when the app is open.
  });
}
