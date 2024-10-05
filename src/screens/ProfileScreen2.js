import React, { useState } from 'react';
import { View, Text, Button, Picker, TextInput, StyleSheet, FlatList } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export default function ProfileScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('Construction');
  const [skills, setSkills] = useState(['Plumbing', 'Electrical']); // Skills list
  const [newSkill, setNewSkill] = useState(''); // State for adding new skills
  const [availability, setAvailability] = useState(['Monday', 'Wednesday']);
  const [resume, setResume] = useState(null);

  // Function to handle resume upload
  const handleResumeUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (result.type === 'success') {
      setResume(result);
    }
  };

  // Function to add a skill to the list
  const addSkill = () => {
    if (newSkill.trim() !== '') {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  // Function to remove a skill from the list
  const removeSkill = (index) => {
    const updatedSkills = skills.filter((_, i) => i !== index);
    setSkills(updatedSkills);
  };

  return (
    <View style={styles.container}>
      {/* Profile Information */}
      <View style={styles.profileDetails}>
        <Text>Profile Screen</Text>
        <Text>Role: Worker</Text>

        {/* Category Picker */}
        <Text>Category:</Text>
        <Picker
          selectedValue={selectedCategory}
          onValueChange={(itemValue) => setSelectedCategory(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Construction" value="Construction" />
          <Picker.Item label="Engineering" value="Engineering" />
          <Picker.Item label="Healthcare" value="Healthcare" />
          <Picker.Item label="Education" value="Education" />
        </Picker>
        <Text>Selected Category: {selectedCategory}</Text>

        {/* Skills Section */}
        <Text style={styles.sectionTitle}>Skills:</Text>
        <FlatList
          data={skills}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.skillItem}>
              <Text>{item}</Text>
              <Button title="Remove" onPress={() => removeSkill(index)} />
            </View>
          )}
        />

        {/* Add New Skill */}
        <TextInput
          style={styles.input}
          placeholder="Add a new skill"
          value={newSkill}
          onChangeText={setNewSkill}
        />
        <Button title="Add Skill" onPress={addSkill} />

        {/* Availability Section */}
        <Text style={styles.sectionTitle}>Availability:</Text>
        {availability.map((day, index) => (
          <Text key={index} style={styles.availabilityItem}>{day}</Text>
        ))}

        {/* Resume Upload Section */}
        <Text style={styles.sectionTitle}>Resume Upload:</Text>
        <Button title="Upload Resume" onPress={handleResumeUpload} />
        {resume && <Text>Uploaded Resume: {resume.name}</Text>}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        <Button title="Home" onPress={() => navigation.navigate('Home')} />
        <Button title="Matches" onPress={() => navigation.navigate('Matches')} />
        <Button title="Profile" onPress={() => {}} /> {/* No action for Profile */}
        <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  profileDetails: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    height: 50,
    width: 200,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 20,
  },
  skillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginVertical: 10,
    paddingHorizontal: 10,
    width: '80%',
  },
  availabilityItem: {
    marginVertical: 5,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
});


import React from 'react';
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View>
      <Text>Profile Screen</Text>
    </View>
  );
}

// src/screens/ProfileScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import MapView from 'react-native-maps';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';

