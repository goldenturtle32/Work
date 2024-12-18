const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000'
  : 'https://your-production-api.com';

export const fetchJobs = async () => {
  const response = await fetch(`${API_BASE_URL}/jobs`);
  return response.json();
};

export const fetchUserProfile = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`);
  return response.json();
};

export const applyForJob = async (jobId, userId) => {
  const response = await fetch(`${API_BASE_URL}/jobs/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId, userId }),
  });
  return response.json();
};
