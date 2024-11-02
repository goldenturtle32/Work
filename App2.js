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
  useEffect(() => {
    LogBox.ignoreLogs(['Setting a timer']);
  }, []);

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [isAttributeSet, setIsAttributeSet] = useState(false);

  // Handle user state changes
  function onAuthStateChanged(user) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth.onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  useEffect(() => {
    if (user) {
      // Listen to user_attributes document
      const unsubscribe = db.collection('user_attributes').doc(user.uid)
        .onSnapshot((doc) => {
          if (doc.exists && Object.keys(doc.data()).length > 0) {
            console.log('Attributes found:', doc.data());
            setIsAttributeSet(true);
          } else {
            console.log('No attributes found for user.');
            setIsAttributeSet(false);
          }
        }, (error) => {
          console.error('Error fetching user attributes:', error);
          setIsAttributeSet(false);
        });
      return () => unsubscribe();
    } else {
      setIsAttributeSet(false);
    }
  }, [user]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        isAttributeSet ? (
          <AppStack />
        ) : (
          <Stack.Navigator initialRouteName="AttributeSelection">
            <Stack.Screen 
              name="AttributeSelection" 
              component={AttributeSelectionScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        )
      ) : (
        <AuthStack />
      )}
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