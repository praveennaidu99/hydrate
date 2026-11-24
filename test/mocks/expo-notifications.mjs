export const SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export const AndroidImportance = {
  HIGH: 4,
  DEFAULT: 3,
  LOW: 2,
};

let scheduledList = [];

export const setNotificationHandler = () => {};
export const setNotificationChannelAsync = async () => {};
export const setNotificationCategoryAsync = async () => {};
export const getPermissionsAsync = async () => ({ granted: true });
export const requestPermissionsAsync = async () => ({ granted: true });
export const scheduleNotificationAsync = async (req) => {
  scheduledList.push(req);
  return req.identifier;
};
export const getAllScheduledNotificationsAsync = async () => [...scheduledList];
export const cancelScheduledNotificationAsync = async (id) => {
  scheduledList = scheduledList.filter((n) => n.identifier !== id);
};
export const dismissNotificationAsync = async () => {};
export const __resetScheduled = () => {
  scheduledList = [];
};
