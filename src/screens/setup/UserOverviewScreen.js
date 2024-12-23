import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import { db, auth } from '../../firebase';
import firebase from 'firebase/compat/app';

// Update the BACKEND_URL to match the Flask server address
const BACKEND_URL = 'http://127.0.0.1:5000';  // Changed from localhost to 127.0.0.1

export default function UserOverviewScreen({ navigation }) {
  const { setupData, updateSetupData } = useSetup();
  const [overviewQuestions, setOverviewQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db.collection('user_attributes').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
        } else {
          console.error('User attributes document not found');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    if (setupData.selectedJobs && setupData.selectedJobs.length > 0 && userRole) {
      console.log('Selected jobs available:', setupData.selectedJobs);
      console.log('User role:', userRole);
      fetchOverviewQuestions();
    } else {
      console.log('No selected jobs found in setupData or missing user role:', setupData);
    }
  }, [setupData.selectedJobs, userRole]);

  const fetchOverviewQuestions = async () => {
    try {
      console.log('Fetching questions with role:', userRole);
      console.log('Selected jobs:', setupData.selectedJobs);
      
      const response = await fetch(`${BACKEND_URL}/generate-overview-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          role: userRole,
          selectedJobs: setupData.selectedJobs,
          industryPrefs: setupData.attributes?.industryPrefs || [],
          jobTitle: setupData.attributes?.jobTitle || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received questions:', data); // Debug log
      
      if (data.success) {
        setOverviewQuestions(data.questions);
      } else {
        console.error('API Error:', data.error);
        Alert.alert('Error', 'Failed to fetch questions. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching overview questions:', error);
      Alert.alert('Error', 'Failed to connect to server. Please try again.');
    }
  };

  const handleOverviewResponse = (question, answer) => {
    updateSetupData({
      overviewResponses: {
        ...setupData.overviewResponses,
        [question]: answer
      }
    });
  };

  const generateOverview = async () => {
    if (Object.keys(setupData.overviewResponses).length === 0) {
      Alert.alert('Missing Responses', 'Please answer at least one question before generating overview.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/generate-overview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responses: setupData.overviewResponses,
          selectedJobs: setupData.selectedJobs,
          role: 'worker',
        }),
      });

      const data = await response.json();
      if (data.success) {
        updateSetupData({
          generatedOverview: data.overview
        });
        setCanEdit(true);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate overview');
      }
    } catch (error) {
      console.error('Error generating overview:', error);
      Alert.alert('Error', 'Failed to generate overview. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async () => {
    try {
      const userId = auth.currentUser.uid;
      
      // Update user document to mark setup as complete
      await db.collection('users').doc(userId).update({
        setupComplete: true,
        isNewUser: false
      });

      // Navigate to main app
      navigation.navigate('Main');
    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
    }
  };

  const handleOverviewEdit = async (text) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      updateSetupData({ generatedOverview: text });
      
      await db.collection('user_attributes').doc(user.uid).update({
        overview: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating overview:', error);
      Alert.alert('Error', 'Failed to save overview changes.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Create Your Overview</Text>
      
      {/* Display selected jobs */}
      <View style={styles.selectedJobsContainer}>
        <Text style={styles.sectionTitle}>Selected Jobs:</Text>
        {setupData.selectedJobs?.map((job, index) => (
          <View key={index} style={styles.jobItem}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobIndustry}>{job.industry}</Text>
          </View>
        ))}
      </View>

      {/* Display questions */}
      {overviewQuestions.length > 0 ? (
        overviewQuestions.map((question, index) => (
          <View key={index} style={styles.questionContainer}>
            <Text style={styles.questionText}>{question}</Text>
            <TextInput
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="Enter your response..."
              value={setupData.overviewResponses?.[question] || ''}
              onChangeText={(text) => handleOverviewResponse(question, text)}
            />
          </View>
        ))
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      )}

      {/* Generate Overview Button */}
      <TouchableOpacity 
        style={[styles.button, isGenerating && styles.buttonDisabled]}
        onPress={generateOverview}
        disabled={isGenerating}
      >
        <Text style={styles.buttonText}>
          {isGenerating ? 'Generating...' : 'Generate Overview'}
        </Text>
      </TouchableOpacity>

      {/* Display generated overview if available */}
      {setupData.generatedOverview && (
        <View style={styles.overviewContainer}>
          <Text style={styles.overviewTitle}>Generated Overview</Text>
          {canEdit ? (
            <TextInput
              style={styles.overviewInput}
              multiline
              value={setupData.generatedOverview}
              onChangeText={handleOverviewEdit}
            />
          ) : (
            <Text style={styles.overviewText}>{setupData.generatedOverview}</Text>
          )}
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setCanEdit(!canEdit)}
          >
            <Text style={styles.editButtonText}>
              {canEdit ? 'Save' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Complete Setup button after the overview is generated */}
      {setupData.generatedOverview && (
        <TouchableOpacity 
          style={styles.completeButton}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>Complete Setup</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#444',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overviewContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  overviewText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  overviewInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  editButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  selectedJobsContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  jobItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  jobIndustry: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  completeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 