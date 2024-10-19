import * as Location from 'expo-location';

const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.log('Permission to access location was denied');
  }
};

// Call this function in a useEffect
useEffect(() => {
  requestLocationPermission();
}, []);
