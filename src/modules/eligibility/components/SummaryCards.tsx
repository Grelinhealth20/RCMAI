import type { ReactNode } from 'react'
import type { PatientStatus, SummaryCounts } from '../types'
import './SummaryCards.css'

export type StatusFilterValue = PatientStatus | 'all'

interface CardDef {
  key: StatusFilterValue
  label: string
  accent: string
  getValue: (c: SummaryCounts) => number
  icon: ReactNode
}

const iconProps = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none' } as const

const CARD_DEFS: CardDef[] = [
  {
    key: 'all',
    label: 'Verifications Received',
    accent: 'accent-slate',
    getValue: (c) => c.verificationsReceived,
    icon: (
      <svg {...iconProps}>
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'active',
    label: 'Active Patients',
    accent: 'accent-success',
    getValue: (c) => c.active,
    icon: (
      <svg {...iconProps}>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    key: 'inactive',
    label: 'Inactive Patients',
    accent: 'accent-muted',
    getValue: (c) => c.inactive,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'manual-review',
    label: 'Manual Review Required',
    accent: 'accent-warning',
    getValue: (c) => c.manualReview,
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l9 16H3L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'prior-auth-required',
    label: 'Prior Auth Required',
    accent: 'accent-violet',
    getValue: (c) => c.priorAuthRequired,
    icon: (
      <svg {...iconProps}>
        <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.5 12l2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'pending-verification',
    label: 'Pending Verification',
    accent: 'accent-blue',
    getValue: (c) => c.pendingVerification,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

interface SummaryCardsProps {
  counts: SummaryCounts | null
  activeFilter: StatusFilterValue
  onSelect: (value: StatusFilterValue) => void
}

function SummaryCards({ counts, activeFilter, onSelect }: SummaryCardsProps) {
  return (
    <div className="summary-cards" role="tablist" aria-label="Eligibility summary filters">
      {CARD_DEFS.map((card) => {
        const isActive = activeFilter === card.key
        return (
          <button
            key={card.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`summary-card ${card.accent}${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(card.key)}
          >
            <span className="summary-card-icon">{card.icon}</span>
            <span className="summary-card-value">
              {counts ? card.getValue(counts) : <span className="summary-card-skeleton" />}
            </span>
            <span className="summary-card-label">{card.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default SummaryCards
