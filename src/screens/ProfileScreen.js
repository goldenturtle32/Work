import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
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

  const renderWorkerProfile = () => {
    console.log('Profile Data:', profileData);

    // Helper function to organize availability by day of week
    const organizeAvailabilityByDay = () => {
      const weeklyAvailability = {};
      
      if (profileData?.availability) {
        Object.entries(profileData.availability).forEach(([date, dayData]) => {
          const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
          if (!weeklyAvailability[dayName] && dayData?.slots?.length > 0) {
            weeklyAvailability[dayName] = dayData.slots;
          }
        });
      }
      
      // Sort days of week
      const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sortedAvailability = {};
      daysOrder.forEach(day => {
        if (weeklyAvailability[day]) {
          sortedAvailability[day] = weeklyAvailability[day];
        }
      });
      
      return sortedAvailability;
    };

    const availabilityData = organizeAvailabilityByDay();

    return (
      <ScrollView style={styles.container}>
        <View style={styles.card}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.name}>{profileData?.name || 'Name not set'}</Text>
            <Text style={styles.email}>{profileData?.email || 'Email not set'}</Text>
            <Text style={styles.location}>
              {profileData?.location?.city || 'Location not set'}
            </Text>
            
            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profileData?.selectedJobs?.length || 0}
                </Text>
                <Text style={styles.statLabel}>Active Jobs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>${matchStats?.weeklyEarnings || 0}</Text>
                <Text style={styles.statLabel}>Weekly</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profileData?.selectedJobs?.reduce((total, job) => 
                    total + (job.skills?.length || 0), 0) || 0}
                </Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
            </View>
          </View>

          {/* Selected Jobs Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Jobs</Text>
            {profileData?.selectedJobs?.map((job, index) => (
              <View key={index} style={styles.jobTypeContainer}>
                <View style={styles.jobItem}>
                  <View style={styles.jobIndicator} />
                  <View style={styles.jobContent}>
                    <Text style={styles.jobIndustry}>{job.industry}</Text>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                  </View>
                </View>
                <View style={styles.skillsContainer}>
                  {job.skills?.map((skill, skillIndex) => (
                    <View key={skillIndex} style={styles.skillItem}>
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <Text style={styles.skillExperience}>
                        {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* User Overview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={styles.overviewText}>
              {profileData?.user_overview || 'No overview provided'}
            </Text>
          </View>

          {/* Availability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Availability</Text>
            <View style={styles.availabilityContainer}>
              {Object.entries(availabilityData).map(([day, slots]) => (
                <View key={day} style={styles.dayContainer}>
                  <View style={[
                    styles.dayChip,
                    slots.length > 0 ? styles.dayChipAvailable : styles.dayChipUnavailable
                  ]}>
                    <Text style={[
                      styles.dayText,
                      slots.length > 0 ? styles.dayTextAvailable : styles.dayTextUnavailable
                    ]}>
                      {day.substring(0, 3)}
                    </Text>
                  </View>
                  <View style={styles.timeSlotsContainer}>
                    {slots.map((slot, slotIndex) => (
                      <Text key={slotIndex} style={styles.timeSlot}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderEmployerProfile = () => (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.name}>{profileData.name}</Text>
          <Text style={styles.location}>
            {profileData.location?.city || 'Location not set'}
          </Text>
          
          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats.totalSwipes}</Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats.rightSwipes}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats.interviewsScheduled}</Text>
              <Text style={styles.statLabel}>Interviews</Text>
            </View>
          </View>
        </View>

        {/* Posted Jobs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Posted Jobs</Text>
          {profileData.selectedJobs.map((job, index) => (
            <View key={index} style={styles.jobItem}>
              <View style={styles.jobIndicator} />
              <View style={styles.jobContent}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobMeta}>{job.skills?.length || 0} required skills</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('PostJob')}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Applicant Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Overview</Text>
          <View style={styles.earningsContainer}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Potential Matches</Text>
              <Text style={styles.earningsValue}>{employerStats.potentialApplicants}</Text>
            </View>
            <View style={[styles.progressBar, { width: `${(employerStats.rightSwipes / employerStats.totalSwipes * 100) || 0}%` }]} />
          </View>
        </View>

        {/* Required Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Availability</Text>
          <View style={styles.availabilityContainer}>
            {Object.entries(profileData.availability || {}).map(([day, available], index) => (
              <View 
                key={day}
                style={[
                  styles.dayChip,
                  available ? styles.dayChipAvailable : styles.dayChipUnavailable
                ]}
              >
                <Text 
                  style={[
                    styles.dayText,
                    available ? styles.dayTextAvailable : styles.dayTextUnavailable
                  ]}
                >
                  {day.substring(0, 3)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Requirements Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Requirements</Text>
          {profileData.selectedJobs[0]?.skills?.map((skill, index) => (
            <View key={index} style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={20} color="#1e3a8a" />
              <Text style={styles.requirementText}>{skill}</Text>
            </View>
          ))}
        </View>
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
    backgroundColor: '#f8f9fa',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    margin: 16,
  },
  headerSection: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  location: {
    fontSize: 14,
    color: '#4b5563',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    fontSize: 18,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 16,
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  jobIndicator: {
    width: 4,
    height: 24,
    backgroundColor: '#1e3a8a',
    marginRight: 8,
    borderRadius: 2,
  },
  jobText: {
    fontSize: 14,
  },
  addButton: {
    marginTop: 16,
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  earningsContainer: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  earningsValue: {
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    marginTop: 8,
  },
  availabilityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayChipAvailable: {
    backgroundColor: '#dcfce7',
  },
  dayChipUnavailable: {
    backgroundColor: '#fee2e2',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayTextAvailable: {
    color: '#166534',
  },
  dayTextUnavailable: {
    color: '#991b1b',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    height: 200,
    padding: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  contactInfo: {
    marginBottom: 10,
  },
  contactText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
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
  availabilityItem: {
    marginVertical: 5,
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
  jobContent: {
    flex: 1,
    marginLeft: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  jobMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  requirementText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  email: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  jobTypeContainer: {
    marginBottom: 16,
  },
  jobTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 24,
    marginTop: 8,
  },
  skillTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 12,
    color: '#1e3a8a',
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
  jobTypeContainer: {
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobIndicator: {
    width: 4,
    height: 40,
    backgroundColor: '#1e3a8a',
    borderRadius: 2,
    marginRight: 12,
  },
  jobContent: {
    flex: 1,
  },
  jobIndustry: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  skillsContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  skillName: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  skillExperience: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  additionalStyles: {
    overviewText: {
      fontSize: 14,
      color: '#4b5563',
      lineHeight: 20,
    },
  },
});