import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { db, auth, firebase } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Job from '../models/Job';
import User from '../models/User';
import UserJobPreference from '../models/UserJobPreference';
import { 
  useFonts,
  LibreBodoni_400Regular,
  LibreBodoni_700Bold,
} from '@expo-google-fonts/libre-bodoni';
import { 
  DMSerifText_400Regular 
} from '@expo-google-fonts/dm-serif-text';
import NewMatchModal from '../components/NewMatchModal';
import styled from 'styled-components/native';
import DotLoader from '../components/Loader';
import { getFirestore, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import EmptyStateLoader from '../components/loaders/EmptyStateLoader';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const getBackendUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';  // Android Emulator
  } else if (Platform.OS === 'ios') {
    if (Platform.isPad || Platform.isTV) {
      return 'http://localhost:5000';  // iOS Simulator
    } else {
      // For physical iOS devices, use your computer's local IP address
      return 'http://192.168.0.100:5000';  // Replace with your computer's IP
    }
  }
  return 'http://localhost:5000';  // Default fallback
};

const BACKEND_URL = getBackendUrl();

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in miles
  return Math.round(distance);
};

const checkTimeOverlap = (slot1, slot2) => {
  const [start1H, start1M] = slot1.startTime.split(':').map(Number);
  const [end1H, end1M] = slot1.endTime.split(':').map(Number);
  const [start2H, start2M] = slot2.startTime.split(':').map(Number);
  const [end2H, end2M] = slot2.endTime.split(':').map(Number);

  const start1 = start1H * 60 + start1M;
  const end1 = end1H * 60 + end1M;
  const start2 = start2H * 60 + start2M;
  const end2 = end2H * 60 + end2M;

  return (start1 < end2 && end1 > start2);
};

