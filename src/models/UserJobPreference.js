export default class UserJobPreference {
  constructor(data) {
    this.userId = data.userId || '';
    this.role = data.role || ''; // 'worker' or 'employer'
    this.preferences = data.preferences || {};
  }

  addPreference(itemId, interested, itemType) {
    this.preferences[itemId] = {
      interested,
      itemType, // 'job' for workers, 'worker' for employers
      timestamp: new Date()
    };
  }
}
