import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

const SUGGESTED_MESSAGES = [
  "Hi! I'm interested in this position.",
  "When would be a good time to discuss the role?",
  "I'm available for an interview this week.",
];

const MiniChatScreen = ({ matchData, jobData }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesRef = useRef(null);

  useEffect(() => {
    // Create a reference to the chat messages collection
    const chatId = matchData?.chatId;
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => unsubscribe();
  }, [matchData]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    try {
      const chatId = matchData?.chatId;
      if (!chatId) return;

      await addDoc(messagesRef.current, {
        text: input,
        timestamp: serverTimestamp(),
        userId: auth.currentUser.uid,
        name: auth.currentUser.displayName || 'User'
      });

      // Clear input
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messagesContainer}>
        {messages.map(message => (
          <View 
            key={message.id}
            style={[
              styles.messageBox,
              message.userId === auth.currentUser.uid 
                ? styles.senderMessage 
                : styles.receiverMessage
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>

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
            onPress={() => handleSuggestionClick(suggestion)}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
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
  messagesContainer: {
    flex: 1,
  },
  messageBox: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
  },
  senderMessage: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  receiverMessage: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
  },
});

export default MiniChatScreen; 