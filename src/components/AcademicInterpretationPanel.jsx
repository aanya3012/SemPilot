/**
 * AcademicInterpretationPanel
 *
 * Pure presentational component.
 * No engine calls. No state. No side effects.
 * Receives one prop: `report` — the object from buildInterpretationReport().
 *
 * Handles three special states via conditional rendering:
 *   1. alreadyAchieved  — target CGPA already met
 *   2. impossible       — target mathematically unreachable
 *   3. no backlogs      — backlog sections hidden cleanly
 *
 * Tailwind only. Uses base utility classes — no arbitrary values, no JIT.
 */

// ─────────────────────────────────────────────────────────────────
// UTILITY HELPERS (pure, no hooks)
// ─────────────────────────────────────────────────────────────────

/** Clamp a number for display. Returns '—' if not a finite number. */
function fmt(n, decimals = 2) {
  if (n === null || n === undefined || !isFinite(n)) return '—'
  return Number(n).toFixed(decimals)
}

/** Returns Tailwind text-color class based on SGPA value. */
function sgpaColor(sgpa) {
  if (!isFinite(sgpa) || sgpa > 10) return 'text-red-400'
  if (sgpa > 9.0) return 'text-orange-400'
  if (sgpa > 8.0) return 'text-yellow-400'
  return 'text-green-400'
}

/** Returns Tailwind text-color class based on damage level string. */
function damageLevelColor(level) {
  switch (level) {
    case 'critical': return 'text-red-400'
    case 'high':     return 'text-orange-400'
    case 'medium':   return 'text-yellow-400'
    default:         return 'text-green-400'
  }
}

/** Returns Tailwind border + bg class for damage level badge. */
function damageLevelBadgeClass(level) {
  switch (level) {
    case 'critical': return 'bg-red-950 border-red-800 text-red-400'
    case 'high':     return 'bg-orange-950 border-orange-800 text-orange-400'
    case 'medium':   return 'bg-yellow-950 border-yellow-800 text-yellow-400'
    default:         return 'bg-green-950 border-green-800 text-green-400'
  }
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

/** Section wrapper with consistent label style. */
function Section({ label, children }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        {label}
      </p>
      {children}
    </div>
  )
}

/** Horizontal rule between sections. */
function Divider() {
  return <hr className="border-zinc-800 my-6" />
}

/** Single metric card in a grid. */
function MetricCard({ value, label, valueClass = 'text-zinc-100' }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className={`text-2xl font-semibold leading-none mb-1.5 ${valueClass}`}>
        {value}
      </div>
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
    </div>
  )
}

/** Labeled text row used in the interpretation summary. */
function SummaryRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-2.5 border-b border-zinc-800 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 w-40 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-zinc-300 leading-relaxed flex-1">
        {value}
      </span>
    </div>
  )
}

/** Numbered action item row. */
function ActionItem({ index, text }) {
  return (
    <li className="flex gap-3 items-start bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
      <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0 mt-0.5 font-medium">
        {index + 1}
      </span>
      <span className="text-sm text-zinc-300 leading-relaxed">{text}</span>
    </li>
  )
}

/** A detail block with an inner label — used for assumption notes. */
function DetailBlock({ title, body }) {
  if (!body) return null
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
          {title}
        </p>
      )}
      <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SPECIAL STATE BANNERS
// ─────────────────────────────────────────────────────────────────

function AlreadyAchievedBanner({ summary }) {
  return (
    <div className="bg-green-950 border border-green-800 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
      <span className="text-green-400 text-lg leading-none mt-0.5">✓</span>
      <div>
        <p className="text-sm font-semibold text-green-400 mb-1">Target already achieved</p>
        <p className="text-sm text-green-600 leading-relaxed">
          {summary?.interpretationLine || 'Your current CGPA meets or exceeds your target.'}
        </p>
      </div>
    </div>
  )
}

