import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Modal } from 'react-native';
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
import Job from '../models/Job';
import { getAuth } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

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
  const [locationDisplay, setLocationDisplay] = useState('Location not set');
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [editedOverview, setEditedOverview] = useState('');
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [editingJobData, setEditingJobData] = useState({
    industry: '',
    jobTitle: '',
    jobType: '',
    requiredSkills: [],
    requiredExperience: { minYears: 0, preferredYears: 0 }
  });
  const [editingAvailabilityData, setEditingAvailabilityData] = useState({
    day: '',
    repeatType: 'weekly',
    slots: [{ startTime: '', endTime: '' }]
  });
  const [jobAttributes, setJobAttributes] = useState({
    jobTitle: '',
    companyName: '',
    industry: '',
    requiredSkills: []
  });

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
          const combinedData = {
            ...userData.data(),
            ...attributesDoc.data(),
          };
          
          setProfileData(combinedData);

          // Handle location display
          if (combinedData.cityName && combinedData.stateCode) {
            setLocationDisplay(`${combinedData.cityName}, ${combinedData.stateCode}`);
          } else if (combinedData.location) {
            // If we have coordinates, reverse geocode them
            try {
              const response = await fetch(
                `http://127.0.0.1:5000/reverse-geocode?lat=${combinedData.location.latitude}&lng=${combinedData.location.longitude}`
              );
              const data = await response.json();
              
              if (data.success && data.city && data.state) {
                setLocationDisplay(`${data.city}, ${data.state}`);
                
                // Update the user_attributes with the resolved city and state
                await db.collection(collectionName).doc(currentUser.uid).update({
                  cityName: data.city,
                  stateCode: data.state
                });
              }
            } catch (error) {
              console.error('Error reverse geocoding:', error);
              setLocationDisplay('Location unavailable');
            }
          }

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

  useEffect(() => {
    const fetchJobData = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          console.log('No user logged in');
          return;
        }

        const db = getFirestore();
        const jobRef = doc(db, 'job_attributes', user.uid);
        const jobDoc = await getDoc(jobRef);

        if (jobDoc.exists()) {
          const data = jobDoc.data();
          console.log('Job attributes data:', data); // Debug log
          setJobAttributes({
            jobTitle: data.jobTitle || '',
            companyName: data.companyName || '',
            industry: data.industry || '',
            requiredSkills: data.requiredSkills || []
          });
        } else {
          console.log('No job attributes document found for this user');
        }
      } catch (error) {
        console.error('Error fetching job attributes data:', error);
      }
    };

    fetchJobData();
  }, []);

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

  const handleUpdateOverview = async () => {
    try {
      const userRole = profileData.role;
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      
      // Update both collections
      await Promise.all([
        db.collection('users').doc(currentUser.uid).update({
          user_overview: editedOverview
        }),
        db.collection(collectionName).doc(currentUser.uid).update({
          user_overview: editedOverview
        })
      ]);

      // Update local state
      setProfileData(prev => ({
        ...prev,
        user_overview: editedOverview
      }));
      setIsEditingOverview(false);
      Alert.alert('Success', 'About Me updated successfully');
    } catch (error) {
      console.error('Error updating overview:', error);
      Alert.alert('Error', 'Failed to update About Me');
    }
  };

  const handleEditJob = async (jobData) => {
    try {
      const userRole = profileData.role;
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      
      if (userRole === 'employer') {
        await db.collection(collectionName).doc(currentUser.uid).update({
          industryPrefs: [jobData.industry],
          jobTypePrefs: jobData.jobType,
          jobTitle: jobData.jobTitle,
          requiredSkills: jobData.requiredSkills,
          requiredExperience: jobData.requiredExperience
        });
      } else {
        // For workers, handle selectedJobs array
        const updatedJobs = [...(profileData.selectedJobs || [])];
        if (jobData.index !== undefined) {
          updatedJobs[jobData.index] = jobData;
        } else if (updatedJobs.length < 3) {
          updatedJobs.push(jobData);
        }

        await db.collection(collectionName).doc(currentUser.uid).update({
          selectedJobs: updatedJobs
        });
      }

      // Refresh profile data
      const updatedDoc = await db.collection(collectionName).doc(currentUser.uid).get();
      setProfileData(prev => ({
        ...prev,
        ...updatedDoc.data()
      }));
      setIsEditingJob(false);
    } catch (error) {
      console.error('Error updating job:', error);
      Alert.alert('Error', 'Failed to update job details');
    }
  };

  const handleDeleteJob = async (index) => {
    try {
      const updatedJobs = profileData.selectedJobs.filter((_, i) => i !== index);
      await db.collection('user_attributes').doc(currentUser.uid).update({
        selectedJobs: updatedJobs
      });
      setProfileData(prev => ({
        ...prev,
        selectedJobs: updatedJobs
      }));
    } catch (error) {
      console.error('Error deleting job:', error);
      Alert.alert('Error', 'Failed to delete job');
    }
  };

  const handleEditAvailability = async (availabilityData) => {
    try {
      const userRole = profileData.role;
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      
      const updatedAvailability = {
        ...profileData.availability,
        [availabilityData.day]: {
          repeatType: availabilityData.repeatType,
          slots: availabilityData.slots
        }
      };

      await db.collection(collectionName).doc(currentUser.uid).update({
        availability: updatedAvailability
      });

      setProfileData(prev => ({
        ...prev,
        availability: updatedAvailability
      }));
      setIsEditingAvailability(false);
    } catch (error) {
      console.error('Error updating availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const handleDeleteAvailability = async (day, slotIndex) => {
    try {
      const userRole = profileData.role;
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      
      const updatedSlots = profileData.availability[day].slots.filter((_, index) => index !== slotIndex);
      const updatedAvailability = {
        ...profileData.availability,
        [day]: {
          ...profileData.availability[day],
          slots: updatedSlots
        }
      };

      await db.collection(collectionName).doc(currentUser.uid).update({
        availability: updatedAvailability
      });

      setProfileData(prev => ({
        ...prev,
        availability: updatedAvailability
      }));
    } catch (error) {
      console.error('Error deleting availability slot:', error);
      Alert.alert('Error', 'Failed to delete availability slot');
    }
  };

  const renderWorkerProfile = () => {
    console.log('Rendering worker profile');
    console.log('Stats grid items:', [
      { label: 'Active Jobs', value: 3 },
      { label: 'Hours', value: 24 },
      { label: 'Matches', value: 12 },
      { label: 'Earnings', value: '$840' }
    ]);

    // Helper function to organize availability by day of week
    const organizeAvailabilityByDay = () => {
      if (!profileData?.availability) return {};
      
      // Return the availability object directly since days are already organized
      return profileData.availability;
    };

    const availabilityData = organizeAvailabilityByDay();

    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.name}>{profileData?.name || 'Name not set'}</Text>
            <Text style={styles.email}>{profileData?.email || 'Email not set'}</Text>
            <Text style={styles.location}>{locationDisplay}</Text>
            
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {[
                { icon: 'briefcase-outline', label: 'Active Jobs', value: '3' },
                { icon: 'time-outline', label: 'Hours', value: '24' },
                { icon: 'people-outline', label: 'Matches', value: '12' },
                { icon: 'cash-outline', label: 'Earnings', value: '$840' }
              ].map((stat, index) => (
                <View key={index} style={styles.statsCard}>
                  <View style={styles.statsCardInner}>
                    <View style={styles.statsIconContainer}>
                      <Ionicons name={stat.icon} size={20} color="#2563eb" />
                      <Text style={styles.statsLabel}>{stat.label}</Text>
                    </View>
                    <Text style={styles.statsValue}>{stat.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Selected Jobs Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Jobs</Text>
            {profileData?.selectedJobs?.map((job, index) => (
              <View key={index} style={styles.jobCard}>
                <View style={styles.jobCardHeader}>
                  <View>
                    <View style={styles.industryBadge}>
                      <Text style={styles.industryBadgeText}>{job.industry}</Text>
                    </View>
                    <Text style={styles.jobCardTitle}>{job.title}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingJobData(job);
                      setIsEditingJob(true);
                    }}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={20} color="#2563eb" />
                  </TouchableOpacity>
                </View>
                <View style={styles.skillBadgeContainer}>
                  {job.skills?.map((skill, skillIndex) => (
                    <View key={skillIndex} style={styles.skillBadge}>
                      <Text style={styles.skillBadgeText}>
                        {skill.name} • {skill.yearsOfExperience}y
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* User Overview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>About Me</Text>
              <TouchableOpacity 
                onPress={() => {
                  setEditedOverview(profileData?.user_overview || '');
                  setIsEditingOverview(true);
                }}
                style={styles.editButton}
              >
                <Ionicons name="pencil" size={20} color="#2563eb" />
              </TouchableOpacity>
            </View>
            <Text style={styles.overviewText}>
              {profileData?.user_overview || 'No overview provided'}
            </Text>

            {/* Edit Overview Modal */}
            <Modal
              visible={isEditingOverview}
              animationType="slide"
              transparent={true}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Edit About Me</Text>
                  <TextInput
                    style={styles.overviewInput}
                    multiline
                    value={editedOverview}
                    onChangeText={setEditedOverview}
                    placeholder="Write something about yourself..."
                    textAlignVertical="top"
                  />
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setIsEditingOverview(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleUpdateOverview}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>

          {/* Availability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Availability</Text>
            <View style={styles.availabilityContainer}>
              {Object.entries(availabilityData).map(([day, dayData]) => (
                <View key={day} style={styles.dayContainer}>
                  <View style={[
                    styles.dayChip,
                    dayData.slots?.length > 0 ? styles.dayChipAvailable : styles.dayChipUnavailable
                  ]}>
                    <Text style={[
                      styles.dayText,
                      dayData.slots?.length > 0 ? styles.dayTextAvailable : styles.dayTextUnavailable
                    ]}>
                      {day}
                    </Text>
                  </View>
                  <View style={styles.timeSlotsContainer}>
                    {dayData.slots?.map((slot, slotIndex) => (
                      <Text key={slotIndex} style={styles.timeSlot}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingAvailabilityData({
                        day: day,
                        repeatType: 'weekly',
                        slots: []
                      });
                      setIsEditingAvailability(true);
                    }}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={20} color="#2563eb" />
                  </TouchableOpacity>
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
          <Text style={styles.name}>
            {jobAttributes.jobTitle && jobAttributes.companyName 
              ? `${jobAttributes.jobTitle} at ${jobAttributes.companyName}`
              : 'Position not set'}
          </Text>
          <Text style={styles.location}>{locationDisplay}</Text>
          
          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats?.totalSwipes || 0}</Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats?.rightSwipes || 0}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{employerStats?.interviewsScheduled || 0}</Text>
              <Text style={styles.statLabel}>Interviews</Text>
            </View>
          </View>
        </View>

        {/* Job Overview Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Job Overview</Text>
            <TouchableOpacity 
              onPress={() => {
                setEditedOverview(profileData?.job_overview || '');
                setIsEditingOverview(true);
              }}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          <Text style={styles.overviewText}>
            {profileData?.job_overview || 'No job overview provided'}
          </Text>
        </View>

        {/* Job Details Section with worker profile styling */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.jobCard}>
            <View style={styles.jobCardHeader}>
              <View>
                <View style={styles.industryBadge}>
                  <Text style={styles.industryBadgeText}>{jobAttributes.industry}</Text>
                </View>
                <Text style={styles.jobCardTitle}>{jobAttributes.jobTitle}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setEditingJobData({
                    industry: jobAttributes.industry,
                    jobTitle: jobAttributes.jobTitle,
                    companyName: jobAttributes.companyName,
                    requiredSkills: jobAttributes.requiredSkills || []
                  });
                  setIsEditingJob(true);
                }}
                style={styles.editButton}
              >
                <Ionicons name="pencil" size={20} color="#2563eb" />
              </TouchableOpacity>
            </View>
            <View style={styles.skillBadgeContainer}>
              {jobAttributes.requiredSkills?.map((skill, index) => (
                <View key={index} style={styles.skillBadge}>
                  <Text style={styles.skillBadgeText}>
                    {skill.name} • {skill.yearsOfExperience}y
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Availability Section - if needed */}
        {profileData?.availability && Object.keys(profileData.availability).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required Availability</Text>
            <View style={styles.availabilityContainer}>
              {Object.entries(profileData.availability).map(([day, dayData]) => (
                <View key={day} style={styles.dayContainer}>
                  <View style={[
                    styles.dayChip,
                    dayData.slots?.length > 0 ? styles.dayChipAvailable : styles.dayChipUnavailable
                  ]}>
                    <Text style={[
                      styles.dayText,
                      dayData.slots?.length > 0 ? styles.dayTextAvailable : styles.dayTextUnavailable
                    ]}>
                      {day}
                    </Text>
                  </View>
                  <View style={styles.timeSlotsContainer}>
                    {dayData.slots?.map((slot, slotIndex) => (
                      <Text key={slotIndex} style={styles.timeSlot}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingAvailabilityData({
                        day: day,
                        repeatType: 'weekly',
                        slots: []
                      });
                      setIsEditingAvailability(true);
                    }}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={20} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const JobEditModal = () => (
    <Modal visible={isEditingJob} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {profileData.role === 'employer' ? 'Edit Job Details' : 'Add/Edit Job'}
          </Text>
          
          <Picker
            selectedValue={editingJobData.industry}
            onValueChange={(value) => setEditingJobData(prev => ({ ...prev, industry: value }))}
          >
            {Job.industries?.map(industry => (
              <Picker.Item key={industry} label={industry} value={industry} />
            ))}
          </Picker>

          <TextInput
            style={styles.input}
            placeholder="Job Title"
            value={jobAttributes.jobTitle}
            onChangeText={(text) => setJobAttributes(prev => ({ ...prev, jobTitle: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Company Name"
            value={jobAttributes.companyName}
            onChangeText={(text) => setJobAttributes(prev => ({ ...prev, companyName: text }))}
          />

          {/* Add skill selection UI here */}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setIsEditingJob(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => handleEditJob(editingJobData)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const AvailabilityEditModal = () => (
    <Modal visible={isEditingAvailability} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Availability</Text>
          
          <Picker
            selectedValue={editingAvailabilityData.day}
            onValueChange={(value) => setEditingAvailabilityData(prev => ({ ...prev, day: value }))}
          >
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
              .map(day => (
                <Picker.Item key={day} label={day} value={day} />
              ))}
          </Picker>

          {/* Add time selection UI here */}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setIsEditingAvailability(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => handleEditAvailability(editingAvailabilityData)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        profileData.role === 'worker' ? renderWorkerProfile() : renderEmployerProfile()
      )}
      <JobEditModal />
      <AvailabilityEditModal />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e3a8a',
  },
  overviewInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  noSkillsText: {
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
  },
  header: {
    height: 200,
    padding: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  title: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  jobDetailsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    width: 100,
  },
  detailText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  skillsContainer: {
    marginTop: 8,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  skillName: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  skillYears: {
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
  },
  statsCard: {
    width: '48%',
    marginBottom: 16,
  },
  statsCardInner: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statsIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 4,
  },
  jobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  industryBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  industryBadgeText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  jobCardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1f2937',
  },
  skillBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  skillBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  skillBadgeText: {
    color: '#2563eb',
    fontSize: 14,
  },
});