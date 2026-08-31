import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider, useSelector } from 'react-redux';
import { store, RootState } from './src/redux/store';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/theme/ThemeContext';

const RootNavigator = () => {
  const { isAuthenticated, isGuest } = useSelector((state: RootState) => state.auth);

  return (
    <NavigationContainer>
      {isAuthenticated || isGuest ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemeProvider>
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
