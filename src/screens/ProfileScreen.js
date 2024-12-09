import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { BarChart } from 'react-native-chart-kit';
import { 
  useFonts,
  Domine_400Regular,
  Domine_700Bold
} from '@expo-google-fonts/domine';

export default function ProfileScreen({ navigation }) {
  const [profileData, setProfileData] = useState({
    email: '',
    name: '',
    phone: '',
    role: '',
    location: null,
    skills: [],
    selectedJobs: [],
    availability: {},
    user_overview: '',
  });
  
  const [matchStats, setMatchStats] = useState({
    activeJobs: 0,
    weeklyEarnings: 0,
  });

  const [employerStats, setEmployerStats] = useState({
    totalSwipes: 0,
    rightSwipes: 0,
    potentialApplicants: 0,
    interviewsScheduled: 0,
  });

  const [selectedJobIndex, setSelectedJobIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userRole = userDoc.data()?.role;
        const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
        
        const [userData, attributesDoc] = await Promise.all([
          userDoc,
          db.collection(collectionName).doc(currentUser.uid).get(),
        ]);

        if (userData.exists && attributesDoc.exists) {
          setProfileData({
            ...userData.data(),
            ...attributesDoc.data(),
          });

          if (userRole === 'worker') {
            await fetchWorkerStats();
          } else {
            await fetchEmployerStats();
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile data:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser.uid]);

  const fetchWorkerStats = async () => {
    try {
      const matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', currentUser.uid)
        .where('accepted', '==', 1)
        .get();

      const activeJobs = matchesSnapshot.size;
      let totalWeeklyEarnings = 0;

      // Calculate weekly earnings based on accepted jobs
      matchesSnapshot.forEach(doc => {
        const matchData = doc.data();
        // Add calculation logic here
        totalWeeklyEarnings += 500; // Placeholder value
      });

      setMatchStats({
        activeJobs,
        weeklyEarnings: totalWeeklyEarnings,
      });
    } catch (error) {
      console.error('Error fetching worker stats:', error);
    }
  };

  const fetchEmployerStats = async () => {
    try {
      const prefsSnapshot = await db.collection('user_job_preferences')
        .where('swipedUserId', '==', currentUser.uid)
        .get();

      const totalSwipes = prefsSnapshot.size;
      const rightSwipes = prefsSnapshot.docs.filter(doc => doc.data().interested).length;

      setEmployerStats({
        totalSwipes,
        rightSwipes,
        potentialApplicants: rightSwipes, // Placeholder
        interviewsScheduled: Math.floor(rightSwipes * 0.3), // Placeholder
      });
    } catch (error) {
      console.error('Error fetching employer stats:', error);
    }
  };

  const renderWorkerProfile = () => (
    <ScrollView style={styles.scrollView}>
      {/* Header Section */}
      <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.headerSection}>
        <Text style={styles.name}>{profileData.name}</Text>
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>{profileData.email}</Text>
          {profileData.phone && (
            <Text style={styles.contactText}>{profileData.phone}</Text>
          )}
          {profileData.location && (
            <Text style={styles.contactText}>
              {profileData.location.city || 'Location not set'}
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* Skills & Jobs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills & Experience</Text>
        <View style={styles.skillsContainer}>
          {profileData.skills.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>
                {skill.name} ({skill.yearsOfExperience}yr)
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.overviewText}>{profileData.user_overview}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Stats</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Active Jobs</Text>
            <Text style={styles.statValue}>{matchStats.activeJobs}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Weekly Earnings</Text>
            <BarChart
              data={{
                labels: ['Week'],
                datasets: [{
                  data: [matchStats.weeklyEarnings]
                }]
              }}
              width={200}
              height={100}
              chartConfig={{
                backgroundColor: '#1e3a8a',
                backgroundGradientFrom: '#1e3a8a',
                backgroundGradientTo: '#3b82f6',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              }}
              style={styles.chart}
            />
          </View>
        </View>
      </View>

      {/* Availability Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Availability</Text>
        {Object.entries(profileData.availability || {}).map(([date, dayData], index) => (
          <View key={index} style={styles.availabilityItem}>
            <Text style={styles.dayText}>
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
            </Text>
            {dayData.slots?.map((slot, slotIndex) => (
              <Text key={slotIndex} style={styles.timeText}>
                {slot.startTime} - {slot.endTime}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderEmployerProfile = () => (
    <ScrollView style={styles.scrollView}>
      {/* Job Selector */}
      <View style={styles.jobSelectorContainer}>
        <Picker
          selectedValue={selectedJobIndex}
          onValueChange={(itemValue) => setSelectedJobIndex(itemValue)}
          style={styles.picker}
        >
          {profileData.selectedJobs.map((job, index) => (
            <Picker.Item key={index} label={job.title} value={index} />
          ))}
        </Picker>
      </View>

      {/* Header Section */}
      <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.headerSection}>
        <Text style={styles.name}>{profileData.selectedJobs[selectedJobIndex]?.title}</Text>
        <Text style={styles.contactText}>{profileData.email}</Text>
      </LinearGradient>

      {/* Requirements Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Requirements</Text>
        <View style={styles.skillsContainer}>
          {profileData.selectedJobs[selectedJobIndex]?.skills.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.overviewText}>{profileData.user_overview}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Views</Text>
            <Text style={styles.statValue}>{employerStats.totalSwipes}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Interested Candidates</Text>
            <Text style={styles.statValue}>{employerStats.rightSwipes}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Best Fit Candidates</Text>
            <Text style={styles.statValue}>{employerStats.potentialApplicants}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Interviews Scheduled</Text>
            <Text style={styles.statValue}>{employerStats.interviewsScheduled}</Text>
          </View>
        </View>
      </View>

      {/* Availability Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Availability</Text>
        {Object.entries(profileData.availability || {}).map(([date, dayData], index) => (
          <View key={index} style={styles.availabilityItem}>
            <Text style={styles.dayText}>
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
            </Text>
            {dayData.slots?.map((slot, slotIndex) => (
              <Text key={slotIndex} style={styles.timeText}>
                {slot.startTime} - {slot.endTime}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {profileData.role === 'worker' ? renderWorkerProfile() : renderEmployerProfile()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    padding: 20,
    borderRadius: 15,
    margin: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  contactInfo: {
    marginTop: 10,
  },
  contactText: {
    color: '#ffffff',
    fontSize: 16,
    marginVertical: 2,
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 15,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  skillBubble: {
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    padding: 8,
    margin: 4,
  },
  skillText: {
    color: '#1e3a8a',
    fontSize: 14,
  },
  overviewText: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 24,
  },
  statsContainer: {
    marginTop: 10,
  },
  statItem: {
    marginBottom: 15,
  },
  statLabel: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  availabilityItem: {
    marginVertical: 5,
  },
  dayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  timeText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 10,
  },
  jobSelectorContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    borderRadius: 15,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});