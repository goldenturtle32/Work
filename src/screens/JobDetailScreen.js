import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { db, auth } from '../firebase';
import { calculateMatch } from '../utils/matchUtils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Job from '../models/Job';
import User from '../models/User';
import FirebaseUser from '../models/FirebaseUser';
import { analyzeProfileMatch } from '../utils/matchAnalysis';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AntDesign } from '@expo/vector-icons';

const BACKEND_URL = 'http://127.0.0.1:5000';

const QuickMatchOverview = ({ analysis }) => {
  if (!analysis) return null;
  
  return (
    <View style={styles.matchAnalysisContainer}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${analysis.overallMatch}%` }]} />
      </View>
      <Text style={styles.matchPercentage}>{analysis.overallMatch}% match based on your profile</Text>
      
      <View style={styles.matchMetrics}>
        {analysis.matchDetails?.map((detail, index) => (
          <View key={index} style={styles.matchMetric}>
            <Text style={styles.matchMetricText}>{detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function JobDetailScreen({ route, navigation }) {
  const { itemId, itemType, currentUserData, item: initialItem } = route.params;
  const [item, setItem] = useState(initialItem);
  const [currentUser, setCurrentUser] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [locationDisplay, setLocationDisplay] = useState('Loading location...');
  const [llmAnalysis, setLlmAnalysis] = useState('');

  // Helper functions
  const getBenefits = () => {
    if (!item) return [];
    const benefits = [];
    
    // Salary-based benefits
    if (item.salaryRange?.max > 50) benefits.push('High Pay Rate');
    if (item.weeklyHours >= 40) benefits.push('Full-time Hours');
    
    // Job type benefits
    if (item.jobType === 'Full-time') benefits.push('Full Benefits Package');
    if (item.jobType === 'Flexible') benefits.push('Flexible Schedule');
    
    // Distance-based benefits
    if (item.distance && item.distance < 10) benefits.push('Close to Home');
    
    return benefits;
  };

  const analyzeMatch = () => {
    if (!item || !currentUser) return [];
    const matches = [];

    // Skills match
    if (currentUser.role === 'worker') {
      const matchingSkills = item.requiredSkills?.filter(skill => 
        currentUser.skills?.includes(skill)
      );
      if (matchingSkills?.length > 0) {
        matches.push(`Matching Skills: ${matchingSkills.join(', ')}`);
      }
    }

    // Experience match
    if (currentUser.role === 'worker' && item.requiredExperience?.minYears) {
      if (currentUser.experience?.totalYears >= item.requiredExperience.minYears) {
        matches.push(`Experience: ${currentUser.experience.totalYears} years (meets ${item.requiredExperience.minYears} year requirement)`);
      }
    }

    // Salary match
    if (currentUser.role === 'worker' && currentUser.salaryPrefs && item.salaryRange) {
      if (item.salaryRange.max >= currentUser.salaryPrefs.min) {
        matches.push('Salary matches your preferences');
      }
    }

    return matches;
  };

  const analyzeScheduleMatch = () => {
    if (!item || !currentUser) return [];
    const matchingSlots = [];

    // Compare availability schedules
    if (item.availability && currentUser.availability) {
      Object.entries(item.availability).forEach(([day, slots]) => {
        const userSlots = currentUser.availability[day];
        if (userSlots) {
          const overlapping = findOverlappingSlots(userSlots, slots);
          if (overlapping.length > 0) {
            matchingSlots.push(`${day}: ${overlapping.map(slot => 
              `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
            ).join(', ')}`);
          }
        }
      });
    }

    return matchingSlots;
  };

  const findOverlappingSlots = (slots1, slots2) => {
    if (!Array.isArray(slots1) || !Array.isArray(slots2)) return [];
    const overlapping = [];
    
    slots1.forEach(slot1 => {
      slots2.forEach(slot2 => {
        const start1 = new Date(`1970/01/01 ${slot1.startTime}`);
        const end1 = new Date(`1970/01/01 ${slot1.endTime}`);
        const start2 = new Date(`1970/01/01 ${slot2.startTime}`);
        const end2 = new Date(`1970/01/01 ${slot2.endTime}`);

        if (start1 < end2 && end1 > start2) {
          overlapping.push({
            startTime: start1 > start2 ? slot1.startTime : slot2.startTime,
            endTime: end1 < end2 ? slot1.endTime : slot2.endTime
          });
        }
      });
    });
    
    return overlapping;
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (result && result[0]) {
        const location = result[0];
        return {
          city: location.city || location.subregion || location.district,
          state: location.region
        };
      }
      throw new Error('No results found');
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const formatLocation = async (location) => {
    if (!location) return 'Location unavailable';

    // If we already have city and state
    if (location.city && location.state) {
      return `${location.city}, ${location.state}`;
    }

    // Get coordinates regardless of format
    const lat = location._lat || location.latitude;
    const lng = location._long || location.longitude;

    if (lat && lng) {
      const geoCodedLocation = await reverseGeocode(lat, lng);
      if (geoCodedLocation) {
        return `${geoCodedLocation.city}, ${geoCodedLocation.state}`;
      }
    }

    return 'Location unavailable';
  };

  const getJobAnalysis = async (jobData, userData) => {
    try {
      console.log('Sending data for analysis:', { job: jobData, user: userData });
      
      const response = await fetch(`${BACKEND_URL}/analyze-job-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job: jobData,
          user: userData
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Server response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to get analysis');
      }

      return data.analysis;
    } catch (error) {
      console.error('Error getting job analysis:', error);
      // Return a basic analysis instead of throwing
      return `This ${jobData.jobTitle} position matches your profile in several ways. You have relevant experience and skills that align with the job requirements.`;
    }
  };

  const fetchDetails = async () => {
    try {
      setLoading(true);
      
      if (route.params?.itemId) {
        const itemDoc = await db.collection('job_attributes').doc(route.params.itemId).get();
        
        if (itemDoc.exists) {
          const jobData = itemDoc.data();
          setItem(jobData);
          
          // Get basic match analysis
          const matchAnalysis = analyzeProfileMatch(jobData, currentUserData);
          setAnalysis(matchAnalysis);

          try {
            // Get LLM analysis
            const llmResult = await getJobAnalysis(jobData, currentUserData);
            setLlmAnalysis(llmResult);
          } catch (error) {
            console.error('LLM Analysis error:', error);
            setLlmAnalysis('Unable to generate detailed analysis at this time.');
          }
        }
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [route.params?.itemId]);

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        if (item) {
          // Request location permissions (needed for reverse geocoding)
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationDisplay('Location permissions not granted');
            return;
          }

          // Format location
          const formattedLocation = await formatLocation(item.location);
          setLocationDisplay(formattedLocation);

          // Perform match analysis
          if (currentUserData) {
            const matchAnalysis = analyzeProfileMatch(item, currentUserData);
            setAnalysis(matchAnalysis);
            setMatchScore(matchAnalysis.overallFit.score);
          }
        }
      } catch (error) {
        console.error('Error loading job details:', error);
        setLocationDisplay('Location unavailable');
      }
    };

    loadJobDetails();
  }, [item, currentUserData]);

  const renderWorkerView = () => {
    return (
      <ScrollView style={styles.container}>
        {/* Primary Info Section */}
        <View style={styles.section}>
          <Text style={styles.name}>{item.name || 'Name not available'}</Text>
        </View>

        {/* Skills Match Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills Match</Text>
          <View style={styles.skillsContainer}>
            {item.skills?.map((skill, index) => (
              <View key={index} style={[
                styles.skillBubble,
                matchingSkills.includes(skill) && styles.matchingSkillBubble
              ]}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Job Overview & Match Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why This Is a Great Match</Text>
          <Text style={styles.analysisText}>{llmAnalysis}</Text>
          
          <View style={styles.matchAnalysisContainer}>
            <QuickMatchOverview analysis={analysis} />
            {analysis?.details?.map((detail, index) => (
              <Text key={index} style={styles.matchDetail}>• {detail}</Text>
            ))}
          </View>
        </View>

        {/* Schedule Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Compatibility</Text>
          <View style={styles.scheduleMatchContainer}>
            {analyzeScheduleMatch().map((timeSlot, index) => (
              <Text key={index} style={styles.scheduleMatch}>{timeSlot}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderEmployerView = () => {
    // Calculate worker's average salary from their job history/preferences
    const workerAverageSalary = currentUser?.salaryHistory?.reduce((acc, curr) => acc + curr, 0) / 
      currentUser?.salaryHistory?.length || currentUser?.salaryPrefs?.desired;

    return (
      <ScrollView style={styles.container}>
        {/* Primary Info Section */}
        <View style={styles.section}>
          <Text style={styles.jobTitle}>{item.jobTitle || 'Job Title not available'}</Text>
          <Text style={styles.company}>{item.company || 'Company not available'}</Text>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Travel</Text>
          <Text style={styles.locationText}>{item.location?.address || 'Location unavailable'}</Text>
          <View style={styles.distanceInfo}>
            <Text style={styles.distanceDetail}>
              Distance from worker: {item.distance?.toFixed(1) || '0'} miles
            </Text>
            <Text style={styles.travelEstimates}>Estimated Travel Time:</Text>
            <View style={styles.travelMethods}>
              <View style={styles.travelMethod}>
                <Ionicons name="car" size={20} color="#666" />
                <Text style={styles.travelTime}>
                  ~{Math.round((item.distance || 0) * 2)} mins
                </Text>
              </View>
              <View style={styles.travelMethod}>
                <Ionicons name="bus" size={20} color="#666" />
                <Text style={styles.travelTime}>
                  ~{Math.round((item.distance || 0) * 4)} mins
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Compensation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compensation Analysis</Text>
          <View style={styles.salaryComparison}>
            <Text style={styles.salaryDetail}>
              Position Pay Range: ${item.salaryRange?.min}/hr - ${item.salaryRange?.max}/hr
            </Text>
            <Text style={styles.salaryDetail}>
              Worker's Average Salary: ${workerAverageSalary?.toFixed(2)}/hr
            </Text>
            <View style={styles.salaryAnalysis}>
              {workerAverageSalary && (
                <Text style={[
                  styles.salaryMatch,
                  workerAverageSalary <= item.salaryRange?.max ? 
                  styles.salaryMatchGood : styles.salaryMatchPoor
                ]}>
                  {workerAverageSalary <= item.salaryRange?.max ? 
                    '✓ Salary range matches worker\'s expectations' :
                    '⚠ Salary range below worker\'s average'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Skills Match Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Skills</Text>
          <View style={styles.skillsContainer}>
            {item.requiredSkills?.map((skill, index) => {
              const isMatching = currentUser?.skills?.includes(skill);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.skillBubble,
                    isMatching && styles.matchingSkillBubble
                  ]}
                >
                  <Text style={[
                    styles.skillText,
                    isMatching && styles.matchingSkillText
                  ]}>
                    {skill} {isMatching && '✓'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Worker Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worker Overview</Text>
          <View style={styles.workerDetails}>
            <Text style={styles.workerDetail}>
              Experience: {currentUser?.experience?.totalYears || 0} years
            </Text>
            <Text style={styles.workerDetail}>
              Preferred Schedule: {currentUser?.availability?.preferredShift || 'Flexible'}
            </Text>
            <Text style={styles.workerDetail}>
              Education: {currentUser?.education?.level || 'Not specified'}
            </Text>
          </View>
        </View>

        {/* Match Analysis Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Analysis</Text>
          <QuickMatchOverview analysis={analysis} />
          <Text style={styles.analysisText}>{llmAnalysis}</Text>
        </View>

        {/* Schedule Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Compatibility</Text>
          <View style={styles.scheduleMatchContainer}>
            {analyzeScheduleMatch().map((timeSlot, index) => (
              <Text key={index} style={styles.scheduleMatch}>{timeSlot}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderDetails = () => {
    if (itemType === 'job') {
      return renderEmployerView();
    } else {
      return renderWorkerView();
    }
  };

  const renderAnalysis = () => {
    if (loading) {
      return <Text style={styles.analysisText}>Loading analysis...</Text>;
    }

    return (
      <View style={styles.analysisContainer}>
        <Text style={styles.sectionTitle}>Why This Is a Great Match</Text>
        <Text style={styles.analysisText}>{llmAnalysis || 'Analysis not available'}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <AntDesign name="arrowleft" size={24} color="#3b82f6" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {item && (
        <>
          {/* Job Title Section */}
          <View style={styles.card}>
            <Text style={styles.jobTitle}>{item.jobTitle}</Text>
            <Text style={styles.companyName}>{item.companyName || 'Company Name'}</Text>
          </View>

          {/* Location Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionText}>
              {item.formattedLocation || 'Location unavailable'}
            </Text>
            <Text style={styles.travelInfo}>2.5 miles away</Text>
            <Text style={styles.travelInfo}>Est. travel time: 15 mins</Text>
          </View>

          {/* Compensation Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Compensation</Text>
            <Text style={styles.compensationText}>
              <Text style={styles.labelText}>Pay Range: </Text>
              ${item.salaryRange?.min}/hr - ${item.salaryRange?.max}/hr
            </Text>
            <Text style={styles.compensationText}>
              <Text style={styles.labelText}>Weekly Hours: </Text>
              {item.weeklyHours || 0} hours
            </Text>
            <Text style={styles.compensationText}>
              <Text style={styles.labelText}>Estimated Weekly Pay: </Text>
              ${(item.salaryRange?.min * (item.weeklyHours || 0)).toFixed(0)} - 
              ${(item.salaryRange?.max * (item.weeklyHours || 0)).toFixed(0)}
            </Text>
            <Text style={styles.salaryComparison}>
              10% above average for similar positions
            </Text>
          </View>

          {/* Skills Wanted Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Skills Wanted</Text>
            {item.requiredSkills && item.requiredSkills.map((skill, index) => (
              <Text key={index} style={[
                styles.skillText,
                analysis?.matchingSkills?.includes(skill) && styles.matchingSkill
              ]}>
                • {skill} {analysis?.matchingSkills?.includes(skill) && '(match)'}
              </Text>
            ))}
          </View>

          {/* Match Analysis Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Match Analysis</Text>
            <QuickMatchOverview analysis={analysis} />
          </View>

          {/* Schedule Compatibility Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Schedule Compatibility</Text>
            <Text style={styles.sectionText}>
              {analysis?.scheduleMatch?.details || 'No matching availability found'}
            </Text>
            {analysis?.scheduleMatch?.isCompatible && (
              <Text style={styles.compatibilityText}>Aligns with your availability</Text>
            )}
          </View>

          {/* Why This Job Would Be a Good Fit */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Why This Job Would Be a Good Fit</Text>
            <Text style={styles.analysisText}>
              {llmAnalysis || 'Analysis not available'}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  travelInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  compensationText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  labelText: {
    fontWeight: '500',
  },
  salaryComparison: {
    fontSize: 14,
    color: '#059669',
    marginTop: 8,
  },
  skillText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  matchingSkill: {
    color: '#059669',
  },
  compatibilityText: {
    fontSize: 14,
    color: '#059669',
    marginTop: 4,
  },
  analysisText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 5,
  },
  matchPercentage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchAnalysisContainer: {
    marginBottom: 16,
  },
  matchMetrics: {
    flex: 1,
  },
  matchMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchMetricText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4b5563',
  },
  analysisButton: {
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  analysisButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  benefitBubble: {
    backgroundColor: '#e0f2f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  benefitText: {
    color: '#00796b',
    fontSize: 14,
  },
  skillBubble: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  scheduleMatch: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  infoContainer: {
    marginBottom: 16,
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
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  distanceInfo: {
    marginTop: 12,
  },
  distanceDetail: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  travelEstimates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  travelMethods: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  travelMethod: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelTime: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  salaryComparison: {
    marginVertical: 8,
  },
  salaryDetail: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  salaryAnalysis: {
    marginTop: 8,
  },
  salaryMatch: {
    fontSize: 14,
    padding: 8,
    borderRadius: 4,
  },
  salaryMatchGood: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  salaryMatchPoor: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  matchingSkillText: {
    color: '#2e7d32',
  },
  workerDetails: {
    marginTop: 8,
  },
  workerDetail: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
});
