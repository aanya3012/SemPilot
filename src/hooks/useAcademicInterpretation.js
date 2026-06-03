/**
 * useAcademicInterpretation
 *
 * React hook that runs all three engine layers and returns
 * a complete, structured interpretation report.
 *
 * Usage:
 *   const report = useAcademicInterpretation({
 *     currentCGPA: 7.4,
 *     targetCGPA: 8.5,
 *     currentTotalCredits: 100,
 *     remainingCredits: 100,   // 4 sems × 25
 *     backlogSubjects: [...],
 *   })
 *
 * All expensive calculation is memoised — only reruns when inputs change.
 */

import { useMemo } from 'react'
import { predictRequiredSGPA } from '../engine/cgpa/predictRequiredSGPA.js'
import { analyzeBacklogs, generateRecoveryRoadmap } from '../engine/cgpa/backlogRecoveryEngine.js'
import { buildInterpretationReport } from '../engine/interpretation/interpretationEngine.js'

/**
 * @param {Object} params
 * @param {number}   params.currentCGPA
 * @param {number}   params.targetCGPA
 * @param {number}   params.currentTotalCredits    - credits completed so far
 * @param {number}   params.remainingCredits       - credits left (sems × creditsPerSem)
 * @param {Array}    [params.backlogSubjects=[]]   - array of {id, name, credits} objects
 * @param {number}   [params.creditsPerBacklog=4]
 * @param {number}   [params.maxSGPA=10]
 * @returns {{
 *   sgpaResult: Object,
 *   backlogAnalysis: Object,
 *   recoveryRoadmap: Array,
 *   report: Object,
 * }}
 */
export function useAcademicInterpretation({
  currentCGPA,
  targetCGPA,
  currentTotalCredits,
  remainingCredits,
  backlogSubjects = [],
  creditsPerBacklog = 4,
  maxSGPA = 10,
}) {
  return useMemo(() => {
    // ── Engine 1: Required SGPA ──────────────────────────────────
    const sgpaResult = predictRequiredSGPA({
      currentCreditPoints:  currentCGPA * currentTotalCredits,
      currentTotalCredits,
      remainingCredits,
      targetCGPA,
      maxSGPA,
    })

    // ── Engine 2: Backlog analysis ───────────────────────────────
    const backlogAnalysis = analyzeBacklogs({
      backlogs: backlogSubjects.map((s) => ({
        ...s,
        currentGradePoint:  0,
        expectedGradePoint: 6,
        semesterNumber:     s.semesterNumber ?? 1,
      })),
      currentCreditPoints: currentCGPA * currentTotalCredits,
      totalCredits:        currentTotalCredits,
      remainingCredits,
    })

    // ── Engine 3: Recovery roadmap ───────────────────────────────
    const recoveryRoadmap = backlogAnalysis.prioritized.length > 0
      ? generateRecoveryRoadmap({
          prioritized:         backlogAnalysis.prioritized,
          currentCreditPoints: currentCGPA * currentTotalCredits,
          totalCredits:        currentTotalCredits,
        })
      : []

    // ── Interpretation layer ─────────────────────────────────────
    const report = buildInterpretationReport({
      currentCGPA,
      targetCGPA,
      currentTotalCredits,
      remainingCredits,
      requiredSGPA:    sgpaResult.requiredSGPA,
      isAchievable:    sgpaResult.isAchievable,
      alreadyAchieved: sgpaResult.alreadyAchieved,
      backlogSubjects,
      creditsPerBacklog,
      maxSGPA,
    })

    return { sgpaResult, backlogAnalysis, recoveryRoadmap, report }
  }, [currentCGPA, targetCGPA, currentTotalCredits, remainingCredits, backlogSubjects, creditsPerBacklog, maxSGPA])
}
