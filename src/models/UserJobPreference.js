import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export default class UserJobPreference {
  constructor(data) {
    this.userId = data.userId || ''; // ID of the user swiping
    this.role = data.role || ''; // 'worker' or 'employer'
    this.swipedUserId = data.swipedUserId || ''; // ID of the user being swiped on
    this.interested = data.interested || false; // Whether the user swiped right
    this.preferences = data.preferences || {};
  }

  addPreference(itemId, interested, itemType) {
    this.preferences[itemId] = {
      interested,
      itemType, // 'job' for workers, 'worker' for employers
      timestamp: new Date()
    };
  }

  toObject() {
    return {
      userId: this.userId,
      role: this.role,
      swipedUserId: this.swipedUserId,
      interested: this.interested,
      preferences: this.preferences,
    };
  }
}
