import React, { useState, useEffect } from 'react';
import { View, Button, Text, StyleSheet, Alert, Modal } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';

export default function AvailabilityScreen({ navigation }) {
  const [selectedDay, setSelectedDay] = useState(''); // Selected date
  const [timeSlots, setTimeSlots] = useState([]); // Time slots for each day
  const [repeatType, setRepeatType] = useState('custom'); // Repeat type
  const [showPickerModal, setShowPickerModal] = useState({ show: false, index: null, field: '' }); // Control modal
  const [tempTime, setTempTime] = useState(new Date()); // Temporary time during selection

  // Load availability for the selected day from Firebase
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid); // Update collection
        const doc = await userDocRef.get();
        if (doc.exists && doc.data().availability && doc.data().availability[selectedDay]) {
          setTimeSlots(doc.data().availability[selectedDay].slots || []);
          setRepeatType(doc.data().availability[selectedDay].repeatType || 'custom');
        } else {
          setTimeSlots([]); // Reset if no availability
        }
      } catch (error) {
        console.error('Error loading availability:', error);
      }
    };

    if (selectedDay) {
      loadAvailability();
    }
  }, [selectedDay]);

  const handleDayPress = (day) => {
    setSelectedDay(day.dateString);
  };

  // Open modal to pick time
  const openTimePickerModal = (index, field) => {
    setShowPickerModal({ show: true, index, field });
  };

  // Handle time change in modal
  const handleTimeChange = (event, selectedTime) => {
    if (event.type === 'dismissed') {
      setShowPickerModal({ show: false, index: null, field: '' });
      return; // If dismissed, do nothing
    }

    const { index, field } = showPickerModal;
    const updatedSlots = [...timeSlots];
    const time = selectedTime || tempTime;

    updatedSlots[index][field] = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimeSlots(updatedSlots);
    setShowPickerModal({ show: false, index: null, field: '' });
  };

  // Add new time slot
  const addNewSlot = () => {
    setTimeSlots([...timeSlots, { startTime: '', endTime: '' }]);
  };

  // Save availability to Firebase
  const saveAvailability = async () => {
    try {
      const userDocRef = db.collection('user_attributes').doc(auth.currentUser.uid); // Update collection
      await userDocRef.update({
        [`availability.${selectedDay}`]: { repeatType, slots: timeSlots },
      });
      Alert.alert('Availability updated successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  return (
    <View style={styles.container}>
      <Calendar onDayPress={handleDayPress} markedDates={{ [selectedDay]: { selected: true } }} />

      {timeSlots.map((slot, index) => (
        <View key={index} style={styles.slotContainer}>
          <Text>Time Slot {index + 1}</Text>
          <Button title={slot.startTime || 'Select Start Time'} onPress={() => openTimePickerModal(index, 'startTime')} />
          <Button title={slot.endTime || 'Select End Time'} onPress={() => openTimePickerModal(index, 'endTime')} />
        </View>
      ))}

      <Button title="Add Time Slot" onPress={addNewSlot} />
      <Button title="Save Availability" onPress={saveAvailability} />

      <Modal visible={showPickerModal.show} transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text>Select Time</Text>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(event, selectedTime) => setTempTime(selectedTime || tempTime)}
            />
            <Button title="Confirm" onPress={(event) => handleTimeChange(event, tempTime)} />
            <Button title="Cancel" onPress={() => setShowPickerModal({ show: false, index: null, field: '' })} />
          </View>
        </View>
      </Modal>

      <Text style={styles.repeatTypeLabel}>Repeat Availability:</Text>
      <View style={styles.repeatButtonContainer}>
        <Button title="Weekly" onPress={() => setRepeatType('weekly')} />
        <Button title="Bi-weekly" onPress={() => setRepeatType('bi-weekly')} />
        <Button title="Custom" onPress={() => setRepeatType('custom')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  slotContainer: {
    marginBottom: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  repeatTypeLabel: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
  },
  repeatButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});
