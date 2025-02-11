import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function WebMap({ currentLocation }) {
  if (!currentLocation) return null;

  const { latitude, longitude } = currentLocation;
  const googleMapsUrl = `https://www.google.com/maps/embed/v1/view?key=YOUR_GOOGLE_MAPS_API_KEY&center=${latitude},${longitude}&zoom=12`;

  return (
    <View style={styles.container}>
      <iframe
        title="Google Maps"
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ border: 0 }}
        src={googleMapsUrl}
        allowFullScreen
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});