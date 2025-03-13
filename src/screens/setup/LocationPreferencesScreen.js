import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { useSetup } from '../../contexts/SetupContext';
import ProgressStepper from '../../components/ProgressStepper';
import Slider from '@react-native-community/slider';
import { db, auth } from '../../firebase';
import firebase from 'firebase/compat/app';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';

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
  
  // New state variables for employer location
  const [addressInput, setAddressInput] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [locationMethod, setLocationMethod] = useState(null); // 'map' or 'address'
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedMapLocation, setSelectedMapLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null);

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
    console.log("Starting location permission request with explicit prompt");
    try {
      // First check existing permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      console.log("Existing permission status:", existingStatus);
      
      // Always request permission explicitly with a prompt
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("New permission status after request:", status);
      
      if (status === 'granted') {
        console.log("Location permission granted, getting current position");
        
        // Get location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        console.log("Got current position:", location.coords);
        
        // Set map region with user's location
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025
        };
        
        console.log("Setting map region:", newRegion);
        setMapRegion(newRegion);
        
        // Reverse geocode to get address information
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        if (address[0]) {
          console.log("Found address:", address[0]);
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
      } else {
        console.log("Location permission denied, using default region");
        Alert.alert(
          "Location Access Required",
          "Please grant location access to use this feature. You can change this in your device settings.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      console.log("Using default map region due to error");
      Alert.alert(
        "Location Error",
        "We couldn't access your location. Please try again or enter it manually.",
        [{ text: "OK" }]
      );
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

  const fetchAddressSuggestions = async (text) => {
    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&format=json&apiKey=35e02d61bf104d6583dccc5de237fbd6`
      );
      const data = await response.json();
      const suggestions = data.results.map(result => ({
        formattedAddress: result.formatted,
        lat: result.lat,
        lon: result.lon,
        street: result.street,
        housenumber: result.housenumber,
        city: result.city,
        state: result.state,
        postcode: result.postcode
      }));
      setAddressSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    }
  };

  const handleCitySuggestionSelect = (suggestion) => {
    setCityInput(`${suggestion.city}, ${suggestion.state}`);
    setSelectedSuggestion(suggestion);
  };

  const handleAddressSuggestionSelect = (suggestion) => {
    setAddressInput(suggestion.formattedAddress);
    setSelectedAddress(suggestion);
    setAddressSuggestions([]);
  };

  const handleMapLocationSelect = async (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedMapLocation(coordinate);
    
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude
      });
      
      if (address[0]) {
        const formattedAddress = [
          address[0].name,
          address[0].street,
          address[0].city,
          address[0].region,
          address[0].postalCode,
          address[0].country
        ].filter(Boolean).join(', ');
        
        setCurrentAddress(formattedAddress);
        
        const geoPoint = new firebase.firestore.GeoPoint(
          coordinate.latitude,
          coordinate.longitude
        );
        
        updateSetupData({
          location: geoPoint,
          cityName: address[0].city,
          stateCode: address[0].region,
          fullAddress: formattedAddress
        });
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  const handleManualLocation = () => {
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

    updateSetupData(locationData);
    
    setSelectedSuggestion(null);
    setCitySuggestions([]);
    setIsManualEntry(false);
  };

  const handleManualAddress = () => {
    if (!selectedAddress) {
      Alert.alert('Error', 'Please select a valid address from the suggestions');
      return;
    }

    const geoPoint = new firebase.firestore.GeoPoint(
      selectedAddress.lat,
      selectedAddress.lon
    );

    const locationData = {
      location: geoPoint,
      cityName: selectedAddress.city,
      stateCode: selectedAddress.state,
      fullAddress: selectedAddress.formattedAddress
    };

    updateSetupData(locationData);
    setLocationMethod(null);
  };

  const handleNext = async () => {
    if (!setupData.location) {
      Alert.alert('Location Required', 'Please share your location or enter your address');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const collectionName = userRole === 'worker' ? 'user_attributes' : 'job_attributes';
      
      // Base update data
      const updateData = {
        location: setupData.location,
        cityName: setupData.cityName,
        stateCode: setupData.stateCode,
        updatedAt: new Date()
      };
      
      // Add employer-specific fields
      if (userRole === 'employer') {
        updateData.fullAddress = setupData.fullAddress;
      } else {
        // Add worker-specific fields
        updateData.locationPreference = setupData.locationPreference || 16093.4;
      }
      
      await db.collection(collectionName).doc(userId).update(updateData);

      console.log(`Successfully updated location in ${collectionName}`);
      navigation.navigate('JobPreferences');
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

  const handlePinpointOnMap = () => {
    // If we don't have mapRegion yet, try to get it now
    if (!mapRegion) {
      requestLocationPermission();
    }
    
    setLocationMethod('map');
  };

  const renderMap = () => {
    console.log('renderMap called with setupData:', setupData);
    
    if (!setupData.location && !mapRegion) {
      console.log('No location data in setupData and no mapRegion');
      return null;
    }

    const mapLocation = mapRegion || {
      latitude: setupData.location ? setupData.location.latitude : 0,
      longitude: setupData.location ? setupData.location.longitude : 0,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025
    };
    
    // Get radius in meters from setupData (only for workers)
    const radiusInMeters = setupData.locationPreference || 16093.4;

    if (userRole === 'worker') {
      return (
        <View style={styles.mapSection}>
          {isWeb && WebMap ? (
            <View style={styles.webMapWrapper}>
              <WebMap
                location={{
                  latitude: mapLocation.latitude,
                  longitude: mapLocation.longitude
                }}
                cityName={setupData.cityName}
                stateCode={setupData.stateCode}
                radius={radiusInMeters}
              />
            </View>
          ) : (
            <MapView
              style={styles.nativeMap}
              region={{
                ...mapLocation,
                // Adjust delta based on radius to show the full circle
                latitudeDelta: Math.max(0.025, radiusInMeters / 50000),
                longitudeDelta: Math.max(0.025, radiusInMeters / 50000)
              }}
            >
              {setupData.location && (
                <>
                  <Marker
                    coordinate={{
                      latitude: setupData.location.latitude,
                      longitude: setupData.location.longitude
                    }}
                    title={setupData.cityName || "Location"}
                    description={setupData.stateCode ? `${setupData.cityName}, ${setupData.stateCode}` : setupData.cityName}
                  />
                  <Circle
                    center={{
                      latitude: setupData.location.latitude,
                      longitude: setupData.location.longitude
                    }}
                    radius={radiusInMeters}
                    strokeWidth={1}
                    strokeColor="rgba(37, 99, 235, 0.5)"
                    fillColor="rgba(37, 99, 235, 0.1)"
                  />
                </>
              )}
            </MapView>
          )}
          
          <View style={styles.radiusControl}>
            <Text style={styles.locationText}>
              Current Location: {setupData.cityName || "Loading..."}
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
            
            <TouchableOpacity
              style={styles.confirmRadiusButton}
              onPress={handleNext}
            >
              <Text style={styles.confirmRadiusButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      // For employers, just show the map for pinpointing
      return (
        <View style={styles.employerMapContainer}>
          {isWeb && WebMap ? (
            <WebMap
              location={mapRegion || { latitude: 37.0902, longitude: -95.7129 }}
              editable={true}
              onLocationSelect={handleMapLocationSelect}
              selectedLocation={selectedMapLocation}
            />
          ) : (
            <MapView
              style={styles.employerMap}
              region={mapRegion || {
                latitude: 37.0902,
                longitude: -95.7129,
                latitudeDelta: 0.025,
                longitudeDelta: 0.025
              }}
              onPress={handleMapLocationSelect}
            >
              {selectedMapLocation && (
                <Marker
                  coordinate={selectedMapLocation}
                  title="Business Location"
                  description={currentAddress || "Selected location"}
                />
              )}
            </MapView>
          )}
        </View>
      );
    }
  };

  const renderEmployerLocationSelection = () => {
    if (locationMethod === null) {
      return (
        <View style={styles.methodSelectionContainer}>
          <Text style={styles.methodSelectionTitle}>How would you like to set your business location?</Text>
          
          <TouchableOpacity 
            style={styles.methodButton}
            onPress={handlePinpointOnMap}
          >
            <Ionicons name="map-outline" size={24} color="#2563eb" />
            <Text style={styles.methodButtonText}>Pinpoint on Map</Text>
            <Text style={styles.methodDescription}>
              Use the map to select the exact location of your business
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.methodButton}
            onPress={() => setLocationMethod('address')}
          >
            <Ionicons name="home-outline" size={24} color="#2563eb" />
            <Text style={styles.methodButtonText}>Enter Address</Text>
            <Text style={styles.methodDescription}>
              Type in your business address
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else if (locationMethod === 'map') {
      return (
        <View style={styles.mapSelectionContainer}>
          <Text style={styles.mapInstructions}>
            Tap on the map to set your business location
          </Text>
          
          {renderMap()}
          
          {currentAddress && (
            <View style={styles.selectedLocationContainer}>
              <Ionicons name="location" size={18} color="#1e40af" />
              <Text style={styles.selectedLocationText}>{currentAddress}</Text>
            </View>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { flex: 1 }]}
              onPress={() => setLocationMethod(null)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { flex: 1 },
                !selectedMapLocation && styles.disabledButton
              ]}
              disabled={!selectedMapLocation}
              onPress={() => setLocationMethod(null)}
            >
              <Text style={styles.actionButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else if (locationMethod === 'address') {
      return (
        <View style={styles.addressEntryContainer}>
          <Text style={styles.label}>Enter your business address</Text>
          <TextInput
            style={styles.input}
            value={addressInput}
            onChangeText={(text) => {
              setAddressInput(text);
              if (text.length > 3) {
                fetchAddressSuggestions(text);
              } else {
                setAddressSuggestions([]);
              }
            }}
            placeholder="123 Main St, City, State"
            placeholderTextColor="#64748b"
          />
          
          {addressSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <ScrollView style={{ maxHeight: 200 }}>
                {addressSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => handleAddressSuggestionSelect(suggestion)}
                  >
                    <Text style={styles.suggestionText}>
                      {suggestion.formattedAddress}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {selectedAddress && (
            <View style={styles.selectedAddressContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#065f46" />
              <Text style={styles.selectedAddressText}>{selectedAddress.formattedAddress}</Text>
            </View>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { flex: 1 }]}
              onPress={() => setLocationMethod(null)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { flex: 1 },
                !selectedAddress && styles.disabledButton
              ]}
              disabled={!selectedAddress}
              onPress={handleManualAddress}
            >
              <Text style={styles.actionButtonText}>Confirm Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };
  
  const renderWorkerLocationSelection = () => {
    return !isManualEntry ? (
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
    );
  };

  const renderPermissionRequest = () => {
    if (!setupData.location && !mapRegion) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            We need your location to find jobs in your area.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.permissionButtonText}>
              Grant Location Access
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
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
              : "Help us find candidates near your business"}
          </Text>
        </View>

        {userRole === 'worker' 
          ? renderWorkerLocationSelection() 
          : renderEmployerLocationSelection()
        }

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {userRole === 'worker'
              ? "We suggest using the location feature for more accurate job matches in your area."
              : "Setting an accurate business location helps candidates determine if they can commute to your workplace."}
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
  nativeMap: {
    height: 300,
    width: '100%',
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
  methodSelectionContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  methodSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 16,
    textAlign: 'center',
  },
  methodButton: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginTop: 8,
  },
  methodDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  mapSelectionContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  addressEntryContainer: {
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
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
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
  mapInstructions: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  selectedLocationText: {
    fontSize: 14,
    color: '#1e40af',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  selectedAddressText: {
    fontSize: 14,
    color: '#065f46',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  confirmRadiusButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmRadiusButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  employerMap: {
    height: 350,
    width: '100%',
    borderRadius: 8,
  },
  employerMapContainer: {
    marginVertical: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  permissionContainer: {
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
}); 