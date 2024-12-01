import * as Calendar from 'expo-calendar';

export const requestCalendarPermissions = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
};

export const createCalendarEvent = async (interview) => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      const calendars = await Calendar.getCalendarPermissionsAsync();
      const defaultCalendarId = calendars[0]?.id;
      
      if (defaultCalendarId) {
        const eventDetails = {
          title: 'Job Interview',
          startDate: interview.selectedSlot.toDate(),
          endDate: new Date(interview.selectedSlot.toDate().getTime() + 3600000),
          timeZone: 'UTC',
          location: 'Phone Call',
          notes: `Interview for ${jobTitle} position at ${company}`
        };
        
        const eventId = await Calendar.createEventAsync(defaultCalendarId, eventDetails);
        return eventId;
      }
    }
    return null;
  } catch (error) {
    console.error('Calendar creation error:', error);
    return null;
  }
}; 