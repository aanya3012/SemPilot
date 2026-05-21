/**
 * SemPilot CGPA Calculation Engine
 * Pure JS — zero React imports. Fully unit-testable.
 *
 * Formula:
 *   CGPA = Σ(SGPA_i × Credits_i) / Σ(Credits_i)
 *   across all completed semesters.
 */

/**
 * @typedef {Object} SemesterRecord
 * @property {number} sgpa         - Semester GPA (0–10)
 * @property {number} totalCredits - Credits earned in this semester
 * @property {boolean} isCompleted - Only completed sems count
 */

/**
 * Calculates CGPA from an array of semester records.
 * Handles edge cases: empty array, zero credits, NaN inputs.
 *
 * @param {SemesterRecord[]} semesters
 * @returns {{ cgpa: number, totalCredits: number, creditPoints: number, semCount: number }}
 */
export function calculateCGPA(semesters) {
  if (!Array.isArray(semesters) || semesters.length === 0) {
    return { cgpa: 0, totalCredits: 0, creditPoints: 0, semCount: 0 };
  }

  const completed = semesters.filter(
    (s) => s.isCompleted && isFinite(s.sgpa) && isFinite(s.totalCredits) && s.totalCredits > 0
  );

  if (completed.length === 0) {
    return { cgpa: 0, totalCredits: 0, creditPoints: 0, semCount: 0 };
  }

  const totalCredits  = completed.reduce((acc, s) => acc + s.totalCredits, 0);
  const creditPoints  = completed.reduce((acc, s) => acc + s.sgpa * s.totalCredits, 0);
  const cgpa          = parseFloat((creditPoints / totalCredits).toFixed(2));

  return { cgpa, totalCredits, creditPoints, semCount: completed.length };
}

/**
 * Calculates the best possible CGPA a student can achieve
 * if they score maxSGPA in all remaining semesters.
 *
 * @param {Object} params
 * @param {number} params.currentCreditPoints   - Σ(SGPA × Credits) so far
 * @param {number} params.currentTotalCredits   - credits completed so far
 * @param {number} params.remainingCredits      - credits left to complete
 * @param {number} [params.maxSGPA=10]          - university max SGPA
 * @returns {number} bestPossibleCGPA
 */
export function calculateBestPossibleCGPA({
  currentCreditPoints,
  currentTotalCredits,
  remainingCredits,
  maxSGPA = 10,
}) {
  if (remainingCredits <= 0) {
    return parseFloat((currentCreditPoints / Math.max(currentTotalCredits, 1)).toFixed(2));
  }

  const totalCredits      = currentTotalCredits + remainingCredits;
  const maxFutureCPs      = remainingCredits * maxSGPA;
  const bestCreditPoints  = currentCreditPoints + maxFutureCPs;

  return parseFloat((bestCreditPoints / totalCredits).toFixed(2));
}

/**
 * Calculates credit points from a list of subjects with grades.
 * Useful for computing a single semester's contribution.
 *
 * @param {Array<{credits: number, gradePoint: number}>} subjects
 * @returns {{ sgpa: number, totalCredits: number, creditPoints: number }}
 */
export function calculateSGPAFromSubjects(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return { sgpa: 0, totalCredits: 0, creditPoints: 0 };
  }

  const valid = subjects.filter(
    (s) => isFinite(s.credits) && isFinite(s.gradePoint) && s.credits > 0
  );

  if (valid.length === 0) {
    return { sgpa: 0, totalCredits: 0, creditPoints: 0 };
  }

  const totalCredits  = valid.reduce((acc, s) => acc + s.credits, 0);
  const creditPoints  = valid.reduce((acc, s) => acc + s.gradePoint * s.credits, 0);
  const sgpa          = parseFloat((creditPoints / totalCredits).toFixed(2));

  return { sgpa, totalCredits, creditPoints };
}
