import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import User from '../models/User';
import Job from '../models/Job';
import { db } from '../firebase';  // Assuming Firebase is set up
import { calculateMatch } from '../utils/matchUtils'; // Import matching logic

function JobDetailsScreen({ userData }) {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsSnapshot = await db.collection('job_attributes').get(); // Updated collection name
      let fetchedJobs = jobsSnapshot.docs.map(doc => {
        const jobData = doc.data();
        return new Job(
          doc.id,
          jobData.location,
          jobData.requiredSkills,
          jobData.requiredExperience,
          jobData.requiredEducation,
          jobData.requiredCertifications,
          jobData.jobTitle,
          jobData.jobType,
          jobData.industry,
          jobData.salaryRange,
          jobData.requiredAvailability
        );
      });

      const user = new User(
        userData.uid,
        userData.email,
        userData.role,
        userData.location,
        userData.skills,
        userData.experience,
        userData.education,
        userData.certifications,
        userData.jobTitlePrefs,
        userData.jobTypePrefs,
        userData.industryPrefs,
        userData.salaryPrefs,
        userData.availability
      );

      // Calculate match scores (using calculateMatch function)
      let scoredJobs = fetchedJobs.map(job => ({
        ...job,
        matchScore: calculateMatch(user, job)
      }));

      // Sort jobs by match score
      scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

      setJobs(scoredJobs);
    };

    fetchJobs();
  }, [userData]);

  return (
    <View>
      {jobs.map(job => (
        <View key={job.id}>
          <Text>{job.jobTitle} - {job.industry}</Text>
          <Text>Skills: {job.requiredSkills.join(', ')}</Text>
          <Text>Experience: {job.requiredExperience.minYears} years</Text>
          <Text>Match Score: {job.matchScore}</Text>
        </View>
      ))}
    </View>
  );
}

export default JobDetailsScreen;
