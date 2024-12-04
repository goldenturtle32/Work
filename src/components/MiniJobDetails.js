import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const MiniJobDetails = ({ jobData }) => {
  if (!jobData) return null;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.jobTitle} numberOfLines={2}>
        {jobData.jobTitle || 'No Title'}
      </Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.text}>
          {jobData.user_overview || 'No overview available'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.text}>
          {jobData.distance ? `${jobData.distance} miles away` : 'Location not available'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compensation</Text>
        <Text style={styles.text}>
          ${jobData.salaryRange?.min || 'N/A'}/hr - ${jobData.salaryRange?.max || 'N/A'}/hr
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Skills</Text>
        <View style={styles.skillsContainer}>
          {Array.isArray(jobData.requiredSkills) && jobData.requiredSkills.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>

      {jobData.availability && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          {Object.entries(jobData.availability).map(([date, dayData], index) => (
            <View key={index} style={styles.availabilityItem}>
              {dayData.slots?.map((slot, slotIndex) => (
                <Text key={`${index}-${slotIndex}`} style={styles.text}>
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}: 
                  {slot.startTime} - {slot.endTime}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {jobData.estimatedHours && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimated Weekly Hours</Text>
          <Text style={styles.text}>{jobData.estimatedHours} hours</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  section: {
    marginBottom: 15,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#1e3a8a',
  },
  text: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  skillBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  skillText: {
    fontSize: 12,
    color: '#333',
  },
  availabilityItem: {
    marginVertical: 2,
  },
});

export default MiniJobDetails; 