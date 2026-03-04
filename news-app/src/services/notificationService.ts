/**
 * Notification Service
 * Handles push notifications using Expo Notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_SETTINGS_KEY = '@daily_digest_notification_settings';
const PUSH_TOKEN_KEY = '@daily_digest_push_token';

export interface NotificationSettings {
  enabled: boolean;
  breakingNews: boolean;
  dailyDigest: boolean;
  savedArticleUpdates: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  breakingNews: true,
  dailyDigest: true,
  savedArticleUpdates: false,
};

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (projectId) {
      const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
      token = pushToken.data;
    } else {
      // Fallback for development
      const pushToken = await Notifications.getExpoPushTokenAsync();
      token = pushToken.data;
    }
    
    // Save token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // Android-specific channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    });

    await Notifications.setNotificationChannelAsync('breaking-news', {
      name: 'Breaking News',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#ef4444',
    });

    await Notifications.setNotificationChannelAsync('daily-digest', {
      name: 'Daily Digest',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#3b82f6',
    });
  }

  return token;
}

/**
 * Get saved push token
 */
export async function getSavedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error getting notification settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save notification settings
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds: number = 1
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
  return id;
}

/**
 * Schedule daily digest notification
 */
export async function scheduleDailyDigestNotification(hour: number = 8, minute: number = 0): Promise<string | null> {
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.dailyDigest) {
    return null;
  }

  // Cancel existing daily digest notifications
  await cancelNotificationsByTag('daily-digest');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📰 Your Daily Digest is Ready',
      body: 'Check out the top stories curated for you today!',
      data: { type: 'daily-digest' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

/**
 * Send immediate notification (for testing)
 */
export async function sendTestNotification(): Promise<void> {
  await scheduleLocalNotification(
    '🔔 Notifications Enabled!',
    'You will now receive news updates and alerts.',
    { type: 'test' },
    1
  );
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/**
 * Cancel notifications by tag/type
 */
export async function cancelNotificationsByTag(tag: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === tag) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
