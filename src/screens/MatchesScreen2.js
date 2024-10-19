import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

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
          const matchData = doc.data();
          const otherUserId = userData.role === 'worker' ? matchData.employerId : matchData.workerId;
          const otherUserDoc = await db.collection(userData.role === 'worker' ? 'job_attributes' : 'user_attributes').doc(otherUserId).get();
          return {
            id: doc.id,
            ...matchData,
            otherUser: otherUserDoc.data()
          };
        }));

        setMatches(matchesData);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const handlePress = (item) => {
    navigation.navigate('Chat', { matchId: item.id, itemTitle: userRole === 'worker' ? item.otherUser.jobTitle : item.otherUser.name });
  };

  const handleLongPress = (item) => {
    navigation.navigate('JobDetail', { itemId: item.id });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => navigation.navigate('JobDetail', { jobId: item.otherUser.id })}
    >
      {userRole === 'worker' ? (
        <>
          <Text style={styles.jobTitle}>{item.otherUser.jobTitle}</Text>
          <Text style={styles.companyName}>{item.otherUser.industry}</Text>
        </>
      ) : (
        <>
          <Text style={styles.name}>{item.otherUser.name}</Text>
          <Text style={styles.skills}>Skills: {item.otherUser.skills?.join(', ')}</Text>
        </>
      )}
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
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity
        style={styles.paymentButton}
        onPress={() => navigation.navigate('Payment')}
      >
        <Text style={styles.paymentButtonText}>Proceed to Payment</Text>
      </TouchableOpacity>
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  matchItem: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  companyName: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 3,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  skills: {
    fontSize: 14,
    color: '#4b5563',
  },
  paymentButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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
