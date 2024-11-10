import React, { useState } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { auth } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function UpdateEmailModal({ visible, onClose }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleUpdateEmail = async () => {
    try {
      const user = auth.currentUser;
      const credential = auth.EmailAuthProvider.credential(
        user.email,
        password
      );

      // Reauthenticate user
      await user.reauthenticateWithCredential(credential);
      // Update email
      await user.updateEmail(newEmail);
      
      Alert.alert('Success', 'Email updated successfully');
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          
          <Text style={styles.title}>Update Email</Text>
          
          <TextInput
            style={styles.input}
            placeholder="New Email Address"
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Current Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleUpdateEmail}
          >
            <Text style={styles.submitButtonText}>Update Email</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1e3a8a',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 