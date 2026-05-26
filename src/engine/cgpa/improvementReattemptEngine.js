/**
 * SemPilot - Improvement Reattempt Engine
 *
 * Models optional reattempts of already-cleared subjects.
 * This is intentionally separate from backlog recovery:
 * - backlogs are mandatory failed subjects
 * - improvement reattempts are optional attempts in passed subjects
 */

function round(value, places = 2) {
  if (!Number.isFinite(value)) return value
  return parseFloat(value.toFixed(places))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0
}

function normalizeSubject(subject, index) {
  const currentGradePoint = Number(subject.currentGradePoint ?? subject.gradePoint)
  const estimatedDifficulty = Number(subject.estimatedDifficulty ?? subject.difficulty ?? 3)

  return {
    id: subject.id ?? `subject-${index + 1}`,
    name: subject.name ?? `Subject ${index + 1}`,
    credits: Number(subject.credits),
    currentGradePoint,
    estimatedDifficulty: clamp(Number.isFinite(estimatedDifficulty) ? estimatedDifficulty : 3, 1, 5),
    semesterNumber: subject.semesterNumber,
    original: subject,
  }
}

function buildFeasibility({ projectedCreditPoints, totalCredits, targetCGPA }) {
  const projectedFinalCGPA = projectedCreditPoints / Math.max(totalCredits, 1)

  return {
    projectedFinalCGPA: round(projectedFinalCGPA, 2),
    targetCGPA: round(targetCGPA, 2),
    isTargetMet: projectedFinalCGPA >= targetCGPA,
    creditPointGap: round(Math.max(0, targetCGPA * totalCredits - projectedCreditPoints), 2),
  }
}

function candidateReason(candidate) {
  if (candidate.oldGradePoint <= 5) return 'Very low cleared grade with strong recovery upside'
  if (candidate.subject.credits >= 4) return 'High-credit subject with meaningful CGPA movement'
  if (candidate.improvementEfficiency >= 2) return 'Efficient recovery relative to estimated difficulty'
  return `Adds ${candidate.creditPointGain.toFixed(2)} credit-points if improved`
}

function scoreCandidates({ subjects, targetGrade, totalCredits, maxGradePoint }) {
  const rawCandidates = subjects
    .filter((subject) => targetGrade > subject.currentGradePoint)
    .map((subject) => {
      const creditPointGain = (targetGrade - subject.currentGradePoint) * subject.credits
      const cgpaGainPotential = creditPointGain / Math.max(totalCredits, 1)
      const improvementEfficiency = creditPointGain / subject.estimatedDifficulty

      return {
        subject: {
          id: subject.id,
          name: subject.name,
          credits: subject.credits,
          currentGradePoint: subject.currentGradePoint,
          estimatedDifficulty: subject.estimatedDifficulty,
          semesterNumber: subject.semesterNumber,
        },
        oldGradePoint: subject.currentGradePoint,
        estimatedNewGradePoint: round(targetGrade, 1),
        targetGrade: round(targetGrade, 1),
        creditPointGain: round(creditPointGain, 2),
        cgpaGainPotential: round(cgpaGainPotential, 3),
        cgpaGain: round(cgpaGainPotential, 3),
        improvementEfficiency: round(improvementEfficiency, 2),
        recoveryEfficiency: round(improvementEfficiency, 2),
      }
    })

  const maxCredits = Math.max(...rawCandidates.map((candidate) => candidate.subject.credits), 1)
  const maxGain = Math.max(...rawCandidates.map((candidate) => candidate.creditPointGain), 1)
  const maxEfficiency = Math.max(...rawCandidates.map((candidate) => candidate.improvementEfficiency), 1)

  return rawCandidates
    .map((candidate) => {
      const lowGradeScore = (maxGradePoint - candidate.oldGradePoint) / Math.max(maxGradePoint, 1)
      const creditScore = candidate.subject.credits / maxCredits
      const gainScore = candidate.creditPointGain / maxGain
      const efficiencyScore = candidate.improvementEfficiency / maxEfficiency
      const recoveryPriorityScore =
        (lowGradeScore * 0.25 + creditScore * 0.20 + gainScore * 0.35 + efficiencyScore * 0.20) * 100

      return {
        ...candidate,
        recoveryPriorityScore: round(recoveryPriorityScore, 1),
      }
    })
    .sort((a, b) => {
      const scoreDiff = b.recoveryPriorityScore - a.recoveryPriorityScore
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff

      const efficiencyDiff = b.improvementEfficiency - a.improvementEfficiency
      if (Math.abs(efficiencyDiff) > 0.001) return efficiencyDiff

      return b.creditPointGain - a.creditPointGain
    })
    .map((candidate, index) => ({
      ...candidate,
      priority: index + 1,
      reason: candidateReason(candidate),
    }))
}

