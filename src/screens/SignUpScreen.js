import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { Ionicons } from '@expo/vector-icons';

const PhoneInputField = ({ value, onChange }) => {
  return (
    <View style={styles.phoneInputWrapper}>
      <View style={styles.countryCode}>
        <Text style={styles.countryCodeText}>+1</Text>
      </View>
      <TextInput
        style={styles.phoneInputField}
        value={value}
        onChangeText={onChange}
        placeholder="Enter phone number"
        keyboardType="phone-pad"
        maxLength={10}
      />
    </View>
  );
};

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      await updateUserDocument(result.user, 'google');
    } catch (error) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      const provider = new firebase.auth.FacebookAuthProvider();
      const result = await auth.signInWithPopup(provider);
      await updateUserDocument(result.user, 'facebook');
    } catch (error) {
      console.error('Facebook sign in error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handlePhoneSignIn = async () => {
    try {
      if (!phoneNumber.trim()) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return;
      }

      const formattedNumber = `+1${phoneNumber}`;
      const appVerifier = window.recaptchaVerifier;
      
      if (!appVerifier) {
        // Initialize reCAPTCHA verifier
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible',
        });
      }
      
      const confirmation = await auth.signInWithPhoneNumber(formattedNumber, window.recaptchaVerifier);
      // Store confirmation result and navigate to verification screen
      navigation.navigate('PhoneVerification', {
        confirmation,
        phoneNumber: formattedNumber,
        role,
      });
    } catch (error) {
      console.error('Phone sign in error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const updateUserDocument = async (user, provider) => {
    try {
      const userDoc = {
        id: user.uid,
        email: user.email,
        role: role,
        socialLogins: firebase.firestore.FieldValue.arrayUnion(provider),
        isNewUser: true,
      };

      await db.collection('users').doc(user.uid).set(userDoc, { merge: true });
      
      // Create user_attributes document with minimal initial data
      const attributesDoc = {
        uid: user.uid,
        email: user.email,
        role: role,
      };

      await db.collection('user_attributes').doc(user.uid).set(attributesDoc, { merge: true });
    } catch (error) {
      console.error('Error updating user document:', error);
      Alert.alert('Error', 'Failed to update user information');
    }
  };

  const handleEmailSignUp = async () => {
    try {
      setLoading(true);
      
      // Validation
      if (!email || !password || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      if (password.length < 6) {
        Alert.alert('Error', 'Password should be at least 6 characters');
        return;
      }

      // Create user with email and password
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      
      // Update user document
      await updateUserDocument(userCredential.user, 'email');

      // Navigate to the first setup screen instead of AttributeSelection
      navigation.navigate('BasicInfo', { 
        userId: userCredential.user.uid,
        role: role 
      });

    } catch (error) {
      console.error('Email sign up error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      {/* Email Signup Form */}
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm Password"
          secureTextEntry
        />

        {/* Role Selection */}
        <View style={styles.roleContainer}>
          <Text style={styles.label}>I am a:</Text>
          <View style={styles.roleButtons}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'worker' && styles.roleButtonActive
              ]}
              onPress={() => setRole('worker')}
            >
              <Text style={[
                styles.roleButtonText,
                role === 'worker' && styles.roleButtonTextActive
              ]}>Worker</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'employer' && styles.roleButtonActive
              ]}
              onPress={() => setRole('employer')}
            >
              <Text style={[
                styles.roleButtonText,
                role === 'employer' && styles.roleButtonTextActive
              ]}>Employer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleEmailSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Signup Options */}
      <View style={styles.socialContainer}>
        <TouchableOpacity 
          style={[styles.socialButton, styles.googleButton]}
          onPress={handleGoogleSignIn}
        >
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.socialButtonText}>Sign up with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, styles.facebookButton]}
          onPress={handleFacebookSignIn}
        >
          <Ionicons name="logo-facebook" size={24} color="#fff" />
          <Text style={styles.socialButtonText}>Sign up with Facebook</Text>
        </TouchableOpacity>

        <View style={styles.phoneContainer}>
          <PhoneInputField
            value={phoneNumber}
            onChange={setPhoneNumber}
          />
          <TouchableOpacity 
            style={[styles.socialButton, styles.phoneButton]}
            onPress={handlePhoneSignIn}
          >
            <Ionicons name="call-outline" size={24} color="#fff" />
            <Text style={styles.socialButtonText}>Sign up with Phone</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Link */}
      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.loginLinkText}>
          Already have an account? <Text style={styles.loginLinkTextBold}>Log In</Text>
        </Text>
      </TouchableOpacity>

      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 10,
  },
  pickerContainer: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
  },
  picker: {
    height: 50,
    width: 200,
  },
  button: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  socialContainer: {
    marginTop: 20,
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  facebookButton: {
    backgroundColor: '#4267B2',
  },
  phoneButton: {
    backgroundColor: '#34A853',
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  phoneContainer: {
    marginTop: 10,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  countryCode: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
  },
  phoneInputField: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  roleContainer: {
    marginVertical: 15,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#4b5563',
  },
  roleButtonTextActive: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6b7280',
  },
  loginLink: {
    marginTop: 20,
  },
  loginLinkText: {
    color: '#4b5563',
    fontSize: 14,
  },
  loginLinkTextBold: {
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
});
