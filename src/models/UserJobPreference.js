export default class UserJobPreference {
  constructor(data) {
    this.userId = data.userId || '';
    this.preferences = data.preferences || {};
  }

  addPreference(itemId, interested) {
    this.preferences[itemId] = {
      interested,
      timestamp: new Date()
    };
  }
}
