/**
 * SemPilot Engine — Test Suite
 *
 * Run with:  node engine.test.js
 * No framework needed. Pure Node.js assertions.
 *
 * Covers every edge case documented in the spec:
 * - impossible CGPA
 * - already achieved target
 * - zero credits
 * - backlog overload
 * - semester overflow (remaining = 0)
 * - NaN / bad inputs
 */

import process                                                 from 'node:process';
import { calculateCGPA }                                       from './calculateCGPA.js';
import { predictRequiredSGPA, projectCGPATrend }               from './predictRequiredSGPA.js';
import { computeFeasibility }                                   from './feasibilityEngine.js';
import { analyzeBacklogs, generateRecoveryRoadmap }            from './backlogRecoveryEngine.js';
import { analyzeImprovementReattempts }                         from './improvementReattemptEngine.js';
import { planAcademicRecovery }                                  from './academicRecoveryPlanner.js';

// ─── tiny test harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },

    toContain: (value) => {
     if (!actual.includes(value))
       throw new Error(
         `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(value)}`
      );
    },
    
    toBeCloseTo: (expected, dp = 2) => {
      const diff = Math.abs(actual - expected);
      const tol  = 0.5 * Math.pow(10, -dp);
      if (diff > tol)
        throw new Error(`Expected ~${expected} (±${tol}), got ${actual}`);
    },
    toBeGreaterThan: (n) => {
      if (actual <= n) throw new Error(`Expected > ${n}, got ${actual}`);
    },
    toBeLessThan: (n) => {
      if (actual >= n) throw new Error(`Expected < ${n}, got ${actual}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
  };
}

// ─── calculateCGPA ──────────────────────────────────────────────────────────
console.log('\n── calculateCGPA ───────────────────────────────────────────');

test('standard 3-semester case', () => {
  const semesters = [
    { sgpa: 8.0, totalCredits: 22, isCompleted: true },
    { sgpa: 7.5, totalCredits: 24, isCompleted: true },
    { sgpa: 8.5, totalCredits: 26, isCompleted: true },
  ];
  const { cgpa, totalCredits } = calculateCGPA(semesters);
  // (8×22 + 7.5×24 + 8.5×26) / 72 = (176+180+221)/72 = 577/72 = 8.01
  expect(cgpa).toBeCloseTo(8.01, 2);
  expect(totalCredits).toBe(72);
});

test('empty array returns zeros', () => {
  const { cgpa, totalCredits } = calculateCGPA([]);
  expect(cgpa).toBe(0);
  expect(totalCredits).toBe(0);
});

test('ignores incomplete semesters', () => {
  const semesters = [
    { sgpa: 9.0, totalCredits: 22, isCompleted: true  },
    { sgpa: 6.0, totalCredits: 24, isCompleted: false }, // should be ignored
  ];
  const { cgpa, totalCredits } = calculateCGPA(semesters);
  expect(cgpa).toBe(9.0);
  expect(totalCredits).toBe(22);
});

test('ignores zero-credit semesters', () => {
  const semesters = [
    { sgpa: 8.0, totalCredits: 0,  isCompleted: true },
    { sgpa: 7.0, totalCredits: 20, isCompleted: true },
  ];
  const { cgpa } = calculateCGPA(semesters);
  expect(cgpa).toBe(7.0);
});

test('handles NaN inputs gracefully', () => {
  const semesters = [
    { sgpa: NaN,  totalCredits: 22, isCompleted: true },
    { sgpa: 8.0,  totalCredits: 22, isCompleted: true },
  ];
  const { cgpa } = calculateCGPA(semesters);
  expect(cgpa).toBe(8.0); // NaN semester filtered out
});

// ─── predictRequiredSGPA ────────────────────────────────────────────────────
console.log('\n── predictRequiredSGPA ─────────────────────────────────────');

test('standard case: 7.4 CGPA, target 8.5, 3 sems remaining', () => {
  // Student: 120 credits, 7.4 CGPA → CPs = 888
  // Remaining: 78 credits (3 × 26)
  // Required: (8.5 × 198 - 888) / 78 = (1683 - 888) / 78 = 795/78 = 10.19 → impossible
  const result = predictRequiredSGPA({
    currentCreditPoints: 888,
    currentTotalCredits: 120,
    remainingCredits:    78,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(result.requiredSGPA).toBeGreaterThan(10);
  expect(result.isAchievable).toBeFalsy();
  expect(result.alreadyAchieved).toBeFalsy();
});

test('achievable case: 8.0 CGPA, target 8.5, 4 sems remaining', () => {
  // CPs = 8.0 × 100 = 800; remaining = 104; total = 204
  // Required = (8.5 × 204 - 800) / 104 = (1734 - 800) / 104 = 8.98
  const result = predictRequiredSGPA({
    currentCreditPoints: 800,
    currentTotalCredits: 100,
    remainingCredits:    104,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(result.requiredSGPA).toBeCloseTo(8.98, 1);
  expect(result.isAchievable).toBeTruthy();
});

test('already achieved target', () => {
  const result = predictRequiredSGPA({
    currentCreditPoints: 900,
    currentTotalCredits: 100,
    remainingCredits:    50,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(result.alreadyAchieved).toBeTruthy();
  expect(result.requiredSGPA).toBe(0);
  expect(result.surplusOrDeficit).toBeGreaterThan(0);
});

test('zero credits completed — fresh student', () => {
  const result = predictRequiredSGPA({
    currentCreditPoints: 0,
    currentTotalCredits: 0,
    remainingCredits:    200,
    targetCGPA:          8.0,
    maxSGPA:             10,
  });
  expect(result.requiredSGPA).toBe(8.0);
  expect(result.isAchievable).toBeTruthy();
});

test('zero remaining credits — already done', () => {
  const result = predictRequiredSGPA({
    currentCreditPoints: 800,
    currentTotalCredits: 100,
    remainingCredits:    0,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  // Final CGPA = 8.0, target 8.5 → not achieved
  expect(result.isAchievable).toBeFalsy();
  expect(result.requiredSGPA).toBe(Infinity);
});

// ─── computeFeasibility ─────────────────────────────────────────────────────
console.log('\n── computeFeasibility ──────────────────────────────────────');

test('impossible returns score 0 and red color', () => {
  const result = computeFeasibility({
    currentCreditPoints: 600,
    currentTotalCredits: 100,
    remainingCredits:    26,
    targetCGPA:          9.5,
    maxSGPA:             10,
  });
  expect(result.verdict).toBe('impossible');
  expect(result.score).toBe(0);
  expect(result.color).toBe('red');
  expect(result.isAchievable).toBeFalsy();
});

test('achievable returns green color and score > 50', () => {
  const result = computeFeasibility({
    currentCreditPoints: 840,
    currentTotalCredits: 100,
    remainingCredits:    104,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(result.color).toBe('green');
  expect(result.score).toBeGreaterThan(50);
  expect(result.isAchievable).toBeTruthy();
});

test('already_achieved gives 100 score', () => {
  const result = computeFeasibility({
    currentCreditPoints: 900,
    currentTotalCredits: 100,
    remainingCredits:    50,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(result.verdict).toBe('already_achieved');
  expect(result.score).toBe(100);
  expect(result.alreadyAchieved).toBeTruthy();
});

test('headline and subtext are non-empty strings', () => {
  const result = computeFeasibility({
    currentCreditPoints: 750,
    currentTotalCredits: 100,
    remainingCredits:    78,
    targetCGPA:          8.5,
    maxSGPA:             10,
  });
  expect(typeof result.headline).toBe('string');
  expect(typeof result.subtext).toBe('string');
  expect(result.headline.length).toBeGreaterThan(0);
});

// ─── analyzeBacklogs ────────────────────────────────────────────────────────
console.log('\n── analyzeBacklogs ─────────────────────────────────────────');

const sampleBacklogs = [
  { id: 'b1', name: 'Signals & Systems', credits: 4, currentGradePoint: 0, expectedGradePoint: 6, semesterNumber: 3 },
  { id: 'b2', name: 'Engineering Maths', credits: 3, currentGradePoint: 0, expectedGradePoint: 7, semesterNumber: 2 },
  { id: 'b3', name: 'Physics Lab',       credits: 1, currentGradePoint: 0, expectedGradePoint: 8, semesterNumber: 1 },
];

test('no backlogs returns damage score 0', () => {
  const result = analyzeBacklogs({
    backlogs:            [],
    currentCreditPoints: 750,
    totalCredits:        100,
    remainingCredits:    50,
  });
  expect(result.damageScore).toBe(0);
  expect(result.damageLevel).toBe('low');
  expect(result.prioritized.length).toBe(0);
});

test('prioritizes highest CGPA-impact backlog first', () => {
  const result = analyzeBacklogs({
    backlogs:            sampleBacklogs,
    currentCreditPoints: 750,
    totalCredits:        100,
    remainingCredits:    50,
  });
  // b1: impact = (6-0)*4/100 = 0.24
  // b2: impact = (7-0)*3/100 = 0.21
  // b3: impact = (8-0)*1/100 = 0.08
  expect(result.prioritized[0].subject.id).toBe('b1');
  expect(result.prioritized[0].cgpaImpactIfCleared).toBeCloseTo(0.24, 2);
  expect(result.prioritized[0].priority).toBe(1);
});

test('cgpaLossFromBacklogs is correct', () => {
  const result = analyzeBacklogs({
    backlogs:            sampleBacklogs,
    currentCreditPoints: 750,
    totalCredits:        100,
    remainingCredits:    50,
  });
  // Total CP gain = 24+21+8 = 53; loss = 53/100 = 0.53
  expect(result.cgpaLossFromBacklogs).toBeCloseTo(0.53, 2);
});

test('recovery roadmap steps equal backlog count', () => {
  const analysis = analyzeBacklogs({
    backlogs:            sampleBacklogs,
    currentCreditPoints: 750,
    totalCredits:        100,
    remainingCredits:    50,
  });
  const roadmap = generateRecoveryRoadmap({
    prioritized:         analysis.prioritized,
    currentCreditPoints: 750,
    totalCredits:        100,
  });
  expect(roadmap.length).toBe(sampleBacklogs.length);
  // Each step CGPA should be higher than the previous
  for (let i = 1; i < roadmap.length; i++) {
    expect(roadmap[i].projectedCGPA).toBeGreaterThan(roadmap[i - 1].projectedCGPA);
  }
});

test('backlog overload scenario flags as high/critical damage', () => {
  // Student with 8 backlogs across 4 semesters
  const heavyBacklogs = Array.from({ length: 8 }, (_, i) => ({
    id: `b${i}`,
    name: `Subject ${i}`,
    credits: 4,
    currentGradePoint: 0,
    expectedGradePoint: 5,
    semesterNumber: Math.ceil((i + 1) / 2),
  }));
  const result = analyzeBacklogs({
    backlogs:            heavyBacklogs,
    currentCreditPoints: 600,
    totalCredits:        100,
    remainingCredits:    80,
  });
  expect(['high', 'critical']).toContain(result.damageLevel);
});

console.log('\n-- analyzeImprovementReattempts --');

const clearedLowGradeSubjects = [
  { id: 's1', name: 'Mathematics II', credits: 4, currentGradePoint: 5 },
  { id: 's2', name: 'Basic Electronics', credits: 3, currentGradePoint: 6 },
  { id: 's3', name: 'Engineering Chemistry', credits: 4, currentGradePoint: 6 },
  { id: 's4', name: 'Workshop', credits: 2, currentGradePoint: 7 },
  { id: 's5', name: 'Data Structures', credits: 4, currentGradePoint: 8 },
];

test('improvement engine calculates credit-point deficit toward target CGPA', () => {
  const result = analyzeImprovementReattempts({
    subjects:                   clearedLowGradeSubjects,
    currentCreditPoints:        820,
    currentTotalCredits:        100,
    targetCGPA:                 8.5,
    expectedImprovedGradePoint: 8,
  });

  expect(result.creditPointDeficit).toBe(30);
});

test('improvement engine calculates strategic priority scores', () => {
  const result = analyzeImprovementReattempts({
    subjects:                   clearedLowGradeSubjects,
    currentCreditPoints:        820,
    currentTotalCredits:        100,
    targetCGPA:                 8.5,
    expectedImprovedGradePoint: 8,
  });

  expect(result.candidates[0].recoveryPriorityScore).toBeGreaterThan(0);
  expect(result.candidates[0].cgpaGainPotential).toBeGreaterThan(0);
  expect(result.candidates[0].improvementEfficiency).toBeGreaterThan(0);
  expect(result.candidates[0].creditPointGain).toBeGreaterThan(result.candidates[3].creditPointGain);
});

test('improvement engine marks impossible when eligible gains cannot close gap', () => {
  const result = analyzeImprovementReattempts({
    subjects:                   clearedLowGradeSubjects,
    currentCreditPoints:        820,
    currentTotalCredits:        100,
    targetCGPA:                 8.5,
    expectedImprovedGradePoint: 8,
  });

  expect(result.minimumReattemptsNeeded).toBe(Infinity);
  expect(result.achievableWithImprovements).toBeFalsy();
});

test('improvement engine returns selected minimum plan when gap can close', () => {
  const result = analyzeImprovementReattempts({
    subjects:                   clearedLowGradeSubjects,
    currentCreditPoints:        829,
    currentTotalCredits:        100,
    targetCGPA:                 8.5,
    expectedImprovedGradePoint: 8,
  });

  expect(result.minimumReattemptsNeeded).toBe(3);
  expect(result.selectedReattempts.length).toBe(3);
  expect(result.recoveredCreditPoints).toBe(26);
  expect(result.projectedCGPAAfterImprovements).toBeCloseTo(8.55, 2);
});

test('improvement engine returns structured strategic recommendation output', () => {
  const result = analyzeImprovementReattempts({
    subjects:                   clearedLowGradeSubjects,
    currentCreditPoints:        829,
    currentTotalCredits:        100,
    targetCGPA:                 8.5,
    expectedImprovedGradePoint: 8,
  });

  expect(Array.isArray(result.recommendedReattempts)).toBeTruthy();
  expect(Array.isArray(result.topRecoverySubjects)).toBeTruthy();
  expect(result.feasibilityBefore.projectedFinalCGPA).toBe(8.29);
  expect(result.feasibilityAfter.projectedFinalCGPA).toBeCloseTo(8.55, 2);
  expect(result.projectedCGPAGain).toBeCloseTo(0.26, 2);
  expect(typeof result.strategicSummary).toBe('string');
});

test('improvement engine dynamically raises target grade for high CGPA targets', () => {
  const moderate = analyzeImprovementReattempts({
    subjects:              clearedLowGradeSubjects,
    currentCreditPoints:   760,
    currentTotalCredits:   100,
    targetCGPA:            7.8,
  });
  const aggressive = analyzeImprovementReattempts({
    subjects:              clearedLowGradeSubjects,
    currentCreditPoints:   760,
    currentTotalCredits:   100,
    targetCGPA:            8.7,
  });

  expect(moderate.recommendedTargetGrade).toBeLessThan(aggressive.recommendedTargetGrade);
  expect(aggressive.recommendedTargetGrade).toBeGreaterThan(8);
});

test('improvement engine handles impossible recovery', () => {
  const result = analyzeImprovementReattempts({
    subjects:              clearedLowGradeSubjects,
    currentCreditPoints:   650,
    currentTotalCredits:   100,
    targetCGPA:            9.5,
  });

  expect(result.achievableWithImprovements).toBeFalsy();
  expect(result.minimumReattemptsNeeded).toBe(Infinity);
  expect(result.pressureLevel).toBe('extreme');
});

test('improvement engine handles low-credit edge cases', () => {
  const result = analyzeImprovementReattempts({
    subjects: [
      { id: 'lab1', name: 'Mini Project Lab', credits: 1, currentGradePoint: 5, difficulty: 1 },
      { id: 'lab2', name: 'Workshop Lab', credits: 1, currentGradePoint: 6, difficulty: 1 },
    ],
    currentCreditPoints:   698,
    currentTotalCredits:   100,
    targetCGPA:            7,
  });

  expect(result.minimumReattemptsNeeded).toBe(2);
  expect(result.topRecoverySubjects[0].subject.credits).toBe(1);
  expect(result.feasibilityAfter.isTargetMet).toBeTruthy();
});

test('improvement engine handles insufficient subjects', () => {
  const result = analyzeImprovementReattempts({
    subjects: [
      { id: 'only', name: 'Small Elective', credits: 1, currentGradePoint: 7 },
    ],
    currentCreditPoints:   700,
    currentTotalCredits:   100,
    targetCGPA:            8,
  });

  expect(result.achievableWithImprovements).toBeFalsy();
  expect(result.remainingDeficit).toBeGreaterThan(0);
});

test('improvement engine handles already-achieved targets', () => {
  const result = analyzeImprovementReattempts({
    subjects:              clearedLowGradeSubjects,
    currentCreditPoints:   860,
    currentTotalCredits:   100,
    targetCGPA:            8.5,
  });

  expect(result.minimumReattemptsNeeded).toBe(0);
  expect(result.recommendedReattempts.length).toBe(0);
  expect(result.feasibilityBefore.isTargetMet).toBeTruthy();
  expect(result.pressureLevel).toBe('low');
});

console.log('\n-- planAcademicRecovery --');

const improvementPool = [
  { id: 'i1', name: 'Physics', credits: 4, currentGradePoint: 5, difficulty: 2 },
  { id: 'i2', name: 'Chemistry', credits: 4, currentGradePoint: 6, difficulty: 2 },
  { id: 'i3', name: 'DSA', credits: 3, currentGradePoint: 6, difficulty: 3 },
  { id: 'i4', name: 'Workshop', credits: 2, currentGradePoint: 7, difficulty: 1 },
];

test('recovery planner handles target achievable without reattempts', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          8.3,
    currentTotalCredits:  100,
    remainingCredits:     100,
    targetCGPA:           8.4,
    improvementSubjects:  improvementPool,
  });

  expect(plan.targetAchievable).toBeTruthy();
  expect(plan.improvementStrategy.required).toBeFalsy();
  expect(plan.recoveryMode).toBe('stable');
  expect(plan.futureSemesterPlan.isStrategicallyEnough).toBeTruthy();
});

test('recovery planner recommends strategic reattempts when future-only plan is too hard', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          7.6,
    currentTotalCredits:  100,
    remainingCredits:     100,
    targetCGPA:           8.0,
    improvementSubjects:  improvementPool,
    sustainableSGPA:      8.2,
  });

  expect(plan.futureSemesterPlan.isStrategicallyEnough).toBeFalsy();
  expect(plan.improvementStrategy.required).toBeTruthy();
  expect(plan.improvementStrategy.recommendedSubjects.length).toBeGreaterThan(0);
  expect(plan.projectedFinalCGPA).toBeGreaterThan(plan.futureSemesterPlan.projectedFinalCGPA);
  expect(['recovery', 'aggressive']).toContain(plan.recoveryMode);
});

test('recovery planner handles impossible recovery', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          6.0,
    currentTotalCredits:  150,
    remainingCredits:     20,
    targetCGPA:           9.2,
    improvementSubjects:  improvementPool,
  });

  expect(plan.targetAchievable).toBeFalsy();
  expect(plan.recoveryMode).toBe('mathematically unstable');
  expect(plan.recoveryPressure).toBe('extreme');
});

test('recovery planner separates backlog-heavy recovery impact', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          7.2,
    currentTotalCredits:  100,
    remainingCredits:     80,
    targetCGPA:           8.0,
    backlogs: [
      { id: 'b1', name: 'Signals', credits: 4, currentGradePoint: 0, expectedGradePoint: 6 },
      { id: 'b2', name: 'Maths', credits: 4, currentGradePoint: 0, expectedGradePoint: 6 },
      { id: 'b3', name: 'Mechanics', credits: 3, currentGradePoint: 0, expectedGradePoint: 6 },
    ],
    improvementSubjects:  improvementPool,
    sustainableSGPA:      8.0,
  });

  expect(plan.backlogRecovery.remainingBacklogs).toBe(3);
  expect(plan.backlogRecovery.projectedGain).toBeGreaterThan(0);
  expect(plan.engineResults.backlogAnalysis.prioritized.length).toBe(3);
});

test('recovery planner handles low remaining credit scenarios', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          7.0,
    currentTotalCredits:  150,
    remainingCredits:     10,
    targetCGPA:           8.0,
    improvementSubjects:  improvementPool,
  });

  expect(plan.futureSemesterPlan.isMathematicallyEnough).toBeFalsy();
  expect(plan.recoveryMode).toBe('mathematically unstable');
  expect(plan.creditPointDeficitAfterFutureAndBacklogs).toBeGreaterThan(0);
});

test('recovery planner handles already-achieved targets', () => {
  const plan = planAcademicRecovery({
    currentCGPA:          8.8,
    currentTotalCredits:  100,
    remainingCredits:     50,
    targetCGPA:           8.5,
    improvementSubjects:  improvementPool,
  });

  expect(plan.targetAchievable).toBeTruthy();
  expect(plan.requiredSGPA).toBe(0);
  expect(plan.recoveryMode).toBe('stable');
  expect(plan.improvementStrategy.required).toBeFalsy();
});

// ─── projectCGPATrend ───────────────────────────────────────────────────────
console.log('\n── projectCGPATrend ────────────────────────────────────────');

test('projection has correct length', () => {
  const trend = projectCGPATrend({
    currentCreditPoints: 800,
    currentTotalCredits: 100,
    creditsPerSemester:  26,
    remainingSemesters:  4,
    assumedSGPA:         8.5,
  });
  expect(trend.length).toBe(4);
});

test('projection with assumedSGPA above current CGPA trends upward', () => {
  // currentCGPA = 800/100 = 8.0, assumed 9.0 → should rise
  const trend = projectCGPATrend({
    currentCreditPoints: 800,
    currentTotalCredits: 100,
    creditsPerSemester:  25,
    remainingSemesters:  3,
    assumedSGPA:         9.0,
  });
  for (let i = 1; i < trend.length; i++) {
    expect(trend[i].projectedCGPA).toBeGreaterThan(trend[i - 1].projectedCGPA);
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────────────────────────');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
