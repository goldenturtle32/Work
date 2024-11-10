import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySettingsModal({ visible, onClose }) {
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: true,
    locationSharing: true,
    activityStatus: true,
    dataCollection: true,
    showEmail: false,
    showPhone: false
  });

  const toggleSwitch = (key) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderPrivacyItem = (title, key, description) => (
    <View style={styles.privacyItem}>
      <View style={styles.privacyText}>
        <Text style={styles.privacyTitle}>{title}</Text>
        <Text style={styles.privacyDescription}>{description}</Text>
      </View>
      <Switch
        value={privacySettings[key]}
        onValueChange={() => toggleSwitch(key)}
        trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
        thumbColor={privacySettings[key] ? "#1e3a8a" : "#f4f3f4"}
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
          
          <Text style={styles.title}>Privacy Settings</Text>
          
          <ScrollView style={styles.scrollView}>
            {renderPrivacyItem(
              "Profile Visibility",
              "profileVisibility",
              "Make your profile visible to potential matches"
            )}
            
            {renderPrivacyItem(
              "Location Sharing",
              "locationSharing",
              "Share your location for better job matches"
            )}
            
            {renderPrivacyItem(
              "Activity Status",
              "activityStatus",
              "Show when you're active on the platform"
            )}
            
            {renderPrivacyItem(
              "Data Collection",
              "dataCollection",
              "Allow data collection to improve your experience"
            )}
            
            {renderPrivacyItem(
              "Show Email",
              "showEmail",
              "Display your email to matched connections"
            )}
            
            {renderPrivacyItem(
              "Show Phone Number",
              "showPhone",
              "Display your phone number to matched connections"
            )}
          </ScrollView>

          <TouchableOpacity 
            style={styles.submitButton}
            onPress={onClose}
          >
            <Text style={styles.submitButtonText}>Save Settings</Text>
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
    maxHeight: '80%',
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
    textAlign: 'center',
  },
  privacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  privacyText: {
    flex: 1,
    marginRight: 10,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  privacyDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    maxHeight: '70%',
  },
}); 