import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Modal, FlatList, KeyboardAvoidingView, Keyboard } from 'react-native';
import { db, auth, firebase } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker, PickerItem } from '../components/nativewindui/Picker';
import { BarChart } from 'react-native-chart-kit';
import {
  useFonts,
  Domine_400Regular,
  Domine_700Bold
} from '@expo-google-fonts/domine';
import Job from '../models/Job';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestore, collection, addDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

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

  // Availability editing
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [editingAvailabilityData, setEditingAvailabilityData] = useState({
    day: '',
    repeatType: 'weekly',
    slots: [{ startTime: '', endTime: '' }]
  });

  // Basic job data
  const [editingJobData, setEditingJobData] = useState({
    industry: '',
    jobTitle: '',
    jobType: '',
    requiredSkills: [],
    requiredExperience: { minYears: 0, preferredYears: 0 }
  });

  // For "employer" role
  const [jobAttributes, setJobAttributes] = useState({
    jobTitle: '',
    companyName: '',
    industry: '',
    requiredSkills: []
  });
  const [employerJobs, setEmployerJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);

  // For dropdown
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);

  // For new availability time
  const [selectedDay, setSelectedDay] = useState(null);
  const [newTimeSlot, setNewTimeSlot] = useState({ startTime: '', endTime: '' });

  // Pay range editing
  const [isEditingPayRange, setIsEditingPayRange] = useState(false);
  const [editingPayData, setEditingPayData] = useState({
    estPayRangeMin: '',
    estPayRangeMax: '',
    includesTips: false,
    estTipRangeMin: '',
    estTipRangeMax: ''
  });

  // Time picker states
  // showPickerModal.show -> controls if time picker is open
  // showPickerModal.field -> "startTime" or "endTime"
  const [showPickerModal, setShowPickerModal] = useState({ show: false, field: '' });

  // Instead of storing the selectedTime in state, use a ref
  // so scrolling on iOS doesn't re-render the entire screen each time
  const timeRef = useRef(new Date());

  const [isJobOverview, setIsJobOverview] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userRole = userDoc.data()?.role;
        const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
        
        const [userData, attributesDoc] = await Promise.all([
          userDoc,
          db.collection(collectionName).doc(currentUser.uid).get()
        ]);

        if (userData.exists && attributesDoc.exists) {
          const combinedData = {
            ...userData.data(),
            ...attributesDoc.data(),
            skills: userRole === 'employer' ? attributesDoc.data().skills : attributesDoc.data().skills
          };
          
          setProfileData(combinedData);

          // Handle location display
          if (combinedData.cityName && combinedData.stateCode) {
            setLocationDisplay(`${combinedData.cityName}, ${combinedData.stateCode}`);
          } else if (combinedData.location) {
            // Reverse geocode
            try {
              const response = await fetch(
                `http://127.0.0.1:5000/reverse-geocode?lat=${combinedData.location.latitude}&lng=${combinedData.location.longitude}`
              );
              const data = await response.json();
              
              if (data.success && data.city && data.state) {
                setLocationDisplay(`${data.city}, ${data.state}`);

                // Update user_attributes with city/state
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

  useEffect(() => {
    const fetchEmployerJobs = async () => {
      try {
        const jobsSnapshot = await db
          .collection('job_attributes')
          .where('email', '==', currentUser.email)
          .get();

        const jobs = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setEmployerJobs(jobs);
        setSelectedJobId(currentUser.uid);
      } catch (error) {
        console.error('Error fetching employer jobs:', error);
      }
    };

    if (profileData.role === 'employer') {
      fetchEmployerJobs();
    }
  }, [currentUser.email, profileData.role]);

  useEffect(() => {
    const loadStoredJobId = async () => {
      try {
        const storedJobId = await AsyncStorage.getItem('currentJobId');
        if (storedJobId) {
          handleProfileSwitch(storedJobId);
        }
      } catch (error) {
        console.error('Error loading stored job ID:', error);
      }
    };

    loadStoredJobId();
  }, []);

  const fetchWorkerStats = async () => {
    try {
      const matchesSnapshot = await db
        .collection('matches')
        .where('workerId', '==', currentUser.uid)
        .where('accepted', '==', 1)
        .get();

      const activeJobs = matchesSnapshot.size;
      let totalWeeklyEarnings = 0;

      matchesSnapshot.forEach(() => {
        // Real logic would go here, for now a placeholder:
        totalWeeklyEarnings += 500; 
      });

      setMatchStats({
        activeJobs,
        weeklyEarnings: totalWeeklyEarnings
      });
    } catch (error) {
      console.error('Error fetching worker stats:', error);
    }
  };

  const fetchEmployerStats = async () => {
    try {
      const prefsSnapshot = await db
        .collection('user_job_preferences')
        .where('swipedUserId', '==', currentUser.uid)
        .get();

      const totalSwipes = prefsSnapshot.size;
      const rightSwipes = prefsSnapshot.docs.filter(doc => doc.data().interested).length;

      setEmployerStats({
        totalSwipes,
        rightSwipes,
        potentialApplicants: rightSwipes,       
        interviewsScheduled: Math.floor(rightSwipes * 0.3) 
      });
    } catch (error) {
      console.error('Error fetching employer stats:', error);
    }
  };

  const handleUpdateOverview = async () => {
    try {
      console.log('Updating overview:', { // Debug logs
        isJobOverview,
        role: profileData.role,
        docId: selectedJobId || currentUser.uid,
        newOverview: editedOverview
      });

      if (isJobOverview && profileData.role === 'employer') {
        const docId = selectedJobId || currentUser.uid;
        await db.collection('job_attributes').doc(docId).update({
          job_overview: editedOverview
        });
        
        setProfileData(prev => ({
          ...prev,
          job_overview: editedOverview
        }));
        Alert.alert('Success', 'Job Overview updated successfully');
        setIsEditingOverview(false);
        setIsJobOverview(false);
      } else if (!isJobOverview) {
        // Existing About Me update code
        const userRole = profileData.role;
        const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';

        await Promise.all([
          db.collection('users').doc(currentUser.uid).update({
            user_overview: editedOverview
          }),
          db.collection(collectionName).doc(currentUser.uid).update({
            user_overview: editedOverview
          })
        ]);
        
        setProfileData(prev => ({
          ...prev,
          user_overview: editedOverview
        }));
        Alert.alert('Success', 'About Me updated successfully');
        setIsEditingOverview(false);
      }
    } catch (error) {
      console.error('Error updating overview:', error);
      Alert.alert('Error', 'Failed to update overview');
    }
  };

  const handleEditJob = async (jobData) => {
    try {
      const userRole = profileData.role;
      const collectionName = userRole === 'employer'
        ? 'job_attributes'
        : 'user_attributes';
      
      if (userRole === 'employer') {
        await db
          .collection(collectionName)
          .doc(currentUser.uid)
          .update({
            industryPrefs: [jobData.industry],
            jobTypePrefs: jobData.jobType,
            jobTitle: jobData.jobTitle,
            requiredSkills: jobData.requiredSkills,
            requiredExperience: jobData.requiredExperience
          });
      } else {
        // For worker, update selectedJobs array
        const updatedJobs = [...(profileData.selectedJobs || [])];
        if (jobData.index !== undefined) {
          updatedJobs[jobData.index] = jobData;
        } else if (updatedJobs.length < 3) {
          updatedJobs.push(jobData);
        }

        await db
          .collection(collectionName)
          .doc(currentUser.uid)
          .update({
            selectedJobs: updatedJobs
          });
      }

      const updatedDoc = await db
        .collection(collectionName)
        .doc(currentUser.uid)
        .get();

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
      await db
        .collection('user_attributes')
        .doc(currentUser.uid)
        .update({
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
      const collectionName = userRole === 'employer'
        ? 'job_attributes'
        : 'user_attributes';
      
      const updatedAvailability = {
        ...profileData.availability,
        [availabilityData.day]: {
          repeatType: availabilityData.repeatType,
          slots: availabilityData.slots
        }
      };

      await db
        .collection(collectionName)
        .doc(currentUser.uid)
        .update({
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

      // Filter out the deleted slot
      const updatedSlots = profileData.availability[day].slots.filter((_, idx) => idx !== slotIndex);

      // Copy the entire availability object
      let updatedAvailability = { ...profileData.availability };

      // If no slots remain, remove the day key completely
      if (updatedSlots.length === 0) {
        const { [day]: _, ...remaining } = updatedAvailability;
        updatedAvailability = remaining;
      } else {
        // Otherwise, just update this day's slots
        updatedAvailability[day] = {
          ...updatedAvailability[day],
          slots: updatedSlots
        };
      }

      // Save updatedAvailability back to Firestore
      await db.collection(collectionName).doc(currentUser.uid).update({
        availability: updatedAvailability
      });

      // Also update local state so UI refreshes
      setProfileData(prev => ({
        ...prev,
        availability: updatedAvailability
      }));
    } catch (error) {
      console.error('Error deleting availability slot:', error);
      Alert.alert('Error', 'Failed to delete availability slot');
    }
  };

  const handlePostNewJob = async () => {
    try {
      const newJobRef = await addDoc(collection(db, 'job_attributes'), {
        id: '',
        email: profileData.email,
        role: 'employer',
        setupComplete: false,
        createdAt: new Date(),
        companyName: jobAttributes.companyName || '',
        industry: '',
        jobTitle: '',
        requiredSkills: [],
        cityName: profileData.cityName || '',
        stateCode: profileData.stateCode || '',
        location: profileData.location || null
      });

      await setDoc(doc(db, 'job_attributes', newJobRef.id), {
        id: newJobRef.id
      }, { merge: true });

      navigation.navigate('BasicInfo', {
        userId: newJobRef.id,
        role: 'employer',
        isNewJob: true,
        parentJobId: currentUser.uid
      });
    } catch (error) {
      console.error('Error creating new job:', error);
      Alert.alert('Error', 'Failed to create new job posting');
    }
  };

  const handleProfileSwitch = async (newJobId) => {
    try {
      setSelectedJobId(newJobId);
      await AsyncStorage.setItem('currentJobId', newJobId);
      
      const jobDoc = await db.collection('job_attributes').doc(newJobId).get();
      if (jobDoc.exists) {
        const jobData = jobDoc.data();
        setProfileData(prev => ({
          ...prev,
          ...jobData
        }));
        
        setJobAttributes({
          jobTitle: jobData.jobTitle || '',
          companyName: jobData.companyName || '',
          industry: jobData.industry || '',
          requiredSkills: jobData.requiredSkills || []
        });

        await fetchEmployerStats();
      }
    } catch (error) {
      console.error('Error switching profiles:', error);
      Alert.alert('Error', 'Failed to switch profiles. Please try again.');
    }
  };

  /**
   * Called to open the time picker sub-modal (bottom-sheet on iOS / native on Android).
   */
  const openTimePickerModal = (field) => {
    setShowPickerModal({ show: true, field });

    // Convert existing "HH:MM" to a Date if it exists
    const existingValue = newTimeSlot[field];
    if (existingValue) {
      const [hh, mm] = existingValue.split(':').map(Number);
      const newDate = new Date();
      newDate.setHours(hh || 0, mm || 0);
      timeRef.current = newDate;
    } else {
      // If no existing time, default to "now"
      timeRef.current = new Date();
    }
  };

  /**
   * handleTimeChange():
   * - iOS => store the scrolling time in the ref (no state => no re-render).
   * - Android => if user hits "OK," finalize immediately, then close.
   */
  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedTime) {
        finalizeTimeSelection(selectedTime);
      }
      // Always close the native Android picker after user action
      setShowPickerModal({ show: false, field: '' });
    } else {
      // iOS => store the time in a ref so we don't re-render on each scroll
      if (selectedTime) {
        timeRef.current = selectedTime;
      }
    }
  };

  /**
   * finalizeTimeSelection():
   * Convert the JS Date to "HH:MM" and update newTimeSlot state.
   */
  const finalizeTimeSelection = (dateObj) => {
    if (!dateObj) return;
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    setNewTimeSlot((prev) => ({
      ...prev,
      [showPickerModal.field]: `${hours}:${minutes}`
    }));
  };

  /**
   * iOS only: onPressDoneIOS() is the "Done" button in the bottom sheet.
   * We finalize the time from our ref, then close the sub-modal.
   */
  const onPressDoneIOS = () => {
    finalizeTimeSelection(timeRef.current);
    setShowPickerModal({ show: false, field: '' });
  };

  /**
   * handleSaveAvailability():
   * Called after selecting day + start/end times to save to Firestore (example).
   * Updated to call handleEditAvailability() so the new slot is persisted in Firebase.
   */
  const handleSaveAvailability = async () => {
    if (!newTimeSlot.startTime || !newTimeSlot.endTime) {
      Alert.alert('Error', 'Please select both start and end times first');
      return;
    }
    
    try {
      // 1) Grab existing slots for the selectedDay
      const existingSlots = profileData.availability[selectedDay]?.slots ?? [];

      // 2) Append the newly chosen start/end times
      const mergedSlots = [...existingSlots, newTimeSlot];

      // 3) Invoke handleEditAvailability with updated day + slots
      await handleEditAvailability({
        day: selectedDay,
        repeatType: 'weekly',
        slots: mergedSlots
      });

      // 4) Close the modal and reset local states
      setIsEditingAvailability(false);
      setSelectedDay(null);
      setNewTimeSlot({ startTime: '', endTime: '' });
      Alert.alert('Success', 'Time slot updated in Firebase!');
    } catch (error) {
      console.error('Error saving new availability slot:', error);
      Alert.alert('Error', 'Failed to save new time slot');
    }
  };

  /**
   * AvailabilityEditModal:
   * Outer modal for picking day + times. 
   * We embed the iOS time picker as a sub-modal if needed.
   */
  const AvailabilityEditModal = () => {
    // Add local state for availability data
    const [localAvailabilityData, setLocalAvailabilityData] = useState({
      day: '',
      repeatType: 'weekly',
      slots: []
    });

    // Initialize local state when modal opens
    useEffect(() => {
      if (isEditingAvailability) {
        setLocalAvailabilityData({
          day: editingAvailabilityData.day || '',
          repeatType: editingAvailabilityData.repeatType || 'weekly',
          slots: editingAvailabilityData.slots || []
        });
      }
    }, [isEditingAvailability, editingAvailabilityData]);

    if (!isEditingAvailability) return null;
    
    return (
      <Modal
        visible={isEditingAvailability}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setIsEditingAvailability(false);
          setSelectedDay(null);
          setNewTimeSlot({ startTime: '', endTime: '' });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {!selectedDay ? (
              <>
                <Text style={styles.modalTitle}>Select Day</Text>
                <View style={styles.daysContainer}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        profileData.availability[day]?.slots && styles.availableDayButton
                      ]}
                      onPress={() => {
                        setSelectedDay(day);
                        setLocalAvailabilityData(prev => ({
                          ...prev,
                          day: day,
                          slots: profileData.availability[day]?.slots || []
                        }));
                      }}
                    >
                      <Text style={styles.dayButtonText}>{day}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add Time Slot for {selectedDay}</Text>
                <View style={styles.timeContainer}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePickerModal('startTime')}
                  >
                    <Text style={styles.timeButtonValue}>
                      {newTimeSlot.startTime || 'Select Start Time'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePickerModal('endTime')}
                  >
                    <Text style={styles.timeButtonValue}>
                      {newTimeSlot.endTime || 'Select End Time'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditingAvailability(false);
                  setSelectedDay(null);
                  setNewTimeSlot({ startTime: '', endTime: '' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={async () => {
                  if (!newTimeSlot.startTime || !newTimeSlot.endTime) {
                    Alert.alert('Error', 'Please select both start and end times first');
                    return;
                  }

                  try {
                    // Update local state first
                    const updatedSlots = [...localAvailabilityData.slots, newTimeSlot];
                    setLocalAvailabilityData(prev => ({
                      ...prev,
                      slots: updatedSlots
                    }));

                    // Then update Firebase and parent state
                    await handleEditAvailability({
                      day: selectedDay,
                      repeatType: 'weekly',
                      slots: updatedSlots
                    });

                    // Reset form
                    setIsEditingAvailability(false);
                    setSelectedDay(null);
                    setNewTimeSlot({ startTime: '', endTime: '' });
                  } catch (error) {
                    console.error('Error saving new availability slot:', error);
                    Alert.alert('Error', 'Failed to save new time slot');
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* iOS bottom-sheet (sub-modal) for time picking */}
          {showPickerModal.show && Platform.OS === 'ios' && (
            <Modal transparent animationType="slide">
              <View style={styles.iosPickerContainer}>
                <View style={styles.iosBottomSheet}>
                  <View style={styles.iosPickerHeader}>
                    <Text style={styles.iosPickerTitle}>
                      {showPickerModal.field === 'startTime'
                        ? 'Select Start Time'
                        : 'Select End Time'}
                    </Text>
                    <TouchableOpacity onPress={onPressDoneIOS}>
                      <Text style={styles.iosPickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    mode="time"
                    display="spinner"
                    value={timeRef.current}
                    onChange={handleTimeChange}
                    textColor="#000"    // ensure spinner text is black on iOS
                    themeVariant="light" // keep it bright
                    style={styles.iosTimePicker}
                  />
                </View>
              </View>
            </Modal>
          )}

          {/* Android inline picker (shows immediately once opened) */}
          {showPickerModal.show && Platform.OS === 'android' && (
            <DateTimePicker
              mode="time"
              display="spinner"
              value={timeRef.current}
              onChange={handleTimeChange}
              is24Hour={true}
            />
          )}
        </View>
      </Modal>
    );
  };

  /**
   * Worker profile layout
   */
  const renderWorkerProfile = () => {
    const organizeAvailabilityByDay = () => {
      if (!profileData?.availability) return {};
      return profileData.availability;
    };
    const availabilityData = organizeAvailabilityByDay();

    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.name}>
              {profileData?.name || 'Name not set'}
            </Text>
            <Text style={styles.email}>
              {profileData?.email || 'Email not set'}
            </Text>
            <Text style={styles.location}>{locationDisplay}</Text>

            {/* Stats Grid (placeholders for now) */}
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Selected Jobs</Text>
              {profileData?.selectedJobs?.length < 3 && (
                <TouchableOpacity
                  onPress={() => {
                    setEditingJobData({
                      industry: '',
                      title: '',
                      skills: []
                    });
                    setIsEditingJob(true);
                  }}
                  style={styles.addJobButton}
                >
                  <Ionicons name="add-circle" size={24} color="#10b981" />
                </TouchableOpacity>
              )}
            </View>
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
                      setEditingJobData({
                        ...job,
                        index
                      });
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
                  setIsJobOverview(false);
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
          </View>

          {/* LOCATION PREFERENCES (ONLY FOR WORKERS) */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Location Preferences</Text>
            
            <View style={styles.locationCard}>
              <Text style={styles.locationInfo}>
                Current Search Radius: {((profileData.locationPreference || 16093.4) / 1609.34).toFixed(1)} miles
              </Text>
              
              <Slider
                style={styles.slider}
                minimumValue={1609.34}   // ~1 mile
                maximumValue={80467.2}    // ~50 miles
                step={1609.34}            // increments of ~1 mile
                value={profileData.locationPreference || 16093.4}
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#94a3b8"
                onValueChange={async (value) => {
                  // Update local state so UI sees the new radius immediately
                  setProfileData(prev => ({ ...prev, locationPreference: value }));

                  // Also push it to Firestore
                  try {
                    const userRole = profileData.role;
                    const collectionName = userRole === 'employer'
                      ? 'job_attributes'
                      : 'user_attributes';
                    await db.collection(collectionName).doc(currentUser.uid).update({
                      locationPreference: value,
                      updatedAt: new Date()
                    });
                  } catch (error) {
                    console.error('Error updating locationPreference:', error);
                  }
                }}
              />
            </View>
          </View>

          {/* Availability Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Weekly Availability</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingAvailabilityData({
                    day: '',
                    slots: []
                  });
                  setIsEditingAvailability(true);
                }}
                style={styles.addJobButton}
              >
                <Ionicons name="add-circle" size={24} color="#10b981" />
              </TouchableOpacity>
            </View>
            
            {Object.entries(availabilityData).map(([day, dayData]) => (
              <View key={day} style={styles.dayContainer}>
                <View style={[
                  styles.dayChip,
                  dayData.slots?.length > 0
                    ? styles.dayChipAvailable
                    : styles.dayChipUnavailable
                ]}>
                  <Text style={[
                    styles.dayText,
                    dayData.slots?.length > 0
                      ? styles.dayTextAvailable
                      : styles.dayTextUnavailable
                  ]}>
                    {day}
                  </Text>
                </View>
                <View style={styles.timeSlotsContainer}>
                  {dayData.slots?.map((slot, slotIndex) => (
                    <View key={slotIndex} style={styles.timeSlotRow}>
                      <Text style={styles.timeSlot}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteAvailability(day, slotIndex)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingAvailabilityData({
                      day: day,
                      slots: dayData.slots || []
                    });
                    setIsEditingAvailability(true);
                  }}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil" size={20} color="#2563eb" />
                </TouchableOpacity>
              </View>
            ))}
            {(!profileData.availability ||
              Object.keys(profileData.availability).length === 0) && (
              <Text style={styles.noSkillsText}>No availability set</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  /**
   * Employer profile layout
   */
  const renderEmployerProfile = () => (
    <ScrollView style={styles.container}>
      {/* Job switching for multiple job postings */}
      {employerJobs.length > 1 && (
        <View style={styles.jobSelectorContainer}>
          <TouchableOpacity
            style={styles.jobSelectorTrigger}
            onPress={() => setIsJobSelectorOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.jobSelectorContent}>
              <Ionicons name="business-outline" size={16} color="#2563eb" />
              <Text style={styles.jobSelectorText}>
                {
                  employerJobs.find(job => job.id === selectedJobId)?.jobTitle
                  || 'Select a job listing'
                }
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          <Modal
            visible={isJobSelectorOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsJobSelectorOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setIsJobSelectorOpen(false)}
            >
              <View style={styles.jobSelectorDropdown}>
                <FlatList
                  data={employerJobs}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.jobSelectorItem,
                        selectedJobId === item.id &&
                        styles.jobSelectorItemSelected
                      ]}
                      onPress={() => {
                        handleProfileSwitch(item.id);
                        setIsJobSelectorOpen(false);
                      }}
                    >
                      <View style={styles.jobSelectorItemInner}>
                        <View style={styles.jobTitleRow}>
                          <Ionicons name="business-outline" size={16} color="#2563eb" />
                          <Text style={styles.jobTitle}>
                            {item.jobTitle || 'Untitled'}
                          </Text>
                        </View>
                        <Text style={styles.jobDepartment}>
                          {item.department || item.companyName || 'Company'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      <View style={[styles.actionButtonsContainer, { paddingHorizontal: 20, paddingVertical: 4 }]}>
        <TouchableOpacity
          style={styles.postJobButton}
          onPress={handlePostNewJob}
        >
          <View style={styles.postJobButtonContent}>
            <Ionicons name="briefcase-outline" size={24} color="#1e3a8a" />
            <Text style={styles.postJobButtonText}>Post New Job</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.name}>
            {jobAttributes.jobTitle && jobAttributes.companyName
              ? `${jobAttributes.jobTitle} at ${jobAttributes.companyName}`
              : 'Position not set'
            }
          </Text>
          <Text style={styles.location}>{locationDisplay}</Text>
          
          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {employerStats?.totalSwipes || 0}
              </Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {employerStats?.rightSwipes || 0}
              </Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {employerStats?.interviewsScheduled || 0}
              </Text>
              <Text style={styles.statLabel}>Interviews</Text>
            </View>
          </View>
        </View>

        {/* Pay Range Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Pay Range</Text>
            <TouchableOpacity
              onPress={() => {
                setEditingPayData({
                  estPayRangeMin: profileData.estPayRangeMin,
                  estPayRangeMax: profileData.estPayRangeMax,
                  includesTips: profileData.includesTips,
                  estTipRangeMin: profileData.estTipRangeMin,
                  estTipRangeMax: profileData.estTipRangeMax
                });
                setIsEditingPayRange(true);
              }}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.payRangeCard}>
            <View style={styles.payRangeRow}>
              <Text style={styles.payRangeLabel}>Base Pay:</Text>
              <Text style={styles.payRangeValue}>
                $
                {profileData.estPayRangeMin || '0'}
                {' - $'}
                {profileData.estPayRangeMax || '0'}/hr
              </Text>
            </View>

            {profileData.includesTips && (
              <View style={styles.payRangeRow}>
                <Text style={styles.payRangeLabel}>Est. Tips:</Text>
                <Text style={styles.payRangeValue}>
                  $
                  {profileData.estTipRangeMin || '0'}
                  {' - $'}
                  {profileData.estTipRangeMax || '0'}/hr
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Job Overview Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Job Overview</Text>
            {profileData.role === 'employer' && (
              <TouchableOpacity
                onPress={() => {
                  console.log('Edit button pressed'); // Debug log
                  console.log('Current role:', profileData.role); // Debug log
                  console.log('Current overview:', profileData.job_overview); // Debug log
                  setIsJobOverview(true);
                  setEditedOverview(profileData.job_overview || '');
                  setIsEditingOverview(true);
                }}
                style={styles.editButton}
              >
                <Ionicons name="pencil" size={20} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.overviewText}>
            {profileData.job_overview || 'No job overview provided'}
          </Text>
        </View>

        {/* Job Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.jobCard}>
            <View style={styles.jobCardHeader}>
              <View>
                <View style={styles.industryBadge}>
                  <Text style={styles.industryBadgeText}>
                    {jobAttributes.industry}
                  </Text>
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

        {/* Employer Required Availability */}
        {profileData?.availability &&
         Object.keys(profileData.availability).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required Availability</Text>
            <View style={styles.availabilityContainer}>
              {Object.entries(profileData.availability).map(([day, dayData]) => (
                <View key={day} style={styles.dayContainer}>
                  <View style={[
                    styles.dayChip,
                    dayData.slots?.length > 0
                      ? styles.dayChipAvailable
                      : styles.dayChipUnavailable
                  ]}>
                    <Text style={[
                      styles.dayText,
                      dayData.slots?.length > 0
                        ? styles.dayTextAvailable
                        : styles.dayTextUnavailable
                    ]}>
                      {day}
                    </Text>
                  </View>
                  <View style={styles.timeSlotsContainer}>
                    {dayData.slots?.map((slot, slotIndex) => (
                      <View key={slotIndex} style={styles.timeSlotRow}>
                        <Text style={styles.timeSlot}>
                          {slot.startTime} - {slot.endTime}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteAvailability(day, slotIndex)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingAvailabilityData({
                        day: day,
                        slots: dayData.slots || []
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

  /**
   * Modal to edit job details (shared for worker/employer, but mostly used by employer)
   */
  const JobEditModal = () => {
    // Add local state for job data, similar to PayRangeEditModal
    const [localJobData, setLocalJobData] = useState({
      industry: '',
      jobTitle: '',
      companyName: '',
      requiredSkills: []
    });

    // Initialize local state when modal opens
    useEffect(() => {
      if (isEditingJob) {
        setLocalJobData({
          industry: editingJobData.industry || '',
          jobTitle: editingJobData.jobTitle || '',
          companyName: editingJobData.companyName || '',
          requiredSkills: editingJobData.requiredSkills || []
        });
      }
    }, [isEditingJob, editingJobData]);

    return (
      <Modal visible={isEditingJob} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Job Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Industry</Text>
              <TextInput
                style={styles.input}
                placeholder="Select Industry"
                value={localJobData.industry}
                onFocus={() => setShowIndustryDropdown(true)}
                onChangeText={(text) => setLocalJobData(prev => ({ ...prev, industry: text }))}
              />
              {showIndustryDropdown && (
                <View style={styles.dropdown}>
                  {Job.industries?.map((industry) => (
                    <TouchableOpacity
                      key={industry}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setLocalJobData(prev => ({ ...prev, industry }));
                        setShowIndustryDropdown(false);
                      }}
                    >
                      <Text>{industry}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Job Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Job Title"
                value={localJobData.jobTitle}
                onChangeText={(text) => setLocalJobData(prev => ({ ...prev, jobTitle: text }))}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Company Name"
                value={localJobData.companyName}
                onChangeText={(text) => setLocalJobData(prev => ({ ...prev, companyName: text }))}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Required Skills</Text>
              {localJobData.requiredSkills?.map((skill, index) => (
                <View key={index} style={styles.skillInputRow}>
                  <TextInput
                    style={styles.skillInput}
                    placeholder="Skill name"
                    value={skill.name}
                    onChangeText={(text) => {
                      const newSkills = [...localJobData.requiredSkills];
                      newSkills[index] = { ...skill, name: text };
                      setLocalJobData(prev => ({ ...prev, requiredSkills: newSkills }));
                    }}
                  />
                  <TextInput
                    style={styles.yearsInput}
                    placeholder="Years"
                    keyboardType="numeric"
                    value={skill.yearsOfExperience?.toString()}
                    onChangeText={(text) => {
                      const newSkills = [...localJobData.requiredSkills];
                      newSkills[index] = {
                        ...skill,
                        yearsOfExperience: parseInt(text) || 0
                      };
                      setLocalJobData(prev => ({ ...prev, requiredSkills: newSkills }));
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const newSkills = [...localJobData.requiredSkills];
                      newSkills.splice(index, 1);
                      setLocalJobData(prev => ({ ...prev, requiredSkills: newSkills }));
                    }}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {localJobData.requiredSkills?.length < 5 && (
                <TouchableOpacity
                  style={styles.addSkillButton}
                  onPress={() => {
                    setLocalJobData(prev => ({
                      ...prev,
                      requiredSkills: [
                        ...(prev.requiredSkills || []),
                        { name: '', yearsOfExperience: 0 }
                      ]
                    }));
                  }}
                >
                  <Text style={styles.addSkillButtonText}>Add Skill</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditingJob(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={async () => {
                  try {
                    await db
                      .collection('job_attributes')
                      .doc(auth.currentUser.uid)
                      .update({
                        industry: localJobData.industry,
                        jobTitle: localJobData.jobTitle,
                        companyName: localJobData.companyName,
                        requiredSkills: localJobData.requiredSkills,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                      });
                    
                    setJobAttributes(prev => ({
                      ...prev,
                      ...localJobData
                    }));
                    setIsEditingJob(false);
                  } catch (error) {
                    console.error('Error updating job:', error);
                    Alert.alert('Error', 'Failed to update job details. Please try again.');
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  /**
   * Modal to edit pay range (employer only)
   */
  const PayRangeEditModal = () => {
    const [localPayData, setLocalPayData] = useState({
      estPayRangeMin: '',
      estPayRangeMax: '',
      includesTips: false,
      estTipRangeMin: '',
      estTipRangeMax: ''
    });

    useEffect(() => {
      if (isEditingPayRange) {
        setLocalPayData({
          estPayRangeMin: profileData.estPayRangeMin || '',
          estPayRangeMax: profileData.estPayRangeMax || '',
          includesTips: profileData.includesTips || false,
          estTipRangeMin: profileData.estTipRangeMin || '',
          estTipRangeMax: profileData.estTipRangeMax || ''
        });
      }
    }, [isEditingPayRange]);

    return (
      <Modal
        visible={isEditingPayRange}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsEditingPayRange(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Pay Range</Text>
            
            {/* Base Pay */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Base Pay Range ($/hr)</Text>
              <View style={styles.payRangeInputContainer}>
                <TextInput
                  style={[styles.input, styles.payInput]}
                  placeholder="Min"
                  keyboardType="decimal-pad"
                  value={localPayData.estPayRangeMin}
                  onChangeText={text => setLocalPayData(prev => ({
                    ...prev,
                    estPayRangeMin: text
                  }))}
                />
                <Text style={styles.payRangeSeparator}>to</Text>
                <TextInput
                  style={[styles.input, styles.payInput]}
                  placeholder="Max"
                  keyboardType="decimal-pad"
                  value={localPayData.estPayRangeMax}
                  onChangeText={text => setLocalPayData(prev => ({
                    ...prev,
                    estPayRangeMax: text
                  }))}
                />
              </View>
            </View>

            {/* Include Tips */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Include Tips?</Text>
              <View style={styles.tipsButtonContainer}>
                {['Yes', 'No'].map(option => {
                  const isActive = (option === 'Yes') === localPayData.includesTips;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.tipsButton,
                        isActive && styles.tipsButtonActive
                      ]}
                      onPress={() => {
                        setLocalPayData(prev => ({
                          ...prev,
                          includesTips: option === 'Yes'
                        }));
                      }}
                    >
                      <Text
                        style={[
                          styles.tipsButtonText,
                          isActive && styles.tipsButtonTextActive
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Tip Range */}
            {localPayData.includesTips && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tip Range ($/hr)</Text>
                <View style={styles.payRangeInputContainer}>
                  <TextInput
                    style={[styles.input, styles.payInput]}
                    placeholder="Min"
                    keyboardType="decimal-pad"
                    value={localPayData.estTipRangeMin}
                    onChangeText={text => setLocalPayData(prev => ({
                      ...prev,
                      estTipRangeMin: text
                    }))}
                  />
                  <Text style={styles.payRangeSeparator}>to</Text>
                  <TextInput
                    style={[styles.input, styles.payInput]}
                    placeholder="Max"
                    keyboardType="decimal-pad"
                    value={localPayData.estTipRangeMax}
                    onChangeText={text => setLocalPayData(prev => ({
                      ...prev,
                      estTipRangeMax: text
                    }))}
                  />
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditingPayRange(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={async () => {
                  try {
                    await db
                      .collection('job_attributes')
                      .doc(auth.currentUser.uid)
                      .update({
                        estPayRangeMin: localPayData.estPayRangeMin,
                        estPayRangeMax: localPayData.estPayRangeMax,
                        includesTips: localPayData.includesTips,
                        estTipRangeMin: localPayData.includesTips
                          ? localPayData.estTipRangeMin
                          : '',
                        estTipRangeMax: localPayData.includesTips
                          ? localPayData.estTipRangeMax
                          : ''
                      });

                    // Update parent's profileData just once
                    setProfileData(prev => ({
                      ...prev,
                      ...localPayData
                    }));
                    setIsEditingPayRange(false);

                  } catch (error) {
                    console.log('Error updating pay range:', error);
                    Alert.alert(
                      'Error',
                      'Failed to update pay range. Please try again.'
                    );
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            color="#1e3a8a" 
            style={{ transform: [{ scale: 1.4 }] }}
          />
        </View>
      ) : profileData.role === 'worker' ? (
        renderWorkerProfile()
      ) : (
        renderEmployerProfile()
      )}

      {/* All shared or role-specific modals */}
      <JobEditModal />
      <PayRangeEditModal />
      <AvailabilityEditModal />

      {/* Job Overview Modal */}
      <Modal
        visible={isEditingOverview}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isJobOverview ? 'Edit Job Overview' : 'Edit About Me'}
            </Text>
            <TextInput
              style={styles.overviewInput}
              multiline
              value={editedOverview}
              onChangeText={setEditedOverview}
              placeholder={isJobOverview ? 
                "Describe the job position..." : 
                "Write something about yourself..."}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditingOverview(false);
                  setIsJobOverview(false);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateOverview}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    margin: 16
  },
  headerSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  name: {
    fontSize: 20,
    fontWeight: '700'
  },
  location: {
    fontSize: 14,
    color: '#4b5563'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 24,
    width: '100%'
  },
  statsCard: {
    width: '48%',
    marginBottom: 16
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
    elevation: 2
  },
  statsIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  statsLabel: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 4
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 4
  },
  email: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4
  },
  section: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 16
  },
  addJobButton: {
    padding: 8
  },
  overviewText: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 24
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
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  overviewInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    height: 150,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    marginBottom: 16
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  industryBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start'
  },
  industryBadgeText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500'
  },
  jobCardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1f2937'
  },
  skillBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16
  },
  skillBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  skillBadgeText: {
    color: '#2563eb',
    fontSize: 14
  },
  editButton: {
    padding: 8
  },
  timeSlotsContainer: {
    flex: 1,
    marginLeft: 12
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  timeSlot: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500'
  },
  removeButton: {
    padding: 4
  },
  noSkillsText: {
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8
  },
  dayContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    width: '100%'
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 56,
    alignItems: 'center'
  },
  dayChipAvailable: {
    backgroundColor: '#dcfce7'
  },
  dayChipUnavailable: {
    backgroundColor: '#fee2e2'
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500'
  },
  dayTextAvailable: {
    color: '#166534'
  },
  dayTextUnavailable: {
    color: '#991b1b'
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20
  },
  dayButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    minWidth: 100,
  },
  availableDayButton: {
    borderColor: '#4CAF50',
  },
  dayButtonText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#1e3a8a',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000' // explicitly black
  },
  inputContainer: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  skillInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  skillInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12
  },
  yearsInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12
  },
  addSkillButton: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  addSkillButtonText: {
    color: '#2563eb',
    fontWeight: '500'
  },
  jobSelectorContainer: {
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  jobSelectorTrigger: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  jobSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  jobSelectorText: {
    fontSize: 15,
    color: '#1e293b',
    marginLeft: 8,
    fontWeight: '500'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    paddingTop: 80
  },
  jobSelectorDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxHeight: 400,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  jobSelectorItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  jobSelectorItemSelected: {
    backgroundColor: '#eff6ff'
  },
  jobSelectorItemInner: {
    gap: 4
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  jobTitle: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500'
  },
  jobDepartment: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 24
  },
  payRangeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  payRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  payRangeLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500'
  },
  payRangeValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600'
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    fontWeight: '700',
    fontSize: 18
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280'
  },
  payRangeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  payInput: {
    flex: 1,
    textAlign: 'center'
  },
  payRangeSeparator: {
    color: '#64748b',
    fontWeight: '500'
  },
  tipsButtonContainer: {
    flexDirection: 'row',
    gap: 8
  },
  tipsButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  tipsButtonActive: {
    backgroundColor: '#dcfce7'
  },
  tipsButtonText: {
    color: '#1e3a8a',
    fontWeight: '500'
  },
  tipsButtonTextActive: {
    color: '#166534'
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  timeLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginRight: 8
  },
  iosPickerContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  iosBottomSheet: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 24,
    width: '90%',
    alignSelf: 'center',
    paddingBottom: 20
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12
  },
  iosPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a'
  },
  iosPickerDoneText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600'
  },
  iosTimePicker: {
    backgroundColor: '#fff',
    width: '100%'
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginTop: 8
  },
  locationInfo: {
    fontSize: 14,
    color: '#1e3a8a',
    marginBottom: 12
  },
  slider: {
    width: '100%'
  },
  actionButtonsContainer: {
    width: '100%',  // Make container full width
  },
  postJobButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  postJobButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  postJobButtonText: {
    fontSize: 16,
    color: '#1e3a8a',
    fontWeight: '500'
  },
});