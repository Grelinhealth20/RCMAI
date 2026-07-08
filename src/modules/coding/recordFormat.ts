import { jsPDF } from 'jspdf'
import type { GeneratedRecord, RecordEncounter } from './api/recordApi'

/** Escape HTML-significant characters before applying markdown transforms. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
}

/**
 * Minimal, dependency-free Markdown → HTML for the on-screen note preview:
 * #/##/### headings, `-`/`*` bullet lists, `1.` numbered lists, bold/italics,
 * and paragraphs. (Used only for in-app display; the download is a real PDF.)
 */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = Math.min(4, heading[1].length) + 1 // h2..h5
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    if (ol) {
      if (listType !== 'ol') {
        closeList()
        html.push('<ol>')
        listType = 'ol'
      }
      html.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    if (ul) {
      if (listType !== 'ul') {
        closeList()
        html.push('<ul>')
        listType = 'ul'
      }
      html.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return html.join('\n')
}

// ---------------- Real PDF export (jsPDF, no HTML) ----------------

type RGB = [number, number, number]
const NAVY: RGB = [31, 58, 104]
const INK: RGB = [20, 24, 31]
const MUTE: RGB = [85, 96, 122]
const FAINT: RGB = [138, 146, 166]

const stripInlineMd = (s: string): string =>
  s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2').replace(/`/g, '')

/**
 * Generates and downloads the clinical record as a properly structured, real
 * PDF file (application/pdf) — no HTML, no print dialog. Each encounter renders
 * a header banner, the demographics block (first page), and the Markdown note
 * body with automatic pagination and page footers.
 */
export function downloadRecordPdf(record: GeneratedRecord): boolean {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const mX = 48
    const mTop = 46
    const mBot = 40
    const maxW = W - mX * 2
    const facility = record.patient.facility || 'Regional Medical Center'

    let y = 0
    let started = false
    const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])

    const drawHeader = (enc: RecordEncounter) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      setColor(NAVY)
      doc.text(facility, mX, mTop)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setColor(MUTE)
      doc.text(`${record.specialtyLabel} — Clinical Documentation`, mX, mTop + 12)
      doc.setFontSize(8.5)
      setColor([40, 40, 40])
      const rx = W - mX
      doc.text(record.patient.name || 'Patient', rx, mTop, { align: 'right' })
      doc.text(`MRN ${record.patient.mrn || '—'}   ·   DOB ${record.patient.dob || '—'}`, rx, mTop + 11, { align: 'right' })
      doc.text(`DOS ${enc.dos || '—'}   ·   ${enc.type || 'Clinical Note'}`, rx, mTop + 21, { align: 'right' })
      doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
      doc.setLineWidth(1.4)
      doc.line(mX, mTop + 28, W - mX, mTop + 28)
      y = mTop + 42
    }

    const newPage = (enc: RecordEncounter) => {
      if (started) doc.addPage()
      started = true
      drawHeader(enc)
    }

    const write = (
      text: string,
      opts: { bold?: boolean; size?: number; color?: RGB; indent?: number; gapBefore?: number; gapAfter?: number },
      enc: RecordEncounter,
    ) => {
      const { bold = false, size = 10, color = INK, indent = 0, gapBefore = 0, gapAfter = 3 } = opts
      if (gapBefore) y += gapBefore
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      setColor(color)
      const wrapped = doc.splitTextToSize(text, maxW - indent) as string[]
      for (const ln of wrapped) {
        if (y + size + 3 > H - mBot) newPage(enc)
        doc.text(ln, mX + indent, y)
        y += size + 3
      }
      y += gapAfter
    }

    const renderMd = (md: string, enc: RecordEncounter) => {
      for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
        const line = raw.replace(/\s+$/, '')
        if (!line.trim()) {
          y += 4
          continue
        }
        const h = line.match(/^(#{1,4})\s+(.*)$/)
        const ol = line.match(/^\s*(\d+[.)])\s+(.*)$/)
        const ul = line.match(/^\s*[-*•]\s+(.*)$/)
        if (h) write(stripInlineMd(h[2]).toUpperCase(), { bold: true, size: 10.5, color: NAVY, gapBefore: 7, gapAfter: 4 }, enc)
        else if (ol) write(`${ol[1]}  ${stripInlineMd(ol[2])}`, { indent: 15, gapAfter: 2 }, enc)
        else if (ul) write(`•  ${stripInlineMd(ul[1])}`, { indent: 15, gapAfter: 2 }, enc)
        else write(stripInlineMd(line), { size: 10, gapAfter: 3 }, enc)
      }
    }

    const drawEncTitle = (enc: RecordEncounter, sub: string) => {
      y += 2
      write(`${enc.type || 'Clinical Note'} — ${enc.dos || ''}`, { bold: true, size: 12, color: NAVY, gapAfter: 1 }, enc)
      const meta = `${enc.setting || ''}${enc.reason ? ` · ${enc.reason}` : ''}${sub ? ` · ${sub}` : ''}`
      write(meta, { size: 8.5, color: MUTE, gapAfter: 8 }, enc)
    }

    const drawDemographics = (enc: RecordEncounter) => {
      const p = record.patient
      const rows: [string, string][] = [
        ['Patient', p.name || '—'],
        ['Sex / Age', `${p.sex || '—'}${p.age != null ? ` · ${p.age} y` : ''}`],
        ['DOB', p.dob || '—'],
        ['MRN', p.mrn || '—'],
        ['Insurance', p.insurance || '—'],
        ['Attending', p.attending || '—'],
        ['Referring / PCP', p.pcp || '—'],
        ['Facility', facility],
      ]
      const colW = maxW / 2
      for (let i = 0; i < rows.length; i += 2) {
        if (y + 26 > H - mBot) newPage(enc)
        for (let c = 0; c < 2; c++) {
          const row = rows[i + c]
          if (!row) continue
          const x = mX + c * colW
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.8)
          setColor(FAINT)
          doc.text(row[0].toUpperCase(), x, y)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          setColor(INK)
          const val = (doc.splitTextToSize(row[1], colW - 10) as string[])[0] ?? row[1]
          doc.text(val, x, y + 11)
        }
        y += 26
      }
      y += 6
    }

    record.encounters.forEach((enc, i) => {
      newPage(enc)
      if (i === 0) drawDemographics(enc)
      drawEncTitle(enc, 'Subjective & Objective')
      renderMd(enc.page1, enc)

      newPage(enc)
      drawEncTitle(enc, 'Assessment & Plan')
      renderMd(enc.page2, enc)
    })

    // Footers on every page (now that the total is known).
    const total = doc.getNumberOfPages()
    for (let pageNo = 1; pageNo <= total; pageNo += 1) {
      doc.setPage(pageNo)
      doc.setDrawColor(224, 228, 238)
      doc.setLineWidth(0.6)
      doc.line(mX, H - mBot + 8, W - mX, H - mBot + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      setColor(FAINT)
      doc.text('CONFIDENTIAL — Protected Health Information · Coding QA test record', mX, H - mBot + 18)
      doc.text(`Page ${pageNo} of ${total}`, W - mX, H - mBot + 18, { align: 'right' })
    }

    const slug = (record.patient.name || 'Patient').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')
    doc.save(`Medical-Record-${slug || 'Patient'}.pdf`)
    return true
  } catch {
    return false
  }
}
