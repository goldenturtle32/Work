import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated, PanResponder } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import User from '../models/User';
import { 
  useFonts,
  Domine_400Regular,
  Domine_700Bold
} from '@expo-google-fonts/domine';
import Modal from 'react-native-modal';
import Slider from '@react-native-community/slider';
import WebMap from '../components/WebMap';

export default function ProfileScreen({ navigation, route }) {
  const [profileData, setProfileData] = useState({
    email: '',
    name: '',
    phone: '',
    socialLogins: [],
    selectedJobs: [],
    skills: [],
    industryPrefs: [],
    location: null,
    searchRadius: 0,
    availability: {},
    locationPreference: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [tempLocationPreference, setTempLocationPreference] = useState(0);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Determine which collection to fetch from based on user role
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userRole = userDoc.data()?.role;
        const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
        
        const [userData, attributesDoc] = await Promise.all([
          userDoc,
          db.collection(collectionName).doc(currentUser.uid).get(),
        ]);

        if (userData.exists && attributesDoc.exists) {
          const userDataObj = userData.data();
          const attributesData = attributesDoc.data();

          setProfileData(prevData => ({
            ...prevData,
            ...userDataObj,
            ...attributesData,
            selectedJobs: attributesData.selectedJobs || [],
            skills: attributesData.skills || [],
            industryPrefs: attributesData.industryPrefs || [],
            availability: attributesData.availability || {},
            locationPreference: attributesData.locationPreference || 1609.34, // Default to 1 mile
          }));

          // Set initial temp location preference
          setTempLocationPreference(attributesData.locationPreference || 1609.34);
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

  const formatAvailability = () => {
    const availabilityArray = [];
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    daysOfWeek.forEach(day => {
      const dayData = profileData.availability?.[day];
      if (dayData?.slots?.length > 0) {
        dayData.slots.forEach(slot => {
          if (slot.startTime && slot.endTime) {
            availabilityArray.push({
              day: day.charAt(0).toUpperCase() + day.slice(1),
              time: `${slot.startTime} - ${slot.endTime}`,
              repeatType: dayData.repeatType
            });
          }
        });
      }
    });
    
    return availabilityArray;
  };

  const renderSelectedJobs = () => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selected Jobs</Text>
        {profileData.selectedJobs && profileData.selectedJobs.length > 0 ? (
          profileData.selectedJobs.map((job, index) => (
            <View key={index} style={styles.jobItem}>
              <Text style={styles.jobTitle}>{job.industry} - {job.title}</Text>
              <View style={styles.jobSkills}>
                {job.skills && job.skills.length > 0 ? (
                  job.skills.map((skill, skillIndex) => (
                    <Text key={skillIndex} style={styles.jobSkillText}>
                      {skill.name} ({skill.yearsOfExperience} yr{skill.yearsOfExperience !== 1 ? 's' : ''})
                    </Text>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No skills selected</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No jobs selected</Text>
        )}
      </View>
    );
  };

  const renderSkills = () => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.skillsContainer}>
          {profileData.skills && profileData.skills.length > 0 ? (
            profileData.skills.map((skill, index) => (
              <View key={index} style={styles.skillItem}>
                <Text style={styles.skillText}>
                  {skill.name} ({skill.yearsOfExperience} yr{skill.yearsOfExperience !== 1 ? 's' : ''})
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No skills added</Text>
          )}
        </View>
      </View>
    );
  };

  const handleSaveRadius = async () => {
    try {
      // Get user role
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      const userRole = userDoc.data()?.role;
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';

      // Update the database
      await db.collection(collectionName).doc(currentUser.uid).update({
        locationPreference: tempLocationPreference
      });
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        locationPreference: tempLocationPreference
      }));
      
      setIsLocationModalVisible(false);
    } catch (error) {
      console.error('Error updating location preference:', error);
      Alert.alert('Error', 'Failed to update location preference');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={24} color="#1e3a8a" />
            <Text style={styles.infoText}>{profileData.email || 'No email'}</Text>
          </View>
          {profileData.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={24} color="#1e3a8a" />
              <Text style={styles.infoText}>{profileData.phone}</Text>
            </View>
          )}
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={24} color="#1e3a8a" />
            <Text style={styles.infoText}>{profileData.name || 'Not set'}</Text>
          </View>
        </View>

        {/* Skills Section */}
        {renderSkills()}

        {/* Selected Jobs Section */}
        {renderSelectedJobs()}

        {/* Availability Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => navigation.navigate('Availability')}
            >
              <Ionicons name="calendar-outline" size={24} color="#1e3a8a" />
            </TouchableOpacity>
          </View>
          <View style={styles.bubbleContainer}>
            {formatAvailability().length > 0 ? (
              formatAvailability().map((slot, index) => (
                <View key={index} style={styles.availabilityBubble}>
                  <Text style={styles.bubbleText}>
                    {slot.day}: {slot.time}
                    {slot.repeatType !== 'custom' && ` (${slot.repeatType})`}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No availability set</Text>
            )}
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Location Preferences</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                setTempLocationPreference(profileData.locationPreference);
                setIsLocationModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={24} color="#1e3a8a" />
            </TouchableOpacity>
          </View>
          {profileData.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={24} color="#1e3a8a" />
              <Text style={styles.infoText}>
                Search radius: {(profileData.locationPreference / 1609.34).toFixed(1)} miles
              </Text>
            </View>
          )}
        </View>

        {/* Location Modal */}
        {isLocationModalVisible && (
          <Modal
            isVisible={true}
            onBackdropPress={() => setIsLocationModalVisible(false)}
            style={styles.modal}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Location Radius</Text>
              
              <View style={styles.radiusControl}>
                <Text style={styles.radiusText}>
                  Search Radius: {(tempLocationPreference / 1609.34).toFixed(1)} miles
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1609.34} // 1 mile in meters
                  maximumValue={80467.2} // 50 miles in meters
                  step={1609.34} // 1 mile increments
                  value={tempLocationPreference}
                  onValueChange={setTempLocationPreference}
                  minimumTrackTintColor="#1e3a8a"
                  maximumTrackTintColor="#cbd5e1"
                />
              </View>

              {isWeb && profileData.location && (
                <View style={styles.modalMapContainer}>
                  <WebMap
                    location={profileData.location}
                    radius={tempLocationPreference}
                  />
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsLocationModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveRadius}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4b5563',
  },
  bubbleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubble: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 14,
  },
  availabilityBubble: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  jobCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  jobIndustry: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  smallBubble: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smallBubbleText: {
    color: '#1e3a8a',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    padding: 4,
  },
  noDataText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: Platform.OS === 'web' ? '80%' : '90%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalMapContainer: {
    height: 300,
    marginVertical: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  radiusControl: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  radiusText: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  jobSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  jobSkillText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  skillItem: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: '#333',
  },
});