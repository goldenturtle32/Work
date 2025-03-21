import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import MiniJobDetails from './MiniJobDetails';
import MiniChatScreen from './MiniChatScreen';
import { db, firebase } from '../firebase';

const SCREEN_WIDTH = Dimensions.get('window').width;

const NewMatchModal = ({ visible, onClose, jobData, matchData }) => {
  const [currentScreen, setCurrentScreen] = useState(0);

  useEffect(() => {
    if (visible && matchData) {
      const createChat = async () => {
        try {
          const chatRef = db.collection('chats').doc(matchData.id);
          const chatDoc = await chatRef.get();
          
          if (!chatDoc.exists) {
            await chatRef.set({
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastMessage: null,
              lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
              participants: [
                matchData.workerId,
                matchData.employerId
              ]
            });
          }
        } catch (error) {
          console.error('Error creating chat:', error);
        }
      };

      createChat();
    }
  }, [visible, matchData]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
          
          <Text style={styles.matchTitle}>It's a Match!</Text>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, currentScreen === 0 && styles.activeTab]}
              onPress={() => setCurrentScreen(0)}
            >
              <Text style={[styles.tabText, currentScreen === 0 && styles.activeTabText]}>
                Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, currentScreen === 1 && styles.activeTab]}
              onPress={() => setCurrentScreen(1)}
            >
              <Text style={[styles.tabText, currentScreen === 1 && styles.activeTabText]}>
                Chat
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={[
            styles.contentContainer,
            currentScreen === 1 && styles.chatContainer
          ]}>
            {currentScreen === 0 ? (
              <MiniJobDetails jobData={jobData} />
            ) : (
              <View style={styles.chatWrapper}>
                <MiniChatScreen matchData={matchData} />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 1,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 28,
    color: '#666',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: '#185ee0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  chatWrapper: {
    flex: 1,
    transform: [{ scaleY: 1 }], // Ensure correct orientation
  },
});

export default NewMatchModal; 