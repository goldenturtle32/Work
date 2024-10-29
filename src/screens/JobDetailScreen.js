import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { db, auth } from '../firebase';
import { calculateMatch } from '../utils/matchUtils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Job from '../models/Job';
import User from '../models/User';
import FirebaseUser from '../models/FirebaseUser';

export default function JobDetailsScreen({ route, navigation }) {
  const { itemId, itemType, currentUserData } = route.params;
  const [item, setItem] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        // Set current user
        setCurrentUser(new FirebaseUser(currentUserData));

        let itemDoc;
        if (itemType === 'job') {
          // Fetch job_attributes for the employer
          itemDoc = await db.collection('job_attributes').doc(itemId).get();
          if (itemDoc.exists) {
            setItem(new Job({ id: itemDoc.id, ...itemDoc.data() }));
          } else {
            throw new Error('Job not found');
          }
        } else if (itemType === 'worker') {
          // Fetch user_attributes for the worker
          itemDoc = await db.collection('user_attributes').doc(itemId).get();
          if (itemDoc.exists) {
            setItem(new User({ uid: itemDoc.id, ...itemDoc.data() }));
          } else {
            throw new Error('Worker not found');
          }
        }

        // Calculate match score
        if (itemDoc.exists) {
          const { totalScore } = calculateMatch(currentUserData, itemDoc.data());
          setMatchScore(totalScore);
        }

      } catch (error) {
        console.error("Error fetching details:", error);
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [itemId, itemType, currentUserData]);

  const renderJobDetails = () => {
    if (!item) return null;

    return (
      <>
        <Text style={styles.title}>{item.jobTitle}</Text>
        <Text style={styles.subtitle}>{item.industry}</Text>
        <Text style={styles.sectionTitle}>Company</Text>
        <Text style={styles.description}>{item.companyName || 'N/A'}</Text>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.description}>{item.location}</Text>
        <Text style={styles.sectionTitle}>Salary</Text>
        <Text style={styles.description}>{`$${item.salaryRange.min} - $${item.salaryRange.max}`}</Text>
        <Text style={styles.sectionTitle}>Job Type</Text>
        <Text style={styles.description}>{item.jobType}</Text>
        <Text style={styles.sectionTitle}>Job Description</Text>
        <Text style={styles.description}>{item.jobDescription || 'No description available.'}</Text>
        <Text style={styles.sectionTitle}>Required Skills</Text>
        <Text style={styles.description}>{item.requiredSkills.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Required Experience</Text>
        <Text style={styles.description}>{`${item.requiredExperience.minYears} years (min), ${item.requiredExperience.preferredYears} years (preferred)`}</Text>
        <Text style={styles.sectionTitle}>Required Education</Text>
        <Text style={styles.description}>{item.requiredEducation}</Text>
        <Text style={styles.sectionTitle}>Required Certifications</Text>
        <Text style={styles.description}>{item.requiredCertifications.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Estimated Hours</Text>
        <Text style={styles.description}>{item.estimatedHours}</Text>
        <Text style={styles.sectionTitle}>Required Availability</Text>
        <Text style={styles.description}>{JSON.stringify(item.availability, null, 2)}</Text>
      </>
    );
  };

  const renderUserDetails = () => {
    if (!item) return null;

    return (
      <>
        <Text style={styles.title}>{item.email}</Text>
        <Text style={styles.subtitle}>{item.role}</Text>
        <Text style={styles.sectionTitle}>Skills</Text>
        <Text style={styles.description}>{item.skills.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Experience</Text>
        <Text style={styles.description}>{`${item.experience.totalYears} years`}</Text>
        <Text style={styles.sectionTitle}>Education</Text>
        <Text style={styles.description}>{item.education}</Text>
        <Text style={styles.sectionTitle}>Certifications</Text>
        <Text style={styles.description}>{item.certifications.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Job Title Preferences</Text>
        <Text style={styles.description}>{item.jobTitlePrefs.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Job Type Preferences</Text>
        <Text style={styles.description}>{item.jobTypePrefs.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Industry Preferences</Text>
        <Text style={styles.description}>{item.industryPrefs.join(', ')}</Text>
        <Text style={styles.sectionTitle}>Salary Preferences</Text>
        <Text style={styles.description}>{`$${item.salaryPrefs.min} - $${item.salaryPrefs.max}`}</Text>
        <Text style={styles.sectionTitle}>Category</Text>
        <Text style={styles.description}>{item.category}</Text>
        <Text style={styles.sectionTitle}>Average Review</Text>
        <Text style={styles.description}>{item.reviewsAverage.toFixed(1)}</Text>
      </>
    );
  };

  const renderDetails = () => {
    if (itemType === 'job') {
      return renderJobDetails();
    } else {
      return renderUserDetails();
    }
  };

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {renderDetails()}
      <Text style={styles.matchScore}>Match Score: {(matchScore * 100).toFixed(2)}%</Text>
      <TouchableOpacity style={styles.applyButton} onPress={() => Alert.alert('Job Applied!', 'You have successfully applied for this job.')}>
        <Text style={styles.applyButtonText}>Apply for Job</Text>
      </TouchableOpacity>
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
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
    color: '#666',
  },
  matchScore: {
    fontSize: 16,
    marginBottom: 16,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 20,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
