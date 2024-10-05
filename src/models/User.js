// src/models/User.js
export default class User {
  constructor(uid, email, role, location, skills, experience, education, certifications, jobTitlePrefs, jobTypePrefs, industryPrefs, salaryPrefs, availability) {
    this.uid = uid;
    this.email = email;
    this.role = role; // Example: 'Job Seeker' or 'Employer'
    this.location = location; // Example: { city: 'Los Angeles', state: 'CA', country: 'USA' }
    this.skills = skills; // Example: ['Plumbing', 'Electrical Work']
    this.experience = experience; // Example: { totalYears: 5, specificRoles: ['Plumber', 'Electrician'] }
    this.education = education; // Example: "Associate's Degree in Construction Management"
    this.certifications = certifications; // Example: ['Licensed Plumber', 'OSHA Certification']
    this.jobTitlePrefs = jobTitlePrefs; // Example: ['Plumber', 'Electrician']
    this.jobTypePrefs = jobTypePrefs; // Example: ['Full-time', 'Contract']
    this.industryPrefs = industryPrefs; // Example: ['Construction', 'Maintenance']
    this.salaryPrefs = salaryPrefs; // Example: { min: 25, max: 50 } for hourly wage or annual range
    this.availability = availability; // Example: ['Monday', 'Wednesday', 'Friday']
  }
}
