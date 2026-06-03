export const nsutGradingScale = {
  universityId: 'nsut',
  scale: 10,
  passingGradePoint: 4,
  failGradePoint: 0,
  gradePoints: [
    { letter: 'O', point: 10, label: 'Outstanding' },
    { letter: 'A+', point: 9, label: 'Excellent' },
    { letter: 'A', point: 8, label: 'Very Good' },
    { letter: 'B+', point: 7, label: 'Good' },
    { letter: 'B', point: 6, label: 'Above Average' },
    { letter: 'C', point: 5, label: 'Average' },
    { letter: 'P', point: 4, label: 'Pass' },
    { letter: 'F', point: 0, label: 'Fail' },
  ],
  relativeGrading: {
    enabled: true,
    note: 'NSUT courses may be graded relatively. SemPilot stores grade-point outcomes, not class distribution curves.',
  },
}
