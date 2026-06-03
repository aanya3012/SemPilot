import { nsutGradingScale } from '../grading/nsutGrading.js'

export const nsutPolicy = {
  id: 'nsut-default',
  universityId: 'nsut',
  universityName: 'Netaji Subhas University of Technology',
  source: {
    name: 'NSUT Course Curriculum (CBCS) page',
    url: 'https://www.nsut.ac.in/en/curriculam-information',
    notes: [
      'The NSUT curriculum page lists B.Tech. in ECE - ECAM under Bachelor Programmes.',
      'Policy values are configurable placeholders pending ordinance-level validation.',
    ],
  },
  grading: nsutGradingScale,
  cgpa: {
    method: 'credit_weighted_grade_points',
    formula: 'sum(gradePoint * credits) / sum(credits)',
    maxCGPA: 10,
    rounding: 2,
    includeFailedCredits: true,
    includeAuditCourses: false,
  },
  backlog: {
    failedGradePoint: 0,
    mandatoryToClear: true,
    countsTowardAcademicRisk: true,
    defaultExpectedClearGradePoint: 6,
  },
  improvement: {
    optional: true,
    eligibleCourseTypes: ['theory', 'core', 'program-core', 'program-elective', 'open-elective', 'humanities'],
    ineligibleCourseTypes: ['lab', 'project', 'seminar', 'audit', 'training'],
    defaultMaxEligibleCurrentGradePoint: 8.49,
    gradeCap: {
      enabled: false,
      maxGradePoint: 10,
      note: 'No improvement cap is applied by default. Configure this if NSUT rules impose a cap for improvement attempts.',
    },
  },
  semesterProgression: {
    totalSemesters: 8,
    creditSystem: 'CBCS',
    promotionModel: 'semester_based_with_backlog_carry',
  },
}
