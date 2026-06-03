import { ecamCurriculum } from './ecam.js'

const curriculumByBranch = {
  ECAM: ecamCurriculum,
}

export function getBranchCurriculum(branchCode, { strict = true } = {}) {
  const curriculum = curriculumByBranch[String(branchCode).toUpperCase()]

  if (!curriculum && strict) {
    throw new Error(`No NSUT curriculum found for branch: ${branchCode}`)
  }

  return curriculum ?? null
}

export function getSemesterSubjects(branchCode, semester) {
  const curriculum = getBranchCurriculum(branchCode)
  const semesterRecord = curriculum.semesters.find((item) => item.semester === Number(semester))

  if (!semesterRecord) {
    throw new Error(`No semester ${semester} found for branch: ${branchCode}`)
  }

  return semesterRecord.subjects
}

export function getTotalCredits(branchCode) {
  const curriculum = getBranchCurriculum(branchCode)

  return curriculum.semesters.reduce(
    (total, semester) => total + (semester.subjects ?? []).reduce((sum, subject) => sum + subject.credits, 0),
    0
  )
}

export function getImprovementEligibleSubjects(branchCode, { throughSemester = 8 } = {}) {
  const curriculum = getBranchCurriculum(branchCode)

  return curriculum.semesters
    .filter((semester) => semester.semester <= throughSemester)
    .flatMap((semester) => (semester.subjects ?? []).map((subject) => ({
      ...subject,
      semester: semester.semester,
    })))
    .filter((subject) => subject.improvementEligible)
}

export function getUnverifiedSemesters(branchCode) {
  const curriculum = getBranchCurriculum(branchCode)

  return curriculum.semesters.filter((semester) => !semester.verified)
}
