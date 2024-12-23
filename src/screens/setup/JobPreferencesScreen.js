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
  const userRole = setupData.role;
  const [attributes, setAttributes] = useState({
    industryPrefs: [],
    jobTypePrefs: '',
    skills: []
  });
  const [suggestions, setSuggestions] = useState({
    industries: [],
    jobTypes: [],
    skills: []
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

  const updateIndustrySuggestions = useCallback(
    debounce(async (searchTerm) => {
      try {
        const locationString = cityName && stateCode ? `${cityName}, ${stateCode}` : '';
        const industries = await fetchTrendingIndustries(searchTerm, locationString);
        
        setSuggestions(prev => ({
          ...prev,
          industries: industries.slice(0, 15) // Show up to 15 results
        }));
      } catch (error) {
        console.error('Error updating industry suggestions:', error);
      }
    }, 300),
    [cityName, stateCode]
  );

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

  const handleAddJob = () => {
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

    // Update jobs list
    console.log('Adding new job:', newJob);
    const updatedJobs = [...selectedJobs, newJob];
    setSelectedJobs(updatedJobs);
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
  };

  const handleRemoveJob = (index) => {
    const updatedJobs = [...setupData.selectedJobs];
    updatedJobs.splice(index, 1);
    updateSetupData({
      ...setupData,
      selectedJobs: updatedJobs
    });
  };

  const handleNext = () => {
    if (setupData.selectedJobs.length === 0) {
      Alert.alert('No Jobs Selected', 'Please add at least one job before continuing.');
      return;
    }
    navigation.navigate('UserOverview');
  };

  const handleIndustrySelect = (industry) => {
    console.log('handleIndustrySelect called with:', industry);
    console.log('Current setupData:', setupData);
    
    setAttributes(prev => ({
      ...prev,
      industryPrefs: [industry]
    }));
    
    // Update setupData if needed
    const updatedSetupData = {
      ...setupData,
      industryPrefs: [industry]
    };
    console.log('Updated setupData:', updatedSetupData);
    updateSetupData(updatedSetupData);
  };

  const removeJob = (index) => {
    const updatedJobs = [...setupData.selectedJobs];
    updatedJobs.splice(index, 1);
    updateSetupData({
      ...setupData,
      selectedJobs: updatedJobs
    });
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

  const renderSkills = () => {
    if (!attributes.jobTypePrefs) return null;

    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Select Skills (up to 5):</Text>
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
                      // Ensure the value is a valid number
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

  const DebugPanel = () => (
    <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10 }}>
      <Text>Local selectedJobs: {JSON.stringify(selectedJobs, null, 2)}</Text>
      <Text>Context selectedJobs: {JSON.stringify(setupData.selectedJobs, null, 2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={3} />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Select your job preferences</Text>
          <Text style={styles.subtitle}>
            Choose industries and roles you're interested in or have experience with
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Industry</Text>
            <TextInput
              style={styles.input}
              placeholder="Select Industry"
              value={selectedIndustry || attributes?.industryPrefs?.[0] || ''}
              onFocus={() => {
                console.log('Industry input focused');
                setShowIndustryDropdown(true);
              }}
              onBlur={() => {
                console.log('Input blurred');
                // Add slight delay to allow selection to process
                setTimeout(() => setShowIndustryDropdown(false), 200);
              }}
            />
            {showIndustryDropdown && (
              <View style={styles.dropdown}>
                {industries.map((industry) => (
                  <TouchableOpacity
                    key={industry}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedIndustry(industry);
                      handleIndustrySelect(industry);
                      setShowIndustryDropdown(false);
                    }}
                  >
                    <Text>{industry}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {setupData.industryPrefs?.length > 0 && (
            <View style={styles.selectedItems}>
              {setupData.industryPrefs.map((industry, index) => (
                <View key={industry} style={styles.selectedItem}>
                  <Text>{industry}</Text>
                  <TouchableOpacity onPress={() => removeIndustry(industry)}>
                    <Text style={styles.removeButton}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {setupData.industryPrefs?.length > 0 && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Job Type</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Select Job Type"
                  value={selectedJobType || attributes?.jobTypePrefs || ''}
                  onFocus={() => setShowJobTypeDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowJobTypeDropdown(false), 200);
                  }}
                />
                {showJobTypeDropdown && (
                  <View style={styles.dropdown}>
                    {jobTypes.map((jobType) => (
                      <TouchableOpacity
                        key={jobType}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedJobType(jobType);
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
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleNext}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Jobs */}
      {setupData.selectedJobs?.length > 0 && (
        <View style={styles.selectedJobsContainer}>
          <Text style={styles.selectedJobsTitle}>Selected Jobs ({setupData.selectedJobs.length})</Text>
          {selectedJobs.length > 0 && (
            <View>
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
                    onPress={() => {
                      const updatedJobs = selectedJobs.filter((_, i) => i !== index);
                      setSelectedJobs(updatedJobs);
                      updateSetupData({
                        ...setupData,
                        selectedJobs: updatedJobs
                      });
                    }}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Add Job button */}
      {attributes.jobTypePrefs && (
        <TouchableOpacity 
          style={[
            styles.addJobButton, 
            (!attributes?.industryPrefs?.[0] || !attributes?.jobTypePrefs || !attributes?.skills?.length) && 
            styles.addJobButtonDisabled
          ]} 
          onPress={handleAddJob}
          disabled={!attributes?.industryPrefs?.[0] || !attributes?.jobTypePrefs || !attributes?.skills?.length}
        >
          <Text style={styles.addJobButtonText}>
            Add Job
            {(!attributes?.industryPrefs?.[0] || !attributes?.jobTypePrefs || !attributes?.skills?.length) && 
              ' (Select required fields)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Add Job Button - only show for workers */}
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

          {__DEV__ && <DebugPanel />}

          {selectedJobs.length > 0 && (
            <View style={styles.selectedJobsContainer}>
              <Text style={styles.selectedJobsTitle}>
                Selected Jobs ({selectedJobs.length})
              </Text>
              <View>
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
                      onPress={() => {
                        const updatedJobs = selectedJobs.filter((_, i) => i !== index);
                        setSelectedJobs(updatedJobs);
                        updateSetupData({
                          ...setupData,
                          selectedJobs: updatedJobs
                        });
                      }}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
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
    padding: 24,
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
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 15,
    position: 'relative',
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
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
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    color: '#1e3a8a',
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
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#94a3b8',
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    zIndex: 2,
    maxHeight: 200,
    overflow: 'scroll',
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  debugInfo: {
    padding: 10,
    margin: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
}); 