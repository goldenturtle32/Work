import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  DatePickerIOS,
  Clipboard,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { db, auth, firebase } from '../firebase';
import { createInterview } from '../services/firestoreService';
import { Calendar as RNCalendar } from 'react-native-calendars';
import * as ExpoCalendar from 'expo-calendar';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Calendar from 'expo-calendar';

// Add the same getBackendUrl function from UserOverviewScreen.js
const getBackendUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';  // Android Emulator
  } else if (Platform.OS === 'ios') {
    if (Platform.isPad || Platform.isTV) {
      return 'http://localhost:5000';  // iOS Simulator
    } else {
      // For physical iOS devices, use your computer's local IP address
      return 'http://192.168.0.100:5000';  // Your computer's actual IP
    }
  }
  return 'http://localhost:5000';  // Default fallback
};

const BACKEND_URL = getBackendUrl();

// Add this console log to help debug
console.log('Chat using BACKEND_URL:', BACKEND_URL);

// Add this function after your imports but before the component
const createCalendarEvent = async (interviewDetails) => {
  try {
    // Check for calendar permissions first
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Calendar access is needed to add this interview to your calendar');
      return false;
    }
    
    // Get default calendar
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar = calendars.find(
      (cal) => cal.isPrimary && cal.allowsModifications
    ) || calendars[0];
    
    if (!defaultCalendar) {
      Alert.alert('Error', 'No available calendar found on your device');
      return false;
    }
    
    // Parse the interview time slot
    const timeSlot = interviewDetails.timeSlots[0]; // Use the first time slot
    if (!timeSlot) {
      Alert.alert('Error', 'No time slot information found for this interview');
      return false;
    }
    
    const dateStr = timeSlot.date;
    const startTimeStr = timeSlot.startTime;
    const endTimeStr = timeSlot.endTime || timeSlot.startTime; // Fallback if no end time
    
    // Parse date and times
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
    
    // Parse start time
    let startHour = 9, startMinute = 0;
    const startTimeParts = startTimeStr.match(/(\d+):(\d+)\s*([AP]M)?/i);
    if (startTimeParts) {
      startHour = parseInt(startTimeParts[1], 10);
      startMinute = parseInt(startTimeParts[2], 10);
      // Handle PM
      if (startTimeParts[3] && startTimeParts[3].toUpperCase() === 'PM' && startHour < 12) {
        startHour += 12;
      }
      // Handle 12 AM
      if (startTimeParts[3] && startTimeParts[3].toUpperCase() === 'AM' && startHour === 12) {
        startHour = 0;
      }
    }
    
    // Parse end time
    let endHour = startHour + 1, endMinute = startMinute;
    const endTimeParts = endTimeStr.match(/(\d+):(\d+)\s*([AP]M)?/i);
    if (endTimeParts) {
      endHour = parseInt(endTimeParts[1], 10);
      endMinute = parseInt(endTimeParts[2], 10);
      // Handle PM
      if (endTimeParts[3] && endTimeParts[3].toUpperCase() === 'PM' && endHour < 12) {
        endHour += 12;
      }
      // Handle 12 AM
      if (endTimeParts[3] && endTimeParts[3].toUpperCase() === 'AM' && endHour === 12) {
        endHour = 0;
      }
    }
    
    // Create start and end dates
    const startDate = new Date(year, month - 1, day, startHour, startMinute);
    const endDate = new Date(year, month - 1, day, endHour, endMinute);
    
    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert('Error', 'Invalid date or time format');
      return false;
    }
    
    // Get event title and description
    const title = `Interview for ${interviewDetails.jobTitle || 'Position'}`;
    const notes = `Job interview with ${interviewDetails.company || 'Employer'}`;
    
    // Create the event
    const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
      title,
      startDate,
      endDate,
      notes,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [{ relativeOffset: -60 }] // 1 hour reminder
    });
    
    if (eventId) {
      Alert.alert('Success', 'Interview added to your calendar!');
      return true;
    } else {
      throw new Error('Failed to create calendar event');
    }
  } catch (error) {
    console.error('Error adding to calendar:', error);
    Alert.alert('Error', 'Failed to add interview to calendar: ' + error.message);
    return false;
  }
};

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
  const [showPhoneNumberModal, setShowPhoneNumberModal] = useState(false);
  const [phoneNumberForInterview, setPhoneNumberForInterview] = useState('');
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);
  // Add these debug state variables at the top
  const [debugMessages, setDebugMessages] = useState([]);
  // Add this near the top of your component - a simpler approach without listeners
  const [isLoading, setIsLoading] = useState(false);
  // Add this at the top of your component
  const [shouldRenderBanner, setShouldRenderBanner] = useState(true);
  // Add these state variables at the top of your component
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineWithAlternative, setDeclineWithAlternative] = useState(false);
  const [declineInterviewId, setDeclineInterviewId] = useState(null);
  const [alternativeTimeSlots, setAlternativeTimeSlots] = useState([]);
  const [jobOffer, setJobOffer] = useState(null);
  const [workDays, setWorkDays] = useState({
    monday: false, tuesday: false, wednesday: false, thursday: false,
    friday: false, saturday: false, sunday: false
  });
  const [payRate, setPayRate] = useState('');
  const [payPeriod, setPayPeriod] = useState('hourly');
  const [workStartTime, setWorkStartTime] = useState('9:00 AM');
  const [workEndTime, setWorkEndTime] = useState('5:00 PM');
  const [jobDescription, setJobDescription] = useState('');

  const isEmployer = role === 'employer';
  // Corrected to account for matchId format: workerId_employerId
  const otherUserId = matchId?.split('_')[isEmployer ? 0 : 1];

  // Add a debug function
  const addDebugMessage = (message) => {
    console.log('DEBUG:', message);
    setDebugMessages(prev => [...prev, { id: Date.now(), message }]);
  };

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

  // Replace the useEffect that depends on messages with one that depends on role
  // This ensures we get the correct suggestions based on role when the component mounts
  useEffect(() => {
    // Only generate suggestions when role is definitely available
    if (role) {
      console.log(`Initializing suggestions with role: ${role}`);
      // Set initial suggestions based on role while API call is in progress
      setSuggestions(getStaticSuggestions());
      // Then fetch from API
      generateSuggestions();
    }
  }, [role]); // Only depend on role, not messages

  // Add a separate useEffect for message updates, but with a delay
  useEffect(() => {
    if (messages.length > 0) {
      // Use a debounce to avoid too many API calls
      const timer = setTimeout(() => {
        generateSuggestions();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  useEffect(() => {
    // Just do a one-time fetch on mount, no listeners
    const fetchInterviews = async () => {
      console.log('Initial interview fetch');
      setIsLoading(true);
      try {
        const currentUserId = auth.currentUser.uid;
        let pendingQuery, acceptedQuery;
        
        if (role === 'worker') {
          pendingQuery = db.collection('interviews')
            .where('workerId', '==', currentUserId)
            .where('status', '==', 'pending');
            
          acceptedQuery = db.collection('interviews')
            .where('workerId', '==', currentUserId)
            .where('status', '==', 'accepted');
        } else {
          pendingQuery = db.collection('interviews')
            .where('matchId', '==', matchId)
            .where('status', '==', 'pending');
            
          acceptedQuery = db.collection('interviews')
            .where('matchId', '==', matchId)
            .where('status', '==', 'accepted');
        }
        
        // Get both pending and accepted interviews
        const pendingSnapshot = await pendingQuery.get();
        const acceptedSnapshot = await acceptedQuery.get();
        
        console.log(`Found ${pendingSnapshot.docs.length} pending interviews`);
        console.log(`Found ${acceptedSnapshot.docs.length} accepted interviews`);
        
        // Combine both results
        const allInterviews = [
          ...pendingSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })),
          ...acceptedSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        ];
        
        if (allInterviews.length > 0) {
          // Filter out interviews that have already passed
          const activeInterviews = allInterviews.filter(interview => !isInterviewCompleted(interview));
          
          if (activeInterviews.length > 0) {
            console.log(`Found ${activeInterviews.length} active interviews`);
            // Sort by status - show pending first, then accepted
            activeInterviews.sort((a, b) => {
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (a.status !== 'pending' && b.status === 'pending') return 1;
              return 0;
            });
            setPendingInterview(activeInterviews[0]);
          } else {
            console.log('All interviews have passed');
            setPendingInterview(null);
          }
        }
      } catch (error) {
        console.error('Error fetching interviews:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInterviews();
  }, [matchId, role]);

  useEffect(() => {
    // Only set up listeners when component mounts, not on every render
    console.log('Setting up interview listeners');
    
    let unsubscribeInterviews = () => {};
    
    try {
      let interviewQuery;
      const currentUserId = auth.currentUser.uid;
      
      if (role === 'worker') {
        // For workers - look for interviews where they are the worker
        interviewQuery = db.collection('interviews')
          .where('workerId', '==', currentUserId)
          .where('status', '==', 'pending')
          .limit(5); // Limit to avoid large datasets
        console.log(`Setting up worker interview listener for workerId: ${currentUserId}`);
      } else {
        // For employers - look for interviews in this match
        interviewQuery = db.collection('interviews')
          .where('matchId', '==', matchId)
          .where('status', '==', 'pending')
          .limit(5); // Limit to avoid large datasets
        console.log(`Setting up employer interview listener for matchId: ${matchId}`);
      }
      
      // Set up the listener with error handling
      unsubscribeInterviews = interviewQuery.onSnapshot(snapshot => {
        console.log(`Interview listener received ${snapshot.docs.length} interviews`);
        
        if (snapshot.docs.length > 0) {
          // Get the most recent interview
          const interviews = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .sort((a, b) => {
              // Sort by creation time descending (newest first)
              const aTime = a.createdAt?.seconds || 0;
              const bTime = b.createdAt?.seconds || 0;
              return bTime - aTime;
            });
          
          const mostRecentInterview = interviews[0];
          console.log('Found most recent interview:', JSON.stringify(mostRecentInterview));
          
          // Check if this is a new interview (different from current state)
          if (!pendingInterview || pendingInterview.id !== mostRecentInterview.id) {
            console.log('Setting new pending interview state');
            setPendingInterview(mostRecentInterview);
          }
        } else {
          console.log('No pending interviews found, clearing state');
          setPendingInterview(null);
        }
      }, error => {
        console.error('Error in interview listener:', error);
        // Handle the error gracefully - don't crash the UI
        if (error.code === 'failed-precondition') {
          console.log('Missing index error - using alternative query approach');
          // Try a simpler query as fallback
          const simpleQuery = db.collection('interviews')
            .where('status', '==', 'pending')
            .limit(10);
            
          unsubscribeInterviews(); // Clean up the previous listener
          
          unsubscribeInterviews = simpleQuery.onSnapshot(snapshot => {
            // Filter the results client-side
            const relevantInterviews = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter(interview => {
                if (role === 'worker') {
                  return interview.workerId === currentUserId;
                } else {
                  return interview.matchId === matchId;
                }
              })
              .sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
              });
            
            if (relevantInterviews.length > 0) {
              setPendingInterview(relevantInterviews[0]);
            } else {
              setPendingInterview(null);
            }
          }, secondError => {
            console.error('Error in fallback interview listener:', secondError);
            // Give up and just not show interview data
          });
        }
      });
    } catch (setupError) {
      console.error('Error setting up interview listener:', setupError);
    }
    
    // Clean up listener on unmount
    return () => {
      console.log('Cleaning up interview listener');
      if (typeof unsubscribeInterviews === 'function') {
        unsubscribeInterviews();
      }
    };
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

  // Add this function to fetch worker job data
  const fetchWorkerJobData = async (workerId) => {
    console.log('Fetching worker job data for:', workerId);
    try {
      const workerDoc = await db.collection('user_attributes')
        .where('uid', '==', workerId)
        .limit(1)
        .get();
      
      if (workerDoc.empty) {
        console.log('No worker document found');
        return null;
      }
      
      const workerData = workerDoc.docs[0].data();
      const selectedJobs = workerData.selectedJobs || [];
      console.log(`Found ${selectedJobs.length} jobs for worker`);
      
      return selectedJobs;
    } catch (error) {
      console.error('Error fetching worker job data:', error);
      return null;
    }
  };

  // Update the generateSuggestions function to use the correct endpoint
  const generateSuggestions = async () => {
    console.log('Generating suggestions...');
    console.log(`Current role: ${role}`); // Log the current role
    setIsRefreshing(true);
    
    try {
      // Get backend URL (same as your working components)
      const backendUrl = getBackendUrl();
      
      // Create the base payload
      const payload = {
        role: role, // Use the role from route.params
        jobTitle: jobTitle || 'position', // Use the jobTitle from route.params with fallback
        company: company || 'company', // Use the company from route.params with fallback
        recentMessages: messages.slice(0, 10).map(msg => msg.text)
      };
      
      // If we're an employer, fetch and add worker job data
      if (role === 'employer' && otherUserId) {
        console.log('Employer role detected, fetching worker data for:', otherUserId);
        const workerJobs = await fetchWorkerJobData(otherUserId);
        
        if (workerJobs && workerJobs.length > 0) {
          payload.workerJobs = workerJobs;
          console.log('Added worker jobs to payload:', workerJobs.length);
        } else {
          console.log('No worker jobs found');
        }
      }
      
      console.log(`Requesting suggestions with payload:`, JSON.stringify(payload));
      console.log(`Using endpoint: ${backendUrl}/generate-chat-suggestions`);
      
      // Create a timeout to abort the fetch if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${backendUrl}/generate-chat-suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Try to get more detailed error information
          try {
            const errorData = await response.json();
            console.error('Error response from server:', errorData);
            throw new Error(`Server error (${response.status}): ${errorData.error || 'Unknown error'}`);
          } catch (jsonError) {
            // If we can't parse the error as JSON, just use the status
            throw new Error(`Server responded with ${response.status}`);
          }
        }
        
        const data = await response.json();
        console.log('Received suggestions:', data);
        
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          console.log('No suggestions in response, using static suggestions');
          setSuggestions(getStaticSuggestions());
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        // If fetch failed, use static suggestions
        console.log('Using static suggestions due to fetch error');
        setSuggestions(getStaticSuggestions());
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in generateSuggestions:', error);
      setSuggestions(getStaticSuggestions());
    } finally {
      setIsRefreshing(false);
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

  // Fix the refresh suggestions function
  const handleRefreshSuggestions = () => {
    console.log('Manually refreshing suggestions');
    // Use static suggestions since API isn't working
    setSuggestions(getStaticSuggestions());
    setIsRefreshing(false);
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

  // Add this function at the top level of your component to properly extract worker ID
  const getWorkerIdFromMatchId = (matchId, employerId) => {
    console.log('Extracting worker ID from matchId:', matchId, 'employerId:', employerId);
    
    if (!matchId || !matchId.includes('_')) {
      console.error('Invalid matchId format:', matchId);
      return null;
    }
    
    const parts = matchId.split('_');
    if (parts.length !== 2) {
      console.error('Unexpected matchId format:', matchId);
      return null;
    }
    
    // The workerId is always the first part in workerId_employerId format
    const workerId = parts[0];
    console.log('Extracted workerId:', workerId);
    return workerId;
  };

  // Simplified TimeSlotModal component with better state handling
  const TimeSlotModal = () => {
    const [modalTimeSlots, setModalTimeSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedStartTime, setSelectedStartTime] = useState(new Date());
    const [selectedEndTime, setSelectedEndTime] = useState(
      new Date(new Date().setHours(new Date().getHours() + 1))
    );
    const [error, setError] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Format functions
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    const formatTime = (date) => {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };
    
    // Add time slot
    const addTimeSlot = () => {
      console.log('Add time slot button pressed');
      setError('');
      
      if (selectedStartTime >= selectedEndTime) {
        setError('End time must be after start time');
        return;
      }
      
      const newSlot = {
        date: formatDate(selectedDate),
        startTime: formatTime(selectedStartTime),
        endTime: formatTime(selectedEndTime)
      };
      
      console.log('Adding new time slot:', newSlot);
      setModalTimeSlots([...modalTimeSlots, newSlot]);
    };
    
    // Remove time slot
    const removeTimeSlot = (index) => {
      const updatedSlots = [...modalTimeSlots];
      updatedSlots.splice(index, 1);
      setModalTimeSlots(updatedSlots);
    };
    
    // Handle confirm with separate state handling
    const handleConfirm = async () => {
      console.log('Confirm button pressed. Current time slots:', modalTimeSlots);
      
      if (modalTimeSlots.length === 0) {
        setError('Please add at least one time slot');
        return;
      }
      
      setIsSubmitting(true);
      
      try {
        const employerId = auth.currentUser.uid;
        const workerId = matchId.split('_').filter(id => id !== employerId)[0];
        
        // Create a unique ID for the interview
        const interviewId = `interview_${Date.now()}`;
        
        // Create the interview document
        await db.collection('interviews').doc(interviewId).set({
          matchId,
          employerId,
          workerId,
          status: 'pending',
          timeSlots: modalTimeSlots,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add system message to chat
        await db.collection('chats')
          .doc(matchId)
          .collection('messages')
          .add({
            text: `Interview request sent: ${modalTimeSlots[0].date} at ${modalTimeSlots[0].startTime}`,
            sender: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isNotification: true
          });
        
        // First close the modal to prevent UI freeze
        setShowTimeSlotModal(false);
        
        // Use setTimeout to delay the state update and alert
        setTimeout(() => {
          // Manually fetch the interview data
          db.collection('interviews').doc(interviewId).get()
            .then(doc => {
              if (doc.exists) {
                setPendingInterview({
                  id: doc.id,
                  ...doc.data()
                });
                
                // Show success message after state is updated
                Alert.alert(
                  'Success', 
                  'Interview request sent successfully!'
                );
              }
            })
            .catch(error => {
              console.error('Error fetching new interview:', error);
            });
        }, 500);
      } catch (error) {
        console.error('Error creating interview:', error);
        Alert.alert('Error', 'Failed to schedule interview: ' + error.message);
        setIsSubmitting(false);
      }
    };
    
    return (
      <Modal
        visible={showTimeSlotModal}
        animationType="slide"
        transparent={true}
      >
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Schedule Interview</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
              <Text style={styles.sectionTitle}>Add Interview Time Slot</Text>
              
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerButtonText}>
                  Date: {formatDate(selectedDate)}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) setSelectedDate(date);
                  }}
                />
              )}
              
              <View style={styles.timePickersContainer}>
                <View style={styles.timePicker}>
                  <Text>Start Time</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.timePickerButtonText}>
                      {formatTime(selectedStartTime)}
                    </Text>
                  </TouchableOpacity>
                  
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={selectedStartTime}
                      mode="time"
                      display="default"
                      onChange={(event, time) => {
                        setShowStartTimePicker(false);
                        if (time) setSelectedStartTime(time);
                      }}
                    />
                  )}
                </View>
                
                <View style={styles.timePicker}>
                  <Text>End Time</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={styles.timePickerButtonText}>
                      {formatTime(selectedEndTime)}
                    </Text>
                  </TouchableOpacity>
                  
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={selectedEndTime}
                      mode="time"
                      display="default"
                      onChange={(event, time) => {
                        setShowEndTimePicker(false);
                        if (time) setSelectedEndTime(time);
                      }}
                    />
                  )}
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.addButton}
                onPress={addTimeSlot}
              >
                <Text style={styles.addButtonText}>Add Time Slot</Text>
              </TouchableOpacity>
              
              <Text style={styles.sectionTitle}>Selected Time Slots</Text>
              
              {modalTimeSlots.length === 0 && (
                <Text style={styles.noSlotsText}>No time slots added yet</Text>
              )}
              
              <ScrollView style={styles.slotsList}>
                {modalTimeSlots.map((slot, index) => (
                  <View key={index} style={styles.timeSlotItem}>
                    <Text style={styles.timeSlotText}>
                      {slot.date} from {slot.startTime} to {slot.endTime}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeTimeSlot(index)}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowTimeSlotModal(false);
                    setModalTimeSlots([]);
                    setError('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.confirmButton,
                    (isSubmitting || modalTimeSlots.length === 0) ? styles.disabledButton : null
                  ]}
                  onPress={handleConfirm}
                  disabled={isSubmitting || modalTimeSlots.length === 0}
                >
                  <Text style={styles.buttonText}>
                    {isSubmitting ? 'Sending...' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
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

  const handleAcceptInterview = async (interviewId) => {
    try {
      console.log('Accepting interview:', interviewId);
      
      // First, check if we have the worker's phone number
      const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
      const userPhone = userDoc.data()?.phoneNumber;
      
      if (!userPhone) {
        // If no phone number is found, prompt the user for it
        Alert.prompt(
          'Phone Number Required',
          'Please provide your phone number so the employer can contact you',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Submit',
              onPress: async (phoneNumber) => {
                if (!phoneNumber || phoneNumber.trim().length < 10) {
                  Alert.alert('Invalid Phone Number', 'Please enter a valid phone number');
                  return;
                }
                
                // Update user record with phone number
                await db.collection('users').doc(auth.currentUser.uid).update({
                  phoneNumber: phoneNumber.trim()
                });
                
                // Continue with acceptance
                completeInterviewAcceptance(interviewId, phoneNumber.trim());
              }
            }
          ],
          'plain-text'
        );
      } else {
        // If we already have the phone number, continue with acceptance
        completeInterviewAcceptance(interviewId, userPhone);
      }
    } catch (error) {
      console.error('Error accepting interview:', error);
      Alert.alert('Error', 'Failed to accept interview: ' + error.message);
    }
  };

  // Helper function to complete the interview acceptance process
  const completeInterviewAcceptance = async (interviewId, phoneNumber) => {
    try {
      // Get the selected time slot
      const selectedSlot = selectedTimeSlot;
      if (!selectedSlot) {
        Alert.alert('Error', 'Please select a time slot');
        return;
      }
      
      // Update the interview in Firestore
      await db.collection('interviews').doc(interviewId).update({
        status: 'accepted',
        selectedTimeSlot: selectedSlot,
        phoneNumber: phoneNumber,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedToCalendar: false // Initialize the flag to false
      });
      
      // Add a message to the chat
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: `I've accepted the interview for ${selectedSlot.date} from ${selectedSlot.startTime} to ${selectedSlot.endTime}.`,
          sender: role,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      
      // Close the modal and reset state
      setShowPhoneNumberModal(false);
      setSelectedTimeSlot(null);
      setPhoneNumberForInterview('');
      setSelectedInterviewId(null);
      
      // Refresh interviews to update the UI
      refreshInterviews();
      
      // Show success message
      Alert.alert('Success', 'Interview accepted!');
    } catch (error) {
      console.error('Error accepting interview:', error);
      Alert.alert('Error', 'Failed to accept interview. Please try again.');
    }
  };

  const handleDeclineInterview = (interviewId) => {
    setDeclineInterviewId(interviewId);
    setShowDeclineModal(true);
  };

  // Create a function to complete the decline process
  const confirmDeclineInterview = async (suggestAlternative = false) => {
    try {
      if (!declineInterviewId) return;
      
      // Get the interview data
      const interviewDoc = await db.collection('interviews').doc(declineInterviewId).get();
      const interviewData = interviewDoc.data();
      
      // Update the interview status to declined
      await db.collection('interviews').doc(declineInterviewId).update({
        status: 'declined',
        declinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        alternativeSuggested: suggestAlternative
      });
      
      // Add system message about the decline
      const messageText = suggestAlternative 
        ? `Interview request declined with alternative times suggested.` 
        : `Interview request declined.`;
      
      await db.collection('chats')
        .doc(interviewData.matchId)
        .collection('messages')
        .add({
          text: messageText,
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          isNotification: true
        });
      
      // If suggesting alternative times, send those as a separate message
      if (suggestAlternative && alternativeTimeSlots.length > 0) {
        let alternativesText = "I can't make the suggested time, but here are some alternatives that work for me:\n";
        
        alternativeTimeSlots.forEach((slot, index) => {
          alternativesText += `\n- ${slot.date} from ${slot.startTime} to ${slot.endTime}`;
        });
        
        // Send the alternatives as a regular chat message from the worker
        await db.collection('chats')
          .doc(interviewData.matchId)
          .collection('messages')
          .add({
            text: alternativesText,
            sender: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
      }
      
      // Reset state
      setDeclineInterviewId(null);
      setAlternativeTimeSlots([]);
      setDeclineWithAlternative(false);
      setShowDeclineModal(false);
      setPendingInterview(null); // Remove the banner
      
      Alert.alert('Success', 'Interview request declined');
    } catch (error) {
      console.error('Error declining interview:', error);
      Alert.alert('Error', 'Failed to decline interview: ' + error.message);
    }
  };

  // Add the DeclineInterviewModal component
  const DeclineInterviewModal = () => {
    // Date/time selection state
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedStartTime, setSelectedStartTime] = useState(new Date());
    const [selectedEndTime, setSelectedEndTime] = useState(
      new Date(new Date().setHours(new Date().getHours() + 1))
    );
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    
    // Format functions
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    const formatTime = (date) => {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };
    
    // Add time slot
    const addAlternativeSlot = () => {
      if (selectedStartTime >= selectedEndTime) {
        Alert.alert('Invalid Time', 'End time must be after start time');
        return;
      }
      
      const newSlot = {
        date: formatDate(selectedDate),
        startTime: formatTime(selectedStartTime),
        endTime: formatTime(selectedEndTime)
      };
      
      setAlternativeTimeSlots([...alternativeTimeSlots, newSlot]);
    };
    
    // Remove time slot
    const removeAlternativeSlot = (index) => {
      const updatedSlots = [...alternativeTimeSlots];
      updatedSlots.splice(index, 1);
      setAlternativeTimeSlots(updatedSlots);
    };
    
    // Main modal content based on the state
    const renderModalContent = () => {
      if (!declineWithAlternative) {
        return (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Decline Interview?</Text>
            <Text style={styles.modalText}>
              Would you like to suggest alternative times that work better for you?
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={() => confirmDeclineInterview(false)}
              >
                <Text style={styles.buttonText}>Just Decline</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.alternativeButton]}
                onPress={() => setDeclineWithAlternative(true)}
              >
                <Text style={styles.buttonText}>Suggest Alternatives</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      
      // Alternative time selection UI
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Suggest Alternative Times</Text>
          
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickerButtonText}>
              Date: {formatDate(selectedDate)}
            </Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
          
          <View style={styles.timePickersContainer}>
            <View style={styles.timePicker}>
              <Text>Start Time</Text>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.timePickerButtonText}>
                  {formatTime(selectedStartTime)}
                </Text>
              </TouchableOpacity>
              
              {showStartTimePicker && (
                <DateTimePicker
                  value={selectedStartTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowStartTimePicker(false);
                    if (time) setSelectedStartTime(time);
                  }}
                />
              )}
            </View>
            
            <View style={styles.timePicker}>
              <Text>End Time</Text>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.timePickerButtonText}>
                  {formatTime(selectedEndTime)}
                </Text>
              </TouchableOpacity>
              
              {showEndTimePicker && (
                <DateTimePicker
                  value={selectedEndTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowEndTimePicker(false);
                    if (time) setSelectedEndTime(time);
                  }}
                />
              )}
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={addAlternativeSlot}
          >
            <Text style={styles.addButtonText}>Add Time Slot</Text>
          </TouchableOpacity>
          
          <Text style={styles.sectionTitle}>Your Suggested Times</Text>
          
          {alternativeTimeSlots.length === 0 && (
            <Text style={styles.noSlotsText}>No alternatives added yet</Text>
          )}
          
          <ScrollView style={styles.slotsList}>
            {alternativeTimeSlots.map((slot, index) => (
              <View key={index} style={styles.timeSlotItem}>
                <Text style={styles.timeSlotText}>
                  {slot.date} from {slot.startTime} to {slot.endTime}
                </Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeAlternativeSlot(index)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setDeclineWithAlternative(false);
                setAlternativeTimeSlots([]);
              }}
            >
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.confirmButton,
                alternativeTimeSlots.length === 0 ? styles.disabledButton : null
              ]}
              onPress={() => confirmDeclineInterview(true)}
              disabled={alternativeTimeSlots.length === 0}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };
    
    return (
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDeclineModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContentWrapper}>
                {renderModalContent()}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // Modify the PendingInterviewCard component to properly handle worker view
  const PendingInterviewCard = React.memo(({ pendingInterview }) => {
    console.log('Rendering PendingInterviewCard component');
    
    if (!pendingInterview) {
      console.log('No pending interview, not showing card');
      return null;
    }
    
    console.log(`Showing interview card with status: ${pendingInterview.status}`);
    
    // Render time slots
    const renderTimeSlots = () => {
      if (pendingInterview.timeSlots && pendingInterview.timeSlots.length > 0) {
        return (
          <View>
            <Text style={styles.interviewBannerTitle}>
              {pendingInterview.status === 'pending' 
                ? 'Interview Request:' 
                : 'Scheduled Interview:'}
            </Text>
            {pendingInterview.timeSlots.map((slot, index) => (
              <Text key={index} style={styles.interviewBannerDetails}>
                {slot.date} from {slot.startTime} to {slot.endTime}
              </Text>
            ))}
          </View>
        );
      } else {
        return (
          <Text style={styles.interviewBannerDetails}>
            Interview details not available
          </Text>
        );
      }
    };
    
    return (
      <View style={styles.interviewContainer}>
        <View style={styles.interviewBanner}>
          <View style={styles.interviewBannerContent}>
            <Ionicons 
              name={pendingInterview.status === 'pending' ? "time-outline" : "checkmark-circle-outline"} 
              size={24} 
              color={pendingInterview.status === 'pending' ? "#1e3a8a" : "#10b981"} 
            />
            <View style={styles.interviewBannerTextContainer}>
              {renderTimeSlots()}
            </View>
          </View>
          
          {/* Buttons for different statuses and roles */}
          <View style={styles.interviewButtonContainer}>
            {pendingInterview.status === 'pending' && role === 'worker' && (
              <>
                <TouchableOpacity
                  style={[styles.interviewButton, styles.acceptButton]}
                  onPress={() => handleAcceptInterview(pendingInterview.id)}
                >
                  <Text style={styles.interviewButtonText}>Accept</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.interviewButton, styles.rejectButton]}
                  onPress={() => handleDeclineInterview(pendingInterview.id)}
                >
                  <Text style={styles.interviewButtonText}>Decline</Text>
                </TouchableOpacity>
              </>
            )}
            
            {pendingInterview.status === 'accepted' && !pendingInterview.addedToCalendar && (
              <TouchableOpacity
                style={[styles.interviewButton, styles.calendarButton]}
                onPress={() => addToCalendar(pendingInterview)}
              >
                <Text style={styles.interviewButtonText}>Add to Calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  });

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
          
          <RNCalendar
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
      
      // Request calendar permissions if accepting offer
      const hasPermission = await requestCalendarPermissions();
      
      if (hasPermission) {
        // Create calendar events for each scheduled day
        const schedulePromises = Object.entries(offerData.schedule).map(async ([day, times]) => {
          // Get the next occurrence of this weekday
          const nextDate = getNextDayOfWeek(day);
          
          // Create calendar event
          const eventDetails = {
            title: `Work: ${offerData.jobTitle || 'Work Shift'}`,
            startDate: combineDateAndTime(nextDate, times.startTime),
            endDate: combineDateAndTime(nextDate, times.endTime),
            location: offerData.workLocation || '',
            notes: `Hourly wage: $${offerData.hourlyWage}`,
            recurrenceRule: {
              frequency: ExpoCalendar.Frequency.WEEKLY,
              interval: 1,
              endDate: null // Continues indefinitely
            },
            alarms: [{ relativeOffset: -60 }] // 1 hour reminder
          };

          try {
            const calendarId = await createCalendarIfNeeded();
            await ExpoCalendar.createEventAsync(calendarId, eventDetails);
          } catch (error) {
            console.error('Error creating calendar event:', error);
            // Continue with other events even if one fails
          }
        });

        await Promise.all(schedulePromises);
      }

      // ... rest of existing acceptance code ...

      Alert.alert(
        'Success',
        'Job offer accepted and work schedule added to your calendar!'
      );
      
    } catch (error) {
      console.error('Error handling offer response:', error);
      Alert.alert('Error', 'Failed to process offer response');
    }
  };

  // Helper function to create a dedicated calendar if it doesn't exist
  const createCalendarIfNeeded = async () => {
    const calendars = await ExpoCalendar.getCalendarsAsync();
    const workCalendar = calendars.find(cal => cal.title === 'Work Schedule');
    
    if (workCalendar) {
      return workCalendar.id;
    }

    // Create new calendar
    const defaultCalendarSource =
      Platform.OS === 'ios'
        ? await getDefaultCalendarSource()
        : { isLocalAccount: true, name: 'Work Schedule' };

    const newCalendarID = await ExpoCalendar.createCalendarAsync({
      title: 'Work Schedule',
      color: '#2563eb',
      entityType: ExpoCalendar.EntityTypes.EVENT,
      sourceId: defaultCalendarSource.id,
      source: defaultCalendarSource,
      name: 'workSchedule',
      ownerAccount: 'personal',
      accessLevel: ExpoCalendar.CalendarAccessLevel.OWNER,
    });

    return newCalendarID;
  };

  // Helper function to get the next occurrence of a weekday
  const getNextDayOfWeek = (dayName) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date();
    const targetDay = days.indexOf(dayName.toLowerCase());
    const todayDay = today.getDay();
    
    let daysUntilTarget = targetDay - todayDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    const nextDate = new Date();
    nextDate.setDate(today.getDate() + daysUntilTarget);
    return nextDate;
  };

  // Helper function to combine date and time
  const combineDateAndTime = (date, timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  };

  // Add this function to handle calendar permissions and creation
  const getDefaultCalendarSource = async () => {
    const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
    const defaultCalendars = calendars.filter(each => each.source.name === 'Default');
    return defaultCalendars[0].source;
  };

  // Add this function to request calendar permissions
  const requestCalendarPermissions = async () => {
    const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      return true;
    }
    Alert.alert(
      'Permission Required',
      'Calendar access is needed to add your work schedule',
      [{ text: 'OK' }]
    );
    return false;
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

  // Update the render section of your component to handle this banner display
  // Add this where you want the banner to appear (just once)
  const renderInterviewBanner = () => {
    // Don't render the banner if it shouldn't be rendered, there's no pending interview,
    // if the interview time has passed, or if there are no time slots
    if (!shouldRenderBanner || 
        !pendingInterview || 
        isInterviewCompleted(pendingInterview) ||
        !pendingInterview.timeSlots || 
        pendingInterview.timeSlots.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.interviewContainer}>
        <View style={styles.interviewBanner}>
          <View style={styles.interviewBannerContent}>
            <Ionicons 
              name={pendingInterview.status === 'pending' ? "time-outline" : "checkmark-circle-outline"} 
              size={24} 
              color={pendingInterview.status === 'pending' ? "#1e3a8a" : "#10b981"} 
            />
            <View style={styles.interviewBannerTextContainer}>
              <View>
                <Text style={styles.interviewBannerTitle}>
                  {pendingInterview.status === 'pending' 
                    ? 'Interview Request:' 
                    : 'Scheduled Interview:'}
                </Text>
                {pendingInterview.timeSlots.map((slot, index) => (
                  <Text key={index} style={styles.interviewBannerDetails}>
                    {slot.date} from {slot.startTime} to {slot.endTime}
                  </Text>
                ))}
              </View>
            </View>
          </View>
          
          {/* Buttons for different statuses and roles */}
          <View style={styles.interviewButtonContainer}>
            {pendingInterview.status === 'pending' && role === 'worker' && (
              <>
                <TouchableOpacity
                  style={[styles.interviewButton, styles.acceptButton]}
                  onPress={() => handleAcceptInterview(pendingInterview.id)}
                >
                  <Text style={styles.interviewButtonText}>Accept</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.interviewButton, styles.rejectButton]}
                  onPress={() => handleDeclineInterview(pendingInterview.id)}
                >
                  <Text style={styles.interviewButtonText}>Decline</Text>
                </TouchableOpacity>
              </>
            )}
            
            {pendingInterview.status === 'accepted' && !pendingInterview.addedToCalendar && (
              <TouchableOpacity
                style={[styles.interviewButton, styles.calendarButton]}
                onPress={() => addToCalendar(pendingInterview)}
              >
                <Text style={styles.interviewButtonText}>Add to Calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const addToCalendar = async (interview) => {
    try {
      const eventId = await createCalendarEvent(interview);
      if (eventId) {
        // Update the interview in Firestore to mark it as added to calendar
        await db.collection('interviews').doc(interview.id).update({
          addedToCalendar: true
        });
        
        // Update the local state to reflect this change
        setPendingInterview({
          ...pendingInterview,
          addedToCalendar: true
        });
        
        Alert.alert('Success', 'Interview added to your calendar');
      } else {
        Alert.alert('Error', 'Failed to add interview to calendar');
      }
    } catch (error) {
      console.error('Error adding to calendar:', error);
      Alert.alert('Error', 'Failed to add interview to calendar');
    }
  };

  const PhoneNumberModal = () => {
    return (
      <Modal
        visible={showPhoneNumberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneNumberModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPhoneNumberModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Enter Your Phone Number</Text>
                <Text style={styles.modalText}>
                  Please provide your phone number for the interview contact.
                </Text>
                
                <TextInput
                  style={styles.phoneNumberInput}
                  placeholder="Your phone number"
                  value={phoneNumberForInterview}
                  onChangeText={setPhoneNumberForInterview}
                  keyboardType="phone-pad"
                  autoFocus
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowPhoneNumberModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handlePhoneNumberSubmit}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const handlePhoneNumberSubmit = async () => {
    if (!phoneNumberForInterview.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    try {
      // Format the phone number
      const formattedPhoneNumber = formatPhoneNumber(phoneNumberForInterview);
      
      // Update the interview with the phone number
      await db.collection('interviews').doc(selectedInterviewId).update({
        phoneNumber: formattedPhoneNumber,
        status: 'accepted',
        acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Get the updated interview data
      const interviewDoc = await db.collection('interviews').doc(selectedInterviewId).get();
      const interviewData = interviewDoc.data();
      
      // Create calendar event
      const eventId = await createCalendarEvent(interviewData);
      
      // Update interview with calendar event ID if created
      if (eventId) {
        await db.collection('interviews').doc(selectedInterviewId).update({
          calendarEventId: eventId
        });
      }
      
      // Update match status
      await db.collection('matches').doc(matchId).update({
        interviewStatus: 'accepted'
      });
      
      // Add system message
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: 'Interview request accepted',
          senderId: 'system',
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'interview_accepted',
          interviewId: selectedInterviewId
        });
      
      setShowPhoneNumberModal(false);
      setPhoneNumberForInterview('');
      setSelectedInterviewId(null);
      
      Alert.alert(
        'Interview Accepted', 
        eventId ? 'The interview has been added to your calendar.' : 'The interview has been accepted.'
      );
    } catch (error) {
      console.error('Error accepting interview:', error);
      Alert.alert('Error', 'Failed to accept interview');
    }
  };

  // Add this simple refresh function
  const refreshInterviews = async () => {
    setIsLoading(true);
    try {
      const currentUserId = auth.currentUser.uid;
      let pendingQuery, acceptedQuery;
      
      if (role === 'worker') {
        pendingQuery = db.collection('interviews')
          .where('workerId', '==', currentUserId)
          .where('status', '==', 'pending');
          
        acceptedQuery = db.collection('interviews')
          .where('workerId', '==', currentUserId)
          .where('status', '==', 'accepted');
      } else {
        pendingQuery = db.collection('interviews')
          .where('matchId', '==', matchId)
          .where('status', '==', 'pending');
          
        acceptedQuery = db.collection('interviews')
          .where('matchId', '==', matchId)
          .where('status', '==', 'accepted');
      }
      
      // Get both pending and accepted interviews
      const pendingSnapshot = await pendingQuery.get();
      const acceptedSnapshot = await acceptedQuery.get();
      
      console.log(`Refresh found ${pendingSnapshot.docs.length} pending interviews`);
      console.log(`Refresh found ${acceptedSnapshot.docs.length} accepted interviews`);
      
      // Combine both results
      const allInterviews = [
        ...pendingSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })),
        ...acceptedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      ];
      
      if (allInterviews.length > 0) {
        // Filter out interviews that have already passed
        const activeInterviews = allInterviews.filter(interview => !isInterviewCompleted(interview));
        
        if (activeInterviews.length > 0) {
          console.log(`Found ${activeInterviews.length} active interviews after refresh`);
          // Sort by status - show pending first, then accepted
          activeInterviews.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return 0;
          });
          setPendingInterview(activeInterviews[0]);
        } else {
          console.log('All interviews have passed');
          setPendingInterview(null);
        }
      } else {
        setPendingInterview(null);
      }
    } catch (error) {
      console.error('Error refreshing interviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the duplicate banner issue and improve the worker acceptance flow
  // Add this function to deduplicate interviews
  const removeDuplicateInterviews = (interviews) => {
    const uniqueIds = new Set();
    return interviews.filter(interview => {
      if (uniqueIds.has(interview.id)) {
        return false;
      }
      uniqueIds.add(interview.id);
      return true;
    });
  };

  // Update the useEffect for fetching interviews
  useEffect(() => {
    console.log('Setting up interview listener with matchId:', matchId);
    
    // Get user ID for queries
    const currentUserId = auth.currentUser.uid;
    
    // Create appropriate query based on user role
    let interviewQuery;
    if (role === 'worker') {
      interviewQuery = db.collection('interviews')
        .where('workerId', '==', currentUserId)
        .where('status', 'in', ['pending', 'accepted'])
        .orderBy('createdAt', 'desc');
    } else {
      interviewQuery = db.collection('interviews')
        .where('matchId', '==', matchId)
        .where('status', 'in', ['pending', 'accepted'])
        .orderBy('createdAt', 'desc');
    }
    
    // Set up listener
    const unsubscribeInterviews = interviewQuery.onSnapshot(snapshot => {
      console.log(`Interview listener received ${snapshot.docs.length} interviews`);
      
      if (snapshot.docs.length > 0) {
        // Get all interviews and deduplicate them
        const interviews = removeDuplicateInterviews(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );
        
        // Sort by status (pending first, then accepted)
        interviews.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return 0;
        });
        
        console.log('Setting pending interview state with:', interviews[0]);
        setPendingInterview(interviews[0]);
      } else {
        console.log('No interviews found, clearing state');
        setPendingInterview(null);
      }
    });
    
    return () => {
      console.log('Cleaning up interview listener');
      unsubscribeInterviews();
    };
  }, [matchId, role]);

  // Add this function to check if an interview has completed
  const isInterviewCompleted = (interview) => {
    if (!interview || !interview.timeSlots || interview.timeSlots.length === 0) {
      return false;
    }
    
    const latestSlot = interview.timeSlots[interview.timeSlots.length - 1];
    const endDateTime = new Date(`${latestSlot.date} ${latestSlot.endTime}`);
    
    return new Date() > endDateTime;
  };

  // Add these functions for job offer handling
  const handleCreateJobOffer = async () => {
    try {
      if (!payRate || payRate <= 0) {
        Alert.alert('Invalid Pay', 'Please enter a valid pay rate');
        return;
      }
      
      const anyDaySelected = Object.values(workDays).some(day => day);
      if (!anyDaySelected) {
        Alert.alert('Schedule Required', 'Please select at least one work day');
        return;
      }
      
      const employerId = auth.currentUser.uid;
      const workerId = matchId.split('_').filter(id => id !== employerId)[0];
      
      const jobOfferData = {
        matchId,
        employerId,
        workerId,
        workDays,
        workHours: {
          start: workStartTime,
          end: workEndTime
        },
        pay: {
          rate: parseFloat(payRate),
          period: payPeriod
        },
        description: jobDescription.trim(),
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const jobOfferId = `jobOffer_${matchId}_${Date.now()}`;
      await db.collection('jobOffers').doc(jobOfferId).set(jobOfferData);
      
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: `Job offer sent: $${payRate} ${payPeriod}`,
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          isNotification: true
        });
      
      setShowJobOfferModal(false);
      resetJobOfferForm();
      
      Alert.alert('Success', 'Job offer sent successfully');
    } catch (error) {
      console.error('Error sending job offer:', error);
      Alert.alert('Error', 'Failed to send job offer: ' + error.message);
    }
  };

  const handleAcceptJobOffer = async (offerId) => {
    try {
      await db.collection('jobOffers').doc(offerId).update({
        status: 'accepted',
        acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: 'Job offer accepted! 🎉',
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          isNotification: true
        });
      
      Alert.alert('Success', 'You have accepted the job offer');
    } catch (error) {
      console.error('Error accepting job offer:', error);
      Alert.alert('Error', 'Failed to accept job offer: ' + error.message);
    }
  };

  const handleDeclineJobOffer = async (offerId) => {
    try {
      await db.collection('jobOffers').doc(offerId).update({
        status: 'declined',
        declinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add({
          text: 'Job offer declined.',
          sender: 'system',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          isNotification: true
        });
      
      Alert.alert('Declined', 'You have declined the job offer');
    } catch (error) {
      console.error('Error declining job offer:', error);
      Alert.alert('Error', 'Failed to decline job offer: ' + error.message);
    }
  };

  const resetJobOfferForm = () => {
    setWorkDays({
      monday: false, tuesday: false, wednesday: false, thursday: false,
      friday: false, saturday: false, sunday: false
    });
    setPayRate('');
    setPayPeriod('hourly');
    setJobDescription('');
  };

  // Add job offer listener to an existing useEffect or create a new one
  useEffect(() => {
    let jobOffersQuery;
    
    if (role === 'worker') {
      jobOffersQuery = db.collection('jobOffers')
        .where('workerId', '==', auth.currentUser.uid)
        .where('matchId', '==', matchId);
    } else {
      jobOffersQuery = db.collection('jobOffers')
        .where('matchId', '==', matchId);
    }
    
    const unsubscribeJobOffers = jobOffersQuery.onSnapshot(snapshot => {
      if (snapshot.docs.length > 0) {
        // Get the most recent offer
        const offers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by most recent
        offers.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
        setJobOffer(offers[0]);
      }
    });
    
    return () => {
      if (unsubscribeJobOffers) unsubscribeJobOffers();
    };
  }, [matchId, role]);

  // Add this right before your existing return statement
  // Create a simple Job Offer Modal
  const JobOfferModal = () => (
    <Modal
      visible={showJobOfferModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowJobOfferModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContainer}>
          <Text style={styles.modalTitle}>Create Job Offer</Text>
          
          <Text style={styles.sectionTitle}>Work Days</Text>
          <View style={styles.workDaysContainer}>
            {Object.keys(workDays).map(day => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.workDayButton,
                  workDays[day] && styles.workDaySelected
                ]}
                onPress={() => setWorkDays({...workDays, [day]: !workDays[day]})}
              >
                <Text style={workDays[day] ? styles.dayTextSelected : styles.dayText}>
                  {day.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.sectionTitle}>Work Hours</Text>
          <View style={styles.hoursContainer}>
            <TextInput
              style={styles.timeInput}
              value={workStartTime}
              onChangeText={setWorkStartTime}
              placeholder="Start Time"
            />
            <Text style={styles.timeSeperator}>to</Text>
            <TextInput
              style={styles.timeInput}
              value={workEndTime}
              onChangeText={setWorkEndTime}
              placeholder="End Time"
            />
          </View>
          
          <Text style={styles.sectionTitle}>Pay</Text>
          <View style={styles.payContainer}>
            <TextInput
              style={styles.payInput}
              placeholder="Amount"
              value={payRate}
              onChangeText={setPayRate}
              keyboardType="numeric"
            />
            
            <View style={styles.payPeriodContainer}>
              {['hourly', 'daily', 'weekly'].map(period => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.payPeriodButton,
                    payPeriod === period && styles.payPeriodSelected
                  ]}
                  onPress={() => setPayPeriod(period)}
                >
                  <Text style={payPeriod === period ? styles.periodTextSelected : styles.periodText}>
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <TextInput
            style={styles.descriptionInput}
            placeholder="Job Description (Optional)"
            value={jobDescription}
            onChangeText={setJobDescription}
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowJobOfferModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={handleCreateJobOffer}
            >
              <Text style={styles.confirmButtonText}>Send Offer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Create Job Offer Banner for workers to see offers
  const renderJobOfferBanner = () => {
    if (!jobOffer || jobOffer.status !== 'pending' || role !== 'worker') return null;
    
    // Format work days
    const workDaysText = Object.entries(jobOffer.workDays)
      .filter(([_, isSelected]) => isSelected)
      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
    
    return (
      <View style={styles.offerContainer}>
        <View style={styles.offerContent}>
          <Ionicons name="briefcase-outline" size={24} color="#1e3a8a" />
          <View style={styles.offerTextContainer}>
            <Text style={styles.offerTitle}>Job Offer</Text>
            <Text style={styles.offerDetail}>Days: {workDaysText}</Text>
            <Text style={styles.offerDetail}>
              Hours: {jobOffer.workHours.start} to {jobOffer.workHours.end}
            </Text>
            <Text style={styles.offerDetail}>
              Pay: ${jobOffer.pay.rate} {jobOffer.pay.period}
            </Text>
            {jobOffer.description ? (
              <Text style={styles.offerDetail}>{jobOffer.description}</Text>
            ) : null}
          </View>
        </View>
        
        <View style={styles.offerButtons}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleDeclineJobOffer(jobOffer.id)}
          >
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptJobOffer(jobOffer.id)}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Add a button for employer to send job offer (after interview)
  const renderSendJobOfferButton = () => {
    if (role !== 'employer' || !pendingInterview || !isInterviewCompleted(pendingInterview)) {
      return null;
    }
    
    return (
      <TouchableOpacity
        style={styles.sendOfferButton}
        onPress={() => setShowJobOfferModal(true)}
      >
        <Text style={styles.sendOfferButtonText}>Send Job Offer</Text>
      </TouchableOpacity>
    );
  };

  const handleSendMessage = async (messageText) => {
    try {
      // Create a new message
      const newMessage = {
        id: Date.now().toString(),
        text: messageText,
        timestamp: new Date().toISOString(),
        user: currentUser.uid,
        role: 'user',
      };

      // Add to messages state immediately for UI responsiveness
      setMessages(prevMessages => [...prevMessages, newMessage]);
      
      console.log(`Sending message to backend: ${messageText}`);
      console.log(`Using endpoint: ${BACKEND_URL}/get-suggestions`);
      
      // Add a test request first to check connectivity
      try {
        console.log('Testing backend connection...');
        const testResponse = await fetch(`${BACKEND_URL}/test-backend`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        const testData = await testResponse.json();
        console.log('Backend test response:', testData);
      } catch (testError) {
        console.error('Backend test failed:', testError);
        // Continue with the main request even if the test fails
      }

      // Make the main request with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${BACKEND_URL}/get-suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            message: messageText,
            userId: currentUser.uid,
            // Add any other data needed by the backend
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received response from backend:', data);
        
        if (data.success) {
          // Create and add the bot response
          const botResponse = {
            id: Date.now().toString() + '-response',
            text: data.response || "I received your message!",
            timestamp: new Date().toISOString(),
            user: 'system',
            role: 'assistant',
          };
          
          setMessages(prevMessages => [...prevMessages, botResponse]);
        } else {
          console.error('API Error:', data.error);
          throw new Error(data.error || 'Unknown error');
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        
        // Add a fallback response
        const errorResponse = {
          id: Date.now().toString() + '-error',
          text: "Sorry, I couldn't connect to the server right now. Please try again later.",
          timestamp: new Date().toISOString(),
          user: 'system',
          role: 'assistant',
        };
        
        setMessages(prevMessages => [...prevMessages, errorResponse]);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in message handling:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Add a useEffect to check if the interview time has passed and hide the banner
  useEffect(() => {
    if (pendingInterview) {
      // Check if the interview has completed
      if (isInterviewCompleted(pendingInterview)) {
        console.log('Interview time has passed, hiding banner');
        setPendingInterview(null);
      }
      
      // Set up an interval to periodically check if the interview time has passed
      const intervalId = setInterval(() => {
        if (pendingInterview && isInterviewCompleted(pendingInterview)) {
          console.log('Interview time has passed (interval check), hiding banner');
          setPendingInterview(null);
          clearInterval(intervalId);
        }
      }, 60000); // Check every minute
      
      return () => clearInterval(intervalId);
    }
  }, [pendingInterview]);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.interviewContainer}>
        {renderInterviewBanner()}
      </View>
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
          style={styles.refreshButton}
          onPress={handleRefreshSuggestions}
          disabled={isRefreshing}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
            color={isRefreshing ? "#cccccc" : "#2563eb"} 
          />
        </TouchableOpacity>
      </View>

      {/* Message Input */}
      <View style={styles.inputOuterContainer}>
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="attach" size={22} color="#8e8e93" />
          </TouchableOpacity>
          
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Write your message"
              placeholderTextColor="#8e8e93"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.sendButton, message.trim() ? styles.sendButtonActive : null]}
            onPress={() => sendMessage()}
            disabled={!message.trim()}
          >
            {message.trim() ? (
              <Ionicons name="send" size={22} color="#ffffff" />
            ) : (
              <Ionicons name="mic" size={22} color="#8e8e93" />
            )}
          </TouchableOpacity>
        </View>
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
              <RNCalendar
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
      <DeclineInterviewModal />
      <JobOfferModal />
      {renderJobOfferBanner()}
      {renderSendJobOfferButton()}
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
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  inputWrapper: {
    flex: 1,
    paddingVertical: 8,
  },
  input: {
    fontSize: 16,
    color: '#333333',
    maxHeight: 100,
  },
  attachButton: {
    padding: 8,
  },
  sendButton: {
    padding: 8,
    borderRadius: 16,
  },
  sendButtonActive: {
    backgroundColor: '#4CD964',
  },
  emojiButton: {
    padding: 8,
  },
  cameraButton: {
    padding: 8,
  },
  micButton: {
    padding: 8,
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
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    marginLeft: 8,
    alignSelf: 'center',
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
    borderRadius: 10,
    padding: 20,
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
    marginTop: 15,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#1e3a8a',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeSlotsContainer: {
    marginTop: 10,
    maxHeight: 150,
  },
  timeSlotsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  timeSlotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  timeSlotText: {
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  confirmButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  phoneInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
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
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
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
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  interviewCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e3a8a',
  },
  interviewCardText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 10,
  },
  timeSlotsList: {
    marginBottom: 15,
  },
  timeSlotItem: {
    backgroundColor: '#f09ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  interviewCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interviewCardButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  interviewCardButtonText: {
    color: '#ffffff',
    fontWeight: '500',
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
  interviewBanner: {
    backgroundColor: '#e0f2fe',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  interviewBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  interviewBannerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  interviewBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  interviewBannerDetails: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  interviewBannerPhone: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  calendarButton: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  calendarButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e3a8a',
  },
  modalText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 15,
  },
  phoneNumberInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  modalButton: {
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
  confirmButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    width: '45%',
  },
  confirmButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  offerContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e3a8a',
  },
  offerDetail: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 10,
  },
  scheduleText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 5,
  },
  offerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  offerContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e3a8a',
  },
  offerDetail: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 10,
  },
  scheduleText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 5,
  },
  offerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interviewContainer: {
    marginBottom: 10,
  },
  interviewBanner: {
    backgroundColor: '#e0f2fe',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  interviewBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  interviewBannerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  interviewBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  interviewBannerDetails: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  interviewBannerPhone: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  calendarButton: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  calendarButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#e53e3e',
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  timePickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timePicker: {
    width: '48%',
    alignItems: 'center',
  },
  slotsList: {
    maxHeight: 150,
  },
  removeButtonText: {
    color: '#e53e3e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  datePickerButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
  timePickerButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
    width: '100%',
  },
  timePickerButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noSlotsText: {
    fontStyle: 'italic',
    color: '#9ca3af',
    textAlign: 'center',
    marginVertical: 10,
  },
  disabledButton: {
    backgroundColor: '#a0aec0',
    opacity: 0.7,
  },
  timeSlotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 5,
  },
  timeSlotText: {
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  interviewButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  interviewButton: {
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  interviewButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  alternativeButton: {
    backgroundColor: '#3b82f6', // blue
  },
  declineButton: {
    backgroundColor: '#ef4444', // red
  },
  modalContentWrapper: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  noSlotsText: {
    color: '#6b7280',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  workDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  workDayButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dayText: {
    color: '#4b5563',
  },
  dayTextSelected: {
    color: 'white',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  timeSeperator: {
    marginHorizontal: 10,
  },
  payContainer: {
    marginVertical: 10,
  },
  payInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  payPeriodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payPeriodButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  payPeriodSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  periodText: {
    color: '#4b5563',
  },
  periodTextSelected: {
    color: 'white',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    height: 80,
    textAlignVertical: 'top',
  },
  sendOfferButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  sendOfferButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  offerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  offerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  inputOuterContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
});