// src/services/firestoreService.js
// Firestore service to manage user data storage and retrieval.

import firestore from '@react-native-firebase/firestore';

export async function addUser(user) {
  await firestore().collection('users').doc(user.id).set(user);
}

export async function getUserProfile(userId) {
  const userDoc = await firestore().collection('users').doc(userId).get();
  return userDoc.data();
}
