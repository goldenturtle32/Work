import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import Slider from '@react-native-community/slider';
import { db, auth } from '../../firebase';
import firebase from 'firebase/compat/app';

const isWeb = Platform.OS === 'web';
let WebMap = null;
if (isWeb) {
  try {
    WebMap = require('../../components/WebMap').default;
    console.log('WebMap imported successfully:', WebMap);
  } catch (error) {
    console.error('Error importing WebMap:', error);
  }
}

export default function LocationPreferencesScreen({ navigation }) {
  const { setupData, updateSetupData } = useSetup();
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
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
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        if (address[0]) {
          const geoPoint = new firebase.firestore.GeoPoint(
            location.coords.latitude,
            location.coords.longitude
          );

          updateSetupData({
            location: geoPoint,
            cityName: address[0].city,
            stateCode: address[0].region
          });
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchCitySuggestions = async (text) => {
    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&type=city&format=json&apiKey=35e02d61bf104d6583dccc5de237fbd6`
      );
      const data = await response.json();
      const suggestions = data.results.map(result => ({
        city: result.city,
        state: result.state,
        lat: result.lat,
        lon: result.lon
      }));
      setCitySuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching city suggestions:', error);
    }
  };

  const handleCitySuggestionSelect = (suggestion) => {
    setCityInput(`${suggestion.city}, ${suggestion.state}`);
    setSelectedSuggestion(suggestion);
  };

  const handleManualLocation = () => {
    console.log('handleManualLocation called');
    console.log('cityInput:', cityInput);
    console.log('selectedSuggestion:', selectedSuggestion);

    if (!cityInput.trim() || !selectedSuggestion) {
      Alert.alert('Error', 'Please select a city from the suggestions');
      return;
    }

    const geoPoint = new firebase.firestore.GeoPoint(
      selectedSuggestion.lat,
      selectedSuggestion.lon
    );

    const locationData = {
      location: geoPoint,
      cityName: selectedSuggestion.city,
      stateCode: selectedSuggestion.state
    };

    console.log('Updating setup data with:', locationData);
    updateSetupData(locationData);
    
    setSelectedSuggestion(null);
    setCitySuggestions([]);
    setIsManualEntry(false);
  };

  const handleNext = async () => {
    if (!setupData.location) {
      Alert.alert('Location Required', 'Please share your location or enter your city');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const collectionName = userRole === 'worker' ? 'user_attributes' : 'job_attributes';
      
      await db.collection(collectionName).doc(userId).update({
        location: setupData.location,
        cityName: setupData.cityName,
        stateCode: setupData.stateCode,
        locationPreference: setupData.locationPreference || 16093.4,
        updatedAt: new Date()
      });

      console.log(`Successfully updated location in ${collectionName}`);
      navigation.navigate('JobPreferences');
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

  const renderMap = () => {
    console.log('renderMap called with setupData:', setupData);
    
    if (!setupData.location) {
      console.log('No location data in setupData');
      return null;
    }

    const mapLocation = {
      latitude: setupData.location.latitude,
      longitude: setupData.location.longitude
    };

    return (
      <View style={styles.mapSection}>
        {isWeb && WebMap && (
          <View style={styles.webMapWrapper}>
            <WebMap
              location={mapLocation}
              cityName={setupData.cityName}
              stateCode={setupData.stateCode}
              radius={setupData.locationPreference || 16093.4}
            />
          </View>
        )}
        
        <View style={styles.radiusControl}>
          <Text style={styles.locationText}>
            Current Location: {setupData.cityName}
            {setupData.stateCode ? `, ${setupData.stateCode}` : ''}
          </Text>
          <Text style={styles.radiusText}>
            Search Radius: {((setupData.locationPreference || 16093.4) / 1609.34).toFixed(1)} miles
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1609.34}
            maximumValue={80467.2}
            step={1609.34}
            value={setupData.locationPreference || 16093.4}
            onValueChange={(value) => {
              updateSetupData({ locationPreference: value });
            }}
            minimumTrackTintColor="#2563eb"
            maximumTrackTintColor="#94a3b8"
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ProgressStepper currentStep={2} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Now for your location...</Text>
          <Text style={styles.subtitle}>
            {userRole === 'worker' 
              ? "Help us find jobs in your area"
              : "Help us find candidates in your area"}
          </Text>
        </View>

        {!isManualEntry ? (
          <>
            {renderMap()}
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => setIsManualEntry(true)}
            >
              <Text style={styles.manualButtonText}>
                Enter location manually instead
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.manualEntryContainer}>
            <Text style={styles.label}>Enter your city</Text>
            <TextInput
              style={styles.input}
              value={cityInput}
              onChangeText={(text) => {
                setCityInput(text);
                if (text.length > 2) {
                  fetchCitySuggestions(text);
                } else {
                  setCitySuggestions([]);
                }
              }}
              placeholder="e.g., San Francisco"
              placeholderTextColor="#64748b"
            />
            {citySuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {citySuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => {
                      handleCitySuggestionSelect(suggestion);
                      setCitySuggestions([]);
                    }}
                  >
                    <Text style={styles.suggestionText}>
                      {suggestion.city}, {suggestion.state}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleManualLocation}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => setIsManualEntry(false)}
            >
              <Text style={styles.manualButtonText}>
                Use device location instead
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {userRole === 'worker'
              ? "We suggest using the location feature for more accurate job matches in your area."
              : "We suggest using the location feature to help find the best candidates in your area."}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
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
  mapSection: {
    marginVertical: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webMapWrapper: {
    height: 300,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  radiusControl: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#2563eb',
    marginBottom: 10,
  },
  radiusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  manualEntryContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
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
    marginBottom: 12,
  },
  manualButton: {
    padding: 12,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#2563eb',
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  disclaimer: {
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    marginBottom: 24,
  },
  disclaimerText: {
    color: '#1e40af',
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backButtonText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
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
  suggestionsContainer: {
    position: 'absolute',
    top: 84,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestionText: {
    color: '#1e3a8a',
    fontSize: 14,
  },
}); 