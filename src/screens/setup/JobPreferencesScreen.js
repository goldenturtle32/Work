import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';
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

const getBackendUrl = () => {
  if (Platform.OS === 'ios') {
    // Use your computer's local IP address when testing with physical iOS device
    return 'http://192.168.0.100:5000';  // Replace with your actual IP address
  } else if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

const BACKEND_URL = getBackendUrl();

const normalizeJobTitle = async (jobTitle) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/normalize-job-title`, {
      jobTitle: jobTitle
    });
    return response.data.normalizedTitle;
  } catch (error) {
    console.error('Error normalizing job title:', error);
    return jobTitle; // Return original title if normalization fails
  }
};

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
  const [salarySuggestion, setSalarySuggestion] = useState(null);
  const [isLoadingSalary, setIsLoadingSalary] = useState(false);
  const [includesTips, setIncludesTips] = useState(false);
  const [errors, setErrors] = useState({});
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
        console.log('Using backend URL:', BACKEND_URL);
        
        // First get raw job suggestions
        const response = await axios.get(
          `${BACKEND_URL}/suggest-jobs?industry=${encodeURIComponent(industry)}&searchTerm=${''}&location=${encodeURIComponent(locationString)}`
        );
        
        console.log('Raw job suggestions:', response.data);
        
        if (!response.data.success || !response.data.jobs) {
          throw new Error('Failed to fetch job suggestions');
        }

        // Normalize job titles
        const rawJobs = response.data.jobs;
        console.log('Starting job title normalization...');
        
        const normalizedJobs = [];
        for (const jobTitle of rawJobs) {
          try {
            console.log(`Attempting to normalize: "${jobTitle}"`);
            const normalizeResponse = await axios.post(
              `${BACKEND_URL}/normalize-job-title`,
              { jobTitle },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                timeout: 10000 // 10 second timeout
              }
            );
            
            console.log('Normalization response:', normalizeResponse.data);
            
            if (normalizeResponse.data.normalizedTitle) {
              console.log(`Successfully normalized: "${jobTitle}" → "${normalizeResponse.data.normalizedTitle}"`);
              normalizedJobs.push(normalizeResponse.data.normalizedTitle);
            } else {
              console.log(`No normalized title returned for: "${jobTitle}"`);
              normalizedJobs.push(jobTitle);
            }
          } catch (error) {
            console.error(`Failed to normalize "${jobTitle}":`, error.message);
            if (error.response) {
              console.error('Error response:', error.response.data);
            }
            normalizedJobs.push(jobTitle);
          }
        }

        // Remove duplicates
        const uniqueJobs = [...new Set(normalizedJobs)];
        console.log('Final normalized unique jobs:', uniqueJobs);
        
        setSuggestions(prev => ({ 
          ...prev, 
          jobTypes: uniqueJobs 
        }));
      } catch (error) {
        console.error('Error in updateJobTypeSuggestions:', error.message);
        if (error.response) {
          console.error('Error response:', error.response.data);
        }
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
        
        const response = await axios.get(
          `${BACKEND_URL}/suggest-skills`, {
            params: {
              jobTitle: jobType,
              industry: attributes.industryPrefs[0],
              location: locationString
            }
          }
        );

        if (response.data.success) {
          console.log('Received skills:', response.data.skills);
          setSuggestions(prev => ({
            ...prev,
            skills: response.data.skills
          }));
        } else {
          // Set default skills if API returns error
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
        console.error('Error fetching trending skills:', error);
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
          // Normalize the suggestions
          const normalizedJobs = await Promise.all(
            data.jobs.map(async (jobTitle) => {
              try {
                const normalizeResponse = await axios.post(`${BACKEND_URL}/normalize-job-title`, {
                  jobTitle: jobTitle
                });
                return normalizeResponse.data.normalizedTitle;
              } catch (error) {
                console.error('Error normalizing job title:', error);
                return jobTitle;
              }
            })
          );
          
          // Remove duplicates
          const uniqueJobs = [...new Set(normalizedJobs)];
          console.log('Normalized job suggestions:', uniqueJobs);
          
          setSuggestions(prev => ({
            ...prev,
            jobTypes: uniqueJobs
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
    console.log('Job type selected:', jobType);
    setSelectedJobType(jobType);
    setAttributes(prev => ({
      ...prev,
      jobTypePrefs: jobType,
      skills: []
    }));
    updateSetupData(prev => ({
      ...prev,
      jobTypePrefs: jobType,
      skills: []
    }));
    setShowJobTypeDropdown(false);

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
    const newErrors = {};
    
    if (userRole === 'employer') {
      // Validate pay range if skills are selected
      if (attributes.skills?.length > 0) {
        if (!setupData.estPayRangeMin) {
          newErrors.estPayRangeMin = 'Minimum pay is required';
        }
        if (!setupData.estPayRangeMax) {
          newErrors.estPayRangeMax = 'Maximum pay is required';
        }
        if (setupData.estPayRangeMin && setupData.estPayRangeMax && 
            Number(setupData.estPayRangeMin) >= Number(setupData.estPayRangeMax)) {
          newErrors.estPayRangeMax = 'Maximum pay must be greater than minimum pay';
        }
        
        // Add validation for tips if included
        if (includesTips) {
          if (!setupData.estTipRangeMin) {
            newErrors.estTipRangeMin = 'Minimum tip estimate is required';
          }
          if (!setupData.estTipRangeMax) {
            newErrors.estTipRangeMax = 'Maximum tip estimate is required';
          }
          if (setupData.estTipRangeMin && setupData.estTipRangeMax && 
              Number(setupData.estTipRangeMin) >= Number(setupData.estTipRangeMax)) {
            newErrors.estTipRangeMax = 'Maximum tip must be greater than minimum tip';
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Prepare the data to update
      const updatedData = {
        ...setupData,
        industryPrefs: attributes.industryPrefs,
        jobTypePrefs: attributes.jobTypePrefs,
        skills: attributes.skills,
        // Include pay range and tips data for employers
        ...(userRole === 'employer' && attributes.skills?.length > 0 && {
          estPayRangeMin: setupData.estPayRangeMin,
          estPayRangeMax: setupData.estPayRangeMax,
          includesTips: includesTips,
          ...(includesTips && {
            estTipRangeMin: setupData.estTipRangeMin,
            estTipRangeMax: setupData.estTipRangeMax,
          }),
        }),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Update setupData context
      updateSetupData(updatedData);

      // Update Firebase
      const collection = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      await db.collection(collection).doc(auth.currentUser.uid).update(updatedData);

      // Navigate to UserOverview instead of Availability
      navigation.navigate('UserOverview');
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    }
  };

  const handleIndustrySelect = (industry) => {
    console.log('Industry selected:', industry);
    setSelectedIndustry(industry);
    setAttributes(prev => ({
      ...prev,
      industryPrefs: [industry]
    }));
    updateSetupData(prev => ({
      ...prev,
      industryPrefs: [industry]
    }));
    setShowIndustryDropdown(false);
    
    // Clear job type when industry changes
    setSelectedJobType('');
    setJobTypeSearchText('');
    
    // Close the dropdown after selection
    setTimeout(() => {
      setShowIndustryDropdown(false);
    }, 100);
    
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
          />
          {showIndustryDropdown && (
            <ScrollView 
              style={styles.dropdown}
              horizontal={false}
              nestedScrollEnabled={true}
            >
              {suggestions.industries.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.dropdownItem}
                  onPress={() => {
                    console.log('Industry selected:', item);
                    handleIndustrySelect(item);
                    setSelectedIndustry(item);
                    setShowIndustryDropdown(false);
                  }}
                >
                  <Text>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
              />
              {showJobTypeDropdown && (
                <ScrollView 
                  style={styles.dropdown}
                  horizontal={false}
                  nestedScrollEnabled={true}
                >
                  {jobTypeSearchText && 
                   !suggestions.jobTypes.some(job => 
                     job.toLowerCase() === jobTypeSearchText.toLowerCase()
                   ) && (
                    <TouchableOpacity
                      style={[styles.dropdownItem, styles.customDropdownItem]}
                      onPress={() => {
                        console.log('Custom job type selected:', jobTypeSearchText);
                        handleJobTypeSelect(jobTypeSearchText);
                        setSelectedJobType(jobTypeSearchText);
                        setShowJobTypeDropdown(false);
                      }}
                    >
                      <Text>Use: "{jobTypeSearchText}"</Text>
                    </TouchableOpacity>
                  )}
                  
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
                          console.log('Job type selected:', jobType);
                          handleJobTypeSelect(jobType);
                          setSelectedJobType(jobType);
                          setShowJobTypeDropdown(false);
                        }}
                      >
                        <Text>{jobType}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              )}
            </View>

            {/* Skills Selection - Show when job type is selected */}
            {attributes.jobTypePrefs && renderSkills()}
          </>
        )}

        {userRole === 'employer' && attributes.skills?.length > 0 && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Pay Range Estimate ($/hr)</Text>
              <View style={styles.payRangeContainer}>
                <View style={styles.payRangeInput}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.payInput,
                      errors.estPayRangeMin && styles.inputError
                    ]}
                    value={setupData.estPayRangeMin}
                    onChangeText={(text) => {
                      updateSetupData({ estPayRangeMin: text });
                      setErrors(prev => ({ ...prev, estPayRangeMin: null }));
                    }}
                    placeholder="Min"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                  {errors.estPayRangeMin && <Text style={styles.errorText}>{errors.estPayRangeMin}</Text>}
                </View>
                
                <Text style={styles.payRangeSeparator}>to</Text>
                
                <View style={styles.payRangeInput}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.payInput,
                      errors.estPayRangeMax && styles.inputError
                    ]}
                    value={setupData.estPayRangeMax}
                    onChangeText={(text) => {
                      updateSetupData({ estPayRangeMax: text });
                      setErrors(prev => ({ ...prev, estPayRangeMax: null }));
                    }}
                    placeholder="Max"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                  {errors.estPayRangeMax && <Text style={styles.errorText}>{errors.estPayRangeMax}</Text>}
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Does this job include tips?</Text>
              <View style={styles.tipsButtonContainer}>
                {['Yes', 'No'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.tipsButton,
                      includesTips === (option === 'Yes') && styles.tipsButtonActive
                    ]}
                    onPress={() => {
                      setIncludesTips(option === 'Yes');
                      if (option === 'No') {
                        updateSetupData({ 
                          estTipRangeMin: '', 
                          estTipRangeMax: '' 
                        });
                      }
                    }}
                  >
                    <Text style={[
                      styles.tipsButtonText,
                      includesTips === (option === 'Yes') && styles.tipsButtonTextActive
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {includesTips && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Estimated Tips Range ($/hr)</Text>
                <View style={styles.payRangeContainer}>
                  <View style={styles.payRangeInput}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.payInput,
                        errors.estTipRangeMin && styles.inputError
                      ]}
                      value={setupData.estTipRangeMin}
                      onChangeText={(text) => {
                        updateSetupData({ estTipRangeMin: text });
                        setErrors(prev => ({ ...prev, estTipRangeMin: null }));
                      }}
                      placeholder="Min"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                    {errors.estTipRangeMin && <Text style={styles.errorText}>{errors.estTipRangeMin}</Text>}
                  </View>
                  
                  <Text style={styles.payRangeSeparator}>to</Text>
                  
                  <View style={styles.payRangeInput}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.payInput,
                        errors.estTipRangeMax && styles.inputError
                      ]}
                      value={setupData.estTipRangeMax}
                      onChangeText={(text) => {
                        updateSetupData({ estTipRangeMax: text });
                        setErrors(prev => ({ ...prev, estTipRangeMax: null }));
                      }}
                      placeholder="Max"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                    {errors.estTipRangeMax && <Text style={styles.errorText}>{errors.estTipRangeMax}</Text>}
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </>
  );

  // Add this function to check if minimum requirements are met
  const hasMinimumRequirements = () => {
    if (userRole === 'employer') {
      // Employers need industry, job type, and at least one skill
      return (
        attributes.industryPrefs?.length > 0 &&
        attributes.jobTypePrefs &&
        attributes.skills?.length > 0
      );
    } else {
      // Workers need at least one selected job
      return selectedJobs.length > 0;
    }
  };

  // Add this function to fetch salary suggestions
  const fetchSalarySuggestion = async () => {
    if (!attributes.jobTypePrefs || !attributes.industryPrefs[0] || !cityName || attributes.skills.length === 0) {
      return;
    }

    setIsLoadingSalary(true);
    try {
      const locationString = `${cityName}, ${stateCode}`;
      const skillsString = attributes.skills.map(s => s.name).join(',');
      
      const response = await axios.get(
        `${BACKEND_URL}/suggest-salary`, {
          params: {
            jobTitle: attributes.jobTypePrefs,
            industry: attributes.industryPrefs[0],
            location: locationString,
            skills: skillsString
          }
        }
      );

      if (response.data.success) {
        setSalarySuggestion(response.data.salary);
      }
    } catch (error) {
      console.error('Error fetching salary suggestion:', error);
    } finally {
      setIsLoadingSalary(false);
    }
  };

  // Add this useEffect to trigger salary suggestion
  useEffect(() => {
    if (userRole === 'employer' && 
        attributes.jobTypePrefs && 
        attributes.industryPrefs[0] && 
        cityName && 
        attributes.skills.length > 0) {
      fetchSalarySuggestion();
    }
  }, [attributes.jobTypePrefs, attributes.industryPrefs, cityName, attributes.skills]);

  // Add this component to render the salary suggestion
  const renderSalarySuggestion = () => {
    if (!salarySuggestion) return null;

    return (
      <View style={styles.salaryContainer}>
        <Text style={styles.salaryTitle}>Suggested Pay Range</Text>
        <View style={styles.salaryContent}>
          <Text style={styles.salaryRange}>
            ${salarySuggestion.minPay.toFixed(2)} - ${salarySuggestion.maxPay.toFixed(2)} /hr
          </Text>
          {salarySuggestion.marketData && (
            <Text style={styles.marketData}>
              Market Average: ${salarySuggestion.marketData.avgMin.toFixed(2)} - ${salarySuggestion.marketData.avgMax.toFixed(2)} /hr
            </Text>
          )}
          <Text style={styles.salaryExplanation}>
            {salarySuggestion.explanation}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={3} />
      
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {renderContent()}

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
                      Tell us about your optimal job (Optional)
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

          {/* Salary Suggestion */}
          {userRole === 'employer' && renderSalarySuggestion()}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.backButton, styles.buttonBase]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.nextButton,
            styles.buttonBase,
            !hasMinimumRequirements() && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!hasMinimumRequirements()}
        >
          <Text style={[
            styles.nextButtonText,
            !hasMinimumRequirements() && styles.nextButtonTextDisabled
          ]}>
            Next
          </Text>
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
  buttonBase: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#2563eb',
  },
  nextButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButtonTextDisabled: {
    opacity: 0.8,
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
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  customDropdownItem: {
    backgroundColor: '#f0f9ff',
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
  salaryContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  salaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  salaryContent: {
    gap: 8,
  },
  salaryRange: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0284c7',
  },
  salaryExplanation: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
  },
  marketData: {
    fontSize: 14,
    color: '#0369a1',
    fontStyle: 'italic',
    marginTop: 4,
  },
  payRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payRangeInput: {
    flex: 1,
  },
  payInput: {
    textAlign: 'center',
  },
  payRangeSeparator: {
    marginHorizontal: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  tipsButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tipsButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  tipsButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tipsButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsButtonTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
}); 