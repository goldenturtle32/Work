import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function AvailabilityScreen({ navigation }) {
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

  const handleTimeChange = (event, selectedTime) => {
    const { index, field } = showPickerModal;
    if (Platform.OS === 'android') {
      setShowPickerModal({ show: false, index: null, field: '' });
    }
    if (selectedTime) {
      const updatedSlots = [...timeSlots];
      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      };
      setTimeSlots(updatedSlots);
      setTempTime(selectedTime);
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

  const saveAvailability = async () => {
    if (!user) return;

    try {
      const updatedAvailability = {
        ...user.availability,
        [selectedDay]: { repeatType, slots: timeSlots },
      };

      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      await userDocRef.update({
        availability: updatedAvailability,
      });

      setUser({ ...user, availability: updatedAvailability });
      updateMarkedDates(updatedAvailability);

      if (repeatType !== 'custom') {
        await applyRepeatingSchedule(updatedAvailability);
      }

      Alert.alert('Success', 'Availability updated successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to update availability');
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

      <TouchableOpacity style={styles.saveButton} onPress={saveAvailability}>
        <Text style={styles.saveButtonText}>Save Availability</Text>
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
});