export default function ProfileScreen() {
  const [profile] = useState({
    role: 'Worker',
    category: 'Construction',
    location: { latitude: 37.78825, longitude: -122.4324 },
    reviewsAverage: 4.5,
    availability: ['Monday', 'Wednesday'],
    skills: ['Plumbing', 'Electrical'],
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [resume, setResume] = useState(null);

  const handleResumeUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', // Restrict to PDF files (optional)
      });
      if (result.type === 'success') {
        setResume(result);
        Alert.alert('Success', 'Resume uploaded successfully!');
      }
    } catch (error) {
      console.error("Error uploading resume:", error);
      Alert.alert('Error', 'Failed to upload resume.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile Information</Text>
      <Text style={styles.label}>Role: {profile.role}</Text>
      <Text style={styles.label}>Category: {profile.category}</Text>
      <Text style={styles.label}>Location: {JSON.stringify(profile.location)}</Text>
      <Text style={styles.label}>Average Reviews: {profile.reviewsAverage}</Text>
      <Text style={styles.label}>Availability: {profile.availability.join(', ')}</Text>
      <Text style={styles.label}>Skills: {profile.skills.join(', ')}</Text>

      {/* Category Filter */}
      <Text style={styles.subHeader}>Filter by Category</Text>
      <Picker
        selectedValue={selectedCategory}
        onValueChange={(itemValue) => setSelectedCategory(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Select Category" value="" />
        <Picker.Item label="Construction" value="Construction" />
        <Picker.Item label="Engineering" value="Engineering" />
      </Picker>

      {/* Location Map */}
      <Text style={styles.subHeader}>Location Map</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: profile.location.latitude,
          longitude: profile.location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      />

      {/* Resume Upload */}
      <Text style={styles.subHeader}>Resume</Text>
      <Button title="Upload Resume" onPress={handleResumeUpload} />
      {resume && <Text style={styles.resumeText}>Resume: {resume.name}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  map: {
    height: 200,
    width: '100%',
    marginVertical: 10,
  },
  resumeText: {
    marginTop: 10,
    fontSize: 16,
    color: 'green',
  },
});

// src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { db, auth } from '../firebase'; // Import auth and db

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth().currentUser;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          const userDoc = await db.collection('users').doc(currentUser.uid).get();
          if (userDoc.exists) {
            setProfile(userDoc.data());
          } else {
            console.log("No such user!");
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          Alert.alert('Error', 'Failed to load profile.');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  const handleResumeUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', // Restrict to PDF files (optional)
      });
      if (result.type === 'success') {
        setResume(result);
        Alert.alert('Success', 'Resume uploaded successfully!');
        // Optionally, upload the resume to Firebase Storage and update Firestore with the URL
      }
    } catch (error) {
      console.error("Error uploading resume:", error);
      Alert.alert('Error', 'Failed to upload resume.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading Profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text>No profile data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Display Profile Picture if available */}
      {profile.profilePicture && (
        <Image
          source={{ uri: profile.profilePicture }}
          style={styles.profilePicture}
        />
      )}
      <Text style={styles.header}>Profile Information</Text>
      <Text style={styles.label}>Full Name: {profile.fullName}</Text>
      <Text style={styles.label}>Email: {profile.email}</Text>
      <Text style={styles.label}>Phone Number: {profile.phoneNumber}</Text>
      <Text style={styles.label}>Role: {profile.role}</Text>
      <Text style={styles.label}>Category: {profile.category}</Text>
      <Text style={styles.label}>Location: {JSON.stringify(profile.location)}</Text>
      <Text style={styles.label}>Average Reviews: {profile.reviewsAverage}</Text>
      <Text style={styles.label}>Availability: {profile.availability.join(', ')}</Text>
      <Text style={styles.label}>Skills: {profile.skills.join(', ')}</Text>

      {/* Category Filter */}
      <Text style={styles.subHeader}>Filter by Category</Text>
      <Picker
        selectedValue={selectedCategory}
        onValueChange={(itemValue) => setSelectedCategory(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Select Category" value="" />
        <Picker.Item label="Construction" value="Construction" />
        <Picker.Item label="Engineering" value="Engineering" />
        {/* Add more categories as needed */}
      </Picker>

      {/* Resume Upload */}
      <Text style={styles.subHeader}>Resume</Text>
      <Button title="Upload Resume" onPress={handleResumeUpload} />
      {resume && <Text style={styles.resumeText}>Resume: {resume.name}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
  },
  subHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  picker: {
    height: 50,
    width: '100%',
    marginVertical: 10,
  },
  resumeText: {
    marginTop: 10,
    fontSize: 16,
    color: 'green',
  },
});
