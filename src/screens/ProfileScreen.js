import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import Slider from '@react-native-community/slider'; // Import Slider from correct package
import { db, auth } from '../firebase'; // Import Firebase configuration

export default function ProfileScreen() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    skills: '',
    availability: '',
    certifications: '',
    education: '',
    experience: '',
    industryPrefs: '',
    jobTitlePrefs: '',
    jobTypePrefs: '',
    location: '',
    role: '',
    salaryPrefs: '',
  });
  
  const [importance, setImportance] = useState({
    skillsImportance: 5,
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
  });

  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileDoc = await db.collection('user_attributes').doc(currentUser.uid).get();
        if (profileDoc.exists) {
          setProfile(profileDoc.data());
          console.log('Profile data:', profileDoc.data()); // Debug log for profile data
        } else {
          Alert.alert('Error', 'Profile not found');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const updateProfile = async () => {
    try {
      await db.collection('user_attributes').doc(currentUser.uid).set({ 
        ...profile, 
        importance,
      }, { merge: true });
      Alert.alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleChange = (key, value) => {
    setProfile(prevProfile => ({
      ...prevProfile,
      [key]: value,
    }));
  };

  const handleImportanceChange = (key, value) => {
    setImportance(prevImportance => ({
      ...prevImportance,
      [key]: value,
    }));
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#002D62" /> {/* Navy blue spinner */}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Profile Settings</Text>

        {/* Add SafeAreaView for better layout control */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={profile?.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="Enter your name"
            placeholderTextColor="#A9A9A9"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={profile?.email}
            editable={false} // Email is not editable
            placeholderTextColor="#A9A9A9"
          />

          <Text style={styles.label}>Skills</Text>
          <TextInput
            style={styles.input}
            value={profile?.skills}
            onChangeText={(text) => handleChange('skills', text)}
            placeholder="Enter your skills"
            placeholderTextColor="#A9A9A9"
          />
          <Text style={styles.question}>How important is integrating the skills you have listed to being used in your job?</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={importance.skillsImportance}
            onValueChange={(value) => handleImportanceChange('skillsImportance', value)}
          />
          <Text>Importance: {importance.skillsImportance}/10</Text>

          {/* Add other fields for availability, certifications, etc. with sliders */}

          <TouchableOpacity style={styles.button} onPress={updateProfile}>
            <Text style={styles.buttonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F8F8',  // Light grey background
  },
  formContainer: {
    flex: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#002D62',  // Navy blue header
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#002D62',  // Navy blue label
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: '#A9A9A9',  // Silver/grey border
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFF',  // White background for input
    paddingLeft: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  question: {
    fontSize: 14,
    color: '#333',  // Darker text for questions
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  button: {
    backgroundColor: '#002D62',  // Navy blue button
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,  // Margin for button
  },
  buttonText: {
    color: '#FFF',  // White text on button
    fontSize: 16,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
