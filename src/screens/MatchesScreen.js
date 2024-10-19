import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
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
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        setUserRole(userData.role);

        const matchesSnapshot = await db.collection('matches')
          .where(`${userData.role}Id`, '==', auth.currentUser.uid)
          .where('worker', '==', true)
          .where('employer', '==', true)
          .get();

        const matchesData = await Promise.all(matchesSnapshot.docs.map(async (doc) => {
          const matchData = new Match({ id: doc.id, ...doc.data() });
          const otherUserId = userData.role === 'worker' ? matchData.employerId : matchData.workerId;
          const otherUserDoc = await db.collection(userData.role === 'worker' ? 'job_attributes' : 'user_attributes').doc(otherUserId).get();
          
          // Fetch last message
          const lastMessageDoc = await db.collection('messages')
            .where('matchId', '==', matchData.id)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

          const lastMessage = lastMessageDoc.docs[0]?.data() || null;

          return {
            ...matchData,
            otherUser: otherUserDoc.data(),
            lastMessage,
          };
        }));

        // Sort matches by last message timestamp
        matchesData.sort((a, b) => {
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return b.lastMessage.timestamp.toDate() - a.lastMessage.timestamp.toDate();
        });

        setMatches(matchesData);
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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => navigation.navigate('Chat', { matchId: item.id, itemTitle: userRole === 'worker' ? item.otherUser.jobTitle : item.otherUser.name })}
    >
      <Image
        source={{ uri: item.otherUser.profilePicture || 'https://via.placeholder.com/50' }}
        style={styles.profilePicture}
      />
      <View style={styles.matchInfo}>
        <Text style={styles.name}>{userRole === 'worker' ? item.otherUser.jobTitle : item.otherUser.name}</Text>
        <Text style={styles.lastMessage}>{item.lastMessage ? item.lastMessage.text : 'No messages yet'}</Text>
      </View>
      {item.jobAccepted && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
    </TouchableOpacity>
  );

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
        renderItem={renderItem}
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
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  matchInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
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
