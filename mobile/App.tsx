import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RideFlowProvider } from './src/context/RideFlowContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RideFlowProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </RideFlowProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
