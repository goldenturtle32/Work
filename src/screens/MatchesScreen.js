import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Button } from 'react-native';

const matches = [
  { id: '1', jobTitle: 'Plumber', company: 'ABC Plumbing', location: 'New York, NY' },
  { id: '2', jobTitle: 'Electrician', company: 'XYZ Electric', location: 'Los Angeles, CA' },
  // Add more matches as needed
];

export default function MatchesScreen({ navigation }) {
  const handlePress = (item) => {
    // Navigate to the chat screen on single press
    navigation.navigate('Chat', { jobId: item.id, jobTitle: item.jobTitle, company: item.company });
  };

  const handleLongPress = (item) => {
    // Navigate to the job details screen on long press
    navigation.navigate('JobDetail', { jobId: item.id });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.matchContainer}
      onPress={() => handlePress(item)}          // Single press goes to chat
      onLongPress={() => handleLongPress(item)}  // Long press goes to job details
    >
      <Text style={styles.jobTitle}>{item.jobTitle}</Text>
      <Text style={styles.company}>{item.company}</Text>
      <Text style={styles.location}>{item.location}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
      />
      <View style={styles.buttonContainer}>
        <Button
          title="Proceed to Payment"
          onPress={() => navigation.navigate('Payment')}  // Navigate to Payment screen
        />
      </View>
      <View style={styles.navigation}>
        <Button title="Home" onPress={() => navigation.navigate('Home')} />
        <Button title="Matches" onPress={() => {}} />
        <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
        <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  list: {
    flex: 1,
  },
  matchContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    marginVertical: 10,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  company: {
    fontSize: 16,
    color: '#555',
  },
  location: {
    fontSize: 14,
    color: '#888',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  buttonContainer: {
    paddingVertical: 10,
  },
});
