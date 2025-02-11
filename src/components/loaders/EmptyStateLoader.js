import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyStateLoader() {
  const pulseAnim = new Animated.Value(1);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="search" size={50} color="#3b82f6" />
      </Animated.View>
      <Text style={styles.mainText}>No More Cards</Text>
      <Text style={styles.subText}>We're searching for new matches...</Text>
      <Text style={styles.tipText}>Check back soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  mainText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  subText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  tipText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
}); 