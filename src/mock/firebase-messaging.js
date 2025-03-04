// Create a mock implementation of the messaging module
const messagingMock = {
  requestPermission: async () => {
    console.log('Mock: Requesting notification permission');
    return { status: 'granted' };
  },
  getToken: async () => {
    console.log('Mock: Getting FCM token');
    return 'mock-fcm-token';
  },
  onTokenRefresh: (callback) => {
    console.log('Mock: Setting up token refresh listener');
    return () => {}; // Return cleanup function
  },
  onMessage: (callback) => {
    console.log('Mock: Setting up message listener');
    return () => {}; // Return cleanup function
  },
  onNotificationOpenedApp: (callback) => {
    console.log('Mock: Setting up notification opened app listener');
    return () => {}; // Return cleanup function
  },
  getInitialNotification: async () => {
    console.log('Mock: Getting initial notification');
    return null;
  },
  setBackgroundMessageHandler: (handler) => {
    console.log('Mock: Setting background message handler');
  },
};

export default () => messagingMock; 