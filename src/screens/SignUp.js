// src/screens/SignUp.js
// This screen handles user sign-up and stores user data in Firestore.

import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { addUser } from '../services/firestoreService';
import auth from '@react-native-firebase/auth';

export default function SignUp({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      // Add user data to Firestore
      await addUser({
        id: user.uid,
        role: 'worker', // Default role, adjust as needed
        category: '', // Set appropriate default or update based on input
        location: {}, // Set appropriate default or update based on input
        reviewsAverage: 0,
        availability: []
      });
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Sign Up Error', error.message);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title="Sign Up"
        onPress={handleSignUp}
      />
    </View>
  );
}
