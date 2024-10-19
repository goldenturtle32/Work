// src/utils/matchAlgorithm.js

export const calculateMatchScore = (user, job) => {
  let userToJobScore = 0;
  let jobToUserScore = 0;

  // Industry Match
  if (user.industryPrefs.includes(job.industry)) {
    userToJobScore += 20;
    jobToUserScore += 20;
  }

  // Job Type Match
  if (user.jobTypePrefs.includes(job.jobType)) {
    userToJobScore += 20;
    jobToUserScore += 20;
  }

  // Skills Match
  const userSkills = new Set(user.skills.map(skill => skill.toLowerCase()));
  const jobSkills = new Set(job.skills.map(skill => skill.toLowerCase()));
  const commonSkills = [...userSkills].filter(skill => jobSkills.has(skill));

  // User to Job
  userToJobScore += Math.min(commonSkills.length * 5, 25); // Max 25

  // Job to User
  jobToUserScore += Math.min(commonSkills.length * 3, 15); // Max 15

  // Location Match (Assuming proximity is already calculated)
  if (isLocationMatch(user.location, job.location)) {
    userToJobScore += 15;
    jobToUserScore += 10;
  }

  // Salary Match
  if (isSalaryMatch(user.salaryPrefs, job.salaryRange)) {
    userToJobScore += 10;
    jobToUserScore += 10;
  }

  // Education Match
  if (meetsEducation(user.education, job.educationRequirements)) {
    userToJobScore += 5;
    jobToUserScore += 10;
  }

  // Experience Match
  if (meetsExperience(user.experience, job.experienceRequirements)) {
    userToJobScore += 5;
    jobToUserScore += 5;
  }

  return { userToJobScore, jobToUserScore };
};

// Helper functions
const isLocationMatch = (userLocation, jobLocation) => {
  const distance = getDistanceFromLatLonInKm(
    userLocation.latitude,
    userLocation.longitude,
    jobLocation.latitude,
    jobLocation.longitude
  );
  return distance <= 20; // Within 20 km
};

const isSalaryMatch = (userSalaries, jobSalaryRange) => {
  // Assuming jobSalaryRange is an object with min and max
  return userSalaries.some(salary => 
    salary >= jobSalaryRange.min && salary <= jobSalaryRange.max
  );
};

const meetsEducation = (userEducation, jobEducationReq) => {
  // Simple comparison; can be enhanced
  const educationLevels = ['High School', 'Associate Degree', 'Bachelor’s Degree', 'Master’s Degree', 'Doctorate'];
  const userHighest = userEducation.reduce((prev, current) => 
    educationLevels.indexOf(current) > educationLevels.indexOf(prev) ? current : prev, 
    userEducation[0]
  );
  return educationLevels.indexOf(userHighest) >= educationLevels.indexOf(jobEducationReq);
};

const meetsExperience = (userExperience, jobExperienceReq) => {
  // Assuming experience is in years
  return userExperience >= jobExperienceReq;
};

// Function to calculate distance between two coordinates
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};
