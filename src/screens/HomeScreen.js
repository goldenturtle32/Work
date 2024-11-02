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

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);

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
          setItems(jobsData);
        } else if (userData.role === 'employer') {
          const userAttributesSnapshot = await db.collection('user_attributes')
            .where('role', '==', 'worker').get();
          const candidatesData = userAttributesSnapshot.docs.map(doc => {
            const candidateData = doc.data();
            const distance = candidateData.location && userLocation ? 
              calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                candidateData.location.latitude,
                candidateData.location.longitude
              ) : null;
            return new User({ 
              uid: doc.id, 
              ...candidateData,
              distance 
            });
          });
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

  const handleSwipe = async (cardIndex, interested) => {
    const item = items[cardIndex];
    const currentUserUid = auth.currentUser.uid;
    const itemId = currentUser.role === 'worker' ? item.id : item.uid;

    console.log(`Swiped ${interested ? 'right' : 'left'} on item: ${itemId}`);
    console.log(`Current user: ${currentUserUid}, role: ${currentUser.role}`);
    console.log('Item being swiped:', item);

    try {
      const userJobPrefData = new UserJobPreference({
        userId: currentUserUid,
        role: currentUser.role,
        swipedUserId: itemId,
        interested: interested,
      });

      console.log('UserJobPreference data:', userJobPrefData);

      const userJobPrefObject = {
        ...userJobPrefData.toObject(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Update user_job_preferences
      await db.collection('user_job_preferences').doc(currentUserUid).set({
        [itemId]: userJobPrefObject
      }, { merge: true });

      console.log('User job preferences updated successfully');

      // If it's a right swipe, check for a match
      if (interested) {
        const matchId = currentUser.role === 'worker' 
          ? `${currentUserUid}_${itemId}` 
          : `${itemId}_${currentUserUid}`;
        
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (matchDoc.exists) {
          const existingMatchData = matchDoc.data();
          if (
            (currentUser.role === 'worker' && existingMatchData.employer) ||
            (currentUser.role === 'employer' && existingMatchData.worker)
          ) {
            console.log("It's a match!");
            Alert.alert("It's a Match!", "You've matched with this job/candidate!");
            
            // Update the match document to show it's a full match
            await matchRef.update({
              [currentUser.role]: true,
              [`${currentUser.role}Id`]: currentUserUid,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } else {
          // Create a new potential match document
          await matchRef.set({
            [currentUser.role]: true,
            [`${currentUser.role}Id`]: currentUserUid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
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
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JobDetail', { 
          itemId: item.id || item.uid, 
          itemType: currentUser.role === 'worker' ? 'job' : 'worker',
          currentUserData: currentUser 
        })}
      >
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          style={styles.cardGradient}
        >
          {currentUser && currentUser.role === 'worker' ? (
            <View style={styles.cardContent}>
              <Text style={styles.jobTitle}>{item.jobTitle || 'No Title'}</Text>
              
              <View style={styles.matchContainer}>
                <Text style={styles.matchText}>50% Match</Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Pay Range</Text>
                <Text style={styles.value}>${item.salaryRange?.min || 'N/A'} - ${item.salaryRange?.max || 'N/A'}</Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Pay Estimates</Text>
                <Text style={styles.value}>
                  ${(item.salaryRange?.min * (item.estimatedHours || 0)).toLocaleString()} - 
                  ${(item.salaryRange?.max * (item.estimatedHours || 0)).toLocaleString()}
                </Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Skills</Text>
                <View style={styles.skillsContainer}>
                  {item.requiredSkills?.map((skill, index) => (
                    <View key={index} style={styles.skillBubble}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>
                  {item.distance != null ? `${item.distance} miles away` : 'Distance unavailable'}
                </Text>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.label}>Availability</Text>
                <Text style={styles.value}>{item.requiredAvailability?.join(', ') || 'N/A'}</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.jobTitle}>{item.email || 'No Email'}</Text>
              <Text style={styles.cardText}>Skills: {item.skills?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Experience: {item.experience?.totalYears || 'N/A'} years</Text>
              <Text style={styles.cardText}>Education: {item.education || 'N/A'}</Text>
              <Text style={styles.cardText}>Certifications: {item.certifications?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Preferred Job Types: {item.jobTypePrefs?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Preferred Industries: {item.industryPrefs?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Salary Preference: ${item.salaryPrefs?.min || 'N/A'} - ${item.salaryPrefs?.max || 'N/A'}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
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
    fontFamily: 'DMSerifText_400Regular',
    fontSize: 16,
    color: '#ffffff',
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
});
