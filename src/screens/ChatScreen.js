import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  StyleSheet,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { db, auth, firebase } from '../firebase';
import { createInterview } from '../services/firestoreService';
import { Calendar } from 'react-native-calendars';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc, 
  onSnapshot, 
  updateDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { formatPhoneNumber } from '../utils/phoneFormatter';

const BACKEND_URL = 'http://127.0.0.1:5000';

export default function ChatScreen({ route, navigation }) {
  const { matchId, role, jobTitle, company } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [showWorkerResponseModal, setShowWorkerResponseModal] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);
  const [currentInterview, setCurrentInterview] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingInterview, setPendingInterview] = useState(null);
  const [acceptedInterview, setAcceptedInterview] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [workSchedule, setWorkSchedule] = useState({
    startTime: '',
    endTime: '',
  });
  const [showPostInterviewModal, setShowPostInterviewModal] = useState(false);
  const [workScheduleProposal, setWorkScheduleProposal] = useState(null);
  const [showJobOfferModal, setShowJobOfferModal] = useState(false);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [hourlyWage, setHourlyWage] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isButtonEnabled, setIsButtonEnabled] = useState(true);
  const [jobOfferDate, setJobOfferDate] = useState(new Date());
  const [jobOfferStep, setJobOfferStep] = useState('offer'); // 'offer' or 'datetime'
  const [jobStartDate, setJobStartDate] = useState(new Date());
  const [jobStartTime, setJobStartTime] = useState(new Date());

  const isEmployer = role === 'employer';
  const otherUserId = matchId?.split('_')[isEmployer ? 1 : 0];

  useEffect(() => {
    const unsubscribe = db.collection('chats')
      .doc(matchId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        try {
          const newMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));
          setMessages(newMessages);
        } catch (error) {
          console.error("Error processing messages:", error);
        }
      }, error => {
        console.error("Error fetching messages:", error);
        Alert.alert(
          'Error',
          'Unable to load messages. Please check your connection and try again.'
        );
      });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    generateSuggestions();
  }, [messages]);

  useEffect(() => {
    // Listen for interview updates
    const unsubscribe = db.collection('interviews')
      .where('matchId', '==', matchId)
      .onSnapshot(snapshot => {
        const interview = snapshot.docs[0]?.data();
        if (interview) {
          // Update UI based on interview status
          if (interview.status === 'scheduled' && !interview.calendarEventId) {
            createCalendarEvent(interview).then(eventId => {
              if (eventId) {
                db.collection('interviews')
                  .doc(snapshot.docs[0].id)
                  .update({ calendarEventId: eventId });
              }
            });
          }
        }
      });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    if (!matchId || role !== 'worker') {
      console.log('Skipping interview fetch:', { matchId, role });
      return;
    }

    console.log('Fetching interviews with params:', {
      matchId,
      role,
      userId: auth.currentUser?.uid
    });
    
    const unsubscribe = db.collection('interviews')
      .where('workerId', '==', matchId)
      .where('status', '==', 'pending')
      .onSnapshot(snapshot => {
        console.log('Raw snapshot data:', snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
        
        const interviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('Processed interviews:', interviews);
        
        const pending = interviews[0];
        if (pending) {
          console.log('Setting pending interview:', pending);
          setPendingInterview(pending);
        } else {
          console.log('No pending interviews found');
          setPendingInterview(null);
        }
      }, error => {
        console.error('Error in interview snapshot:', error);
      });

    return () => unsubscribe();
  }, [matchId, role]);

  useEffect(() => {
    if (!isEmployer && matchId) {
      const offerRef = doc(db, 'job_offers', matchId);
      const unsubscribe = onSnapshot(offerRef, (doc) => {
        if (doc.exists() && doc.data().status === 'pending') {
          setPendingOffer(doc.data());
        } else {
          setPendingOffer(null);
        }
      });

      return () => unsubscribe();
    }
  }, [matchId, isEmployer]);

  const generateSuggestions = async () => {
    try {
      const lastMessages = messages.slice(0, 3).map(msg => ({
        text: msg.text,
        sender: msg.sender
      }));

      const response = await fetch(`${BACKEND_URL}/generate-chat-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: role,
          jobTitle: jobTitle,
          company: company,
          recentMessages: lastMessages,
          context: {
            isWorker: role === 'worker',
            jobTitle: jobTitle,
            company: company
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to get suggestions');
      
      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setSuggestions(getStaticSuggestions());
    }
  };

  const getStaticSuggestions = () => {
    if (role === 'worker') {
      return [
        "What benefits does this position offer?",
        "Is there flexibility in the work schedule?",
        "What growth opportunities are available?",
        "Can you describe the team I'd be working with?"
      ];
    } else {
      return [
        "What relevant experience do you have for this role?",
        "When would you be able to start?",
        "What interests you most about this position?",
        "Tell me about your biggest professional achievement"
      ];
    }
  };

  const sendSuggestion = (suggestionText) => {
    setMessage(suggestionText);
  };

  const sendMessage = async () => {
    if (message.trim()) {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }

        // First create the chat document if it doesn't exist
        await db.collection('chats').doc(matchId).set({
          participants: [currentUser.uid, role === 'worker' ? matchId.split('_')[1] : matchId.split('_')[0]],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Then add the message
        const messageData = {
          text: message,
          senderId: currentUser.uid,
          sender: role,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          read: false
        };

        await db.collection('chats')
          .doc(matchId)
          .collection('messages')
          .add(messageData);
        
        await db.collection('matches').doc(matchId).update({
          lastMessage: message,
          lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
          [`${role}LastRead`]: firebase.firestore.FieldValue.serverTimestamp()
        });

        setMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert(
          'Error',
          'Failed to send message. Please check your connection and try again.'
        );
      }
    }
  };

  const simulateEmployerResponse = (userMessage) => {
    let response;
    if (userMessage.text.toLowerCase().includes('experience')) {
      response = `For the ${jobTitle} position, we typically look for candidates with relevant experience in the field. Could you tell me about your background?`;
    } else if (userMessage.text.toLowerCase().includes('salary')) {
      response = `The salary for the ${jobTitle} position is competitive and based on experience. We'd be happy to discuss specifics if you progress to the interview stage.`;
    } else if (userMessage.text.toLowerCase().includes('interview')) {
      response = `Great! We'd love to schedule an interview. Please use the calendar icon below to select a suitable time.`;
    } else {
      response = `Thank you for your interest in the ${jobTitle} position. Is there anything specific you'd like to know about the role or ${company}?`;
    }
    
    db.collection('chats')
      .doc(matchId)
      .collection('messages')
      .add({
        text: response,
        sender: 'employer',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        simulated: true
      });
  };

  const renderMessageItem = ({ item }) => {
    const now = new Date();
    const messageDate = item.timestamp;
    const isToday = messageDate.toDateString() === now.toDateString();
    
    const timeString = isToday 
      ? messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : `${messageDate.toLocaleDateString()} ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return (
      <View style={[
        styles.messageContainer,
        item.sender === role ? styles.userMessage : styles.employerMessage
      ]}>
        <Text style={[
          styles.messageText,
          item.sender === role ? styles.userMessageText : styles.employerMessageText
        ]}>
          {item.text}
        </Text>
        <Text style={styles.timestamp}>
          {timeString}
        </Text>
      </View>
    );
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date) => {
    console.log("Selected date:", date);
    setSelectedTimeSlots([...selectedTimeSlots, date]);
    hideDatePicker();
  };

  const suggestAction = async (action) => {
    let actionMessage;
    switch(action) {
      case 'call':
        actionMessage = "Would you like to schedule a call to discuss the position further?";
        break;
      case 'qualifications':
        actionMessage = "Can you tell me more about your qualifications for this role?";
        break;
      case 'experience':
        actionMessage = "What relevant experience do you have for this position?";
        break;
      default:
        actionMessage = "Is there anything specific you'd like to know about the role?";
    }
    
    try {
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: actionMessage,
          sender: role,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error suggesting action:', error);
    }
  };

  const refreshSuggestions = async () => {
    setIsRefreshing(true);
    await generateSuggestions();
    setIsRefreshing(false);
  };

  const ScheduleButton = () => (
    <TouchableOpacity 
      style={styles.scheduleButton}
      onPress={() => setShowTimeSlotModal(true)}
    >
      <Text style={styles.scheduleButtonText}>Schedule Interview</Text>
    </TouchableOpacity>
  );

  const handleConfirm = (date) => {
    console.log("Selected date:", date);
    setSelectedTimeSlots([...selectedTimeSlots, date]);
    setDatePickerVisible(false);
  };

  const handleCancel = () => {
    setDatePickerVisible(false);
  };

  const handleSubmitTimeSlots = async () => {
    if (selectedTimeSlots.length === 0) {
      Alert.alert('Error', 'Please add at least one time slot');
      return;
    }

    try {
      await createInterview({
        matchId,
        employerId: auth.currentUser.uid,
        workerId: otherUserId,
        timeSlots: selectedTimeSlots.map(slot => ({
          datetime: slot,
          selected: false
        }))
      });
      
      await sendSystemMessage('Interview time slots have been shared. Please select a preferred time.');
      setShowTimeSlotModal(false);
      setSelectedTimeSlots([]);
    } catch (error) {
      console.error('Error submitting time slots:', error);
      Alert.alert('Error', 'Failed to submit time slots');
    }
  };

  const sendSystemMessage = async (text) => {
    try {
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text,
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          read: false
        });
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  const onDateSelect = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const TimeSlotModal = () => {
    const [selectedStartTime, setSelectedStartTime] = useState('');
    const [selectedEndTime, setSelectedEndTime] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);

    const handleTimeSlotSelection = async () => {
      if (!selectedStartTime || !selectedEndTime || !selectedDate) {
        Alert.alert('Please select both start time, end time and date');
        return;
      }

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert('Error', 'You must be logged in to schedule interviews');
          return;
        }

        await addDoc(collection(db, 'interviews'), {
          employerId: currentUser.uid,
          workerId: otherUserId,
          matchId: matchId,
          startTime: selectedStartTime,
          endTime: selectedEndTime,
          date: selectedDate,
          status: 'pending',
          createdAt: serverTimestamp()
        });

        Alert.alert('Success', 'Interview scheduled successfully');
        setShowTimeSlotModal(false);
      } catch (error) {
        console.error('Error scheduling interview:', error);
        Alert.alert('Error', 'Failed to schedule interview');
      }
    };

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTimeSlotModal}
        onRequestClose={() => setShowTimeSlotModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: { selected: true }
              }}
            />
            
            {selectedDate && (
              <View style={styles.timeInputContainer}>
                <TextInput
                  style={styles.timeInput}
                  placeholder="Start Time (HH:MM)"
                  value={selectedStartTime}
                  onChangeText={setSelectedStartTime}
                />
                <TextInput
                  style={styles.timeInput}
                  placeholder="End Time (HH:MM)"
                  value={selectedEndTime}
                  onChangeText={setSelectedEndTime}
                />
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleTimeSlotSelection}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowTimeSlotModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const WorkerResponseModal = () => {
    // Early return if no interview data
    if (!currentInterview) return null;

    return (
      <Modal
        visible={showWorkerResponseModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Interview Time</Text>
            <ScrollView>
              {currentInterview.timeSlots.map((slot, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.timeSlotOption,
                    selectedSlot === slot.datetime.toDate().getTime() && styles.selectedSlot
                  ]}
                  onPress={() => setSelectedSlot(slot.datetime.toDate().getTime())}
                >
                  <Text style={styles.timeSlotText}>
                    {slot.datetime.toDate().toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TextInput
              style={styles.phoneInput}
              placeholder="Your phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleWorkerSubmitSelection}
            >
              <Text style={styles.submitButtonText}>Confirm Selection</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowWorkerResponseModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMessages = () => (
    <FlatList
      data={messages}
      renderItem={renderMessageItem}
      keyExtractor={item => item.id}
      inverted
      contentContainerStyle={styles.messagesContainer}
    />
  );

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
      setShowStartTimePicker(true);
    }
  };

  const onStartTimeChange = (event, selected) => {
    setShowStartTimePicker(false);
    if (selected) {
      setStartTime(selected);
      setShowEndTimePicker(true);
    }
  };

  const onEndTimeChange = (event, selected) => {
    setShowEndTimePicker(false);
    if (selected) {
      setEndTime(selected);
      // Here you can handle saving the interview schedule
      handleSaveSchedule();
    }
  };

  const handleScheduleInterview = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date.dateString);
  };

  const handleTimeSelect = async () => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      Alert.alert('Please select both date and times');
      return;
    }

    try {
      const interviewData = {
        date: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        employerId: auth.currentUser.uid,
        workerId: otherUserId,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };

      await createInterview(interviewData);
      
      // Send a message about the interview
      const message = `Interview scheduled for ${selectedDate} from ${selectedStartTime} to ${selectedEndTime}`;
      await sendMessage(message, 'interview');
      
      setShowCalendar(false);
      setSelectedDate(null);
      setSelectedStartTime('');
      setSelectedEndTime('');
    } catch (error) {
      console.error('Error scheduling interview:', error);
      Alert.alert('Error', 'Failed to schedule interview');
    }
  };

  const handleSaveInterview = async () => {
    try {
      const interviewData = {
        date: selectedDate,
        startTime: startTime.toLocaleTimeString(),
        endTime: endTime.toLocaleTimeString(),
        workerId: matchId.split('_')[1],
        employerId: auth.currentUser.uid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await createInterview(interviewData);
      
      // Send a message about the interview
      const message = `Interview scheduled for ${selectedDate} from ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`;
      setMessage(message);
      handleSend();
      
    } catch (error) {
      console.error('Error scheduling interview:', error);
      Alert.alert('Error', 'Failed to schedule interview');
    }
  };

  const handleSaveSchedule = async () => {
    const scheduleData = {
      date: selectedDate.toISOString().split('T')[0],
      startTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Send a message with the schedule
    const scheduleMessage = `Interview scheduled for ${scheduleData.date} from ${scheduleData.startTime} to ${scheduleData.endTime}`;
    setMessage(scheduleMessage);
    // You can then call your sendMessage function
  };

  const handleAcceptInterview = () => {
    setShowPhoneModal(true);
  };

  const handlePhoneSubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number');
      return;
    }

    try {
      if (!pendingInterview?.id) return;

      await db.collection('interviews')
        .doc(pendingInterview.id)
        .update({
          status: 'accepted',
          acceptedAt: serverTimestamp(),
          workerPhone: phoneNumber
        });

      setShowPhoneModal(false);
      Alert.alert('Success', 'Interview accepted successfully');
    } catch (error) {
      console.error('Error accepting interview:', error);
      Alert.alert('Error', 'Failed to accept interview');
    }
  };

  const PhoneNumberModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showPhoneModal}
      onRequestClose={() => setShowPhoneModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Your Phone Number</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handlePhoneSubmit}
          >
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => setShowPhoneModal(false)}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const InterviewBanner = () => {
    if (!acceptedInterview) return null;

    const interviewDate = new Date(acceptedInterview.date);
    const now = new Date();
    if (interviewDate < now) return null;

    return (
      <View style={styles.bannerContainer}>
        <Text style={styles.bannerText}>
          Interview scheduled for {interviewDate.toLocaleDateString()} at {acceptedInterview.startTime}
        </Text>
      </View>
    );
  };

  const PendingInterviewCard = () => {
    console.log('Rendering PendingInterviewCard:', { 
      pendingInterview, 
      role,
      userId: auth.currentUser?.uid 
    });
    
    if (!pendingInterview || role !== 'worker') {
      console.log('Not showing card because:', {
        hasPendingInterview: !!pendingInterview,
        isWorker: role === 'worker'
      });
      return null;
    }

    return (
      <View style={styles.interviewCard}>
        <Text style={styles.interviewTitle}>Pending Interview Request</Text>
        <Text>Date: {pendingInterview.date}</Text>
        <Text>Time: {pendingInterview.startTime} - {pendingInterview.endTime}</Text>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAcceptInterview}
        >
          <Text style={styles.buttonText}>Accept Interview</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handlePhoneChange = (text) => {
    // Store raw input (digits only)
    const cleaned = text.replace(/\D/g, '');
    setRawPhoneNumber(cleaned);
    
    // Store formatted version for display
    const formatted = formatPhoneNumber(cleaned);
    setPhoneNumber(formatted);
  };

  const isValidPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleSubmitPhone = () => {
    if (!isValidPhoneNumber(rawPhoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number');
      return;
    }
    // ... rest of your submit logic ...
  };

  const handlePostInterviewDecision = async () => {
    if (!isEmployer) return;
    
    Alert.alert(
      'Interview Complete',
      'Would you like to proceed with hiring this worker?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => {
            // Update interview status to declined
            updateInterviewStatus('declined');
          }
        },
        {
          text: 'Yes',
          onPress: () => {
            setShowScheduleModal(true);
          }
        }
      ]
    );
  };

  const ScheduleModal = () => (
    <Modal
      visible={showScheduleModal}
      transparent
      animationType="slide"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Set Work Schedule</Text>
          
          <Calendar
            onDayPress={day => {
              const selected = selectedDays.includes(day.dateString)
                ? selectedDays.filter(d => d !== day.dateString)
                : [...selectedDays, day.dateString];
              setSelectedDays(selected);
            }}
            markedDates={
              selectedDays.reduce((obj, day) => ({
                ...obj,
                [day]: { selected: true }
              }), {})
            }
          />
          
          <View style={styles.timeContainer}>
            <TouchableOpacity onPress={() => setShowStartTimePicker(true)}>
              <Text>Start Time: {workSchedule.startTime || 'Select'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowEndTimePicker(true)}>
              <Text>End Time: {workSchedule.endTime || 'Select'}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, styles.submitButton]}
            onPress={handleAcceptCandidate}
          >
            <Text style={styles.buttonText}>Send Job Offer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const handleScheduleSubmit = async () => {
    try {
      if (!selectedDays.length || !workSchedule.startTime || !workSchedule.endTime) {
        Alert.alert('Error', 'Please select days and times');
        return;
      }

      const scheduleRef = await db.collection('work_schedules').add({
        matchId,
        employerId: currentInterview.employerId,
        workerId: currentInterview.workerId,
        schedule: selectedDays.map(day => ({
          day,
          startTime: workSchedule.startTime,
          endTime: workSchedule.endTime
        })),
        status: 'pending_worker_approval',
        createdAt: serverTimestamp()
      });
      
      await db.collection('interviews')
        .doc(currentInterview.id)
        .update({
          status: 'pending_schedule_approval',
          workScheduleId: scheduleRef.id
        });
        
      setShowScheduleModal(false);
      setShowPostInterviewModal(false);
    } catch (error) {
      console.error('Error submitting schedule:', error);
      Alert.alert('Error', 'Failed to submit work schedule');
    }
  };

  const checkInterviewStatus = useCallback(() => {
    if (!currentInterview) return;
    
    // Convert interview date and time to a Date object
    const interviewDate = new Date(
      `${currentInterview.date} ${currentInterview.startTime}`
    );
    
    // Add logging to debug the conditions
    console.log('Interview check:', {
      currentDate: new Date(),
      interviewDate,
      status: currentInterview.status,
      role,
      isPast: new Date() > interviewDate
    });

    // Show post-interview modal if:
    // 1. Interview is in the past
    // 2. Status is "accepted"
    // 3. User is employer
    // 4. No schedule has been set
    if (new Date() > interviewDate && 
        currentInterview.status === 'accepted' && 
        role === 'employer' && 
        !currentInterview.workScheduleId) { // Only show if no schedule has been set
      setShowPostInterviewModal(true);
    }
  }, [currentInterview, role]);

  useEffect(() => {
    checkInterviewStatus();
  }, [currentInterview, checkInterviewStatus]);

  const handleHireDecision = async (hire) => {
    if (!hire) {
      await db.collection('interviews')
        .doc(currentInterview.id)
        .update({
          status: 'rejected_after_interview'
        });
      setShowPostInterviewModal(false);
      return;
    }
    
    setShowScheduleModal(true);
  };

  const PostInterviewModal = () => (
    <Modal
      visible={showPostInterviewModal}
      transparent
      animationType="slide"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Interview Complete</Text>
          <Text>Would you like to hire this candidate?</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.rejectButton]}
              onPress={() => handleHireDecision(false)}
            >
              <Text style={styles.buttonText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.acceptButton]}
              onPress={() => handleHireDecision(true)}
            >
              <Text style={styles.buttonText}>Yes, Set Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const handleAcceptCandidate = async () => {
    try {
      // Update match status
      const matchRef = doc(db, 'matches', `${workerId}_${employerId}`);
      await updateDoc(matchRef, {
        status: 'hired',
        hiredAt: new Date().toISOString()
      });

      // Create job offer
      const offerRef = doc(db, 'job_offers', `${workerId}_${employerId}`);
      await setDoc(offerRef, {
        workerId,
        employerId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        schedule: workSchedule,
        jobId: currentJob.id
      });

      setShowScheduleModal(false);
      Alert.alert('Success', 'Job offer sent to candidate');
    } catch (error) {
      console.error('Error accepting candidate:', error);
      Alert.alert('Error', 'Failed to send job offer');
    }
  };

  const handleJobOffer = async () => {
    if (!hourlyWage) {
      Alert.alert('Error', 'Please enter an hourly wage');
      return;
    }

    const selectedSchedules = {};
    Object.keys(selectedDays).forEach(day => {
      if (selectedDays[day]) {
        selectedSchedules[day] = schedules[day];
      }
    });

    if (Object.keys(selectedSchedules).length === 0) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }

    try {
      const offerRef = doc(db, 'job_offers', `${matchId}`);
      await setDoc(offerRef, {
        employerId: currentUserUid,
        workerId: otherUserId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        matchId: matchId,
        schedule: selectedSchedules,
        hourlyWage: parseFloat(hourlyWage),
      });

      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, {
        status: 'offer_sent'
      });

      setShowJobOfferModal(false);
      Alert.alert('Success', 'Job offer sent successfully!');
    } catch (error) {
      console.error('Error sending job offer:', error);
      Alert.alert('Error', 'Failed to send job offer. Please try again.');
    }
  };

  const handleOfferResponse = async (accept) => {
    try {
      if (!accept) {
        // Handle rejection
        await updateDoc(doc(db, 'job_offers', matchId), {
          status: 'rejected',
          respondedAt: new Date().toISOString()
        });
        return;
      }

      // Get the job offer details
      const offerDoc = await getDoc(doc(db, 'job_offers', matchId));
      const offerData = offerDoc.data();
      
      // Get worker and employer IDs
      const [workerId, employerId] = matchId.split('_');
      
      // Calculate total hours per week
      const totalHoursPerWeek = Object.values(offerData.schedule).reduce((total, times) => {
        const start = new Date(`2000-01-01T${times.startTime}`);
        const end = new Date(`2000-01-01T${times.endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        return total + hours;
      }, 0);

      // Calculate total earnings per week
      const weeklyEarnings = totalHoursPerWeek * offerData.hourlyWage;
      
      // Get worker's current stats
      const workerRef = doc(db, 'users', workerId);
      const workerDoc = await getDoc(workerRef);
      const currentStats = workerDoc.data()?.user_attributes || {};
      
      // Update worker stats
      const updatedStats = {
        activeJobs: (currentStats.activeJobs || 0) + 1,
        activeHours: (currentStats.activeHours || 0) + totalHoursPerWeek,
        activeEarnings: (currentStats.activeEarnings || 0) + weeklyEarnings
      };
      
      // Batch write all updates
      const batch = writeBatch(db);
      
      // Update worker's stats
      batch.update(workerRef, {
        'user_attributes.activeJobs': updatedStats.activeJobs,
        'user_attributes.activeHours': updatedStats.activeHours,
        'user_attributes.activeEarnings': updatedStats.activeEarnings
      });
      
      // Update job offer status
      batch.update(doc(db, 'job_offers', matchId), {
        status: 'accepted',
        respondedAt: new Date().toISOString()
      });
      
      // Update match status
      batch.update(doc(db, 'matches', matchId), {
        status: 'hired'
      });
      
      await batch.commit();
      Alert.alert('Success', 'Offer accepted successfully');
      
    } catch (error) {
      console.error('Error responding to offer:', error);
      Alert.alert('Error', 'Failed to respond to offer. Please try again.');
    }
  };

  // Helper function to update time slots
  const updateTimeSlots = (slots, jobStart, jobEnd) => {
    return slots.reduce((newSlots, slot) => {
      const slotStart = slot.startTime;
      const slotEnd = slot.endTime;
      
      // If slot is completely outside job hours, keep it unchanged
      if (slotEnd <= jobStart || slotStart >= jobEnd) {
        newSlots.push(slot);
      }
      // If slot partially overlaps, split it
      else {
        if (slotStart < jobStart) {
          newSlots.push({
            startTime: slotStart,
            endTime: jobStart
          });
        }
        if (slotEnd > jobEnd) {
          newSlots.push({
            startTime: jobEnd,
            endTime: slotEnd
          });
        }
      }
      return newSlots;
    }, []);
  };

  const handleTimePickerChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setSelectedTime(selectedTime);
    }
  };

  const handleDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      setJobOfferDate(selected);
      setIsButtonEnabled(true);
    }
  };

  const sendJobOffer = () => {
    setShowDatePicker(true);
  };

  const handleSendJobOffer = async (dateTime) => {
    const formattedDateTime = dateTime.toISOString();
    // Your existing job offer sending logic here
    // Use formattedDateTime instead of just the date
  };

  const handleDateTimeSelection = (date, time) => {
    const combinedDateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    // Handle the selected date/time
    console.log('Selected DateTime:', combinedDateTime);
    // Add your logic here to handle the selected date/time
  };

  const renderDateTimePickers = () => {
    return (
      <>
        <Modal
          transparent={true}
          visible={showDatePicker || showTimePicker}
          animationType="fade"
          onRequestClose={() => {
            setShowDatePicker(false);
            setShowTimePicker(false);
          }}
        >
          <TouchableWithoutFeedback 
            onPress={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerContainer}>
                  {showDatePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) {
                          setSelectedDate(date);
                          setShowDatePicker(false);
                          setShowTimePicker(true);
                        }
                      }}
                    />
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      display="default"
                      onChange={(event, time) => {
                        if (time) {
                          setSelectedTime(time);
                          setShowTimePicker(false);
                          handleDateTimeSelection(selectedDate, time);
                        }
                      }}
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </>
    );
  };

  const renderModalContent = () => {
    if (jobOfferStep === 'datetime') {
      return (
        <View style={styles.modalContent}>
          <TouchableOpacity 
            onPress={() => setModalVisible(false)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Schedule Interview</Text>
          {/* ... rest of datetime content ... */}
        </View>
      );
    }

    return (
      <View style={styles.modalContent}>
        <TouchableOpacity 
          onPress={() => setModalVisible(false)}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.modalTitle}>Send Job Offer</Text>
        {/* ... rest of job offer content ... */}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.interviewContainer}>
        <PendingInterviewCard />
      </View>
      <InterviewBanner />
      {renderMessages()}
      
      <View style={styles.suggestionsWrapper}>
        <ScrollView 
          horizontal 
          style={styles.suggestionsContainer}
          showsHorizontalScrollIndicator={false}
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionBubble}
              onPress={() => sendSuggestion(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity 
          style={[
            styles.refreshButton,
            { opacity: isRefreshing ? 0.6 : 1 }
          ]}
          onPress={refreshSuggestions}
          disabled={isRefreshing}
        >
          <Ionicons name="refresh" size={20} color="#1976D2" />
        </TouchableOpacity>
      </View>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={sendMessage}
        >
          <Ionicons name="send" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {isEmployer && (
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => setShowTimeSlotModal(true)}
        >
          <Text style={styles.scheduleButtonText}>Schedule Interview</Text>
        </TouchableOpacity>
      )}

      <TimeSlotModal />
      <WorkerResponseModal />

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onEndTimeChange}
        />
      )}

      {showCalendar && (
        <Modal
          transparent={true}
          visible={showCalendar}
          onRequestClose={() => setShowCalendar(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.calendarContainer}>
              <Calendar
                onDayPress={handleDateSelect}
                minDate={new Date().toISOString().split('T')[0]}
                markedDates={{
                  [selectedDate]: {selected: true, selectedColor: '#007AFF'}
                }}
              />
              
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Start Time:</Text>
                <TextInput
                  style={styles.timeInput}
                  type="time"
                  value={selectedStartTime}
                  onChange={(e) => setSelectedStartTime(e.target.value)}
                  placeholder="HH:MM"
                />
                
                <Text style={styles.timeLabel}>End Time:</Text>
                <TextInput
                  style={styles.timeInput}
                  type="time"
                  value={selectedEndTime}
                  onChange={(e) => setSelectedEndTime(e.target.value)}
                  placeholder="HH:MM"
                />
              </View>

              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={handleTimeSelect}
              >
                <Text style={styles.scheduleButtonText}>Schedule Interview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCalendar(false)}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleStartTimeSelect}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleEndTimeSelect}
        />
      )}

      <PhoneNumberModal />
      <ScheduleModal />
      {role === 'employer' && <PostInterviewModal />}
      <ScheduleModal />

      {isEmployer && (
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.offerButton]}
            onPress={() => setShowJobOfferModal(true)}
          >
            <Text style={styles.buttonText}>Send Job Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={showJobOfferModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Job Offer</Text>
            
            <Text style={styles.sectionTitle}>Select Working Days & Hours</Text>
            {Object.keys(selectedDays).map((day) => (
              <View key={day} style={styles.dayRow}>
                <CheckBox
                  value={selectedDays[day]}
                  onValueChange={(checked) => {
                    setSelectedDays(prev => ({...prev, [day]: checked}));
                  }}
                />
                <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                {selectedDays[day] && (
                  <View style={styles.timeContainer}>
                    <TouchableOpacity 
                      onPress={() => {
                        setActiveDay(day);
                        setActiveTimeField('startTime');
                        setShowTimePicker(true);
                      }}
                    >
                      <Text>Start: {schedules[day].startTime}</Text>
                    </TouchableOpacity>
                    <Text> - </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setActiveDay(day);
                        setActiveTimeField('endTime');
                        setShowTimePicker(true);
                      }}
                    >
                      <Text>End: {schedules[day].endTime}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.wageContainer}>
              <Text style={styles.sectionTitle}>Hourly Wage ($)</Text>
              <TextInput
                style={styles.wageInput}
                placeholder="Hourly wage"
                keyboardType="numeric"
                value={hourlyWage}
                onChangeText={setHourlyWage}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowJobOfferModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]}
                onPress={handleJobOffer}
              >
                <Text style={styles.buttonText}>Send Offer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={new Date(`2000-01-01T${schedules[activeDay][activeTimeField]}`)}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) {
                const timeString = selectedTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                });
                setSchedules(prev => ({
                  ...prev,
                  [activeDay]: {
                    ...prev[activeDay],
                    [activeTimeField]: timeString
                  }
                }));
              }
            }}
          />
        )}
      </Modal>

      {!isEmployer && pendingOffer && (
        <View style={styles.offerContainer}>
          <Text style={styles.offerTitle}>New Job Offer!</Text>
          <Text style={styles.offerDetail}>Hourly Wage: ${pendingOffer.hourlyWage}</Text>
          <Text style={styles.offerDetail}>Schedule:</Text>
          {Object.entries(pendingOffer.schedule).map(([day, times]) => (
            <Text key={day} style={styles.scheduleText}>
              {day.charAt(0).toUpperCase() + day.slice(1)}: {times.startTime} - {times.endTime}
            </Text>
          ))}
          <View style={styles.offerButtons}>
            <TouchableOpacity 
              style={[styles.button, styles.rejectButton]}
              onPress={() => handleOfferResponse(false)}
            >
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.acceptButton]}
              onPress={() => handleOfferResponse(true)}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {renderDateTimePickers()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  chatArea: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  sendButton: {
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 20,
    marginVertical: 5,
  },
  employerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  actionButton: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  employerMessageText: {
    color: '#333333',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  suggestionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  suggestionsContainer: {
    flex: 1,
    maxHeight: 50,
  },
  suggestionBubble: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 5,
  },
  suggestionText: {
    color: '#1976D2',
    fontSize: 14,
  },
  refreshButton: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  scheduleButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 10,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  calendar: {
    marginBottom: 15,
  },
  timeSlotContainer: {
    marginTop: 10,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    width: '70%',
    borderRadius: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  confirmButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    width: '45%',
  },
  cancelButton: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    borderRadius: 5,
    width: '45%',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  phoneInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Fixed-width font
    minWidth: 200, // Set minimum width to prevent layout shifts
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 10,
  },
  suggestionsContainer: {
    maxHeight: 50,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  suggestionButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  suggestionText: {
    color: '#007AFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    padding: 10,
  },
  timeSlotContainer: {
    maxHeight: 300,
    marginVertical: 10,
  },
  timeSlot: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  selectedTimeSlot: {
    backgroundColor: '#007AFF',
  },
  timeSlotText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedTimeSlotText: {
    color: 'white',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
  },
  timeInputContainer: {
    marginTop: 20,
    width: '100%',
  },
  timeLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  scheduleButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  scheduleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ff4444',
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  interviewCard: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  interviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bannerContainer: {
    backgroundColor: '#4CAF50',
    padding: 10,
    width: '100%',
  },
  bannerText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    width: '100%',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  interviewContainer: {
    width: '100%',
    padding: 10,
    zIndex: 1,
  },
  interviewCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 10,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 10,
  },
  dayButton: {
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderRadius: 5,
  },
  selectedDay: {
    backgroundColor: '#007AFF',
  },
  offerCard: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    margin: 10,
    borderRadius: 10,
  },
  offerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 5,
  },
  dayText: {
    marginLeft: 10,
    width: 100,
  },
  timeContainer: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  wageContainer: {
    marginVertical: 20,
  },
  wageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
    padding: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  dateTimeContainer: {
    width: '100%',
    gap: 20,
    marginBottom: 20,
  },
  webDatePicker: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  webTimePicker: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  scheduleButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});