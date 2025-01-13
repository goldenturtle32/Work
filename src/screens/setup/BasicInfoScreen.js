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

export default function BasicInfoScreen({ navigation, route }) {
  const { setupData, updateSetupData } = useSetup();
  const [errors, setErrors] = useState({});
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const role = userDoc.data()?.role;
        setUserRole(role);
        console.log('User role:', role);
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
      if (!setupData.estPayRangeMin) {
        newErrors.estPayRangeMin = 'Minimum pay is required';
      }
      if (!setupData.estPayRangeMax) {
        newErrors.estPayRangeMax = 'Maximum pay is required';
      }
      if (setupData.estPayRangeMin && setupData.estPayRangeMax && 
          Number(setupData.estPayRangeMin) >= Number(setupData.estPayRangeMax)) {
        newErrors.estPayRangeMax = 'Maximum pay must be greater than minimum pay';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const collectionName = userRole === 'worker' ? 'user_attributes' : 'job_attributes';
      const data = userRole === 'worker' 
        ? {
            name: setupData.name,
            dateOfBirth: setupData.dateOfBirth,
            email: setupData.email,
            updatedAt: new Date()
          }
        : {
            jobTitle: setupData.jobTitle,
            companyName: setupData.companyName,
            email: setupData.email,
            estPayRangeMin: Number(setupData.estPayRangeMin),
            estPayRangeMax: Number(setupData.estPayRangeMax),
            updatedAt: new Date()
          };

      await db.collection(collectionName).doc(userId).set(data, { merge: true });
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

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Pay Range Estimate ($/hr)</Text>
        <View style={styles.payRangeContainer}>
          <View style={styles.payRangeInput}>
            <TextInput
              style={[
                styles.input,
                styles.payInput,
                errors.estPayRangeMin && styles.inputError
              ]}
              value={setupData.estPayRangeMin}
              onChangeText={(text) => {
                updateSetupData({ estPayRangeMin: text });
                setErrors(prev => ({ ...prev, estPayRangeMin: null }));
              }}
              placeholder="Min"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />
            {errors.estPayRangeMin && <Text style={styles.errorText}>{errors.estPayRangeMin}</Text>}
          </View>
          
          <Text style={styles.payRangeSeparator}>to</Text>
          
          <View style={styles.payRangeInput}>
            <TextInput
              style={[
                styles.input,
                styles.payInput,
                errors.estPayRangeMax && styles.inputError
              ]}
              value={setupData.estPayRangeMax}
              onChangeText={(text) => {
                updateSetupData({ estPayRangeMax: text });
                setErrors(prev => ({ ...prev, estPayRangeMax: null }));
              }}
              placeholder="Max"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />
            {errors.estPayRangeMax && <Text style={styles.errorText}>{errors.estPayRangeMax}</Text>}
          </View>
        </View>
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