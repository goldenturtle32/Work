import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Job from '../models/Job';
import User from '../models/User';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const calculateAverageRate = (jobAttributes) => {
  return jobAttributes.salaryRange ? (jobAttributes.salaryRange.min + jobAttributes.salaryRange.max) / 2 : 0;
};

export default function HomeScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserAndJobs = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        setCurrentUser(new User(userDoc.id, userData));
        setUserRole(userData.role);

        if (userData.role === 'jobSeeker') {
          const jobAttributesSnapshot = await db.collection('job_attributes').get();
          const jobsData = jobAttributesSnapshot.docs.map(doc => new Job(doc.id, doc.data()));
          setJobs(jobsData);
        } else if (userData.role === 'employer') {
          const userAttributesSnapshot = await db.collection('user_attributes')
            .where('role', '==', 'jobSeeker').get();
          const candidatesData = userAttributesSnapshot.docs.map(doc => new User(doc.id, doc.data()));
          setJobs(candidatesData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(`Failed to fetch data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndJobs();
  }, []);

  const onSwipedRight = async (cardIndex) => {
    const item = jobs[cardIndex];
    const currentUserUid = auth.currentUser.uid;
    const itemId = item.id;
    
    try {
      let matchId, matchData;
      if (userRole === 'worker') {
        matchId = `${currentUserUid}_${itemId}`;
        matchData = {
          worker: true,
          workerId: currentUserUid,
          employerId: itemId,
        };
      } else if (userRole === 'employer') {
        matchId = `${itemId}_${currentUserUid}`;
        matchData = {
          employer: true,
          workerId: itemId,
          employerId: currentUserUid,
        };
      }

      const matchRef = db.collection('matches').doc(matchId);
      await matchRef.set({
        ...matchData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const matchDoc = await matchRef.get();
      const existingMatchData = matchDoc.data();
      if (existingMatchData.worker && existingMatchData.employer) {
        Alert.alert("It's a Match!", "You've matched with this job/candidate!");
      }
    } catch (error) {
      console.error("Error saving match:", error);
    }
  };

  const onSwipedLeft = (cardIndex) => {
    const item = jobs[cardIndex];
    console.log(`Not interested in: ${userRole === 'worker' ? item.jobTitle : item.name}`);
  };

  const onSwipedAll = () => {
    Alert.alert('End of List', 'You have swiped through all available items.');
  };

  const renderCard = (item) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JobDetail', { itemId: item.id, userData: currentUser })}
      >
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          style={styles.cardGradient}
        >
          {userRole === 'jobSeeker' ? (
            <>
              <Text style={styles.jobTitle}>{item.jobTitle || 'No Title'}</Text>
              <Text style={styles.cardText}>Industry: {item.industry || 'N/A'}</Text>
              <Text style={styles.cardText}>Location: {item.location || 'N/A'}</Text>
              <Text style={styles.cardText}>Estimated Hours: {item.estimatedHours || 'N/A'}</Text>
              <Text style={styles.cardText}>Job Type: {item.jobType || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Skills: {item.requiredSkills?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Certifications: {item.requiredCertifications?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Education: {item.requiredEducation || 'N/A'}</Text>
              <Text style={styles.cardText}>Required Experience: {item.requiredExperience?.minYears || 'N/A'} years</Text>
              <Text style={styles.cardText}>Required Availability: {item.requiredAvailability || 'N/A'}</Text>
              <Text style={styles.cardText}>Salary Range: ${item.salaryRange?.min || 'N/A'} - ${item.salaryRange?.max || 'N/A'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.jobTitle}>{item.name || 'No Name'}</Text>
              <Text style={styles.cardText}>Skills: {item.skills?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Experience: {item.experience?.totalYears || 'N/A'} years</Text>
              <Text style={styles.cardText}>Education: {item.education || 'N/A'}</Text>
              <Text style={styles.cardText}>Certifications: {item.certifications?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Job Title Preferences: {item.jobTitlePrefs?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Job Type Preferences: {item.jobTypePrefs?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Industry Preferences: {item.industryPrefs?.join(', ') || 'N/A'}</Text>
              <Text style={styles.cardText}>Salary Preferences: ${item.salaryPrefs?.min || 'N/A'} - ${item.salaryPrefs?.max || 'N/A'}</Text>
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
          fetchUserAndJobs();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {jobs.length > 0 ? (
        <Swiper
          ref={swiperRef}
          cards={jobs}
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
        <View style={styles.noJobsContainer}>
          <Text style={styles.noJobsText}>No items available at the moment.</Text>
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
  noJobsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noJobsText: {
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