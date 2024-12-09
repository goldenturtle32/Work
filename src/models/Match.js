export default class Match {
  constructor(data) {
    this.id = data.id || '';
    this.worker = data.worker || false;
    this.employer = data.employer || false;
    this.workerId = data.workerId || '';
    this.employerId = data.employerId || '';
    this.timestamp = data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date();
    this.accepted = data.accepted || 0;
  }
}
