import React, { useEffect, useState } from 'react';
import GoogleMapReact from 'google-map-react';
import { View, Text, StyleSheet } from 'react-native';

// Custom dark map style
const mapStyles = [
  {
    "featureType": "all",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#ffffff"}]
  },
  {
    "featureType": "all",
    "elementType": "labels.text.stroke",
    "stylers": [{"visibility": "off"}]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{"visibility": "simplified"}]
  },
  {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [{"color": "#2c2c2c"}]
  },
  {
    "featureType": "poi",
    "elementType": "all",
    "stylers": [{"visibility": "off"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#3f3f3f"}]
  },
  {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [{"visibility": "off"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#222222"}]
  }
];

const LocationMarker = () => (
  <div style={{
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
  }}>
    {/* Outer pulse ring */}
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '50px',
      height: '50px',
      borderRadius: '50%',
      border: '3px solid rgba(0, 123, 255, 0.4)',
      animation: 'pulse 2s ease-out infinite',
    }} />
    {/* Inner pulse ring */}
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '35px',
      height: '35px',
      borderRadius: '50%',
      border: '3px solid rgba(0, 123, 255, 0.6)',
      animation: 'pulse 2s ease-out infinite',
      animationDelay: '0.5s',
    }} />
    {/* Center dot */}
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '16px',
      height: '16px',
      backgroundColor: '#007BFF',
      borderRadius: '50%',
      border: '3px solid rgba(0, 123, 255, 1)',
    }} />
  </div>
);

export default function WebMap({ location, radius, cityName, stateCode }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [circle, setCircle] = useState(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAE0JeoZzUNIo3r-BM_nCaJOM9aDhbnC1w&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(2);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const createMapOptions = (maps) => {
    return {
      styles: mapStyles,
      disableDefaultUI: true,
      zoomControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
    };
  };

  const handleGoogleApiLoaded = ({ map, maps }) => {
    // Create the radius circle
    const newCircle = new maps.Circle({
      center: { lat: location.latitude, lng: location.longitude },
      radius: radius,
      strokeColor: '#444444',
      strokeOpacity: 0.3,
      strokeWeight: 2,
      fillColor: '#444444',
      fillOpacity: 0.1,
      map: map,
      editable: false,
      draggable: false,
      clickable: false
    });
    
    setCircle(newCircle);
  };

  // Update circle radius when radius prop changes
  useEffect(() => {
    if (circle && radius) {
      circle.setRadius(radius);
    }
  }, [radius, circle]);

  if (!location || !mapLoaded) return (
    <View style={styles.mapContainer}>
      <View style={styles.locationTextContainer}>
        <Text style={styles.locationText}>
          Current Location: {cityName}{stateCode ? `, ${stateCode}` : ''}
        </Text>
      </View>
      <View style={styles.loadingContainer}>
        <Text>Loading map...</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.mapContainer}>
      <View style={styles.locationTextContainer}>
        <Text style={styles.locationText}>
          Current Location: {cityName}{stateCode ? `, ${stateCode}` : ''}
        </Text>
      </View>
      <div style={{ height: '280px', width: '100%' }}>
        <GoogleMapReact
          bootstrapURLKeys={{ 
            key: 'AIzaSyAE0JeoZzUNIo3r-BM_nCaJOM9aDhbnC1w',
            libraries: ['places', 'geometry']
          }}
          defaultCenter={{
            lat: location.latitude,
            lng: location.longitude
          }}
          defaultZoom={14}
          options={createMapOptions}
          yesIWantToUseGoogleMapApiInternals
          onGoogleApiLoaded={handleGoogleApiLoaded}
        >
          <LocationMarker
            lat={location.latitude}
            lng={location.longitude}
          />
        </GoogleMapReact>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    marginVertical: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  locationTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  locationText: {
    fontSize: 16,
    color: '#007BFF',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
});