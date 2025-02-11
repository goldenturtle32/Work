import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import firebase from 'firebase/compat/app';
import ProgressStepper from '../components/ProgressStepper';

// First, restore the WebTimePicker component at the top of the file
const WebTimePicker = ({ value, onChange }) => {
  if (Platform.OS !== 'web') return null;

  // Generate time options in 30-minute increments
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  return (
    <select
      value={value || ''}
      onChange={(e) => {
        const [hours, minutes] = e.target.value.split(':');
        const newDate = new Date();
        newDate.setHours(parseInt(hours, 10));
        newDate.setMinutes(parseInt(minutes, 10));
        onChange({ type: 'set', nativeEvent: { timestamp: newDate.getTime() }}, newDate);
      }}
      style={{
        height: 40,
        marginVertical: 10,
        padding: 10,
        borderRadius: 8,
        borderColor: '#d1d5db',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        minWidth: 120,
      }}
    >
      <option value="">Select Time</option>
      {generateTimeOptions().map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
};

// Replace the Calendar import with days of the week constants
const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export default function AvailabilityScreen({ navigation, route }) {
  const isInitialSetup = route.params?.isInitialSetup || false;

  const [user, setUser] = useState(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [showPickerModal, setShowPickerModal] = useState({ show: false, index: null, field: '' });
  const [tempTime, setTempTime] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});
  const [hasAnyAvailability, setHasAnyAvailability] = useState(false);
  const [availability, setAvailability] = useState({});
  const [userRole, setUserRole] = useState(null);

  // Add useEffect to fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
    fetchUserRole();
  }, []);

  // Modify checkAvailability for different collections
  const checkAvailability = useCallback(() => {
    if (!user) return;
    
    const collection = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
    
    db.collection(collection).doc(auth.currentUser.uid).get()
      .then((doc) => {
        if (doc.exists && doc.data().availability) {
          const availabilityData = doc.data().availability;
          setHasAnyAvailability(Object.keys(availabilityData).length > 0);
          setAvailability(availabilityData);
        } else {
          setHasAnyAvailability(false);
          setAvailability({});
        }
      })
      .catch((error) => {
        console.error("Error checking availability:", error);
        setHasAnyAvailability(false);
        setAvailability({});
      });
  }, [user, userRole]);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (user && selectedDay) {
      loadDayAvailability(selectedDay);
    }
  }, [user, selectedDay]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const loadUserData = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        // Load any existing user data if needed
      }
    }
  };

  const loadDayAvailability = async (day) => {
    if (!user) return;
    
    try {
      const userDoc = await db.collection('user_attributes').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().availability && userDoc.data().availability[day]) {
        const dayData = userDoc.data().availability[day];
        setTimeSlots(dayData.slots || []);
      } else {
        setTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading day availability:', error);
      Alert.alert('Error', 'Failed to load availability for this day');
    }
  };

  const handleSaveDay = async () => {
    if (!selectedDay || timeSlots.length === 0) {
      Alert.alert('Error', 'Please select a day and add at least one time slot');
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('No authenticated user found');

      const collection = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      const userDocRef = db.collection(collection).doc(userId);
      const doc = await userDocRef.get();
      const currentData = doc.exists ? doc.data() : {};
      const currentAvailability = currentData.availability || {};

      const updatedAvailability = {
        ...currentAvailability,
        [selectedDay]: {
          slots: timeSlots.filter(slot => slot.startTime && slot.endTime)
        }
      };

      await userDocRef.update({
        availability: updatedAvailability
      });

      setAvailability(updatedAvailability);
      setHasAnyAvailability(true);
      Alert.alert('Success', 'Availability saved successfully');

    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to save availability');
    }
  };

  const handleDayPress = (day) => {
    setSelectedDay(day.dateString);
  };

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { startTime: '', endTime: '' }]);
  };

  const removeTimeSlot = (index) => {
    const updatedSlots = timeSlots.filter((_, i) => i !== index);
    setTimeSlots(updatedSlots);
  };

  const handleTimeChange = (event, selectedTime) => {
    if (event.type === 'set' && selectedTime) {
      const { index, field } = showPickerModal;
      const updatedSlots = [...timeSlots];
      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: selectedTime.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        })
      };
      setTimeSlots(updatedSlots);
      setShowPickerModal({ show: false, index: null, field: '' });
    } else if (event.type === 'dismissed') {
      setShowPickerModal({ show: false, index: null, field: '' });
    }
  };

  const openTimePickerModal = (index, field) => {
    setShowPickerModal({ show: true, index, field });
    const currentTime = timeSlots[index] && timeSlots[index][field]
      ? new Date(`1970-01-01T${timeSlots[index][field]}`)
      : new Date();
    setTempTime(currentTime);
  };

  const handleSaveAvailability = async () => {
    try {
      if (!selectedDay || timeSlots.length === 0 || !areTimeSlotsValid()) {
        Alert.alert('Invalid Input', 'Please select a day and add valid time slots');
        return;
      }

      console.log('Saving availability...');
      const currentAvailability = user?.availability || {};
      const updatedAvailability = {
        ...currentAvailability,
        [selectedDay]: {
          slots: timeSlots,
        },
      };

      // Save to Firestore
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      await userDocRef.update({
        availability: updatedAvailability,
      });

      // If this is initial setup, update user's new status
      if (isInitialSetup) {
        console.log('Updating user status...');
        await db.collection('users').doc(auth.currentUser.uid).update({
          isNewUser: false
        });
      }

      console.log('Successfully saved. Navigating to Home...');
      
      // Use navigation.reset to force navigation to Home
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Home',
            params: { userRole: route.params?.userRole }
          }
        ]
      });

    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to save availability');
    }
  };

  // Add this function to check if time slots are valid
  const areTimeSlotsValid = () => {
    return timeSlots.every(slot => 
      slot.startTime && 
      slot.endTime && 
      slot.startTime < slot.endTime
    );
  };

  // Update the button's disabled state
  const isNextDisabled = !selectedDay || timeSlots.length === 0 || !areTimeSlotsValid();

  const handleComplete = async () => {
    try {
      const userId = auth.currentUser.uid;
      
      if (!hasAnyAvailability) {
        Alert.alert('Missing Availability', 'Please set and save at least one availability slot before completing setup.');
        return;
      }

      const collection = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      
      await Promise.all([
        db.collection('users').doc(userId).update({
          setupComplete: true,
          isNewUser: false,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }),
        db.collection(collection).doc(userId).update({
          availabilityLastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          hasSetInitialAvailability: true
        })
      ]);

      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Main',
          params: { 
            userRole: userRole,
            setupComplete: true
          }
        }]
      });

    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert('Error', 'Failed to complete setup');
    }
  };

  // Add these functions
  const loadAvailability = async () => {
    try {
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      const doc = await userDocRef.get();
      if (doc.exists && doc.data().availability) {
        const availability = doc.data().availability;
        const marked = {};
        Object.keys(availability).forEach(date => {
          marked[date] = { marked: true, dotColor: '#50cebb' };
        });
        setMarkedDates(marked);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  // Add these useEffect hooks
  useEffect(() => {
    loadAvailability();
  }, []);

  useEffect(() => {
    if (selectedDay) {
      loadDayAvailability(selectedDay);
    }
  }, [selectedDay]);

  const handleCompleteSetup = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('No authenticated user found');

      await db.collection('user_attributes').doc(userId).update({
        setup_complete: true
      });

      navigation.navigate('Home');
    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert('Error', 'Failed to complete setup');
    }
  };

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={5} />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Set Your Availability</Text>
          <Text style={styles.subtitle}>
            {userRole === 'employer' 
              ? "Set the hours when you'd like candidates to be available for this position."
              : "We just need to know your schedule now. That way we can find jobs that fit your schedule best!"}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.daysContainer}>
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  selectedDay === day && styles.selectedDayButton,
                  availability[day]?.slots?.length > 0 && styles.availableDayButton
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[
                  styles.dayButtonText,
                  selectedDay === day && styles.selectedDayButtonText
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedDay && (
            <View style={styles.dayContainer}>
              <Text style={styles.dayTitle}>Availability for {selectedDay}</Text>
              {timeSlots.map((slot, index) => (
                <View key={index} style={styles.slotContainer}>
                  <Text style={styles.slotTitle}>Time Slot {index + 1}</Text>
                  <View style={styles.timeContainer}>
                    {Platform.OS === 'web' ? (
                      <>
                        <View style={styles.webTimePickerContainer}>
                          <Text style={styles.timeLabel}>Start:</Text>
                          <WebTimePicker
                            value={slot.startTime}
                            onChange={(event, selectedTime) => handleTimeChange(index, 'startTime', selectedTime)}
                          />
                        </View>
                        <View style={styles.webTimePickerContainer}>
                          <Text style={styles.timeLabel}>End:</Text>
                          <WebTimePicker
                            value={slot.endTime}
                            onChange={(event, selectedTime) => handleTimeChange(index, 'endTime', selectedTime)}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePickerModal(index, 'startTime')}
                        >
                          <Text>{slot.startTime || 'Start Time'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePickerModal(index, 'endTime')}
                        >
                          <Text>{slot.endTime || 'End Time'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={() => removeTimeSlot(index)} style={styles.removeButton}>
                      <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addButton} onPress={addTimeSlot}>
                <Ionicons name="add-circle" size={24} color="#50cebb" />
                <Text style={styles.addButtonText}>Add Time Slot</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.saveDayButton,
                  (!selectedDay || timeSlots.length === 0) && styles.buttonDisabled
                ]}
                onPress={handleSaveDay}
                disabled={!selectedDay || timeSlots.length === 0}
              >
                <Text style={styles.saveDayButtonText}>Save Day</Text>
              </TouchableOpacity>
            </View>
          )}

          {showPickerModal.show && Platform.OS === 'ios' && (
            <Modal transparent={true} animationType="slide">
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Time</Text>
                  <DateTimePicker
                    value={tempTime}
                    mode="time"
                    is24Hour={true}
                    display="spinner"
                    onChange={(event, selectedTime) => {
                      if (event.type === 'set' && selectedTime) {
                        const { index, field } = showPickerModal;
                        const updatedSlots = [...timeSlots];
                        updatedSlots[index] = {
                          ...updatedSlots[index],
                          [field]: selectedTime.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          })
                        };
                        setTimeSlots(updatedSlots);
                      }
                    }}
                  />
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setShowPickerModal({ show: false, index: null, field: '' })}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={() => setShowPickerModal({ show: false, index: null, field: '' })}
                    >
                      <Text style={styles.modalButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {showPickerModal.show && Platform.OS === 'android' && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={(event, selectedTime) => {
                if (event.type === 'set' && selectedTime) {
                  const { index, field } = showPickerModal;
                  const updatedSlots = [...timeSlots];
                  updatedSlots[index] = {
                    ...updatedSlots[index],
                    [field]: selectedTime.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      hour12: false 
                    })
                  };
                  setTimeSlots(updatedSlots);
                }
                setShowPickerModal({ show: false, index: null, field: '' });
              }}
            />
          )}
        </View>

        {Object.keys(availability).length > 0 && (
          <View style={styles.savedAvailabilityContainer}>
            <Text style={styles.savedAvailabilityTitle}>Saved Availability</Text>
            {Object.entries(availability).map(([day, dayData]) => (
              <View key={day} style={styles.savedDayContainer}>
                <View style={styles.savedDayHeader}>
                  <Text style={styles.savedDayText}>{day}</Text>
                </View>
                <View style={styles.savedTimeSlotsContainer}>
                  {dayData.slots?.map((slot, index) => (
                    <Text key={index} style={styles.savedTimeSlot}>
                      {slot.startTime} - {slot.endTime}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.nextButton, !hasAnyAvailability && styles.nextButtonDisabled]}
          onPress={handleComplete}
          disabled={!hasAnyAvailability}
        >
          <Text style={styles.nextButtonText}>
            {isInitialSetup ? 'Complete Setup' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  calendar: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  dayContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  slotContainer: {
    marginBottom: 15,
  },
  slotTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 5,
    flex: 1,
  },
  toText: {
    marginHorizontal: 10,
  },
  removeButton: {
    marginLeft: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#50cebb',
    marginLeft: 5,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    marginRight: 5,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 5,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webTimePickerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: '#4b5563',
    minWidth: 45,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#e2e8f0',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
    width: '90%',
    alignSelf: 'center',
  },
  saveDayButton: {
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveDayButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
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
  selectedDayButton: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  availableDayButton: {
    borderColor: '#4CAF50',
  },
  dayButtonText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#1e3a8a',
  },
  selectedDayButtonText: {
    color: '#ffffff',
  },
  savedAvailabilityContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  savedAvailabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  savedDayContainer: {
    marginBottom: 12,
  },
  savedDayHeader: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  savedDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  savedTimeSlotsContainer: {
    paddingLeft: 12,
  },
  savedTimeSlot: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
});