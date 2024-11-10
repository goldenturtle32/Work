export const flattenAvailability = (availability) => {
  if (!availability) return [];
  
  const flattened = [];
  Object.entries(availability).forEach(([day, slots]) => {
    slots.forEach(slot => {
      flattened.push({
        day,
        startTime: new Date(`1970/01/01 ${slot.startTime}`),
        endTime: new Date(`1970/01/01 ${slot.endTime}`)
      });
    });
  });
  return flattened;
};

export const calculateOverlap = (slot1, slot2) => {
  const start = Math.max(slot1.startTime.getTime(), slot2.startTime.getTime());
  const end = Math.min(slot1.endTime.getTime(), slot2.endTime.getTime());
  return Math.max(0, end - start);
}; 