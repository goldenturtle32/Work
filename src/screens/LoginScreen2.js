// src/screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { auth } from '../firebase'; // Import auth from firebase.js

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // State for loading indicator

  const handleLogin = async () => {
    // Input Validation
    if (email.trim() === '' || password === '') {
      Alert.alert('Input Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true); // Start loading

    try {
      console.log("Attempting to sign in with:", email);
      await auth.signInWithEmailAndPassword(email, password);
      console.log("Sign-in successful");
      // Navigation is handled by onAuthStateChanged listener in App.js
    } catch (error) {
      console.error("Login Error:", error);
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false); // End loading
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Login Screen</Text>
      
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
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button
          title="Login"
          onPress={handleLogin}
        />
      )}
      
      <View style={styles.footer}>
        <Text>Don't have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.footerLink}> Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    alignSelf: 'center',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerLink: {
    color: 'blue',
    fontWeight: 'bold',
  },
});
