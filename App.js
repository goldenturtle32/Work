// App.js
import React, { useState, useEffect } from 'react';
import { 
  ActivityIndicator, 
  View, 
  StyleSheet, 
  LogBox 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import Auth Screens
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';

// Import App Screens
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import JobList from './src/components/JobList';
import JobDetailScreen from './src/screens/JobDetailScreen';
import AvailabilityScreen from './src/screens/AvailabilityScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ChatScreen from './src/screens/ChatScreen'; 

// Import Attribute Selection Screen
import AttributeSelectionScreen from './src/screens/AttributeSelectionScreen'; 

// Import Firebase Auth and Firestore from firebase.js
import { auth, db } from './src/firebase';
import { SetupProvider } from './src/contexts/SetupContext';

// Import Setup Screens
import BasicInfoScreen from './src/screens/setup/BasicInfoScreen';
import LocationPreferencesScreen from './src/screens/setup/LocationPreferencesScreen';
import JobPreferencesScreen from './src/screens/setup/JobPreferencesScreen';
import UserOverviewScreen from './src/screens/setup/UserOverviewScreen';

import AppNavigator from './src/navigation/AppNavigator';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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
  </Stack.Navigator>
);

// Create MainTabs component for bottom tab navigation
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'HomeTab') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        } else if (route.name === 'Matches') {
          iconName = focused ? 'heart' : 'heart-outline';
        } else if (route.name === 'Settings') {
          iconName = focused ? 'settings' : 'settings-outline';
        }
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#4f46e5',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen 
      name="HomeTab" 
      component={HomeScreen} 
      options={{ headerShown: false, title: 'Home' }}
    />
    <Tab.Screen name="Profile" component={ProfileScreen} />
    <Tab.Screen name="Matches" component={MatchesScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

// Setup Stack
const SetupStack = () => (
  <Stack.Navigator initialRouteName="BasicInfo">
    <Stack.Screen 
      name="BasicInfo" 
      component={BasicInfoScreen} 
      options={{ headerShown: false }} 
    />
    <Stack.Screen 
      name="LocationPreferences" 
      component={LocationPreferencesScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="JobPreferences" 
      component={JobPreferencesScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="UserOverview" 
      component={UserOverviewScreen} 
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Main" 
      component={MainTabs} 
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

export default function App() {
  useEffect(() => {
    LogBox.ignoreLogs(['Setting a timer']);
  }, []);

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Handle user state changes
  async function onAuthStateChanged(user) {
    try {
      if (user) {
        setUser(user);
        console.log('Checking setup status for user:', user.uid);
        
        // Check both user document and user_attributes
        const [userDoc, userAttrsDoc] = await Promise.all([
          db.collection('users').doc(user.uid).get(),
          db.collection('user_attributes').doc(user.uid).get()
        ]);

        const isComplete = userDoc.exists && 
                          userAttrsDoc.exists && 
                          userDoc.data()?.setupComplete === true;

        console.log('Setup complete status:', isComplete);
        setIsSetupComplete(isComplete);
      } else {
        setUser(null);
        setIsSetupComplete(false);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      setIsSetupComplete(false);
    } finally {
      if (initializing) {
        setInitializing(false);
      }
    }
  }

  useEffect(() => {
    const subscriber = auth.onAuthStateChanged(onAuthStateChanged);
    return subscriber;
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <SetupProvider>
      <NavigationContainer>
        {!user ? (
          <AuthStack />
        ) : !isSetupComplete ? (
          <SetupStack />
        ) : (
          <MainTabs />
        )}
      </NavigationContainer>
    </SetupProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
