import { nsutPolicy } from './nsutPolicy.js'

const policiesByUniversity = {
  nsut: nsutPolicy,
}

function round(value, places = 2) {
  if (!Number.isFinite(value)) return value
  return parseFloat(value.toFixed(places))
}

export function getUniversityPolicy(universityId = 'nsut') {
  const policy = policiesByUniversity[String(universityId).toLowerCase()]

  if (!policy) {
    throw new Error(`No policy configured for university: ${universityId}`)
  }

  return policy
}

export function calculateCGPAByPolicy(records, policy = getUniversityPolicy('nsut')) {
  const validRecords = Array.isArray(records)
    ? records.filter((record) => {
        const include = record.includeInCGPA !== false
        const isAudit = record.type === 'audit'
        return include &&
          Number.isFinite(record.credits) &&
          Number.isFinite(record.gradePoint) &&
          record.credits > 0 &&
          (policy.cgpa.includeAuditCourses || !isAudit)
      })
    : []

  const totalCredits = validRecords.reduce((sum, record) => sum + record.credits, 0)
  const creditPoints = validRecords.reduce(
    (sum, record) => sum + record.credits * record.gradePoint,
    0
  )

  return {
    cgpa: totalCredits > 0 ? round(creditPoints / totalCredits, policy.cgpa.rounding) : 0,
    totalCredits,
    creditPoints: round(creditPoints, 2),
    recordCount: validRecords.length,
  }
}

export function getImprovementRules(universityId = 'nsut') {
  return getUniversityPolicy(universityId).improvement
}
