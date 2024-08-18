// src/screens/HomeScreen.js
// This screen displays job listings and allows navigation to Profile and Job Details screens.
// It also includes functionality to fetch job matches for the logged-in worker.

import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { findMatchesForWorker } from '../services/matchingService'; // Import the matching service

export default function HomeScreen({ navigation }) {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    async function fetchMatches() {
      const workerId = 'currentWorkerId'; // Replace with actual worker ID from auth context
      const matchResults = await findMatchesForWorker(workerId);
      setMatches(matchResults);
    }
    fetchMatches();
  }, []);

  return (
    <View>
      <Text>Job Listings</Text>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.contractorId}
        renderItem={({ item }) => (
          <View>
            <Text>Contractor ID: {item.contractorId}</Text>
            <Text>Match Score: {item.matchScore}</Text>
            <Button
              title="View Details"
              onPress={() => navigation.navigate('JobDetail', { contractorId: item.contractorId })}
            />
          </View>
        )}
      />
      <Button
        title="Go to Profile"
        onPress={() => navigation.navigate('Profile')}
      />
      <Button
        title="Go to Job Details"
        onPress={() => navigation.navigate('JobDetail')}
      />
    </View>
  );
}
