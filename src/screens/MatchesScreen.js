import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Match from '../models/Match';
import ViewToggle from '../components/matches/ViewToggle';
import * as Location from 'expo-location';
import NativeMap from '../components/matches/NativeMap';

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'messaged', 'accepted'
  const [isMapView, setIsMapView] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [matchLocations, setMatchLocations] = useState([]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        setUserRole(userData.role);

        console.log('Current user ID:', auth.currentUser.uid);
        console.log('Current user role:', userData.role);

        // Query matches where the current user is either the worker or employer
        const matchesQuery = db.collection('matches').where(
          `${userData.role}Id`,
          '==',
          auth.currentUser.uid
        );

        console.log('Match query:', `${userData.role}Id`, '==', auth.currentUser.uid);

        const matchesSnapshot = await matchesQuery.get();
        console.log(`Found ${matchesSnapshot.size} matches`);

        const matchesData = await Promise.all(matchesSnapshot.docs.map(async (doc) => {
          const matchData = doc.data();
          console.log('Processing match:', doc.id, matchData);

          // Get the other user's data
          const otherUserId = userData.role === 'worker' 
            ? matchData.employerId 
            : matchData.workerId;
          
          const otherUserCollection = userData.role === 'worker' 
            ? 'job_attributes' 
            : 'user_attributes';
          
          const otherUserDoc = await db.collection(otherUserCollection)
            .doc(otherUserId)
            .get();

          if (!otherUserDoc.exists) {
            console.log(`Other user doc not found in ${otherUserCollection}:`, otherUserId);
            return null;
          }

          // Get the last message timestamp from the match data
          const lastMessageTime = matchData.lastMessageTime 
            ? matchData.lastMessageTime.toDate() 
            : matchData.timestamp?.toDate() || new Date();

          return {
            id: doc.id,
            ...matchData,
            otherUser: otherUserDoc.data(),
            lastMessageTime: lastMessageTime,
            timestamp: matchData.timestamp?.toDate() || new Date(),
          };
        }));

        // Filter out null results and sort by lastMessageTime in descending order
        const validMatches = matchesData
          .filter(match => match !== null)
          .sort((a, b) => {
            // Sort by lastMessageTime if it exists, otherwise use timestamp
            const timeA = a.lastMessageTime || a.timestamp;
            const timeB = b.lastMessageTime || b.timestamp;
            return timeB - timeA;  // Descending order (most recent first)
          });

        console.log(`Processing complete. Found ${validMatches.length} valid matches`);
        setMatches(validMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  useEffect(() => {
    const getLocationPermission = async () => {
      if (userRole === 'worker' && isMapView) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to show the map.');
          setIsMapView(false);
          return;
        }

        try {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.error('Error getting location:', error);
          Alert.alert('Error', 'Unable to get current location');
          setIsMapView(false);
        }
      }
    };

    getLocationPermission();
  }, [userRole, isMapView]);

  useEffect(() => {
    const fetchMatchLocations = async () => {
      if (userRole === 'worker' && isMapView && matches.length > 0) {
        try {
          // Map through matches and fetch location from job_attributes for each employer
          const locations = await Promise.all(
            matches.map(async (match) => {
              // Get employer ID from the match
              const employerId = match.employerId;
              
              // Fetch the employer's job_attributes document
              const employerDoc = await db.collection('job_attributes')
                .doc(employerId)
                .get();

              if (!employerDoc.exists) {
                console.log('No job_attributes found for employer:', employerId);
                return null;
              }

              const employerData = employerDoc.data();
              
              // Check if location exists and has valid coordinates
              if (employerData.location?.latitude && employerData.location?.longitude) {
                return {
                  latitude: employerData.location.latitude,
                  longitude: employerData.location.longitude,
                  jobTitle: match.jobTitle || employerData.jobTitle || 'Job Opening',
                  industry: employerData.industry || 'Not specified',
                  employerName: employerData.companyName || 'Company',
                  matchId: match.id
                };
              }
              return null;
            })
          );

          // Filter out null values and set locations
          const validLocations = locations.filter(loc => loc !== null);
          console.log('Valid match locations:', validLocations);
          setMatchLocations(validLocations);
          
        } catch (error) {
          console.error('Error fetching match locations:', error);
          Alert.alert(
            'Error',
            'Unable to load employer locations. Please try again later.'
          );
        }
      }
    };

    fetchMatchLocations();
  }, [matches, userRole, isMapView]);

  const handleChatPress = (match) => {
    console.log('Navigating with match data:', match);
    
    // Check if match is accepted
    if (match.accepted === 1) {
      console.log('Navigating to JobDetailsMatched for accepted match:', match.id);
      navigation.navigate('JobDetailsMatched', {
        matchId: match.id,
        jobDetails: match.otherUser  // Pass the job details directly
      });
    } else {
      console.log('Navigating to Chat for unaccepted match:', match.id);
      navigation.navigate('Chat', {
        matchId: match.id,
        role: userRole,
        jobTitle: match.jobTitle
      });
    }
  };

  const filteredMatches = matches.filter(match => {
    switch(filter) {
      case 'all':
        return true;
      case 'messaged':
        return match.lastMessage !== null;
      case 'accepted':
        console.log('Checking accepted match:', match.id, match.accepted);
        return match.accepted === 1;
      default:
        return true;
    }
  });

  const renderMatchItem = ({ item }) => {
    const matchDetails = item.otherUser;
    const otherUserId = userRole === 'worker' ? item.employerId : item.workerId;
    const isAccepted = item.accepted === 1;
    
    return (
      <TouchableOpacity
        style={[
          styles.matchItem,
          isAccepted && styles.acceptedMatch
        ]}
        onPress={() => handleChatPress(item)}
        onLongPress={async () => {
          try {
            let detailsCollection;
            let detailsId;

            if (userRole === 'worker') {
              // Worker viewing employer's job
              detailsCollection = 'job_attributes';
              // Get the job_attributes id that matches the employer's user id
              const jobQuery = await db.collection('job_attributes')
                .where('userId', '==', otherUserId)
                .get();
                
              if (jobQuery.empty) {
                console.error('No job found for employer:', otherUserId);
                Alert.alert('Error', 'Could not find job details');
                return;
              }
              
              detailsId = jobQuery.docs[0].id;
            } else {
              // Employer viewing worker's profile
              detailsCollection = 'user_attributes';
              detailsId = otherUserId; // Worker's user ID directly maps to user_attributes
            }

            console.log('Fetching details from:', detailsCollection, 'with ID:', detailsId);
            
            const docRef = db.collection(detailsCollection).doc(detailsId);
            const doc = await docRef.get();

            if (!doc.exists) {
              console.error('Document not found in', detailsCollection);
              Alert.alert('Error', 'Could not find details for this match');
              return;
            }

            const detailData = doc.data();
            
            navigation.navigate('JobDetail', {
              itemId: detailsId,
              itemType: userRole === 'worker' ? 'job' : 'worker',
              fromMatches: true,
              item: detailData
            });
          } catch (error) {
            console.error('Error fetching details:', error);
            Alert.alert('Error', 'Failed to load details');
          }
        }}
        delayLongPress={500}
      >
        <View style={styles.matchContent}>
          <View style={styles.matchHeader}>
            <View style={styles.userInfo}>
              {userRole === 'worker' ? (
                <View style={styles.iconTextContainer}>
                  <Ionicons name="business" size={16} color="#6b7280" />
                  <Text style={styles.name}>
                    {matchDetails.jobTitle ? `${matchDetails.jobTitle} - ` : ''}
                    {matchDetails.companyName || 'Company'}
                  </Text>
                </View>
              ) : (
                <View style={styles.iconTextContainer}>
                  <Ionicons name="person" size={16} color="#6b7280" />
                  <Text style={styles.name}>{matchDetails.name || matchDetails.email || 'Candidate'}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.iconTextContainer}>
              <Ionicons name="location" size={16} color="#6b7280" />
              <Text style={styles.locationText}>
                {matchDetails.cityName || 'Location not specified'}
              </Text>
            </View>

            {item.lastMessage && (
              <View style={styles.messageContainer}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#6b7280" />
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
            )}

            {isAccepted && (
              <View style={styles.acceptedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.acceptedText}>Accepted</Text>
              </View>
            )}
          </View>
          
          <View style={styles.chevronContainer}>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color="#9ca3af"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator 
          color="#3b82f6" 
          style={{ transform: [{ scale: 1.4 }] }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Matches</Text>
          <Text style={styles.headerSubtitle}>
            Connect with opportunities that match your profile
          </Text>
          <View style={styles.matchCountContainer}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#93c5fd" />
            <Text style={styles.matchCount}>
              {filteredMatches.length} matches found
            </Text>
          </View>
        </View>
      </View>

      {userRole === 'worker' && (
        <View style={styles.toggleContainer}>
          <ViewToggle
            isMapView={isMapView}
            onToggle={() => setIsMapView(!isMapView)}
          />
        </View>
      )}

      <View style={styles.stickyHeader}>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'messaged' && styles.activeFilter]}
            onPress={() => setFilter('messaged')}
          >
            <Text style={[styles.filterText, filter === 'messaged' && styles.activeFilterText]}>Messaged</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'accepted' && styles.activeFilter]}
            onPress={() => setFilter('accepted')}
          >
            <Text style={[styles.filterText, filter === 'accepted' && styles.activeFilterText]}>Accepted</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isMapView ? (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <NativeMap
          currentLocation={currentLocation}
          matchLocations={matchLocations}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50 equivalent
  },
  header: {
    paddingVertical: 16,  // shrink top/bottom
    paddingHorizontal: 20,
    backgroundColor: '#2563eb', // primary color
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe', // blue-100 equivalent
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 300,
  },
  matchCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.75,
  },
  matchCount: {
    color: '#ffffff',
    fontSize: 14,
  },
  stickyHeader: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999, // rounded-full
    borderWidth: 1,
    borderColor: '#e5e7eb', // gray-200
    backgroundColor: '#ffffff',
  },
  activeFilter: {
    backgroundColor: '#2563eb', // primary
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280', // gray-500
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // pb-20 equivalent
  },
  matchItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  matchContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  matchHeader: {
    flex: 1,
  },
  iconTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userInfo: {
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  acceptedMatch: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  acceptedText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  chevronContainer: {
    marginLeft: 12,
  },
  toggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
});
