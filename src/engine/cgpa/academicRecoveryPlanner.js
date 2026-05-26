/**
 * SemPilot - Academic Recovery Planner
 *
 * Central orchestration layer for recovery planning.
 * Coordinates SGPA prediction, backlog recovery, and optional improvement
 * reattempt optimization without merging their internal logic.
 */

import { predictRequiredSGPA } from './predictRequiredSGPA.js'
import { analyzeBacklogs } from './backlogRecoveryEngine.js'
import { analyzeImprovementReattempts } from './improvementReattemptEngine.js'

function round(value, places = 2) {
  if (!Number.isFinite(value)) return value
  return parseFloat(value.toFixed(places))
}

function normalizeBacklogs(backlogs, fallbackCredits = 4) {
  if (!Array.isArray(backlogs)) return []

  return backlogs
    .filter((backlog) => backlog && Number.isFinite(Number(backlog.credits)))
    .map((backlog, index) => ({
      id: backlog.id ?? `backlog-${index + 1}`,
      name: backlog.name ?? `Backlog Subject ${index + 1}`,
      credits: Number(backlog.credits ?? fallbackCredits),
      currentGradePoint: Number(backlog.currentGradePoint ?? 0),
      expectedGradePoint: Number(backlog.expectedGradePoint ?? 6),
      semesterNumber: backlog.semesterNumber ?? 1,
      difficulty: backlog.difficulty,
    }))
}

function backlogCreditPointGain(backlogs) {
  return backlogs.reduce(
    (sum, backlog) => sum + Math.max(0, backlog.expectedGradePoint - backlog.currentGradePoint) * backlog.credits,
    0
  )
}

function deriveFeasibilityLevel({ alreadyAchieved, isAchievable, requiredSGPA, maxSGPA, sustainableSGPA }) {
  if (alreadyAchieved) return 'already_achieved'
  if (!isAchievable) return 'mathematically_impossible'
  if (requiredSGPA <= sustainableSGPA) return 'sustainable'
  if (requiredSGPA <= maxSGPA * 0.92) return 'difficult'
  return 'near_limit'
}

function deriveRecoveryMode({
  alreadyAchieved,
  targetAchievable,
  futureSemesterPlan,
  improvementStrategy,
  creditPointDeficitAfterFutureAndBacklogs,
}) {
  if (alreadyAchieved) return 'stable'
  if (!targetAchievable) return 'mathematically unstable'
  if (improvementStrategy.required || creditPointDeficitAfterFutureAndBacklogs > 0) return 'aggressive'
  if (!futureSemesterPlan.isStrategicallyEnough) return 'recovery'
  return 'stable'
}

function pressureRank(level) {
  return {
    low: 1,
    moderate: 2,
    high: 3,
    extreme: 4,
  }[level] ?? 1
}

function deriveRecoveryPressure({ recoveryMode, requiredSGPA, maxSGPA, improvementPressure }) {
  if (recoveryMode === 'mathematically unstable') return 'extreme'

  const sgpaPressure =
    requiredSGPA > maxSGPA ? 'extreme' :
    requiredSGPA >= maxSGPA * 0.95 ? 'high' :
    requiredSGPA >= maxSGPA * 0.85 ? 'moderate' :
    'low'

  return pressureRank(improvementPressure) > pressureRank(sgpaPressure)
    ? improvementPressure
    : sgpaPressure
}

