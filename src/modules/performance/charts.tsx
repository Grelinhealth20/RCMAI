import type { MonthAgg } from './types'
import { fmtK, C_BILLED, C_COLLECTED } from './chartTokens'

export interface DonutSeg {
  label: string
  value: number
  color: string
}

/** Status donut — a state breakdown, so segments carry a labelled legend (never
 *  color-alone). Recessive track ring behind the segments. */
export function Donut({ segments }: { segments: DonutSeg[] }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  const size = 168
  const thick = 22
  const cx = size / 2
  const r = (size - thick) / 2
  const C = 2 * Math.PI * r
  const gap = 3
  let acc = 0
  return (
    <div className="pf-donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="pf-donut" role="img" aria-label="Claims by status">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={thick} />
        {segments.map((s) => {
          const len = (s.value / total) * C
          const dash = Math.max(0, len - gap)
          const el = (
            <circle
              key={s.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thick}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${cx} ${cx})`}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          acc += len
          return el
        })}
        <text x={cx} y={cx - 3} textAnchor="middle" className="pf-donut-num">{total}</text>
        <text x={cx} y={cx + 15} textAnchor="middle" className="pf-donut-lbl">claims</text>
      </svg>
      <div className="pf-donut-legend">
        {segments.map((s) => (
          <span key={s.label} className="pf-leg">
            <i style={{ background: s.color }} aria-hidden="true" />
            <span className="pf-leg-lbl">{s.label}</span>
            <b>{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

export interface HBarItem {
  label: string
  value: number
  valueLabel: string
}

/** Ranked horizontal bars — one measure across categories → a single hue, sorted. */
export function HBarList({ items, accent }: { items: HBarItem[]; accent: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="pf-hbars">
      {items.map((i) => (
        <div key={i.label} className="pf-hbar" title={`${i.label}: ${i.valueLabel}`}>
          <span className="pf-hbar-label">{i.label}</span>
          <span className="pf-hbar-track">
            <span className="pf-hbar-fill" style={{ width: `${(i.value / max) * 100}%`, background: accent }} />
          </span>
          <span className="pf-hbar-val">{i.valueLabel}</span>
        </div>
      ))}
    </div>
  )
}

/** Monthly billed vs collected — two measures, same $ scale → one axis, grouped
 *  bars, legend present. */
export function MonthlyBars({ data }: { data: MonthAgg[] }) {
  const max = Math.max(1, ...data.map((d) => d.billed))
  return (
    <div className="pf-mbars-wrap">
      <div className="pf-legend">
        <span className="pf-leg"><i style={{ background: C_BILLED }} aria-hidden="true" />Billed</span>
        <span className="pf-leg"><i style={{ background: C_COLLECTED }} aria-hidden="true" />Collected</span>
      </div>
      <div className="pf-mbars">
        {data.map((d) => (
          <div key={d.label} className="pf-mcol">
            <div className="pf-mcol-bars">
              <span className="pf-mbar" style={{ height: `${(d.billed / max) * 100}%`, background: C_BILLED }} title={`${d.label} · Billed ${fmtK(d.billed)}`} />
              <span className="pf-mbar" style={{ height: `${(d.collected / max) * 100}%`, background: C_COLLECTED }} title={`${d.label} · Collected ${fmtK(d.collected)}`} />
            </div>
            <span className="pf-mcol-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