function selectMinimumCandidates(candidates, creditPointDeficit) {
  const selectedReattempts = []
  let recoveredCreditPoints = 0

  for (const candidate of candidates) {
    if (recoveredCreditPoints >= creditPointDeficit) break
    recoveredCreditPoints += candidate.creditPointGain
    selectedReattempts.push(candidate)
  }

  return {
    selectedReattempts,
    recoveredCreditPoints,
    remainingDeficit: Math.max(0, creditPointDeficit - recoveredCreditPoints),
  }
}

function estimateRecommendedTargetGrade({
  eligibleSubjects,
  creditPointDeficit,
  totalCredits,
  minClearedGradePoint,
  maxGradePoint,
}) {
  if (creditPointDeficit <= 0) return null
  if (eligibleSubjects.length === 0) return maxGradePoint

  const lowestStartingGrade = Math.min(...eligibleSubjects.map((subject) => subject.currentGradePoint))
  const startGrade = Math.max(minClearedGradePoint, Math.ceil((lowestStartingGrade + 0.1) * 10) / 10)

  for (let grade = startGrade; grade <= maxGradePoint + 0.0001; grade = round(grade + 0.1, 1)) {
    const candidates = scoreCandidates({
      subjects: eligibleSubjects,
      targetGrade: grade,
      totalCredits,
      maxGradePoint,
    })
    const totalGain = candidates.reduce((sum, candidate) => sum + candidate.creditPointGain, 0)

    if (totalGain >= creditPointDeficit) return round(grade, 1)
  }

  return maxGradePoint
}

function derivePressureLevel({
  creditPointDeficit,
  totalCredits,
  selectedReattempts,
  recommendedTargetGrade,
  remainingCredits,
}) {
  if (creditPointDeficit <= 0) return 'low'
  if (!Number.isFinite(selectedReattempts.length) || selectedReattempts.length === 0) return 'extreme'

  const averageOldGrade = selectedReattempts.reduce(
    (sum, candidate) => sum + candidate.oldGradePoint,
    0
  ) / selectedReattempts.length
  const requiredGradeJump = Math.max(0, recommendedTargetGrade - averageOldGrade)
  const deficitCGPA = creditPointDeficit / Math.max(totalCredits, 1)
  const remainingCreditPressure = remainingCredits > 0 ? deficitCGPA / (remainingCredits / totalCredits) : deficitCGPA

  let score = 0
  score += selectedReattempts.length >= 5 ? 3 : selectedReattempts.length >= 3 ? 2 : selectedReattempts.length >= 1 ? 1 : 0
  score += requiredGradeJump >= 3 ? 3 : requiredGradeJump >= 2 ? 2 : requiredGradeJump >= 1 ? 1 : 0
  score += deficitCGPA >= 0.6 ? 3 : deficitCGPA >= 0.35 ? 2 : deficitCGPA >= 0.15 ? 1 : 0
  score += remainingCreditPressure >= 1 ? 2 : remainingCreditPressure >= 0.5 ? 1 : 0

  if (score >= 8) return 'extreme'
  if (score >= 5) return 'high'
  if (score >= 3) return 'moderate'
  return 'low'
}

function buildStrategicSummary({
  targetCGPA,
  minimumReattemptsNeeded,
  recommendedTargetGrade,
  achievableWithImprovements,
  pressureLevel,
  topRecoverySubjects,
  creditPointDeficit,
}) {
  if (creditPointDeficit <= 0) {
    return `Target CGPA ${targetCGPA} is already covered by the current projection; improvement reattempts are optional for extra buffer.`
  }

  if (!achievableWithImprovements) {
    return `At the current subject pool, optional improvement reattempts alone are unlikely to reach ${targetCGPA} CGPA. Add more eligible subjects or revise the target.`
  }

  const subjectList = topRecoverySubjects
    .slice(0, 3)
    .map((candidate) => candidate.subject.name)
    .join(', ')

  return `To reach ${targetCGPA} CGPA, reattempt at least ${minimumReattemptsNeeded} strategic subject${minimumReattemptsNeeded === 1 ? '' : 's'} and target around ${recommendedTargetGrade.toFixed(1)} GPA. Priority subjects: ${subjectList}. Pressure level: ${pressureLevel}.`
}

/**
 * Finds the minimum set of already-cleared subjects to reattempt in order to
 * close the grade-point deficit toward a target CGPA.
 *
 * @param {Object} params
 * @param {Array<{id?: string, name?: string, credits: number, currentGradePoint?: number, gradePoint?: number}>} params.subjects
 * @param {number} params.currentCreditPoints
 * @param {number} params.currentTotalCredits
 * @param {number} params.targetCGPA
 * @param {number} [params.remainingCredits=0]
 * @param {number|null} [params.assumedFutureSGPA=null]
 * @param {number} [params.expectedImprovedGradePoint] optional override for target improvement grade
 * @param {number} [params.maxGradePoint=10]
 * @param {number} [params.minClearedGradePoint=4]
 * @param {number} [params.maxEligibleCurrentGradePoint=8.49]
 * @returns {Object}
 */
