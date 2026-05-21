import { useState } from 'react'
import { predictRequiredSGPA } from './engine/cgpa/predictRequiredSGPA.js'

function App() {
  const [currentCGPA, setCurrentCGPA] = useState(7.4)
  const [targetCGPA, setTargetCGPA] = useState(8.5)
  const [remainingSems, setRemainingSems] = useState(4)

  const result = predictRequiredSGPA({
    currentCreditPoints: currentCGPA * 100,
    currentTotalCredits: 100,
    remainingCredits: remainingSems * 25,
    targetCGPA,
    maxSGPA: 10,
  })

  const requiredSGPA = result.requiredSGPA

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>SemPilot</h1>

        <p style={styles.subtitle}>
          Academic Damage Report Engine
        </p>

        <div style={styles.inputs}>
          <input
            type="number"
            step="0.1"
            placeholder="Current CGPA"
            value={currentCGPA}
            onChange={(e) => setCurrentCGPA(Number(e.target.value))}
            style={styles.input}
          />

          <input
            type="number"
            step="0.1"
            placeholder="Target CGPA"
            value={targetCGPA}
            onChange={(e) => setTargetCGPA(Number(e.target.value))}
            style={styles.input}
          />

          <input
            type="number"
            placeholder="Remaining Semesters"
            value={remainingSems}
            onChange={(e) => setRemainingSems(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <div style={styles.stats}>
          <div style={styles.box}>
            <h2>{currentCGPA.toFixed(2)}</h2>
            <p>Current CGPA</p>
          </div>

          <div style={styles.box}>
            <h2>{targetCGPA.toFixed(2)}</h2>
            <p>Target CGPA</p>
          </div>

          <div style={styles.box}>
            <h2>
              {requiredSGPA === Infinity
                ? '∞'
                : requiredSGPA.toFixed(2)}
            </h2>
            <p>Required SGPA</p>
          </div>
        </div>

        <div
          style={{
            ...styles.status,
            background:
              !result.isAchievable
                ? '#450a0a'
                : requiredSGPA > 9
                ? '#332701'
                : '#052e16',

            color:
              !result.isAchievable
                ? '#f87171'
                : requiredSGPA > 9
                ? '#facc15'
                : '#4ade80',
          }}
        >
          {!result.isAchievable
            ? '❌ Target Impossible'
            : requiredSGPA > 9
            ? '⚠️ Moderate Recovery Needed'
            : '✅ Target Achievable'}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontFamily: 'Arial',
  },

  card: {
    width: '850px',
    background: '#111827',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 0 30px rgba(0,0,0,0.3)',
  },

  title: {
    fontSize: '48px',
    marginBottom: '10px',
  },

  subtitle: {
    color: '#94a3b8',
    marginBottom: '30px',
    fontSize: '18px',
  },

  inputs: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px',
  },

  input: {
    flex: 1,
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '16px',
    background: '#1e293b',
    color: 'white',
  },

  stats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '30px',
  },

  box: {
    flex: 1,
    background: '#1e293b',
    padding: '20px',
    borderRadius: '14px',
    textAlign: 'center',
  },

  status: {
    padding: '18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '18px',
  },
}

export default App