function ImpossibleBanner({ summary, sgpaInterpretation }) {
  return (
    <div className="bg-red-950 border border-red-800 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
      <span className="text-red-400 text-lg leading-none mt-0.5">✕</span>
      <div>
        <p className="text-sm font-semibold text-red-400 mb-1">Target is mathematically unreachable</p>
        <p className="text-sm text-red-600 leading-relaxed">
          {sgpaInterpretation?.detail || summary?.interpretationLine || 'Even scoring the maximum SGPA in every remaining semester cannot reach your target CGPA.'}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function AcademicInterpretationPanel({ report }) {

  // ── Guard: null/undefined report ──────────────────────────────
  if (!report || typeof report !== 'object') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <p className="text-sm text-zinc-500">Report not available. Enter your details above.</p>
      </div>
    )
  }

  // ── Destructure with safe fallbacks ───────────────────────────
  const {
    sgpaInterpretation = {},
    backlogCoupling    = {},
    subjectRequirements = [],
    summary            = {},
  } = report

  const {
    requiredSGPA        = 0,
    remainingCredits    = 0,
    requiredCreditPoints = 0,
    creditPointGap      = 0,
    detail: sgpaDetail  = '',
  } = sgpaInterpretation

  const {
    backlogCount           = 0,
    backlogCredits         = 0,
    baselineRecoveryGP     = 6,
    safeRecoveryGP         = 7.5,
    cgpaGainAtBaseline     = 0,
    cgpaGainAtSafeLevel    = 0,
    cgpaGainAtPerfect      = 0,
    effectiveSGPAAfterClear = 0,
    couplingVerdict        = '',
    baselineAssumptionNote = '',
    safeRecoveryNote       = '',
  } = backlogCoupling

  const {
    requiredSGPALine      = '',
    remainingCreditsLine  = '',
    interpretationLine    = '',
    backlogRequirementLine = '',
    performanceLine       = '',
    assumptionLine        = '',
    actionItems           = [],
  } = summary

  // ── Derive render flags ────────────────────────────────────────
  const isAlreadyAchieved = requiredSGPA === 0 && isFinite(requiredSGPA)
  const isImpossible      = !isFinite(requiredSGPA) || requiredSGPA > 10
  const hasBacklogs       = backlogCount > 0
  const hasSubjectReqs    = subjectRequirements.length > 0

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 font-sans">

      {/* ── SPECIAL STATE: Already achieved ── */}
      {isAlreadyAchieved && <AlreadyAchievedBanner summary={summary} />}

      {/* ── SPECIAL STATE: Impossible ── */}
      {isImpossible && !isAlreadyAchieved && (
        <ImpossibleBanner summary={summary} sgpaInterpretation={sgpaInterpretation} />
      )}

      {/* ── SECTION 1: Key metrics grid ── */}
      <Section label="Recovery metrics">
        <div className="grid grid-cols-3 gap-3">

          <MetricCard
            value={isImpossible && !isAlreadyAchieved ? '∞' : fmt(requiredSGPA)}
            label="Required SGPA"
            valueClass={isAlreadyAchieved ? 'text-green-400' : sgpaColor(requiredSGPA)}
          />

          <MetricCard
            value={remainingCredits}
            label="Remaining credits"
          />

          <MetricCard
            value={isImpossible && !isAlreadyAchieved ? '—' : fmt(requiredCreditPoints, 0)}
            label="Credit-points needed"
          />

          <MetricCard
            value={hasBacklogs ? backlogCount : '—'}
            label="Backlog subjects"
            valueClass={hasBacklogs
              ? (backlogCount > 3 ? 'text-red-400' : 'text-orange-400')
              : 'text-zinc-500'}
          />

          <MetricCard
            value={hasBacklogs ? `${backlogCredits} cr` : '—'}
            label="Backlog credits"
            valueClass={hasBacklogs ? 'text-orange-400' : 'text-zinc-500'}
          />

          <MetricCard
            value={hasBacklogs && isFinite(effectiveSGPAAfterClear) && effectiveSGPAAfterClear <= 10
              ? fmt(effectiveSGPAAfterClear)
              : '—'}
            label="SGPA after clearing"
            valueClass={hasBacklogs && isFinite(effectiveSGPAAfterClear) && effectiveSGPAAfterClear <= 10
              ? sgpaColor(effectiveSGPAAfterClear)
              : 'text-zinc-500'}
          />

        </div>
      </Section>

      <Divider />

      {/* ── SECTION 2: Structured interpretation ── */}
      <Section label="Interpretation">
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <SummaryRow label="Required SGPA"       value={requiredSGPALine} />
          <SummaryRow label="Remaining credits"   value={remainingCreditsLine} />
          <SummaryRow label="What this means"     value={interpretationLine} />
          {hasBacklogs && (
            <SummaryRow label="Backlogs"          value={backlogRequirementLine} />
          )}
          {hasBacklogs && (
            <SummaryRow label="Performance target" value={performanceLine} />
          )}
        </div>

        {/* SGPA → credit detail block (only shown when target is achievable) */}
        {!isImpossible && !isAlreadyAchieved && sgpaDetail && (
          <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              How this is calculated
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">{sgpaDetail}</p>
          </div>
        )}
      </Section>

      <Divider />

      {/* ── SECTION 3: Backlog analysis (hidden when no backlogs) ── */}
      {hasBacklogs ? (
        <>
          <Section label="Backlog coupling analysis">

            {/* Coupling verdict */}
            {couplingVerdict && (
              <div className={`border rounded-xl px-4 py-3 mb-4 text-sm leading-relaxed ${damageLevelBadgeClass(backlogCoupling?.damageLevel || 'low')}`}>
                {couplingVerdict}
              </div>
            )}

            {/* CGPA gain comparison table */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                CGPA gain across {backlogCredits} backlog credits at different reattempt levels
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-base font-semibold text-zinc-400">
                    +{fmt(cgpaGainAtBaseline, 3)}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Bare pass<br />
                    <span className="text-zinc-500">{baselineRecoveryGP} GP</span>
                  </div>
                </div>
                <div className="text-center border-x border-zinc-800">
                  <div className="text-base font-semibold text-green-400">
                    +{fmt(cgpaGainAtSafeLevel, 3)}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Safe recovery<br />
                    <span className="text-green-600">≥{safeRecoveryGP} GP ✓</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base font-semibold text-zinc-400">
                    +{fmt(cgpaGainAtPerfect, 3)}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Perfect<br />
                    <span className="text-zinc-500">10 GP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assumption notes */}
            <DetailBlock
              title="Baseline assumption (6 GP)"
              body={baselineAssumptionNote}
            />
            <DetailBlock
              title={`Safe recovery threshold (≥${safeRecoveryGP} GP)`}
              body={safeRecoveryNote}
            />

          </Section>

          <Divider />
        </>
      ) : (
        <>
          {/* No backlogs — minimal section */}
          <Section label="Backlog status">
            <div className="bg-green-950 border border-green-900 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-green-400 text-base">✓</span>
              <p className="text-sm text-green-500">
                No backlogs. Your entire SGPA pressure falls on regular semester performance.
              </p>
            </div>
          </Section>
          <Divider />
        </>
      )}

      {/* ── SECTION 4: Per-subject requirements (only with named backlogs) ── */}
      {hasSubjectReqs && (
        <>
          <Section label={`Subject-level targets — ${subjectRequirements.length} backlog${subjectRequirements.length > 1 ? 's' : ''}`}>
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-zinc-950 border-b border-zinc-800">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 col-span-2">Subject</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 text-center">Credits</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 text-center">
                  Safe GP
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 text-right">
                  CGPA gain
                </span>
              </div>
              {/* Table rows */}
              {subjectRequirements.map((sr, i) => (
                <div
                  key={sr?.subjectId ?? i}
                  className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-sm text-zinc-300 col-span-2">
                    {sr?.subjectName || `Subject ${i + 1}`}
                  </span>
                  <span className="text-sm text-zinc-400 text-center">
                    {sr?.credits ?? '—'}
                  </span>
                  <span className="text-sm font-medium text-green-400 text-center">
                    ≥{sr?.safeTargetGP ?? 7.5}
                  </span>
                  <span className="text-sm font-medium text-green-400 text-right">
                    +{fmt(sr?.cgpaContributionAtSafe, 3)}
                  </span>
                </div>
              ))}
            </div>
            {/* Table footnote */}
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Safe GP = {subjectRequirements[0]?.safeTargetGP ?? 7.5} (recommended minimum).
              Min. GP to pass = {subjectRequirements[0]?.minimumGPToPass ?? 4}.
              Bare pass only neutralises the fail — it gives minimal CGPA recovery.
            </p>
          </Section>
          <Divider />
        </>
      )}

      {/* ── SECTION 5: Action items ── */}
      {actionItems.length > 0 && (
        <Section label="What to do — in order of impact">
          <ol className="flex flex-col gap-2">
            {actionItems.map((item, i) => (
              <ActionItem key={i} index={i} text={item} />
            ))}
          </ol>
        </Section>
      )}

      {/* ── FOOTER: Assumption disclosure ── */}
      {assumptionLine && (
        <div className="mt-2 flex items-start gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
          <span className="text-zinc-500 text-xs mt-0.5">⚠</span>
          <p className="text-xs text-zinc-500 leading-relaxed">{assumptionLine}</p>
        </div>
      )}

    </div>
  )
}
