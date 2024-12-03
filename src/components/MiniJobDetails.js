import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const MiniJobDetails = ({ jobData }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.jobTitle}>{jobData.jobTitle}</Text>
      
      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.text}>{jobData.formattedLocation}</Text>
      </View>

      {/* Compensation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compensation</Text>
        <Text style={styles.text}>
          ${jobData.salaryRange?.min}/hr - ${jobData.salaryRange?.max}/hr
        </Text>
      </View>

      {/* Skills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Skills</Text>
        <View style={styles.skillsContainer}>
          {jobData.requiredSkills?.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  text: {
    fontSize: 14,
    color: '#666',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  skillBubble: {
    backgroundColor: '#E8E8E8',
    borderRadius: 15,
    padding: 8,
    margin: 3,
  },
  skillText: {
    fontSize: 12,
  },
});

export default MiniJobDetails; 