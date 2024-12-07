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
  console.log('MiniChatScreen props:', { matchData, jobData });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef(null);
  const [chatId, setChatId] = useState(null);

  // Initialize or get chatId
  useEffect(() => {
      const initializeChat = async () => {
          try {
              if (!matchData || !auth.currentUser) {
                  console.error('Missing required data:', { matchData, currentUser: auth.currentUser });
                  return;
              }

              // If chatId exists in matchData, use it
              if (matchData.chatId) {
                  setChatId(matchData.chatId);
                  return;
              }

              // Create new chat
              const chatData = {
                  participants: [
                      auth.currentUser.uid,
                      matchData.otherUserId // This should be passed from parent
                  ],
                  createdAt: serverTimestamp()
              };

              const chatRef = await addDoc(collection(db, 'chats'), chatData);
              setChatId(chatRef.id);

              // Update match with chatId if needed
              if (matchData.id) {
                  await updateDoc(doc(db, 'matches', matchData.id), {
                      chatId: chatRef.id
                  });
              }
          } catch (error) {
              console.error('Error in initializeChat:', error);
          }
      };

      initializeChat();
  }, [matchData]);

// Remove the duplicate sendMessage function and update the remaining one
const sendMessage = async () => {
  if (!input.trim() || !chatId) {
      console.error('No input or chatId:', { input, chatId });
      return;
  }

  try {
      const messageData = {
          text: input.trim(),
          timestamp: serverTimestamp(),
          senderId: auth.currentUser.uid,
          sender: matchData?.userType || 'user',
          read: false
      };

      console.log('Sending message with data:', messageData);
      
      // Add message to Firestore
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

      // Update chat's last message
      await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: input.trim(),
          lastMessageTime: serverTimestamp()
      });

      // Clear input and hide suggestions
      setInput('');
      setShowSuggestions(false);
      
      // Scroll to bottom
      scrollViewRef.current?.scrollToEnd();
  } catch (error) {
      console.error('Error sending message:', error);
  }
};

// Update the initializeChat function in the first useEffect
useEffect(() => {
  const initializeChat = async () => {
      try {
          if (!matchData || !auth.currentUser) {
              console.error('Missing required data:', { matchData, currentUser: auth.currentUser });
              return;
          }

          // If chatId exists in matchData, use it
          if (matchData.chatId) {
              console.log('Using existing chatId:', matchData.chatId);
              setChatId(matchData.chatId);
              return;
          }

          // Create new chat with both participants
          const chatData = {
              participants: [
                  auth.currentUser.uid,
                  matchData.otherUserId || matchData.workerId || matchData.employerId
              ].filter(Boolean), // Remove any null/undefined values
              createdAt: serverTimestamp(),
              lastMessage: null,
              lastMessageTime: serverTimestamp()
          };

          console.log('Creating new chat with data:', chatData);
          const chatRef = await addDoc(collection(db, 'chats'), chatData);
          
          console.log('Chat created with ID:', chatRef.id);
          setChatId(chatRef.id);

          // Update match with chatId if needed
          if (matchData.id) {
              await updateDoc(doc(db, 'matches', matchData.id), {
                  chatId: chatRef.id
              });
          }
      } catch (error) {
          console.error('Error in initializeChat:', error);
      }
  };

  initializeChat();
}, [matchData]);


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