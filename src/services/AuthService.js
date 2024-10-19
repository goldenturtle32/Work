import auth from '@react-native-firebase/auth';

const signUp = (email, password) => {
  return auth().createUserWithEmailAndPassword(email, password);
};

const login = (email, password) => {
  return auth().signInWithEmailAndPassword(email, password);
};

const logout = () => {
  return auth().signOut();
};

export default {
  signUp,
  login,
  logout,
};
