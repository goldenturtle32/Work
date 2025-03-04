import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { db, auth, firebase } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

const SUGGESTED_MESSAGES = [
  "Hi! Thanks for matching!",
  "What experience are you looking for?",
  "When are you available to start?",
  "What are your salary expectations?"
];

const MiniChatScreen = ({ matchData }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchData?.id) return;

    const unsubscribe = db
      .collection('chats')
      .doc(matchData.id)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        const messageList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(messageList);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [matchData]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const messageRef = db
        .collection('chats')
        .doc(matchData.id)
        .collection('messages');

      await messageRef.add({
        text: newMessage.trim(),
        senderId: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('chats').doc(matchData.id).update({
        lastMessage: newMessage.trim(),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === auth.currentUser.uid;

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.currentUserText : styles.otherUserText
        ]}>
          {item.text}
        </Text>
      </View>
    );
  };

  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.welcomeText}>Start chatting with your match!</Text>
      <View style={styles.suggestionsContainer}>
        {SUGGESTED_MESSAGES.map((msg, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionBubble}
            onPress={() => setNewMessage(msg)}
          >
            <Text style={styles.suggestionText}>{msg}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={styles.chatContainer}>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          inverted={false}
          contentContainerStyle={[
            styles.messagesList,
            Platform.OS === 'ios' && { flexDirection: 'column' }
          ]}
          style={Platform.OS === 'ios' ? { transform: [{ scaleY: 1 }] } : {}}
          ListEmptyComponent={renderEmptyChat}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={newMessage.trim() ? "#185ee0" : "#666"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'space-between',
    ...(Platform.OS === 'ios' && {
      transform: [{ scaleY: 1 }]
    })
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#185ee0',
    borderBottomRightRadius: 4,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
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

export default MiniChatScreen; 