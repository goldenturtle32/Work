export const calculateMatch = (user, item) => {
  let workerScore = 0;
  let employerScore = 0;

  if (user.role === 'worker') {
    // Worker matching job
    const job = item;
    
    // Skills match
    const matchingSkills = job.requiredSkills.filter(skill => user.skills.includes(skill));
    workerScore += (matchingSkills.length / job.requiredSkills.length) * 50;

    // Industry match
    if (user.industryPrefs.includes(job.industry)) {
      workerScore += 20;
    }

    // Job type match
    if (user.jobTypePrefs === job.jobType) {
      workerScore += 15;
    }

    // Salary match
    if (job.salaryRange.min <= user.salaryPrefs.max && job.salaryRange.max >= user.salaryPrefs.min) {
      workerScore += 15;
    }

    // Employer likelihood to swipe right on this worker
    employerScore = calculateEmployerLikelihood(user, job);

  } else {
    // Employer matching worker
    const worker = item;

    // Skills match
    const matchingSkills = user.requiredSkills.filter(skill => worker.skills.includes(skill));
    employerScore += (matchingSkills.length / user.requiredSkills.length) * 50;

    // Industry match
    if (worker.industryPrefs.includes(user.industry)) {
      employerScore += 20;
    }

    // Job type match
    if (worker.jobTypePrefs === user.jobType) {
      employerScore += 15;
    }

    // Salary match
    if (user.salaryRange.min <= worker.salaryPrefs.max && user.salaryRange.max >= worker.salaryPrefs.min) {
      employerScore += 15;
    }

    // Worker likelihood to swipe right on this job
    workerScore = calculateWorkerLikelihood(worker, user);
  }

  // Normalize scores to be out of 1
  workerScore = Math.min(workerScore / 100, 1);
  employerScore = Math.min(employerScore / 100, 1);

  // Calculate total score (out of 2)
  const totalScore = workerScore + employerScore;

  return { workerScore, employerScore, totalScore };
};

const calculateEmployerLikelihood = (worker, job) => {
  let score = 0;
  // Add employer-specific criteria here
  if (worker.experience.totalYears >= job.requiredExperience.minYears) score += 30;
  if (worker.education >= job.requiredEducation) score += 20;
  // Add more criteria as needed
  return score;
};

const calculateWorkerLikelihood = (worker, job) => {
  let score = 0;
  // Add worker-specific criteria here
  if (job.salaryRange.max >= worker.salaryPrefs.min) score += 30;
  if (job.location === worker.location) score += 20;
  // Add more criteria as needed
  return score;
};
