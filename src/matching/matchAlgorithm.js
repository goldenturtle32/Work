//This file will contain the logic for matching contractors/workers based on the criteria you've defined (e.g., category, location, reviews, availability).
export function matchUsers(workerProfile, contractorProfile) {
  let score = 0;

  // Example: Matching by category
  if (workerProfile.category === contractorProfile.category) {
    score += 10;
  }

  // Example: Matching by location
  const distance = calculateDistance(workerProfile.location, contractorProfile.location);
  if (distance <= 10) { // assuming distance is in miles/km
    score += 20;
  }

  // Example: Matching by reviews
  if (workerProfile.reviewsAverage >= 4 && contractorProfile.reviewsAverage >= 4) {
    score += 15;
  }

  // Example: Matching by availability
  if (workerProfile.availability.some(day => contractorProfile.availability.includes(day))) {
    score += 25;
  }

  return score; // Higher score means better match
}

function calculateDistance(loc1, loc2) {
  // Basic calculation or use a library for accurate geolocation distance
  return Math.sqrt(Math.pow(loc1.lat - loc2.lat, 2) + Math.pow(loc1.lng - loc2.lng, 2));
}
