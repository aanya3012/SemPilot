/**
 * SemPilot — Backlog Recovery Engine
 *
 * Analyses the student's backlog situation and outputs:
 * - priority order for clearing backlogs
 * - CGPA impact per backlog cleared
 * - recovery probability assessment
 * - "damage score" for the Academic Damage Report™
 */

/**
 * @typedef {Object} BacklogSubject
 * @property {string} id
 * @property {string} name
 * @property {number} credits          - credits for this subject
 * @property {number} currentGradePoint - current failing grade point (e.g. 0 for F)
 * @property {number} expectedGradePoint - grade point if cleared (e.g. 6 for B)
 * @property {number} semesterNumber    - which semester this backlog is from
 * @property {number} [difficulty]      - optional 1–5 difficulty rating
 */

/**
 * @typedef {Object} BacklogAnalysis
 * @property {PrioritizedBacklog[]} prioritized    - backlogs in recommended clearing order
 * @property {number}   damageScore                - 0–100, higher = more damaged
 * @property {string}   damageLevel                - 'critical'|'high'|'medium'|'low'
 * @property {number}   cgpaLossFromBacklogs       - estimated CGPA drop from all backlogs
 * @property {number}   maxRecoverableCGPA         - CGPA possible if all backlogs cleared
 * @property {string}   recoveryVerdict            - summary string
 */

/**
 * @typedef {Object} PrioritizedBacklog
 * @property {BacklogSubject} subject
 * @property {number} cgpaImpactIfCleared    - how much CGPA improves if this one is cleared
 * @property {number} priority               - 1 = clear first
 * @property {string} reason                 - why this is prioritized
 */

/**
 * Calculates how much CGPA improves if a single backlog is cleared.
 *
 * @param {Object} params
 * @param {number} params.currentCreditPoints
 * @param {number} params.totalCredits
 * @param {BacklogSubject} params.backlog
 * @returns {number} delta CGPA
 */
function cgpaImpactOfClearing({ currentCreditPoints, totalCredits, backlog }) {
  if (totalCredits <= 0) return 0;

  const cpGain    = (backlog.expectedGradePoint - backlog.currentGradePoint) * backlog.credits;
  const newCGPA   = (currentCreditPoints + cpGain) / totalCredits;
  const oldCGPA   = currentCreditPoints / totalCredits;

  return parseFloat((newCGPA - oldCGPA).toFixed(3));
}

/**
 * Maps damage score to a damage level.
 * @param {number} score
 * @returns {string}
 */
function deriveDamageLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Full backlog analysis.
 *
 * @param {Object} params
 * @param {BacklogSubject[]} params.backlogs
 * @param {number} params.currentCreditPoints
 * @param {number} params.totalCredits
 * @param {number} params.remainingCredits      - for context only
 * @param {number} [params.maxSGPA=10]
 * @returns {BacklogAnalysis}
 */
export function analyzeBacklogs({
  backlogs,
  currentCreditPoints,
  totalCredits,
  remainingCredits,
  maxSGPA = 10,
}) {
  if (!Array.isArray(backlogs) || backlogs.length === 0) {
    return {
      prioritized:          [],
      damageScore:          0,
      damageLevel:          'low',
      cgpaLossFromBacklogs: 0,
      maxRecoverableCGPA:   parseFloat((currentCreditPoints / Math.max(totalCredits, 1)).toFixed(2)),
      recoveryVerdict:      'No backlogs. Focus on maintaining your CGPA.',
    };
  }

  // Calculate CGPA impact of each backlog
  const analyzed = backlogs.map((backlog) => {
    const impact = cgpaImpactOfClearing({ currentCreditPoints, totalCredits, backlog });
    return { subject: backlog, cgpaImpactIfCleared: impact };
  });

  // Sort by CGPA impact descending (biggest gain first),
  // with a tiebreak on fewest credits (easier win)
  const prioritized = analyzed
    .sort((a, b) => {
      const diffImpact = b.cgpaImpactIfCleared - a.cgpaImpactIfCleared;
      if (Math.abs(diffImpact) > 0.001) return diffImpact;
      return a.subject.credits - b.subject.credits;
    })
    .map((item, index) => ({
      ...item,
      priority: index + 1,
      reason: index === 0
        ? 'Highest CGPA impact — clear this first'
        : item.subject.credits <= 2
        ? 'Low-credit quick win'
        : `Clears ${item.cgpaImpactIfCleared.toFixed(2)} CGPA points`,
    }));

  // Total CGPA loss from all backlogs
  const totalCPLoss = backlogs.reduce(
    (acc, b) => acc + (b.expectedGradePoint - b.currentGradePoint) * b.credits,
    0
  );
  const cgpaLossFromBacklogs = parseFloat(
    (totalCPLoss / Math.max(totalCredits, 1)).toFixed(2)
  );

  // Max recoverable CGPA if all backlogs cleared
  const maxRecoverableCGPA = parseFloat(
    ((currentCreditPoints + totalCPLoss) / Math.max(totalCredits, 1)).toFixed(2)
  );

  // Damage score: weighted by backlog count, credit weight, and recovery difficulty
  const backlogCreditRatio = backlogs.reduce((acc, b) => acc + b.credits, 0) / Math.max(totalCredits, 1);
  const damageScore        = Math.min(100, Math.round(backlogCreditRatio * 150 + backlogs.length * 5));
  const damageLevel        = deriveDamageLevel(damageScore);

  const recoveryVerdict =
    damageLevel === 'critical' ? 'Immediate action required. Start with the highest-impact backlog.' :
    damageLevel === 'high'     ? 'Significant damage. Clear backlogs before focusing on new semesters.' :
    damageLevel === 'medium'   ? 'Manageable. A structured plan will recover your CGPA.' :
                                 'Minor impact. Clear these alongside regular coursework.';

  return {
    prioritized,
    damageScore,
    damageLevel,
    cgpaLossFromBacklogs,
    maxRecoverableCGPA,
    recoveryVerdict,
  };
}

/**
 * Generates a semester-by-semester recovery roadmap.
 * Shows projected CGPA at each step as backlogs are cleared in priority order.
 *
 * @param {Object} params
 * @param {PrioritizedBacklog[]} params.prioritized - from analyzeBacklogs()
 * @param {number} params.currentCreditPoints
 * @param {number} params.totalCredits
 * @returns {Array<{step: number, action: string, projectedCGPA: number}>}
 */
export function generateRecoveryRoadmap({ prioritized, currentCreditPoints, totalCredits }) {
  const roadmap = [];
  let cp = currentCreditPoints;
  const tc = totalCredits;

  for (const item of prioritized) {
    const cpGain = (item.subject.expectedGradePoint - item.subject.currentGradePoint) * item.subject.credits;
    cp += cpGain;
    roadmap.push({
      step:           item.priority,
      action:         `Clear ${item.subject.name}`,
      projectedCGPA:  parseFloat((cp / Math.max(tc, 1)).toFixed(2)),
      cgpaGain:       item.cgpaImpactIfCleared,
    });
  }

  return roadmap;
}
