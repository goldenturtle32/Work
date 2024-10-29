import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  FlatList,
//  Animated, // Add this
//  Dimensions, // Add this
//  PanResponder, // Add this
} from 'react-native';
import * as Location from 'expo-location';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { data } from '../data';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';

export default function AttributeSelectionScreen({ route, navigation }) {
  const { isNewUser } = route.params;
  const [userRole, setUserRole] = useState(null);
  const [attributes, setAttributes] = useState({
    // Common attributes
    industryPrefs: [],
    location: null,
    // Worker-specific attributes
    jobTypePrefs: '',
    skills: [],
    salaryPrefs: '',
    education: '',
    experience: '',
    certifications: '',
    availability: '',
    // Employer-specific attributes
    jobTitle: '',
    estimatedHours: '',
    requiredSkills: [],
    requiredCertifications: [],
    requiredEducation: '',
    requiredExperience: '',
    requiredAvailability: '',
    salaryRange: { min: '', max: '' },
  });

  const [inputValues, setInputValues] = useState({
    industryPrefs: '',
  });

  const [suggestions, setSuggestions] = useState({
    industries: [],
    jobTypes: [],
    skills: [],
  });

  const [error, setError] = useState(null);
  const currentUser = auth.currentUser;

  const [isIndustryInputFocused, setIsIndustryInputFocused] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        setUserRole(userData.role);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setError('Failed to fetch user role');
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      setAttributes(prev => ({ ...prev, location: { latitude, longitude } }));
    } catch (error) {
      setError('Error fetching location: ' + error.message);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'industryPrefs') {
      setInputValues(prev => ({ ...prev, [field]: value }));
      updateIndustrySuggestions(value);
    } else if (field === 'jobTypePrefs') {
      setAttributes(prev => ({ ...prev, [field]: value, skills: [] }));
      updateSkillSuggestions(value);
    } else {
      setAttributes(prev => ({ ...prev, [field]: value }));
    }
  };

  const updateIndustrySuggestions = useCallback(
    debounce((input) => {
      const filteredIndustries = data.industries.filter(industry =>
        industry.name.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(prev => ({ ...prev, industries: filteredIndustries }));
    }, 300),
    []
  );

  const updateJobTypeSuggestions = useCallback(
    debounce((industry) => {
      const selectedIndustry = data.industries.find(ind => ind.name === industry);
      const jobTypes = selectedIndustry ? selectedIndustry.jobTypes : [];
      setSuggestions(prev => ({ ...prev, jobTypes }));
    }, 300),
    []
  );

  const updateSkillSuggestions = useCallback(
    debounce((jobType) => {
      const selectedIndustry = data.industries.find(ind => 
        ind.name === attributes.industryPrefs[0] // Assuming we're using the first selected industry
      );
      const selectedJobType = selectedIndustry?.jobTypes.find(job => job.name === jobType);
      const skills = selectedJobType ? selectedJobType.skills : [];
      setSuggestions(prev => ({ ...prev, skills }));
    }, 300),
    [attributes.industryPrefs]
  );

  const handleSkillSelection = (skill) => {
    if (attributes.skills.includes(skill)) {
      setAttributes(prev => ({
        ...prev,
        skills: prev.skills.filter(s => s !== skill)
      }));
    } else if (attributes.skills.length < 5) {
      setAttributes(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    } else {
      Alert.alert('Maximum Skills', 'You can select up to 5 skills.');
    }
  };

  const addIndustry = (industry) => {
    if (industry && !attributes.industryPrefs.includes(industry)) {
      setAttributes(prev => ({
        ...prev,
        industryPrefs: [...prev.industryPrefs, industry],
        jobTypePrefs: '',
        skills: []
      }));
      setInputValues(prev => ({ ...prev, industryPrefs: '' }));
      updateJobTypeSuggestions(industry);
    }
  };

  const removeIndustry = (industry) => {
    setAttributes(prev => ({
      ...prev,
      industryPrefs: prev.industryPrefs.filter(item => item !== industry)
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const locationData = attributes.location
        ? new firebase.firestore.GeoPoint(attributes.location.latitude, attributes.location.longitude)
        : null;

      let dataToSubmit = {
        ...attributes,
        location: locationData,
        uid: currentUser.uid,
        email: currentUser.email,
        role: userRole,
      };

      if (userRole === 'worker') {
        await db.collection('user_attributes').doc(currentUser.uid).set(dataToSubmit);
      } else if (userRole === 'employer') {
        // Remove worker-specific fields
        delete dataToSubmit.jobTypePrefs;
        delete dataToSubmit.skills;
        delete dataToSubmit.salaryPrefs;
        delete dataToSubmit.education;
        delete dataToSubmit.experience;
        delete dataToSubmit.certifications;
        delete dataToSubmit.availability;

        await db.collection('job_attributes').doc(currentUser.uid).set(dataToSubmit);
      }

      await db.collection('users').doc(currentUser.uid).update({
        isNewUser: false
      });

      Alert.alert('Success', 'Attributes saved successfully!');
      
      if (isNewUser) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error saving attributes:', error);
      Alert.alert('Error', 'Failed to save attributes');
    }
  };

  const showAllIndustries = () => {
    setSuggestions(prev => ({ ...prev, industries: data.industries }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Fill in Your Attributes</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Common fields for both roles */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Industry Preferences:</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputValues.industryPrefs}
              onChangeText={(text) => handleInputChange('industryPrefs', text)}
              placeholder="Type to search industries"
              onFocus={() => {
                setIsIndustryInputFocused(true);
                showAllIndustries();
              }}
              onBlur={() => {
                // Delay hiding the suggestions to allow for selection
                setTimeout(() => setIsIndustryInputFocused(false), 200);
              }}
            />
          </View>
          <View style={styles.bubbleContainer}>
            {attributes.industryPrefs.map((industry, index) => (
              <View key={index} style={styles.bubble}>
                <Text style={styles.bubbleText}>{industry}</Text>
                <TouchableOpacity onPress={() => removeIndustry(industry)}>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {isIndustryInputFocused && suggestions.industries.length > 0 && (
            <FlatList
              data={suggestions.industries}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => {
                    addIndustry(item.name);
                    updateJobTypeSuggestions(item.name);
                    setInputValues(prev => ({ ...prev, industryPrefs: '' }));
                    setIsIndustryInputFocused(false);
                  }}
                >
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={styles.suggestionList}
            />
          )}
        </View>

        {/* Worker-specific fields */}
        {userRole === 'worker' && (
          <>
            {attributes.industryPrefs && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Job Type Preferences:</Text>
                <TextInput
                  style={styles.input}
                  value={attributes.jobTypePrefs}
                  onChangeText={(text) => {
                    handleInputChange('jobTypePrefs', text);
                    updateSkillSuggestions(text);
                  }}
                  placeholder="Type to search job types"
                />
                {suggestions.jobTypes.length > 0 && (
                  <FlatList
                    data={suggestions.jobTypes}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => handleInputChange('jobTypePrefs', item.name)}
                      >
                        <Text>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                    style={styles.suggestionList}
                  />
                )}
              </View>
            )}

            {attributes.jobTypePrefs && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Skills (select up to 5):</Text>
                <FlatList
                  data={suggestions.skills}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.skillItem,
                        attributes.skills.includes(item) && styles.selectedSkill
                      ]}
                      onPress={() => handleSkillSelection(item)}
                    >
                      <Text style={attributes.skills.includes(item) ? styles.selectedSkillText : styles.skillText}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  numColumns={2}
                  columnWrapperStyle={styles.skillList}
                />
              </View>
            )}
          </>
        )}

        {/* Employer-specific fields */}
        {userRole === 'employer' && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Job Title:</Text>
              <TextInput
                style={styles.input}
                value={attributes.jobTitle}
                onChangeText={(text) => handleInputChange('jobTitle', text)}
                placeholder="Enter job title"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Estimated Hours:</Text>
              <TextInput
                style={styles.input}
                value={attributes.estimatedHours}
                onChangeText={(text) => handleInputChange('estimatedHours', text)}
                placeholder="Enter estimated hours"
                keyboardType="numeric"
              />
            </View>

            {/* Add more employer-specific fields here */}
            {/* ... */}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Salary Range:</Text>
              <View style={styles.rowContainer}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={attributes.salaryRange.min}
                  onChangeText={(text) => handleInputChange('salaryRange', { ...attributes.salaryRange, min: text })}
                  placeholder="Min"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={attributes.salaryRange.max}
                  onChangeText={(text) => handleInputChange('salaryRange', { ...attributes.salaryRange, max: text })}
                  placeholder="Max"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}

        {attributes.location && (
          <Text style={styles.dynamicLocation}>
            Current Location: {attributes.location.latitude.toFixed(4)}, {attributes.location.longitude.toFixed(4)}
          </Text>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Attributes</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  dynamicLocation: {
    marginTop: 10,
    color: '#007BFF',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  suggestionList: {
    maxHeight: 150,
    borderColor: '#ccc',
    borderWidth: 1,
    borderTopWidth: 0,
    borderRadius: 0
  },
  suggestionItem: {
    padding: 10,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  skillList: {
    justifyContent: 'space-between',
  },
  skillItem: {
    flex: 0.48,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedSkill: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  skillText: {
    color: '#333',
  },
  selectedSkillText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    marginLeft: 10,
  },
  bubbleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    margin: 5,
  },
  bubbleText: {
    color: '#fff',
    marginRight: 5,
  },
});
