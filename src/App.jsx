import { useMemo, useState } from 'react'
import { nsutBranches, getUnverifiedSemesters, getUniversityPolicy } from './data/nsut/index.js'
import { planAcademicRecovery } from './engine/cgpa/academicRecoveryPlanner.js'
import {
  SUBJECT_STATUS,
  calculateCurrentCGPA,
  createAcademicProfile,
  getBacklogSubjects,
  getCurrentSemesterLoad,
  getPlannerInputsFromTranscript,
  validateAcademicProfile,
} from './state/academic/index.js'

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 980,
    background: '#111116',
    border: '1px solid #1f1f27',
    borderRadius: 16,
    padding: '36px 32px',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: '#f4f4f5',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#71717a',
    margin: '6px 0 32px',
  },
  inputs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    background: '#18181f',
    border: '1px solid #27272e',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 15,
    color: '#f4f4f5',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 11,
    color: '#52525b',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 24,
  },
  box: {
    background: '#18181f',
    border: '1px solid #1f1f27',
    borderRadius: 10,
    padding: '16px 14px',
    textAlign: 'center',
  },
  boxValue: {
    fontSize: 22,
    fontWeight: 600,
    color: '#f4f4f5',
    margin: '0 0 4px',
    lineHeight: 1,
  },
  boxLabel: {
    fontSize: 11,
    color: '#71717a',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  status: {
    borderRadius: 10,
    padding: '14px 20px',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    marginTop: 28,
    borderTop: '1px solid #1f1f27',
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 12px',
  },
  summary: {
    background: '#18181f',
    border: '1px solid #1f1f27',
    borderRadius: 10,
    padding: '14px 16px',
    color: '#e4e4e7',
    fontSize: 13,
    lineHeight: 1.6,
    margin: '0 0 14px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    padding: '8px 8px',
    borderBottom: '1px solid #27272e',
  },
  td: {
    color: '#e4e4e7',
    fontSize: 12,
    padding: '8px 8px',
    borderBottom: '1px solid #1f1f27',
    verticalAlign: 'middle',
  },
  miniInput: {
    background: '#0f0f15',
    border: '1px solid #27272e',
    borderRadius: 6,
    color: '#f4f4f5',
    fontSize: 12,
    padding: '6px 8px',
    width: '100%',
    boxSizing: 'border-box',
  },
  subjectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  subjectItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '12px 14px',
    background: '#18181f',
    border: '1px solid #1f1f27',
    borderRadius: 8,
  },
  subjectName: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: 500,
    margin: 0,
  },
  subjectMeta: {
    color: '#71717a',
    fontSize: 11,
    margin: '4px 0 0',
  },
  subjectGain: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}

const SAMPLE_GRADES = {
  FCMT001: { gradePoint: 7.5, status: SUBJECT_STATUS.CLEARED },
  FCCS002: { gradePoint: 5, status: SUBJECT_STATUS.IMPROVEMENT_CANDIDATE },
  FCEC003: { gradePoint: 0, status: SUBJECT_STATUS.BACKLOG },
  FCPH004: { gradePoint: 7, status: SUBJECT_STATUS.CLEARED },
  FCME006: { gradePoint: 6.5, status: SUBJECT_STATUS.CLEARED },
  FCHS005: { gradePoint: 8, status: SUBJECT_STATUS.CLEARED },
  FCMT007: { gradePoint: 6, status: SUBJECT_STATUS.CLEARED },
  FCCH008: { gradePoint: 5.5, status: SUBJECT_STATUS.IMPROVEMENT_CANDIDATE },
  EIECC01: { gradePoint: 6, status: SUBJECT_STATUS.CLEARED },
  EIECC02: { gradePoint: 6.5, status: SUBJECT_STATUS.CLEARED },
  EIITC03: { gradePoint: 7, status: SUBJECT_STATUS.CLEARED },
}

function makeInitialProfile({ university = 'nsut', branch = 'ECAM', currentSemester = 4 } = {}) {
  return createAcademicProfile({
    university,
    branch,
    currentSemester,
    gradeSeed: SAMPLE_GRADES,
  })
}

function StatBox({ value, label, valueColor }) {
  return (
    <div style={styles.box}>
      <h2 style={{ ...styles.boxValue, color: valueColor || '#f4f4f5' }}>{value}</h2>
      <p style={styles.boxLabel}>{label}</p>
    </div>
  )
}

function formatNumber(value, places = 2) {
  if (value === Infinity) return 'infinity'
  if (!Number.isFinite(value)) return 'N/A'
  return value.toFixed(places)
}

function normalizeGrade(value) {
  if (value === '') return null
  const next = Number(value)
  if (!Number.isFinite(next)) return null
  return Math.min(10, Math.max(0, next))
}

