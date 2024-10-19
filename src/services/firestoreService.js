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