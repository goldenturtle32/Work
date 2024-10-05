// src/screens/JobDetailScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function JobDetailScreen({ route }) {
  const { job } = route.params; // Destructure job from route params

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.bubble}>
        {/* Display job title */}
        <Text style={styles.title}>{job.jobTitle}</Text>

        {/* Display employer */}
        <Text style={styles.label}>Employer:</Text>
        <Text style={styles.info}>{job.employer}</Text>

        {/* Display location */}
        <Text style={styles.label}>Location:</Text>
        <Text style={styles.info}>{job.location}</Text>

        {/* Display time needed */}
        <Text style={styles.label}>Time Needed:</Text>
        <Text style={styles.info}>{job.timesNeeded}</Text>

        {/* Display pay rate */}
        <Text style={styles.label}>Pay Rate:</Text>
        <Text style={styles.info}>${job.payRate}/hour</Text>

        {/* Display description */}
        <Text style={styles.label}>Description:</Text>
        <Text style={styles.info}>{job.description}</Text>

        {/* Optionally display category */}
        {job.category && (
          <>
            <Text style={styles.label}>Category:</Text>
            <Text style={styles.info}>{job.category}</Text>
          </>
        )}

        {/* Optionally display skills required */}
        {job.skillsRequired && job.skillsRequired.length > 0 && (
          <>
            <Text style={styles.label}>Skills Required:</Text>
            <Text style={styles.info}>{job.skillsRequired.join(', ')}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5, // For Android shadow
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  info: {
    fontSize: 16,
    color: '#555',
  },
});
