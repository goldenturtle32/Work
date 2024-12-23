import axios from 'axios';

const BACKEND_URL = 'http://127.0.0.1:5000';

export const fetchTrendingIndustries = async (searchTerm = '', location = '') => {
  try {
    const response = await axios.get(`${BACKEND_URL}/trending-industries`, {
      params: { searchTerm, location }
    });
    return response.data.industries;
  } catch (error) {
    console.error('Error fetching trending industries:', error);
    return [];
  }
};

export const fetchTrendingJobs = async (industry, location = '') => {
  try {
    const response = await axios.get(`${BACKEND_URL}/trending-jobs`, {
      params: { industry, location }
    });
    return response.data.jobs;
  } catch (error) {
    console.error('Error fetching trending jobs:', error);
    return [];
  }
};

export const fetchTrendingSkills = async (jobTitle, industry, location = '') => {
  try {
    console.log(`Requesting skills for ${jobTitle} in ${industry} in ${location}`); // Debug log
    const response = await axios.get(`${BACKEND_URL}/trending-skills`, {
      params: { jobTitle, industry, location }
    });
    console.log("API Response:", response.data); // Debug log
    
    if (response.data.success && Array.isArray(response.data.skills)) {
      return response.data.skills;
    } else {
      console.warn("Invalid response format:", response.data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching trending skills:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return [];
  }
}; 