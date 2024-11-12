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

  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    if (filter === 'messaged') return match.lastMessage !== null;
    if (filter === 'accepted') return match.jobAccepted;
    return true;
  });

  const renderMatchItem = ({ item }) => {
    const matchDetails = item.otherUser;
    const otherUserId = userRole === 'worker' ? item.employerId : item.workerId;
    
    return (
      <TouchableOpacity
        style={styles.matchItem}
        onPress={() => navigation.navigate('Chat', {
          jobTitle: matchDetails.jobTitle || 'Job',
          company: matchDetails.company || 'Company',
          role: userRole,
          matchId: item.id
        })}
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
        </View>
        <Ionicons name="chevron-forward" size={24} color="#666" />
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
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Your Matches</Text>
      </LinearGradient>
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
      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton}>
          <Ionicons name="heart" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeFilter: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    color: '#4b5563',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  matchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  details: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  lastMessage: {
    fontSize: 14,
    color: '#4b5563',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 15,
  },
  navButton: {
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});
