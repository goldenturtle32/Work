import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { auth, db } from '../firebase'; // Import auth and db from firebase.js
import User from '../models/User'; // Import the User class

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // State for loading indicator

  const fetchUserProfile = async (uid) => {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentUser = new User(
          userData.id,
          userData.email,
          userData.role,
          userData.skills,
          userData.location,
          userData.availability
        );
        console.log("Logged in User instance: ", currentUser);
        return currentUser;
      } else {
        console.log("No such document!");
      }
    } catch (error) {
      console.error("Error fetching user profile: ", error);
    }
  };
 
  const handleLogin = async () => {
    if (email.trim() === '' || password === '') {
      Alert.alert('Input Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      // Attempt to sign in directly
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Check if user has completed setup
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const attributesCollection = userData.role === 'employer' ? 'job_attributes' : 'user_attributes';
      const attributesDoc = await db.collection(attributesCollection).doc(user.uid).get();

      // If setup is complete, navigate to Main
      if (userDoc.exists && attributesDoc.exists && userData.setupComplete === true) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
      // Don't navigate if setup is incomplete - App.js will handle this
      
    } catch (error) {
      console.error("Login Error:", error);
      let errorMessage = 'An error occurred during login.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          Alert.alert(
            'Account Not Found',
            'This email is not registered. Would you like to create an account?',
            [
              {
                text: 'Sign Up',
                onPress: () => navigation.navigate('SignUp'),
                style: 'default',
              },
              {
                text: 'Try Again',
                style: 'cancel',
              },
            ]
          );
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          Alert.alert('Login Error', errorMessage);
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email format. Please check your email.';
          Alert.alert('Login Error', errorMessage);
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          Alert.alert('Login Error', errorMessage);
          break;
        default:
          Alert.alert('Login Error', errorMessage);
      }
    } finally {
      setLoading(false);
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
        <ActivityIndicator 
          color="#0000ff" 
          style={{ transform: [{ scale: 1.4 }] }}
        />
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