function buildMasterStrategicSummary({
  targetCGPA,
  futureSemesterPlan,
  backlogRecovery,
  improvementStrategy,
  recoveryMode,
  recoveryPressure,
}) {
  if (futureSemesterPlan.alreadyAchieved) {
    return `Your ${targetCGPA} CGPA target is already achieved. Maintain around ${futureSemesterPlan.plannedSGPA.toFixed(2)} SGPA in remaining semesters for a safer finish.`
  }

  if (recoveryMode === 'mathematically unstable') {
    return `Your ${targetCGPA} CGPA target is mathematically unstable with the current credits, backlog recovery, and eligible improvement subjects. Revise the target or add more high-value improvement options.`
  }

  const parts = []

  if (futureSemesterPlan.isStrategicallyEnough) {
    parts.push(`Your target is reachable through semester performance alone by maintaining about ${futureSemesterPlan.requiredSGPA.toFixed(2)} SGPA.`)
  } else {
    parts.push(`Your target CGPA is difficult through semester performance alone; a practical plan should hold remaining semesters near ${futureSemesterPlan.plannedSGPA.toFixed(2)} SGPA.`)
  }

  if (backlogRecovery.remainingBacklogs > 0) {
    parts.push(`Clearing ${backlogRecovery.remainingBacklogs} backlog subject${backlogRecovery.remainingBacklogs === 1 ? '' : 's'} adds about ${backlogRecovery.projectedGain.toFixed(3)} CGPA to the final projection.`)
  }

  if (improvementStrategy.required) {
    const subjectNames = improvementStrategy.recommendedSubjects
      .slice(0, 3)
      .map((candidate) => candidate.subject.name)
      .join(', ')

    parts.push(`Strategically reattempt about ${improvementStrategy.recommendedSubjects.length} low-grade subject${improvementStrategy.recommendedSubjects.length === 1 ? '' : 's'} targeting around ${improvementStrategy.recommendedTargetGrade.toFixed(1)} GPA, starting with ${subjectNames}.`)
  }

  parts.push(`Overall recovery mode: ${recoveryMode}; pressure level: ${recoveryPressure}.`)

  return parts.join(' ')
}

/**
 * Builds a unified academic recovery plan.
 *
 * @param {Object} params
 * @param {number} [params.currentCGPA]
 * @param {number} [params.currentCreditPoints]
 * @param {number} params.currentTotalCredits
 * @param {number} params.remainingCredits
 * @param {number} params.targetCGPA
 * @param {Array} [params.backlogs=[]]
 * @param {Array} [params.improvementSubjects=[]]
 * @param {number} [params.maxSGPA=10]
 * @param {number} [params.sustainableSGPA=8.5]
 * @param {number} [params.creditsPerBacklog=4]
 * @returns {Object}
 */
