import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { db, auth, firebase } from '../firebase';  // Make sure firebase is imported here
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

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);
  const [userSkills, setUserSkills] = useState([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedJob, setMatchedJob] = useState(null);

  let [fontsLoaded] = useFonts({
    LibreBodoni_400Regular,
    LibreBodoni_700Bold,
    DMSerifText_400Regular,
  });

  useEffect(() => {
    const fetchUserAndItems = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        // Get user's location from user_attributes
        const userAttributesDoc = await db.collection('user_attributes').doc(auth.currentUser.uid).get();
        const userLocation = userAttributesDoc.data()?.location;
        
        setCurrentUser(new User({ 
          uid: userDoc.id, 
          ...userData,
          location: userLocation 
        }));

        if (userData.role === 'worker') {
          const jobAttributesSnapshot = await db.collection('job_attributes').get();
          const jobsData = jobAttributesSnapshot.docs.map(doc => {
            const jobData = doc.data();
            const distance = jobData.location && userLocation ? 
              calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
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
            const distance = candidateData.location && userLocation ? 
              calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
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
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(`Failed to fetch data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndItems();
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
      // Keep existing user_job_preferences creation
      const userJobPrefData = new UserJobPreference({
        userId: currentUserUid,
        role: currentUser.role,
        swipedUserId: itemId,
        interested: interested,
      });

      await db.collection('user_job_preferences').add(userJobPrefData.toObject());

      // Add match checking logic only for right swipes
      if (interested) {
        // Check if the other person has already swiped right
        const otherUserPrefs = await db.collection('user_job_preferences')
          .where('userId', '==', itemId)
          .where('swipedUserId', '==', currentUserUid)
          .where('interested', '==', true)
          .get();

        if (!otherUserPrefs.empty) {
          console.log("It's a match!");
          // Create the match
          const matchId = currentUser.role === 'worker' 
            ? `${currentUserUid}_${itemId}` 
            : `${itemId}_${currentUserUid}`;

          await db.collection('matches').doc(matchId).set({
            workerId: currentUser.role === 'worker' ? currentUserUid : itemId,
            employerId: currentUser.role === 'employer' ? currentUserUid : itemId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });

          setMatchedJob(item);
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
    Alert.alert('End of List', 'You have swiped through all available items.');
  };

  const renderCard = (item) => {
    if (!item) return null;
    
    // Calculate weekly hours and estimated pay
    const weeklyHours = item.availability ? item.weeklyHours : null;
    const estimatedWeeklyPayMin = weeklyHours ? (item.salaryRange?.min || 0) * weeklyHours : null;
    const estimatedWeeklyPayMax = weeklyHours ? (item.salaryRange?.max || 0) * weeklyHours : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JobDetail', { 
          itemId: item.id || item.uid, 
          itemType: currentUser.role === 'worker' ? 'job' : 'worker',
          currentUserData: currentUser,
          item: item
        })}
      >
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          style={styles.cardGradient}
        >
          {currentUser && currentUser.role === 'worker' ? (
            <View style={styles.cardContent}>
              <Text style={styles.jobTitle}>{item.jobTitle || 'No Job Title'}</Text>
              
              <View style={styles.matchContainer}>
                <Text style={styles.matchText}>50% Match</Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Overview</Text>
                <Text style={styles.value}>{item.user_overview || 'No overview available'}</Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Pay Range</Text>
                <Text style={styles.value}>${item.salaryRange?.min || 'N/A'}/hr - ${item.salaryRange?.max || 'N/A'}/hr</Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Estimated Weekly Hours</Text>
                <Text style={styles.value}>
                  {weeklyHours ? `${weeklyHours} hours` : 'No Availability Set'}
                </Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Estimated Weekly Pay</Text>
                <Text style={styles.value}>
                  {weeklyHours ? 
                    `$${estimatedWeeklyPayMin.toLocaleString()} - $${estimatedWeeklyPayMax.toLocaleString()}` : 
                    'No Availability Set'}
                </Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Relevant Skills</Text>
                <SkillsList 
                  skills={Array.isArray(item.requiredSkills) ? item.requiredSkills : []} 
                  userSkills={Array.isArray(userSkills) ? userSkills : []} 
                />
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>
                  {item.distance != null ? `${item.distance} miles away` : 'Distance unavailable'}
                </Text>
              </View>

              {renderAvailabilitySection(item)}
            </View>
          ) : (
            <View style={styles.cardContent}>
              <Text style={styles.jobTitle}>{item.name || 'No Name'}</Text>
              
              <View style={styles.infoContainer}>
                <Text style={styles.label}>Overview</Text>
                <Text style={styles.value}>{item.user_overview || 'No overview available'}</Text>
              </View>

              {Array.isArray(item.selectedJobs) && item.selectedJobs.map((job, index) => (
                <View key={index} style={styles.jobContainer}>
                  <Text style={styles.jobText}>{job.jobType || 'No Job Type'}</Text>
                  <Text style={styles.industryText}>{job.industry || 'No Industry'}</Text>
                  <View style={styles.skillsContainer}>
                    {Array.isArray(job.skills) && job.skills.map((skill, skillIndex) => {
                      if (typeof skill !== 'string') return null;
                      return (
                        <View key={skillIndex} style={styles.skillBubble}>
                          <Text style={styles.skillText}>{skill}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

              {renderAvailabilitySection(item)}

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>
                  {item.distance != null ? `${item.distance} miles away` : 'Distance unavailable'}
                </Text>
              </View>
            </View>
          )}
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
          fetchUserAndItems();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.length > 0 ? (
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
      ) : (
        <View style={styles.noItemsContainer}>
          <Text style={styles.noItemsText}>No items available at the moment.</Text>
        </View>
      )}

      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => {
          if (swiperRef.current && swiperRef.current.jumpToCardIndex) {
            swiperRef.current.jumpToCardIndex(0);
          }
        }}>
          <Ionicons name="home" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Matches')}>
          <Ionicons name="heart" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <NewMatchModal 
        visible={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        jobData={matchedJob}
        matchData={{}} // You can pass relevant match data here
      />
    </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 5,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    padding: 10,
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
  cardContent: {
    flex: 1,
    padding: 20,
  },
  jobTitle: {
    fontFamily: 'LibreBodoni_700Bold',
    fontSize: 28,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  matchContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchText: {
    fontFamily: 'LibreBodoni_400Regular',
    fontSize: 24,
    color: '#4ade80',
  },
  infoContainer: {
    marginBottom: 15,
  },
  label: {
    fontFamily: 'DMSerifText_400Regular',
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 5,
  },
  value: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'LibreBodoni_400Regular',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
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
  availabilityContainer: {
    marginTop: 5,
  },
  scheduleRow: {
    marginBottom: 4,
    paddingVertical: 2,
  },
  scheduleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  jobContainer: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  jobText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'DMSerifText_400Regular',
    marginBottom: 4,
  },
  industryText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'LibreBodoni_400Regular',
    marginBottom: 8,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
});
