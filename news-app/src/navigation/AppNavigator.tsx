/**
 * App Navigator - Main navigation structure
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuth } from '../contexts/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { LoadingSpinner } from '../components';

const RootStack = createStackNavigator();

export function AppNavigator() {
  const { isBootstrapping, token } = useAuth();

  if (isBootstrapping) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          // Authenticated Stack
          <RootStack.Screen name="Home" component={HomeScreen} />
        ) : (
          // Auth Stack
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

