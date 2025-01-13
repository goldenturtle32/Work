import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { db } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const isWeb = Platform.OS === 'web';
let WebMap;
if (isWeb) {
  WebMap = require('../components/WebMap').default;
}

const JobDetailsMatched = ({ route, navigation }) => {
  const [jobDetails, setJobDetails] = useState(null);
  const [location, setLocation] = useState(null);
  const { matchId } = route.params;

  useEffect(() => {
    const fetchMatchDetails = async () => {
      try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (matchDoc.exists && matchDoc.data().status === 'hired') {
          const matchData = matchDoc.data();
          setJobDetails({
            ...matchData.jobDetails,
            companyName: matchData.companyName,
            location: matchData.location,
            salary: matchData.salary,
            description: matchData.description,
            requirements: matchData.requirements,
            contactEmail: matchData.contactEmail,
            contactPhone: matchData.contactPhone,
            applicationUrl: matchData.applicationUrl,
          });

          // Get coordinates for the job location
          if (matchData.location) {
            try {
              const result = await Location.geocodeAsync(matchData.location);
              if (result.length > 0) {
                setLocation({
                  latitude: result[0].latitude,
                  longitude: result[0].longitude,
                });
              }
            } catch (error) {
              console.error('Error geocoding location:', error);
            }
          }
        } else {
          console.log('Match not found or not hired');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error fetching match details:', error);
      }
    };

    fetchMatchDetails();
  }, [matchId]);

  const handleContact = (type) => {
    if (type === 'email' && jobDetails.contactEmail) {
      Linking.openURL(`mailto:${jobDetails.contactEmail}`);
    } else if (type === 'phone' && jobDetails.contactPhone) {
      Linking.openURL(`tel:${jobDetails.contactPhone}`);
    } else if (type === 'apply' && jobDetails.applicationUrl) {
      Linking.openURL(jobDetails.applicationUrl);
    }
  };

  if (!jobDetails) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{jobDetails.title}</Text>
        <Text style={styles.company}>{jobDetails.companyName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.text}>{jobDetails.location}</Text>
        {isWeb && location && (
          <View style={styles.mapContainer}>
            <WebMap
              center={[location.latitude, location.longitude]}
              zoom={13}
              markers={[
                {
                  position: [location.latitude, location.longitude],
                  title: jobDetails.companyName,
                },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salary</Text>
        <Text style={styles.text}>{jobDetails.salary || 'Not specified'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.text}>{jobDetails.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requirements</Text>
        <Text style={styles.text}>{jobDetails.requirements}</Text>
      </View>

      <View style={styles.contactButtons}>
        {jobDetails.contactEmail && (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('email')}
          >
            <Ionicons name="mail" size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Email</Text>
          </TouchableOpacity>
        )}

        {jobDetails.contactPhone && (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('phone')}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Call</Text>
          </TouchableOpacity>
        )}

        {jobDetails.applicationUrl && (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('apply')}
          >
            <Ionicons name="open-outline" size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Apply</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  company: {
    fontSize: 18,
    color: '#666',
    marginTop: 5,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  mapContainer: {
    height: 300,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  contactButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  contactButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  contactButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default JobDetailsMatched; 