const checkDayAvailabilityMatch = (userAvailability, itemAvailability, date) => {
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  // Find matching day in user's availability
  const userDaySlots = Object.entries(userAvailability || {}).find(([userDate]) => {
    const userDayOfWeek = new Date(userDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return userDayOfWeek === dayOfWeek;
  });

  if (!userDaySlots) return false;

  // Check if any time slots overlap
  const [_, userData] = userDaySlots;
  return itemAvailability.slots.some(itemSlot => 
    userData.slots.some(userSlot => checkTimeOverlap(itemSlot, userSlot))
  );
};

// Create a separate component for rendering skills
const SkillsList = ({ skills, userSkills }) => {
  const [relevanceMap, setRelevanceMap] = useState(new Map());
  const [sortedSkills, setSortedSkills] = useState([]);

  useEffect(() => {
    const checkRelevance = async () => {
      if (!skills || !userSkills) return;
      
      const newRelevanceMap = new Map();
      const relevantSkills = [];
      const otherSkills = [];
      
      for (const jobSkill of skills) {
        if (!jobSkill || typeof jobSkill !== 'string') continue;
        
        // Check for exact matches first
        const isRelevant = userSkills.some(userSkill => 
          userSkill && typeof userSkill === 'string' && 
          userSkill.toLowerCase() === jobSkill.toLowerCase()
        );
        
        if (isRelevant) {
          newRelevanceMap.set(jobSkill, true);
          relevantSkills.push(jobSkill);
        } else {
          otherSkills.push(jobSkill);
        }
      }
      
      setSortedSkills([
        ...relevantSkills.slice(0, 5),
        ...otherSkills
      ]);
      setRelevanceMap(newRelevanceMap);
    };

    checkRelevance();
  }, [skills, userSkills]);

  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return (
      <View style={styles.skillsContainer}>
        <Text style={styles.value}>No Skills Set</Text>
      </View>
    );
  }

  return (
    <View style={styles.skillsContainer}>
      {sortedSkills.map((skill, index) => {
        if (!skill || typeof skill !== 'string') return null;
        
        return (
          <View 
            key={`${skill}-${index}`}
            style={[
              styles.skillBubble,
              relevanceMap.get(skill) && styles.matchingSkillBubble
            ]}
          >
            <Text style={[
              styles.skillText,
              relevanceMap.get(skill) && styles.matchingSkillText
            ]}>
              {skill}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const Dot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin: 0 4px;
  background-color: ${props => props.active ? '#007AFF' : '#C4C4C4'};
  transition: background-color 0.3s ease;
`;

const DotsContainer = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
`;

const StyledWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Loader = () => {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <StyledWrapper>
      <DotsContainer>
        <Dot active={activeDot === 0} />
        <Dot active={activeDot === 1} />
        <Dot active={activeDot === 2} />
      </DotsContainer>
    </StyledWrapper>
  );
};

const calculateWeeklyHours = (availability) => {
  if (!availability) return 0;
  
  let totalHours = 0;
  
  Object.values(availability).forEach(dayData => {
    // Handle both array format and object format with slots
    const slots = Array.isArray(dayData) ? dayData : (dayData.slots || []);
    
    slots.forEach(slot => {
      if (!slot.startTime || !slot.endTime) return;
      
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      // Convert minutes to hours
      const hoursWorked = (endMinutes - startMinutes) / 60;
      totalHours += hoursWorked;
    });
  });
  
  return Math.round(totalHours);
};

const calculateMatchScore = async (employerData, workerData) => {
  try {
    const requestData = {
      userData: {
        selectedJobs: employerData.selectedJobs || [],
        location: employerData.location,
        availability: employerData.availability,
        locationPreference: employerData.locationPreference
      },
      itemData: {
        selectedJobs: workerData.selectedJobs || [],
        location: workerData.location,
        availability: workerData.availability,
        name: workerData.name
      }
    };

    // Add a test request first
    try {
      const testResponse = await fetch(`${BACKEND_URL}/test-backend`);
      const testData = await testResponse.json();
      console.log('Backend test response:', testData);
    } catch (testError) {
      console.error('Backend test failed:', testError);
      throw new Error('Cannot connect to backend server');
    }

    // 1) Fetch jobScore from the backend (max 40).
    const response = await fetch(`${BACKEND_URL}/calculate-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const { jobScore } = await response.json();

    // 2) Location Score up to 30
    const locationScore = (() => {
      if (!employerData.location || !workerData.location) return 0;
      const distMiles = calculateDistance(
        employerData.location.latitude,
        employerData.location.longitude,
        workerData.location.latitude,
        workerData.location.longitude
      );
      const maxDistance = employerData.locationPreference || 50000; // If not set, default
      // Scale from 0..30
      return Math.max(0, (1 - distMiles / maxDistance) * 30);
    })();

    // 3) Availability Score up to 30
    const availabilityScore = (() => {
      if (!employerData.availability || !workerData.availability) return 0;
      let matchingSlots = 0;
      let totalSlots = 0;
      
      Object.keys(employerData.availability).forEach((day) => {
        const employerSlots = employerData.availability[day]?.slots || [];
        const workerSlots = workerData.availability[day]?.slots || [];
        
        // For each employer slot, see if any worker slot overlaps
        employerSlots.forEach((eSlot) => {
          totalSlots++;
          workerSlots.forEach((wSlot) => {
            if (checkTimeOverlap(eSlot, wSlot)) {
              matchingSlots++;
            }
          });
        });
      });

      return totalSlots > 0 ? (matchingSlots / totalSlots) * 30 : 0;
    })();

    // Sum them: jobScore (max 40) + locationScore (max 30) + availabilityScore (max 30)
    const totalScore = (jobScore || 0) + locationScore + availabilityScore;

    console.log('\n=== [Employer→Worker] Scoring Breakdown ===');
    console.log(`Worker:          ${workerData.name}`);
    console.log(`Job Score (40):  ${jobScore ? jobScore.toFixed(2) : 0}`);
    console.log(`Loc Score (30):  ${locationScore.toFixed(2)}`);
    console.log(`Avail Score(30): ${availabilityScore.toFixed(2)}`);
    console.log(`Total:           ${totalScore.toFixed(2)}`);
    console.log('==========================================\n');

    return totalScore;
  } catch (err) {
    console.error('Error in calculateMatchScore:', err);
    return 0;
  }
};

const JobCard = ({ item, currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const analysisRef = useRef(null);

  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const fetchAnalysis = async () => {
    if (analysisRef.current) {
      setJobAnalysis(analysisRef.current);
      return;
    }

    setIsLoadingAnalysis(true);
    try {
      const response = await fetch(`${BACKEND_URL}/analyze-employee-fit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job: item,  // employee data
          user: currentUser  // employer data
        })
      });

      const data = await response.json();
      if (data.success) {
        analysisRef.current = data.analysis;
        setJobAnalysis(data.analysis);
      } else {
        console.error('Error fetching analysis:', data.error);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (isExpanded && !analysisRef.current) {
      fetchAnalysis();
    }
  }, [isExpanded]);

  return (
    <TouchableOpacity 
      style={[styles.card, { marginTop: SCREEN_HEIGHT * 0.12 }]}
      onPress={toggleExpanded}
      activeOpacity={0.95}
    >
      <LinearGradient
        colors={['#1e3a8a', '#1e40af']}
        style={styles.cardGradient}
      >
        <View style={styles.contentCard}>
          {!isExpanded ? (
            // Front of card
            <>
              <View style={styles.titleContainer}>
                <Text style={[styles.name, { textAlign: 'center' }]}>
                  {capitalizeFirstLetter(item.name) || 'No Name'}
                </Text>
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <Text style={styles.overviewText}>
                  {item.user_overview || 'No overview available'}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Experience</Text>
                {item.selectedJobs?.map((job, jobIndex) => (
                  <View key={jobIndex} style={styles.jobContainer}>
                    <View style={styles.jobHeader}>
                      <Text style={styles.jobExperienceTitle}>{job.title}</Text>
                      <Text style={styles.industryText}>{job.industry}</Text>
                    </View>
                    <View style={styles.skillsContainer}>
                      {job.skills?.map((skill, skillIndex) => (
                        <View key={skillIndex} style={styles.skillBubble}>
                          <Text style={styles.skillExperienceText}>
                            {skill.name} • {skill.yearsOfExperience}yr
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            // Back of card
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Availability</Text>
                <View style={styles.availabilityContainer}>
                  {Object.entries(item.availability || {}).map(([day, dayData]) => {
                    if (!dayData?.slots?.length) return null;
                    return (
                      <View key={day} style={styles.scheduleRow}>
                        {dayData.slots.map((slot, slotIndex) => (
                          <View 
                            key={`${day}-${slotIndex}`} 
                            style={[
                              styles.availabilityBubble,
                              checkDayAvailabilityMatch(currentUser?.availability, dayData, day) && 
                                styles.availabilityBubbleMatch
                            ]}
                          >
                            <Text style={[
                              styles.value, 
                              styles.scheduleText,
                              { color: '#ffffff' },
                              checkDayAvailabilityMatch(currentUser?.availability, dayData, day) && 
                                styles.scheduleTextMatch
                            ]}>
                              {day}: {slot.startTime} - {slot.endTime}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Job Match Analysis</Text>
                {isLoadingAnalysis ? (
                  <ActivityIndicator size="small" color="#4f46e5" />
                ) : jobAnalysis ? (
                  <View style={styles.analysisContainer}>
                    {/* Analysis content */}
                    <View style={styles.prosContainer}>
                      <Text style={styles.categoryTitle}>Pros</Text>
                      <View style={styles.proBubble}>
                        <Ionicons name="checkmark-circle" size={16} color="#166534" />
                        <Text style={styles.proText}>{jobAnalysis.condensed.pros}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.consContainer}>
                      <Text style={styles.categoryTitle}>Cons</Text>
                      <View style={styles.conBubble}>
                        <Ionicons name="alert-circle" size={16} color="#991b1b" />
                        <Text style={styles.conText}>{jobAnalysis.condensed.cons}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noAnalysisText}>Unable to load analysis</Text>
                )}
              </View>
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center', // Center card horizontally
  },
  cardGradient: {
    flex: 1,
    padding: 20,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    flex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontSize: 24, // Larger font for name
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 8,
  },
  overviewText: {
    color: '#1f2937',
    fontSize: 16,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availabilityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#1e3a8a',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorText: {
    color: '#FF4136',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skillBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  skillText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  noSkillsText: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  availabilityBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  availabilityBubbleMatch: {
    backgroundColor: 'rgba(46, 204, 64, 0.2)',
  },
  scheduleTextMatch: {
    color: '#4ade80',
  },
  matchingSkillBubble: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
    borderWidth: 1,
  },
  matchingSkillText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: SCREEN_HEIGHT * 0.7,
    marginBottom: 20,
  },
  noItemsText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  dayLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  slotsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scheduleText: {
    color: '#1f2937',
    fontSize: 14,
  },
  dayContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    width: '100%',
  },
  timeSlotsContainer: {
    flex: 1,
    marginLeft: 12,
  },
  timeSlot: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 56,
    alignItems: 'center',
  },
  dayChipAvailable: {
    backgroundColor: '#dcfce7',
  },
  dayChipUnavailable: {
    backgroundColor: '#fee2e2',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextAvailable: {
    color: '#166534',
  },
  dayTextUnavailable: {
    color: '#991b1b',
  },
  jobContainer: {
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  industryText: {
    fontSize: 12,
    color: '#6b7280',
  },
  noItemsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  analysisContainer: {
    // Add appropriate styles for the analysis container
  },
  noAnalysisText: {
    // Add appropriate styles for the no analysis text
  },
  prosContainer: {
    marginBottom: 16,
  },
  proBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
  },
  proText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#166534',
  },
  consContainer: {
    marginBottom: 16,
  },
  conBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  conText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#991b1b',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 8,
  },
  jobExperienceTitle: {
    fontSize: 14, // Smaller font for job titles in experience
    fontWeight: '500',
    color: '#1f2937',
  },
  skillExperienceText: {
    fontSize: 12, // Smaller font for skills in experience
    color: '#1f2937',
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default function JobHomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);
  const [userSkills, setUserSkills] = useState([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedJob, setMatchedJob] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [cardsRemaining, setCardsRemaining] = useState(0);
  const [noMoreCards, setNoMoreCards] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  let [fontsLoaded] = useFonts({
    LibreBodoni_400Regular,
    LibreBodoni_700Bold,
    DMSerifText_400Regular,
  });

  useEffect(() => {
    if (items.length > 0) {
      setIsLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (items && items.length >= 0) {
      console.log(`[JOB_CARDS] Items array updated, length: ${items.length}`);
      setCardsRemaining(items.length);
      setNoMoreCards(items.length === 0);
    }
  }, [items]);

  const handleJobPress = (item) => {
    // navigation.navigate('UserDetail', {
    //   itemId: item.id,
    //   itemType: 'worker',
    //   currentUserData: currentUser,
    //   item: item
    // });
  };

  const renderCard = (item) => {
    if (!item) return null;
    return <JobCard item={item} currentUser={currentUser} />;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!auth.currentUser) return;

        // Fetch employer document from 'job_attributes'.
        const employerDoc = await db
          .collection('job_attributes')
          .doc(auth.currentUser.uid)
          .get();

        if (!employerDoc.exists) {
          console.error("No employer doc found in 'job_attributes'.");
          return;
        }

        const employerDocData = employerDoc.data();

        // Build an in-memory 'selectedJobs' array from our known fields: jobTitle, industry,
        // jobTypePrefs (which we'll treat as "skills").
        const employerSelectedJobs = [
          {
            title: employerDocData.jobTitle || '',
            industry: employerDocData.industry || '',
            skills: Array.isArray(employerDocData.jobTypePrefs)
              ? employerDocData.jobTypePrefs.map((pref) => ({
                  name: pref || '',
                  yearsOfExperience: 0, 
                }))
              : []
          }
        ];

        const employerData = {
          selectedJobs: employerSelectedJobs,
          location: employerDocData.location,
          availability: employerDocData.availability,
          locationPreference: employerDocData.locationPreference || 50000,
          job_overview: employerDocData.job_overview || '',
        };

        setCurrentUser(employerData);

        // Next, fetch your workers from 'user_attributes'...
        const userAttributesRef = db.collection('user_attributes');
        const allUsersSnapshot = await userAttributesRef.get();

        const candidatePromises = allUsersSnapshot.docs.map(async (docSnapshot) => {
          const candidateData = docSnapshot.data();

          // For the worker, do the same approach.
          // If they do NOT have selectedJobs, build one from jobTitle/industry/jobTypePrefs:
          const candidateSelectedJobs = Array.isArray(candidateData.selectedJobs) &&
            candidateData.selectedJobs.length > 0
              ? candidateData.selectedJobs
              : [
                  {
                    title: candidateData.jobTitle || '',
                    industry: candidateData.industry || '',
                    skills: Array.isArray(candidateData.jobTypePrefs)
                      ? candidateData.jobTypePrefs.map((pref) => ({
                          name: pref || '',
                          yearsOfExperience: 0,
                        }))
                      : []
                  }
                ];

          const userObj = new User({
            id: docSnapshot.id,
            uid: docSnapshot.id,
            name: candidateData.name,
            user_overview: candidateData.user_overview,
            selectedJobs: candidateSelectedJobs,
            availability: candidateData.availability,
            location: candidateData.location
          });

          if (candidateData.location && employerData.location) {
            userObj.distance = calculateDistance(
              employerData.location.latitude,
              employerData.location.longitude,
              candidateData.location.latitude,
              candidateData.location.longitude
            );
          }

          // Calculate the match score from your backend
          userObj.matchScore = await calculateMatchScore(employerData, {
            selectedJobs: userObj.selectedJobs,
            location: userObj.location,
            availability: userObj.availability,
            name: userObj.name,
          });

          return userObj;
        });

        const candidatesData = await Promise.all(candidatePromises);
        candidatesData.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

        setItems(candidatesData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const handleSwipe = async (cardIndex, interested) => {
    const item = items[cardIndex];
    const currentUserUid = auth.currentUser.uid;
    const itemId = item.uid;

    try {
      const userJobPrefData = new UserJobPreference({
        userId: currentUserUid,
        role: 'employer',
        swipedUserId: itemId,
        interested: interested,
      });

      await db.collection('user_job_preferences').add(userJobPrefData.toObject());

      if (interested) {
        const otherUserPrefs = await db.collection('user_job_preferences')
          .where('userId', '==', itemId)
          .where('swipedUserId', '==', currentUserUid)
          .where('interested', '==', true)
          .get();

        if (!otherUserPrefs.empty) {
          console.log("It's a match!");
          const matchId = `${itemId}_${currentUserUid}`;

          const matchData = {
            id: matchId,
            workerId: itemId,
            employerId: currentUserUid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          };

          await db.collection('matches').doc(matchId).set(matchData);

          setMatchedJob(item);
          setMatchData(matchData);
          setShowMatchModal(true);
        }
      }
    } catch (error) {
      console.error("Error saving preference:", error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
    }
  };

  const onSwipedLeft = (cardIndex) => {
    console.log(`[JOB_CARDS] Card swiped LEFT, index: ${cardIndex}`);
    const currentRemaining = items.length - (cardIndex + 1);
    console.log(`[JOB_CARDS] Cards remaining: ${currentRemaining}`);
    setCardsRemaining(currentRemaining);
    
    if (currentRemaining === 0) {
      console.log('[JOB_CARDS] No more cards remaining!');
      setNoMoreCards(true);
    }
    
    handleSwipe(cardIndex, false);
  };

  const onSwipedRight = (cardIndex) => {
    console.log(`[JOB_CARDS] Card swiped RIGHT, index: ${cardIndex}`);
    const currentRemaining = items.length - (cardIndex + 1);
    console.log(`[JOB_CARDS] Cards remaining: ${currentRemaining}`);
    setCardsRemaining(currentRemaining);
    
    if (currentRemaining === 0) {
      console.log('[JOB_CARDS] No more cards remaining!');
      setNoMoreCards(true);
    }
    
    handleSwipe(cardIndex, true);
  };

  const onSwipedAll = () => {
    console.log('[JOB_CARDS] onSwipedAll triggered!');
    setNoMoreCards(true);
    setCardsRemaining(0);
    setItems([]); 
  };

  if (!fontsLoaded) {
    return <ActivityIndicator style={{ transform: [{ scale: 1.4 }] }} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator 
          color="#0000ff" 
          style={{ transform: [{ scale: 1.4 }] }}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setIsLoading(true);
          setError(null);
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!items.length || noMoreCards) {
    return (
      <View style={styles.noItemsContainer}>
        <EmptyStateLoader />
        <Text style={styles.emptyStateText}>No more profiles to show</Text>
        <Text style={styles.emptyStateSubText}>Check back later for new matches</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            console.log('[JOB_CARDS] Refresh button pressed');
            setIsLoading(true);
            setNoMoreCards(false);
            fetchUserData();
          }}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator 
            color="#0000ff" 
            style={{ transform: [{ scale: 1.4 }] }}
          />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            setIsLoading(true);
            setError(null);
          }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !items.length || noMoreCards ? (
        <View style={styles.noItemsContainer}>
          <EmptyStateLoader />
          <Text style={styles.emptyStateText}>No more profiles to show</Text>
          <Text style={styles.emptyStateSubText}>Check back later for new matches</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => {
              console.log('[JOB_CARDS] Refresh button pressed');
              setIsLoading(true);
              setNoMoreCards(false);
              fetchUserData();
            }}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Swiper
          ref={swiperRef}
          cards={items}
          renderCard={renderCard}
          onSwipedLeft={onSwipedLeft}
          onSwipedRight={onSwipedRight}
          onSwipedAll={onSwipedAll}
          cardIndex={0}
          backgroundColor={'#f1f5f9'}
          stackSize={3}
          cardVerticalMargin={20}
          cardHorizontalMargin={10}
          animateOverlayLabelsOpacity
          animateCardOpacity
          disableTopSwipe
          disableBottomSwipe
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: '#ff0000',
                  color: '#ffffff',
                  fontSize: 24
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: -20
                }
              }
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: '#00ff00',
                  color: '#ffffff',
                  fontSize: 24
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: 20
                }
              }
            }
          }}
        />
      )}
      
      {/* Match Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMatchModal}
        onRequestClose={() => setShowMatchModal(false)}
      >
        <NewMatchModal 
          visible={showMatchModal}
          onClose={() => {
            setShowMatchModal(false);
            setMatchData(null);
          }}
          jobData={matchedJob}
          matchData={matchData}
        />
      </Modal>
    </View>
  );
} 