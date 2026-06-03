/**
 * SemPilot — Academic Interpretation Engine
 *
 * This module is the TRANSLATION layer between raw engine numbers
 * and what students actually need to understand and act on.
 *
 * It does NOT recalculate anything — it consumes the outputs of:
 *   - predictRequiredSGPA()
 *   - analyzeBacklogs()
 *
 * And converts them into:
 *   - credit-grounded interpretations  ("you need X SGPA across Y credits")
 *   - backlog coupling analysis        ("Z subjects must be cleared at what level")
 *   - safe-recovery thresholds        ("you need ≥7.5 in backlog subjects to stay stable")
 *   - a full structured report        (ready for UI rendering or plain text export)
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AS A SEPARATE MODULE
 * ─────────────────────────────────────────────────────────────────
 * The engines produce numbers. Numbers alone don't tell a student
 * what to DO. "Required SGPA = 9.2" is meaningless without:
 *   - knowing how many credits that pressure is spread across
 *   - knowing whether backlogs make that harder or softer
 *   - knowing what grade level "recovery" actually requires
 *
 * This module answers those questions.
 * ─────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────
// CONSTANTS & ASSUMPTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * The grade point assumed when a backlog is cleared at baseline (pass level).
 * Reflects a B-grade reattempt in a 10-point scale (e.g. AKTU, VTU).
 * This is the MINIMUM assumed improvement; it is conservative by design.
 */
export const BACKLOG_BASELINE_GRADE_POINT = 6

/**
 * The grade point considered "safe recovery" — enough to actively help
 * CGPA rather than just neutralize the fail.
 * Derived from: baseline + 1.5 points headroom = meaningful improvement.
 */
export const BACKLOG_SAFE_RECOVERY_GRADE_POINT = 7.5

/**
 * Grade labels for display (10-point scale, common in Indian universities).
 */
const GRADE_LABELS = {
  10:  'O (Outstanding)',
  9:   'A+ (Excellent)',
  8:   'A (Very Good)',
  7:   'B+ (Good)',
  6:   'B (Above Average)',
  5:   'C (Average / Passing)',
  4:   'P (Pass)',
  0:   'F (Fail)',
}

function gradeLabel(gp) {
  const key = Math.round(gp)
  return GRADE_LABELS[key] ?? `${gp.toFixed(1)} GP`
}

// ─────────────────────────────────────────────────────────────────
// STEP 1 — SGPA CREDIT INTERPRETATION
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SGPACreditInterpretation
 * @property {number}   requiredSGPA          - from engine
 * @property {number}   remainingCredits      - total credits the pressure applies to
 * @property {number}   requiredCreditPoints  - exact credit-point total needed
 * @property {number}   currentCreditPoints   - credit-point total already earned
 * @property {number}   creditPointGap        - how many more credit-points are needed
 * @property {string}   summary               - human-readable one-liner
 * @property {string}   detail                - fuller explanation for UI tooltip/detail
 */

/**
 * Translates a required SGPA number into credit-grounded terms.
 * "You need 9.2 SGPA" becomes "you need 920 credit-points across 100 credits".
 *
 * @param {Object} params
 * @param {number} params.requiredSGPA
 * @param {number} params.remainingCredits
 * @param {number} params.currentCreditPoints
 * @param {number} params.currentTotalCredits
 * @param {number} params.targetCGPA
 * @returns {SGPACreditInterpretation}
 */
