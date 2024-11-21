import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

// Replace the existing WebTimePicker component with this enhanced version
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

export default function AvailabilityScreen({ navigation, route }) {
  const isInitialSetup = route.params?.isInitialSetup || false;

  const [user, setUser] = useState(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [repeatType, setRepeatType] = useState('custom');
  const [showPickerModal, setShowPickerModal] = useState({ show: false, index: null, field: '' });
  const [tempTime, setTempTime] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (user && selectedDay) {
      loadDayAvailability(selectedDay);
    }
  }, [user, selectedDay]);

  const loadUserData = async () => {
    try {
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      const doc = await userDocRef.get();
      if (doc.exists) {
        const userData = doc.data();
        setUser(userData);
        updateMarkedDates(userData.availability || {});
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const updateMarkedDates = (availability) => {
    const marked = {};
    Object.keys(availability).forEach(date => {
      marked[date] = { marked: true, dotColor: '#50cebb' };
    });
    setMarkedDates(marked);
  };

  const loadDayAvailability = (day) => {
    if (user && user.availability && user.availability[day]) {
      setTimeSlots(user.availability[day].slots || []);
      setRepeatType(user.availability[day].repeatType || 'custom');
    } else {
      setTimeSlots([]);
      setRepeatType('custom');
    }
  };

  const handleDayPress = (day) => {
    setSelectedDay(day.dateString);
  };

  const openTimePickerModal = (index, field) => {
    setShowPickerModal({ show: true, index, field });
    const currentTime = timeSlots[index] && timeSlots[index][field]
      ? new Date(`1970-01-01T${timeSlots[index][field]}`)
      : new Date();
    setTempTime(currentTime);
  };

  const handleTimeChange = (event, selectedTime, index, field) => {
    if (event.type === 'dismissed') {
      setShowPickerModal({ show: false, index: null, field: '' });
      return;
    }

    if (selectedTime) {
      const timeString = selectedTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });

      const updatedSlots = [...timeSlots];
      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: timeString
      };
      setTimeSlots(updatedSlots);

      if (Platform.OS !== 'web') {
        setShowPickerModal({ show: false, index: null, field: '' });
      }
    }
  };

  const confirmTimeSelection = () => {
    const { index, field } = showPickerModal;
    const updatedSlots = [...timeSlots];
    updatedSlots[index] = {
      ...updatedSlots[index],
      [field]: tempTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    };
    setTimeSlots(updatedSlots);
    setShowPickerModal({ show: false, index: null, field: '' });
  };

  const addNewSlot = () => {
    setTimeSlots([...timeSlots, { startTime: '', endTime: '' }]);
  };

  const removeSlot = (index) => {
    const updatedSlots = timeSlots.filter((_, i) => i !== index);
    setTimeSlots(updatedSlots);
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
          repeatType,
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

  const applyRepeatingSchedule = async (currentAvailability) => {
    const startDate = new Date(selectedDay);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 3); // Apply for 3 months

    const interval = repeatType === 'weekly' ? 7 : 14;
    const updatedAvailability = { ...currentAvailability };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + interval)) {
      const dateString = d.toISOString().split('T')[0];
      if (dateString !== selectedDay) {
        updatedAvailability[dateString] = { repeatType, slots: timeSlots };
      }
    }

    const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
    await userDocRef.update({
      availability: updatedAvailability,
    });

    setUser({ ...user, availability: updatedAvailability });
    updateMarkedDates(updatedAvailability);
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

  return (
    <ScrollView style={styles.container}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={{
          ...markedDates,
          [selectedDay]: { ...markedDates[selectedDay], selected: true, selectedColor: '#50cebb' }
        }}
      />

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
                        onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, index, 'startTime')}
                      />
                    </View>
                    <Text style={styles.toText}>to</Text>
                    <View style={styles.webTimePickerContainer}>
                      <Text style={styles.timeLabel}>End:</Text>
                      <WebTimePicker
                        value={slot.endTime}
                        onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, index, 'endTime')}
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
                    <Text style={styles.toText}>to</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => openTimePickerModal(index, 'endTime')}
                    >
                      <Text>{slot.endTime || 'End Time'}</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={() => removeSlot(index)} style={styles.removeButton}>
                  <Ionicons name="close-circle" size={24} color="red" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={addNewSlot}>
            <Ionicons name="add-circle" size={24} color="#50cebb" />
            <Text style={styles.addButtonText}>Add Time Slot</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.repeatContainer}>
        <Text style={styles.repeatTitle}>Repeat Schedule:</Text>
        <View style={styles.repeatButtonContainer}>
          <TouchableOpacity
            style={[styles.repeatButton, repeatType === 'weekly' && styles.activeRepeatButton]}
            onPress={() => setRepeatType('weekly')}
          >
            <Text style={[styles.repeatButtonText, repeatType === 'weekly' && styles.activeRepeatButtonText]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.repeatButton, repeatType === 'bi-weekly' && styles.activeRepeatButton]}
            onPress={() => setRepeatType('bi-weekly')}
          >
            <Text style={[styles.repeatButtonText, repeatType === 'bi-weekly' && styles.activeRepeatButtonText]}>Bi-weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.repeatButton, repeatType === 'custom' && styles.activeRepeatButton]}
            onPress={() => setRepeatType('custom')}
          >
            <Text style={[styles.repeatButtonText, repeatType === 'custom' && styles.activeRepeatButtonText]}>Custom</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[
          styles.saveButton,
          (!selectedDay || timeSlots.length === 0 || !areTimeSlotsValid()) && styles.buttonDisabled
        ]}
        onPress={handleSaveAvailability}
        disabled={!selectedDay || timeSlots.length === 0 || !areTimeSlotsValid()}
      >
        <Text style={[
          styles.saveButtonText,
          (!selectedDay || timeSlots.length === 0 || !areTimeSlotsValid()) && styles.buttonTextDisabled
        ]}>
          {isInitialSetup ? 'Complete Setup' : 'Save Changes'}
        </Text>
      </TouchableOpacity>

      {showPickerModal.show && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <DateTimePicker
                value={tempTime}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={handleTimeChange}
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
                  onPress={confirmTimeSelection}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  repeatContainer: {
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
  repeatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  repeatButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repeatButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#50cebb',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  activeRepeatButton: {
    backgroundColor: '#50cebb',
  },
  repeatButtonText: {
    color: '#50cebb',
  },
  activeRepeatButtonText: {
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#50cebb',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
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
    backgroundColor: '#50cebb',
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
});