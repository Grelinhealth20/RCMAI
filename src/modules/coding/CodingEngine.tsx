import { useEffect, useRef, useState, type ReactElement } from 'react'
import { predictCoding, type CodingPrediction } from './api/codingApi'
import type { CodedResult, LoadedChart } from './worklistTypes'
import {
  SPECIALTIES,
  lookupIcd,
  lookupCpt,
  lookupModifier,
  splitCptModifiers,
  type Specialty,
} from './data/codingReference'
import { evaluateChange, isCompleteCode, type ChangeKind } from './data/changeValidation'
import CodeChangeReview, { type ReviewTarget } from './CodeChangeReview'
import './CodingEngine.css'

/* ============================================================================
 * Editable code models
 * ==========================================================================*/

/** Guideline-review bookkeeping shared by every editable code box. `original`
 *  is the prior (AI-predicted or last-confirmed) value restored on revert;
 *  `reviewedValue` is the value the coder last resolved, so re-opening the same
 *  value doesn't re-trigger the popover; `note`/`overridden` capture a
 *  compliance override justification. */
interface ReviewMeta {
  original: string
  reviewedValue: string
  note?: string
  overridden?: boolean
}

interface IcdBox extends ReviewMeta {
  code: string
  description: string
  evidence: string
  verified: boolean
  primary: boolean
  rankLabel: string
}
interface CptBox extends ReviewMeta {
  code: string
  description: string
  evidence: string
  units: string
  modifiers: string[]
  verified: boolean
  mue: number | null
}
interface ModBox extends ReviewMeta {
  modifier: string
  description: string
  appliesTo: string
  rationale: string
}

const EMPTY_ICD: IcdBox = { code: '', description: '', evidence: '', verified: false, primary: false, rankLabel: 'Primary', original: '', reviewedValue: '' }
const EMPTY_CPT: CptBox = { code: '', description: '', evidence: '', units: '', modifiers: [], verified: false, mue: null, original: '', reviewedValue: '' }
const EMPTY_MOD: ModBox = { modifier: '', description: '', appliesTo: '', rationale: '', original: '', reviewedValue: '' }

type Sev = 'ok' | 'warning' | 'error' | 'none'

/** Diagnosis submission-rank labels. The badge is derived from a diagnosis's
 *  POSITION in the list (0 = primary, 1 = secondary, …) so ranks are always
 *  unique and correct even after the user edits/reorders/removes a code. */
const RANK_LABELS = ['Primary', 'Secondary', 'Tertiary', 'Quaternary', 'Quinary', 'Senary', 'Septenary', 'Octonary', 'Nonary', 'Denary']
const rankLabelAt = (i: number): string => RANK_LABELS[i] ?? `Dx ${i + 1}`

/** Before the first prediction, pad to `min` empty boxes so the 4-per-row grid
 *  is always visible; after a prediction the list is shown exactly (reduced to
 *  the predicted count). */
function padded<T>(list: T[], empty: T, hasPredicted: boolean, min = 4): T[] {
  if (hasPredicted) return list
  if (list.length >= min) return list
  return [...list, ...Array.from({ length: min - list.length }, () => ({ ...empty }))]
}

/* ============================================================================
 * Pipeline stages
 * ==========================================================================*/

interface Stage {
  id: number
  label: string
  caption: string
  Icon: () => ReactElement
}

function RecordsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 11l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CdiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M12 3.2l1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L12 17.6l-4.2 2.6 1.1-4.8L5.2 8.2l4.9-.4L12 3.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
function PredictIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M8.5 7.5L4.5 12l4 4.5M15.5 7.5l4 4.5-4 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.5l-2.8 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function AuditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STAGES: Stage[] = [
  { id: 1, label: 'Records Validation', caption: 'Documentation completeness', Icon: RecordsIcon },
  { id: 2, label: 'CDI Intelligence', caption: 'Documentation improvement', Icon: CdiIcon },
  { id: 3, label: 'ICD · CPT · Modifier Prediction', caption: 'Billing-ready codes', Icon: PredictIcon },
  { id: 4, label: 'CMS Audit', caption: 'NCCI · MUE · LCD/NCD', Icon: AuditIcon },
]

/* ============================================================================
 * Evidence highlighting for the record view
 * ==========================================================================*/

interface HSpan {
  start: number
  end: number
  type: 'icd' | 'cpt'
}