export default function App() {
  const [targetCGPA, setTargetCGPA] = useState(8.5)
  const [profile, setProfile] = useState(() => makeInitialProfile())

  const policy = useMemo(() => getUniversityPolicy(profile.university), [profile.university])
  const unverifiedSemesters = useMemo(() => getUnverifiedSemesters(profile.branch), [profile.branch])
  const validation = validateAcademicProfile(profile, policy)
  const transcript = getPlannerInputsFromTranscript(profile, policy)
  const currentCGPA = calculateCurrentCGPA(profile, policy)
  const backlogs = getBacklogSubjects(profile, policy)
  const currentSemesterLoad = getCurrentSemesterLoad(profile)

  const recoveryPlan = planAcademicRecovery({
    currentCGPA: currentCGPA.cgpa,
    currentCreditPoints: currentCGPA.creditPoints,
    currentTotalCredits: transcript.currentTotalCredits,
    remainingCredits: transcript.remainingCredits,
    targetCGPA,
    backlogs: transcript.backlogs,
    improvementSubjects: transcript.improvementSubjects,
    maxSGPA: policy.cgpa.maxCGPA,
    sustainableSGPA: 9.2,
  })

  const recommendedSubjects = recoveryPlan.improvementStrategy.recommendedSubjects
  const visibleRecoverySubjects = recommendedSubjects.length > 0
    ? recommendedSubjects
    : recoveryPlan.improvementStrategy.topRecoverySubjects

  function resetProfile(next = {}) {
    setProfile(makeInitialProfile({
      university: next.university ?? profile.university,
      branch: next.branch ?? profile.branch,
      currentSemester: next.currentSemester ?? profile.currentSemester,
    }))
  }

  function updateSubject(semesterNumber, code, patch) {
    setProfile((current) => ({
      ...current,
      semesters: current.semesters.map((semester) => {
        if (semester.semesterNumber !== semesterNumber) return semester

        return {
          ...semester,
          subjects: semester.subjects.map((subject) =>
            subject.code === code ? { ...subject, ...patch } : subject
          ),
        }
      }),
    }))
  }

  const statusConfig = (() => {
    if (!recoveryPlan.engineResults.sgpaPrediction.isAchievable)
      return { bg: '#1f0707', color: '#f87171', text: 'Target is mathematically impossible' }
    if (recoveryPlan.engineResults.sgpaPrediction.alreadyAchieved)
      return { bg: '#071f10', color: '#4ade80', text: 'You have already hit your target' }
    if (recoveryPlan.requiredSGPA > 9.5)
      return { bg: '#1f1307', color: '#fb923c', text: 'Extremely high recovery needed (> 9.5 SGPA)' }
    if (recoveryPlan.requiredSGPA > 8.5)
      return { bg: '#1f1a07', color: '#facc15', text: 'High recovery needed - stay focused' }
    return { bg: '#071f10', color: '#4ade80', text: 'Target is within a stable planning range' }
  })()

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>SemPilot</h1>
        <p style={styles.subtitle}>NSUT-aware academic recovery intelligence</p>

        <div style={styles.inputs}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>University</label>
            <select
              value={profile.university}
              onChange={(event) => resetProfile({ university: event.target.value })}
              style={styles.input}
            >
              <option value="nsut">NSUT</option>
            </select>
            <span style={styles.hint}>Policy layer</span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Branch</label>
            <select
              value={profile.branch}
              onChange={(event) => resetProfile({ branch: event.target.value })}
              style={styles.input}
            >
              {Object.values(nsutBranches).map((branch) => (
                <option key={branch.code} value={branch.code}>{branch.code}</option>
              ))}
            </select>
            <span style={styles.hint}>Curriculum layer</span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Current semester</label>
            <select
              value={profile.currentSemester}
              onChange={(event) => resetProfile({ currentSemester: Number(event.target.value) })}
              style={styles.input}
            >
              {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>
            <span style={styles.hint}>{currentSemesterLoad} credits loaded</span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Target CGPA</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={targetCGPA}
              onChange={(event) => setTargetCGPA(Math.min(10, Math.max(0, Number(event.target.value))))}
              style={styles.input}
            />
            <span style={styles.hint}>Recovery goal</span>
          </div>
        </div>

        <div style={styles.stats}>
          <StatBox value={formatNumber(currentCGPA.cgpa)} label="Current CGPA" />
          <StatBox value={targetCGPA.toFixed(2)} label="Target CGPA" />
          <StatBox
            value={formatNumber(recoveryPlan.requiredSGPA)}
            label="Required SGPA"
            valueColor={recoveryPlan.requiredSGPA > 9 ? '#fb923c' : '#facc15'}
          />
          <StatBox value={transcript.currentTotalCredits} label="Completed credits" />
          <StatBox value={transcript.remainingCredits} label="Remaining credits" />
          <StatBox
            value={backlogs.length}
            label="Active backlogs"
            valueColor={backlogs.length > 0 ? '#f87171' : '#4ade80'}
          />
          <StatBox
            value={transcript.improvementSubjects.length}
            label="Improvement candidates"
            valueColor={transcript.improvementSubjects.length > 0 ? '#facc15' : '#4ade80'}
          />
          <StatBox
            value={recoveryPlan.recoveryPressure}
            label="Recovery pressure"
            valueColor={
              recoveryPlan.recoveryPressure === 'extreme' ? '#f87171'
              : recoveryPlan.recoveryPressure === 'high' ? '#fb923c'
              : '#4ade80'
            }
          />
        </div>

        <div style={{ ...styles.status, background: statusConfig.bg, color: statusConfig.color }}>
          {statusConfig.text}
        </div>

        {unverifiedSemesters.length > 0 && (
          <p style={{ ...styles.summary, color: '#facc15', marginTop: 12 }}>
            Curriculum beyond verified semesters is provisional.
          </p>
        )}

        {!validation.valid && (
          <p style={{ ...styles.summary, color: '#f87171' }}>
            {validation.errors.join(' ')}
          </p>
        )}

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Academic Onboarding Transcript</p>
          {profile.semesters.map((semester) => (
            <div key={semester.semesterNumber} style={{ marginBottom: 20 }}>
              <p style={styles.sectionTitle}>
                Semester {semester.semesterNumber}
                {!semester.verified ? ' - provisional placeholder' : ''}
              </p>
              {semester.subjects.length === 0 && (
                <p style={styles.summary}>
                  This semester is marked as provisional until verified from official NSUT ECAM documents.
                </p>
              )}
              {semester.subjects.length > 0 && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Subject</th>
                    <th style={styles.th}>Cr</th>
                    <th style={styles.th}>Grade</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {semester.subjects.map((subject) => (
                    <tr key={subject.code}>
                      <td style={styles.td}>{subject.code}</td>
                      <td style={styles.td}>
                        {subject.name}
                        <div style={styles.hint}>
                          {subject.type} | improvement {subject.improvementEligible ? 'eligible' : 'locked'}
                        </div>
                      </td>
                      <td style={styles.td}>{subject.credits}</td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={subject.gradePoint ?? ''}
                          onChange={(event) => updateSubject(semester.semesterNumber, subject.code, {
                            gradePoint: normalizeGrade(event.target.value),
                          })}
                          style={styles.miniInput}
                        />
                      </td>
                      <td style={styles.td}>
                        <select
                          value={subject.status}
                          onChange={(event) => updateSubject(semester.semesterNumber, subject.code, {
                            status: event.target.value,
                            gradePoint: event.target.value === SUBJECT_STATUS.BACKLOG ? 0 : subject.gradePoint,
                          })}
                          style={styles.miniInput}
                        >
                          {Object.values(SUBJECT_STATUS).map((status) => (
                            <option
                              key={status}
                              value={status}
                              disabled={status === SUBJECT_STATUS.IMPROVEMENT_CANDIDATE && !subject.improvementEligible}
                            >
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          ))}
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Strategic Improvement Recommendations</p>
          <p style={styles.summary}>{recoveryPlan.masterStrategicSummary}</p>

          <div style={styles.stats}>
            <StatBox
              value={recommendedSubjects.length}
              label="Recommended reattempts"
              valueColor={recommendedSubjects.length > 0 ? '#facc15' : '#4ade80'}
            />
            <StatBox
              value={`+${formatNumber(recoveryPlan.improvementStrategy.estimatedCGPAGain ?? 0, 3)}`}
              label="Projected CGPA gain"
              valueColor="#4ade80"
            />
            <StatBox
              value={recoveryPlan.improvementStrategy.recommendedTargetGrade
                ? recoveryPlan.improvementStrategy.recommendedTargetGrade.toFixed(1)
                : 'N/A'}
              label="Target grade"
            />
            <StatBox
              value={formatNumber(recoveryPlan.projectedFinalCGPA)}
              label="Projected final CGPA"
              valueColor="#4ade80"
            />
          </div>

          <div style={styles.subjectList}>
            {visibleRecoverySubjects.map((candidate) => (
              <div key={candidate.subject.id} style={styles.subjectItem}>
                <div>
                  <p style={styles.subjectName}>{candidate.subject.name}</p>
                  <p style={styles.subjectMeta}>
                    Current {candidate.oldGradePoint.toFixed(1)} to target {candidate.targetGrade.toFixed(1)}
                    {' | '}
                    {candidate.subject.credits} credits
                  </p>
                </div>
                <span style={styles.subjectGain}>+{candidate.cgpaGainPotential.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
