import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
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
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import EmptyStateLoader from '../components/loaders/EmptyStateLoader';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

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
      
      // Sort relevant skills first (limited to 5), then other skills
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

// Add these utility functions from the second example
const getBackendUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';  // Android Emulator
  } else if (Platform.OS === 'ios') {
    if (Platform.isPad || Platform.isTV) {
      return 'http://localhost:5000';  // iOS Simulator
    } else {
      return 'http://192.168.0.100:5000';  // Replace with your computer's IP
    }
  }
  return 'http://localhost:5000';  // Default fallback
};

const BACKEND_URL = getBackendUrl();

const calculateMatchScore = async (workerData, employerData) => {
  try {
    // Test backend connection
    const testResponse = await fetch(`${BACKEND_URL}/test-backend`);
    const testData = await testResponse.json();
    console.log('Backend test response:', testData);

    // Calculate match score
    const requestData = {
      userData: {
        selectedJobs: workerData.selectedJobs || [],
        location: workerData.location,
        availability: workerData.availability,
        locationPreference: 50000
      },
      itemData: {
        selectedJobs: employerData.selectedJobs || [],
        location: employerData.location,
        availability: employerData.availability
      }
    };

    const response = await fetch(`${BACKEND_URL}/calculate-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
      timeout: 10000
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const { jobScore } = await response.json();

    // Calculate location score
    let locationScore = 0;
    if (workerData.location && employerData.location) {
      const distMiles = calculateDistance(
        workerData.location.latitude,
        workerData.location.longitude,
        employerData.location.latitude,
        employerData.location.longitude
      );
      const maxDistance = 50000;
      locationScore = Math.max(0, (1 - distMiles / maxDistance) * 30);
    }

    // Calculate availability score
    let availabilityScore = 0;
    if (workerData.availability && employerData.availability) {
      let matchingSlots = 0;
      let totalSlots = 0;

      Object.keys(employerData.availability).forEach((day) => {
        const employerSlots = employerData.availability[day] || [];
        const workerSlots = workerData.availability[day] || [];

        const eSlots = Array.isArray(employerSlots) ? employerSlots : employerSlots.slots || [];
        const wSlots = Array.isArray(workerSlots) ? workerSlots : workerSlots.slots || [];

        eSlots.forEach((eSlot) => {
          totalSlots++;
          wSlots.forEach((wSlot) => {
            if (checkTimeOverlap(eSlot, wSlot)) matchingSlots++;
          });
        });
      });

      availabilityScore = totalSlots > 0 ? (matchingSlots / totalSlots) * 30 : 0;
    }

    const totalScore = (jobScore || 0) + locationScore + availabilityScore;

    // Log scoring breakdown
    console.log('\n=== [Worker→Employer] Scoring Breakdown ===');
    console.log(`Employer:        ${employerData.companyName || 'No Name'}`);
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

const renderSkills = (skills) => {
  if (!Array.isArray(skills)) return null;
  
  return skills.map((skill, index) => {
    // Ensure we have a string representation of the skill
    let skillDisplay = '';
    
    if (typeof skill === 'object' && skill !== null) {
      // Handle object format
      const name = skill.name || '';
      const years = skill.yearsOfExperience ? ` • ${skill.yearsOfExperience}yr` : '';
      skillDisplay = `${name}${years}`;
    } else {
      // Handle string format
      skillDisplay = String(skill || '');
    }

    return (
      <View key={`skill-${index}`} style={styles.skillBubble}>
        <Text style={styles.skillText}>{skillDisplay.trim()}</Text>
      </View>
    );
  });
};

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);
  const [userSkills, setUserSkills] = useState([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedJob, setMatchedJob] = useState(null);
  const [matchData, setMatchData] = useState(null);

  let [fontsLoaded] = useFonts({
    LibreBodoni_400Regular,
    LibreBodoni_700Bold,
    DMSerifText_400Regular,
  });

  useEffect(() => {
    // Log current user info
    const currentUser = auth.currentUser;
    console.log('Current User:', currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      displayName: currentUser.displayName,
      metadata: currentUser.metadata
    } : 'No user signed in');

    // Add listener for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('Auth State Changed:', user ? {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      } : 'User signed out');
    });

    // Log Firestore connection status
    const db = getFirestore();
    console.log('Firestore Instance:', db ? 'Connected' : 'Not connected');

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  // Add logging to fetchItems
  const fetchItems = async () => {
    try {
      console.log('Fetching items for user:', auth.currentUser?.uid);
      // ... existing fetchItems code ...
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!auth.currentUser) return;

        // Get worker data
        const workerDoc = await db.collection('user_attributes').doc(auth.currentUser.uid).get();
        if (!workerDoc.exists) {
          setIsLoading(false);
          return;
        }

        const workerData = workerDoc.data();
        setCurrentUser(workerData);

        // Get all employers
        const employersSnapshot = await db.collection('job_attributes').get();
        
        // Calculate match scores for each employer
        const employersWithScores = await Promise.all(
          employersSnapshot.docs.map(async (doc) => {
            const employerData = doc.data();
            
            // Calculate match score
            const matchScore = await calculateMatchScore(
              workerData,
              employerData
            );

            return {
              ...employerData,
              id: doc.id,
              matchScore
            };
          })
        );

        // Sort by match score (highest first)
        employersWithScores.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        
        setItems(employersWithScores);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchUserSkills = async () => {
      try {
        const userDoc = await db.collection('user_attributes')
          .doc(auth.currentUser.uid)
          .get();
        if (userDoc.exists) {
          setUserSkills(userDoc.data().skills || []);
        }
      } catch (error) {
        console.error('Error fetching user skills:', error);
      }
    };
    fetchUserSkills();
  }, []);

  const checkSkillRelevance = async (skill1, skill2) => {
    try {
      const response = await fetch(`${BACKEND_URL}/check-skill-relevance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skill1,
          skill2
        })
      });
      const data = await response.json();
      return data.isRelevant;
    } catch (error) {
      console.error('Error checking skill relevance:', error);
      return false;
    }
  };

  const handleSwipe = async (cardIndex, interested) => {
    const item = items[cardIndex];
    const currentUserUid = auth.currentUser.uid;
    const itemId = currentUser.role === 'worker' ? item.id : item.uid;

    try {
      const userJobPrefData = new UserJobPreference({
        userId: currentUserUid,
        role: currentUser.role,
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
          const matchId = currentUser.role === 'worker' 
            ? `${currentUserUid}_${itemId}` 
            : `${itemId}_${currentUserUid}`;

          const matchData = {
            id: matchId,
            workerId: currentUser.role === 'worker' ? currentUserUid : itemId,
            employerId: currentUser.role === 'employer' ? currentUserUid : itemId,
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

  const onSwipedRight = (cardIndex) => handleSwipe(cardIndex, true);
  const onSwipedLeft = (cardIndex) => handleSwipe(cardIndex, false);

  const onSwipedAll = () => {
    // Clear any existing match data when all cards are swiped
    setShowMatchModal(false);
    setMatchData(null);
    setMatchedJob(null);
  };

  const handleJobPress = (item) => {
    /*
    const sanitizedItem = {
      id: item.id,
      jobTitle: item.jobTitle || '',
      companyName: item.companyName || '',
      salaryRange: {
        min: item.salaryRange?.min || 0,
        max: item.salaryRange?.max || 0
      },
      requiredSkills: Array.isArray(item.requiredSkills) ? item.requiredSkills : [],
      weeklyHours: item.weeklyHours || 0,
      location: item.location || null,
      distance: item.distance || 0
    };

    navigation.navigate('JobDetail', {
      itemId: item.id,
      itemType: 'job',
      currentUserData: currentUser,
      item: sanitizedItem
    });
    */
  };

  const handleSettingsPress = () => {
    navigation.navigate('Main', { screen: 'Settings' });
  };

  const renderCard = (item) => {
    // Add debugging logs
    console.log('Rendering card for item:', {
      id: item.id,
      overview: item.job_overview,
      availability: item.availability,
      requiredSkills: item.requiredSkills
    });

    // Calculate weekly hours from job_attributes availability
    const calculateTotalHours = (availability) => {
      if (!availability) return 0;
      
      let totalHours = 0;
      Object.values(availability).forEach(day => {
        if (day.slots && Array.isArray(day.slots)) {
          day.slots.forEach(slot => {
            if (!slot.startTime || !slot.endTime) return;
            
            const [startH, startM] = slot.startTime.split(':').map(Number);
            const [endH, endM] = slot.endTime.split(':').map(Number);
            
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            
            totalHours += (endMinutes - startMinutes) / 60;
          });
        }
      });
      
      return totalHours;
    };

    const weeklyHours = calculateWeeklyHours(item.availability);
    console.log('Weekly hours calculated:', weeklyHours);
    console.log('Item salary range:', item.salaryRange || item.estPayRange || {min: item.estPayRangeMin, max: item.estPayRangeMax});

    const payRange = {
      min: item.estPayRangeMin || 0,
      max: item.estPayRangeMax || 0
    };
    console.log('Pay range:', payRange);

    const estimatedWeeklyPayMin = Math.round(weeklyHours * payRange.min);
    const estimatedWeeklyPayMax = Math.round(weeklyHours * payRange.max);

    console.log('Estimated weekly pay:', {min: estimatedWeeklyPayMin, max: estimatedWeeklyPayMax});

    const renderAvailabilitySlots = (dayData) => {
      if (!dayData.slots || !Array.isArray(dayData.slots)) return null;
      
      return dayData.slots.map((slot, slotIndex) => (
        <View 
          key={`${slotIndex}`} 
          style={[
            styles.availabilityBubble,
            hasMatch && styles.availabilityBubbleMatch
          ]}
        >
          <Text style={[
            styles.value, 
            styles.scheduleText,
            hasMatch && styles.scheduleTextMatch
          ]}>
            {slot.startTime} - {slot.endTime}
          </Text>
        </View>
      ));
    };

    console.log('Availability data:', JSON.stringify(item.availability, null, 2));

    return (
      <TouchableOpacity 
        style={styles.card}
        // onPress={() => handleJobPress(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#1e3a8a', '#1e40af']}
          style={styles.cardGradient}
        >
          <View style={styles.contentCard}>
            {/* Job Title and Company */}
            <View style={styles.titleContainer}>
              <Text style={styles.jobTitle}>{item.jobTitle || 'No Title'}</Text>
              <View style={styles.companyBadge}>
                <Text style={styles.companyName}>{item.companyName || 'Company'}</Text>
              </View>
            </View>

            {/* Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.overviewText}>
                {item.job_overview || 'No overview available'}
              </Text>
            </View>

            {/* Pay and Hours Grid */}
            <View style={styles.gridContainer}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Pay Range</Text>
                <Text style={styles.gridValue}>
                  ${item.salaryRange?.min || 'N/A'} - ${item.salaryRange?.max || 'N/A'}/hr
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Est. Weekly Hours</Text>
                <Text style={styles.gridValue}>
                  {calculateWeeklyHours(item.availability)} hours
                </Text>
              </View>
            </View>

            {/* Weekly Pay Estimate */}
            <View style={styles.weeklyPayContainer}>
              <Text style={styles.weeklyPayLabel}>Est. Weekly Pay</Text>
              <Text style={styles.weeklyPayValue}>
                ${estimatedWeeklyPayMin} - ${estimatedWeeklyPayMax}
              </Text>
            </View>

            {/* Skills */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Required Skills</Text>
              <View style={styles.skillsContainer}>
                {item.requiredSkills && Array.isArray(item.requiredSkills) ? (
                  item.requiredSkills.map((skill, index) => (
                    <View key={index} style={styles.skillBubble}>
                      <Text style={styles.skillText}>
                        {typeof skill === 'object' ? `${skill.name || ''} • ${skill.yearsOfExperience || 0}yr` : skill}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noSkillsText}>No required skills specified</Text>
                )}
              </View>
            </View>

            {/* Availability */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Required Availability</Text>
              <View style={styles.availabilityContainer}>
                {Object.entries(item.availability || {}).map(([day, dayData]) => {
                  // Handle both array format and object format with slots
                  const slots = Array.isArray(dayData) ? dayData : (dayData.slots || []);
                  if (slots.length === 0) return null;
                  
                  return (
                    <View key={day} style={styles.dayContainer}>
                      <View style={[styles.dayChip, styles.dayChipAvailable]}>
                        <Text style={[styles.dayText, styles.dayTextAvailable]}>
                          {day}
                        </Text>
                      </View>
                      <View style={styles.timeSlotsContainer}>
                        {slots.map((slot, index) => (
                          <Text key={index} style={styles.timeSlot}>
                            {slot.startTime} - {slot.endTime}
                          </Text>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Distance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distance</Text>
              <Text style={styles.distanceText}>
                {item.distance != null ? `${item.distance} miles away` : 'Distance unavailable'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderAvailabilitySection = (item) => {
    if (!item?.availability) return null;
    
    return (
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Availability</Text>
        <View style={styles.availabilityContainer}>
          {Object.entries(item.availability).map(([date, dayData], index) => {
            const hasMatch = checkDayAvailabilityMatch(currentUser?.availability, dayData, date);
            
            return (
              <View key={index} style={styles.scheduleRow}>
                {dayData.slots?.map((slot, slotIndex) => (
                  <View 
                    key={`${index}-${slotIndex}`} 
                    style={[
                      styles.availabilityBubble,
                      hasMatch && styles.availabilityBubbleMatch
                    ]}
                  >
                    <Text style={[
                      styles.value, 
                      styles.scheduleText,
                      hasMatch && styles.scheduleTextMatch
                    ]}>
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}: 
                      {slot.startTime} - {slot.endTime}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  useEffect(() => {
    console.log("Current items length:", items.length);
    console.log("isLoading:", isLoading);
  }, [items, isLoading]);

  if (!fontsLoaded) {
    return <ActivityIndicator />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
          fetchData();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.noItemsContainer}>
          <EmptyStateLoader />
        </View>
      ) : (
        <Swiper
          ref={swiperRef}
          cards={items}
          renderCard={renderCard}
          onSwipedRight={(cardIndex) => handleSwipe(cardIndex, true)}
          onSwipedLeft={(cardIndex) => handleSwipe(cardIndex, false)}
          onSwipedAll={onSwipedAll}
          cardIndex={0}
          backgroundColor={'#f0f0f0'}
          stackSize={3}
          stackSeparation={15}
          animateCardOpacity
          verticalSwipe={false}
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: {
                label: {
                  backgroundColor: '#FF4136',
                  color: 'white',
                  fontSize: 24,
                  borderRadius: 10,
                  padding: 10,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: -20,
                },
              },
            },
            right: {
              title: 'LIKE',
              style: {
                label: {
                  backgroundColor: '#2ECC40',
                  color: 'white',
                  fontSize: 24,
                  borderRadius: 10,
                  padding: 10,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: 20,
                },
              },
            },
          }}
        />
      )}

      {showMatchModal && matchedJob && (
        <NewMatchModal 
          visible={showMatchModal}
          onClose={() => {
            setShowMatchModal(false);
            setMatchData(null);
            setMatchedJob(null);
          }}
          jobData={matchedJob}
          matchData={matchData}
        >
          <View style={styles.skillsContainer}>
            {matchedJob.requiredSkills?.length > 0 ? (
              renderSkills(matchedJob.requiredSkills)
            ) : (
              <Text style={styles.noSkillsText}>No required skills specified</Text>
            )}
          </View>
        </NewMatchModal>
      )}
    </KeyboardAvoidingView>
  );
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  companyBadge: {
    backgroundColor: '#e0e7ff',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  companyName: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '500',
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
  gridContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  weeklyPayContainer: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  weeklyPayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#15803d',
    marginBottom: 4,
  },
  weeklyPayValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#166534',
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
  noItemsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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
});