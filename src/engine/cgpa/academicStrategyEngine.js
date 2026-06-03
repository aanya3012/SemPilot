/**
 * SemPilot — Academic Strategy Engine
 * Adds backlog + reattempt simulation layer
 */

export function computeAcademicStrategy({
  semesters = [],
  backlogs = [],
  reattemptSubjects = [],
  targetCGPA,
  maxSGPA = 10,
}) {
  // ─────────────────────────────
  // 1. FLATTEN SUBJECT DATA
  // ─────────────────────────────
  let totalCredits = 0;
  let totalPoints = 0;

  semesters.forEach((sem) => {
    sem.subjects.forEach((sub) => {
      if (!sub.gradePoint || sub.gradePoint === 0) return;

      totalCredits += sub.credits;
      totalPoints += sub.gradePoint * sub.credits;
    });
  });

  let currentCGPA = totalCredits === 0 ? 0 : totalPoints / totalCredits;

  // ─────────────────────────────
  // 2. BACKLOG SIMULATION
  // ─────────────────────────────
  let backlogGain = 0;

  backlogs.forEach((b) => {
    const gain = (b.expectedGradePointIfCleared - 0) * b.credits;
    backlogGain += gain;
  });

  const cgpaAfterBacklogs =
    (totalPoints + backlogGain) / (totalCredits + backlogs.reduce((a, b) => a + b.credits, 0));

  // ─────────────────────────────
  // 3. REATTEMPT SIMULATION
  // ─────────────────────────────
  let reattemptGain = 0;

  reattemptSubjects.forEach((r) => {
    const gain = (r.expectedImprovedGradePoint - r.currentGradePoint) * 1; // approximate weight
    reattemptGain += gain;
  });

  const adjustedPoints = totalPoints + backlogGain + reattemptGain;

  // ─────────────────────────────
  // 4. FINAL CGPA AFTER RECOVERY ACTIONS
  // ─────────────────────────────
  const finalCredits =
    totalCredits +
    backlogs.reduce((a, b) => a + b.credits, 0);

  const recoveredCGPA =
    finalCredits === 0 ? 0 : adjustedPoints / finalCredits;

  // ─────────────────────────────
  // 5. REQUIRED SGPA FOR TARGET
  // ─────────────────────────────
  const remainingGap =
    targetCGPA * finalCredits - adjustedPoints;

  const remainingSGPARequired =
    remainingGap / Math.max(1, finalCredits * 0.5); // assume future half weight

  // ─────────────────────────────
  // 6. STRATEGY GENERATION
  // ─────────────────────────────
  const strategy = [];

  if (backlogs.length > 0) {
    strategy.push(`Clear ${backlogs.length} backlog(s) to unlock CGPA recovery`);
  }

  if (reattemptSubjects.length > 0) {
    strategy.push(`Reattempt ${reattemptSubjects.length} subject(s) for CGPA boost`);
  }

  if (remainingSGPARequired > maxSGPA) {
    strategy.push("Target not achievable even after recovery actions");
  } else {
    strategy.push(
      `Maintain ~${remainingSGPARequired.toFixed(2)} SGPA in remaining semesters`
    );
  }

  // ─────────────────────────────
  // 7. VERDICT
  // ─────────────────────────────
  let verdict = "achievable";

  if (remainingSGPARequired > maxSGPA) verdict = "impossible";
  else if (remainingSGPARequired > 9) verdict = "hard";
  else if (remainingSGPARequired > 8) verdict = "moderate";

  return {
    currentCGPA,
    recoveredCGPA,
    targetCGPA,

    backlogImpact: backlogGain,
    reattemptImpact: reattemptGain,

    requiredSGPAAfterRecovery: remainingSGPARequired,

    verdict,
    strategySummary: strategy,
  };
}