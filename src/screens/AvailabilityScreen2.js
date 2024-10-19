import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function AvailabilityScreen({ navigation }) {
  const [selectedDay, setSelectedDay] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [repeatType, setRepeatType] = useState('custom');
  const [showPickerModal, setShowPickerModal] = useState({ show: false, index: null, field: '' });
  const [tempTime, setTempTime] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    loadAvailability();
  }, []);

  useEffect(() => {
    if (selectedDay) {
      loadDayAvailability(selectedDay);
    }
  }, [selectedDay]);

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

  const loadDayAvailability = async (day) => {
    try {
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      const doc = await userDocRef.get();
      if (doc.exists && doc.data().availability && doc.data().availability[day]) {
        setTimeSlots(doc.data().availability[day].slots || []);
        setRepeatType(doc.data().availability[day].repeatType || 'custom');
      } else {
        setTimeSlots([]);
        setRepeatType('custom');
      }
    } catch (error) {
      console.error('Error loading day availability:', error);
    }
  };

  const handleDayPress = (day) => {
    setSelectedDay(day.dateString);
  };

  const openTimePickerModal = (index, field) => {
    setShowPickerModal({ show: true, index, field });
    setTempTime(new Date());
  };

  const handleTimeChange = (event, selectedTime) => {
    if (event.type === 'set') {
      const { index, field } = showPickerModal;
      const updatedSlots = [...timeSlots];
      const time = selectedTime || tempTime;

      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setTimeSlots(updatedSlots);
    }
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
    try {
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);
      await userDocRef.update({
        [`availability.${selectedDay}`]: { repeatType, slots: timeSlots },
      });
      
      // Update marked dates
      setMarkedDates(prev => ({
        ...prev,
        [selectedDay]: { marked: true, dotColor: '#50cebb' }
      }));

      // Apply repeating schedule if needed
      if (repeatType !== 'custom') {
        await applyRepeatingSchedule();
      }

      Alert.alert('Success', 'Availability updated successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const applyRepeatingSchedule = async () => {
    const startDate = new Date(selectedDay);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 3); // Apply for 3 months

    const interval = repeatType === 'weekly' ? 7 : 14;
    const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + interval)) {
      const dateString = d.toISOString().split('T')[0];
      if (dateString !== selectedDay) {
        await userDocRef.update({
          [`availability.${dateString}`]: { repeatType, slots: timeSlots },
        });
        setMarkedDates(prev => ({
          ...prev,
          [dateString]: { marked: true, dotColor: '#50cebb' }
        }));
      }
    }
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

      <Modal visible={showPickerModal.show} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(event, selectedTime) => setTempTime(selectedTime || tempTime)}
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
                onPress={(event) => handleTimeChange(event, tempTime)}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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