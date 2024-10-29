// src/firebase.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Your Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyAdnUSAc2qgDmxl_amgiDw1vuVUVvk2TBU",
    authDomain: "opus-1adfb.firebaseapp.com",
    projectId: "opus-1adfb",
    storageBucket: "opus-1adfb.appspot.com",
    messagingSenderId: "220362617685",
    appId: "1:220362617685:web:24b3aeb8421750a3d4b5dc",
    measurementId: "G-FM5QZL49CJ"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

// Export Firebase services
const db = firebase.firestore();
const auth = firebase.auth();

export { db, auth, firebase };
