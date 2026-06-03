import {
  calculateCGPAByPolicy,
  getBranchCurriculum,
  getImprovementRules,
  getUniversityPolicy,
} from '../../data/nsut/index.js'
import { SUBJECT_STATUS } from './profileModel.js'

function flattenSubjects(profile) {
  return (profile?.semesters ?? []).flatMap((semester) =>
    semester.subjects.map((subject) => ({
      ...subject,
      semesterNumber: semester.semesterNumber,
    }))
  )
}

function isCompletedStatus(status) {
  return [
    SUBJECT_STATUS.CLEARED,
    SUBJECT_STATUS.BACKLOG,
    SUBJECT_STATUS.IMPROVEMENT_CANDIDATE,
  ].includes(status)
}

export function calculateCurrentCGPA(profile, policy = getUniversityPolicy(profile?.university ?? 'nsut')) {
  const records = flattenSubjects(profile)
    .filter((subject) => isCompletedStatus(subject.status))
    .map((subject) => ({
      credits: subject.credits,
      gradePoint: subject.status === SUBJECT_STATUS.BACKLOG ? policy.backlog.failedGradePoint : subject.gradePoint,
      type: subject.type,
      includeInCGPA: subject.gradePoint !== null && subject.gradePoint !== undefined,
    }))

  return calculateCGPAByPolicy(records, policy)
}

export function getBacklogSubjects(profile, policy = getUniversityPolicy(profile?.university ?? 'nsut')) {
  return flattenSubjects(profile)
    .filter((subject) => subject.status === SUBJECT_STATUS.BACKLOG)
    .map((subject) => ({
      id: subject.code,
      name: subject.name,
      credits: subject.credits,
      currentGradePoint: policy.backlog.failedGradePoint,
      expectedGradePoint: policy.backlog.defaultExpectedClearGradePoint,
      semesterNumber: subject.semesterNumber,
      difficulty: subject.difficulty,
    }))
}

export function getImprovementCandidates(profile, policy = getUniversityPolicy(profile?.university ?? 'nsut')) {
  const rules = getImprovementRules(policy.universityId)
  const maxEligibleGrade = rules.defaultMaxEligibleCurrentGradePoint

  return flattenSubjects(profile)
    .filter((subject) =>
      [SUBJECT_STATUS.CLEARED, SUBJECT_STATUS.IMPROVEMENT_CANDIDATE].includes(subject.status) &&
      subject.improvementEligible &&
      Number.isFinite(subject.gradePoint) &&
      subject.gradePoint <= maxEligibleGrade
    )
    .map((subject) => ({
      id: subject.code,
      name: subject.name,
      credits: subject.credits,
      currentGradePoint: subject.gradePoint,
      gradePoint: subject.gradePoint,
      estimatedDifficulty: subject.difficulty,
      semesterNumber: subject.semesterNumber,
      status: subject.status,
    }))
}

export function getCompletedCredits(profile, policy = getUniversityPolicy(profile?.university ?? 'nsut')) {
  return calculateCurrentCGPA(profile, policy).totalCredits
}

export function getRemainingCredits(profile) {
  const curriculum = getBranchCurriculum(profile.branch)
  const completedSemesterNumbers = new Set((profile.semesters ?? []).map((semester) => semester.semesterNumber))

  return curriculum.semesters
    .filter((semester) => !completedSemesterNumbers.has(semester.semester))
    .reduce(
      (total, semester) => total + semester.subjects.reduce((sum, subject) => sum + subject.credits, 0),
      0
    )
}

export function getCurrentSemesterLoad(profile) {
  const current = (profile.semesters ?? []).find(
    (semester) => semester.semesterNumber === profile.currentSemester
  )

  return (current?.subjects ?? []).reduce((sum, subject) => sum + subject.credits, 0)
}

export function getPlannerInputsFromTranscript(profile, policy = getUniversityPolicy(profile?.university ?? 'nsut')) {
  const cgpa = calculateCurrentCGPA(profile, policy)

  return {
    currentCGPA: cgpa.cgpa,
    currentCreditPoints: cgpa.creditPoints,
    currentTotalCredits: cgpa.totalCredits,
    remainingCredits: getRemainingCredits(profile),
    backlogs: getBacklogSubjects(profile, policy),
    improvementSubjects: getImprovementCandidates(profile, policy),
  }
}
