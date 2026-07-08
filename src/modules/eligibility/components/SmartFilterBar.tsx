import { useState, type FormEvent } from 'react'
import { parseSmartFilter } from '../api/smartFilterApi'
import type { SmartFilterCriteria } from '../types'
import './SmartFilterBar.css'

interface SmartFilterBarProps {
  onApply: (criteria: SmartFilterCriteria, queryText: string) => void
  onClear: () => void
  activeQueryLabel: string | null
}

const EXAMPLES = [
  'Show inactive patients with Aetna',
  'Patients pending verification',
  'Prior auth required for Dr. Nair',
]

function SmartFilterBar({ onApply, onClear, activeQueryLabel }: SmartFilterBarProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    setIsLoading(true)
    setError('')
    try {
      const trimmed = query.trim()
      const criteria = await parseSmartFilter(trimmed)
      onApply(criteria, trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smart filter failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setError('')
    onClear()
  }

  return (
    <div className="smart-filter-bar">
      <form className="smart-filter-form" onSubmit={handleSubmit}>
        <span className="smart-filter-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path
              d="M11 4a7 7 0 104.9 12.02l4.04 4.04a1 1 0 001.42-1.42l-4.04-4.04A7 7 0 0011 4z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="smart-filter-ai-chip">AI</span>
        <input
          type="text"
          className="smart-filter-input"
          placeholder="Ask Smart Filter — e.g. &quot;show inactive patients with Aetna&quot;"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className="smart-filter-submit" disabled={isLoading || !query.trim()}>
          {isLoading ? (
            <>
              <span className="smart-filter-spinner" aria-hidden="true" />
              Thinking...
            </>
          ) : (
            'Ask AI'
          )}
        </button>
      </form>

      <div className="smart-filter-meta">
        {activeQueryLabel ? (
          <span className="smart-filter-chip">
            <span className="smart-filter-chip-dot" aria-hidden="true" />
            Applied: &quot;{activeQueryLabel}&quot;
            <button type="button" className="smart-filter-chip-clear" onClick={handleClear} aria-label="Clear smart filter">
              ×
            </button>
          </span>
        ) : (
          <div className="smart-filter-examples">
            <span>Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="smart-filter-example"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="smart-filter-error">{error}</div>}
    </div>
  )
}

export default SmartFilterBar
