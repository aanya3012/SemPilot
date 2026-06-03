import process from 'node:process'
import {
  SUBJECT_STATUS,
  calculateCurrentCGPA,
  createAcademicProfile,
  getBacklogSubjects,
  getCompletedCredits,
  getCurrentSemesterLoad,
  getImprovementCandidates,
  getPlannerInputsFromTranscript,
  getRemainingCredits,
  validateAcademicProfile,
} from './index.js'
import { getUniversityPolicy } from '../../data/nsut/index.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
    passed++
  } catch (error) {
    console.error(`  fail  ${name}`)
    console.error(`        ${error.message}`)
    failed++
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`)
    },
    toBeGreaterThan(value) {
      if (actual <= value) throw new Error(`Expected ${actual} > ${value}`)
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`)
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`)
    },
  }
}

const seed = {
  FCMT001: { gradePoint: 8, status: SUBJECT_STATUS.CLEARED },
  FCCS002: { gradePoint: 5, status: SUBJECT_STATUS.IMPROVEMENT_CANDIDATE },
  FCEC003: { gradePoint: 0, status: SUBJECT_STATUS.BACKLOG },
  FCPH004: { gradePoint: 7, status: SUBJECT_STATUS.CLEARED },
  FCME006: { gradePoint: 6, status: SUBJECT_STATUS.CLEARED },
}

console.log('\n-- Academic transcript state --')

test('creates an NSUT ECAM profile from curriculum', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 2, gradeSeed: seed })

  expect(profile.university).toBe('nsut')
  expect(profile.branch).toBe('ECAM')
  expect(profile.semesters.length).toBe(2)
  expect(profile.semesters[0].subjects.length).toBeGreaterThan(0)
})

test('computes CGPA from transcript status and policy', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 1, gradeSeed: seed })
  const result = calculateCurrentCGPA(profile)

  expect(result.totalCredits).toBe(20)
  expect(result.cgpa).toBe(5.2)
})

test('extracts explicit backlog subjects', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 1, gradeSeed: seed })
  const backlogs = getBacklogSubjects(profile)

  expect(backlogs.length).toBe(1)
  expect(backlogs[0].id).toBe('FCEC003')
})

test('filters improvement candidates by status, eligibility, and grade threshold', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 1, gradeSeed: seed })
  const candidates = getImprovementCandidates(profile)

  expect(candidates.length).toBeGreaterThan(0)
  expect(candidates.some((subject) => subject.id === 'FCCS002')).toBeTruthy()
  expect(candidates.some((subject) => subject.id === 'FCEC003')).toBeFalsy()
})

test('calculates completed and remaining credits', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 2, gradeSeed: seed })

  expect(getCompletedCredits(profile)).toBe(20)
  expect(getRemainingCredits(profile)).toBe(0)
})

test('calculates current semester load', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 2, gradeSeed: seed })

  expect(getCurrentSemesterLoad(profile)).toBe(24)
})

test('validates impossible transcript states', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 1, gradeSeed: seed })
  profile.semesters[0].subjects[0].gradePoint = 12

  expect(validateAcademicProfile(profile, getUniversityPolicy('nsut')).valid).toBeFalsy()
})

test('provides planner inputs from transcript', () => {
  const profile = createAcademicProfile({ university: 'nsut', branch: 'ECAM', currentSemester: 1, gradeSeed: seed })
  const inputs = getPlannerInputsFromTranscript(profile)

  expect(inputs.currentTotalCredits).toBe(20)
  expect(inputs.backlogs.length).toBe(1)
  expect(inputs.improvementSubjects.length).toBeGreaterThan(0)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
