import React, { useState, useEffect } from 'react';
import { View, Button, Text, StyleSheet, Alert, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars'; // Calendar library
import DateTimePicker from '@react-native-community/datetimepicker'; // Time picker
import { db, auth } from '../firebase';

export default function AvailabilityScreen({ navigation }) {
  const [selectedDay, setSelectedDay] = useState('');
  const [timeSlots, setTimeSlots] = useState([{ startTime: '', endTime: '' }]); // Store time slots
  const [repeatType, setRepeatType] = useState('custom'); // Store repeat type (weekly, bi-weekly, custom)

  // Load availability for the selected day from Firebase
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const userDocRef = db.collection('users').doc(auth.currentUser.uid);
        const doc = await userDocRef.get();
        if (doc.exists && doc.data().availability[selectedDay]) {
          setTimeSlots(doc.data().availability[selectedDay].slots);
          setRepeatType(doc.data().availability[selectedDay].repeatType);
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

  const handleTimeChange = (index, field, time) => {
    const updatedSlots = [...timeSlots];
    updatedSlots[index][field] = time;
    setTimeSlots(updatedSlots);
  };

  const addNewSlot = () => {
    setTimeSlots([...timeSlots, { startTime: '', endTime: '' }]);
  };

  const saveAvailability = async () => {
    try {
      const userDocRef = db.collection('users').doc(auth.currentUser.uid);
      await userDocRef.update({
        [`availability.${selectedDay}`]: { repeatType, slots: timeSlots }, // Adjust structure for daily slots
      });
      Alert.alert('Availability updated successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={{ [selectedDay]: { selected: true } }}
      />
      {timeSlots.map((slot, index) => (
        <View key={index} style={styles.slotContainer}>
          <Text>Select Time Slot {index + 1}</Text>
          <DateTimePicker
            value={new Date()}
            mode="time"
            onChange={(event, selectedTime) => handleTimeChange(index, 'startTime', selectedTime)}
          />
          <DateTimePicker
            value={new Date()}
            mode="time"
            onChange={(event, selectedTime) => handleTimeChange(index, 'endTime', selectedTime)}
          />
        </View>
      ))}
      <Button title="Add Time Slot" onPress={addNewSlot} />
      <Button title="Save" onPress={saveAvailability} />

      <Text style={styles.repeatTypeLabel}>Repeat Availability:</Text>
      <Button title="Weekly" onPress={() => setRepeatType('weekly')} />
      <Button title="Bi-weekly" onPress={() => setRepeatType('bi-weekly')} />
      <Button title="Custom" onPress={() => setRepeatType('custom')} />
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
  repeatTypeLabel: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
