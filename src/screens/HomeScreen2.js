// src/screens/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert, Button } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { db } from '../firebase'; // Corrected import path assuming firebase.js is in the parent directory

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HomeScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const swiperRef = useRef(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const jobSnapshot = await db.collection('jobs').get();
        const jobData = jobSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setJobs(jobData);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        Alert.alert('Error', 'Failed to fetch jobs. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const onSwipedRight = (cardIndex) => {
    const job = jobs[cardIndex];
    // Handle swipe right (Interested)
    console.log(`Interested in: ${job.jobTitle}`);
    // You can implement saving this preference to Firestore or local storage
  };

  const onSwipedLeft = (cardIndex) => {
    const job = jobs[cardIndex];
    // Handle swipe left (Not Interested)
    console.log(`Not interested in: ${job.jobTitle}`);
    // You can implement saving this preference to Firestore or local storage
  };

  const onSwipedAll = () => {
    Alert.alert('End of Jobs', 'You have swiped through all available jobs.');
  };

  const renderCard = (job) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JobDetail', { job })}
      >
        <Text style={styles.jobTitle}>{job.jobTitle}</Text>
        <Text style={styles.employer}>Employer: {job.employer}</Text>
        <Text style={styles.location}>Location: {job.location}</Text>
        <Text style={styles.time}>Time Needed: {job.timesNeeded}</Text>
        <Text style={styles.pay}>Pay Rate: ${job.payRate}/hour</Text>
        {job.category && (
          <Text style={styles.category}>Category: {job.category}</Text>
        )}
        {job.skillsRequired && job.skillsRequired.length > 0 && (
          <Text style={styles.skills}>Skills Required: {job.skillsRequired.join(', ')}</Text>
        )}
        <Text style={styles.description}>{job.description}</Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading Jobs...</Text>
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
                  backgroundColor: 'red',
                  color: 'white',
                  fontSize: 24,
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
                  backgroundColor: 'green',
                  color: 'white',
                  fontSize: 24,
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
          <Text style={styles.noJobsText}>No jobs available at the moment.</Text>
        </View>
      )}

      <View style={styles.navigation}>
        <Button 
          title="Home" 
          onPress={() => { 
            // Already on Home, reset swiper to first card
            if (swiperRef.current && swiperRef.current.jumpToCardIndex) {
              swiperRef.current.jumpToCardIndex(0);
            }
          }} 
        />
        <Button title="Matches" onPress={() => navigation.navigate('Matches')} />
        <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
        <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0', // Light gray background
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flex: 0.75,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, // For Android shadow
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  employer: {
    fontSize: 18,
    marginBottom: 5,
  },
  location: {
    fontSize: 16,
    marginBottom: 5,
  },
  time: {
    fontSize: 16,
    marginBottom: 5,
  },
  pay: {
    fontSize: 16,
    marginBottom: 5,
  },
  category: {
    fontSize: 16,
    marginBottom: 5,
    color: 'blue',
  },
  skills: {
    fontSize: 14,
    marginBottom: 10,
    color: 'green',
  },
  description: {
    fontSize: 14,
    marginTop: 10,
    color: '#555',
  },
  navigation: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noJobsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noJobsText: {
    fontSize: 18,
    color: '#555',
  },
});
