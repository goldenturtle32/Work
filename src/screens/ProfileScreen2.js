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
  });
  
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [userDoc, attributesDoc] = await Promise.all([
          db.collection('users').doc(currentUser.uid).get(),
          db.collection('user_attributes').doc(currentUser.uid).get(),
        ]);

        if (userDoc.exists && attributesDoc.exists) {
          const userData = userDoc.data();
          const attributesData = attributesDoc.data();

          setProfileData({
            ...userData,
            ...attributesData,
          });
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
        Alert.alert('Error', 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser, route?.params?.availabilityUpdated]);

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
            <Text style={styles.infoText}>{profileData.email}</Text>
          </View>
          {profileData.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={24} color="#1e3a8a" />
              <Text style={styles.infoText}>{profileData.phone}</Text>
            </View>
          )}
        </View>

        {/* Skills Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.bubbleContainer}>
            {profileData.skills.map((skill, index) => (
              <View key={index} style={styles.bubble}>
                <Text style={styles.bubbleText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

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
          <Text style={styles.sectionTitle}>Location Preferences</Text>
          {profileData.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={24} color="#1e3a8a" />
              <Text style={styles.infoText}>
                Search radius: {profileData.searchRadius} miles
              </Text>
            </View>
          )}
        </View>

        {/* Selected Jobs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Jobs</Text>
          {profileData.selectedJobs.map((job, index) => (
            <View key={index} style={styles.jobCard}>
              <Text style={styles.jobTitle}>{job.jobType}</Text>
              <Text style={styles.jobIndustry}>{job.industry}</Text>
              <View style={styles.bubbleContainer}>
                {job.skills.map((skill, skillIndex) => (
                  <View key={skillIndex} style={styles.smallBubble}>
                    <Text style={styles.smallBubbleText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
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
});