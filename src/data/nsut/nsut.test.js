import process from 'node:process'
import {
  calculateCGPAByPolicy,
  getBranchCurriculum,
  getImprovementEligibleSubjects,
  getImprovementRules,
  getSemesterSubjects,
  getTotalCredits,
  getUnverifiedSemesters,
  getUniversityPolicy,
} from './index.js'

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
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
  }
}

console.log('\n-- NSUT data infrastructure --')

test('loads ECAM curriculum with all 8 semesters', () => {
  const curriculum = getBranchCurriculum('ECAM')

  expect(curriculum.branchCode).toBe('ECAM')
  expect(curriculum.semesters.length).toBe(8)
  expect(curriculum.semesters[0].verified).toBeTruthy()
  expect(curriculum.semesters[1].verified).toBeTruthy()
})

test('verified ECAM semesters match official credit totals', () => {
  const curriculum = getBranchCurriculum('ECAM')
  const semesterCredits = curriculum.semesters.map((semester) =>
    semester.subjects.reduce((sum, subject) => sum + subject.credits, 0)
  )

  expect(semesterCredits).toEqual([20, 24, 0, 0, 0, 0, 0, 0])
})

test('ECAM verified total credits are available through helper', () => {
  expect(getTotalCredits('ECAM')).toBe(44)
})

test('semester subject lookup returns verified official metadata', () => {
  const semOne = getSemesterSubjects('ECAM', 1)
  const semTwo = getSemesterSubjects('ECAM', 2)

  expect(semOne.find((subject) => subject.code === 'FCCS002').name).toBe('Computer Programming')
  expect(semOne.find((subject) => subject.code === 'FCPH004').name).toBe('Physics')
  expect(semTwo.find((subject) => subject.code === 'FCHS005').name).toBe('English')
  expect(semTwo.find((subject) => subject.code === 'FCCH008').name).toBe('Environment Science and Green Chemistry')
})

test('improvement eligibility only uses source-backed subject rows', () => {
  const eligible = getImprovementEligibleSubjects('ECAM')

  expect(eligible.length).toBeGreaterThan(0)
  expect(eligible.some((subject) => subject.code === 'FCCS002')).toBeTruthy()
  expect(eligible.some((subject) => subject.semester > 2)).toBe(false)
})

test('unverified ECAM semesters are explicit placeholders', () => {
  const unverified = getUnverifiedSemesters('ECAM')

  expect(unverified.length).toBe(6)
  expect(unverified.every((semester) => semester.sourceType === 'placeholder')).toBeTruthy()
  expect(unverified.every((semester) => semester.subjects.length === 0)).toBeTruthy()
})

test('policy loading exposes NSUT improvement rules', () => {
  const policy = getUniversityPolicy('nsut')
  const rules = getImprovementRules('nsut')

  expect(policy.universityId).toBe('nsut')
  expect(rules.optional).toBeTruthy()
  expect(rules.defaultMaxEligibleCurrentGradePoint).toBe(8.49)
})

test('policy CGPA calculation uses credit-weighted grade points', () => {
  const result = calculateCGPAByPolicy([
    { credits: 4, gradePoint: 8, type: 'program-core' },
    { credits: 2, gradePoint: 6, type: 'humanities' },
    { credits: 2, gradePoint: 10, type: 'audit' },
  ])

  expect(result.totalCredits).toBe(6)
  expect(result.creditPoints).toBe(44)
  expect(result.cgpa).toBe(7.33)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
