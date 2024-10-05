import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { auth, db } from '../firebase'; // Import auth and db from firebase.js
import firebase from 'firebase/compat/app'; // Import Firebase for GeoPoint
import { Picker } from '@react-native-picker/picker'; // Import Picker for role selection

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('worker'); // State to track selected role
  const [loading, setLoading] = useState(false); // State for loading indicator

  const handleSignUp = async () => {
    if (email.trim() === '' || password === '' || confirmPassword === '') {
      Alert.alert('Input Error', 'Please fill all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await db.collection('users').doc(user.uid).set({
        id: user.uid,
        email: user.email,
        role: role,               // Use the selected role (worker or employer)
        category: '',             // Category will be added on AttributeSelectionScreen
        location: new firebase.firestore.GeoPoint(37.78825, -122.4324), // Example location
        reviewsAverage: 0,        // Default reviewsAverage
        availability: [],         // Availability will be added later
        skills: [],               // Skills will be added later
      });

      Alert.alert('Success', 'Account created successfully!');
      navigation.navigate('AttributeSelection', { userId: user.uid });
    } catch (error) {
      Alert.alert('Sign Up Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sign Up Screen</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <TextInput
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
      />

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>I am:</Text>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Looking for a job" value="worker" />
          <Picker.Item label="Looking to hire" value="employer" />
        </Picker>
      </View>

      {loading ? <ActivityIndicator size="large" color="#0000ff" /> : (
        <TouchableOpacity onPress={handleSignUp} style={styles.button}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 10,
  },
  pickerContainer: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
  },
  picker: {
    height: 50,
    width: 200,
  },
  button: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
