export const calculateMatch = (user, job) => {
  let score = 0;

  // Example matching logic based on skills
  const matchingSkills = job.requiredSkills.filter(skill => user.skills.includes(skill));
  score += matchingSkills.length * 10; // Increase score based on skill matches

  // Matching based on location (assume it's a proximity match)
  if (user.location === job.location) {
    score += 20; // Award points if location matches
  }

  // Matching based on availability
  const availableMatch = user.availability.some(slot => job.requiredAvailability.includes(slot));
  if (availableMatch) {
    score += 15; // Points for matching availability
  }

  // You can add more matching criteria here (experience, certifications, etc.)

  return score;
};
