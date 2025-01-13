import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { useState, useEffect } from 'react';

// Import your screens
import HomeScreen from '../screens/HomeScreen';
import JobHomeScreen from '../screens/JobHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MatchesScreen from '../screens/MatchesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import JobDetailsMatched from '../screens/JobDetailsMatched';
import MatchAnalysisScreen from '../screens/MatchAnalysisScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import ChatScreen from '../screens/ChatScreen';
import UserDetailScreen from '../screens/UserDetailScreen';
// Import setup screens
import LocationPreferencesScreen from '../screens/setup/LocationPreferencesScreen';
import JobPreferencesScreen from '../screens/setup/JobPreferencesScreen';
import BasicInfoScreen from '../screens/setup/BasicInfoScreen';
import UserOverviewScreen from '../screens/setup/UserOverviewScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
        }
      }
    };
    fetchUserRole();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
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
        tabBarActiveTintColor: '#1e3a8a',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={userRole === 'employer' ? JobHomeScreen : HomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e3a8a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {/* Main Tab Navigator */}
      <Stack.Screen 
        name="Main" 
        component={TabNavigator}
        options={{ headerShown: false }}
      />

      {/* Setup Screens */}
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

      {/* Stack Screens */}
      <Stack.Screen 
        name="JobDetail" 
        component={JobDetailScreen}
        options={{ title: 'Job Details' }}
      />
      <Stack.Screen 
        name="UserDetail" 
        component={UserDetailScreen}
        options={{ title: 'Worker Details' }}
      />
      <Stack.Screen 
        name="JobDetailsMatched" 
        component={JobDetailsMatched}
        options={{ title: 'Matched Job Details' }}
      />
      <Stack.Screen 
        name="MatchAnalysis" 
        component={MatchAnalysisScreen}
        options={{ title: 'Match Analysis' }}
      />
      <Stack.Screen 
        name="Availability" 
        component={AvailabilityScreen}
        options={{ title: 'Set Availability' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
