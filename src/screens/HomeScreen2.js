import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { db, auth, firebase } from '../firebase';  // Import firebase
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Job from '../models/Job';
import User from '../models/User';
import UserJobPreference from '../models/UserJobPreference';  // Import UserJobPreference

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);

  useEffect(() => {
    const fetchUserAndItems = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        setCurrentUser(new User({ uid: userDoc.id, ...userData }));

        if (userData.role === 'worker') {
          const jobAttributesSnapshot = await db.collection('job_attributes').get();
          const jobsData = jobAttributesSnapshot.docs.map(doc => new Job({ id: doc.id, ...doc.data() }));
          setItems(jobsData);
        } else if (userData.role === 'employer') {
          const userAttributesSnapshot = await db.collection('user_attributes')
            .where('role', '==', 'worker').get();
          const candidatesData = userAttributesSnapshot.docs.map(doc => new User({ uid: doc.id, ...doc.data() }));
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

  const onSwipedRight = async (cardIndex) => {
    const item = items[cardIndex];
    const currentUserUid = auth.currentUser.uid;
    const itemId = item.id || item.uid;

    console.log(`Swiped right on item: ${itemId}`);
    console.log(`Current user: ${currentUserUid}, role: ${currentUser.role}`);

    try {
      let matchId, matchData, userJobPrefData;
      if (currentUser.role === 'worker') {
        matchId = `${currentUserUid}_${itemId}`;
        matchData = {
          worker: true,
          workerId: currentUserUid,
          employerId: itemId,
        };
        userJobPrefData = new UserJobPreference({
          userId: currentUserUid,
          role: 'worker',
          swipedUserId: itemId,
          interested: true,
        });
      } else if (currentUser.role === 'employer') {
        matchId = `${itemId}_${currentUserUid}`;
        matchData = {
          employer: true,
          employerId: currentUserUid,
          workerId: itemId,
        };
        userJobPrefData = new UserJobPreference({
          userId: currentUserUid,
          role: 'employer',
          swipedUserId: itemId,
          interested: true,
        });
      }

      // Save match data
      const matchRef = db.collection('matches').doc(matchId);
      await matchRef.set({
        ...matchData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Update user_job_preferences
      await db.collection('user_job_preferences').doc(currentUserUid).set({
        [itemId]: userJobPrefData
      }, { merge: true });

      console.log('User job preferences updated successfully');

      // Check if it's a mutual match
      const matchDoc = await matchRef.get();
      const existingMatchData = matchDoc.data();
      if (existingMatchData.worker && existingMatchData.employer) {
        console.log("It's a match!");
        Alert.alert("It's a Match!", "You've matched with this job/candidate!");
      }
    } catch (error) {
      console.error("Error saving match:", error);
      Alert.alert('Error', 'Failed to save match. Please try again.');
    }
  };

  const onSwipedLeft = (cardIndex) => {
    const item = items[cardIndex];
    console.log(`Not interested in: ${currentUser.role === 'worker' ? item.jobTitle : item.email}`);
  };

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
            <>
              <Text style={styles.jobTitle}>{item.jobTitle || 'No Title'}</Text>
              <Text style={styles.cardText}>Industry: {item.industry || 'N/A'}</Text>
              <Text style={styles.cardText}>Estimated Hours: {item.estimatedHours || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Skills: {item.requiredSkills?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Experience: {item.requiredExperience?.minYears || 'N/A'} years</Text>
              <Text style={styles.cardText}>Required Education: {item.requiredEducation || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Certifications: {item.requiredCertifications?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Job Type: {item.jobType || 'N/A'}</Text>
              <Text style={styles.cardText}>Salary Range: ${item.salaryRange?.min || 'N/A'} - ${item.salaryRange?.max || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Availability: {item.requiredAvailability?.join(', ') || 'N/A'}</Text>
            </>
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
          onSwipedRight={onSwipedRight}
          onSwipedLeft={onSwipedLeft}
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
});
