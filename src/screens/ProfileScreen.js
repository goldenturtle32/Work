// src/screens/ProfileScreen.js
// This screen displays user profile information fetched from Firestore.

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getUserProfile } from '../services/firestoreService';
import auth from '@react-native-firebase/auth';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      const userId = auth().currentUser.uid;
      const userProfile = await getUserProfile(userId);
      setProfile(userProfile);
      setLoading(false);
    }
    fetchUserProfile();
  }, []);

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text>Role: {profile.role}</Text>
      <Text>Category: {profile.category}</Text>
      <Text>Location: {JSON.stringify(profile.location)}</Text>
      <Text>Average Reviews: {profile.reviewsAverage}</Text>
      <Text>Availability: {profile.availability.join(', ')}</Text>
    </View>
  );
}
