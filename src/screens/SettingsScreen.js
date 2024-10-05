// src/screens/SettingsScreen.js
import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Updated import
import { auth } from '../firebase'; // Import auth from firebase.js

export default function SettingsScreen({ navigation }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState('');

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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <Button title="Change Password" onPress={() => { /* Implement Change Password */ }} />
        <Button title="Update Email" onPress={() => { /* Implement Update Email */ }} />
        <Button title="Manage Notifications" onPress={() => { /* Implement Manage Notifications */ }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <Button title="Language" onPress={() => { /* Implement Language Settings */ }} />
        <Button title="Theme" onPress={() => { /* Implement Theme Settings */ }} />
        <Button title="Privacy Settings" onPress={() => { /* Implement Privacy Settings */ }} />

        {/* Add the Edit Availability Button here */}
        <Button title="Edit Availability" onPress={() => navigation.navigate('Availability')} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>
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

      <View style={styles.navigation}>
        <Button title="Home" onPress={() => navigation.navigate('Home')} />
        <Button title="Matches" onPress={() => navigation.navigate('Matches')} />
        <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
        <Button title="Settings" onPress={() => { /* Already on Settings */ }} />
      </View>

      <View style={styles.logoutSection}>
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  logoutSection: {
    marginTop: 30,
    alignItems: 'center',
  },
});
