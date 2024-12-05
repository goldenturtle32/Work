import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const SUGGESTED_MESSAGES = [
  "Hi! I'm interested in this position.",
  "When would be a good time to discuss the role?",
  "I'm available for an interview this week.",
];

const MiniChatScreen = ({ matchData, jobData }) => {
  console.log('MiniChatScreen initialized with:', { matchData, jobData });
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef(null);
  const [chatId, setChatId] = useState(null);

// Initialize chat
useEffect(() => {
  const initializeChat = async () => {
      try {
          console.log('Initializing chat with matchData:', matchData);
          
          if (!matchData || !matchData.participants) {
              console.error('Invalid matchData:', matchData);
              return;
          }

          // Get other participant ID
          const otherParticipantId = Object.keys(matchData.participants)
              .find(id => id !== auth.currentUser?.uid);

          if (!otherParticipantId) {
              console.error('Cannot determine other participant ID:', matchData.participants);
              return;
          }

          // Create chat document
          const chatRef = doc(db, 'chats', matchData.id);
          const chatDoc = await getDoc(chatRef);

          if (!chatDoc.exists()) {
              await setDoc(chatRef, {
                  participants: matchData.participants,
                  messages: [],
                  createdAt: serverTimestamp()
              });
          }

          // Set up real-time listener
          const unsubscribe = onSnapshot(chatRef, (doc) => {
              if (doc.exists()) {
                  setChatData(doc.data());
              }
          });

          return () => unsubscribe();

      } catch (error) {
          console.error('Error in initializeChat:', error);
      }
  };

  if (matchData && auth.currentUser) {
      initializeChat();
  }
}, [matchData, auth.currentUser]);

  // Send message function
  const sendMessage = async () => {
      const hasAuth = !!auth.currentUser;
      if (!input.trim() || !chatId || !hasAuth) {
          console.log('Cannot send message:', { input: input.trim(), chatId, hasAuth });
          return;
      }

      try {
          const messageData = {
              text: input.trim(),
              timestamp: serverTimestamp(),
              senderId: auth.currentUser.uid,
              sender: matchData?.userType || 'user', // Make sure userType is passed in matchData
              read: false
          };

          // Add message to subcollection
          await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

          // Update chat's last message
          await updateDoc(doc(db, 'chats', chatId), {
              lastMessage: input.trim(),
              lastMessageTime: serverTimestamp()
          });

          setInput('');
          scrollViewRef.current?.scrollToEnd();
      } catch (error) {
          console.error('Error sending message:', error);
      }
  };


  // Return the JSX
  return (
    <View style={styles.container}>
      {/* Messages area */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
      >
        {messages.length === 0 && showSuggestions && (
          <>
            <Text style={styles.startConversation}>
              Start a conversation with your new match!
            </Text>
            {SUGGESTED_MESSAGES.map((msg, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => {
                  setInput(msg);
                  sendMessage();
                }}
              >
                <Text style={styles.suggestionText}>{msg}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageContainer,
              message.senderId === auth.currentUser.uid
                ? styles.sentMessage
                : styles.receivedMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.senderId === auth.currentUser.uid
                ? styles.sentMessageText
                : styles.receivedMessageText
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          onSubmitEditing={sendMessage}
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
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  messagesContent: {
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 20,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    marginLeft: '20%',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
    marginRight: '20%',
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: '#fff',
  },
  receivedMessageText: {
    color: '#000',
  },
  startConversation: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 10,
  },
  suggestionButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 20,
    marginVertical: 5,
  },
  suggestionText: {
    color: '#007AFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007AFF', 
    borderRadius: 20,
    paddingHorizontal: 20, 
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default MiniChatScreen; 