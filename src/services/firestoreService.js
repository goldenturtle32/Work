// src/services/firestoreService.js
import { db } from '../firebase';

export const addUser = async (userData) => {
  try {
    await db.collection('users').doc(userData.id).set(userData);
    console.log('User added successfully!');
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

export const createInterview = async (interviewData) => {
  try {
    const result = await db.collection('interviews').add({
      ...interviewData,
      createdAt: new Date(),
      status: 'pending'
    });
    console.log('Interview created successfully!');
    return result.id;
  } catch (error) {
    console.error("Error creating interview:", error);
    throw error;
  }
};

export const getInterviews = async (matchId) => {
  try {
    const snapshot = await db.collection('interviews')
      .where('matchId', '==', matchId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting interviews:", error);
    throw error;
  }
};

export const updateInterview = async (interviewId, updateData) => {
  try {
    await db.collection('interviews').doc(interviewId).update(updateData);
    console.log('Interview updated successfully!');
  } catch (error) {
    console.error("Error updating interview:", error);
    throw error;
  }
};

/*
// src/services/firestoreService.js
import { db } from '../firebase';

export const addUser = async (userData) => {
  try {
    await db.collection('users').doc(userData.id).set(userData);
    console.log('User added successfully!');
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};


import firestore from '@react-native-firebase/firestore';

export async function addUser(user) {
  await firestore().collection('users').doc(user.id).set(user);
}

export async function getUserProfile(userId) {
  const userDoc = await firestore().collection('users').doc(userId).get();
  return userDoc.data();
}
*/