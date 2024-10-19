import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { auth, db } from '../firebase'; 
import firebase from 'firebase/compat/app'; 
import { Picker } from '@react-native-picker/picker'; 
import User from '../models/User';

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('worker'); 
  const [loading, setLoading] = useState(false); 


  const handleSignUp = async () => {
    console.log("Sign up button pressed");

    if (!email.trim() || !password || !confirmPassword) {
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

      // Create document in 'users' collection
      await db.collection('users').doc(user.uid).set({
        id: user.uid,
        email: user.email,
        role: role,
        location: new firebase.firestore.GeoPoint(37.78825, -122.4324),
        availability: [],
        category: '',
        reviewsAverage: 0,
        skills: [],
        isNewUser: true
      });

      // Create document in 'user_attributes' or 'job_attributes' collection based on role
      if (role === 'worker') {
        await db.collection('user_attributes').doc(user.uid).set({
          uid: user.uid,
          email: user.email,
          role: role,
          location: new firebase.firestore.GeoPoint(37.78825, -122.4324),
          availability: {},
          certifications: '',
          education: '',
          experience: '',
          industryPrefs: [],
          jobTypePrefs: '',
          salaryPrefs: '',
          skills: [],
          importance: {
            availabilityImportance: 5,
            certificationsImportance: 5,
            educationImportance: 5,
            experienceImportance: 5,
            industryPrefsImportance: 5,
            jobTitlePrefsImportance: 5,
            jobTypePrefsImportance: 5,
            locationImportance: 5,
            roleImportance: 5,
            salaryPrefsImportance: 5,
            skillsImportance: 5
          }
        });
      } else if (role === 'employer') {
        await db.collection('job_attributes').doc(user.uid).set({
          id: user.uid,
          email: user.email,
          industry: '',
          jobTitle: '',
          jobType: '',
          location: '',
          requiredAvailability: '',
          requiredCertifications: '',
          requiredEducation: '',
          requiredExperience: '',
          requiredSkills: '',
          salaryRange: '',
          estimatedHours: ''
        });
      }

      Alert.alert('Success', 'Account created successfully!');
      navigation.navigate('AttributeSelection', { userId: user.uid, isNewUser: true });
    } catch (error) {
      console.error(error);
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

      {loading ? 
        <ActivityIndicator size="large" color="#0000ff" /> 
        : 
        <TouchableOpacity onPress={handleSignUp} style={styles.button}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      }
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
