import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvaluation, ChangeKind, CheckStatus, Verdict } from './data/changeValidation'

export interface ReviewTarget {
  kind: ChangeKind
  index: number
  /** The value the user is changing to. */
  value: string
  /** The prior (AI-predicted or last-confirmed) value, restored on revert. */
  original: string
  evaluation: ChangeEvaluation
  /** Anchor rect of the edited input, in viewport coordinates. */
  anchor: { top: number; left: number; bottom: number; width: number }
  /** Any note already recorded for this box. */
  note: string
}

const KIND_LABEL: Record<ChangeKind, string> = {
  icd: 'ICD-10-CM diagnosis',
  cpt: 'CPT / HCPCS procedure',
  modifier: 'Modifier',
}

const VERDICT_META: Record<Verdict, { label: string; cls: string; glyph: string }> = {
  appropriate: { label: 'Appropriate', cls: 'ok', glyph: '✓' },
  caution: { label: 'Review advised', cls: 'warn', glyph: '!' },
  inappropriate: { label: 'Not supported', cls: 'error', glyph: '✕' },
}

const STATUS_GLYPH: Record<CheckStatus, string> = { pass: '✓', warn: '!', fail: '✕', info: 'i' }

const POPOVER_W = 340

interface Props {
  target: ReviewTarget
  /** Apply the change; note is the (optional / required-when-inappropriate) justification. */
  onConfirm: (note: string) => void
  /** Discard the change and restore the prior value. */
  onRevert: () => void
}

/**
 * Real-time guideline-compliance popover shown when a coder changes an
 * AI-predicted (or newly typed) ICD / CPT / modifier. Shows the accurate,
 * grounded coding facts; for an unsupported change it requires a written
 * justification note before the override can be applied.
 */
function CodeChangeReview({ target, onConfirm, onRevert }: Props) {
  const { evaluation: ev, kind, value } = target
  const meta = VERDICT_META[ev.verdict]
  const [note, setNote] = useState(target.note)
  const cardRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: target.anchor.bottom + 8, left: target.anchor.left })

  // Clamp the popover into the viewport once its real height is known, and flip
  // above the anchor when it would overflow the bottom edge.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const h = card.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = target.anchor.left
    if (left + POPOVER_W + 8 > vw) left = vw - POPOVER_W - 8
    if (left < 8) left = 8
    let top = target.anchor.bottom + 8
    if (top + h + 8 > vh) {
      const above = target.anchor.top - h - 8
      top = above > 8 ? above : Math.max(8, vh - h - 8)
    }
    setPos({ top, left })
  }, [target.anchor, ev.verdict])

  // Focus the note field for an override so the coder can type immediately.
  useEffect(() => {
    if (ev.requiresNote) noteRef.current?.focus()
  }, [ev.requiresNote])

  // Escape reverts (safe default — never silently keep an unreviewed change).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onRevert()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRevert])

  const noteMissing = ev.requiresNote && note.trim().length === 0
  const primaryLabel = ev.verdict === 'inappropriate' ? 'Override & apply' : 'Apply change'

  return (
    <>
      <button
        type="button"
        className="ce-review-backdrop"
        aria-label="Cancel change"
        onClick={onRevert}
      />
      <div
        ref={cardRef}
        className={`ce-review ce-review-${meta.cls}`}
        style={{ top: pos.top, left: pos.left, width: POPOVER_W }}
        role="dialog"
        aria-modal="true"
        aria-label="Code change review"
      >
        <div className="ce-review-head">
          <span className={`ce-review-badge sev-${meta.cls}`}>
            <span className="ce-review-badge-glyph">{meta.glyph}</span>
            {meta.label}
          </span>
          <span className="ce-review-kind">{KIND_LABEL[kind]}</span>
        </div>

        <div className="ce-review-code">
          <span className="ce-review-code-value">{value.trim().toUpperCase()}</span>
          {ev.description && <span className="ce-review-code-desc">{ev.description}</span>}
        </div>

        <p className="ce-review-headline">{ev.headline}</p>

        <ul className="ce-review-checks">
          {ev.checks.map((c, i) => (
            <li key={i} className={`ce-review-check is-${c.status}`}>
              <span className="ce-review-check-dot">{STATUS_GLYPH[c.status]}</span>
              <span className="ce-review-check-body">
                <span className="ce-review-check-label">{c.label}</span>
                <span className="ce-review-check-detail">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="ce-review-accurate">
          <span className="ce-review-accurate-label">Accurate coding</span>
          <span className="ce-review-accurate-text">{ev.accurateInfo}</span>
        </div>

        <div className="ce-review-note-wrap">
          <label className="ce-review-note-label" htmlFor="ce-review-note">
            {ev.requiresNote ? 'Justification note (required to override)' : 'Note (optional)'}
          </label>
          <textarea
            id="ce-review-note"
            ref={noteRef}
            className={`ce-review-note${noteMissing ? ' is-missing' : ''}`}
            placeholder={
              ev.requiresNote
                ? 'Explain why this code is being applied despite the flag (e.g. addendum pending, coder judgment, payer-specific guidance)…'
                : 'Add an optional note for the audit trail…'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={ev.requiresNote ? 3 : 2}
          />
        </div>

        {ev.sources.length > 0 && (
          <div className="ce-review-sources">
            {ev.sources.map((s) => (
              <span key={s} className="ce-review-source">{s}</span>
            ))}
          </div>
        )}

        <div className="ce-review-actions">
          <button type="button" className="ce-review-btn ce-review-revert" onClick={onRevert}>
            Revert
          </button>
          <button
            type="button"
            className={`ce-review-btn ce-review-apply is-${meta.cls}`}
            disabled={noteMissing}
            onClick={() => onConfirm(note.trim())}
            title={noteMissing ? 'Enter a justification note to override' : primaryLabel}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </>
  )
}

export default CodeChangeReview
