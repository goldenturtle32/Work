import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { db } from './firebase'; // Import Firestore

export default function JobList() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const jobSnapshot = await db.collection('jobs').get();
        const jobData = jobSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setJobs(jobData);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
    };

    fetchJobs();
  }, []);

  return (
    <View>
      {jobs.length > 0 ? (
        jobs.map((job) => (
          <View key={job.id}>
            <Text>Title: {job.jobTitle}</Text>
            <Text>Employer: {job.employer}</Text>
            <Text>Location: {job.location}</Text>
            <Text>Pay: $50/hour</Text>
          </View>
        ))
      ) : (
        <Text>Loading jobs...</Text>
      )}
    </View>
  );
}