import React from 'react';
import { View, Platform } from 'react-native';

let WebMap = null;
if (Platform.OS === 'web') {
  try {
    WebMap = require('../../components/WebMap').default;
  } catch (error) {
    console.error('Error importing WebMap:', error);
  }
}

export default function MapComponent({ currentLocation, matchLocations }) {
  if (Platform.OS === 'web') {
    if (!WebMap) return null;
    
    return (
      <View style={{ height: 300 }}>
        <WebMap
          location={currentLocation}
          radius={16093.4} // 10 miles in meters
        />
      </View>
    );
  } else {
    const NativeMap = require('./NativeMap').default;
    return <NativeMap currentLocation={currentLocation} matchLocations={matchLocations} />;
  }
} 