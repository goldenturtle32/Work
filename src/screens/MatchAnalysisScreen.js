import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyzeProfileMatch } from '../utils/matchAnalysis';

export default function MatchAnalysisScreen({ route, navigation }) {
  const { jobData, userData } = route.params;
  const analysis = analyzeProfileMatch(jobData, userData);

  const renderSection = (title, data, icon) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={24} color="#1e3a8a" />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionScore}>
          {(data.score * 100).toFixed(0)}%
        </Text>
      </View>
      <View style={styles.sectionContent}>
        {data.details.map((detail, index) => (
          <Text key={index} style={styles.detail}>{detail}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Overall Match Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreTitle}>Overall Match</Text>
        <Text style={styles.scoreValue}>
          {(analysis.overallFit.score * 100).toFixed(0)}%
        </Text>
        {analysis.overallFit.summary.map((item, index) => (
          <Text key={index} style={styles.summary}>{item}</Text>
        ))}
      </View>

      {/* Skills Match */}
      {renderSection('Skills Match', analysis.skillsMatch, 'checkmark-circle')}

      {/* Schedule Match */}
      {renderSection('Schedule Compatibility', analysis.scheduleMatch, 'time')}

      {/* Location Match */}
      {renderSection('Location & Commute', analysis.locationMatch, 'location')}

      {/* Compensation Match */}
      {renderSection('Compensation', analysis.compensationMatch, 'cash')}

      {/* Recommendations */}
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>Recommendations</Text>
        {analysis.overallFit.recommendations.map((rec, index) => (
          <Text key={index} style={styles.recommendation}>• {rec}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  scoreContainer: {
    backgroundColor: '#1e3a8a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  summary: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 8,
    flex: 1,
  },
  sectionScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  sectionContent: {
    marginLeft: 32,
  },
  detail: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 8,
  },
  recommendationsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  recommendation: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 8,
  },
}); 