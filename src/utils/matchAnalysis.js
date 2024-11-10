// Advanced matching calculations and analysis
export const analyzeProfileMatch = (jobData, userData) => {
  const analysis = {
    skillsMatch: {
      score: 0,
      details: []
    },
    experienceMatch: {
      score: 0,
      details: []
    },
    overallFit: {
      score: 0,
      details: []
    }
  };

  // Skills match analysis
  if (jobData.requiredSkills && userData.skills) {
    const matchingSkills = jobData.requiredSkills.filter(skill => 
      userData.skills.includes(skill)
    );
    
    analysis.skillsMatch.details = matchingSkills;
    analysis.skillsMatch.score = matchingSkills.length / jobData.requiredSkills.length;
  }

  // Experience match analysis
  if (jobData.requiredExperience?.minYears && userData.experience?.totalYears) {
    const meetsMinimum = userData.experience.totalYears >= jobData.requiredExperience.minYears;
    analysis.experienceMatch.details = [`${userData.experience.totalYears} years of experience`];
    analysis.experienceMatch.score = meetsMinimum ? 1 : 0.5;
  }

  // Calculate overall fit
  analysis.overallFit.score = (analysis.skillsMatch.score + analysis.experienceMatch.score) / 2;
  
  return analysis;
};

const analyzeScheduleOverlap = (jobSchedule, userSchedule) => {
  const matchingSlots = [];
  
  Object.entries(jobSchedule).forEach(([day, jobSlots]) => {
    const userSlots = userSchedule[day];
    if (userSlots) {
      const overlapping = findOverlappingTimeSlots(jobSlots, userSlots);
      if (overlapping.length > 0) {
        matchingSlots.push({
          day,
          slots: overlapping
        });
      }
    }
  });
  
  return matchingSlots;
};

const findOverlappingTimeSlots = (slots1, slots2) => {
  const overlapping = [];
  
  slots1.forEach(slot1 => {
    slots2.forEach(slot2 => {
      const overlap = calculateTimeOverlap(slot1, slot2);
      if (overlap) {
        overlapping.push(overlap);
      }
    });
  });
  
  return overlapping;
};

const calculateTimeOverlap = (slot1, slot2) => {
  const start1 = new Date(`1970/01/01 ${slot1.startTime}`);
  const end1 = new Date(`1970/01/01 ${slot1.endTime}`);
  const start2 = new Date(`1970/01/01 ${slot2.startTime}`);
  const end2 = new Date(`1970/01/01 ${slot2.endTime}`);

  if (start1 < end2 && end1 > start2) {
    return {
      startTime: start1 > start2 ? slot1.startTime : slot2.startTime,
      endTime: end1 < end2 ? slot1.endTime : slot2.endTime
    };
  }
  
  return null;
};

const analyzeLocation = (jobLocation, userLocation, userPreferences = {}) => {
  const analysis = {
    score: 0,
    details: [],
    commuteAnalysis: {}
  };

  try {
    // Calculate distance
    const distance = calculateDistance(
      jobLocation._lat,
      jobLocation._long,
      userLocation._lat,
      userLocation._long
    );

    // Analyze commute
    analysis.commuteAnalysis = {
      distance: distance,
      estimatedDriveTime: distance * 2, // Rough estimate: 2 min per mile
      estimatedTransitTime: distance * 3, // Rough estimate: 3 min per mile
    };

    // Score based on distance preferences
    const maxPreferredDistance = userPreferences.maxDistance || 25; // Default 25 miles
    analysis.score = Math.max(0, 1 - (distance / maxPreferredDistance));

    // Generate analysis details
    analysis.details = [
      `Distance: ${distance.toFixed(1)} miles`,
      `Estimated drive time: ${Math.round(analysis.commuteAnalysis.estimatedDriveTime)} minutes`,
      `Estimated transit time: ${Math.round(analysis.commuteAnalysis.estimatedTransitTime)} minutes`,
    ];

    // Add qualitative assessment
    if (distance <= 5) {
      analysis.details.push("Very close to your location - excellent commute");
    } else if (distance <= 15) {
      analysis.details.push("Reasonable commuting distance");
    } else if (distance <= 25) {
      analysis.details.push("Longer commute - consider transportation options");
    } else {
      analysis.details.push("Long distance - may require relocation or remote work arrangement");
    }

  } catch (error) {
    console.error("Location analysis error:", error);
    analysis.details.push("Unable to analyze location");
  }

  return analysis;
};

