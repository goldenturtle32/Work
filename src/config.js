// Check if we're running in development or production
const isDevelopment = process.env.NODE_ENV === 'development' || __DEV__;

// Get the current platform (web vs native)
const isWeb = typeof window !== 'undefined' && window.document;

// Use your local network IP address for development
export const BACKEND_URL = isDevelopment 
  ? 'http://192.168.0.100:5000'  // Replace with your computer's local IP address
  : 'your-production-url';

// Get the current environment
const environment = isDevelopment ? 'development' : 'production';

// Get the current platform (web vs native)
const platform = isWeb ? 'web' : 'mobile';

// Configure the backend URL based on environment and platform
export const BACKEND_URL_ENV_PLATFORM = isDevelopment
  ? isWeb 
    ? 'http://localhost:5000'  // or 'http://127.0.0.1:5000'
    : 'http://10.0.19045.5371:5000'  // Local development on mobile (replace with your IP)
  : 'https://your-production-backend.com';  // Production environment 