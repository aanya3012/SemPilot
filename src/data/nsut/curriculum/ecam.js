const verifiedSource = {
  source: 'NSUT ECAM Scheme of Courses and Examination 2019-20',
  verified: true,
}

function placeholderSemester(semester) {
  return {
    semester,
    verified: false,
    sourceType: 'placeholder',
    source: 'Pending official NSUT ECAM scheme verification',
    subjects: [],
  }
}

export const ecamCurriculum = {
  id: 'nsut-ecam-2019-20',
  universityId: 'nsut',
  branchCode: 'ECAM',
  branchName: 'Electronics and Communication Engineering (Artificial Intelligence and Machine Learning)',
  source: {
    name: 'NSUT ECAM Scheme of Courses and Examination 2019-20',
    status: 'partially-verified',
    note: 'Semester I and II are source-backed. Curriculum beyond verified semesters is provisional.',
  },
  semesters: [
    {
      semester: 1,
      verified: true,
      sourceType: 'official-scheme',
      ...verifiedSource,
      subjects: [
        { code: 'FCMT001', name: 'Mathematics-I', credits: 4, type: 'core', difficulty: 3, improvementEligible: true },
        { code: 'FCCS002', name: 'Computer Programming', credits: 4, type: 'core', difficulty: 3, improvementEligible: true },
        { code: 'FCEC003', name: 'Electronics and Electrical Engineering', credits: 4, type: 'core', difficulty: 3, improvementEligible: true },
        { code: 'FCPH004', name: 'Physics', credits: 4, type: 'core', difficulty: 3, improvementEligible: true },
        { code: 'FCME006', name: 'Basics of Mechanical Engineering', credits: 4, type: 'core', difficulty: 2, improvementEligible: true },
      ],
    },
    {
      semester: 2,
      verified: true,
      sourceType: 'official-scheme',
      ...verifiedSource,
      subjects: [
        { code: 'FCHS005', name: 'English', credits: 4, type: 'humanities', difficulty: 1, improvementEligible: true },
        { code: 'FCMT007', name: 'Mathematics-II', credits: 4, type: 'core', difficulty: 3, improvementEligible: true },
        { code: 'FCCH008', name: 'Environment Science and Green Chemistry', credits: 4, type: 'core', difficulty: 2, improvementEligible: true },
        { code: 'EIECC01', name: 'Active Circuit Analysis and Synthesis', credits: 4, type: 'program-core', difficulty: 4, improvementEligible: true },
        { code: 'EIECC02', name: 'Electronic Devices and Circuits', credits: 4, type: 'program-core', difficulty: 4, improvementEligible: true },
        { code: 'EIITC03', name: 'Data Structures and Algorithms', credits: 4, type: 'program-core', difficulty: 4, improvementEligible: true },
      ],
    },
    placeholderSemester(3),
    placeholderSemester(4),
    placeholderSemester(5),
    placeholderSemester(6),
    placeholderSemester(7),
    placeholderSemester(8),
  ],
}
