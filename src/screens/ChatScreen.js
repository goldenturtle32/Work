import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from "react-native-modal-datetime-picker";

export default function ChatScreen({ route, navigation }) {
  const { jobTitle, company, role } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  useEffect(() => {
    // Simulating initial message from the employer
    if (role === 'worker') {
      setMessages([
        { id: '1', text: `How can I help you with the ${jobTitle} position?`, sender: 'employer' }
      ]);
    }
  }, []);

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage = { id: Date.now().toString(), text: message, sender: role };
      setMessages([...messages, newMessage]);
      setMessage('');
      
      if (role === 'worker') {
        setTimeout(() => simulateEmployerResponse(newMessage), 1000);
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
    setMessages(prev => [...prev, { id: Date.now().toString(), text: response, sender: 'employer' }]);
  };

  const renderMessageItem = ({ item }) => (
    <View style={[styles.messageContainer, item.sender === 'employer' ? styles.employerMessage : styles.userMessage]}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    hideDatePicker();
    const formattedDate = date.toLocaleString();
    const scheduleMessage = { id: Date.now().toString(), text: `Call scheduled for ${formattedDate}`, sender: 'system' };
    setMessages([...messages, scheduleMessage]);
  };

  const suggestAction = (action) => {
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
    setMessages([...messages, { id: Date.now().toString(), text: actionMessage, sender: role }]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chat with {role === 'worker' ? company : 'Applicant'} about {jobTitle}</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        style={styles.chatArea}
      />
      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={styles.input}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
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
});