export function analyzeImprovementReattempts({
  subjects,
  currentCreditPoints,
  currentTotalCredits,
  targetCGPA,
  remainingCredits = 0,
  assumedFutureSGPA = null,
  expectedImprovedGradePoint,
  maxGradePoint = 10,
  minClearedGradePoint = 4,
  maxEligibleCurrentGradePoint = 8.49,
}) {
  const safeRemainingCredits = Math.max(0, remainingCredits)
  const totalCredits = currentTotalCredits + safeRemainingCredits
  const futureCreditPoints = Number.isFinite(assumedFutureSGPA)
    ? assumedFutureSGPA * safeRemainingCredits
    : 0
  const projectedCreditPoints = currentCreditPoints + futureCreditPoints
  const targetCreditPoints = targetCGPA * totalCredits
  const creditPointDeficit = Math.max(0, targetCreditPoints - projectedCreditPoints)
  const feasibilityBefore = buildFeasibility({ projectedCreditPoints, totalCredits, targetCGPA })

  const normalizedSubjects = Array.isArray(subjects)
    ? subjects.map(normalizeSubject)
    : []

  const eligibleSubjects = normalizedSubjects.filter((subject) => {
    const explicitlyFailed = subject.original.isBacklog === true || subject.original.isFailed === true
    const hasUsableMarks = isPositiveNumber(subject.credits) && Number.isFinite(subject.currentGradePoint)
    const isCleared = subject.currentGradePoint >= minClearedGradePoint
    const isLowEnough = subject.currentGradePoint <= maxEligibleCurrentGradePoint

    return !explicitlyFailed && hasUsableMarks && isCleared && isLowEnough
  })

  const recommendedTargetGrade = Number.isFinite(expectedImprovedGradePoint)
    ? clamp(expectedImprovedGradePoint, minClearedGradePoint, maxGradePoint)
    : estimateRecommendedTargetGrade({
        eligibleSubjects,
        creditPointDeficit,
        totalCredits,
        minClearedGradePoint,
        maxGradePoint,
      })

  const candidates = creditPointDeficit <= 0 || recommendedTargetGrade === null
    ? []
    : scoreCandidates({
        subjects: eligibleSubjects,
        targetGrade: recommendedTargetGrade,
        totalCredits,
        maxGradePoint,
      })

  const {
    selectedReattempts,
    recoveredCreditPoints,
    remainingDeficit,
  } = selectMinimumCandidates(candidates, creditPointDeficit)

  const achievableWithImprovements = creditPointDeficit <= 0 || remainingDeficit <= 0
  const projectedCreditPointsAfter = projectedCreditPoints + recoveredCreditPoints
  const feasibilityAfter = buildFeasibility({
    projectedCreditPoints: projectedCreditPointsAfter,
    totalCredits,
    targetCGPA,
  })

  const minimumReattemptsNeeded = creditPointDeficit <= 0
    ? 0
    : achievableWithImprovements
    ? selectedReattempts.length
    : Infinity

  const pressureLevel = derivePressureLevel({
    creditPointDeficit,
    totalCredits,
    selectedReattempts,
    recommendedTargetGrade: recommendedTargetGrade ?? maxGradePoint,
    remainingCredits: safeRemainingCredits,
  })
  const topRecoverySubjects = candidates.slice(0, 5)
  const recommendedGradeBand = recommendedTargetGrade === null
    ? null
    : `${round(Math.max(minClearedGradePoint, recommendedTargetGrade - 0.5), 1)}-${round(recommendedTargetGrade, 1)}`
  const projectedCGPAGain = recoveredCreditPoints / Math.max(totalCredits, 1)

  const strategicSummary = buildStrategicSummary({
    targetCGPA,
    minimumReattemptsNeeded,
    recommendedTargetGrade,
    achievableWithImprovements,
    pressureLevel,
    topRecoverySubjects,
    creditPointDeficit,
  })

  return {
    creditPointDeficit: round(creditPointDeficit, 2),
    targetCreditPoints: round(targetCreditPoints, 2),
    projectedCreditPoints: round(projectedCreditPoints, 2),
    candidates,
    selectedReattempts,
    recommendedReattempts: selectedReattempts,
    minimumReattemptsNeeded,
    achievableWithImprovements,
    recoveredCreditPoints: round(recoveredCreditPoints, 2),
    remainingDeficit: round(remainingDeficit, 2),
    estimatedCGPAGain: round(projectedCGPAGain, 3),
    projectedCGPAGain: round(projectedCGPAGain, 3),
    projectedCGPAAfterImprovements: feasibilityAfter.projectedFinalCGPA,
    feasibilityBefore,
    feasibilityAfter,
    pressureLevel,
    recommendedTargetGrade: recommendedTargetGrade === null ? null : round(recommendedTargetGrade, 1),
    recommendedGradeBand,
    topRecoverySubjects,
    strategicSummary,
    summary: strategicSummary,
  }
}
