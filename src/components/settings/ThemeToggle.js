import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ThemeToggle({ darkMode, onToggle }) {
  const translateX = React.useRef(new Animated.Value(darkMode ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(translateX, {
      toValue: darkMode ? 1 : 0,
      damping: 15,
      stiffness: 250,
      useNativeDriver: true,
    }).start();
  }, [darkMode]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.toggleContainer,
          { backgroundColor: darkMode ? '#1e1e1e' : '#f0f0f0' }
        ]}
        activeOpacity={1}
        onPress={onToggle}
      >
        <TouchableOpacity
          style={[styles.toggleButton, { opacity: darkMode ? 0.5 : 1 }]}
          onPress={() => !darkMode && onToggle()}
        >
          <Ionicons 
            name="sunny-outline" 
            size={20} 
            color={darkMode ? '#666' : '#1e3a8a'} 
          />
          <Text style={[
            styles.toggleText,
            { color: darkMode ? '#666' : '#1e3a8a' }
          ]}>
            Light
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, { opacity: darkMode ? 1 : 0.5 }]}
          onPress={() => darkMode && onToggle()}
        >
          <Ionicons 
            name="moon-outline" 
            size={20} 
            color={darkMode ? '#fff' : '#666'} 
          />
          <Text style={[
            styles.toggleText,
            { color: darkMode ? '#fff' : '#666' }
          ]}>
            Dark
          </Text>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.slider,
            {
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 100] // Adjust based on your container width
                })
              }]
            }
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 25,
    position: 'relative',
    height: 40,
    width: 200,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  slider: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    width: '48%',
    height: '90%',
    borderRadius: 22,
    backgroundColor: '#3b82f6',
  },
}); 