import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProgressStepper = ({ currentStep }) => {
  const steps = [
    { id: 1, title: 'Name', icon: 'person' },
    { id: 2, title: 'Job Preferences', icon: 'briefcase' },
    { id: 3, title: 'Location Preference', icon: 'location' },
    { id: 4, title: 'User Overview', icon: 'document-text' },
  ];

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepContainer}>
            <View
              style={[
                styles.circle,
                {
                  backgroundColor:
                    step.id <= currentStep ? '#6366F1' : '#E0E7FF',
                },
              ]}
            >
              <Ionicons
                name={step.icon}
                size={20}
                color={step.id <= currentStep ? '#FFFFFF' : '#A5B4FC'}
              />
            </View>
            <Text
              style={[
                styles.stepText,
                {
                  color: step.id <= currentStep ? '#4F46E5' : '#A5B4FC',
                  fontWeight: step.id === currentStep ? 'bold' : 'normal',
                },
              ]}
            >
              {step.title}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.line,
                {
                  backgroundColor:
                    step.id < currentStep ? '#6366F1' : '#E0E7FF',
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
      <View
        style={[
          styles.shield,
          {
            left: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          },
        ]}
      >
        <Ionicons name="shield" size={16} color="#6366F1" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 8,
    position: 'relative',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 12,
    textAlign: 'center',
  },
  line: {
    height: 2,
    flex: 1,
    marginHorizontal: -10,
    marginTop: -22,
  },
  shield: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    transform: [{ translateX: -12 }],
  },
});

export default ProgressStepper; 