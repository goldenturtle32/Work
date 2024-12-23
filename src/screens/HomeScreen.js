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
    if (dayData.slots) {
      dayData.slots.forEach(slot => {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        totalHours += (endMinutes - startMinutes) / 60;
      });
    }
  });
  
  return Math.round(totalHours);
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
    const fetchUserData = async () => {
      try {
        console.log('Current User:', auth.currentUser);
        if (!auth.currentUser) return;

        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          setCurrentUser(new User({ 
            uid: userDoc.id, 
            ...userData,
            location: userData.location 
          }));

          if (userData.role === 'worker') {
            const jobAttributesSnapshot = await db.collection('job_attributes').get();
            const jobsData = jobAttributesSnapshot.docs.map(doc => {
              const jobData = doc.data();
              const distance = jobData.location && userData.location ? 
                calculateDistance(
                  userData.location.latitude,
                  userData.location.longitude,
                  jobData.location.latitude,
                  jobData.location.longitude
                ) : null;
              return new Job({ 
                id: doc.id, 
                ...jobData,
                distance 
              });
            });
            console.log("Formatted items:", jobsData);
            setItems(jobsData);
          } else if (userData.role === 'employer') {
            const userAttributesSnapshot = await db.collection('user_attributes')
              .where('role', '==', 'worker').get();
            const candidatesData = userAttributesSnapshot.docs.map(doc => {
              const candidateData = doc.data();
              console.log('Raw candidate data from Firebase:', JSON.stringify({
                id: doc.id,
                candidateData,
                overview: candidateData.user_overview,
                keys: Object.keys(candidateData)
              }, null, 2));
              const distance = candidateData.location && userData.location ? 
                calculateDistance(
                  userData.location.latitude,
                  userData.location.longitude,
                  candidateData.location.latitude,
                  candidateData.location.longitude
                ) : null;
              
              console.log('Creating worker candidate:', {
                docId: doc.id,
                candidateData: candidateData
              });
              
              return new User({ 
                id: doc.id,
                uid: doc.id,
                ...candidateData,
                distance 
              });
            });
            console.log("Formatted items:", candidatesData);
            setItems(candidatesData);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(`Failed to fetch data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
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
    console.log("All cards swiped, items length:", items.length);
    setItems([]); // Clear the items when all cards are swiped
    Alert.alert('End of List', 'You have swiped through all available items.');
  };

  const handleJobPress = (item) => {
    navigation.navigate('JobDetail', { item });
  };

  const handleSettingsPress = () => {
    navigation.navigate('Main', { screen: 'Settings' });
  };

  const renderCard = (item) => {
    const weeklyHours = calculateWeeklyHours(item.availability);
    const estimatedWeeklyPayMin = weeklyHours * (item.salaryRange?.min || 0);
    const estimatedWeeklyPayMax = weeklyHours * (item.salaryRange?.max || 0);

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleJobPress(item)}
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
              <Text style={styles.overviewText}>{item.user_overview || 'No overview available'}</Text>
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
                  {weeklyHours ? `${weeklyHours} hours` : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Weekly Pay Estimate */}
            <View style={styles.weeklyPayContainer}>
              <Text style={styles.weeklyPayLabel}>Est. Weekly Pay</Text>
              <Text style={styles.weeklyPayValue}>
                ${estimatedWeeklyPayMin.toFixed(0)} - ${estimatedWeeklyPayMax.toFixed(0)}
              </Text>
            </View>

            {/* Skills */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Relevant Skills</Text>
              <View style={styles.skillsContainer}>
                <SkillsList 
                  skills={Array.isArray(item.requiredSkills) ? item.requiredSkills : []} 
                  userSkills={Array.isArray(userSkills) ? userSkills : []} 
                />
              </View>
            </View>

            {/* Availability */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <View style={styles.availabilityContainer}>
                {renderAvailabilitySection(item)}
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
          fetchUserData();
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
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View style={styles.container}>
          {items.length === 0 ? (
            <View style={styles.loaderContainer}>
              <DotLoader />
              <Text style={styles.noItemsText}>No more items to show</Text>
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

          <NewMatchModal 
            visible={showMatchModal}
            onClose={() => {
              setShowMatchModal(false);
              setMatchData(null);
            }}
            jobData={matchedJob}
            matchData={matchData}
          />
        </View>
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
    fontSize: 24,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  noItemsText: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  skillText: {
    fontFamily: 'DMSerifText_400Regular',
    color: '#ffffff',
    fontSize: 14,
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
});