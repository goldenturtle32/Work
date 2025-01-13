import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Match from '../models/Match';

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'messaged', 'accepted'

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

          // Determine the other user's ID
          const otherUserId = userData.role === 'worker' 
            ? matchData.employerId 
            : matchData.workerId;

          // Get the other user's data from the appropriate collection
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

          return {
            id: doc.id,
            ...matchData,
            otherUser: otherUserDoc.data(),
            timestamp: matchData.timestamp?.toDate() || new Date(),
          };
        }));

        // Filter out any null results and sort by timestamp
        const validMatches = matchesData
          .filter(match => match !== null)
          .sort((a, b) => b.timestamp - a.timestamp);

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
    
    console.log(`Rendering match ${item.id}, accepted: ${isAccepted}`);
    
    return (
      <TouchableOpacity
        style={[
          styles.matchItem,
          isAccepted && styles.acceptedMatch
        ]}
        onPress={() => {
          if (filter === 'accepted' && isAccepted) {
            // If we're in the accepted tab and the match is accepted, go to JobDetailsMatched
            navigation.navigate('JobDetailsMatched', {
              matchId: item.id,
              jobDetails: matchDetails
            });
          } else {
            // Otherwise use the normal handleChatPress logic
            handleChatPress(item);
          }
        }}
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
        <View style={styles.matchInfo}>
          {userRole === 'worker' ? (
            <>
              <Text style={styles.name}>{matchDetails.jobTitle || 'Job Title'}</Text>
              <Text style={styles.subtitle}>{matchDetails.company || 'Company'}</Text>
              <Text style={styles.details}>
                {matchDetails.salaryRange ? 
                  `$${matchDetails.salaryRange.min}-${matchDetails.salaryRange.max}/hr` : 'Salary not specified'}
                {matchDetails.location && ` • ${matchDetails.location}`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.name}>{matchDetails.name || matchDetails.email || 'Candidate'}</Text>
              <Text style={styles.subtitle}>
                {matchDetails.experience?.totalYears 
                  ? `${matchDetails.experience.totalYears} years experience` 
                  : 'Experience not specified'}
              </Text>
              <Text style={styles.details}>
                {matchDetails.skills?.length > 0 
                  ? `Skills: ${matchDetails.skills.slice(0,3).join(', ')}` 
                  : 'Skills not specified'}
              </Text>
            </>
          )}
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              Last message: {item.lastMessage}
            </Text>
          )}
          {isAccepted && (
            <View style={styles.acceptedBadge}>
              <Text style={styles.acceptedText}>Accepted</Text>
            </View>
          )}
        </View>
        <Ionicons 
          name={isAccepted ? "checkmark-circle" : "chevron-forward"} 
          size={24} 
          color={isAccepted ? "#4CAF50" : "#666"} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Matches</Text>
      </View>

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

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50 equivalent
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#2563eb', // primary color
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937', // gray-800
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563', // gray-600
    marginTop: 4,
  },
  details: {
    fontSize: 14,
    color: '#6b7280', // gray-500
    marginTop: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#4b5563', // gray-600
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  acceptedMatch: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981', // green-500
  },
  acceptedBadge: {
    backgroundColor: '#d1fae5', // green-100
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  acceptedText: {
    color: '#059669', // green-600
    fontSize: 12,
    fontWeight: '600',
  },
});
