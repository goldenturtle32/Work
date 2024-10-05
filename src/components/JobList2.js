

// src/screens/HomeScreen.js
import React from 'react';
import { View, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View>
      {/* Other components */}
      <Button
        title="View Jobs"
        onPress={() => navigation.navigate('JobList')}  // Navigate to JobList
      />
    </View>
  );
}