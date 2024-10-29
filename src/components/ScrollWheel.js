import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet } from 'react-native';

export default function ScrollWheel({ items, onChange, initialValue }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastOffset.current = scrollY._value;
      },
      onPanResponderMove: (_, { dy }) => {
        scrollY.setValue(lastOffset.current + dy);
      },
      onPanResponderRelease: (_, { vy }) => {
        const targetY = lastOffset.current + (vy * 200);
        const snapToIndex = Math.round(targetY / ITEM_HEIGHT);
        const boundedIndex = Math.max(0, Math.min(snapToIndex, items.length - 1));
        const finalY = boundedIndex * ITEM_HEIGHT;

        Animated.spring(scrollY, {
          toValue: finalY,
          velocity: vy,
          tension: 68,
          friction: 12,
          useNativeDriver: true,
        }).start();

        onChange(items[boundedIndex]);
      },
    })
  ).current;

  useEffect(() => {
    const initialIndex = items.indexOf(initialValue);
    if (initialIndex !== -1) {
      scrollY.setValue(initialIndex * ITEM_HEIGHT);
    }
  }, [initialValue]);

  return (
    <View style={styles.container}>
      <View style={styles.highlight} />
      <Animated.View
        style={[
          styles.itemsContainer,
          {
            transform: [{ translateY: scrollY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {items.map((item, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.item,
              {
                opacity: scrollY.interpolate({
                  inputRange: [
                    (index - 2) * ITEM_HEIGHT,
                    index * ITEM_HEIGHT,
                    (index + 2) * ITEM_HEIGHT,
                  ],
                  outputRange: [0.3, 1, 0.3],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            {item}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  itemsContainer: {
    padding: 10,
  },
  item: {
    height: ITEM_HEIGHT,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    color: '#333',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#007BFF',
  },
}); 