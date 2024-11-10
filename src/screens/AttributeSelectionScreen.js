import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { data } from '../data';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';

const isWeb = typeof document !== 'undefined';
let WebMap;
if (isWeb) {
  WebMap = require('../components/WebMap').default;
}

const stateAbbreviations = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY'
};

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

  const [selectedJobs, setSelectedJobs] = useState([]);

  const [cityName, setCityName] = useState('');
  const [radius, setRadius] = useState(5000); // 5km default
  const [pulseAnimation] = useState(new Animated.Value(0));
  const [mapLoaded, setMapLoaded] = useState(false);
  const [stateCode, setStateCode] = useState('');

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

  useEffect(() => {
    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY`;
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.body.appendChild(script);
    }
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

      // Get city name and state from coordinates
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      const city = data.address.city || data.address.town || data.address.village;
      const state = data.address.state;
      
      // Get state abbreviation from mapping
      const stateAbbrev = stateAbbreviations[state?.toLowerCase()] || '';
      
      setCityName(city);
      setStateCode(stateAbbrev);
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

  const handleAddJob = () => {
    if (selectedJobs.length >= 3) {
      Alert.alert('Maximum Jobs', 'You can only add up to 3 jobs.');
      return;
    }

    if (!attributes.industryPrefs[0] || !attributes.jobTypePrefs || attributes.skills.length === 0) {
      Alert.alert('Incomplete Job', 'Please select an industry, job type, and at least one skill.');
      return;
    }

    const newJob = {
      industry: attributes.industryPrefs[0],
      jobType: attributes.jobTypePrefs,
      skills: [...attributes.skills]
    };

    setSelectedJobs(prev => [...prev, newJob]);

    // Reset job-related fields
    setAttributes(prev => ({
      ...prev,
      industryPrefs: [],
      jobTypePrefs: '',
      skills: []
    }));
    setInputValues(prev => ({ ...prev, industryPrefs: '' }));
    setSuggestions(prev => ({ ...prev, jobTypes: [], skills: [] }));
  };

  const handleRemoveJob = (index) => {
    setSelectedJobs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (userRole === 'worker' && selectedJobs.length === 0) {
        Alert.alert('No Jobs Selected', 'Please add at least one job before submitting.');
        return;
      }

      const locationData = attributes.location
        ? new firebase.firestore.GeoPoint(attributes.location.latitude, attributes.location.longitude)
        : null;

      let dataToSubmit = {
        ...attributes,
        selectedJobs,
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

  const renderMap = () => {
    if (!attributes.location) return null;

    if (isWeb && WebMap) {
      return (
        <WebMap 
          location={attributes.location}
          cityName={cityName}
          stateCode={stateCode}
        />
      );
    }

    return (
      <View style={styles.mapContainer}>
        <Text style={styles.locationText}>
          Current Location: {cityName}{stateCode ? `, ${stateCode}` : ''}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={isWeb ? undefined : "padding"}
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

        {renderMap()}

        {userRole === 'worker' && (
          <>
            <TouchableOpacity 
              style={[styles.addJobButton, 
                (!attributes.industryPrefs[0] || !attributes.jobTypePrefs || attributes.skills.length === 0) && 
                styles.addJobButtonDisabled
              ]} 
              onPress={handleAddJob}
            >
              <Text style={styles.addJobButtonText}>Add Job</Text>
            </TouchableOpacity>

            {selectedJobs.length > 0 && (
              <View style={styles.selectedJobsContainer}>
                <Text style={styles.selectedJobsTitle}>Selected Jobs:</Text>
                {selectedJobs.map((job, index) => (
                  <View key={index} style={styles.selectedJobItem}>
                    <View style={styles.selectedJobInfo}>
                      <Text style={styles.selectedJobText}>
                        {job.industry} - {job.jobType}
                      </Text>
                      <Text style={styles.selectedJobSkills}>
                        Skills: {job.skills.join(', ')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveJob(index)}>
                      <Ionicons name="close-circle" size={24} color="#FF4136" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
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
  addJobButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  addJobButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  addJobButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedJobsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedJobsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  selectedJobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedJobInfo: {
    flex: 1,
    marginRight: 10,
  },
  selectedJobText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  selectedJobSkills: {
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    height: 300,
    marginVertical: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#007BFF',
  },
  radiusControl: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  slider: {
    width: '100%',
    height: 40,
    ...(isWeb && {
      appearance: 'none',
      height: 5,
      background: '#ddd',
      borderRadius: 5,
      outline: 'none',
    }),
  },
  pulseCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007BFF',
  },
});
