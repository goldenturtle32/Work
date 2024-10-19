import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated, PanResponder } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import User from '../models/User';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(new User({}));
  const [userAttributes, setUserAttributes] = useState({});
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  const [importance, setImportance] = useState({
    location: 33.33,
    attributes: 33.33,
    availability: 33.33,
  });

  const [buttonOrder, setButtonOrder] = useState(['location', 'attributes', 'availability']);

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const { moveX } = gestureState;
        const totalWidth = 300; // Adjust this value based on your layout
        const buttonWidth = totalWidth / 3;
        const currentIndex = Math.floor(moveX / buttonWidth);
        const middleIndex = 1;

        if (
          (currentIndex === 0 && gestureState.dx > 0) ||
          (currentIndex === 2 && gestureState.dx < 0) ||
          currentIndex === middleIndex
        ) {
          Animated.event([null, { dx: pan.x }], { useNativeDriver: false })(_, gestureState);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const { moveX } = gestureState;
        const totalWidth = 300; // Adjust this value based on your layout
        const buttonWidth = totalWidth / 3;
        const currentIndex = Math.floor(moveX / buttonWidth);
        const middleIndex = 1;

        if (currentIndex !== middleIndex) {
          const newOrder = [...buttonOrder];
          [newOrder[currentIndex], newOrder[middleIndex]] = [newOrder[middleIndex], newOrder[currentIndex]];
          setButtonOrder(newOrder);

          const newImportance = {
            [newOrder[0]]: 50,
            [newOrder[1]]: 30,
            [newOrder[2]]: 20,
          };
          setImportance(newImportance);
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userAttributesDoc = await db.collection('user_attributes').doc(currentUser.uid).get();
        
        if (userDoc.exists && userAttributesDoc.exists) {
          const userData = userDoc.data();
          const userAttributesData = userAttributesDoc.data();
          
          setUser(new User({ ...userData, id: currentUser.uid }));
          setUserAttributes(userAttributesData);
          setImportance(userAttributesData.importance || importance);
        } else {
          Alert.alert('Error', 'User data not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const updateProfile = async () => {
    try {
      await db.collection('users').doc(currentUser.uid).set(user, { merge: true });
      await db.collection('user_attributes').doc(currentUser.uid).set({ 
        ...userAttributes, 
        importance,
      }, { merge: true });
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleChange = (key, value) => {
    setUser(prevUser => ({
      ...prevUser,
      [key]: value,
    }));
  };

  const ImportanceSelector = () => (
    <View style={styles.importanceSelectorContainer}>
      <Text style={styles.importanceTitle}>Hold and drag to set importance</Text>
      <View style={styles.importanceButtons} {...panResponder.panHandlers}>
        {buttonOrder.map((key, index) => (
          <Animated.View
            key={key}
            style={[
              styles.importanceButton,
              { 
                width: `${importance[key]}%`,
                transform: index === 1 ? [{ translateX: pan.x }] : []
              },
            ]}
          >
            <Text style={styles.importanceButtonText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Profile Settings</Text>
        <View style={styles.headerIconContainer}>
          <Ionicons name="person-circle-outline" size={60} color="#ffffff" />
        </View>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user.email}
              editable={false}
            />
          </View>

          <ImportanceSelector />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills</Text>
            <TextInput
              style={styles.input}
              value={user.skills.join(', ')}
              onChangeText={(text) => handleChange('skills', text.split(', '))}
              placeholder="Enter your skills (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={`${user.location.city}, ${user.location.state}, ${user.location.country}`}
              onChangeText={(text) => {
                const [city, state, country] = text.split(', ');
                handleChange('location', { city, state, country });
              }}
              placeholder="City, State, Country"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={user.experience.totalYears.toString()}
              onChangeText={(text) => handleChange('experience', { ...user.experience, totalYears: parseInt(text) || 0 })}
              placeholder="Years of experience"
              placeholderTextColor="#A9A9A9"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Specific Roles</Text>
            <TextInput
              style={styles.input}
              value={user.experience.specificRoles.join(', ')}
              onChangeText={(text) => handleChange('experience', { ...user.experience, specificRoles: text.split(', ') })}
              placeholder="Enter specific roles (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Education</Text>
            <TextInput
              style={styles.input}
              value={user.education}
              onChangeText={(text) => handleChange('education', text)}
              placeholder="Highest level of education"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Certifications</Text>
            <TextInput
              style={styles.input}
              value={user.certifications.join(', ')}
              onChangeText={(text) => handleChange('certifications', text.split(', '))}
              placeholder="Relevant certifications (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Job Titles</Text>
            <TextInput
              style={styles.input}
              value={user.jobTitlePrefs.join(', ')}
              onChangeText={(text) => handleChange('jobTitlePrefs', text.split(', '))}
              placeholder="Preferred job titles (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Job Types</Text>
            <TextInput
              style={styles.input}
              value={user.jobTypePrefs.join(', ')}
              onChangeText={(text) => handleChange('jobTypePrefs', text.split(', '))}
              placeholder="Full-time, Part-time, Contract, etc. (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Industries</Text>
            <TextInput
              style={styles.input}
              value={user.industryPrefs.join(', ')}
              onChangeText={(text) => handleChange('industryPrefs', text.split(', '))}
              placeholder="Preferred industries (comma-separated)"
              placeholderTextColor="#A9A9A9"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Salary Preferences</Text>
            <View style={styles.rowInput}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={user.salaryPrefs.min.toString()}
                onChangeText={(text) => handleChange('salaryPrefs', { ...user.salaryPrefs, min: parseInt(text) || 0 })}
                placeholder="Min"
                placeholderTextColor="#A9A9A9"
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={user.salaryPrefs.max.toString()}
                onChangeText={(text) => handleChange('salaryPrefs', { ...user.salaryPrefs, max: parseInt(text) || 0 })}
                placeholder="Max"
                placeholderTextColor="#A9A9A9"
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={updateProfile}>
            <Text style={styles.buttonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Matches')}>
          <Ionicons name="heart-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton}>
          <Ionicons name="person" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerIconContainer: {
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#1e3a8a',
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
  },
  rowInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  importanceSelectorContainer: {
    marginBottom: 20,
    marginTop: 20,
  },
  importanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 10,
  },
  importanceButtons: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
  },
  
  importanceButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 25,
  },
  importanceButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 15,
  },
  navButton: {
    padding: 10,
  },
});