export function planAcademicRecovery({
  currentCGPA,
  currentCreditPoints,
  currentTotalCredits,
  remainingCredits,
  targetCGPA,
  backlogs = [],
  improvementSubjects = [],
  maxSGPA = 10,
  sustainableSGPA = 8.5,
  creditsPerBacklog = 4,
}) {
  const resolvedCreditPoints = Number.isFinite(currentCreditPoints)
    ? currentCreditPoints
    : currentCGPA * currentTotalCredits
  const safeRemainingCredits = Math.max(0, remainingCredits)
  const totalProgramCredits = currentTotalCredits + safeRemainingCredits

  const sgpaPrediction = predictRequiredSGPA({
    currentCreditPoints: resolvedCreditPoints,
    currentTotalCredits,
    remainingCredits: safeRemainingCredits,
    targetCGPA,
    maxSGPA,
  })

  const feasibilityLevel = deriveFeasibilityLevel({
    alreadyAchieved: sgpaPrediction.alreadyAchieved,
    isAchievable: sgpaPrediction.isAchievable,
    requiredSGPA: sgpaPrediction.requiredSGPA,
    maxSGPA,
    sustainableSGPA,
  })

  const futurePlannedSGPA = sgpaPrediction.alreadyAchieved
    ? Math.min(maxSGPA, Math.max(currentCGPA ?? targetCGPA, targetCGPA))
    : sgpaPrediction.isAchievable
    ? Math.min(sustainableSGPA, sgpaPrediction.requiredSGPA)
    : maxSGPA

  const futureCreditPoints = safeRemainingCredits * futurePlannedSGPA
  const futureSemesterPlan = {
    requiredSGPA: sgpaPrediction.requiredSGPA,
    plannedSGPA: round(futurePlannedSGPA, 2),
    isMathematicallyEnough: sgpaPrediction.isAchievable,
    isStrategicallyEnough: sgpaPrediction.alreadyAchieved || sgpaPrediction.requiredSGPA <= sustainableSGPA,
    alreadyAchieved: sgpaPrediction.alreadyAchieved,
    projectedFinalCGPA: round((resolvedCreditPoints + futureCreditPoints) / Math.max(totalProgramCredits, 1), 2),
  }

  const normalizedBacklogs = normalizeBacklogs(backlogs, creditsPerBacklog)
  const backlogAnalysis = analyzeBacklogs({
    backlogs: normalizedBacklogs,
    currentCreditPoints: resolvedCreditPoints,
    totalCredits: currentTotalCredits,
    remainingCredits: safeRemainingCredits,
    maxSGPA,
  })
  const backlogGainCreditPoints = backlogCreditPointGain(normalizedBacklogs)
  const backlogProjectedGain = backlogGainCreditPoints / Math.max(totalProgramCredits, 1)

  const backlogRecovery = {
    impact: backlogAnalysis,
    projectedGain: round(backlogProjectedGain, 3),
    recoveredCreditPoints: round(backlogGainCreditPoints, 2),
    remainingBacklogs: normalizedBacklogs.length,
  }

  const projectedBeforeImprovementCP =
    resolvedCreditPoints + futureCreditPoints + backlogGainCreditPoints
  const creditPointDeficitAfterFutureAndBacklogs = Math.max(
    0,
    targetCGPA * totalProgramCredits - projectedBeforeImprovementCP
  )
  const shouldRecommendImprovements =
    !sgpaPrediction.alreadyAchieved &&
    (!futureSemesterPlan.isStrategicallyEnough || creditPointDeficitAfterFutureAndBacklogs > 0)

  const improvementResult = shouldRecommendImprovements
    ? analyzeImprovementReattempts({
        subjects: improvementSubjects,
        currentCreditPoints: resolvedCreditPoints + backlogGainCreditPoints,
        currentTotalCredits,
        remainingCredits: safeRemainingCredits,
        assumedFutureSGPA: futurePlannedSGPA,
        targetCGPA,
        maxGradePoint: maxSGPA,
      })
    : analyzeImprovementReattempts({
        subjects: [],
        currentCreditPoints: projectedBeforeImprovementCP,
        currentTotalCredits: totalProgramCredits,
        remainingCredits: 0,
        targetCGPA,
        maxGradePoint: maxSGPA,
      })

  const improvementStrategy = {
    required: shouldRecommendImprovements && improvementResult.recommendedReattempts.length > 0,
    recommendedSubjects: improvementResult.recommendedReattempts,
    estimatedCGPAGain: improvementResult.projectedCGPAGain,
    recommendedTargetGrade: improvementResult.recommendedTargetGrade,
    feasible: improvementResult.achievableWithImprovements,
    topRecoverySubjects: improvementResult.topRecoverySubjects,
  }

  const projectedFinalCGPA = shouldRecommendImprovements
    ? improvementResult.feasibilityAfter.projectedFinalCGPA
    : round(projectedBeforeImprovementCP / Math.max(totalProgramCredits, 1), 2)
  const targetAchievable = projectedFinalCGPA >= targetCGPA
  const recoveryMode = deriveRecoveryMode({
    alreadyAchieved: sgpaPrediction.alreadyAchieved,
    targetAchievable,
    futureSemesterPlan,
    improvementStrategy,
    creditPointDeficitAfterFutureAndBacklogs,
  })
  const recoveryPressure = deriveRecoveryPressure({
    recoveryMode,
    requiredSGPA: sgpaPrediction.requiredSGPA,
    maxSGPA,
    improvementPressure: improvementResult.pressureLevel,
  })

  const masterStrategicSummary = buildMasterStrategicSummary({
    targetCGPA,
    futureSemesterPlan,
    backlogRecovery,
    improvementStrategy,
    recoveryMode,
    recoveryPressure,
  })

  return {
    targetAchievable,
    requiredSGPA: sgpaPrediction.requiredSGPA,
    feasibilityLevel,
    futureSemesterPlan,
    backlogRecovery,
    improvementStrategy,
    recoveryPressure,
    recoveryMode,
    projectedFinalCGPA,
    creditPointDeficitAfterFutureAndBacklogs: round(creditPointDeficitAfterFutureAndBacklogs, 2),
    masterStrategicSummary,
    engineResults: {
      sgpaPrediction,
      backlogAnalysis,
      improvementResult,
    },
  }
}
