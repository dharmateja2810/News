/**
 * Notification Context
 * Provides app-wide notification state and handlers
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
  scheduleDailyDigestNotification,
  cancelAllNotifications,
  clearBadge,
  NotificationSettings,
} from '../services/notificationService';

interface NotificationContextType {
  settings: NotificationSettings;
  pushToken: string | null;
  isLoading: boolean;
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  testNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    dailyDigest: true,
    savedArticleUpdates: false,
  });
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    setupNotificationListeners();
    clearBadge().catch(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await getNotificationSettings();
      setSettings(savedSettings);
      
      if (savedSettings.enabled) {
        try {
          const token = await registerForPushNotifications();
          setPushToken(token);
        } catch (error) {
          // Push notifications may not work in Expo Go - this is expected
          console.log('Push registration skipped (likely Expo Go):', error);
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupNotificationListeners = () => {
    try {
      // Handle notifications received while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

      // Handle notification taps
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });
    } catch (error) {
      console.log('Notification listeners setup skipped:', error);
    }
  };

  const handleNotificationTap = (data: Record<string, unknown>) => {
    console.log('Notification tapped:', data);
    // Navigation would be handled here if using React Navigation
    // For now, just log the tap
  };

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveNotificationSettings(updated);

    // Handle daily digest scheduling
    if (updated.enabled && updated.dailyDigest) {
      try {
        await scheduleDailyDigestNotification();
      } catch (error) {
        console.log('Daily digest scheduling skipped:', error);
      }
    }
  }, [settings]);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Try to register for push notifications
      let token: string | null = null;
      try {
        token = await registerForPushNotifications();
        setPushToken(token);
      } catch (error) {
        // Push may fail in Expo Go - continue anyway for local notifications
        console.log('Push registration failed (Expo Go limitation):', error);
      }
      
      await updateSettings({ enabled: true });
      
      // Send test notification (local - works in Expo Go)
      try {
        await sendTestNotification();
      } catch (error) {
        console.log('Test notification failed:', error);
      }
      
      return true;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateSettings]);

  const disableNotifications = useCallback(async () => {
    await updateSettings({ enabled: false });
    try {
      await cancelAllNotifications();
    } catch (error) {
      console.log('Cancel notifications skipped:', error);
    }
    setPushToken(null);
  }, [updateSettings]);

  const testNotification = useCallback(async () => {
    try {
      await sendTestNotification();
    } catch (error) {
      console.log('Test notification failed:', error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        settings,
        pushToken,
        isLoading,
        updateSettings,
        enableNotifications,
        disableNotifications,
        testNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
