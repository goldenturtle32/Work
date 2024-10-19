// src/models/FirebaseUser.js
export default class FirebaseUser {
  constructor(data) {
    this.id = data.id || '';
    this.email = data.email || '';
    this.role = data.role || '';
    this.location = this.parseLocation(data.location);
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.availability = Array.isArray(data.availability) ? data.availability : [];
    this.category = data.category || '';
    this.reviewsAverage = data.reviewsAverage || 0;
  }

  parseLocation(location) {
    if (location && location.latitude && location.longitude) {
      return {
        latitude: location.latitude,
        longitude: location.longitude
      };
    }
    return { latitude: 0, longitude: 0 };
  }
}