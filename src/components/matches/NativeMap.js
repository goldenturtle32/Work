import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';

export default function NativeMap({ currentLocation, matchLocations = [] }) {
  const initialRegion = {
    latitude: currentLocation?.latitude || 37.7749, // Default to San Francisco if no location
    longitude: currentLocation?.longitude || -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {matchLocations.map((location, index) => (
          <Marker
            key={location.matchId || index}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude
            }}
          >
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{location.employerName}</Text>
                <Text style={styles.calloutSubtitle}>{location.jobTitle}</Text>
                <Text style={styles.calloutText}>{location.industry}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  calloutContainer: {
    padding: 10,
    maxWidth: 200,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 2,
  },
  calloutText: {
    fontSize: 12,
    color: '#6b7280',
  },
}); 