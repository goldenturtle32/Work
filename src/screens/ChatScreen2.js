import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { db, auth, firebase } from '../firebase';

export default function ChatScreen({ route, navigation }) {
  const { jobTitle, company, role, matchId } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const BACKEND_URL = 'http://127.0.0.1:5000';
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          setLoading(false);
        } catch (error) {
          console.error("Error processing messages:", error);
          setLoading(false);
        }
      }, error => {
        console.error("Error fetching messages:", error);
        Alert.alert(
          'Error',
          'Unable to load messages. Please check your connection and try again.'
        );
        setLoading(false);
      });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    generateSuggestions();
  }, [messages]);

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

  const sendSuggestion = async (suggestionText) => {
    setMessage(suggestionText);
    await sendMessage(suggestionText);
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

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirm = async (date) => {
    hideDatePicker();
    const formattedDate = date.toLocaleString();
    const scheduleMessage = {
      text: `Call scheduled for ${formattedDate}`,
      sender: 'system',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('chats')
        .doc(matchId)
        .collection('messages')
        .add(scheduleMessage);
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
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
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    console.log("Refreshing suggestions...");
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

      if (!response.ok) {
        console.error("Failed to get suggestions:", response.status);
        throw new Error('Failed to get suggestions');
      }
      
      const data = await response.json();
      console.log("New suggestions received:", data.suggestions);
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Error refreshing suggestions:', error);
      setSuggestions(getStaticSuggestions());
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        inverted
        style={styles.chatArea}
      />

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

      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {role === 'employer' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity onPress={showDatePicker} style={styles.actionButton}>
            <Ionicons name="calendar" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => suggestAction('qualifications')} style={styles.actionButton}>
            <Ionicons name="document-text" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => suggestAction('experience')} style={styles.actionButton}>
            <Ionicons name="briefcase" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />
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
});