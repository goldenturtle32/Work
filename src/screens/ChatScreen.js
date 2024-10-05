import React, { useState } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';

export default function ChatScreen({ route }) {
  const { jobTitle, company } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const sendMessage = () => {
    if (message.trim()) {
      setMessages([...messages, { id: Date.now().toString(), text: message }]);
      setMessage('');  // Clear the input field
    }
  };

  const renderMessageItem = ({ item }) => (
    <View style={styles.messageContainer}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chat with {company} about {jobTitle}</Text>
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
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chatArea: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
  messageContainer: {
    backgroundColor: '#f1f1f1',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  messageText: {
    fontSize: 16,
  },
});
