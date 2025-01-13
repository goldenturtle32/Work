import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView 
} from 'react-native';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';

// Card component
const Card = ({ children }) => (
  <View style={styles.card}>
    {children}
  </View>
);

// CardHeader component
const CardHeader = ({ title, description }) => (
  <View style={styles.cardHeader}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardDescription}>{description}</Text>
  </View>
);

// Input component
const Input = ({ label, error, ...props }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.input, error && styles.inputError]}
      {...props}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

// Add this component at the top with other components
const ErrorToast = ({ message, onDismiss }) => {
  React.useEffect(() => {
    const timer = setTimeout(onDismiss, 3000); // Auto dismiss after 3 seconds
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.toastContainer}>
      <View style={styles.toastContent}>
        <Ionicons name="alert-circle" size={24} color="#fff" />
        <Text style={styles.toastMessage}>{message}</Text>
      </View>
    </View>
  );
};

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toastError, setToastError] = useState('');

  const handleEmailSignUp = async () => {
    try {
      setLoading(true);
      
      // First validate the form inputs
      if (!email || !password || !confirmPassword) {
        setToastError('Please fill in all fields');
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setToastError('Please enter a valid email');
        return;
      }

      if (password.length < 6) {
        setToastError('Password must be at least 6 characters');
        return;
      }

      if (password !== confirmPassword) {
        setToastError('Passwords do not match');
        return;
      }

      // Create user authentication
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // Create base user document
      await setDoc(doc(db, 'users', uid), {
        email: email,
        role: role,
        provider: 'email',
        setupComplete: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Create role-specific document and update email
      if (role === 'worker') {
        await setDoc(doc(db, 'user_attributes', uid), {
          uid: uid,
          email: email,
          role: 'worker',
          setupComplete: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update email in user_attributes
        await setDoc(doc(db, 'user_attributes', uid), {
          email: email
        }, { merge: true });

      } else if (role === 'employer') {
        await setDoc(doc(db, 'job_attributes', uid), {
          id: uid,
          email: email,
          role: 'employer',
          setupComplete: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update email in job_attributes
        await setDoc(doc(db, 'job_attributes', uid), {
          email: email
        }, { merge: true });
      }

      console.log('Created user with role:', role);
      console.log('User documents created and email updated in appropriate collection');

      navigation.navigate('BasicInfo', { 
        userId: uid,
        role: role 
      });
    } catch (error) {
      console.error('Email sign up error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setToastError('This email is already registered. Please use a different email or login.');
      } else {
        setToastError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {toastError ? (
        <ErrorToast 
          message={toastError} 
          onDismiss={() => setToastError('')}
        />
      ) : null}
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card>
            <CardHeader 
              title="Create Account" 
              description="Enter your details below to create your account"
            />
            
            <View style={styles.cardContent}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="m@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
                error={errors.confirmPassword}
              />

              <View style={styles.roleContainer}>
                <Text style={styles.inputLabel}>I am a:</Text>
                <View style={styles.roleButtons}>
                  {['worker', 'employer'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.roleButton,
                        role === type && styles.roleButtonActive
                      ]}
                      onPress={() => setRole(type)}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        role === type && styles.roleButtonTextActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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

              {/* Social login buttons */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Existing social buttons code... */}

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.loginLinkTextBold}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    position: 'relative',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 16,
  },
  cardHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardContent: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
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
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 5,
  },
  toastContent: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastMessage: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
});