const analyzeCompensation = (jobData, userData) => {
  const analysis = {
    score: 0,
    details: [],
    marketAnalysis: {}
  };

  try {
    const { salaryRange: jobSalary } = jobData;
    const { salaryPrefs: userSalary } = userData;

    // Market rate analysis (example rates - should be replaced with actual market data)
    const marketRates = {
      'Software Engineer': { low: 25, medium: 45, high: 65 },
      'Designer': { low: 20, medium: 35, high: 50 },
      // Add more job categories...
    };

    const marketRate = marketRates[jobData.category] || { low: 15, medium: 25, high: 35 };

    // Calculate market position
    analysis.marketAnalysis = {
      isAboveMarket: jobSalary.max > marketRate.medium,
      isBelowMarket: jobSalary.min < marketRate.low,
      marketPosition: jobSalary.max > marketRate.high ? 'Above market' :
                     jobSalary.min < marketRate.low ? 'Below market' : 'At market',
    };

    // Calculate match score
    if (userSalary && jobSalary) {
      const overlapStart = Math.max(userSalary.min, jobSalary.min);
      const overlapEnd = Math.min(userSalary.max, jobSalary.max);
      const hasOverlap = overlapStart <= overlapEnd;

      if (hasOverlap) {
        const overlapSize = overlapEnd - overlapStart;
        const userRange = userSalary.max - userSalary.min;
        analysis.score = overlapSize / userRange;
      }
    }

    // Generate analysis details
    analysis.details = [
      `Salary range: $${jobSalary.min}-$${jobSalary.max}/hr`,
      `Market position: ${analysis.marketAnalysis.marketPosition}`,
      `Weekly hours: ${jobData.weeklyHours || 'Not specified'}`,
    ];

    if (analysis.marketAnalysis.isAboveMarket) {
      analysis.details.push("✨ Above average pay for this role");
    }

    // Calculate potential earnings
    const weeklyMin = jobSalary.min * (jobData.weeklyHours || 40);
    const weeklyMax = jobSalary.max * (jobData.weeklyHours || 40);
    analysis.details.push(`Potential weekly earnings: $${weeklyMin.toFixed(0)}-$${weeklyMax.toFixed(0)}`);

  } catch (error) {
    console.error("Compensation analysis error:", error);
    analysis.details.push("Unable to analyze compensation");
  }

  return analysis;
};

const calculateOverallFit = (analysis) => {
  const weights = {
    skills: 0.35,
    schedule: 0.25,
    location: 0.20,
    compensation: 0.20
  };

  const weightedScore = 
    (analysis.skillsMatch.score * weights.skills) +
    (analysis.scheduleMatch.score * weights.schedule) +
    (analysis.locationMatch.score * weights.location) +
    (analysis.compensationMatch.score * weights.compensation);

  const summary = [];
  const recommendations = [];

  // Generate summary
  if (weightedScore >= 0.8) {
    summary.push("Excellent match! This job aligns well with your profile.");
  } else if (weightedScore >= 0.6) {
    summary.push("Good match with some areas for consideration.");
  } else {
    summary.push("This job may require some compromises.");
  }

  // Generate recommendations
  if (analysis.skillsMatch.missingSkills.length > 0) {
    recommendations.push(`Consider developing skills in: ${analysis.skillsMatch.missingSkills.join(', ')}`);
  }
  if (analysis.scheduleMatch.score < 0.5) {
    recommendations.push("Schedule flexibility might be needed");
  }
  if (analysis.locationMatch.score < 0.5) {
    recommendations.push("Consider transportation options or remote work possibilities");
  }

  return {
    score: weightedScore,
    summary,
    recommendations
  };
};

// Helper function for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3963; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
} 