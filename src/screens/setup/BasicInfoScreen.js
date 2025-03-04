import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import { AntDesign } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { serverTimestamp } from 'firebase/firestore';

export default function BasicInfoScreen({ navigation, route }) {
  const { setupData, updateSetupData } = useSetup();
  const [errors, setErrors] = useState({});
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [includesTips, setIncludesTips] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
          
          // Fetch the existing email from the appropriate collection
          const collection = userDoc.data().role === 'employer' ? 'job_attributes' : 'user_attributes';
          const attributesDoc = await db.collection(collection).doc(auth.currentUser.uid).get();
          
          if (attributesDoc.exists) {
            const existingData = attributesDoc.data();
            // Initialize setupData with existing email
            updateSetupData({
              ...setupData,
              email: existingData.email || auth.currentUser.email // Fallback to auth email
            });
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const formatDateString = (input) => {
    // Remove any non-numeric characters
    const numbers = input.replace(/\D/g, '');
    
    // Format the string based on length
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
    }
  };

  const handleDateChange = (text) => {
    console.log('Date input changed:', text);
    // Only allow numeric input
    if (!/^\d{0,8}$/.test(text.replace(/\D/g, ''))) {
      return;
    }

    const formattedDate = formatDateString(text);
    console.log('Formatted date:', formattedDate);
    updateSetupData({ dateOfBirth: formattedDate });
    setErrors(prev => ({ ...prev, dateOfBirth: null }));
  };

  const validateAge = (dob) => {
    // Convert MM-DD-YYYY to Date object
    const [month, day, year] = dob.split('-').map(num => parseInt(num, 10));
    const birthDate = new Date(year, month - 1, day); // month is 0-based
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18;
  };

  const handleNext = async () => {
    console.log('Validating user data...');
    const newErrors = {};
    
    if (userRole === 'worker') {
      if (!setupData.name?.trim()) {
        newErrors.name = 'Name is required';
      }
      
      if (!setupData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      } else if (!validateAge(setupData.dateOfBirth)) {
        newErrors.dateOfBirth = 'You must be 18 or older';
      }
    } else if (userRole === 'employer') {
      if (!setupData.jobTitle?.trim()) {
        newErrors.jobTitle = 'Job title is required';
      }
      if (!setupData.companyName?.trim()) {
        newErrors.companyName = 'Company name is required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Ensure email is included in the update
      const updatedData = {
        ...setupData,
        email: setupData.email || auth.currentUser.email // Fallback to auth email
      };

      // Update setupData with email included
      updateSetupData(updatedData);

      // Update the appropriate collection
      const collection = userRole === 'employer' ? 'job_attributes' : 'user_attributes';
      await db.collection(collection).doc(auth.currentUser.uid).update({
        ...updatedData,
        updatedAt: serverTimestamp()
      });

      navigation.navigate('LocationPreferences');
    } catch (error) {
      console.error('Error updating attributes:', error);
      Alert.alert('Error', 'Failed to save your information. Please try again.');
    }
  };

  const renderWorkerForm = () => (
    <View style={styles.form}>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={setupData.name}
          onChangeText={(text) => {
            updateSetupData({ name: text });
            setErrors(prev => ({ ...prev, name: null }));
          }}
          placeholder="Enter your name"
          placeholderTextColor="#64748b"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Date of Birth</Text>
        <TextInput
          style={[styles.input, errors.dateOfBirth && styles.inputError]}
          value={setupData.dateOfBirth}
          onChangeText={handleDateChange}
          placeholder="MM-DD-YYYY"
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          maxLength={10}
        />
        {errors.dateOfBirth && (
          <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
        )}
      </View>
    </View>
  );

  const renderEmployerForm = () => (
    <View style={styles.form}>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Job Title</Text>
        <TextInput
          style={[styles.input, errors.jobTitle && styles.inputError]}
          value={setupData.jobTitle}
          onChangeText={(text) => {
            updateSetupData({ jobTitle: text });
            setErrors(prev => ({ ...prev, jobTitle: null }));
          }}
          placeholder="Enter job title"
          placeholderTextColor="#64748b"
        />
        {errors.jobTitle && <Text style={styles.errorText}>{errors.jobTitle}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Company Name</Text>
        <TextInput
          style={[styles.input, errors.companyName && styles.inputError]}
          value={setupData.companyName}
          onChangeText={(text) => {
            updateSetupData({ companyName: text });
            setErrors(prev => ({ ...prev, companyName: null }));
          }}
          placeholder="Enter company name"
          placeholderTextColor="#64748b"
        />
        {errors.companyName && <Text style={styles.errorText}>{errors.companyName}</Text>}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={1} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {userRole === 'worker' 
              ? "Let's get your profile set up"
              : "Let's post your job"}
          </Text>
          <Text style={styles.subtitle}>
            {userRole === 'worker'
              ? "We're excited to help you find your next job!"
              : "We're excited to help you find your candidate for this role!"}
          </Text>
        </View>

        {userRole === 'worker' ? renderWorkerForm() : renderEmployerForm()}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={setupData.email}
            editable={false}
            placeholder="example@email.com"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const additionalStyles = {
  payRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payRangeInput: {
    flex: 1,
  },
  payInput: {
    textAlign: 'center',
  },
  payRangeSeparator: {
    marginHorizontal: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  tipsButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tipsButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  tipsButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tipsButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsButtonTextActive: {
    color: '#ffffff',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#1e3a8a',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 32,
  },
  nextButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  ...additionalStyles,
}); 