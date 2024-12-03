import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

const SUGGESTED_MESSAGES = [
  "Hi! I'm interested in this position.",
  "When would be a good time to discuss the role?",
  "I'm available for an interview this week.",
];

const MiniChatScreen = ({ matchData }) => {
  const [message, setMessage] = useState('');

  const sendMessage = (text) => {
    // Implement your message sending logic here
    console.log('Sending message:', text);
    setMessage('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.chatContainer}>
        <Text style={styles.welcomeText}>
          Start a conversation with your new match!
        </Text>
      </View>

      <View style={styles.suggestionsContainer}>
        {SUGGESTED_MESSAGES.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionBubble}
            onPress={() => sendMessage(suggestion)}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
          onPress={() => sendMessage(message)}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  suggestionsContainer: {
    padding: 10,
  },
  suggestionBubble: {
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    padding: 10,
    marginVertical: 5,
  },
  suggestionText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 20,
    padding: 10,
    marginRight: 10,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 14,
  },
});

export default MiniChatScreen; 