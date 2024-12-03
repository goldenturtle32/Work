import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedGestureHandler,
  useAnimatedStyle,
  withSpring,
  useSharedValue
} from 'react-native-reanimated';
import MiniJobDetails from './MiniJobDetails';
import MiniChatScreen from './MiniChatScreen';

const SCREEN_WIDTH = Dimensions.get('window').width;

const NewMatchModal = ({ visible, onClose, jobData, matchData }) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const translateX = useSharedValue(0);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
    },
    onEnd: (event) => {
      if (Math.abs(event.velocityX) > 500) {
        if (event.velocityX > 0) {
          translateX.value = withSpring(0);
          setCurrentScreen(0);
        } else {
          translateX.value = withSpring(-SCREEN_WIDTH);
          setCurrentScreen(1);
        }
      } else {
        if (translateX.value < -SCREEN_WIDTH / 2) {
          translateX.value = withSpring(-SCREEN_WIDTH);
          setCurrentScreen(1);
        } else {
          translateX.value = withSpring(0);
          setCurrentScreen(0);
        }
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
        <Text style={styles.matchTitle}>It's a Match!</Text>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.screensContainer, animatedStyle]}>
            <View style={styles.screen}>
              <MiniJobDetails jobData={jobData} />
            </View>
            <View style={styles.screen}>
              <MiniChatScreen matchData={matchData} />
            </View>
          </Animated.View>
        </PanGestureHandler>
        <View style={styles.pagination}>
          <View style={[
            styles.paginationDot,
            currentScreen === 0 && styles.activeDot
          ]} />
          <View style={[
            styles.paginationDot,
            currentScreen === 1 && styles.activeDot
          ]} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
    padding: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  screensContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  screen: {
    width: SCREEN_WIDTH * 0.9,
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#007AFF',
  },
});

export default NewMatchModal; 