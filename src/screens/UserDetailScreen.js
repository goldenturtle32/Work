import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { db, auth } from '../firebase';
import { calculateMatch } from '../utils/matchUtils';
import { analyzeProfileMatch } from '../utils/matchAnalysis';
import { AntDesign } from '@expo/vector-icons';

export default function UserDetailScreen({ route, navigation }) {
  const { itemId, itemType, currentUserData, item: initialItem } = route.params;
  const [item, setItem] = useState(initialItem);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkerDetails();
  }, [itemId]);

  const fetchWorkerDetails = async () => {
    try {
      setLoading(true);
      console.log("Fetching details for worker:", itemId);
      
      const workerDoc = await db.collection('user_attributes').doc(itemId).get();
      
      if (!workerDoc.exists) {
        setError('Worker not found');
        return;
      }

      const workerData = workerDoc.data();
      console.log("Worker data:", workerData);
      setItem(workerData);
      
    } catch (error) {
      console.error("Error fetching worker details:", error);
      setError('Failed to load worker details');
    } finally {
      setLoading(false);
    }
  };

  const renderWorkerView = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            color="#3b82f6" 
            style={{ transform: [{ scale: 1.4 }] }}
          />
          <Text style={styles.loadingText}>Loading worker details...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (!item) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No worker data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overviewText}>{item.user_overview}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skillsContainer}>
            {item.selectedJobs?.[0]?.skills?.map((skill, index) => (
              <View key={index} style={styles.skillBubble}>
                <Text style={styles.skillText}>{skill.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.locationText}>
            {item.cityName}, {item.stateCode}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          {Object.entries(item.availability || {}).map(([day, data]) => (
            <View key={day} style={styles.availabilityRow}>
              <Text style={styles.dayText}>{day}</Text>
              <View style={styles.slotsContainer}>
                {data.slots?.map((slot, index) => (
                  <Text key={index} style={styles.slotText}>
                    {slot.startTime} - {slot.endTime}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <AntDesign name="arrowleft" size={24} color="#3b82f6" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {renderWorkerView()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    padding: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  backButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#3b82f6',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  overviewText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skillText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  locationText: {
    fontSize: 16,
    color: '#4b5563',
  },
  availabilityRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayText: {
    width: 100,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  slotsContainer: {
    flex: 1,
  },
  slotText: {
    fontSize: 16,
    color: '#4b5563',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4b5563',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});