import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ChangePasswordModal from '../components/settings/ChangePasswordModal';
import UpdateEmailModal from '../components/settings/UpdateEmailModal';
import NotificationsModal from '../components/settings/NotificationsModal';
import PrivacySettingsModal from '../components/settings/PrivacySettingsModal';
import ThemeToggle from '../components/settings/ThemeToggle';

export default function SettingsScreen({ navigation }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleLogout = () => {
    auth.signOut()
      .then(() => {
        Alert.alert('Logged Out', 'You have been successfully logged out.');
        // Navigation is handled by onAuthStateChanged listener in App.js
      })
      .catch((error) => {
        console.error("Logout Error:", error);
        Alert.alert('Logout Error', error.message);
      });
  };

  const renderSettingItem = (icon, title, onPress) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#1e3a8a" />
      <Text style={styles.settingText}>{title}</Text>
      <Ionicons name="chevron-forward" size={24} color="#6b7280" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          {renderSettingItem('key-outline', 'Change Password', () => setShowPasswordModal(true))}
          {renderSettingItem('mail-outline', 'Update Email', () => setShowEmailModal(true))}
          {renderSettingItem('notifications-outline', 'Manage Notifications', () => setShowNotificationsModal(true))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.settingItem}>
            <Ionicons name="moon-outline" size={24} color="#1e3a8a" />
            <View style={styles.settingContent}>
              <Text style={styles.settingText}>Theme</Text>
              <ThemeToggle 
                darkMode={darkMode} 
                onToggle={() => setDarkMode(!darkMode)} 
              />
            </View>
          </View>
          {renderSettingItem('shield-checkmark-outline', 'Privacy Settings', () => setShowPrivacyModal(true))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedPaymentMethod}
              onValueChange={(itemValue) => setSelectedPaymentMethod(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select Payment Method" value="" />
              <Picker.Item label="Zelle" value="zelle" />
              <Picker.Item label="PayPal" value="paypal" />
              <Picker.Item label="Apple Pay" value="applepay" />
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <ChangePasswordModal 
          visible={showPasswordModal} 
          onClose={() => setShowPasswordModal(false)} 
        />
        <UpdateEmailModal 
          visible={showEmailModal} 
          onClose={() => setShowEmailModal(false)} 
        />
        <NotificationsModal 
          visible={showNotificationsModal} 
          onClose={() => setShowNotificationsModal(false)} 
        />
        <PrivacySettingsModal 
          visible={showPrivacyModal} 
          onClose={() => setShowPrivacyModal(false)} 
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingText: {
    fontSize: 16,
    color: '#4b5563',
    flex: 1,
    marginLeft: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingContent: {
    flex: 1,
    marginLeft: 15,
    alignItems: 'flex-start',
  },
});