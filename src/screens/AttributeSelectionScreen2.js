import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  ScrollView, 
  StyleSheet, 
  Alert,
  KeyboardAvoidingView
} from 'react-native';
import * as Location from 'expo-location';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';

export default function AttributeSelectionScreen({ navigation }) {
  const [attributes, setAttributes] = useState({
    skills: ['', '', '', '', ''],
    jobTypePrefs: ['', '', '', '', ''],
    industryPrefs: ['', '', '', '', ''],
    location: ['', '', '', '', ''],
    salaryPrefs: ['', '', '', '', ''],
    education: ['', '', '', '', ''],
    experience: ['', '', '', '', ''],
    certifications: ['', '', '', '', ''],
    availability: ['', '', '', '', ''],
  });

  const [currentLocation, setCurrentLocation] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    setCurrentLocation({ latitude, longitude });
  };

  const handleInputChange = (attr, index, value) => {
    const updatedAttr = [...attributes[attr]];
    updatedAttr[index] = value;
    setAttributes(prevState => ({
      ...prevState,
      [attr]: updatedAttr,
    }));
  };

  const handleSubmit = async () => {
    try {
      const locationData = currentLocation
        ? new firebase.firestore.GeoPoint(currentLocation.latitude, currentLocation.longitude)
        : attributes.location;

      await db.collection('user_attributes').doc(currentUser.uid).set({
        ...attributes,
        location: locationData,
        uid: currentUser.uid,
        email: currentUser.email,
        role: 'user',
      });

      Alert.alert('Attributes saved successfully!');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error saving attributes:', error);
      Alert.alert('Error', 'Failed to save attributes');
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" enabled>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <Text style={styles.title}>Fill in Your Attributes</Text>

        {/* Skills Input */}
        <Text style={styles.label}>Skills (up to 5):</Text>
        {attributes.skills.map((skill, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={skill}
            onChangeText={text => handleInputChange('skills', index, text)}
            placeholder={`Skill ${index + 1}`}
          />
        ))}

        {/* Job Type Preferences */}
        <Text style={styles.label}>Job Type Preferences (up to 5):</Text>
        {attributes.jobTypePrefs.map((jobType, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={jobType}
            onChangeText={text => handleInputChange('jobTypePrefs', index, text)}
            placeholder={`Job Type ${index + 1}`}
          />
        ))}

        {/* Industry Preferences */}
        <Text style={styles.label}>Industry Preferences (up to 5):</Text>
        {attributes.industryPrefs.map((industry, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={industry}
            onChangeText={text => handleInputChange('industryPrefs', index, text)}
            placeholder={`Industry ${index + 1}`}
          />
        ))}

        {/* Location */}
        <Text style={styles.label}>Location (up to 5):</Text>
        {attributes.location.map((loc, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={loc}
            onChangeText={text => handleInputChange('location', index, text)}
            placeholder={`Location ${index + 1}`}
          />
        ))}
        {currentLocation && (
          <Text style={styles.dynamicLocation}>
            Dynamic Location: {currentLocation.latitude}, {currentLocation.longitude}
          </Text>
        )}

        {/* Salary Preferences */}
        <Text style={styles.label}>Salary Preferences (up to 5):</Text>
        {attributes.salaryPrefs.map((salary, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={salary}
            onChangeText={text => handleInputChange('salaryPrefs', index, text)}
            placeholder={`Salary ${index + 1}`}
          />
        ))}
        {/* Education */}
        <Text style={styles.label}>Education (up to 5):</Text>
        {attributes.education.map((edu, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={edu}
            onChangeText={text => handleInputChange('education', index, text)}
            placeholder={`Education ${index + 1}`}
          />
        ))}

        {/* Experience */}
        <Text style={styles.label}>Experience (up to 5):</Text>
        {attributes.experience.map((exp, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={exp}
            onChangeText={text => handleInputChange('experience', index, text)}
            placeholder={`Experience ${index + 1}`}
          />
        ))}

        {/* Certifications */}
        <Text style={styles.label}>Certifications (up to 5):</Text>
        {attributes.certifications.map((cert, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={cert}
            onChangeText={text => handleInputChange('certifications', index, text)}
            placeholder={`Certification ${index + 1}`}
          />
        ))}

        {/* Availability */}
        <Text style={styles.label}>Availability (up to 5):</Text>
        {attributes.availability.map((avail, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={avail}
            onChangeText={text => handleInputChange('availability', index, text)}
            placeholder={`Availability ${index + 1}`}
          />
        ))}

        <Button title="Submit Attributes" onPress={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    marginBottom: 5,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 10,
  },
  dynamicLocation: {
    marginTop: 10,
    color: '#007BFF',
  },
});
