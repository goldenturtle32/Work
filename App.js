import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import auth from '@react-native-firebase/auth';

import HomeScreen from 'C:/Users/joeke/Desktop/Python/Work/src/screens/HomeScreen';
import ProfileScreen from 'C:/Users/joeke/Desktop/Python/Work/src/screens/ProfileScreen';
import JobDetailScreen from 'C:/Users/joeke/Desktop/Python/Work/src/screens/JobDetailScreen';
import Login from 'C:/Users/joeke/Desktop/Python/Work/src/screens/Login'; // Authentication screen
import SignUp from 'C:/Users/joeke/Desktop/Python/Work/src/screens/SignUp'; // Authentication screen
import ForgotPassword from 'C:/Users/joeke/Desktop/Python/Work/src/screens/ForgotPassword'; // Password recovery screen

const Stack = createStackNavigator();

export default function App() {
    const [initializing, setInitializing] = useState(true);
    const [user, setUser] = useState(null);

    function onAuthStateChanged(user) {
        setUser(user);
        if (initializing) setInitializing(false);
    }

    useEffect(() => {
        const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
        return subscriber; // unsubscribe on unmount
    }, []);

    if (initializing) return null;

    return (
        <NavigationContainer>
            {user ? (
                <Stack.Navigator initialRouteName="Home">
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator initialRouteName="Login">
                    <Stack.Screen name="Login" component={Login} />
                    <Stack.Screen name="SignUp" component={SignUp} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
}
