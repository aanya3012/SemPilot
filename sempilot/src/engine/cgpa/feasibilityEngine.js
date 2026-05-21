/**
 * SemPilot — Feasibility Engine
 *
 * This is the product's emotional core.
 * It answers: "Am I cooked?" with precision.
 *
 * Output drives the Academic Damage Report™ and the
 * Dashboard feasibility meter.
 */

import { predictRequiredSGPA } from './predictRequiredSGPA.js';
import { calculateBestPossibleCGPA } from './calculateCGPA.js';

/**
 * @typedef {'impossible' | 'very_hard' | 'hard' | 'moderate' | 'achievable' | 'already_achieved'} FeasibilityVerdict
 */

/**
 * @typedef {Object} FeasibilityResult
 * @property {FeasibilityVerdict} verdict
 * @property {number}   score             - 0–100 feasibility score
 * @property {number}   requiredSGPA      - uniform SGPA needed per remaining sem
 * @property {number}   bestPossibleCGPA  - ceiling if student scores max every sem
 * @property {boolean}  isAchievable      - true if target is mathematically reachable
 * @property {boolean}  alreadyAchieved   - true if currentCGPA ≥ target already
 * @property {string}   headline          - short emotional summary string
 * @property {string}   subtext           - actionable detail string
 * @property {string}   color             - UI color token: 'green'|'amber'|'red'|'gray'
 * @property {number}   surplusOrDeficit  - headroom above / below maxSGPA
 */

const VERDICT_CONFIG = {
  already_achieved: {
    color:    'green',
    headline: 'Target achieved.',
    subtext:  'Your CGPA is already at or above your goal. Maintain your current pace.',
  },
  achievable: {
    color:    'green',
    headline: 'You can do this.',
    subtext:  'Stay consistent and your target is within reach.',
  },
  moderate: {
    color:    'amber',
    headline: 'Possible, but you need to push.',
    subtext:  'A step up from your current pace will get you there.',
  },
  hard: {
    color:    'amber',
    headline: 'This will be tough.',
    subtext:  'You\'ll need near-perfect performance in remaining semesters.',
  },
  very_hard: {
    color:    'red',
    headline: 'Extremely difficult.',
    subtext:  'Consider adjusting your target CGPA or clearing backlogs immediately.',
  },
  impossible: {
    color:    'red',
    headline: 'Mathematically out of reach.',
    subtext:  'Even a perfect score in all remaining semesters won\'t reach your target.',
  },
};

/**
 * Maps a requiredSGPA to a verdict.
 * Thresholds are relative to maxSGPA for university-agnostic behavior.
 *
 * @param {boolean} alreadyAchieved
 * @param {boolean} isAchievable
 * @param {number}  requiredSGPA
 * @param {number}  maxSGPA
 * @returns {FeasibilityVerdict}
 */
function deriveVerdict(alreadyAchieved, isAchievable, requiredSGPA, maxSGPA) {
  if (alreadyAchieved) return 'already_achieved';
  if (!isAchievable)   return 'impossible';

  const ratio = requiredSGPA / maxSGPA;
  if (ratio >= 0.97) return 'very_hard';
  if (ratio >= 0.92) return 'hard';
  if (ratio >= 0.88) return 'moderate';
  return 'achievable';
}

/**
 * Maps a verdict to a 0–100 score for the UI progress ring.
 *
 * @param {FeasibilityVerdict} verdict
 * @param {number} requiredSGPA
 * @param {number} maxSGPA
 * @returns {number}
 */
function deriveScore(verdict, requiredSGPA, maxSGPA) {
  if (verdict === 'already_achieved') return 100;
  if (verdict === 'impossible') return 0;

  const ratio = requiredSGPA / maxSGPA;

  // Easier targets = higher scores
  const score = 100 - (ratio * 50);

  return Math.round(
    Math.max(5, Math.min(95, score))
  );
}
/**
 * Computes the full feasibility assessment for a student.
 *
 * @param {Object} params
 * @param {number} params.currentCreditPoints   - Σ(SGPA × Credits) completed
 * @param {number} params.currentTotalCredits   - credits completed
 * @param {number} params.remainingCredits      - credits left to complete
 * @param {number} params.targetCGPA            - student's goal
 * @param {number} [params.maxSGPA=10]          - university ceiling
 * @returns {FeasibilityResult}
 */
export function computeFeasibility({
  currentCreditPoints,
  currentTotalCredits,
  remainingCredits,
  targetCGPA,
  maxSGPA = 10,
}) {
  const prediction = predictRequiredSGPA({
    currentCreditPoints,
    currentTotalCredits,
    remainingCredits,
    targetCGPA,
    maxSGPA,
  });

  const bestPossibleCGPA = calculateBestPossibleCGPA({
    currentCreditPoints,
    currentTotalCredits,
    remainingCredits,
    maxSGPA,
  });

  const verdict = deriveVerdict(
    prediction.alreadyAchieved,
    prediction.isAchievable,
    prediction.requiredSGPA,
    maxSGPA
  );

  const score = deriveScore(verdict, prediction.requiredSGPA, maxSGPA);
  const config = VERDICT_CONFIG[verdict];

  return {
    verdict,
    score,
    requiredSGPA:     prediction.requiredSGPA,
    bestPossibleCGPA,
    isAchievable:     prediction.isAchievable,
    alreadyAchieved:  prediction.alreadyAchieved,
    surplusOrDeficit: prediction.surplusOrDeficit,
    headline:         config.headline,
    subtext:          config.subtext,
    color:            config.color,
  };
}