export function interpretSGPAInCredits({
  requiredSGPA,
  remainingCredits,
  currentCreditPoints,
  currentTotalCredits,
  targetCGPA,
}) {
  const totalCredits       = currentTotalCredits + remainingCredits
  const requiredCreditPoints = parseFloat((requiredSGPA * remainingCredits).toFixed(2))
  const totalNeeded          = parseFloat((targetCGPA * totalCredits).toFixed(2))
  const creditPointGap       = parseFloat((totalNeeded - currentCreditPoints).toFixed(2))

  const summary = requiredSGPA === Infinity
    ? `Target is unreachable — no remaining credits to close the gap.`
    : requiredSGPA > 10
    ? `Target requires ${requiredSGPA.toFixed(2)} SGPA — beyond the 10-point maximum. Not achievable.`
    : `You must earn ${requiredCreditPoints.toFixed(0)} credit-points across ${remainingCredits} remaining credits (avg SGPA: ${requiredSGPA.toFixed(2)}).`

  const detail = requiredSGPA > 10 || requiredSGPA === Infinity
    ? `Your current credit-point total is ${currentCreditPoints.toFixed(0)} across ${currentTotalCredits} completed credits. ` +
      `To reach a CGPA of ${targetCGPA}, you would need ${creditPointGap.toFixed(0)} more credit-points — ` +
      `but only ${remainingCredits} credits remain, making the maximum possible ${(10 * remainingCredits).toFixed(0)} additional credit-points. ` +
      `The gap of ${(creditPointGap - 10 * remainingCredits).toFixed(0)} credit-points cannot be bridged.`
    : `You have earned ${currentCreditPoints.toFixed(0)} credit-points so far across ${currentTotalCredits} credits ` +
      `(current CGPA: ${(currentCreditPoints / Math.max(currentTotalCredits, 1)).toFixed(2)}). ` +
      `To finish at ${targetCGPA} CGPA, you need a total of ${totalNeeded.toFixed(0)} credit-points. ` +
      `That means earning ${creditPointGap.toFixed(0)} more credit-points across your remaining ${remainingCredits} credits — ` +
      `which works out to a uniform SGPA of ${requiredSGPA.toFixed(2)} across every remaining credit.`

  return {
    requiredSGPA,
    remainingCredits,
    requiredCreditPoints,
    currentCreditPoints,
    creditPointGap,
    summary,
    detail,
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 2 — BACKLOG COUPLING ANALYSIS
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BacklogCouplingResult
 * @property {number}   backlogCount               - total backlog subjects
 * @property {number}   backlogCredits             - total credits tied up in backlogs
 * @property {number}   baselineRecoveryGP         - assumed grade point on reattempt (6.0)
 * @property {number}   safeRecoveryGP             - recommended minimum grade point (7.5)
 * @property {number}   cgpaGainAtBaseline         - CGPA improvement if all cleared at 6 GP
 * @property {number}   cgpaGainAtSafeLevel        - CGPA improvement if all cleared at 7.5 GP
 * @property {number}   cgpaGainAtPerfect          - CGPA improvement if all cleared at 10 GP
 * @property {boolean}  backlogsHelpFeasibility    - true if clearing backlogs meaningfully narrows the SGPA gap
 * @property {number}   effectiveSGPAAfterClear    - required SGPA if backlogs are all cleared at baseline
 * @property {string}   baselineAssumptionNote     - explanation of the 6 GP assumption
 * @property {string}   safeRecoveryNote           - explanation of the 7.5 GP recommendation
 * @property {string}   couplingVerdict            - plain-English coupling summary
 */

/**
 * Analyses how backlogs interact with the SGPA requirement.
 * Specifically: does clearing backlogs reduce the forward pressure,
 * and what grade level is needed in those backlog subjects for safety?
 *
 * @param {Object} params
 * @param {number} params.requiredSGPA              - from predictRequiredSGPA
 * @param {number} params.backlogCount
 * @param {number} params.creditsPerBacklog         - typically 4
 * @param {number} params.currentCreditPoints
 * @param {number} params.currentTotalCredits
 * @param {number} params.remainingCredits
 * @param {number} params.targetCGPA
 * @param {number} [params.maxSGPA=10]
 * @returns {BacklogCouplingResult}
 */
export function analyzeBacklogCoupling({
  requiredSGPA,
  backlogCount,
  creditsPerBacklog = 4,
  currentCreditPoints,
  currentTotalCredits,
  remainingCredits,
  targetCGPA,
  maxSGPA = 10,
}) {
  const backlogCredits = backlogCount * creditsPerBacklog
  const totalCredits   = currentTotalCredits + remainingCredits

  // CGPA gain at different clearing levels
  // Baseline: 0 → 6 (pass-level reattempt)
  // Safe:     0 → 7.5 (recommended minimum for meaningful recovery)
  // Perfect:  0 → 10 (best case)
  const cpGainAtBaseline  = backlogCredits * (BACKLOG_BASELINE_GRADE_POINT - 0)
  const cpGainAtSafe      = backlogCredits * (BACKLOG_SAFE_RECOVERY_GRADE_POINT - 0)
  const cpGainAtPerfect   = backlogCredits * (maxSGPA - 0)

  const cgpaGainAtBaseline = parseFloat((cpGainAtBaseline  / Math.max(totalCredits, 1)).toFixed(3))
  const cgpaGainAtSafeLevel= parseFloat((cpGainAtSafe      / Math.max(totalCredits, 1)).toFixed(3))
  const cgpaGainAtPerfect  = parseFloat((cpGainAtPerfect   / Math.max(totalCredits, 1)).toFixed(3))

  // What is the EFFECTIVE required SGPA if all backlogs are cleared at baseline?
  // After clearing, credit-point total rises by cpGainAtBaseline.
  // New required SGPA = (targetCGPA × totalCredits - (currentCreditPoints + cpGainAtBaseline)) / remainingCredits
  let effectiveSGPAAfterClear
  if (remainingCredits <= 0) {
    effectiveSGPAAfterClear = Infinity
  } else {
    const newCP = currentCreditPoints + cpGainAtBaseline
    const needed = targetCGPA * totalCredits
    effectiveSGPAAfterClear = parseFloat(((needed - newCP) / remainingCredits).toFixed(2))
  }

  const sgpaReduction = parseFloat((requiredSGPA - effectiveSGPAAfterClear).toFixed(2))
  const backlogsHelpFeasibility = sgpaReduction > 0.1 && effectiveSGPAAfterClear <= maxSGPA

  // ── Notes ──────────────────────────────────────────────────────

  const baselineAssumptionNote =
    `The backlog recovery engine assumes each reattempted subject is cleared at a grade point of ` +
    `${BACKLOG_BASELINE_GRADE_POINT} (${gradeLabel(BACKLOG_BASELINE_GRADE_POINT)}). ` +
    `This is conservative — it represents a pass-level performance, not excellence. ` +
    `At this level, ${backlogCount} backlog subject${backlogCount > 1 ? 's' : ''} (${backlogCredits} credits) ` +
    `would recover ${cgpaGainAtBaseline.toFixed(3)} CGPA points, bringing your effective required ` +
    `SGPA down from ${requiredSGPA.toFixed(2)} to ${effectiveSGPAAfterClear.toFixed(2)}.`

  const safeRecoveryNote =
    `For a stable and safe recovery, you should aim for ≥${BACKLOG_SAFE_RECOVERY_GRADE_POINT} ` +
    `(${gradeLabel(BACKLOG_SAFE_RECOVERY_GRADE_POINT)}) in your backlog subjects. ` +
    `At this level, you would recover ${cgpaGainAtSafeLevel.toFixed(3)} CGPA points — ` +
    `${(cgpaGainAtSafeLevel - cgpaGainAtBaseline).toFixed(3)} more than a bare pass. ` +
    `This buffer provides safety against underperformance in regular semesters. ` +
    `Scoring only a bare pass (grade point ${BACKLOG_BASELINE_GRADE_POINT}) is technically sufficient ` +
    `but leaves zero margin for error in your remaining regular semesters.`

  const couplingVerdict = backlogCount === 0
    ? 'No backlogs. Your entire CGPA pressure is concentrated in regular semester performance.'
    : backlogsHelpFeasibility
    ? `Clearing ${backlogCount} backlog${backlogCount > 1 ? 's' : ''} at baseline (${BACKLOG_BASELINE_GRADE_POINT} GP) ` +
      `reduces your required SGPA by ${sgpaReduction.toFixed(2)} points — ` +
      `from ${requiredSGPA.toFixed(2)} down to ${effectiveSGPAAfterClear.toFixed(2)}. ` +
      `Backlogs are a significant lever. Clear them first.`
    : effectiveSGPAAfterClear > maxSGPA
    ? `Even after clearing all ${backlogCount} backlog${backlogCount > 1 ? 's' : ''} at baseline, ` +
      `the required SGPA (${effectiveSGPAAfterClear.toFixed(2)}) still exceeds the maximum. ` +
      `Target CGPA is not achievable. Consider revising your target.`
    : `Clearing backlogs provides a small improvement (${sgpaReduction.toFixed(2)} SGPA reduction) ` +
      `but is not the primary recovery lever at this backlog level.`

  return {
    backlogCount,
    backlogCredits,
    baselineRecoveryGP:      BACKLOG_BASELINE_GRADE_POINT,
    safeRecoveryGP:          BACKLOG_SAFE_RECOVERY_GRADE_POINT,
    cgpaGainAtBaseline,
    cgpaGainAtSafeLevel,
    cgpaGainAtPerfect,
    backlogsHelpFeasibility,
    effectiveSGPAAfterClear,
    baselineAssumptionNote,
    safeRecoveryNote,
    couplingVerdict,
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 3 — PER-BACKLOG SUBJECT PERFORMANCE REQUIREMENT
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BacklogPerformanceRequirement
 * @property {string}   subjectId
 * @property {string}   subjectName
 * @property {number}   credits
 * @property {number}   minimumGPToPass         - bare pass (typically 4)
 * @property {number}   baselineTargetGP        - assumed in engine (6)
 * @property {number}   safeTargetGP            - recommended minimum (7.5)
 * @property {number}   cgpaContributionAtSafe  - CGPA points added if cleared at 7.5
 * @property {string}   performanceLabel        - e.g. "B+ or above for safe recovery"
 */

/**
 * For each backlog subject, calculates what specific grade is needed
 * to contribute meaningfully to CGPA recovery.
 *
 * @param {Array<{id: string, name: string, credits: number}>} backlogSubjects
 * @param {number} totalCredits - completed + remaining
 * @returns {BacklogPerformanceRequirement[]}
 */
export function calculateBacklogPerformanceRequirements(backlogSubjects, totalCredits) {
  return backlogSubjects.map((subject) => {
    const cgpaContributionAtBaseline = parseFloat(
      ((BACKLOG_BASELINE_GRADE_POINT * subject.credits) / Math.max(totalCredits, 1)).toFixed(3)
    )
    const cgpaContributionAtSafe = parseFloat(
      ((BACKLOG_SAFE_RECOVERY_GRADE_POINT * subject.credits) / Math.max(totalCredits, 1)).toFixed(3)
    )

    return {
      subjectId:              subject.id,
      subjectName:            subject.name,
      credits:                subject.credits,
      minimumGPToPass:        4,
      baselineTargetGP:       BACKLOG_BASELINE_GRADE_POINT,
      safeTargetGP:           BACKLOG_SAFE_RECOVERY_GRADE_POINT,
      cgpaContributionAtBaseline,
      cgpaContributionAtSafe,
      performanceLabel:
        `Aim for ${gradeLabel(BACKLOG_SAFE_RECOVERY_GRADE_POINT)} or above. ` +
        `This adds ${cgpaContributionAtSafe.toFixed(3)} CGPA points (vs ${cgpaContributionAtBaseline.toFixed(3)} at bare pass).`,
    }
  })
}

// ─────────────────────────────────────────────────────────────────
// STEP 4 — MASTER INTERPRETATION REPORT
// ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AcademicInterpretationReport
 * @property {SGPACreditInterpretation}    sgpaInterpretation
 * @property {BacklogCouplingResult}       backlogCoupling
 * @property {BacklogPerformanceRequirement[]} subjectRequirements
 * @property {SummaryBlock}                summary
 */

/**
 * @typedef {Object} SummaryBlock
 * @property {string} requiredSGPALine      - "Required SGPA: 9.10"
 * @property {string} remainingCreditsLine  - "Remaining credits: 100 (4 sems × 25)"
 * @property {string} interpretationLine    - "You must earn X credit-points across Y credits"
 * @property {string} backlogRequirementLine- "Z subjects must be reattempted"
 * @property {string} performanceLine       - "Aim for ≥7.5 GP in backlog subjects"
 * @property {string} assumptionLine        - baseline assumption disclosure
 * @property {string[]} actionItems         - ordered list of what student should do
 */

/**
 * Master function. Call this once with all inputs.
 * Returns a fully structured interpretation report.
 *
 * @param {Object} params
 * @param {number} params.currentCGPA
 * @param {number} params.targetCGPA
 * @param {number} params.currentTotalCredits
 * @param {number} params.remainingCredits
 * @param {number} params.requiredSGPA               - from predictRequiredSGPA()
 * @param {boolean} params.isAchievable              - from predictRequiredSGPA()
 * @param {boolean} params.alreadyAchieved           - from predictRequiredSGPA()
 * @param {Array<{id,name,credits}>} params.backlogSubjects
 * @param {number} [params.creditsPerBacklog=4]
 * @param {number} [params.maxSGPA=10]
 * @returns {AcademicInterpretationReport}
 */
export function buildInterpretationReport({
  currentCGPA,
  targetCGPA,
  currentTotalCredits,
  remainingCredits,
  requiredSGPA,
  isAchievable,
  alreadyAchieved,
  backlogSubjects = [],
  creditsPerBacklog = 4,
  maxSGPA = 10,
}) {
  const currentCreditPoints = currentCGPA * currentTotalCredits
  const totalCredits        = currentTotalCredits + remainingCredits
  const backlogCount        = backlogSubjects.length

  // ── Step 1: SGPA → credit interpretation ──────────────────────
  const sgpaInterpretation = interpretSGPAInCredits({
    requiredSGPA,
    remainingCredits,
    currentCreditPoints,
    currentTotalCredits,
    targetCGPA,
  })

  // ── Step 2: Backlog coupling ───────────────────────────────────
  const backlogCoupling = analyzeBacklogCoupling({
    requiredSGPA,
    backlogCount,
    creditsPerBacklog,
    currentCreditPoints,
    currentTotalCredits,
    remainingCredits,
    targetCGPA,
    maxSGPA,
  })

  // ── Step 3: Per-subject performance requirements ───────────────
  const subjectRequirements = calculateBacklogPerformanceRequirements(
    backlogSubjects,
    totalCredits
  )

  // ── Step 4: Structured summary block ──────────────────────────
  const requiredSGPALine =
    alreadyAchieved ? `Required SGPA: N/A — target already achieved (${currentCGPA.toFixed(2)} ≥ ${targetCGPA})` :
    !isAchievable   ? `Required SGPA: ∞ — target is mathematically unreachable` :
    `Required SGPA: ${requiredSGPA.toFixed(2)} (across all remaining semesters)`

  const remainingCreditsLine =
    `Remaining credits: ${remainingCredits}` +
    (remainingCredits % 25 === 0
      ? ` (${remainingCredits / 25} semester${remainingCredits / 25 > 1 ? 's' : ''} × 25 credits)`
      : '')

  const interpretationLine = alreadyAchieved
    ? `You have already achieved your target CGPA. Maintain an SGPA of ≥${currentCGPA.toFixed(2)} to hold it.`
    : !isAchievable
    ? `This requires ${sgpaInterpretation.creditPointGap.toFixed(0)} credit-points from ${remainingCredits} remaining credits — impossible even at maximum SGPA (${maxSGPA}).`
    : `You must earn ${sgpaInterpretation.requiredCreditPoints.toFixed(0)} credit-points across your ` +
      `${remainingCredits} remaining credits. Every single credit contributes — ` +
      `coasting in any subject directly reduces your CGPA ceiling.`

  const backlogRequirementLine = backlogCount === 0
    ? `Backlogs: None. Full SGPA pressure falls on regular semester performance.`
    : `Backlogs: ${backlogCount} subject${backlogCount > 1 ? 's' : ''} (${backlogCoupling.backlogCredits} credits) must be reattempted. ` +
      `Clearing them at baseline (${BACKLOG_BASELINE_GRADE_POINT} GP) reduces your required SGPA by ${(requiredSGPA - backlogCoupling.effectiveSGPAAfterClear).toFixed(2)} points.`

  const performanceLine = backlogCount === 0
    ? `No backlog performance target required.`
    : `Backlog subjects should be cleared at ≥${BACKLOG_SAFE_RECOVERY_GRADE_POINT} GP ` +
      `(${gradeLabel(BACKLOG_SAFE_RECOVERY_GRADE_POINT)}) for safe recovery. ` +
      `At this level you gain ${backlogCoupling.cgpaGainAtSafeLevel.toFixed(3)} CGPA points — ` +
      `${(backlogCoupling.cgpaGainAtSafeLevel - backlogCoupling.cgpaGainAtBaseline).toFixed(3)} more than a bare pass.`

  const assumptionLine =
    `Engine assumption: backlog reattempts are modelled at ${BACKLOG_BASELINE_GRADE_POINT} GP (${gradeLabel(BACKLOG_BASELINE_GRADE_POINT)}) ` +
    `baseline. Actual results depend on real reattempt performance.`

  // Action items: ordered by impact
  const actionItems = []

  if (alreadyAchieved) {
    actionItems.push('Your target is already met. Focus on maintaining consistency.')
  } else if (!isAchievable) {
    actionItems.push(`Lower your target CGPA — ${targetCGPA} is mathematically unreachable from here.`)
    actionItems.push('Consider clearing backlogs to improve your final achievable ceiling.')
    if (backlogCount > 0) {
      actionItems.push(`Even with all ${backlogCount} backlogs cleared, re-evaluate realistic targets.`)
    }
  } else {
    if (backlogCoupling.backlogsHelpFeasibility && backlogCount > 0) {
      actionItems.push(
        `Priority 1: Clear ${backlogCount} backlog subject${backlogCount > 1 ? 's' : ''} — ` +
        `this reduces your required SGPA from ${requiredSGPA.toFixed(2)} to ${backlogCoupling.effectiveSGPAAfterClear.toFixed(2)}.`
      )
      actionItems.push(
        `In backlog subjects, target ≥${BACKLOG_SAFE_RECOVERY_GRADE_POINT} GP. ` +
        `A bare pass (${BACKLOG_BASELINE_GRADE_POINT} GP) clears the subject but gives minimal CGPA lift.`
      )
    }
    actionItems.push(
      `Across your ${remainingCredits} remaining credits, maintain an average SGPA of ` +
      (backlogCount > 0
        ? `${backlogCoupling.effectiveSGPAAfterClear.toFixed(2)} (post-backlog-clearance target).`
        : `${requiredSGPA.toFixed(2)}.`)
    )
    if (requiredSGPA > 9) {
      actionItems.push(
        `Warning: an SGPA of ${requiredSGPA.toFixed(2)} requires near-perfect performance. ` +
        `Consider adjusting your target CGPA to ${(targetCGPA - 0.5).toFixed(1)} for a more realistic goal.`
      )
    }
    actionItems.push(
      `Every credit matters at this scale. ` +
      `Dropping even ${Math.ceil(remainingCredits * 0.1)} credits worth of performance by 1 GP ` +
      `costs ~${((Math.ceil(remainingCredits * 0.1)) / totalCredits).toFixed(3)} CGPA points.`
    )
  }

  const summary = {
    requiredSGPALine,
    remainingCreditsLine,
    interpretationLine,
    backlogRequirementLine,
    performanceLine,
    assumptionLine,
    actionItems,
  }

  return {
    sgpaInterpretation,
    backlogCoupling,
    subjectRequirements,
    summary,
  }
}
