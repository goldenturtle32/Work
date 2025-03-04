import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const MiniJobDetails = ({ jobData }) => {
  if (!jobData) return null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.jobTitle}>
          {jobData.jobTitle || 'Position Title Not Specified'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.sectionText}>
          {jobData.job_overview || 'No overview available'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.sectionText}>
          {jobData.distance ? `${jobData.distance} miles away` : 'Location not specified'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compensation</Text>
        <Text style={styles.sectionText}>
          {jobData.estPayRangeMin && jobData.estPayRangeMax
            ? `$${jobData.estPayRangeMin}-${jobData.estPayRangeMax}/hr`
            : 'Pay range not specified'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Skills</Text>
        <View style={styles.skillsContainer}>
          {jobData.skills?.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>
                {skill.name}
                {skill.yearsOfExperience > 0 && (
                  <Text style={styles.experienceText}>
                    {' '}({skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'})
                  </Text>
                )}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Availability</Text>
        {Object.entries(jobData.availability || {}).map(([day, data]) => (
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1e3a8a',
  },
  sectionText: {
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
    backgroundColor: '#f0f9ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  skillText: {
    color: '#0369a1',
    fontSize: 14,
  },
  experienceText: {
    color: '#64748b',
    fontSize: 12,
  },
  availabilityRow: {
    marginBottom: 12,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  slotsContainer: {
    paddingLeft: 16,
  },
  slotText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 2,
  },
});

export default MiniJobDetails; 