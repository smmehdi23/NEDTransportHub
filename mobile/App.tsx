import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RideFlowProvider } from './src/context/RideFlowContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

interface BoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RideFlowProvider>
            <StatusBar style="dark" />
            <AppNavigator />
          </RideFlowProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  msg: { fontSize: 13, color: colors.ink2, textAlign: 'center' },
  btn: {
    marginTop: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
