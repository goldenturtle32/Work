import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProgressStepper = ({ currentStep }) => {
  const steps = [
    { id: 1, title: 'User Info', icon: 'person' },
    { id: 2, title: 'Location', icon: 'location' },
    { id: 3, title: 'Job Info', icon: 'briefcase' },
    { id: 4, title: 'Overview', icon: 'document-text' },
    { id: 5, title: 'Schedule', icon: 'calendar' },
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
              numberOfLines={2}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 40,
    position: 'relative',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    minWidth: 40,
    maxWidth: 70,
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
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
    width: '100%',
    height: 24,
  },
  line: {
    height: 2,
    flex: 1,
    marginHorizontal: -10,
    marginTop: -22,
  },
});

export default ProgressStepper;