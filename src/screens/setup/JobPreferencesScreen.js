import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView
} from 'react-native';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import { BACKEND_URL } from '../../config';
import { fetchTrendingIndustries, fetchTrendingJobs, fetchTrendingSkills } from '../../services/trendsService';
import { auth, db } from '../../firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import axios from 'axios';

const defaultIndustries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Construction",
  "Transportation"
];

const defaultJobTypes = {
  'Technology': [
    'Software Engineer',
    'Data Scientist',
    'Product Manager',
    'DevOps Engineer'
  ],
  'Healthcare': [
    'Registered Nurse',
    'Physician',
    'Medical Assistant',
    'Healthcare Administrator'
  ]
  // Add more as needed
};

const industries = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Construction',
  'Entertainment',
  'Transportation',
  'Energy',
  'Agriculture',
  'Hospitality',
  'Real Estate',
  'Consulting',
  'Media',
  'Telecommunications'
];

// Add job types constant
const jobTypes = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'UX Designer',
  'Project Manager',
  'Business Analyst',
  'DevOps Engineer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer'
];

const availableSkills = [
  'JavaScript',
  'Python',
  'React',
  'Node.js',
  'SQL',
  'Java',
  'C++',
  'Machine Learning',
  'Data Analysis',
  'UI/UX Design'
];

