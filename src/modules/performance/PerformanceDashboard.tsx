import { useMemo, useState } from 'react'
import { PERF_CLAIMS, PERF_SUMMARY, PERF_ANALYTICS } from './engine/perfEngine'
import { PERF_PAYERS, PERF_PROVIDERS, PERF_SERVICES, PERF_DENIALS } from './data/perfReference'
import { fmtUSD, fmtUSDWhole } from '../ar/engine/money'
import { PERF_STATUS_LABEL, type PerfStatus } from './types'
import { Donut, HBarList, MonthlyBars } from './charts'
import { fmtK, STATUS_COLOR } from './chartTokens'
import './PerformanceDashboard.css'

const PAGE_SIZE = 12
type StatusFilter = PerfStatus | 'all'

const statusBadge: Record<PerfStatus, string> = {
  paid: 'pf-b-paid',
  'in-process': 'pf-b-process',
  denied: 'pf-b-denied',
  resubmitted: 'pf-b-resubmit',
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${((n / d) * 100).toFixed(1)}%`
}

function PerformanceDashboard() {
  const claims = PERF_CLAIMS
  const s = PERF_SUMMARY
  const a = PERF_ANALYTICS

  const [status, setStatus] = useState<StatusFilter>('all')
  const [payer, setPayer] = useState('all')
  const [provider, setProvider] = useState('all')
  const [procedure, setProcedure] = useState('all')
  const [denial, setDenial] = useState('all')
  const [page, setPage] = useState(1)
  const resetPage = () => setPage(1)

  /* ---------- KPIs ---------- */
  const netCollection = pct(s.totalPaidCents, s.totalAllowedCents)
  const denialRate = pct(s.denied, s.validated)
  const resubRate = pct(s.resubmitted, s.validated)
  const avgReimb = s.paid > 0 ? fmtUSD(Math.round(s.totalPaidCents / s.paid)) : '—'

  const kpis = [
    { label: 'Total Billed', value: fmtUSDWhole(s.totalChargesCents), sub: `${s.validated.toLocaleString('en-US')} claims validated`, accent: 'blue' },
    { label: 'Total Collected', value: fmtUSDWhole(s.totalPaidCents), sub: `${s.paid} paid claims`, accent: 'green' },
    { label: 'Net Collection Rate', value: netCollection, sub: 'payments ÷ allowed', accent: 'teal' },
    { label: 'Denial Rate', value: denialRate, sub: `${s.denied} denied`, accent: 'red' },
    { label: 'Resubmission Rate', value: resubRate, sub: `${s.resubmitted} resubmitted`, accent: 'amber' },
    { label: 'Avg Reimbursement', value: avgReimb, sub: 'per paid claim', accent: 'slate' },
  ]

  /* ---------- Chart data ---------- */
  const statusSegments = [
    { label: 'Paid', value: s.paid, color: STATUS_COLOR.paid },
    { label: 'In Process', value: s.inProcess, color: STATUS_COLOR['in-process'] },
    { label: 'Denied', value: s.denied, color: STATUS_COLOR.denied },
    { label: 'Resubmitted', value: s.resubmitted, color: STATUS_COLOR.resubmitted },
  ]
  const payerBars = a.payers.map((p) => ({ label: p.name, value: p.billed, valueLabel: fmtK(p.billed) }))
  const denialBars = a.denials.map((d) => ({ label: `${d.carc}`, value: d.count, valueLabel: `${d.count}` }))
  const providerBars = a.providers.map((p) => ({ label: p.name.replace(/\s*\(.*\)$/, ''), value: p.collected, valueLabel: fmtK(p.collected) }))

  /* ---------- Filtered ledger ---------- */
  const filtered = useMemo(
    () =>
      claims.filter(
        (c) =>
          (status === 'all' || c.status === status) &&
          (payer === 'all' || c.payerName === payer) &&
          (provider === 'all' || c.providerName === provider) &&
          (procedure === 'all' || c.cpt === procedure) &&
          (denial === 'all' || c.reasonCode === denial),
      ),
    [claims, status, payer, provider, procedure, denial],
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  const clearFilters = () => {
    setStatus('all')
    setPayer('all')
    setProvider('all')
    setProcedure('all')
    setDenial('all')
    resetPage()
  }
  const money = (cents: number) => (cents > 0 ? fmtUSD(cents) : '—')

  return (
    <div className="pf">
      <div className="pf-head">
        <span className="pf-title">Performance AI</span>
        <span className="pf-sub">Revenue-cycle performance & claims analytics across payers, providers, and procedures.</span>
      </div>

      {/* ---------- KPI tiles ---------- */}
      <div className="pf-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`pf-kpi accent-${k.accent}`}>
            <span className="pf-kpi-label">{k.label}</span>
            <span className="pf-kpi-value">{k.value}</span>
            <span className="pf-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* ---------- Charts row 1 ---------- */}
      <div className="pf-charts-2">
        <section className="pf-chart-card">
          <div className="pf-chart-head">
            <span className="pf-chart-title">Claims by Status</span>
            <span className="pf-chart-cap">{s.validated} validated</span>
          </div>
          <Donut segments={statusSegments} />
        </section>

        <section className="pf-chart-card">
          <div className="pf-chart-head">
            <span className="pf-chart-title">Billed vs Collected by Month</span>
            <span className="pf-chart-cap">{fmtUSDWhole(s.totalChargesCents)} billed · {fmtUSDWhole(s.totalPaidCents)} collected</span>
          </div>
          <MonthlyBars data={a.monthly} />
        </section>
      </div>

      {/* ---------- Charts row 2 ---------- */}
      <div className="pf-charts-3">
        <section className="pf-chart-card">
          <div className="pf-chart-head">
            <span className="pf-chart-title">Revenue by Payer</span>
            <span className="pf-chart-cap">billed</span>
          </div>
          <HBarList items={payerBars} accent="#2753b3" />
        </section>

        <section className="pf-chart-card">
          <div className="pf-chart-head">
            <span className="pf-chart-title">Top Denial Reasons</span>
            <span className="pf-chart-cap">{s.denied} denied</span>
          </div>
          <HBarList items={denialBars} accent="#dc2626" />
        </section>

        <section className="pf-chart-card">
          <div className="pf-chart-head">
            <span className="pf-chart-title">Provider Collections</span>
            <span className="pf-chart-cap">collected</span>
          </div>
          <HBarList items={providerBars} accent="#0d9488" />
        </section>
      </div>

      {/* ---------- Filterable ledger ---------- */}
      <div className="pf-filters">
        <span className="pf-filters-label">Claims Ledger — Filters</span>
        <div className="pf-filter-row">
          <label className="pf-select-wrap">
            <span className="pf-select-label">Payer</span>
            <select className="pf-select" value={payer} onChange={(e) => { setPayer(e.target.value); resetPage() }}>
              <option value="all">All Payers</option>
              {PERF_PAYERS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label className="pf-select-wrap">
            <span className="pf-select-label">Rendering Provider</span>
            <select className="pf-select" value={provider} onChange={(e) => { setProvider(e.target.value); resetPage() }}>
              <option value="all">All Providers</option>
              {PERF_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pf-select-wrap">
            <span className="pf-select-label">Procedure</span>
            <select className="pf-select" value={procedure} onChange={(e) => { setProcedure(e.target.value); resetPage() }}>
              <option value="all">All Procedures</option>
              {PERF_SERVICES.map((sv) => <option key={sv.cpt} value={sv.cpt}>{sv.cpt} — {sv.desc}</option>)}
            </select>
          </label>
          <label className="pf-select-wrap">
            <span className="pf-select-label">Status</span>
            <select className="pf-select" value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); resetPage() }}>
              <option value="all">All Statuses</option>
              {(Object.keys(PERF_STATUS_LABEL) as PerfStatus[]).map((st) => <option key={st} value={st}>{PERF_STATUS_LABEL[st]}</option>)}
            </select>
          </label>
          <label className="pf-select-wrap">
            <span className="pf-select-label">Denial Reason</span>
            <select className="pf-select" value={denial} onChange={(e) => { setDenial(e.target.value); resetPage() }}>
              <option value="all">All Reasons</option>
              {PERF_DENIALS.map((d) => <option key={d.carc} value={d.carc}>{d.carc} — {d.desc}</option>)}
            </select>
          </label>
          <button type="button" className="pf-clear" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      <div className="pf-table-heading">
        <span className="pf-table-label">Claims Ledger</span>
        <span className="pf-results-meta">
          Showing <strong>{filtered.length.toLocaleString('en-US')}</strong> of <strong>{claims.length.toLocaleString('en-US')}</strong> claims
        </span>
      </div>

      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Patient Name</th>
              <th>Payer Name</th>
              <th>DOS</th>
              <th className="pf-num">Total Charges</th>
              <th className="pf-num">Allowed Amount</th>
              <th className="pf-num">Paid Amount</th>
              <th className="pf-num">Patient Responsibility</th>
              <th className="pf-num">Adjustments</th>
              <th>Status</th>
              <th>Reason Code</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td className="pf-empty" colSpan={11}>No claims match the selected filters.</td></tr>
            ) : (
              pageRows.map((c) => (
                <tr key={c.id}>
                  <td className="pf-mono">{c.id}</td>
                  <td>{c.patientName}</td>
                  <td>{c.payerName}</td>
                  <td className="pf-mono">{c.dos}</td>
                  <td className="pf-num pf-mono">{fmtUSD(c.charges)}</td>
                  <td className="pf-num pf-mono">{money(c.allowed)}</td>
                  <td className="pf-num pf-mono pf-paid">{money(c.paid)}</td>
                  <td className="pf-num pf-mono">{money(c.patientResp)}</td>
                  <td className="pf-num pf-mono">{money(c.adjustments)}</td>
                  <td><span className={`pf-badge ${statusBadge[c.status]}`}>{PERF_STATUS_LABEL[c.status]}</span></td>
                  <td className="pf-mono">{c.reasonCode}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="pf-pagination">
          <button type="button" className="pf-page-btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <span className="pf-page-info">Page <strong>{clampedPage}</strong> of <strong>{totalPages}</strong></span>
          <button type="button" className="pf-page-btn" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next →</button>
        </div>
      )}
    </div>
  )
}

export default PerformanceDashboard
