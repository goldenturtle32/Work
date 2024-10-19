// src/models/Job.js
export default class Job {
  constructor(data) {
    this.id = data.id || '';
    this.location = data.location || ''; 
    this.requiredSkills = this.parseArray(data.requiredSkills);
    this.requiredExperience = this.parseExperience(data.requiredExperience);
    this.requiredEducation = data.requiredEducation || '';
    this.requiredCertifications = this.parseArray(data.requiredCertifications);
    this.jobTitle = data.jobTitle || '';
    this.jobType = data.jobType || '';
    this.industry = data.industry || '';
    this.salaryRange = this.parseSalaryRange(data.salaryRange);
    this.requiredAvailability = this.parseArray(data.requiredAvailability);
    this.estimatedHours = this.parseNumber(data.estimatedHours);
    this.availability = this.parseAvailability(data.availability);
  }

  parseArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') return value.split(',').map(item => item.trim());
    return [];
  }

  parseExperience(value) {
    if (typeof value === 'object' && value !== null) return value;
    return { minYears: 0, preferredYears: 0 };
  }

  parseSalaryRange(value) {
    if (typeof value === 'object' && value !== null) return value;
    return { min: 0, max: 0 };
  }

  parseNumber(value) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  parseAvailability(availability) {
    if (typeof availability === 'object' && availability !== null) {
      return Object.entries(availability).reduce((acc, [date, dayData]) => {
        acc[date] = {
          repeatType: dayData.repeatType || 'none',
          slots: Array.isArray(dayData.slots) ? dayData.slots.map(
            slot => ({ ...slot, id: slot.id || '' })
          ) : []
        };
        return acc;
      }, {});
    }
    return {};
  }
}
