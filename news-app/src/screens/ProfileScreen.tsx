/**
 * Profile Screen - Simple Version
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export const ProfileScreen: React.FC = () => {
  const { isDark, toggleTheme, colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>
        
        {/* Profile Info */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>U</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>User Name</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>user@example.com</Text>
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
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>About</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]}>
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
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutItem: {
    marginTop: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: {
    color: '#ef4444',
  },
});
