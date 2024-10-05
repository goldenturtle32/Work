import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import Auth Screens
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import AttributeSelectionScreen from './src/screens/AttributeSelectionScreen'; // Import AttributeSelectionScreen

// Import App Screens
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import JobList from './src/components/JobList';
import JobDetailScreen from './src/screens/JobDetailScreen';
import AvailabilityScreen from './src/screens/AvailabilityScreen';
import PaymentScreen from './src/screens/PaymentScreen'; // Add PaymentScreen
import ChatScreen from './src/screens/ChatScreen'; // Import ChatScreen

// Import Firebase Auth from firebase.js
import { auth } from './src/firebase';

const Stack = createStackNavigator();

// Auth Stack: Login and SignUp
const AuthStack = () => (
  <Stack.Navigator initialRouteName="Login">
    <Stack.Screen 
      name="Login" 
      component={LoginScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="SignUp" 
      component={SignUpScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="AttributeSelection" 
      component={AttributeSelectionScreen} // Add this screen
      options={{ headerShown: false }} // Modify options as needed
    />
  </Stack.Navigator>
);

// App Stack: All other screens
const AppStack = () => (
  <Stack.Navigator initialRouteName="Home">
    <Stack.Screen 
      name="Home" 
      component={HomeScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{ title: 'Profile' }}
    />
    <Stack.Screen 
      name="Settings" 
      component={SettingsScreen} 
      options={{ title: 'Settings' }}
    />
    <Stack.Screen 
      name="Matches" 
      component={MatchesScreen} 
      options={{ title: 'Matches' }}
    />
    <Stack.Screen 
      name="JobList" 
      component={JobList} 
      options={{ title: 'Job List' }}
    />
    <Stack.Screen 
      name="JobDetail" 
      component={JobDetailScreen} 
      options={{ title: 'Job Details' }}
    />
    <Stack.Screen 
      name="Availability"  
      component={AvailabilityScreen} 
      options={{ title: 'Availability' }}
    />
    <Stack.Screen 
      name="Payment"  
      component={PaymentScreen} 
      options={{ title: 'Payment' }}
    />
    <Stack.Screen 
      name="Chat" 
      component={ChatScreen} 
      options={{ title: 'Chat' }}
    />
  </Stack.Navigator>
);

export default function App() {
  // Ignore specific warnings temporarily
  useEffect(() => {
    LogBox.ignoreLogs(['Setting a timer']);
  }, []);

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Handle user state changes
  function onAuthStateChanged(user) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth.onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
