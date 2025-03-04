let messaging;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
  console.log('Firebase messaging not available, using mock');
  messaging = require('../mock/firebase-messaging').default;
}
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import directly from your firebase.js file
import { db, auth } from '../firebase';

class NotificationService {
  constructor() {
    this.messageListener = null;
    this.notificationOpenedAppListener = null;
  }

  async init() {
    // Request permission for iOS devices
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!enabled) {
        console.log('Notification permission not granted');
        return false;
      }
    }

    try {
      // Get FCM token
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);
      
      // Save the token to Firebase for the current user
      if (auth.currentUser) {
        await this.saveFcmToken(fcmToken);
      }

      // Listen for token refresh
      this.tokenRefreshListener = messaging().onTokenRefresh(token => {
        console.log('Token refreshed:', token);
        this.saveFcmToken(token);
      });

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async saveFcmToken(token) {
    if (!auth.currentUser) return;
    
    try {
      await db.collection('users').doc(auth.currentUser.uid).update({
        fcmToken: token,
        tokenUpdatedAt: new Date()
      });
      
      // Also store locally
      await AsyncStorage.setItem('fcmToken', token);
      
      console.log('FCM token saved to database');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  setupMessageListeners() {
    // Handle background notifications
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Background Message:', remoteMessage);
      // Store the notification for later retrieval
      this.storeNotification(remoteMessage);
    });

    // Handle foreground notifications
    this.messageListener = messaging().onMessage(async remoteMessage => {
      console.log('Foreground Message:', remoteMessage);
      
      // Display local notification when app is in foreground
      this.displayLocalNotification(remoteMessage);
      
      // Also store it
      this.storeNotification(remoteMessage);
    });

    // Handle notification opened app
    this.notificationOpenedAppListener = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('App opened from notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });
  }

  displayLocalNotification(remoteMessage) {
    // You can use a library like @react-native-community/push-notification-ios for iOS
    // or react-native-push-notification for cross-platform
    // This is a simplified example:
    
    if (Platform.OS === 'android') {
      const channelId = remoteMessage.data?.type === 'message' ? 'messages' : 'matches';
      
      messaging().displayNotification({
        title: remoteMessage.notification.title,
        body: remoteMessage.notification.body,
        android: {
          channelId,
          smallIcon: 'ic_notification',
          priority: 'high',
          sound: 'default',
        }
      });
    }
  }

  async storeNotification(remoteMessage) {
    if (!auth.currentUser) return;
    
    try {
      // Store in Firestore for persistence
      await db.collection('users')
        .doc(auth.currentUser.uid)
        .collection('notifications')
        .add({
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
          data: remoteMessage.data,
          read: false,
          receivedAt: new Date(),
          type: remoteMessage.data?.type || 'general'
        });
      
      // Also update locally
      const storedNotifications = await AsyncStorage.getItem('notifications');
      const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
      
      notifications.unshift({
        id: Date.now().toString(),
        title: remoteMessage.notification.title,
        body: remoteMessage.notification.body,
        data: remoteMessage.data,
        read: false,
        receivedAt: new Date().toISOString(),
        type: remoteMessage.data?.type || 'general'
      });
      
      // Keep only most recent 50 notifications locally
      if (notifications.length > 50) {
        notifications.pop();
      }
      
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  handleNotificationOpen(remoteMessage) {
    // Handle navigation based on notification type
    // You'll need to implement navigation using the navigation ref
    if (!remoteMessage.data) return;
    
    const { type, matchId, conversationId } = remoteMessage.data;
    
    if (type === 'match' && matchId) {
      // Navigate to match screen
      // navigationRef.navigate('Matches', { screen: 'MatchDetail', params: { matchId } });
      console.log('Should navigate to match:', matchId);
    } else if (type === 'message' && conversationId) {
      // Navigate to conversation
      // navigationRef.navigate('Messages', { screen: 'Conversation', params: { conversationId } });
      console.log('Should navigate to conversation:', conversationId);
    }
  }

  removeListeners() {
    if (this.messageListener) {
      this.messageListener();
      this.messageListener = null;
    }
    
    if (this.notificationOpenedAppListener) {
      this.notificationOpenedAppListener();
      this.notificationOpenedAppListener = null;
    }
    
    if (this.tokenRefreshListener) {
      this.tokenRefreshListener();
      this.tokenRefreshListener = null;
    }
  }
}

export default new NotificationService(); 