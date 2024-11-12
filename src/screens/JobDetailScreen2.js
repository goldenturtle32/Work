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

const BACKEND_URL = 'http://127.0.0.1:5000';

const QuickMatchOverview = ({ analysis }) => {
  if (!analysis) return null;
  
  return (
    <View style={styles.matchOverview}>
      <Text style={styles.matchScore}>
        {((analysis.overallFit?.score || 0) * 100).toFixed(0)}% Match
      </Text>
      <View style={styles.matchDetails}>
        <Text style={styles.matchDetail}>Skills: {((analysis.skillsMatch?.score || 0) * 100).toFixed(0)}%</Text>
        <Text style={styles.matchDetail}>Schedule: {((analysis.scheduleMatch?.score || 0) * 100).toFixed(0)}%</Text>
        <Text style={styles.matchDetail}>Location: {((analysis.locationMatch?.score || 0) * 100).toFixed(0)}%</Text>
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

  const renderJobDetails = () => {
    if (!item) return null;

    return (
      <>
        <Text style={styles.title}>{item.jobTitle || 'No Title'}</Text>
        
        {/* Location Section */}
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.description}>{locationDisplay}</Text>
          {item?.distance && (
            <Text style={styles.description}>
              {item.distance.toFixed(1)} miles away
              {'\n'}Estimated commute:{'\n'}
              By Car: ~{Math.round(item.distance * 1.5)} minutes{'\n'}
              By Transit: ~{Math.round(item.distance * 3)} minutes
            </Text>
          )}
        </View>

        {/* Pay Information */}
        <Text style={styles.sectionTitle}>Compensation</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.description}>
            Pay Range: ${item.salaryRange?.min || 'N/A'}/hr - ${item.salaryRange?.max || 'N/A'}/hr{'\n'}
            Weekly Hours: {item.weeklyHours || 0} hours{'\n'}
            Estimated Weekly Pay: ${((item.salaryRange?.min || 0) * (item.weeklyHours || 0)).toLocaleString()} - 
            ${((item.salaryRange?.max || 0) * (item.weeklyHours || 0)).toLocaleString()}
          </Text>
        </View>

        {/* Benefits Section */}
        <Text style={styles.sectionTitle}>Benefits</Text>
        <View style={styles.benefitsContainer}>
          {getBenefits().map((benefit, index) => (
            <View key={index} style={styles.benefitBubble}>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {/* Skills Section */}
        <Text style={styles.sectionTitle}>Required Skills</Text>
        <View style={styles.skillsContainer}>
          {item.requiredSkills?.map((skill, index) => (
            <View key={index} style={styles.skillBubble}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>

        {/* Match Analysis */}
        <Text style={styles.sectionTitle}>Match Analysis</Text>
        <View style={styles.matchAnalysisContainer}>
          {analyzeMatch().map((match, index) => (
            <Text key={index} style={styles.matchDetail}>• {match}</Text>
          ))}
        </View>

        {/* Availability Match */}
        <Text style={styles.sectionTitle}>Schedule Compatibility</Text>
        <View style={styles.scheduleMatchContainer}>
          {analyzeScheduleMatch().length > 0 ? (
            analyzeScheduleMatch().map((timeSlot, index) => (
              <Text key={index} style={styles.scheduleMatch}>{timeSlot}</Text>
            ))
          ) : (
            <Text style={styles.description}>No matching availability found</Text>
          )}
        </View>

        {/* LLM Analysis Section */}
        <Text style={styles.sectionTitle}>Why This Is a Great Match</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.description}>{llmAnalysis}</Text>
        </View>
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
      {item && (
        <>
          {/* Job Title Section */}
          <View style={styles.jobDetails}>
            <Text style={styles.jobTitle}>{item.jobTitle}</Text>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionText}>
              {item.formattedLocation || 'Location unavailable'}
            </Text>
          </View>

          {/* Compensation Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compensation</Text>
            <Text style={styles.sectionText}>Pay Range: ${item.salaryRange?.min}/hr - ${item.salaryRange?.max}/hr</Text>
            <Text style={styles.sectionText}>Weekly Hours: {item.weeklyHours || 0} hours</Text>
            <Text style={styles.sectionText}>
              Estimated Weekly Pay: ${(item.salaryRange?.min * (item.weeklyHours || 0)).toFixed(0)} - 
              ${(item.salaryRange?.max * (item.weeklyHours || 0)).toFixed(0)}
            </Text>
          </View>

          {/* Benefits Section */}
          {item.benefits && item.benefits.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Benefits</Text>
              {item.benefits.map((benefit, index) => (
                <Text key={index} style={styles.sectionText}>{benefit}</Text>
              ))}
            </View>
          )}

          {/* Required Skills Section */}
          {item.requiredSkills && item.requiredSkills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Required Skills</Text>
              {item.requiredSkills.map((skill, index) => (
                <Text key={index} style={styles.sectionText}>{skill}</Text>
              ))}
            </View>
          )}

          {/* Match Analysis Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Analysis</Text>
            <QuickMatchOverview analysis={analysis} />
          </View>

          {/* Schedule Compatibility Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule Compatibility</Text>
            <Text style={styles.sectionText}>
              {analysis?.scheduleMatch?.details || 'No matching availability found'}
            </Text>
          </View>

          {/* LLM Analysis Section */}
          <View style={styles.analysisContainer}>
            <Text style={styles.sectionTitle}>Why This Is a Great Match</Text>
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
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  jobDetails: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  matchOverview: {
    marginVertical: 8,
  },
  matchScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  matchDetails: {
    marginTop: 8,
  },
  matchDetail: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  analysisContainer: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  analysisText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  quickMatchContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  matchScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  matchScoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  matchScoreLabel: {
    color: '#fff',
    fontSize: 12,
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
  skillText: {
    color: '#1976d2',
    fontSize: 14,
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
  matchAnalysisContainer: {
    marginBottom: 16,
  },
  scheduleMatchContainer: {
    marginBottom: 16,
  },
});