function buildSegments(record: string, icd: IcdBox[], cpt: CptBox[]): { text: string; span?: HSpan }[] {
  const lower = record.toLowerCase()
  const spans: HSpan[] = []
  const collect = (list: { evidence: string }[], type: 'icd' | 'cpt') => {
    list.forEach((c) => {
      const ev = c.evidence.trim()
      if (ev.length < 3) return
      const idx = lower.indexOf(ev.toLowerCase())
      if (idx === -1) return
      spans.push({ start: idx, end: idx + ev.length, type })
    })
  }
  collect(icd, 'icd')
  collect(cpt, 'cpt')
  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: HSpan[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.start < cursor) continue
    kept.push(s)
    cursor = s.end
  }
  const segments: { text: string; span?: HSpan }[] = []
  let pos = 0
  for (const s of kept) {
    if (s.start > pos) segments.push({ text: record.slice(pos, s.start) })
    segments.push({ text: record.slice(s.start, s.end), span: s })
    pos = s.end
  }
  if (pos < record.length) segments.push({ text: record.slice(pos) })
  return segments
}

/* ============================================================================
 * Per-box validation against the real reference tables
 * ==========================================================================*/

function icdState(code: string): { sev: Sev; msg: string } {
  const t = code.trim()
  if (!t) return { sev: 'none', msg: '' }
  const entry = lookupIcd(t)
  if (!entry) return { sev: 'warning', msg: 'Not in the specialty reference set — verify validity and specificity.' }
  if (!entry.billable) return { sev: 'error', msg: 'Not separately billable — requires greater specificity.' }
  if (entry.unspecified) return { sev: 'warning', msg: 'Unspecified code — payers frequently deny; document greater specificity.' }
  return { sev: 'ok', msg: `Valid, billable — ${entry.description}` }
}

function cptState(code: string, units: string): { sev: Sev; msg: string } {
  const t = code.trim()
  if (!t) return { sev: 'none', msg: '' }
  const { base, modifiers } = splitCptModifiers(t)
  const entry = lookupCpt(base)
  if (!entry) return { sev: 'warning', msg: 'Not in the specialty reference set — verify the code.' }
  const bad = modifiers.find((m) => !lookupModifier(m))
  if (bad) return { sev: 'warning', msg: `Unrecognized modifier "${bad}".` }
  const u = Number.parseInt(units, 10)
  if (Number.isFinite(u) && u > entry.mue) return { sev: 'warning', msg: `Units (${u}) exceed the MUE per-day max of ${entry.mue}.` }
  return { sev: 'ok', msg: `Valid — ${entry.description} (MUE ${entry.mue})` }
}

function modState(mod: string): { sev: Sev; msg: string } {
  const t = mod.trim().toUpperCase()
  if (!t) return { sev: 'none', msg: '' }
  const entry = lookupModifier(t)
  if (!entry) return { sev: 'warning', msg: 'Unrecognized modifier.' }
  return { sev: 'ok', msg: entry.description }
}

const sevClass = (s: Sev) => (s === 'error' ? ' sev-error' : s === 'warning' ? ' sev-warning' : s === 'ok' ? ' sev-ok' : '')
const sevGlyph = (s: Sev) => (s === 'error' ? '✕' : s === 'warning' ? '!' : '✓')

/* ============================================================================
 * Component
 * ==========================================================================*/

type Status = 'idle' | 'processing' | 'done' | 'error'

interface CodingEngineProps {
  /** When set, the engine loads this chart's note and auto-codes it. */
  loadedChart?: LoadedChart | null
  /** Fires once per chart when the AI prediction lands, with the final codes. */
  onCoded?: (rowId: string, result: CodedResult) => void
  /** When provided, "Next Record" asks the worklist for the next DOS instead of
   *  just clearing the workspace. */
  onRequestNext?: () => void
  /** Position of the loaded chart within the current coding queue. */
  queuePosition?: { index: number; total: number } | null
}

