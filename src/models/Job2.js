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
    this.weeklyHours = this.calculateWeeklyHours(this.availability);
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
    if (!availability) return {};
    
    if (typeof availability === 'object' && availability !== null) {
      return Object.entries(availability).reduce((acc, [date, dayData]) => {
        // Handle the nested structure where dayData has repeatType and slots
        if (dayData && dayData.slots) {
          acc[date] = dayData.slots.map(slot => ({
            startTime: slot.startTime || '',
            endTime: slot.endTime || '',
            repeatType: dayData.repeatType || 'custom'
          }));
        }
        return acc;
      }, {});
    }
    return {};
  }

  calculateWeeklyHours(availability) {
    let totalMinutes = 0;
    const processedDays = new Set(); // To avoid counting repeated days multiple times
    
    Object.entries(availability).forEach(([date, slots]) => {
      // Get day of week from date
      const dayOfWeek = new Date(date).getDay();
      
      // If we haven't processed this day of week yet
      if (!processedDays.has(dayOfWeek)) {
        slots.forEach(slot => {
          if (slot.startTime && slot.endTime) {
            const start = new Date(`1970-01-01T${slot.startTime}`);
            const end = new Date(`1970-01-01T${slot.endTime}`);
            const diffMinutes = (end - start) / (1000 * 60);
            
            // If it's a weekly or biweekly repeat, count it in weekly hours
            if (slot.repeatType === 'weekly' || slot.repeatType === 'biweekly') {
              totalMinutes += diffMinutes;
            }
          }
        });
        
        // Mark this day as processed
        processedDays.add(dayOfWeek);
      }
    });

    return Math.round(totalMinutes / 60); // Convert to hours
  }

  getFormattedAvailability() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let formatted = [];
    const processedDays = new Set();

    Object.entries(this.availability).forEach(([date, slots]) => {
      const dayOfWeek = daysOfWeek[new Date(date).getDay()];
      
      // Only show each day once and prioritize recurring schedules
      if (!processedDays.has(dayOfWeek)) {
        const daySlots = slots.filter(slot => slot.repeatType === 'weekly' || slot.repeatType === 'biweekly');
        if (daySlots.length > 0) {
          const times = daySlots.map(slot => 
            `${this.formatTime(slot.startTime)} - ${this.formatTime(slot.endTime)}`
          ).join(', ');
          formatted.push(`${dayOfWeek}: ${times}`);
          processedDays.add(dayOfWeek);
        }
      }
    });

    // Sort by day of week
    const dayOrder = daysOfWeek.reduce((acc, day, index) => {
      acc[day] = index;
      return acc;
    }, {});
    
    return formatted.sort((a, b) => {
      const dayA = a.split(':')[0];
      const dayB = b.split(':')[0];
      return dayOrder[dayA] - dayOrder[dayB];
    });
  }

  formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes.padStart(2, '0')}${ampm}`;
  }
}
