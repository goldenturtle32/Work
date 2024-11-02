import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated, PanResponder } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import User from '../models/User';
import { 
  useFonts,
  Domine_400Regular,
  Domine_700Bold
} from '@expo-google-fonts/domine';

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

  let [fontsLoaded] = useFonts({
    Domine_400Regular,
    Domine_700Bold
  });

  const [skillInput, setSkillInput] = useState('');
  const [roleInput, setRoleInput] = useState('');

  const handleSkillRemoval = (skillToRemove) => {
    handleChange('skills', user.skills.filter(skill => skill !== skillToRemove));
  };

  const handleRoleRemoval = (roleToRemove) => {
    handleChange('experience', {
      ...user.experience,
      specificRoles: user.experience.specificRoles.filter(role => role !== roleToRemove)
    });
  };

  const renderSkillBubbles = () => (
    <View style={styles.bubblesContainer}>
      {user.skills.map((skill, index) => (
        <View key={index} style={styles.bubble}>
          <Text style={styles.bubbleText}>{skill}</Text>
          <TouchableOpacity onPress={() => handleSkillRemoval(skill)}>
            <Ionicons name="close-circle" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderRoleBubbles = () => (
    <View style={styles.bubblesContainer}>
      {user.experience.specificRoles.map((role, index) => (
        <View key={index} style={styles.bubble}>
          <Text style={styles.bubbleText}>{role}</Text>
          <TouchableOpacity onPress={() => handleRoleRemoval(role)}>
            <Ionicons name="close-circle" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const [certificationInput, setCertificationInput] = useState('');

  const handleCertificationRemoval = (certToRemove) => {
    handleChange('certifications', user.certifications.filter(cert => cert !== certToRemove));
  };

  const renderCertificationBubbles = () => (
    <View style={styles.bubblesContainer}>
      {user.certifications.map((cert, index) => (
        <View key={index} style={styles.bubble}>
          <Text style={styles.bubbleText}>{cert}</Text>
          <TouchableOpacity onPress={() => handleCertificationRemoval(cert)}>
            <Ionicons name="close-circle" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <div style={webStyles.container}>
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Profile Settings</Text>
          <View style={styles.headerIconContainer}>
            <Ionicons name="person-circle-outline" size={60} color="#ffffff" />
          </View>
        </LinearGradient>

        <div style={webStyles.scrollView}>
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={user.email}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Skills</Text>
              <TextInput
                style={styles.input}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={() => {
                  if (skillInput.trim()) {
                    handleChange('skills', [...user.skills, skillInput.trim()]);
                    setSkillInput('');
                  }
                }}
                placeholder="Type a skill and press enter"
                placeholderTextColor="#A9A9A9"
              />
              {renderSkillBubbles()}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Specific Roles</Text>
              <TextInput
                style={styles.input}
                value={roleInput}
                onChangeText={setRoleInput}
                onSubmitEditing={() => {
                  if (roleInput.trim()) {
                    handleChange('experience', {
                      ...user.experience,
                      specificRoles: [...user.experience.specificRoles, roleInput.trim()]
                    });
                    setRoleInput('');
                  }
                }}
                placeholder="Type a role and press enter"
                placeholderTextColor="#A9A9A9"
              />
              {renderRoleBubbles()}
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
                value={certificationInput}
                onChangeText={setCertificationInput}
                onSubmitEditing={() => {
                  if (certificationInput.trim()) {
                    handleChange('certifications', [...user.certifications, certificationInput.trim()]);
                    setCertificationInput('');
                  }
                }}
                placeholder="Type a certification and press enter"
                placeholderTextColor="#A9A9A9"
              />
              {renderCertificationBubbles()}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Selected Jobs</Text>
              <View style={styles.selectedJobsContainer}>
                {user.selectedJobs?.map((job, index) => (
                  <View key={index} style={styles.selectedJobItem}>
                    <Text style={styles.selectedJobText}>
                      {job.industry} - {job.jobType}
                    </Text>
                    <Text style={styles.selectedJobSkills}>
                      Skills: {job.skills.join(', ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={updateProfile}>
              <Text style={styles.buttonText}>Update Profile</Text>
            </TouchableOpacity>
          </View>
        </div>

        <View style={[styles.navigation, styles.webNavigation]}>
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
      </div>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills</Text>
            <TextInput
              style={styles.input}
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={() => {
                if (skillInput.trim()) {
                  handleChange('skills', [...user.skills, skillInput.trim()]);
                  setSkillInput('');
                }
              }}
              placeholder="Type a skill and press enter"
              placeholderTextColor="#A9A9A9"
            />
            {renderSkillBubbles()}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Specific Roles</Text>
            <TextInput
              style={styles.input}
              value={roleInput}
              onChangeText={setRoleInput}
              onSubmitEditing={() => {
                if (roleInput.trim()) {
                  handleChange('experience', {
                    ...user.experience,
                    specificRoles: [...user.experience.specificRoles, roleInput.trim()]
                  });
                  setRoleInput('');
                }
              }}
              placeholder="Type a role and press enter"
              placeholderTextColor="#A9A9A9"
            />
            {renderRoleBubbles()}
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
              value={certificationInput}
              onChangeText={setCertificationInput}
              onSubmitEditing={() => {
                if (certificationInput.trim()) {
                  handleChange('certifications', [...user.certifications, certificationInput.trim()]);
                  setCertificationInput('');
                }
              }}
              placeholder="Type a certification and press enter"
              placeholderTextColor="#A9A9A9"
            />
            {renderCertificationBubbles()}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Selected Jobs</Text>
            <View style={styles.selectedJobsContainer}>
              {user.selectedJobs?.map((job, index) => (
                <View key={index} style={styles.selectedJobItem}>
                  <Text style={styles.selectedJobText}>
                    {job.industry} - {job.jobType}
                  </Text>
                  <Text style={styles.selectedJobSkills}>
                    Skills: {job.skills.join(', ')}
                  </Text>
                </View>
              ))}
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

const webStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    paddingBottom: '90px', // Space for navigation
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 5,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'Domine_700Bold',
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  headerIconContainer: {
    alignItems: 'center',
    marginBottom: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 800,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Domine_700Bold',
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
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
    fontFamily: 'Domine_400Regular',
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
    fontFamily: 'Domine_700Bold',
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
  webNavigation: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  bubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Domine_400Regular',
  },
  selectedJobsContainer: {
    marginTop: 10,
  },
  selectedJobItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedJobText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'Domine_700Bold',
  },
  selectedJobSkills: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Domine_400Regular',
  },
});