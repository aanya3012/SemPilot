import { getBranchCurriculum } from '../../data/nsut/index.js'

export const SUBJECT_STATUS = {
  CLEARED: 'cleared',
  BACKLOG: 'backlog',
  IMPROVEMENT_CANDIDATE: 'improvement_candidate',
  ONGOING: 'ongoing',
}

export function createAcademicProfile({
  university = 'nsut',
  branch = 'ECAM',
  currentSemester = 1,
  gradeSeed = {},
} = {}) {
  const curriculum = getBranchCurriculum(branch)

  return {
    university,
    branch,
    currentSemester,
    semesters: curriculum.semesters
      .filter((semester) => semester.semester <= currentSemester)
      .map((semester) => ({
        semesterNumber: semester.semester,
        verified: semester.verified === true,
        sourceType: semester.sourceType,
        subjects: (semester.subjects ?? []).map((subject) => {
          const seeded = gradeSeed[subject.code] ?? {}
          const isOngoing = semester.semester === currentSemester
          const status = seeded.status ?? (isOngoing ? SUBJECT_STATUS.ONGOING : SUBJECT_STATUS.CLEARED)

          return {
            code: subject.code,
            name: subject.name,
            credits: subject.credits,
            type: subject.type,
            difficulty: subject.difficulty,
            gradePoint: seeded.gradePoint ?? (isOngoing ? null : 7),
            status,
            attempts: seeded.attempts ?? 1,
            improvementEligible: subject.improvementEligible,
          }
        }),
      })),
  }
}

export function validateAcademicProfile(profile, policy) {
  const errors = []
  const seenCodes = new Set()
  const allowedStatuses = new Set(Object.values(SUBJECT_STATUS))
  const maxGradePoint = policy?.grading?.scale ?? 10

  if (!profile?.university) errors.push('University is required.')
  if (!profile?.branch) errors.push('Branch is required.')
  if (!Number.isInteger(profile?.currentSemester) || profile.currentSemester < 1) {
    errors.push('Current semester must be a positive integer.')
  }

  for (const semester of profile?.semesters ?? []) {
    if (semester.semesterNumber > profile.currentSemester) {
      errors.push(`Semester ${semester.semesterNumber} cannot exceed current semester.`)
    }

    for (const subject of semester.subjects ?? []) {
      if (seenCodes.has(subject.code)) errors.push(`Duplicate subject code: ${subject.code}`)
      seenCodes.add(subject.code)

      if (!allowedStatuses.has(subject.status)) {
        errors.push(`${subject.code} has invalid status: ${subject.status}`)
      }

      if (
        subject.gradePoint !== null &&
        subject.gradePoint !== undefined &&
        (!Number.isFinite(subject.gradePoint) || subject.gradePoint < 0 || subject.gradePoint > maxGradePoint)
      ) {
        errors.push(`${subject.code} has invalid grade point: ${subject.gradePoint}`)
      }

      if (subject.status === SUBJECT_STATUS.IMPROVEMENT_CANDIDATE && !subject.improvementEligible) {
        errors.push(`${subject.code} is not eligible for improvement attempts.`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
