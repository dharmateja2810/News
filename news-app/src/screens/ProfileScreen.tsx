/**
 * Profile Screen - Simple Version
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { updateTheme } from '../services/usersApi';

export const ProfileScreen: React.FC = () => {
  const { isDark, toggleTheme, colors } = useTheme();
  const { user, logout, setUser } = useAuth();
  const { settings, updateSettings, enableNotifications, disableNotifications, testNotification, isLoading } = useNotifications();
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const handleNotificationToggle = async () => {
    setNotificationLoading(true);
    try {
      if (!settings.enabled) {
        const success = await enableNotifications();
        if (!success) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive updates.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await disableNotifications();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        {/* Profile Info */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}> 
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="moon-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={async (next) => {
                // Update UI immediately
                toggleTheme();
                // Sync to backend (best-effort)
                try {
                  const updated = await updateTheme(next ? 'dark' : 'light');
                  await setUser(updated);
                } catch {
                  // ignore; local preference still applies
                }
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface }]}
            onPress={() => setShowNotificationSettings(!showNotificationSettings)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
            </View>
            <View style={styles.menuItemRight}>
              {notificationLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Switch
                  value={settings.enabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              )}
            </View>
          </TouchableOpacity>

          {/* Notification Sub-settings */}
          {showNotificationSettings && settings.enabled && (
            <View style={styles.subSettings}>
              <View style={[styles.subMenuItem, { backgroundColor: colors.surface }]}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="newspaper-outline" size={20} color={colors.textSecondary} style={styles.subMenuIcon} />
                  <Text style={[styles.subMenuText, { color: colors.text }]}>Daily Digest</Text>
                </View>
                <Switch
                  value={settings.dailyDigest}
                  onValueChange={(value) => updateSettings({ dailyDigest: value })}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity
                style={[styles.subMenuItem, { backgroundColor: colors.surface }]}
                onPress={testNotification}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="send-outline" size={20} color={colors.textSecondary} style={styles.subMenuIcon} />
                  <Text style={[styles.subMenuText, { color: colors.text }]}>Send Test Notification</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>About</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={() => void logout()}
          >
            <Ionicons name="log-out-outline" size={24} color="#ef4444" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f4c75',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#999',
  },
  menuSection: {
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subSettings: {
    marginLeft: 20,
    marginBottom: 8,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  subMenuIcon: {
    marginRight: 12,
  },
  subMenuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutItem: {
    marginTop: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: {
    color: '#ef4444',
  },
});
