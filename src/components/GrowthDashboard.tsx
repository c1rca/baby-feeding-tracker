import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { buildGrowthMetricModels, calculateAgeMonths, GROWTH_PERCENTILE_LINES, GROWTH_REFERENCE_SOURCE } from '../domain/growth'
import type { GrowthMeasurement } from '../domain/growthTypes'

type GrowthDashboardProps = {
  growthMeasurements: GrowthMeasurement[]
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  babyDob: string
}

const lineLabels: Record<(typeof GROWTH_PERCENTILE_LINES)[number], string> = {
  p3: '3rd', p10: '10th', p25: '25th', p50: '50th', p75: '75th', p90: '90th', p97: '97th',
}

const todayInput = () => new Date().toISOString().slice(0, 10)
const toDateInput = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const parseNumber = (value: string) => value.trim() === '' ? null : Number(value)

export function GrowthDashboard({ growthMeasurements, setGrowthMeasurements, babyDob }: GrowthDashboardProps) {
  const [draft, setDraft] = useState({ measuredAt: todayInput(), weightLb: '', lengthCm: '', headCm: '', note: '' })
  const models = useMemo(() => buildGrowthMetricModels(growthMeasurements), [growthMeasurements])
  const measuredAt = new Date(`${draft.measuredAt}T12:00:00`).getTime()
  const ageMonths = calculateAgeMonths(babyDob, measuredAt)

  const saveMeasurement = (event: FormEvent) => {
    event.preventDefault()
    const weightLb = parseNumber(draft.weightLb)
    const lengthCm = parseNumber(draft.lengthCm)
    const headCm = parseNumber(draft.headCm)
    if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 24 || !Number.isFinite(measuredAt)) return
    if (weightLb === null && lengthCm === null && headCm === null) return
    setGrowthMeasurements((current) => [{ id: `growth-${Date.now()}`, measuredAt, ageMonths, weightLb, lengthCm, headCm, note: draft.note.trim() || undefined }, ...current])
    setDraft({ measuredAt: todayInput(), weightLb: '', lengthCm: '', headCm: '', note: '' })
  }

  return (
    <section className="growth-section" aria-label="Growth percentile tracker">
      <div className="growth-header-card">
        <div>
          <p className="eyebrow">Growth</p>
          <h2>Doctor-style percentile tracking</h2>
          <p>Track weight, length, and head circumference against boys 0–24 month WHO growth curves.</p>
        </div>
        <p className="growth-source">{GROWTH_REFERENCE_SOURCE}</p>
      </div>

      <form className="growth-form card" onSubmit={saveMeasurement}>
        <label>Date<input type="date" value={draft.measuredAt} onChange={(e) => setDraft((d) => ({ ...d, measuredAt: e.target.value }))} /></label>
        <label>Age<input readOnly value={`${ageMonths} months`} aria-label="Calculated age in months" /></label>
        <label>Weight (lb)<input inputMode="decimal" placeholder="13.2" value={draft.weightLb} onChange={(e) => setDraft((d) => ({ ...d, weightLb: e.target.value }))} /></label>
        <label>Length (cm)<input inputMode="decimal" placeholder="60.5" value={draft.lengthCm} onChange={(e) => setDraft((d) => ({ ...d, lengthCm: e.target.value }))} /></label>
        <label>Head (cm)<input inputMode="decimal" placeholder="40.2" value={draft.headCm} onChange={(e) => setDraft((d) => ({ ...d, headCm: e.target.value }))} /></label>
        <label className="growth-note">Note<input placeholder="Doctor visit" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} /></label>
        <button className="primary growth-add" type="submit"><Plus size={16} /> Add measurement</button>
      </form>

      <div className="growth-latest-grid">
        {models.map(({ metric, latest }) => (
          <article className="card growth-latest" key={metric.key}>
            <span>{metric.label}</span>
            <strong>{latest ? `${latest.percentile}th percentile` : 'No data yet'}</strong>
            <small>{latest ? `${latest.value} ${metric.unit} at ${latest.ageMonths} mo` : 'Add a measurement to plot the baby dot.'}</small>
          </article>
        ))}
      </div>

      <div className="growth-chart-grid">
        {models.map((model) => <GrowthChart key={model.metric.key} model={model} />)}
      </div>

      <div className="card growth-history">
        <h3>Measurements</h3>
        {growthMeasurements.length === 0 ? <p className="muted">No growth measurements logged yet.</p> : growthMeasurements.map((m) => (
          <div className="growth-row" key={m.id}>
            <div><strong>{toDateInput(m.measuredAt)}</strong><small>{m.ageMonths} mo{m.note ? ` · ${m.note}` : ''}</small></div>
            <span>{[m.weightLb && `${m.weightLb} lb`, m.lengthCm && `${m.lengthCm} cm`, m.headCm && `${m.headCm} cm head`].filter(Boolean).join(' · ')}</span>
            <button className="icon-plain" aria-label="Delete growth measurement" onClick={() => setGrowthMeasurements((current) => current.filter((item) => item.id !== m.id))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}

type GrowthChartProps = { model: ReturnType<typeof buildGrowthMetricModels>[number] }

function GrowthChart({ model }: GrowthChartProps) {
  const { metric, babyPoints } = model
  const values = metric.standards.flatMap((point) => GROWTH_PERCENTILE_LINES.map((line) => point[line]))
  const plottedValues = babyPoints.map((point) => point.value)
  const min = Math.min(...values, ...plottedValues)
  const max = Math.max(...values, ...plottedValues)
  const x = (month: number) => 36 + (month / 24) * 292
  const y = (value: number) => 214 - ((value - min) / (max - min || 1)) * 170
  return (
    <article className="card growth-chart-card">
      <div className="growth-chart-title"><h3>{metric.label}</h3><span>{metric.unit}</span></div>
      <svg className="growth-chart" viewBox="0 0 360 240" role="img" aria-label={`${metric.label} percentile chart`}>
        <line x1="36" x2="328" y1="214" y2="214" />
        <line x1="36" x2="36" y1="36" y2="214" />
        {[0, 6, 12, 18, 24].map((month) => <text key={month} x={x(month)} y="232">{month}</text>)}
        {GROWTH_PERCENTILE_LINES.map((line) => {
          const path = metric.standards.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.month).toFixed(1)} ${y(point[line]).toFixed(1)}`).join(' ')
          return <path key={line} className={line === 'p50' ? 'p50' : ''} d={path} />
        })}
        {GROWTH_PERCENTILE_LINES.map((line) => {
          const last = metric.standards.at(-1)!
          return <text className="percentile-label" key={line} x="332" y={y(last[line]) + 3}>{lineLabels[line]}</text>
        })}
        {babyPoints.map((point) => <circle key={point.measurement.id} className="baby-point" cx={x(point.ageMonths)} cy={y(point.value)} r="5"><title>{`${point.value} ${metric.unit}, ${point.percentile}th percentile`}</title></circle>)}
      </svg>
    </article>
  )
}
