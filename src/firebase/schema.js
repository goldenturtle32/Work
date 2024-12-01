// interviews collection
{
  id: string,
  matchId: string,
  employerId: string,
  workerId: string,
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled',
  timeSlots: [{
    datetime: timestamp,
    selected: boolean
  }],
  selectedSlot: timestamp | null,
  workerPhone: string | null,
  calendarEventId: string | null
} 