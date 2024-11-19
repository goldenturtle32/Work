export default class User {
  uid: string;
  id: string;
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
  user_overview: string;
  name: string;
  selectedJobs: string[];

  constructor(data) {
    this.uid = data.uid || data.id || '';
    this.id = data.id || data.uid || '';
    this.email = data.email || '';
    this.role = data.role || '';
    this.location = this.parseLocation(data.location);
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.availability = Array.isArray(data.availability) ? data.availability : [];
    this.category = data.category || '';
    this.reviewsAverage = data.reviewsAverage || 0;
    this.user_overview = data.user_overview || '';
    this.name = data.name || '';
    this.selectedJobs = Array.isArray(data.selectedJobs) ? data.selectedJobs : [];

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

  get userId() {
    return this.uid || this.id;
  }

  toObject() {
    return {
      uid: this.uid,
      id: this.id,
      email: this.email,
      role: this.role,
      user_overview: this.user_overview,
      name: this.name,
      selectedJobs: this.selectedJobs,
      // ... other properties
    };
  }
}
