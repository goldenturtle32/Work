import React, { useState, useEffect } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';

// Define BACKEND_URL constant
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

  const TimeSlotModal = () => (
    <Modal
      visible={showTimeSlotModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTimeSlotModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Available Time Slots</Text>
          
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setDatePickerVisible(true)}
          >
            <Text>{selectedDate ? selectedDate.toLocaleDateString() : 'Select Date'}</Text>
          </TouchableOpacity>

          {Platform.OS === 'web' ? (
            showDatePicker && (
              <DateTimePicker
                value={selectedDate || new Date()}
                onChange={onDateSelect}
                minimumDate={new Date()}
              />
            )
          ) : (
            <DateTimePickerModal
              isVisible={showDatePicker}
              mode="datetime"
              onConfirm={handleConfirm}
              onCancel={() => setDatePickerVisible(false)}
            />
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleSubmitTimeSlots}
          >
            <Text style={styles.buttonText}>Confirm Time Slots</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
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
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5, // for Android
    zIndex: 1000, // for iOS
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  addSlotButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    zIndex: 1001, // Ensure button is clickable
  },
  timeSlotsList: {
    maxHeight: 200,
  },
  timeSlotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 10,
  },
  timeSlotText: {
    flex: 1,
    fontSize: 16,
  },
  removeText: {
    color: 'red',
    fontSize: 18,
    marginLeft: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 20,
    marginVertical: 10,
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
});