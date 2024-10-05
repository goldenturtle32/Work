// src/models/Job.js
export default class Job {
  constructor(id, location, requiredSkills, requiredExperience, requiredEducation, requiredCertifications, jobTitle, jobType, industry, salaryRange, requiredAvailability) {
    this.id = id;
    this.location = location; // Example: { city: 'San Francisco', state: 'CA', country: 'USA' }
    this.requiredSkills = requiredSkills; // Example: ['Plumbing', 'Electrical Work']
    this.requiredExperience = requiredExperience; // Example: { minYears: 2, preferredYears: 5 }
    this.requiredEducation = requiredEducation; // Example: "Bachelor's Degree"
    this.requiredCertifications = requiredCertifications; // Example: ['Licensed Plumber']
    this.jobTitle = jobTitle; // Example: 'Plumber'
    this.jobType = jobType; // Example: 'Full-time', 'Contract'
    this.industry = industry; // Example: 'Construction'
    this.salaryRange = salaryRange; // Example: { min: 20, max: 40 } for hourly wage or annual range
    this.requiredAvailability = requiredAvailability; // Example: ['Monday', 'Wednesday', 'Friday']
  }
}