export default function JobPreferencesScreen({ navigation }) {
  const { setupData, updateSetupData } = useSetup();
  const [userRole, setUserRole] = useState(null);
  const [attributes, setAttributes] = useState({
    industryPrefs: [],
    jobTypePrefs: '',
    skills: []
  });
  const [suggestions, setSuggestions] = useState({
    industries: industries,
    jobTypes: [],
    skills: [],
    isLoading: false
  });
  const [inputValues, setInputValues] = useState({
    industryPrefs: '',
    jobTypePrefs: ''
  });
  const [isIndustryInputFocused, setIsIndustryInputFocused] = useState(false);
  const [isJobTypeInputFocused, setIsJobTypeInputFocused] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [skillExperience, setSkillExperience] = useState({});
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [showJobTypeDropdown, setShowJobTypeDropdown] = useState(false);
  const [selectedJobType, setSelectedJobType] = useState('');
  const [cityName, setCityName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [selectedJobs, setSelectedJobs] = useState(setupData.selectedJobs || []);
  const [jobTypeSearchText, setJobTypeSearchText] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferredIndustry, setPreferredIndustry] = useState('');
  const [preferredJobType, setPreferredJobType] = useState('');
  console.log('Initial selectedJobs state:', selectedJobs);

  useEffect(() => {
    if (!setupData.industryPrefs) {
      updateSetupData({
        ...setupData,
        industryPrefs: [],
        selectedJobs: []
      });
    }
  }, []);

  useEffect(() => {
    console.log('setupData changed:', setupData);
    if (setupData.selectedJobs) {
      setSelectedJobs(setupData.selectedJobs);
    }
  }, [setupData.selectedJobs]);

  useEffect(() => {
    console.log('Current setupData:', setupData);
  }, [setupData]);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        if (!auth.currentUser) {
          console.error('No authenticated user');
          return;
        }

        // First try to get role from setupData
        if (setupData?.userRole) {
          console.log('Using role from setupData:', setupData.userRole);
          setUserRole(setupData.userRole);
          return;
        }

        // If not in setupData, try to get from users collection
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.role) {
            console.log('Found role in user document:', userData.role);
            setUserRole(userData.role);
            // Update setupData with the role
            updateSetupData({
              ...setupData,
              userRole: userData.role
            });
          } else {
            console.log('No role found in user document, setting default');
            const defaultRole = 'employer'; // Set default role
            await db.collection('users').doc(auth.currentUser.uid).update({
              role: defaultRole,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setUserRole(defaultRole);
            updateSetupData({
              ...setupData,
              userRole: defaultRole
            });
          }
        } else {
          console.log('Creating new user document with default role');
          const defaultRole = 'employer';
          await db.collection('users').doc(auth.currentUser.uid).set({
            role: defaultRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          setUserRole(defaultRole);
          updateSetupData({
            ...setupData,
            userRole: defaultRole
          });
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    const fetchUserLocation = async () => {
      if (auth.currentUser) {
        const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
        const userDoc = await db.collection(collectionName).doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        if (userData) {
          setCityName(userData.cityName || '');
          setStateCode(userData.stateCode || '');
        }
      }
    };
    
    fetchUserLocation();
  }, [userRole]);

  const updateIndustrySuggestions = (searchText) => {
    console.log('Updating industry suggestions with:', searchText);
    try {
      if (!searchText) {
        // If empty, show all industries
        setSuggestions(prev => ({
          ...prev,
          industries: industries
        }));
        return;
      }

      // Filter industries based on search text
      const filteredIndustries = industries.filter(industry =>
        industry.toLowerCase().includes(searchText.toLowerCase())
      );
      
      console.log('Filtered industries:', filteredIndustries);
      
      setSuggestions(prev => ({
        ...prev,
        industries: filteredIndustries
      }));
    } catch (error) {
      console.error('Error updating industry suggestions:', error);
      // Fallback to all industries on error
      setSuggestions(prev => ({
        ...prev,
        industries: industries
      }));
    }
  };

  const updateJobTypeSuggestions = useCallback(
    async (industry) => {
      try {
        if (!industry) return;
        
        const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
        console.log(`Fetching jobs for industry: ${industry} in ${locationString}`);
        const jobs = await fetchTrendingJobs(industry, locationString);
        
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
          setSuggestions(prev => ({
            ...prev,
            skills: skills
          }));
        } else {
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

  const handleIndustryInputChange = async (text) => {
    setInputValues(prev => ({ ...prev, industryPrefs: text }));
    
    try {
      const response = await fetch(`${BACKEND_URL}/suggest-industries?searchTerm=${text}`);
      const data = await response.json();
      if (data.success) {
        setSuggestions(prev => ({
          ...prev,
          industries: data.industries
        }));
      }
    } catch (error) {
      console.error('Error fetching industry suggestions:', error);
    }
  };

  const handleJobTypeInputChange = async (text) => {
    setInputValues(prev => ({ ...prev, jobTypePrefs: text }));
    
    if (attributes.industryPrefs[0]) {
      try {
        const response = await fetch(
          `${BACKEND_URL}/suggest-jobs?industry=${attributes.industryPrefs[0]}&searchTerm=${text}`
        );
        const data = await response.json();
        if (data.success) {
          setSuggestions(prev => ({
            ...prev,
            jobTypes: data.jobs
          }));
        }
      } catch (error) {
        console.error('Error fetching job type suggestions:', error);
      }
    }
  };

  const handleSkillSelection = (skill) => {
    console.log('Selecting skill:', skill);
    setAttributes(prev => {
      const updatedSkills = [...(prev.skills || [])];
      const existingIndex = updatedSkills.findIndex(s => s.name === skill);
      
      if (existingIndex !== -1) {
        // Remove skill if already selected
        updatedSkills.splice(existingIndex, 1);
      } else if (updatedSkills.length < 5) {
        // Add skill if under limit
        updatedSkills.push({
          name: skill,
          yearsOfExperience: 0
        });
      } else {
        Alert.alert('Maximum Skills', 'You can only select up to 5 skills.');
        return prev; // Return unchanged state if at limit
      }
      
      return {
        ...prev,
        skills: updatedSkills
      };
    });
  };

  const handleIndustryInputFocus = () => {
    console.log('Industry input focused');
    setIsIndustryInputFocused(true);
    setSuggestions(prev => ({
      ...prev,
      industries: defaultIndustries
    }));
  };

  const handleJobTypeSelect = (jobType) => {
    console.log('handleJobTypeSelect called with:', jobType);
    
    // Update local state first
    setAttributes(prev => ({
      ...prev,
      jobTypePrefs: jobType
    }));

    // Clear any existing skills when job type changes
    setAttributes(prev => ({
      ...prev,
      skills: []
    }));

    // Update parent state if needed
    if (setupData && updateSetupData) {
      console.log('Updating setupData:', {
        ...setupData,
        jobTypePrefs: jobType,
        skills: []
      });
      updateSetupData({
        ...setupData,
        jobTypePrefs: jobType,
        skills: []
      });
    }

    // Fetch new skills for the selected job type
    if (jobType) {
      updateSkillSuggestions(jobType);
    }
  };

  const getDefaultSkills = (jobType) => {
    const commonSkills = [
      'Communication',
      'Problem Solving',
      'Team Collaboration',
      'Project Management',
      'Time Management'
    ];

    const jobSpecificSkills = {
      'Software Engineer': ['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
      'Data Scientist': ['Python', 'Machine Learning', 'SQL', 'Statistics', 'Data Visualization'],
      'Product Manager': ['Product Strategy', 'User Research', 'Agile', 'Roadmapping', 'Stakeholder Management'],
      // Add more job-specific skills as needed
    };

    return [...(jobSpecificSkills[jobType] || []), ...commonSkills].slice(0, 10);
  };

  const removeIndustry = (industry) => {
    const updatedIndustries = setupData.industryPrefs.filter(i => i !== industry);
    updateSetupData({
      ...setupData,
      industryPrefs: updatedIndustries,
      jobTypePrefs: ''  // Clear job type when industry is removed
    });
  };

  const handleAddJob = async () => {
    console.log('Attempting to add job...', {
      industry: attributes.industryPrefs[0],
      jobType: attributes.jobTypePrefs,
      skills: attributes.skills
    });

    // Validate required fields
    if (!attributes.industryPrefs[0] || !attributes.jobTypePrefs || attributes.skills.length === 0) {
      console.log('Validation failed');
      Alert.alert('Missing Information', 'Please select industry, job type, and at least one skill.');
      return;
    }

    // Create new job object
    const newJob = {
      industry: attributes.industryPrefs[0],
      title: attributes.jobTypePrefs,
      skills: attributes.skills
    };

    // Update jobs list locally
    const updatedJobs = [...selectedJobs, newJob];
    setSelectedJobs(updatedJobs);
    
    try {
      // Update Firestore
      await db.collection('user_attributes').doc(auth.currentUser.uid).update({
        selectedJobs: firebase.firestore.FieldValue.arrayUnion(newJob),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update setup context
      updateSetupData({
        ...setupData,
        selectedJobs: updatedJobs
      });

      // Reset form state
      setAttributes({
        industryPrefs: [],
        jobTypePrefs: '',
        skills: []
      });
      setSelectedIndustry('');
      setSelectedJobType('');
      setShowIndustryDropdown(false);
      setShowJobTypeDropdown(false);
    } catch (error) {
      console.error('Error updating Firestore:', error);
      Alert.alert('Error', 'Failed to save job. Please try again.');
    }
  };

  const handleRemoveJob = (index) => {
    const updatedJobs = [...setupData.selectedJobs];
    updatedJobs.splice(index, 1);
    updateSetupData({
      ...setupData,
      selectedJobs: updatedJobs
    });
  };

  const handleNext = async () => {
    console.log('handleNext called with current state:', {
      userRole,
      setupData,
      attributes
    });

    try {
      // Ensure we have a valid role
      const currentRole = userRole || setupData?.userRole || 'employer';
      console.log('Using role for navigation:', currentRole);

      if (currentRole === 'employer') {
        // Validate employer data
        if (!attributes.industryPrefs?.[0] || !attributes.jobTypePrefs || !attributes.skills?.length) {
          Alert.alert('Missing Information', 'Please select industry, job title, and required skills.');
          return;
        }

        // Update all necessary collections
        await Promise.all([
          // Update job attributes
          db.collection('job_attributes').doc(auth.currentUser.uid).set({
            industry: attributes.industryPrefs[0],
            jobTitle: attributes.jobTypePrefs,
            requiredSkills: attributes.skills,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }),

          // Update user document
          db.collection('users').doc(auth.currentUser.uid).set({
            role: currentRole,
            setupComplete: true,
            setupStep: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true })
        ]);

        // Update setup context
        updateSetupData({
          ...setupData,
          userRole: currentRole,
          jobPreferencesCompleted: true,
          setupComplete: true
        });

        console.log('Successfully updated all documents, navigating to UserOverview');
        navigation.reset({
          index: 0,
          routes: [{ name: 'UserOverview' }],
        });
      } else {
        // Existing worker logic remains unchanged
        if (!setupData.selectedJobs?.length) {
          Alert.alert('No Jobs Selected', 'Please add at least one job before continuing.');
          return;
        }

        await db.collection('user_attributes').doc(auth.currentUser.uid).set({
          selectedJobs: setupData.selectedJobs,
          preferredIndustry: preferredIndustry.trim() || null,
          preferredJobType: preferredJobType.trim() || null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        navigation.navigate('UserOverview');
      }
    } catch (error) {
      console.error('Error in handleNext:', error);
      Alert.alert('Error', `Failed to save job information: ${error.message}`);
    }
  };

  const handleIndustrySelect = (industry) => {
    console.log('handleIndustrySelect called with:', industry);
    
    // Update all states
    setAttributes(prev => ({
      ...prev,
      industryPrefs: [industry]
    }));
    
    setInputValues(prev => ({
      ...prev,
      industryPrefs: industry
    }));
    
    updateSetupData(prev => ({
      ...prev,
      industryPrefs: [industry]
    }));

    // Clear job type when industry changes
    setSelectedJobType('');
    setJobTypeSearchText('');
    
    console.log('Updated states:', {
      attributes: { industryPrefs: [industry] },
      inputValues: { industryPrefs: industry },
      setupData: { industryPrefs: [industry] }
    });
  };

  const handleIndustryPress = (industry) => {
    console.log('Industry pressed:', industry);
    if (!setupData.industryPrefs?.includes(industry)) {
      handleIndustrySelect(industry);
    }
  };

  const renderIndustryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => handleIndustryPress(item)}
    >
      <Text>{item}</Text>
    </TouchableOpacity>
  );

  const removeJob = async (index) => {
    try {
      const updatedJobs = [...setupData.selectedJobs];
      const removedJob = updatedJobs.splice(index, 1)[0];

      // Update local state and context
      updateSetupData({
        ...setupData,
        selectedJobs: updatedJobs
      });

      // Update Firestore
      await db.collection('user_attributes').doc(auth.currentUser.uid).update({
        selectedJobs: updatedJobs,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error removing job from Firestore:', error);
      Alert.alert('Error', 'Failed to remove job. Please try again.');
    }
  };

  const handleSkillSelect = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(prev => prev.filter(s => s !== skill));
    } else if (selectedSkills.length < 5) {
      setSelectedSkills(prev => [...prev, skill]);
    }
  };

  const updateSkillExperience = (skill, years) => {
    setSkillExperience(prev => ({
      ...prev,
      [skill]: years
    }));
  };

  const fetchJobSuggestions = async (industry) => {
    try {
      if (!industry) {
        console.log('No industry provided');
        return;
      }
      
      const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
      const url = `${BACKEND_URL}/suggest-jobs?` + 
        `industry=${encodeURIComponent(industry)}` +
        `&searchTerm=${encodeURIComponent(jobTypeSearchText)}` +
        `&location=${encodeURIComponent(locationString)}`;
      
      console.log('BACKEND_URL:', BACKEND_URL);
      console.log('Attempting to fetch job suggestions from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) { 
        console.error('Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        console.log('Received job suggestions:', data.jobs);
        setSuggestions(prev => ({
          ...prev,
          jobTypes: data.jobs
        }));
      } else {
        console.error('Error in job suggestions response:', data.error);
      }
    } catch (error) {
      console.error('Detailed fetch error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setSuggestions(prev => ({
        ...prev,
        jobTypes: []
      }));
    }
  };

  const renderSkills = () => {
    if (!attributes.jobTypePrefs) return null;

    const handleRefreshSkills = async () => {
      try {
        // Keep selected skills
        const selectedSkillNames = attributes.skills.map(s => s.name);
        
        // Show loading state
        setSuggestions(prev => ({
          ...prev,
          isLoading: true
        }));
        
        // Fetch new skills
        const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
        const response = await fetch(
          `${BACKEND_URL}/trending-skills?` + 
          `jobTitle=${encodeURIComponent(attributes.jobTypePrefs)}` +
          `&industry=${encodeURIComponent(attributes.industryPrefs[0])}` +
          `&location=${encodeURIComponent(locationString)}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && Array.isArray(data.skills)) {
          // Combine selected skills with new suggestions
          const newSkills = [
            ...selectedSkillNames,
            ...data.skills.filter(skill => !selectedSkillNames.includes(skill))
          ];

          console.log('Updating skills with:', newSkills);
          
          // Force a re-render by creating a new array
          setSuggestions(prev => ({
            ...prev,
            skills: [...new Set(newSkills)],
            isLoading: false
          }));
        } else {
          console.error('Invalid response format:', data);
          Alert.alert('Error', 'Failed to refresh skills. Please try again.');
        }
      } catch (error) {
        console.error('Error refreshing skills:', error);
        Alert.alert('Error', 'Failed to refresh skills. Please try again.');
      } finally {
        setSuggestions(prev => ({
          ...prev,
          isLoading: false
        }));
      }
    };

    return (
      <View style={styles.inputContainer}>
        <View style={styles.skillsHeader}>
          <Text style={styles.label}>Select Skills (up to 5):</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshSkills}
          >
            <Ionicons name="refresh" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
        
        {/* Custom Skill Input */}
        <View style={styles.customSkillContainer}>
          <TextInput
            style={styles.customSkillInput}
            placeholder="Type a custom skill"
            onSubmitEditing={(event) => {
              const newSkill = event.nativeEvent.text.trim();
              if (newSkill && !suggestions.skills.includes(newSkill)) {
                setSuggestions(prev => ({
                  ...prev,
                  skills: [newSkill, ...prev.skills]
                }));
                event.target.clear();
              }
            }}
            returnKeyType="done"
          />
        </View>

        {/* Skills List */}
        <View style={styles.skillsContainer}>
          {suggestions.skills.map((skill) => (
            <View key={skill} style={styles.skillItemContainer}>
              <TouchableOpacity
                style={[
                  styles.skillItem,
                  attributes.skills.some(s => s.name === skill) && styles.selectedSkillItem
                ]}
                onPress={() => handleSkillSelection(skill)}
              >
                <Text style={[
                  styles.skillText,
                  attributes.skills.some(s => s.name === skill) && styles.selectedSkillText
                ]}>
                  {skill}
                </Text>
              </TouchableOpacity>
              
              {attributes.skills.some(s => s.name === skill) && (
                <View style={styles.experienceInput}>
                  <TextInput
                    style={styles.experienceTextInput}
                    keyboardType="numeric"
                    placeholder="Years"
                    value={attributes.skills.find(s => s.name === skill)?.yearsOfExperience?.toString() || ''}
                    onChangeText={(value) => {
                      const years = parseInt(value) || 0;
                      setAttributes(prev => ({
                        ...prev,
                        skills: prev.skills.map(s => 
                          s.name === skill ? { ...s, yearsOfExperience: years } : s
                        )
                      }));
                    }}
                    onBlur={() => {
                      const currentSkill = attributes.skills.find(s => s.name === skill);
                      if (currentSkill && (isNaN(currentSkill.yearsOfExperience) || currentSkill.yearsOfExperience < 0)) {
                        setAttributes(prev => ({
                          ...prev,
                          skills: prev.skills.map(s => 
                            s.name === skill ? { ...s, yearsOfExperience: 0 } : s
                          )
                        }));
                      }
                    }}
                  />
                  <Text style={styles.experienceLabel}>years</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderDebugInfo = () => (
    <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10 }}>
      <Text>Selected Jobs Count: {selectedJobs?.length || 0}</Text>
      <Text>Selected Jobs Data: {JSON.stringify(selectedJobs, null, 2)}</Text>
    </View>
  );

  // Add this useEffect to initialize suggestions
  useEffect(() => {
    setSuggestions(prev => ({
      ...prev,
      industries: industries
    }));
  }, []);

  const renderContent = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>
          {userRole === 'employer' 
            ? "Tell us about the position"
            : "Select your job preferences"}
        </Text>
        <Text style={styles.subtitle}>
          {userRole === 'employer'
            ? "Define the role you're hiring for"
            : "Choose industries and roles you're interested in"}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Industry</Text>
          <TextInput
            style={styles.input}
            placeholder="Select Industry"
            value={selectedIndustry || inputValues.industryPrefs}
            onFocus={() => {
              console.log('Industry input focused');
              setShowIndustryDropdown(true);
              updateIndustrySuggestions('');
            }}
            onBlur={() => {
              console.log('Input blurred');
              setTimeout(() => setShowIndustryDropdown(false), 200);
            }}
          />
          {showIndustryDropdown && (
            <View style={styles.suggestionsContainer}>
              {industries.map((industry, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => {
                    handleIndustrySelect(industry);
                    setShowIndustryDropdown(false);
                  }}
                >
                  <Text style={styles.suggestionText}>{industry}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Display selected industries */}
        <View style={styles.selectedItemsContainer}>
          {setupData.industryPrefs?.map((industry, index) => (
            <View key={index} style={styles.selectedItem}>
              <Text>{industry}</Text>
              <TouchableOpacity
                onPress={() => {
                  const updatedPrefs = setupData.industryPrefs.filter((_, i) => i !== index);
                  updateSetupData({
                    ...setupData,
                    industryPrefs: updatedPrefs
                  });
                }}
              >
                <Ionicons name="close-circle" size={20} color="red" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {attributes.industryPrefs?.[0] && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Job Type</Text>
              <TextInput
                style={styles.input}
                placeholder="Select or Type Job Title"
                value={selectedJobType || jobTypeSearchText}
                editable={true}
                onChangeText={(text) => {
                  setJobTypeSearchText(text);
                  setSelectedJobType(''); // Clear selected job when typing
                  if (attributes.industryPrefs?.[0]) {
                    fetchJobSuggestions(attributes.industryPrefs[0]);
                  }
                }}
                onFocus={() => {
                  console.log('Job Type input focused');
                  setShowJobTypeDropdown(true);
                  if (attributes.industryPrefs?.[0]) {
                    fetchJobSuggestions(attributes.industryPrefs[0]);
                  }
                }}
                onBlur={() => {
                  console.log('Job Type input blurred');
                  // If there's text but no selection was made, use the typed text
                  if (jobTypeSearchText && !selectedJobType) {
                    setSelectedJobType(jobTypeSearchText);
                    handleJobTypeSelect(jobTypeSearchText);
                  }
                  setTimeout(() => setShowJobTypeDropdown(false), 200);
                }}
              />
              {showJobTypeDropdown && (
                <View style={styles.dropdown}>
                  {/* Show typed text as first option if it doesn't match any suggestions */}
                  {jobTypeSearchText && 
                   !suggestions.jobTypes.some(job => 
                     job.toLowerCase() === jobTypeSearchText.toLowerCase()
                   ) && (
                    <TouchableOpacity
                      style={[styles.dropdownItem, styles.customDropdownItem]}
                      onPress={() => {
                        setSelectedJobType(jobTypeSearchText);
                        handleJobTypeSelect(jobTypeSearchText);
                        setShowJobTypeDropdown(false);
                      }}
                    >
                      <Text>Use: "{jobTypeSearchText}"</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Show filtered suggestions */}
                  {suggestions.jobTypes
                    .filter(jobType => 
                      !jobTypeSearchText || 
                      jobType.toLowerCase().includes(jobTypeSearchText.toLowerCase())
                    )
                    .map((jobType) => (
                      <TouchableOpacity
                        key={jobType}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedJobType(jobType);
                          setJobTypeSearchText('');
                          handleJobTypeSelect(jobType);
                          setShowJobTypeDropdown(false);
                        }}
                      >
                        <Text>{jobType}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>

            {/* Skills Selection - Show when job type is selected */}
            {attributes.jobTypePrefs && renderSkills()}
          </>
        )}
      </View>
    </>
  );

  // Add or modify the isFormValid function
  const isFormValid = () => {
    if (userRole === 'employer') {
      return (
        setupData.industryPrefs?.length > 0 &&
        setupData.selectedJobs?.length > 0 &&
        setupData.skills?.length > 0
      );
    } else {
      // Worker validation logic
      return setupData.selectedJobs?.length > 0; // Only check if they've added at least one job
    }
  };

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={3} />
      
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {userRole === 'employer' 
                ? "Tell us about the position"
                : "Select your job preferences"}
            </Text>
            <Text style={styles.subtitle}>
              {userRole === 'employer'
                ? "Define the role you're hiring for"
                : "Choose industries and roles you're interested in"}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Industry</Text>
              <TextInput
                style={styles.input}
                placeholder="Select Industry"
                value={selectedIndustry || inputValues.industryPrefs}
                onFocus={() => {
                  console.log('Industry input focused');
                  setShowIndustryDropdown(true);
                  updateIndustrySuggestions('');
                }}
                onBlur={() => {
                  console.log('Input blurred');
                  setTimeout(() => setShowIndustryDropdown(false), 200);
                }}
              />
              {showIndustryDropdown && (
                <View style={styles.suggestionsContainer}>
                  {industries.map((industry, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => {
                        handleIndustrySelect(industry);
                        setShowIndustryDropdown(false);
                      }}
                    >
                      <Text style={styles.suggestionText}>{industry}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Display selected industries */}
            <View style={styles.selectedItemsContainer}>
              {setupData.industryPrefs?.map((industry, index) => (
                <View key={index} style={styles.selectedItem}>
                  <Text>{industry}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const updatedPrefs = setupData.industryPrefs.filter((_, i) => i !== index);
                      updateSetupData({
                        ...setupData,
                        industryPrefs: updatedPrefs
                      });
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {attributes.industryPrefs?.[0] && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Job Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Select or Type Job Title"
                    value={selectedJobType || jobTypeSearchText}
                    editable={true}
                    onChangeText={(text) => {
                      setJobTypeSearchText(text);
                      setSelectedJobType(''); // Clear selected job when typing
                      if (attributes.industryPrefs?.[0]) {
                        fetchJobSuggestions(attributes.industryPrefs[0]);
                      }
                    }}
                    onFocus={() => {
                      console.log('Job Type input focused');
                      setShowJobTypeDropdown(true);
                      if (attributes.industryPrefs?.[0]) {
                        fetchJobSuggestions(attributes.industryPrefs[0]);
                      }
                    }}
                    onBlur={() => {
                      console.log('Job Type input blurred');
                      // If there's text but no selection was made, use the typed text
                      if (jobTypeSearchText && !selectedJobType) {
                        setSelectedJobType(jobTypeSearchText);
                        handleJobTypeSelect(jobTypeSearchText);
                      }
                      setTimeout(() => setShowJobTypeDropdown(false), 200);
                    }}
                  />
                  {showJobTypeDropdown && (
                    <View style={styles.dropdown}>
                      {/* Show typed text as first option if it doesn't match any suggestions */}
                      {jobTypeSearchText && 
                       !suggestions.jobTypes.some(job => 
                         job.toLowerCase() === jobTypeSearchText.toLowerCase()
                       ) && (
                        <TouchableOpacity
                          style={[styles.dropdownItem, styles.customDropdownItem]}
                          onPress={() => {
                            setSelectedJobType(jobTypeSearchText);
                            handleJobTypeSelect(jobTypeSearchText);
                            setShowJobTypeDropdown(false);
                          }}
                        >
                          <Text>Use: "{jobTypeSearchText}"</Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Show filtered suggestions */}
                      {suggestions.jobTypes
                        .filter(jobType => 
                          !jobTypeSearchText || 
                          jobType.toLowerCase().includes(jobTypeSearchText.toLowerCase())
                        )
                        .map((jobType) => (
                          <TouchableOpacity
                            key={jobType}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelectedJobType(jobType);
                              setJobTypeSearchText('');
                              handleJobTypeSelect(jobType);
                              setShowJobTypeDropdown(false);
                            }}
                          >
                            <Text>{jobType}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  )}
                </View>

                {/* Skills Selection - Show when job type is selected */}
                {attributes.jobTypePrefs && renderSkills()}
              </>
            )}
          </View>

          {/* Add Job button and Selected Jobs section for workers */}
          {userRole === 'worker' && (
            <>
              <TouchableOpacity 
                style={[
                  styles.addJobButton, 
                  (!attributes.industryPrefs[0] || !attributes.jobTypePrefs || attributes.skills.length === 0) && 
                  styles.addJobButtonDisabled
                ]} 
                onPress={handleAddJob}
                disabled={!attributes.industryPrefs[0] || !attributes.jobTypePrefs || attributes.skills.length === 0}
              >
                <Text style={styles.addJobButtonText}>Add Selected Job</Text>
              </TouchableOpacity>

              {selectedJobs.length > 0 && (
                <View style={styles.selectedJobsContainer}>
                  <Text style={styles.selectedJobsTitle}>
                    Selected Jobs ({selectedJobs.length})
                  </Text>
                  {selectedJobs.map((job, index) => (
                    <View key={index} style={styles.selectedJobItem}>
                      <View style={styles.selectedJobInfo}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobIndustry}>{job.industry}</Text>
                        <Text style={styles.jobSkills}>
                          Skills: {job.skills.map(skill => skill.name).join(', ')}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => removeJob(index)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {userRole === 'worker' && selectedJobs.length > 0 && (
                <View style={styles.preferencesContainer}>
                  <TouchableOpacity 
                    style={styles.preferencesHeader}
                    onPress={() => setShowPreferences(!showPreferences)}
                  >
                    <Text style={styles.preferencesTitle}>
                      🎯 Tell us about your dream job (Optional)
                    </Text>
                    <Text style={styles.preferencesSubtitle}>
                      This helps us find positions that better match your career goals
                    </Text>
                    <Ionicons 
                      name={showPreferences ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color="#1e3a8a" 
                    />
                  </TouchableOpacity>

                  {showPreferences && (
                    <View style={styles.preferencesContent}>
                      <View style={styles.preferenceField}>
                        <Text style={styles.preferenceLabel}>Preferred Industry</Text>
                        <TextInput
                          style={styles.preferenceInput}
                          placeholder="e.g., Technology, Healthcare, Finance"
                          value={preferredIndustry}
                          onChangeText={setPreferredIndustry}
                        />
                      </View>

                      <View style={styles.preferenceField}>
                        <Text style={styles.preferenceLabel}>Dream Role/Position</Text>
                        <TextInput
                          style={styles.preferenceInput}
                          placeholder="e.g., Senior Software Engineer, Project Manager"
                          value={preferredJobType}
                          onChangeText={setPreferredJobType}
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            isFormValid() ? styles.nextButtonEnabled : styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!isFormValid()}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
  },
  form: {
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 20,
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    marginTop: 2,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  suggestionText: {
    color: '#1e3a8a',
    fontSize: 14,
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  selectedItem: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingRight: 4,
    borderRadius: 16,
    gap: 4,
  },
  selectedItemText: {
    color: '#ffffff',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedJobsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedJobsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e3a8a',
  },
  selectedJobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedJobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  jobIndustry: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  jobSkills: {
    fontSize: 14,
    color: '#64748b',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    marginLeft: 12,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonEnabled: {
    backgroundColor: '#2563eb', // Blue color when enabled
  },
  nextButtonDisabled: {
    backgroundColor: '#94a3b8', // Grey color when disabled
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    marginBottom: 12,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 14,
  },
  skillList: {
    flexWrap: 'wrap',
    gap: 8,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  skillItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skillItem: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedSkillItem: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  skillText: {
    color: '#333',
    fontSize: 14,
  },
  selectedSkillText: {
    color: '#fff',
  },
  experienceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    zIndex: 1,
  },
  experienceTextInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 4,
    paddingHorizontal: 8,
    marginRight: 5,
    backgroundColor: '#fff',
    color: '#000',
    fontSize: 14,
  },
  experienceLabel: {
    color: '#666',
    fontSize: 14,
    marginLeft: 4,
  },
  addJobButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addJobButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addJobButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    overflow: 'hidden',
  },
  dropdown: {
    flex: 1,
    backgroundColor: 'white',
  },
  dropdownContent: {
    flexGrow: 0,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  debugInfo: {
    padding: 10,
    margin: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  customDropdownItem: {
    backgroundColor: '#f0f9ff', // Light blue background
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  customSkillContainer: {
    marginBottom: 12,
    marginTop: 8,
  },
  customSkillInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  skillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  inputContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    zIndex: 1,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    marginHorizontal: 10,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    padding: 8,
    margin: 4,
  },
  preferencesContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  preferencesHeader: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  preferencesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  preferencesSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  preferencesContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  preferenceField: {
    marginBottom: 16,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  preferenceInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
}); 