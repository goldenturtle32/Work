// Example: Storing Additional User Data in Firestore
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const createUserProfile = async (user) => {
    const userProfile = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
        // Add any other fields you need
    };

    await firestore()
        .collection('users')
        .doc(user.uid)
        .set(userProfile);
};
