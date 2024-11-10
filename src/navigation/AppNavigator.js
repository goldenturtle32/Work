import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import MatchAnalysisScreen from '../screens/MatchAnalysisScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator 
      initialRouteName="Home"
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
      <Stack.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Jobs',
        }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'My Profile',
        }}
      />
      <Stack.Screen 
        name="JobDetail" 
        component={JobDetailScreen}
        options={{
          title: 'Job Details',
        }}
      />
      <Stack.Screen 
        name="MatchAnalysis" 
        component={MatchAnalysisScreen}
        options={{
          title: 'Match Analysis',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
}