/** Convert a mm/dd/yyyy DOS to the yyyy-mm-dd value a <input type="date"> wants. */
function toDateInputValue(dos: string): string {
  const m = dos.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

/** Dedupe + drop empties, preserving order. */
function uniqNonEmpty(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of list) {
    const t = v.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function CodingEngine({ loadedChart = null, onCoded, onRequestNext, queuePosition = null }: CodingEngineProps = {}) {
  const [record, setRecord] = useState('')
  const [specialty, setSpecialty] = useState<Specialty | 'auto'>('auto')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [prediction, setPrediction] = useState<CodingPrediction | null>(null)
  const [activeStage, setActiveStage] = useState(0)
  const [recordMode, setRecordMode] = useState<'edit' | 'view'>('edit')

  const [icd, setIcd] = useState<IcdBox[]>([])
  const [cpt, setCpt] = useState<CptBox[]>([])
  const [mods, setMods] = useState<ModBox[]>([])
  const [hasPredicted, setHasPredicted] = useState(false)
  const [hoveredEvidence, setHoveredEvidence] = useState<string | null>(null)

  // Guideline change-review popover shown when a coder edits a predicted code.
  const [review, setReview] = useState<ReviewTarget | null>(null)

  // Record identifiers (below the pipeline).
  const [claimId, setClaimId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [dos, setDos] = useState('')

  const lastPredicted = useRef('')
  const prevLoadedId = useRef<string | null>(null)
  const codedForId = useRef<string | null>(null)

  // Live mirrors of state + the edited input's anchor, read when a debounced
  // change-review fires (the fire happens ~650ms after the last keystroke, by
  // which point these refs already reflect the latest render).
  const icdRef = useRef(icd)
  const cptRef = useRef(cpt)
  const modsRef = useRef(mods)
  const recordRef = useRef(record)
  const specialtyRef = useRef(specialty)
  const reviewOpenRef = useRef(false)
  const reviewTimer = useRef<number | null>(null)
  const anchorRect = useRef<DOMRect | null>(null)
  icdRef.current = icd
  cptRef.current = cpt
  modsRef.current = mods
  recordRef.current = record
  specialtyRef.current = specialty
  reviewOpenRef.current = review !== null

  /** Clear the workspace to start coding the next record. */
  const nextRecord = () => {
    setRecord('')
    setIcd([])
    setCpt([])
    setMods([])
    setPrediction(null)
    setHasPredicted(false)
    setStatus('idle')
    setActiveStage(0)
    setError('')
    setRecordMode('edit')
    setClaimId('')
    setPatientName('')
    setDos('')
    setReview(null)
    lastPredicted.current = ''
  }

  /* ---- Load a chart handed over from the worklist and auto-code it ---- */
  useEffect(() => {
    const id = loadedChart?.id ?? null
    if (id === prevLoadedId.current) return
    const hadChart = prevLoadedId.current !== null
    prevLoadedId.current = id
    if (loadedChart) {
      // Loading a new note resets prediction state; the auto-predict effect
      // (keyed on `record`) fires and processes it in real time.
      codedForId.current = null
      lastPredicted.current = ''
      setPrediction(null)
      setIcd([])
      setCpt([])
      setMods([])
      setHasPredicted(false)
      setError('')
      setRecordMode('edit')
      setClaimId(loadedChart.claimId)
      setPatientName(loadedChart.patientName)
      setDos(toDateInputValue(loadedChart.dos))
      setSpecialty(loadedChart.specialty)
      setRecord(loadedChart.note)
    } else if (hadChart) {
      // Queue exhausted — clear the workspace.
      nextRecord()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedChart])

  /* ---- Report the finished codes back to the worklist row ---- */
  useEffect(() => {
    if (status !== 'done' || !prediction || !loadedChart || !onCoded) return
    if (codedForId.current === loadedChart.id) return
    codedForId.current = loadedChart.id
    onCoded(loadedChart.id, {
      icd: uniqNonEmpty(icd.map((c) => c.code)),
      cpt: uniqNonEmpty(cpt.map((c) => c.code)),
      modifiers: uniqNonEmpty([...mods.map((m) => m.modifier), ...cpt.flatMap((c) => c.modifiers)]),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, prediction, loadedChart, icd, cpt, mods])

  /* ---- Real-time pipeline stage animation while a prediction is in flight ---- */
  useEffect(() => {
    if (status !== 'processing') return
    setActiveStage(1)
    const timer = window.setInterval(() => {
      setActiveStage((s) => (s < 4 ? s + 1 : s))
    }, 650)
    return () => window.clearInterval(timer)
  }, [status])

  /* ---- Auto-predict: debounce on the record (and specialty) ---- */
  useEffect(() => {
    const text = record.trim()
    if (text.length < 40) {
      setStatus('idle')
      setError('')
      setActiveStage(0)
      lastPredicted.current = ''
      return
    }
    const signature = `${specialty}::${text}`
    if (signature === lastPredicted.current) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('processing')
      setError('')
      predictCoding(record, specialty, controller.signal)
        .then((result) => {
          lastPredicted.current = signature
          setPrediction(result)
          setIcd(
            result.icdCodes.map((c) => ({
              code: c.code,
              description: c.description,
              evidence: c.evidence,
              verified: c.verified,
              primary: c.primary,
              rankLabel: c.rankLabel,
              original: c.code,
              reviewedValue: c.code,
            })),
          )
          setCpt(
            result.cptCodes.map((c) => ({
              code: c.code,
              description: c.description,
              evidence: c.evidence,
              units: c.units,
              modifiers: c.modifiers,
              verified: c.verified,
              mue: c.mue,
              original: c.code,
              reviewedValue: c.code,
            })),
          )
          setMods(
            result.modifiers.map((m) => ({
              modifier: m.modifier,
              description: m.description,
              appliesTo: m.appliesTo,
              rationale: m.rationale,
              original: m.modifier,
              reviewedValue: m.modifier,
            })),
          )
          setHasPredicted(true)
          setActiveStage(4)
          setStatus('done')
          if (document.activeElement instanceof HTMLTextAreaElement) return
          const hasEvidence = result.icdCodes.some((c) => c.evidence) || result.cptCodes.some((c) => c.evidence)
          if (hasEvidence) setRecordMode('view')
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'Prediction failed')
          setStatus('error')
        })
    }, 1100)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, specialty])

  /* ---- Guideline change-review orchestration ----
   * A coder editing a predicted (or newly typed) code schedules a debounced
   * review; once the value settles into a complete code the popover opens with
   * a real guideline evaluation. Resolving applies the change (recording any
   * override note); reverting restores the prior value. */
  const scheduleReview = (kind: ChangeKind, index: number, el: HTMLInputElement) => {
    anchorRect.current = el.getBoundingClientRect()
    if (reviewTimer.current) window.clearTimeout(reviewTimer.current)
    reviewTimer.current = window.setTimeout(() => openReviewIfNeeded(kind, index), 650)
  }

  const openReviewIfNeeded = (kind: ChangeKind, index: number) => {
    if (reviewOpenRef.current) return
    const list = kind === 'icd' ? icdRef.current : kind === 'cpt' ? cptRef.current : modsRef.current
    const box = list[index]
    if (!box) return
    const value = kind === 'modifier' ? (box as ModBox).modifier : (box as IcdBox | CptBox).code
    if (!isCompleteCode(kind, value)) return
    if (value.trim() === box.reviewedValue.trim()) return
    const evaluation = evaluateChange({
      kind,
      value,
      record: recordRef.current,
      specialty: specialtyRef.current,
      cptCodes: cptRef.current.map((c) => c.code).filter(Boolean),
      icdCodes: icdRef.current.map((c) => c.code).filter(Boolean),
      units: kind === 'cpt' ? (box as CptBox).units : undefined,
    })
    const r = anchorRect.current
    setReview({
      kind,
      index,
      value,
      original: box.original,
      evaluation,
      anchor: r
        ? { top: r.top, left: r.left, bottom: r.bottom, width: r.width }
        : { top: 120, left: 120, bottom: 150, width: 200 },
      note: box.note ?? '',
    })
  }

  const resolveReview = (note: string) => {
    if (!review) return
    const { kind, index, value, evaluation } = review
    const overridden = evaluation.verdict === 'inappropriate'
    const meta = { reviewedValue: value.trim(), note: note || undefined, overridden }
    if (kind === 'icd') setIcd((list) => list.map((c, i) => (i === index ? { ...c, ...meta, verified: false } : c)))
    else if (kind === 'cpt') setCpt((list) => list.map((c, i) => (i === index ? { ...c, ...meta, verified: false } : c)))
    else setMods((list) => list.map((c, i) => (i === index ? { ...c, ...meta } : c)))
    setReview(null)
  }

  const revertReview = () => {
    if (!review) return
    const { kind, index, original } = review
    if (kind === 'icd') setIcd((list) => list.map((c, i) => (i === index ? { ...c, code: original, reviewedValue: original } : c)))
    else if (kind === 'cpt') setCpt((list) => list.map((c, i) => (i === index ? { ...c, code: original, reviewedValue: original } : c)))
    else setMods((list) => list.map((c, i) => (i === index ? { ...c, modifier: original, reviewedValue: original } : c)))
    setReview(null)
  }

  // Cancel any pending review timer on unmount.
  useEffect(() => () => { if (reviewTimer.current) window.clearTimeout(reviewTimer.current) }, [])

  /* ---- Editors ---- */
  const editIcd = (i: number, patch: Partial<IcdBox>) => {
    const base = padded(icd, EMPTY_ICD, hasPredicted)
    setIcd(base.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  const editCpt = (i: number, patch: Partial<CptBox>) => {
    const base = padded(cpt, EMPTY_CPT, hasPredicted)
    setCpt(base.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  const editMod = (i: number, patch: Partial<ModBox>) => {
    const base = padded(mods, EMPTY_MOD, hasPredicted)
    setMods(base.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  const addIcd = () => setIcd([...padded(icd, EMPTY_ICD, hasPredicted), { ...EMPTY_ICD }])
  const addCpt = () => setCpt([...padded(cpt, EMPTY_CPT, hasPredicted), { ...EMPTY_CPT }])
  const addMod = () => setMods([...padded(mods, EMPTY_MOD, hasPredicted), { ...EMPTY_MOD }])
  const removeIcd = (i: number) => setIcd(padded(icd, EMPTY_ICD, hasPredicted).filter((_, idx) => idx !== i))
  const removeCpt = (i: number) => setCpt(padded(cpt, EMPTY_CPT, hasPredicted).filter((_, idx) => idx !== i))
  const removeMod = (i: number) => setMods(padded(mods, EMPTY_MOD, hasPredicted).filter((_, idx) => idx !== i))

  const icdView = padded(icd, EMPTY_ICD, hasPredicted)
  const cptView = padded(cpt, EMPTY_CPT, hasPredicted)
  const modView = padded(mods, EMPTY_MOD, hasPredicted)

  const segments = buildSegments(record, icd, cpt)
  const hasHighlights = segments.some((s) => s.span)

  /* ---- Stage metrics (real values once a prediction lands) ---- */
  const stageDone = (id: number) => status === 'done' && id <= 4
  const auditCritical = prediction?.audit.filter((a) => a.severity === 'critical').length ?? 0
  const auditWarn = prediction?.audit.filter((a) => a.severity === 'warning').length ?? 0
  const stageMetric = (id: number): string => {
    if (status !== 'done' || !prediction) return ''
    if (id === 1) return `${prediction.recordValidation.score}% complete`
    if (id === 2) return `${prediction.cdi.length} ${prediction.cdi.length === 1 ? 'opportunity' : 'opportunities'}`
    if (id === 3) return `${icd.length} ICD · ${cpt.length} CPT · ${mods.length} MOD`
    return auditCritical + auditWarn === 0 ? 'Clean' : `${auditCritical} critical · ${auditWarn} warning`
  }

  const stageStatus = (id: number): 'complete' | 'active' | 'upcoming' => {
    if (stageDone(id)) return 'complete'
    if (status === 'processing') return id === activeStage ? 'active' : id < activeStage ? 'complete' : 'upcoming'
    return 'upcoming'
  }

  /* ---- Renderers ---- */
  const renderIcd = () => (
    <section className="ce-codes-section">
      <div className="ce-codes-head">
        <span className="ce-codes-title">ICD-10-CM Diagnoses</span>
        <button type="button" className="ce-add" onClick={addIcd}>
          <PlusGlyph /> Add
        </button>
      </div>
      <div className="ce-box-grid">
        {icdView.map((entry, i) => {
          const st = icdState(entry.code)
          const evKey = `icd-${i}`
          return (
            <div
              className={`ce-box${sevClass(st.sev)}${entry.verified ? ' is-verified' : ''}${entry.overridden ? ' is-override' : ''}`}
              key={evKey}
              onMouseEnter={() => entry.evidence && setHoveredEvidence(entry.evidence)}
              onMouseLeave={() => setHoveredEvidence(null)}
            >
              <div className="ce-box-row">
                <input
                  className="ce-box-input"
                  type="text"
                  placeholder="ICD-10"
                  value={entry.code}
                  onChange={(e) => { editIcd(i, { code: e.target.value, verified: false }); scheduleReview('icd', i, e.currentTarget) }}
                  spellCheck={false}
                />
                {entry.note && (
                  <span className="ce-box-note" title={`Override note: ${entry.note}`} aria-label="Override note recorded">
                    <NoteGlyph />
                  </span>
                )}
                {st.sev !== 'none' && (
                  <span className="ce-box-flag" title={st.msg} aria-label={st.msg}>
                    {sevGlyph(st.sev)}
                  </span>
                )}
                <button type="button" className="ce-box-remove" aria-label="Remove code" onClick={() => removeIcd(i)}>
                  <CloseGlyph />
                </button>
              </div>
              {hasPredicted && entry.code.trim() && (
                <span className={`ce-rank ${i === 0 ? 'ce-rank-primary' : 'ce-rank-secondary'}`}>
                  {rankLabelAt(i)} Dx
                </span>
              )}
              {entry.description && (
                <span className="ce-box-desc" title={entry.description}>
                  {entry.description}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )

  const renderCpt = () => (
    <section className="ce-codes-section">
      <div className="ce-codes-head">
        <span className="ce-codes-title">CPT / HCPCS Procedures</span>
        <button type="button" className="ce-add" onClick={addCpt}>
          <PlusGlyph /> Add
        </button>
      </div>
      <div className="ce-box-grid">
        {cptView.map((entry, i) => {
          const st = cptState(entry.code, entry.units)
          return (
            <div
              className={`ce-box${sevClass(st.sev)}${entry.verified ? ' is-verified' : ''}${entry.overridden ? ' is-override' : ''}`}
              key={`cpt-${i}`}
              onMouseEnter={() => entry.evidence && setHoveredEvidence(entry.evidence)}
              onMouseLeave={() => setHoveredEvidence(null)}
            >
              <div className="ce-box-row">
                <input
                  className="ce-box-input"
                  type="text"
                  placeholder="CPT"
                  value={entry.code}
                  onChange={(e) => { editCpt(i, { code: e.target.value, verified: false }); scheduleReview('cpt', i, e.currentTarget) }}
                  spellCheck={false}
                />
                {entry.note && (
                  <span className="ce-box-note" title={`Override note: ${entry.note}`} aria-label="Override note recorded">
                    <NoteGlyph />
                  </span>
                )}
                {st.sev !== 'none' && (
                  <span className="ce-box-flag" title={st.msg} aria-label={st.msg}>
                    {sevGlyph(st.sev)}
                  </span>
                )}
                <button type="button" className="ce-box-remove" aria-label="Remove code" onClick={() => removeCpt(i)}>
                  <CloseGlyph />
                </button>
              </div>
              <div className="ce-box-sub">
                <input
                  className="ce-box-units"
                  type="number"
                  min="0"
                  placeholder="units"
                  value={entry.units}
                  onChange={(e) => editCpt(i, { units: e.target.value })}
                  aria-label="Units"
                />
                {entry.modifiers.length > 0 && <span className="ce-box-mods">-{entry.modifiers.join('-')}</span>}
              </div>
              {entry.description && (
                <span className="ce-box-desc" title={entry.description}>
                  {entry.description}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )

  const renderMods = () => (
    <section className="ce-codes-section">
      <div className="ce-codes-head">
        <span className="ce-codes-title">Modifiers</span>
        <button type="button" className="ce-add" onClick={addMod}>
          <PlusGlyph /> Add
        </button>
      </div>
      <div className="ce-box-grid">
        {modView.map((entry, i) => {
          const st = modState(entry.modifier)
          const tip = entry.rationale || st.msg
          return (
            <div className={`ce-box${sevClass(st.sev)}${entry.overridden ? ' is-override' : ''}`} key={`mod-${i}`} title={tip}>
              <div className="ce-box-row">
                <input
                  className="ce-box-input"
                  type="text"
                  placeholder="Mod"
                  value={entry.modifier}
                  onChange={(e) => { editMod(i, { modifier: e.target.value.toUpperCase() }); scheduleReview('modifier', i, e.currentTarget) }}
                  spellCheck={false}
                />
                {entry.note && (
                  <span className="ce-box-note" title={`Override note: ${entry.note}`} aria-label="Override note recorded">
                    <NoteGlyph />
                  </span>
                )}
                {st.sev !== 'none' && (
                  <span className="ce-box-flag" title={st.msg} aria-label={st.msg}>
                    {sevGlyph(st.sev)}
                  </span>
                )}
                <button type="button" className="ce-box-remove" aria-label="Remove modifier" onClick={() => removeMod(i)}>
                  <CloseGlyph />
                </button>
              </div>
              {(entry.appliesTo || entry.description) && (
                <span className="ce-box-desc" title={tip}>
                  {entry.appliesTo ? `→ ${entry.appliesTo}` : entry.description}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="ce">
      {/* ---------- Real-time processing pipeline ---------- */}
      <section className="ce-pipeline" aria-label="Coding processing pipeline">
        <div className="ce-pipeline-head">
          <span className="ce-pipeline-title">Processing Pipeline</span>
          {status === 'processing' ? (
            <span className="ce-autorun">
              <span className="ce-autorun-dot" aria-hidden="true" />
              Processing
            </span>
          ) : status === 'done' && prediction ? (
            <span className="ce-pipeline-sub">
              {prediction.specialtyLabel}
            </span>
          ) : (
            <span className="ce-pipeline-sub">Awaiting record</span>
          )}
        </div>

        <div className="ce-track" role="list">
          <div className="ce-track-line" aria-hidden="true">
            <span className="ce-track-fill" style={{ width: `${status === 'idle' ? 0 : ((Math.max(activeStage, stageDone(4) ? 4 : 0) - 1) / 3) * 100}%` }} />
          </div>
          {STAGES.map((stage) => {
            const st = stageStatus(stage.id)
            const metric = stageMetric(stage.id)
            return (
              <div key={stage.id} className={`ce-node is-${st}`} role="listitem">
                <span className="ce-node-dot">
                  {st === 'complete' ? (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <stage.Icon />
                  )}
                </span>
                <span className="ce-node-text">
                  <span className="ce-node-label">{stage.label}</span>
                  <span className="ce-node-caption">{metric || stage.caption}</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------- Record identifiers ---------- */}
      <section className="ce-recordbar" aria-label="Record identifiers">
        <label className="ce-rb-field">
          <span className="ce-rb-label">Claim ID</span>
          <input
            className="ce-rb-input"
            type="text"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="e.g. CLM-000123"
            spellCheck={false}
          />
        </label>
        <label className="ce-rb-field">
          <span className="ce-rb-label">Patient Name</span>
          <input
            className="ce-rb-input"
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Last, First"
            spellCheck={false}
          />
        </label>
        <label className="ce-rb-field">
          <span className="ce-rb-label">DOS</span>
          <input className="ce-rb-input" type="date" value={dos} onChange={(e) => setDos(e.target.value)} />
        </label>
        <div className="ce-rb-end">
          {queuePosition && (
            <span className="ce-queue-pill" aria-label="Coding queue position">
              DOS {queuePosition.index + 1} of {queuePosition.total}
            </span>
          )}
          <button type="button" className="ce-next-btn" onClick={onRequestNext ?? nextRecord}>
            {onRequestNext && queuePosition && queuePosition.index + 1 < queuePosition.total ? 'Next DOS' : 'Next Record'}
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </section>

      {/* ---------- Two equal panels ---------- */}
      <section className="ce-panels">
        {/* Left: Medical Records */}
        <div className="ce-panel">
          <div className="ce-panel-head">
            <span className="ce-panel-legend">
              <span className="ce-legend-dot" />
              Medical Records
            </span>
            <div className="ce-panel-actions">
              <label className="ce-specialty">
                <span className="ce-specialty-label">Specialty</span>
                <select
                  className="ce-specialty-select"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value as Specialty | 'auto')}
                >
                  <option value="auto">Auto-detect</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {hasHighlights &&
                (recordMode === 'edit' ? (
                  <button type="button" className="ce-toolbtn" onClick={() => setRecordMode('view')}>
                    View Evidence
                  </button>
                ) : (
                  <button type="button" className="ce-toolbtn" onClick={() => setRecordMode('edit')}>
                    Edit Record
                  </button>
                ))}
            </div>
          </div>

          {status === 'processing' && <div className="ce-proc-bar" aria-hidden="true" />}

          {recordMode === 'edit' ? (
            <textarea
              className="ce-record-input"
              placeholder="Paste or type the full clinical medical record here — H&amp;P, progress note, procedure/op note, consult, imaging, or labs. ICD-10, CPT/HCPCS and modifiers are predicted automatically in real time as soon as a record is present."
              value={record}
              onChange={(e) => setRecord(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="ce-record-view">
              {segments.map((seg, i) =>
                seg.span ? (
                  <mark
                    key={i}
                    className={`ce-mark ce-mark-${seg.span.type}${hoveredEvidence && seg.text.toLowerCase() === hoveredEvidence.toLowerCase() ? ' is-active' : ''}`}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          )}

          <div className="ce-record-foot">
            {status === 'error' ? (
              <span className="ce-foot-err">{error}</span>
            ) : status === 'done' && prediction ? (
              <span className={`ce-foot-val ce-foot-${prediction.recordValidation.status}`}>
                Documentation {prediction.recordValidation.score}% · {prediction.recordValidation.status.toUpperCase()}
                {prediction.recordValidation.issues.length > 0 && ` · ${prediction.recordValidation.issues.length} gap(s)`}
              </span>
            ) : (
              <span className="ce-foot-hint">{record.trim().length} characters · {record.trim().length < 40 ? 'add more detail to begin' : 'ready'}</span>
            )}
          </div>
        </div>

        {/* Right: Predicted codes */}
        <div className="ce-panel">
          <div className="ce-panel-head">
            <span className="ce-panel-legend">
              <span className="ce-legend-dot" />
              Predicted Codes
            </span>
          </div>

          <div className="ce-codes-scroll">
            {renderIcd()}
            {renderCpt()}
            {renderMods()}

            {/* ---------- Coding rationale & compliance (below Modifiers) ---------- */}
            {status === 'done' && prediction && (prediction.mappings.length > 0 || prediction.validations.length > 0) && (
              <div className="ce-rationale">
                {prediction.mappings.length > 0 && (
                  <div className="ce-rat-block">
                    <span className="ce-rat-title">Why Each CPT Is Predicted · Severity &amp; Level of Care</span>
                    <span className="ce-rat-sub">
                      For every CPT: the severity / level-of-care determination from the medical record (E/M
                      complexity or procedure extent), the coding rationale, the diagnosis codes that establish its
                      medical necessity, and the verbatim documentation that supports it.
                    </span>
                    <ul className="ce-map-list">
                      {prediction.mappings.map((m, i) => (
                        <li key={i} className="ce-map-item">
                          <div className="ce-map-head">
                            <span className="ce-map-cpt">{m.cpt}</span>
                            <span className="ce-map-arrow" aria-hidden="true">←</span>
                            {m.supportingDiagnoses.length > 0 ? (
                              m.supportingDiagnoses.map((d) => (
                                <span key={d} className="ce-map-dx">{d}</span>
                              ))
                            ) : (
                              <span className="ce-map-dx ce-map-dx-none">no linked Dx</span>
                            )}
                          </div>
                          {m.levelOfCare && (
                            <div className="ce-map-line ce-map-line-level">
                              <span className="ce-map-line-label">Severity · level of care</span>
                              <span className="ce-map-level">{m.levelOfCare}</span>
                            </div>
                          )}
                          {m.rationale && (
                            <div className="ce-map-line">
                              <span className="ce-map-line-label">Coding rationale</span>
                              <span className="ce-map-why">{m.rationale}</span>
                            </div>
                          )}
                          {m.recordEvidence && (
                            <div className="ce-map-line ce-map-line-evidence">
                              <span className="ce-map-line-label">Why coded · from the medical record</span>
                              <span className="ce-map-evidence">“{m.recordEvidence}”</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prediction.validations.length > 0 && (
                  <div className="ce-rat-block">
                    <span className="ce-rat-title">Compliance Validation · LCD/NCD · NCCI PTP · MUE · Modifiers</span>
                    <ul className="ce-val-list">
                      {prediction.validations.map((v, i) => (
                        <li key={i} className={`ce-val-item is-${v.status}`}>
                          <span className="ce-val-edit">{v.edit}</span>
                          <div className="ce-val-body">
                            <span className="ce-val-name">
                              {v.item}
                              <span className="ce-val-status">
                                {v.status === 'pass' ? '✓ Pass' : v.status === 'warning' ? '! Review' : '✕ Critical'}
                              </span>
                            </span>
                            <span className="ce-val-detail">{v.detail}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* CDI + CMS audit intelligence */}
            {status === 'done' && prediction && (prediction.cdi.length > 0 || prediction.audit.length > 0) && (
              <div className="ce-intel">
                {prediction.cdi.length > 0 && (
                  <div className="ce-intel-block">
                    <span className="ce-intel-title">CDI Opportunities</span>
                    <ul className="ce-intel-list">
                      {prediction.cdi.map((c, i) => (
                        <li key={i} className="ce-intel-item ce-intel-cdi">
                          <strong>{c.title}</strong>
                          <span>{c.detail}</span>
                          {c.impact && <em>{c.impact}</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prediction.audit.length > 0 && (
                  <div className="ce-intel-block">
                    <span className="ce-intel-title">CMS Audit — NCCI · MUE · LCD/NCD</span>
                    <ul className="ce-intel-list">
                      {prediction.audit.map((a, i) => (
                        <li key={i} className={`ce-intel-item ce-audit-${a.severity}`}>
                          <strong>
                            {a.item}
                            <span className="ce-audit-src">{a.source}</span>
                          </strong>
                          <span>{a.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Guideline change-review popover ---------- */}
      {review && <CodeChangeReview target={review} onConfirm={resolveReview} onRevert={revertReview} />}
    </div>
  )
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M4 20.5l1-4L15.5 6a1.5 1.5 0 012.1 0l.9.9a1.5 1.5 0 010 2.1L8 19.5l-4 1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}
function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default CodingEngine
