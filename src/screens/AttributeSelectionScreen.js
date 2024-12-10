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
import { fetchTrendingIndustries, fetchTrendingJobs, fetchTrendingSkills } from '../services/trendsService';
import Slider from '@react-native-community/slider';
import ProgressStepper from '../components/ProgressStepper';

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

const BACKEND_URL = 'http://127.0.0.1:5000';  // or your Flask server URL

export default function AttributeSelectionScreen({ route, navigation }) {
  const { isNewUser } = route.params;
  const [userRole, setUserRole] = useState(null);
  const [attributes, setAttributes] = useState({
    name: '',
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

  const [overviewQuestions, setOverviewQuestions] = useState([]);
  const [overviewResponses, setOverviewResponses] = useState({});
  const [generatedOverview, setGeneratedOverview] = useState('');
  const [isEditingOverview, setIsEditingOverview] = useState(false);

  const [trendingData, setTrendingData] = useState({
    industries: [],
    jobs: {}
  });

  const [locationPreference, setLocationPreference] = useState(5000); // 5km default

  const [skillExperience, setSkillExperience] = useState({});

  const [isJobTypeInputFocused, setIsJobTypeInputFocused] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);

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

  useEffect(() => {
    if (userRole) {
      fetchOverviewQuestions();
    }
  }, [userRole]);

  useEffect(() => {
    const fetchInitialTrends = async () => {
      try {
        const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
        const industries = await fetchTrendingIndustries('', locationString);
        setTrendingData(prev => ({
          ...prev,
          industries: industries
        }));
        setSuggestions(prev => ({
          ...prev,
          industries: industries
        }));
      } catch (error) {
        console.error('Error fetching trending industries:', error);
      }
    };

    fetchInitialTrends();
  }, [cityName, stateCode]);

  useEffect(() => {
    // Example logic to determine current step
    if (attributes.name) setCurrentStep(2);
    if (attributes.jobTypePrefs) setCurrentStep(3);
    if (attributes.location) setCurrentStep(4);
    if (generatedOverview) setCurrentStep(5);
  }, [attributes, generatedOverview]);

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
    if (field === 'locationPreference') {
      // Store locationPreference as a string value
      setLocationPreference(value);
    }
    
    setAttributes(prev => ({
      ...prev,
      [field]: value
    }));

    // If changing job type, update skills
    if (field === 'jobTypePrefs') {
      console.log(`Updating skills for job type: ${value}`);
      updateSkillSuggestions(value);
    }
  };

  const updateIndustrySuggestions = useCallback(
    debounce(async (searchTerm) => {
        try {
            const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
            const trendingIndustries = await fetchTrendingIndustries(searchTerm, locationString);
            
            // Get all industries that start with the search term
            const startsWith = data.industries.filter(industry => 
                industry.toLowerCase().startsWith(searchTerm.toLowerCase())
            );
            
            // Get industries that contain the search term (but don't start with it)
            const contains = data.industries.filter(industry => 
                industry.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !industry.toLowerCase().startsWith(searchTerm.toLowerCase())
            );
            
            // Combine all results, removing duplicates
            const allIndustries = Array.from(new Set([
                ...startsWith,
                ...contains,
                ...trendingIndustries
            ]));
            
            // Always maintain at least 10 suggestions
            const minSuggestions = 10;
            let suggestions = allIndustries;
            
            // If we have fewer than 10 suggestions, add more from the full industry list
            if (suggestions.length < minSuggestions) {
                const additionalIndustries = data.industries
                    .filter(industry => !suggestions.includes(industry))
                    .slice(0, minSuggestions - suggestions.length);
                suggestions = [...suggestions, ...additionalIndustries];
            }
            
            setSuggestions(prev => ({
                ...prev,
                industries: suggestions.slice(0, 15) // Show up to 15 results
            }));
            
        } catch (error) {
            console.error('Error updating industry suggestions:', error);
        }
    }, 300),
    [data.industries, cityName, stateCode]
  );

  const updateJobTypeSuggestions = useCallback(
    async (industry) => {
      try {
        if (!industry) return;
        
        const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
        console.log(`Fetching jobs for industry: ${industry} in ${locationString}`);
        const jobs = await fetchTrendingJobs(industry, locationString);
        
        setTrendingData(prev => ({
          ...prev,
          jobs: {
            ...prev.jobs,
            [industry]: jobs
          }
        }));
        
        setSuggestions(prev => ({ 
          ...prev, 
          jobTypes: jobs 
        }));
      } catch (error) {
        console.error('Error updating job suggestions:', error);
        setSuggestions(prev => ({ 
          ...prev, 
          jobTypes: [] 
        }));
      }
    },
    [cityName, stateCode]
  );

  const updateSkillSuggestions = useCallback(
    debounce(async (jobType) => {
        try {
            if (!jobType || !attributes.industryPrefs[0]) return;
            
            const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
            console.log(`Fetching skills for ${jobType} in ${attributes.industryPrefs[0]} in ${locationString}`);
            const skills = await fetchTrendingSkills(jobType, attributes.industryPrefs[0], locationString);
            
            if (Array.isArray(skills) && skills.length > 0) {
                console.log(`Received skills: ${skills}`);
                setSuggestions(prev => ({
                    ...prev,
                    skills: skills
                }));
            } else {
                console.log("No skills returned");
                // Set default skills if none returned
                setSuggestions(prev => ({
                    ...prev,
                    skills: [
                        "Communication",
                        "Problem Solving",
                        "Team Work",
                        "Project Management",
                        "Time Management",
                        "Leadership",
                        "Analytics",
                        "Critical Thinking",
                        "Organization",
                        "Attention to Detail"
                    ]
                }));
            }
        } catch (error) {
            console.error('Error updating skill suggestions:', error);
            // Set default skills on error
            setSuggestions(prev => ({
                ...prev,
                skills: [
                    "Communication",
                    "Problem Solving",
                    "Team Work",
                    "Project Management",
                    "Time Management"
                ]
            }));
        }
    }, 300),
    [attributes.industryPrefs, cityName, stateCode]
);

  const handleSkillSelection = (skill) => {
    const existingSkillIndex = attributes.skills.findIndex(s => s.name === skill);
    
    if (existingSkillIndex !== -1) {
      // Remove skill
      setAttributes(prev => ({
        ...prev,
        skills: prev.skills.filter(s => s.name !== skill)
      }));
    } else if (attributes.skills.length < 5) {
      // Add skill with default 0 years experience
      setAttributes(prev => ({
        ...prev,
        skills: [...prev.skills, { name: skill, yearsOfExperience: 0 }]
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
      
      // Immediately fetch job types for the new industry
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
    if (!attributes.industryPrefs[0] || !attributes.jobTypePrefs) {
      Alert.alert('Missing Information', 'Please select both industry and job type.');
      return;
    }

    const newJob = {
      industry: attributes.industryPrefs[0],
      title: attributes.jobTypePrefs,
      skills: [...attributes.skills] // Copy the current skills with their experience
    };

    setSelectedJobs(prev => [...prev, newJob]);
    
    // Reset job-specific fields but keep the skills
    setAttributes(prev => ({
      ...prev,
      jobTypePrefs: '',
      industryPrefs: []
    }));
  };

  const handleRemoveJob = (index) => {
    setSelectedJobs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      console.log('Submit button pressed');
      console.log('Current user:', currentUser);
      
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
        locationPreference,
        uid: currentUser.uid,
        email: currentUser.email,
        role: userRole,
      };

      console.log('Data to submit:', dataToSubmit);

      // Save to Firestore
      await db.collection('user_attributes').doc(currentUser.uid).set(dataToSubmit);
      console.log('Data saved successfully');

      // Try immediate navigation without Alert
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Availability',
            params: { isInitialSetup: true, userRole: userRole }
          }
        ]
      });

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      Alert.alert('Error', 'Failed to save attributes');
    }
  };

  const showAllIndustries = () => {
    setSuggestions(prev => ({ ...prev, industries: data.industries }));
  };

  const renderMap = () => {
    if (!attributes.location) return null;

    const radiusControl = (
      <View style={styles.radiusControl}>
        <Text style={styles.radiusText}>
          Search Radius: {(locationPreference / 1609.34).toFixed(1)} miles
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={1609.34} // 1 mile in meters
          maximumValue={80467.2} // 50 miles in meters
          step={1609.34}
          value={locationPreference}
          onValueChange={(value) => {
            setLocationPreference(value);
            handleInputChange('locationPreference', value);
          }}
          minimumTrackTintColor="#007BFF"
          maximumTrackTintColor="#000000"
        />
      </View>
    );

    if (isWeb && WebMap) {
      return (
        <View style={styles.mapContainer}>
          <WebMap 
            location={attributes.location}
            cityName={cityName}
            stateCode={stateCode}
            radius={locationPreference}
          />
          {radiusControl}
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <Text style={styles.locationText}>
          Current Location: {cityName}{stateCode ? `, ${stateCode}` : ''}
        </Text>
        {radiusControl}
      </View>
    );
  };

  const fetchOverviewQuestions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/generate-overview-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: userRole,
          selectedJobs: attributes.selectedJobs || [],
          industryPrefs: attributes.industryPrefs || [],
        }),
      });

      const data = await response.json();
      if (data.success) {
        setOverviewQuestions(data.questions);
      } else {
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Error fetching overview questions:', error);
    }
  };

  const handleOverviewResponse = (question, answer) => {
    setOverviewResponses(prev => ({
      ...prev,
      [question]: answer
    }));
  };

  const canGenerateOverview = () => {
  return Object.values(overviewResponses).some(response => response && response.trim() !== '');
};

  const generateOverview = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/generate-overview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: userRole,
        responses: overviewResponses,
        selectedJobs: selectedJobs,
        industryPrefs: attributes.industryPrefs
      }),
    });

    const data = await response.json();
    if (data.success) {
      setGeneratedOverview(data.overview);
      setAttributes(prev => ({
        ...prev,
        user_overview: data.overview
      }));
    } else {
      console.error('Error:', data.error);
      Alert.alert(
        'Error',
        'Failed to generate overview. Please try again.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error generating overview:', error);
    Alert.alert(
      'Error',
      'Failed to connect to server. Please try again.',
      [{ text: 'OK' }]
    );
  }
};

  const handleIndustryInputFocus = useCallback(() => {
    setIsIndustryInputFocused(true);
    if (trendingData.industries.length > 0) {
      setSuggestions(prev => ({ ...prev, industries: trendingData.industries }));
    }
  }, [trendingData.industries]);

  const handleJobTypeSelect = (jobType) => {
    handleInputChange('jobTypePrefs', jobType);
    setIsJobTypeInputFocused(false); // Hide dropdown after selection
    updateSkillSuggestions(jobType);
  };

  // Add this function to check if form is valid
  const isFormValid = () => {
    console.log('Checking form validity:', {
      selectedJobs: selectedJobs,
      userRole: userRole
    });
    
    if (userRole === 'worker') {
      // For workers, only require selected jobs
      const isValid = selectedJobs.length > 0;
      console.log('Worker form validity:', isValid);
      return isValid;
    } else {
      // For employers
      const hasJobDetails = attributes.jobTitle && 
        attributes.salaryRange && 
        attributes.salaryRange.min && 
        attributes.salaryRange.max;
      
      const hasIndustry = attributes.industryPrefs.length > 0;
      const hasJobType = attributes.jobTypePrefs !== '';
      const hasSkills = attributes.skills.length > 0;
      
      const isValid = hasJobDetails && hasIndustry && hasJobType && hasSkills;
      console.log('Employer form validity:', isValid);
      return isValid;
    }
  };

  const fetchSkillSuggestions = async (jobTitle) => {
    try {
      const response = await fetch(`${BACKEND_URL}/suggest-skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobTitle }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSuggestions(prev => ({
          ...prev,
          skills: data.skills
        }));
      }
    } catch (error) {
      console.error('Error fetching skill suggestions:', error);
    }
  };

  const updateSkillExperience = (skill, years) => {
    setSkillExperience(prev => ({
      ...prev,
      [skill]: years
    }));
    
    // Update the skill in attributes if it exists
    setAttributes(prev => ({
      ...prev,
      skills: prev.skills.map(s => 
        s.name === skill ? { ...s, yearsOfExperience: years } : s
      )
    }));
  };

  const renderSelectedJob = (job) => {
    const skillsDisplay = job.skills && job.skills.length > 0
      ? job.skills.map(skill => 
          `${skill.name} (${skill.yearsOfExperience} yr${skill.yearsOfExperience !== 1 ? 's' : ''})`
        ).join(', ')
      : 'No skills selected';

    return (
      <View style={styles.selectedJobItem}>
        <View style={styles.selectedJobInfo}>
          <Text style={styles.selectedJobText}>
            {`${job.industry} - ${job.title}`}
          </Text>
          <Text style={styles.selectedJobSkills}>
            Skills: {skillsDisplay}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleRemoveJob(job)}>
          <Ionicons name="close-circle" size={24} color="#dc3545" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSkillItem = (skill) => {
    const isSelected = attributes.skills.some(s => s.name === skill);
    
    return (
      <View style={styles.skillItemContainer}>
        <TouchableOpacity
          style={[
            styles.skillItem,
            isSelected && styles.selectedSkillItem
          ]}
          onPress={() => handleSkillSelection(skill)}
        >
          <Text style={[
            styles.skillItemText,
            isSelected && styles.selectedSkillItemText
          ]}>
            {skill}
          </Text>
        </TouchableOpacity>
        
        {isSelected && (
          <View style={styles.experienceInput}>
            <TextInput
              style={styles.experienceTextInput}
              keyboardType="numeric"
              placeholder="Years"
              value={attributes.skills.find(s => s.name === skill)?.yearsOfExperience?.toString() || ''}
              onChangeText={(value) => updateSkillExperience(skill, parseInt(value) || 0)}
            />
            <Text style={styles.experienceLabel}>years</Text>
          </View>
        )}
      </View>
    );
  };

  const handleIndustryInputChange = (text) => {
    setInputValues(prev => ({ ...prev, industryPrefs: text }));
    
    // Filter existing suggestions
    const filteredIndustries = trendingData.industries.filter(industry => 
      industry.toLowerCase().includes(text.toLowerCase())
    );
    
    // Update suggestions immediately with filtered results
    setSuggestions(prev => ({
      ...prev,
      industries: filteredIndustries
    }));
    
    // Fetch new suggestions from API
    updateIndustrySuggestions(text);
  };

  const handleJobTypeInputChange = (text) => {
    setInputValues(prev => ({ ...prev, jobTypePrefs: text }));
    
    // If we have an industry selected, filter and fetch job types
    if (attributes.industryPrefs[0]) {
      // Filter existing job types
      const filteredJobs = trendingData.jobs[attributes.industryPrefs[0]]?.filter(job => 
        job.toLowerCase().includes(text.toLowerCase())
      ) || [];
      
      setSuggestions(prev => ({
        ...prev,
        jobTypes: filteredJobs
      }));
      
      // Fetch new job types from API
      updateJobTypeSuggestions(attributes.industryPrefs[0], text);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <KeyboardAvoidingView
        behavior={isWeb ? undefined : "padding"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <ProgressStepper currentStep={currentStep} />
          <Text style={styles.title}>Fill in Your Attributes</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Common fields for both roles */}
          {userRole === 'worker' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name:</Text>
              <TextInput
                style={[styles.input, styles.textInput]}
                value={attributes.name}
                onChangeText={(text) => handleInputChange('name', text)}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Industry Preferences:</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputValues.industryPrefs}
                onChangeText={handleIndustryInputChange}
                placeholder="Type to search industries"
                onFocus={handleIndustryInputFocus}
                onBlur={() => {
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
                keyExtractor={(item, index) => `industry-${index}`}
                renderItem={({ item }) => {
                  const displayName = item.name || item;
                  const inputValue = inputValues.industryPrefs.toLowerCase();
                  if (!inputValue || displayName.toLowerCase().startsWith(inputValue)) {
                    return (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => {
                          addIndustry(displayName);
                          updateJobTypeSuggestions(displayName);
                          setInputValues(prev => ({ ...prev, industryPrefs: '' }));
                          setIsIndustryInputFocused(false);
                        }}
                      >
                        <Text>{displayName}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
                }}
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
                    value={inputValues.jobTypePrefs}
                    onChangeText={handleJobTypeInputChange}
                    placeholder="Type to search job types"
                    onFocus={() => setIsJobTypeInputFocused(true)}
                    onBlur={() => setTimeout(() => setIsJobTypeInputFocused(false), 200)}
                  />
                  
                  {/* Add bubble display for selected job type */}
                  {attributes.jobTypePrefs && (
                    <View style={styles.bubbleContainer}>
                      <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{attributes.jobTypePrefs}</Text>
                        <TouchableOpacity 
                          onPress={() => {
                            handleInputChange('jobTypePrefs', '');
                            setAttributes(prev => ({
                              ...prev,
                              skills: []  // Clear skills when job type is removed
                            }));
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  {/* Job type suggestions dropdown */}
                  {isJobTypeInputFocused && suggestions.jobTypes.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <ScrollView>
                        {suggestions.jobTypes.map((job, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              handleJobTypeSelect(job);
                              setInputValues(prev => ({ ...prev, jobTypePrefs: '' }));  // Clear input after selection
                            }}
                            style={styles.suggestionItem}
                          >
                            <Text>{job}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {attributes.jobTypePrefs && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Skills (select up to 5):</Text>
                  <FlatList
                    data={suggestions.skills}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => renderSkillItem(item)}
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

          {/* Add Job Button for Workers */}
          {userRole === 'worker' && (
            <>
              <TouchableOpacity 
                style={[
                  styles.addJobButton, 
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
                  {selectedJobs.map((job, index) => renderSelectedJob(job))}
                </View>
              )}
            </>
          )}

          {/* Map Section */}
          {attributes.location && (
            <View style={styles.mapSection}>
              <Text style={styles.sectionTitle}>Location Preferences</Text>
              {renderMap()}
            </View>
          )}

          {/* Overview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {userRole === 'worker' ? 'User Overview' : 'Job Overview'}
            </Text>
            
            {!generatedOverview ? (
              <>
                {overviewQuestions.map((question, index) => (
                  <View key={index} style={styles.inputContainer}>
                    <Text style={styles.label}>{question}</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      multiline
                      numberOfLines={3}
                      value={overviewResponses[question] || ''}
                      onChangeText={(text) => handleOverviewResponse(question, text)}
                      placeholder="Enter your response..."
                    />
                  </View>
                ))}
                
                <TouchableOpacity 
  style={[
    styles.button, 
    styles.generateButton,
    !canGenerateOverview() && styles.buttonDisabled
  ]}
  onPress={generateOverview}
  disabled={!canGenerateOverview()}
>
  <Text style={[
    styles.buttonText,
    !canGenerateOverview() && styles.buttonTextDisabled
  ]}>
    Generate Overview
  </Text>
</TouchableOpacity>
              </>
            ) : (
              <View style={styles.overviewContainer}>
                {isEditingOverview ? (
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={6}
                    value={generatedOverview}
                    onChangeText={(text) => {
                      setGeneratedOverview(text);
                      setAttributes(prev => ({
                        ...prev,
                        user_overview: text
                      }));
                    }}
                  />
                ) : (
                  <Text style={styles.overviewText}>{generatedOverview}</Text>
                )}
                
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => setIsEditingOverview(!isEditingOverview)}
                >
                  <Text style={styles.editButtonText}>
                    {isEditingOverview ? 'Save' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button at the bottom */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormValid() && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid()}
          >
            <Text style={[
              styles.submitButtonText,
              !isFormValid() && styles.submitButtonTextDisabled
            ]}>
              Submit Attributes
            </Text>
          </TouchableOpacity>

          {/* Add bottom padding for scrolling */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    height: '100vh',
    overflow: 'auto',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitButtonTextDisabled: {
    color: '#e2e8f0',
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
    height: 400,
    marginVertical: 20,
    borderRadius: 8,
    overflow: 'visible',
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
    zIndex: 2,
  },
  radiusText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
    zIndex: 3,
  },
  pulseCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007BFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  generateButton: {
    backgroundColor: '#3b82f6',
    marginVertical: 10,
  },
  overviewContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  overviewText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  editButton: {
    alignSelf: 'flex-end',
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  editButtonText: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  mapSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  bottomPadding: {
    height: 50, // Extra space at bottom for web scrolling
  },
  skillItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skillItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedSkillItem: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  skillItemText: {
    color: '#333',
  },
  selectedSkillItemText: {
    color: '#fff',
  },
  buttonDisabled: {
  backgroundColor: '#cccccc',
  opacity: 0.7,
},
buttonTextDisabled: {
  color: '#666666',
},
  experienceInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  experienceTextInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 4,
    paddingHorizontal: 8,
    marginRight: 5,
  },
  experienceLabel: {
    color: '#666',
  },
  suggestionsContainer: {
    maxHeight: 200,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
