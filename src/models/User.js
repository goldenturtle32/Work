export default class User {
  uid: string;
  email: string;
  role: string;
  location: { city: string; state: string; country: string };
  skills: string[];
  experience: { totalYears: number; specificRoles: string[] };
  education: string;
  certifications: string[];
  jobTitlePrefs: string[];
  jobTypePrefs: string[];
  industryPrefs: string[];
  salaryPrefs: { min: number; max: number };
  availability: {
    [date: string]: {
      repeatType: string;
      slots: { startTime: string; endTime: string }[];
    };
  };
  category: string;
  reviewsAverage: number;

  constructor(data) {
    this.uid = data.id || '';
    this.email = data.email || '';
    this.role = data.role || '';
    this.location = this.parseLocation(data.location);
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.availability = Array.isArray(data.availability) ? data.availability : [];
    this.category = data.category || '';
    this.reviewsAverage = data.reviewsAverage || 0;

    // These fields are not in the Firebase data, but we'll keep them in the model
    // with default values in case they're needed elsewhere in the app
    this.experience = { totalYears: 0, specificRoles: [] };
    this.education = '';
    this.certifications = [];
    this.jobTitlePrefs = [];
    this.jobTypePrefs = [];
    this.industryPrefs = [];
    this.salaryPrefs = { min: 0, max: 0 };
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