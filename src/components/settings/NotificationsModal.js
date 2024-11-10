import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsModal({ visible, onClose }) {
  const [notifications, setNotifications] = useState({
    newMatches: true,
    messages: true,
    jobUpdates: true,
    applicationStatus: true,
    emailNotifications: false,
    soundEnabled: true
  });

  const toggleSwitch = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderNotificationItem = (title, key, description) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationDescription}>{description}</Text>
      </View>
      <Switch
        value={notifications[key]}
        onValueChange={() => toggleSwitch(key)}
        trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
        thumbColor={notifications[key] ? "#1e3a8a" : "#f4f3f4"}
      />
    </View>
  );

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
          
          <Text style={styles.title}>Notification Settings</Text>
          
          {renderNotificationItem(
            "New Matches",
            "newMatches",
            "Get notified when you match with new jobs or candidates"
          )}
          
          {renderNotificationItem(
            "Messages",
            "messages",
            "Receive notifications for new messages"
          )}
          
          {renderNotificationItem(
            "Job Updates",
            "jobUpdates",
            "Updates about jobs you've applied to"
          )}
          
          {renderNotificationItem(
            "Application Status",
            "applicationStatus",
            "Changes to your application status"
          )}
          
          {renderNotificationItem(
            "Email Notifications",
            "emailNotifications",
            "Receive notifications via email"
          )}
          
          {renderNotificationItem(
            "Sound",
            "soundEnabled",
            "Enable sound notifications"
          )}
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
    width: '80%',
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666',
  },
}); 