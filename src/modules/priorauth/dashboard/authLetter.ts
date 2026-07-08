import type { AuthRecord } from './dashboardData'

/**
 * Generates and downloads a payer-specific Authorization Approval Letter as an
 * enterprise-formatted Word (.doc) document for an approved prior authorization.
 * Word opens application/msword HTML as a fully formatted document — no dependency.
 */

const esc = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmt = (iso?: string): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`
}

export function downloadAuthorizationLetter(record: AuthRecord): void {
  const c = record.clinical
  const payer = record.payerName
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const safePayer = payer.replace(/[^a-z0-9]+/gi, '-')
  const safeAuth = (record.authNumber || 'AUTH').replace(/[^a-z0-9]+/gi, '-')

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>Prior Authorization Approval Letter</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: 8.5in 11in; margin: 0.9in 1in 1in 1in; }
  body { font-family: 'Calibri','Segoe UI',Arial,sans-serif; font-size: 11pt; color: #0c0c0c; line-height: 1.5; }
  .ph { border-bottom: 3pt solid #091121; padding-bottom: 8pt; margin-bottom: 4pt; }
  .payer { font-size: 17pt; font-weight: bold; color: #091121; letter-spacing: 0.4pt; }
  .dept { font-size: 9.5pt; color: #4c566f; }
  .doctype { text-align: right; font-size: 9pt; color: #6b7590; margin-bottom: 14pt; }
  .approved { display: inline-block; font-size: 12pt; font-weight: bold; color: #003e2d; border: 1.5pt solid #1e8a63; background: #eaf5f0; padding: 4pt 12pt; margin: 6pt 0 12pt; letter-spacing: 0.6pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 14pt; }
  td { padding: 4pt 8pt; font-size: 10.5pt; vertical-align: top; border-bottom: 0.5pt solid #e3e8f0; }
  td.k { width: 34%; font-weight: bold; color: #091121; }
  h3 { font-size: 11pt; color: #2753b3; text-transform: uppercase; letter-spacing: 0.3pt; border-bottom: 1pt solid #c1c9da; padding-bottom: 2pt; margin: 16pt 0 6pt; }
  p { margin: 0 0 9pt; }
  .sig { margin-top: 22pt; }
  .foot { margin-top: 22pt; padding-top: 8pt; border-top: 1pt solid #c1c9da; font-size: 8pt; color: #6b7590; line-height: 1.4; }
</style>
</head>
<body>
<div class="ph">
  <div class="payer">${esc(payer)}</div>
  <div class="dept">Utilization Management &amp; Prior Authorization Department</div>
</div>
<div class="doctype">Prior Authorization Determination &nbsp;·&nbsp; ${esc(today)}</div>

<p>To: ${esc(c.renderingProvider.name)} &nbsp;|&nbsp; ${esc(record.facilityName)}<br/>
${esc(c.facilityAddress)}</p>

<p><b>RE: Prior Authorization Approval — ${esc(record.patientName)}</b></p>

<div class="approved">✔ AUTHORIZATION APPROVED</div>

<p>This letter confirms that ${esc(payer)} has reviewed the prior authorization request referenced below and has determined the requested service to be <b>medically necessary and APPROVED</b> in accordance with the member's benefit plan and ${esc(payer)} medical policy.</p>

<table>
  <tr><td class="k">Authorization Number</td><td>${esc(record.authNumber || '—')}</td></tr>
  <tr><td class="k">Member Name</td><td>${esc(record.patientName)}</td></tr>
  <tr><td class="k">Member ID</td><td>${esc(c.memberId)}</td></tr>
  <tr><td class="k">Date of Birth</td><td>${fmt(c.dob)}</td></tr>
  <tr><td class="k">Group Number</td><td>${esc(c.groupNumber)}</td></tr>
  <tr><td class="k">Payer ID</td><td>${esc(c.payerId)}</td></tr>
</table>

<h3>Approved Service</h3>
<table>
  <tr><td class="k">Procedure (CPT)</td><td>${esc(record.procedureCode)} — ${esc(record.procedureDescription)}</td></tr>
  <tr><td class="k">Primary Diagnosis (ICD-10)</td><td>${esc(record.diagnosis.code)} — ${esc(record.diagnosis.description)}</td></tr>
  <tr><td class="k">Approved Units / Visits</td><td>${esc(record.units)}</td></tr>
  <tr><td class="k">Date of Service</td><td>${fmt(record.dateOfService)}</td></tr>
  <tr><td class="k">Place of Service</td><td>${esc(c.placeOfService)}</td></tr>
  <tr><td class="k">Approval Effective</td><td>${fmt(record.approvedOn)}</td></tr>
  <tr><td class="k">Authorization Valid Through</td><td>${fmt(record.validThrough)}</td></tr>
</table>

<h3>Rendering Provider</h3>
<table>
  <tr><td class="k">Provider</td><td>${esc(c.renderingProvider.name)} (NPI ${esc(c.renderingProvider.npi)})</td></tr>
  <tr><td class="k">Facility</td><td>${esc(record.facilityName)} (NPI ${esc(c.facilityNpi)})</td></tr>
</table>

<h3>Conditions of Authorization</h3>
<p>This authorization certifies medical necessity only and is not a guarantee of payment. Payment is subject to the member's eligibility on the date of service, benefit limitations, and correct claim submission referencing authorization number ${esc(record.authNumber || '—')}. Services must be rendered by the approved provider within the effective dates above. Claims should be submitted via ${esc(c.submissionMethod)}.</p>

<p>If you disagree with any element of this determination, you may request reconsideration or a peer-to-peer review by contacting the Utilization Management department at the number on the member's ID card within the timeframe specified in the provider manual.</p>

<div class="sig">
<p>Sincerely,<br/><br/>
<b>${esc(payer)} — Utilization Management</b><br/>
Prior Authorization &amp; Medical Review</p>
</div>

<div class="foot">
  <div>CONFIDENTIAL — Protected Health Information (PHI). This determination contains information protected under HIPAA and is intended solely for the named provider and member. Unauthorized disclosure is prohibited.</div>
  <div style="margin-top:4pt;">Reference: ${esc(record.referenceNo)} · Determination generated ${esc(today)}. This demonstration letter is generated by Grelin RCM AI.</div>
</div>
</body>
</html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Authorization-Letter-${safePayer}-${safeAuth}.doc`
  a.click()
  URL.revokeObjectURL(url)
}
