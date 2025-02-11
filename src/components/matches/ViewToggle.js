import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ViewToggle({ isMapView, onToggle }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.toggleButton, !isMapView && styles.activeButton]} 
        onPress={() => onToggle(false)}
      >
        <Text style={[styles.toggleText, !isMapView && styles.activeText]}>Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.toggleButton, isMapView && styles.activeButton]}
        onPress={() => onToggle(true)}
      >
        <Text style={[styles.toggleText, isMapView && styles.activeText]}>Map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeButton: {
    backgroundColor: '#2563eb',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  activeText: {
    color: '#ffffff',
  },
}); 