/**
 * Appeal document assembly — the deterministic cover sheet (built from the exact
 * user inputs, so identifiers/amounts are always accurate) and a submission-ready
 * PDF (cover sheet page + the AI-drafted appeal letter), formatted for direct
 * transmission to the payer's appeals department.
 */

import { jsPDF } from 'jspdf'
import type { AppealInputs } from './types'

export interface CoverSheet {
  date: string
  toLines: string[]
  fromLines: string[]
  re: string
  fields: [string, string][]
}

const clean = (s: string) => s.trim()

export function buildCoverSheet(i: AppealInputs, subject: string, date: string): CoverSheet {
  const toLines = [
    `${i.payerName || '[Payer]'} — Provider Appeals & Grievances Department`,
    ...(i.payerAppealsAddress ? i.payerAppealsAddress.split('\n').map(clean).filter(Boolean) : []),
  ]
  const fromLines = [
    [i.providerName, i.providerCredentials].filter(Boolean).join(', ') || '[Provider Name]',
    i.facilityName,
    i.facilityAddress,
    i.facilityPhone ? `Tel: ${i.facilityPhone}` : '',
    i.providerNpi ? `NPI: ${i.providerNpi}` : '',
  ].filter(Boolean)

  const denial = [i.denialCarc, i.denialReason].filter(Boolean).join(' — ')
  const fields: [string, string][] = [
    ['Patient', i.patientName || '—'],
    ['Member / Subscriber ID', i.memberId || '—'],
    ['Claim Number', i.claimId || '—'],
    ['Date(s) of Service', i.dateOfService || '—'],
    ['Billed Amount', i.billedAmount || '—'],
    ['Procedure(s)', i.cptCodes || '—'],
    ['Diagnosis', i.diagnosis || '—'],
    ['Denial Reason', denial || '—'],
    ['Appeal Level', i.appealLevel || 'First-Level Provider Appeal'],
  ]

  return {
    date,
    toLines,
    fromLines,
    re: subject || `Appeal of Denied Claim ${i.claimId || ''}`.trim(),
    fields,
  }
}

/** Safe file-name slug from the claim id / patient. */
function fileSlug(i: AppealInputs): string {
  const base = i.claimId || i.patientName || 'appeal'
  return base.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'appeal'
}

const NAVY = 15
const INK = 20

export function downloadAppealPdf(i: AppealInputs, cover: CoverSheet, letter: string): boolean {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 56
    const maxW = pageW - margin * 2

    /* ---------- Page 1 — cover sheet ---------- */
    // Header band
    doc.setFillColor(11, 20, 36)
    doc.rect(0, 0, pageW, 74, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text('CLAIM DENIAL APPEAL', margin, 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Provider Appeal Submission — Cover Sheet', margin, 52)
    doc.setFontSize(9)
    doc.text(`Date: ${cover.date}`, pageW - margin, 34, { align: 'right' })

    let y = 108
    doc.setTextColor(NAVY, NAVY, NAVY)

    const label = (t: string, yy: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(90, 100, 120)
      doc.text(t.toUpperCase(), margin, yy)
    }
    const block = (lines: string[], yy: number): number => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(INK, INK, INK)
      let ly = yy
      for (const ln of lines) {
        const wrapped = doc.splitTextToSize(ln, maxW) as string[]
        for (const w of wrapped) {
          doc.text(w, margin, ly)
          ly += 14
        }
      }
      return ly
    }

    label('To', y)
    y = block(cover.toLines, y + 14) + 8
    label('From', y)
    y = block(cover.fromLines, y + 14) + 8

    label('Re', y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(NAVY, NAVY, NAVY)
    y += 14
    for (const w of doc.splitTextToSize(cover.re, maxW) as string[]) {
      doc.text(w, margin, y)
      y += 15
    }
    y += 8

    // Divider
    doc.setDrawColor(210, 216, 226)
    doc.line(margin, y, pageW - margin, y)
    y += 20

    // Key/value fields
    const labelW = 150
    doc.setFontSize(10)
    for (const [k, v] of cover.fields) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(90, 100, 120)
      doc.text(k, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(INK, INK, INK)
      const wrapped = doc.splitTextToSize(v, maxW - labelW) as string[]
      doc.text(wrapped[0] ?? '—', margin + labelW, y)
      for (let k2 = 1; k2 < wrapped.length; k2++) {
        y += 13
        doc.text(wrapped[k2], margin + labelW, y)
      }
      y += 18
    }

    // Confidentiality footer
    doc.setDrawColor(210, 216, 226)
    doc.line(margin, pageH - 74, pageW - margin, pageH - 74)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(120, 128, 142)
    doc.text(
      doc.splitTextToSize(
        'CONFIDENTIAL — This transmission contains Protected Health Information (PHI) intended only for the named payer’s appeals department. If received in error, please notify the sender and destroy all copies.',
        maxW,
      ) as string[],
      margin,
      pageH - 58,
    )

    /* ---------- Page 2+ — the appeal letter ---------- */
    doc.addPage()
    doc.setTextColor(INK, INK, INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    let ly = margin
    const lineH = 15
    const paragraphs = letter.replace(/\r/g, '').split('\n')
    for (const para of paragraphs) {
      if (para.trim() === '') {
        ly += lineH * 0.7
        continue
      }
      const wrapped = doc.splitTextToSize(para, maxW) as string[]
      for (const w of wrapped) {
        if (ly > pageH - margin) {
          doc.addPage()
          ly = margin
        }
        doc.text(w, margin, ly)
        ly += lineH
      }
    }

    // Page numbers
    const pages = doc.getNumberOfPages()
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(150, 156, 168)
      doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 24, { align: 'right' })
    }

    doc.save(`appeal-${fileSlug(i)}.pdf`)
    return true
  } catch {
    return false
  }
}
