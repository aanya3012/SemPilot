/**
 * SemPilot — Required SGPA Predictor
 *
 * Answers the core question students care about:
 *   "What SGPA do I need every semester to hit my target CGPA?"
 *
 * Formula derivation:
 *   TargetCGPA = (CurrentCreditPoints + RequiredSGPA × RemainingCredits) / TotalCredits
 *   → RequiredSGPA = (TargetCGPA × TotalCredits - CurrentCreditPoints) / RemainingCredits
 */

/**
 * @typedef {Object} SGPAPrediction
 * @property {number}  requiredSGPA        - SGPA needed per remaining semester (uniform)
 * @property {number}  remainingCredits    - credits still to be completed
 * @property {number}  totalCredits        - total program credits (completed + remaining)
 * @property {boolean} isAchievable        - true if requiredSGPA ≤ maxSGPA
 * @property {boolean} alreadyAchieved     - true if currentCGPA ≥ targetCGPA already
 * @property {number}  surplusOrDeficit    - positive = headroom, negative = how far short
 */

/**
 * Predicts the uniform SGPA required in all remaining semesters
 * to hit the student's target CGPA.
 *
 * @param {Object} params
 * @param {number} params.currentCreditPoints   - Σ(SGPA × Credits) completed so far
 * @param {number} params.currentTotalCredits   - total credits completed
 * @param {number} params.remainingCredits      - credits remaining in program
 * @param {number} params.targetCGPA            - student's goal (e.g. 8.5)
 * @param {number} [params.maxSGPA=10]          - university max SGPA
 * @returns {SGPAPrediction}
 */
export function predictRequiredSGPA({
  currentCreditPoints,
  currentTotalCredits,
  remainingCredits,
  targetCGPA,
  maxSGPA = 10,
}) {
  const totalCredits = currentTotalCredits + remainingCredits;

  // Edge case: no remaining semesters
  if (remainingCredits <= 0) {
    const achievedCGPA = currentTotalCredits > 0
      ? currentCreditPoints / currentTotalCredits
      : 0;
    const alreadyAchieved = achievedCGPA >= targetCGPA;
    return {
      requiredSGPA:     alreadyAchieved ? 0 : Infinity,
      remainingCredits: 0,
      totalCredits:     currentTotalCredits,
      isAchievable:     alreadyAchieved,
      alreadyAchieved,
      surplusOrDeficit: parseFloat((achievedCGPA - targetCGPA).toFixed(2)),
    };
  }

  // Edge case: no credits completed yet
  if (currentTotalCredits <= 0) {
    return {
      requiredSGPA:     parseFloat(targetCGPA.toFixed(2)),
      remainingCredits,
      totalCredits,
      isAchievable:     targetCGPA <= maxSGPA,
      alreadyAchieved:  false,
      surplusOrDeficit: parseFloat((maxSGPA - targetCGPA).toFixed(2)),
    };
  }

  const currentCGPA = currentCreditPoints / currentTotalCredits;

  // Already at or above target
  if (currentCGPA >= targetCGPA) {
    return {
      requiredSGPA:     0,
      remainingCredits,
      totalCredits,
      isAchievable:     true,
      alreadyAchieved:  true,
      surplusOrDeficit: parseFloat((currentCGPA - targetCGPA).toFixed(2)),
    };
  }

  const neededCreditPoints = targetCGPA * totalCredits;
  const requiredSGPA = parseFloat(
    ((neededCreditPoints - currentCreditPoints) / remainingCredits).toFixed(2)
  );

  const isAchievable     = requiredSGPA <= maxSGPA;
  const surplusOrDeficit = parseFloat((maxSGPA - requiredSGPA).toFixed(2));

  return {
    requiredSGPA,
    remainingCredits,
    totalCredits,
    isAchievable,
    alreadyAchieved: false,
    surplusOrDeficit,
  };
}

/**
 * Projects CGPA at the end of each remaining semester,
 * assuming a constant future SGPA. Useful for trend charts.
 *
 * @param {Object} params
 * @param {number} params.currentCreditPoints
 * @param {number} params.currentTotalCredits
 * @param {number} params.creditsPerSemester    - typical credits per semester
 * @param {number} params.remainingSemesters    - number of sems left
 * @param {number} params.assumedSGPA           - SGPA assumed for each remaining sem
 * @returns {Array<{semester: number, projectedCGPA: number}>}
 */
export function projectCGPATrend({
  currentCreditPoints,
  currentTotalCredits,
  creditsPerSemester,
  remainingSemesters,
  assumedSGPA,
}) {
  const projections = [];
  let cp = currentCreditPoints;
  let tc = currentTotalCredits;

  for (let i = 1; i <= remainingSemesters; i++) {
    cp += assumedSGPA * creditsPerSemester;
    tc += creditsPerSemester;
    projections.push({
      semester:      i,
      projectedCGPA: parseFloat((cp / tc).toFixed(2)),
    });
  }

  return projections;
}
