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
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
        } else {
          console.error('User document not found');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    if ((setupData.selectedJobs?.length > 0 || setupData.jobTypePrefs) && userRole) {
      console.log('Data available:', { 
        selectedJobs: setupData.selectedJobs, 
        jobTypePrefs: setupData.jobTypePrefs,
        userRole 
      });
      fetchOverviewQuestions();
    } else {
      console.log('Missing required data:', setupData);
    }
  }, [setupData.selectedJobs, setupData.jobTypePrefs, userRole]);

  const fetchOverviewQuestions = async () => {
    try {
      const payload = userRole === 'employer' ? {
        role: userRole,
        industry: setupData.industryPrefs?.[0],
        jobTitle: setupData.jobTypePrefs,
        requiredSkills: setupData.skills
      } : {
        role: userRole,
        selectedJobs: setupData.selectedJobs
      };

      console.log('Sending payload:', payload); // Debug log

      const response = await fetch(`${BACKEND_URL}/generate-overview-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
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
          role: userRole,
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
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      const overviewField = userRole === 'employer' ? 'job_overview' : 'user_overview';
      
      await db.collection(collectionName).doc(userId).update({
        [overviewField]: setupData.generatedOverview,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      navigation.navigate('Availability', { isInitialSetup: true });
    } catch (error) {
      console.error('Error completing overview:', error);
      Alert.alert('Error', 'Failed to save overview. Please try again.');
    }
  };

  const handleOverviewEdit = async (text) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      updateSetupData({ generatedOverview: text });
      
      const collectionName = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      const overviewField = userRole === 'employer' ? 'job_overview' : 'user_overview';
      
      await db.collection(collectionName).doc(user.uid).update({
        [overviewField]: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating overview:', error);
      Alert.alert('Error', 'Failed to save overview changes.');
    }
  };

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={4} />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {userRole === 'employer' 
              ? "Create Your Job Overview" 
              : "Create Your Profile Overview"}
          </Text>
          <Text style={styles.subtitle}>
            {userRole === 'employer'
              ? "Let's create a compelling job description. Answer a few questions about the role, and we'll help you craft an overview that attracts the right candidates."
              : "We're going to ask you a few questions to get a better feel for you. After you answer these questions, we will create an overview for your profile."}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Display job details for employer or selected jobs for worker */}
          {userRole === 'employer' ? (
            <View style={styles.selectedJobsContainer}>
              <Text style={styles.sectionTitle}>Position Details:</Text>
              <View style={styles.jobItem}>
                <Text style={styles.jobTitle}>{setupData.jobTypePrefs}</Text>
                <Text style={styles.jobIndustry}>{setupData.industryPrefs?.[0]}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.selectedJobsContainer}>
              <Text style={styles.sectionTitle}>Selected Jobs:</Text>
              {setupData.selectedJobs?.map((job, index) => (
                <View key={index} style={styles.jobItem}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.jobIndustry}>{job.industry}</Text>
                </View>
              ))}
            </View>
          )}

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
                  maxLength={250}
                  value={setupData.generatedOverview}
                  onChangeText={handleOverviewEdit}
                  placeholder="Your overview text..."
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
              <Text style={styles.characterCount}>
                {setupData.generatedOverview?.length || 0}/250 characters
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleComplete}
          style={[
            styles.nextButton,
            !setupData.generatedOverview && styles.buttonDisabled
          ]}
          disabled={!setupData.generatedOverview}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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
  characterCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
  },
}); 