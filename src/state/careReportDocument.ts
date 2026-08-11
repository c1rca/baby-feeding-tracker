// A self-contained printable page for a pediatrician visit. Generated as a
// standalone HTML string rather than app markup so printing never has to fight
// the tracker's layout, theme, or print-hostile fixed positioning.
import { formatDuration } from '../domain/feedingUtils'
import { cmToDisplayLength, formatMass, ozToDisplayVolume, type UnitPreferences } from '../domain/units'
import { calculateAgeMonths } from '../domain/growth'
import { healthRecordKindLabel } from '../domain/healthRecords'
import type { CareReport } from '../domain/careReport'

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cell = (value: string | number) => `<td>${escapeHtml(String(value))}</td>`
const headerCell = (value: string) => `<th>${escapeHtml(value)}</th>`

const describeAge = (babyDob: string, at: number) => {
  const months = calculateAgeMonths(babyDob, at)
  if (!babyDob || !Number.isFinite(months)) return 'Age unknown'
  return months < 1 ? 'Under 1 month' : `${months} months`
}

export function buildCareReportHtml(report: CareReport, units: UnitPreferences) {
  const volume = (ounces: number) => `${ozToDisplayVolume(ounces, units.volume)}`
  const dayRows = report.days.map((day) => [
    cell(day.date),
    cell(day.feeds || ''),
    cell(day.nursingSeconds ? formatDuration(day.nursingSeconds) : ''),
    cell(day.bottleOunces ? volume(day.bottleOunces) : ''),
    cell(day.wet || ''),
    cell(day.stool || ''),
    cell(day.sleepMinutes || ''),
    cell(day.tummyMinutes || ''),
    cell(day.pumpOunces ? volume(day.pumpOunces) : ''),
    cell(day.medicines || ''),
  ].join('')).map((row) => `<tr>${row}</tr>`).join('')

  const totalsRow = `<tr class="totals">${[
    cell('Total'),
    cell(report.totals.feeds),
    cell(formatDuration(report.totals.nursingSeconds)),
    cell(volume(report.totals.bottleOunces)),
    cell(report.totals.wet),
    cell(report.totals.stool),
    cell(report.totals.sleepMinutes),
    cell(report.totals.tummyMinutes),
    cell(volume(report.totals.pumpOunces)),
    cell(report.totals.medicines),
  ].join('')}</tr>`

  const averagesRow = `<tr class="totals">${[
    cell('Per day'),
    cell(report.averages.feeds),
    cell(`${report.averages.nursingMinutes} min`),
    cell(volume(report.averages.bottleOunces)),
    cell(report.averages.wet),
    cell(report.averages.stool),
    cell(report.averages.sleepMinutes),
    cell(report.averages.tummyMinutes),
    cell(volume(report.averages.pumpOunces)),
    cell(''),
  ].join('')}</tr>`

  const growthRows = report.growth.length
    ? report.growth.map((measurement) => `<tr>${[
        cell(measurement.date),
        cell(`${measurement.ageMonths} mo`),
        cell(formatMass(measurement.weightLb, units.mass) ?? ''),
        cell(measurement.lengthCm === null ? '' : `${cmToDisplayLength(measurement.lengthCm, units.length)} ${units.length}`),
        cell(measurement.headCm === null ? '' : `${cmToDisplayLength(measurement.headCm, units.length)} ${units.length}`),
        cell(measurement.note ?? ''),
      ].join('')}</tr>`).join('')
    : '<tr><td colspan="6" class="empty">No growth measurements recorded.</td></tr>'

  const healthRows = report.health.length
    ? report.health.map((record) => `<tr>${[
        cell(new Date(record.at).toLocaleDateString()),
        cell(healthRecordKindLabel(record.kind)),
        cell(record.name),
        cell(record.note ?? ''),
      ].join('')}</tr>`).join('')
    : '<tr><td colspan="4" class="empty">No immunisations, milestones, or appointments recorded.</td></tr>'

  const profile = report.babyProfile
  const profileParts = [
    profile.sex ? `Sex ${profile.sex}` : null,
    Number.isFinite(profile.birthWeightLb) ? `Birth weight ${formatMass(profile.birthWeightLb, units.mass)}` : null,
    Number.isFinite(profile.birthLengthCm) ? `Birth length ${cmToDisplayLength(profile.birthLengthCm as number, units.length)} ${units.length}` : null,
    profile.pediatricianName ? `Pediatrician ${profile.pediatricianName}${profile.pediatricianPhone ? ` (${profile.pediatricianPhone})` : ''}` : null,
  ].filter(Boolean)
  const profileLine = profileParts.length ? `<p class="meta">${escapeHtml(profileParts.join(' · '))}</p>` : ''

  const medicineSummary = Object.entries(report.medicineTotals)
  const medicineList = medicineSummary.length
    ? `<ul class="medicine-summary">${medicineSummary.map(([label, count]) => `<li><strong>${escapeHtml(label)}</strong> — ${count} ${count === 1 ? 'dose' : 'doses'}</li>`).join('')}</ul>`
    : '<p class="empty">No medicine doses recorded in this period.</p>'

  const volumeHeader = `Bottle (${units.volume})`
  const pumpHeader = `Pumped (${units.volume})`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Care summary — ${escapeHtml(report.babyName)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1b1b1f; font-size: 13px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 28px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #555; }
  .meta { color: #555; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #d8d8de; padding: 5px 7px; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #f4f4f7; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  tr.totals td { font-weight: 700; background: #fafafc; }
  td.empty, p.empty { color: #777; font-style: italic; text-align: left; }
  ul.medicine-summary { margin: 6px 0; padding-left: 18px; }
  footer { margin-top: 28px; color: #777; font-size: 11px; }
  @media print { body { margin: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Care summary — ${escapeHtml(report.babyName)}</h1>
  <p class="meta">Date of birth ${escapeHtml(report.babyDob || 'not set')} · ${escapeHtml(describeAge(report.babyDob, report.generatedAt))}</p>
  ${profileLine}
  <p class="meta">${escapeHtml(report.rangeStartDate)} to ${escapeHtml(report.rangeEndDate)} (${report.rangeDays} days) · generated ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p>

  <h2>Daily log</h2>
  <table>
    <thead><tr>${['Date', 'Feeds', 'Nursing', volumeHeader, 'Wet', 'Stool', 'Sleep (min)', 'Tummy (min)', pumpHeader, 'Meds'].map(headerCell).join('')}</tr></thead>
    <tbody>${dayRows}${totalsRow}${averagesRow}</tbody>
  </table>

  <h2>Growth</h2>
  <table>
    <thead><tr>${['Date', 'Age', 'Weight', 'Length', 'Head', 'Note'].map(headerCell).join('')}</tr></thead>
    <tbody>${growthRows}</tbody>
  </table>

  <h2>Medicine</h2>
  ${medicineList}

  <h2>Immunisations &amp; milestones</h2>
  <table>
    <thead><tr>${['Date', 'Type', 'Name', 'Note'].map(headerCell).join('')}</tr></thead>
    <tbody>${healthRows}</tbody>
  </table>

  <footer>Generated by Baby Feeding Tracker from caregiver-entered records. Not a medical record.</footer>
</body>
</html>`
}
