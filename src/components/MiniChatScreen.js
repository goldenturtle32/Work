import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { db, auth, firebase } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

const SUGGESTED_MESSAGES = [
  "Hi! Thanks for matching!",
  "What experience are you looking for?",
  "When are you available to start?",
  "What are your salary expectations?"
];

export default function MiniChatScreen({ matchData }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!matchData?.id) return;

    // Subscribe to messages for this chat
    const unsubscribe = db.collection('chats')
      .doc(matchData.id)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        setMessages(newMessages);
      });

    return () => unsubscribe();
  }, [matchData?.id]);

  const sendMessage = async () => {
    if (!message.trim() || !matchData?.id) return;

    try {
      // First create the chat document if it doesn't exist
      await db.collection('chats').doc(matchData.id).set({
        participants: [matchData.workerId, matchData.employerId],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Then add the message
      const messageData = {
        text: message.trim(),
        senderId: currentUser.uid,
        sender: currentUser.uid === matchData.workerId ? 'worker' : 'employer',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      };

      await db.collection('chats')
        .doc(matchData.id)
        .collection('messages')
        .add(messageData);

      // Update the last message in the chat document
      await db.collection('chats').doc(matchData.id).update({
        lastMessage: messageData.text,
        lastMessageTime: messageData.timestamp
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.senderId === currentUser.uid ? styles.userMessage : styles.otherMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.senderId === currentUser.uid ? styles.userMessageText : styles.otherMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.welcomeText}>Start chatting with your match!</Text>
      <View style={styles.suggestionsContainer}>
        {SUGGESTED_MESSAGES.map((msg, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionBubble}
            onPress={() => setMessage(msg)}
          >
            <Text style={styles.suggestionText}>{msg}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        style={styles.messagesList}
        ListEmptyComponent={renderEmptyChat}
      />
      
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
          disabled={!message.trim()}
        >
          <Ionicons 
            name="send" 
            size={24} 
            color={message.trim() ? "#007AFF" : "#A0A0A0"} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginVertical: 3,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  suggestionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  suggestionBubble: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    padding: 12,
    marginVertical: 6,
    maxWidth: '90%',
    minWidth: '60%',
  },
  suggestionText: {
    color: '#1976d2',
    fontSize: 14,
    textAlign: 'center',
  },
}); 