import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const Loader = () => {
  const animations = useRef([...Array(5)].map(() => new Animated.Value(0.8))).current;

  useEffect(() => {
    const animate = (index) => {
      Animated.sequence([
        Animated.timing(animations[index], {
          toValue: 1.2,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(animations[index], {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
      ]).start(() => animate(index));
    };

    animations.forEach((_, index) => {
      setTimeout(() => animate(index), index * 150);
    });
  }, [animations]);

  return (
    <View style={styles.container}>
      {animations.map((animation, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              transform: [{ scale: animation }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  dot: {
    height: 20,
    width: 20,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: '#b3d4fc',
  },
});

export default Loader; 