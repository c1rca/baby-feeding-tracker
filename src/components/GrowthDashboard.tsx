import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Activity, Plus, Ruler, Scale, Trash2, X } from 'lucide-react'
import { buildGrowthMetricModels, calculateAgeMonths, GROWTH_PERCENTILE_LINES, GROWTH_REFERENCE_SOURCE } from '../domain/growth'
import type { GrowthMeasurement, GrowthMetricKey } from '../domain/growthTypes'

type GrowthDashboardProps = {
  growthMeasurements: GrowthMeasurement[]
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  babyDob: string
}

const lineLabels: Record<(typeof GROWTH_PERCENTILE_LINES)[number], string> = {
  p3: '3rd', p10: '10th', p25: '25th', p50: '50th', p75: '75th', p90: '90th', p97: '97th',
}
const metricIcons: Record<GrowthMetricKey, typeof Scale> = { weight: Scale, length: Ruler, head: Activity }
const metricCopy: Record<GrowthMetricKey, string> = {
  weight: 'Weight-for-age',
  length: 'Length-for-age',
  head: 'Head circumference-for-age',
}

const todayInput = () => new Date().toISOString().slice(0, 10)
const toDateInput = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const parseNumber = (value: string) => value.trim() === '' ? null : Number(value)
const formatPercentile = (percentile: number) => `${percentile}${percentile === 1 ? 'st' : percentile === 2 ? 'nd' : percentile === 3 ? 'rd' : 'th'}`

export function GrowthDashboard({ growthMeasurements, setGrowthMeasurements, babyDob }: GrowthDashboardProps) {
  const [draft, setDraft] = useState({ measuredAt: todayInput(), weightLb: '', lengthCm: '', headCm: '', note: '' })
  const [activeMetric, setActiveMetric] = useState<GrowthMetricKey>('weight')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const models = useMemo(() => buildGrowthMetricModels(growthMeasurements), [growthMeasurements])
  const activeModel = models.find((model) => model.metric.key === activeMetric) ?? models[0]
  const measuredAt = new Date(`${draft.measuredAt}T12:00:00`).getTime()
  const ageMonths = calculateAgeMonths(babyDob, measuredAt)

  const closeModal = () => setIsModalOpen(false)
  const saveMeasurement = (event: FormEvent) => {
    event.preventDefault()
    const weightLb = parseNumber(draft.weightLb)
    const lengthCm = parseNumber(draft.lengthCm)
    const headCm = parseNumber(draft.headCm)
    if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 24 || !Number.isFinite(measuredAt)) return
    if (weightLb === null && lengthCm === null && headCm === null) return
    setGrowthMeasurements((current) => [{ id: `growth-${Date.now()}`, measuredAt, ageMonths, weightLb, lengthCm, headCm, note: draft.note.trim() || undefined }, ...current])
    setDraft({ measuredAt: todayInput(), weightLb: '', lengthCm: '', headCm: '', note: '' })
    closeModal()
  }

  return (
    <section className="growth-section growth-premium" aria-label="Growth percentile tracker">
      <div className="growth-hero-panel">
        <div className="growth-hero-copy">
          <p className="eyebrow">Growth clinic</p>
          <h2>Percentile tracking, beautifully organized.</h2>
          <p>Chart weight, length, and head circumference against WHO/CDC boys 0–24 month standards with one focused clinical view.</p>
          <div className="growth-hero-actions">
            <button className="primary growth-open-modal" type="button" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Add measurement</button>
            <span>{GROWTH_REFERENCE_SOURCE}</span>
          </div>
        </div>
        <div className="growth-hero-metric" aria-label="Latest growth snapshot">
          <span>{activeModel.metric.label}</span>
          <strong>{activeModel.latest ? formatPercentile(activeModel.latest.percentile) : '—'}</strong>
          <small>{activeModel.latest ? `${activeModel.latest.value} ${activeModel.metric.unit} · ${activeModel.latest.ageMonths} mo` : 'No measurement yet'}</small>
        </div>
      </div>

      <div className="growth-workbench card">
        <div className="growth-tabs" role="tablist" aria-label="Growth chart metric">
          {models.map(({ metric, latest }) => {
            const Icon = metricIcons[metric.key]
            return (
              <button key={metric.key} type="button" role="tab" aria-selected={activeMetric === metric.key} className={activeMetric === metric.key ? 'active' : ''} onClick={() => setActiveMetric(metric.key)}>
                <Icon size={17} />
                <span>{metric.label}</span>
                <strong>{latest ? formatPercentile(latest.percentile) : 'No data'}</strong>
              </button>
            )
          })}
        </div>
        <div className="growth-chart-stage">
          <div className="growth-chart-title">
            <div>
              <p className="eyebrow">{metricCopy[activeModel.metric.key]}</p>
              <h3>{activeModel.metric.label} percentile curve</h3>
            </div>
            <span>{activeModel.metric.unit}</span>
          </div>
          <GrowthChart model={activeModel} />
        </div>
      </div>

      <div className="growth-latest-grid">
        {models.map(({ metric, latest }) => (
          <article className="card growth-latest" key={metric.key}>
            <span>{metric.label}</span>
            <strong>{latest ? `${formatPercentile(latest.percentile)} percentile` : 'No data yet'}</strong>
            <small>{latest ? `${latest.value} ${metric.unit} at ${latest.ageMonths} mo` : 'Add a measurement to plot the baby dot.'}</small>
          </article>
        ))}
      </div>

      <div className="card growth-history">
        <div className="growth-history-header"><h3>Measurement history</h3><button type="button" onClick={() => setIsModalOpen(true)}><Plus size={15} /> Add</button></div>
        {growthMeasurements.length === 0 ? <p className="muted">No growth measurements logged yet.</p> : growthMeasurements.map((m) => (
          <div className="growth-row" key={m.id}>
            <div><strong>{toDateInput(m.measuredAt)}</strong><small>{m.ageMonths} mo{m.note ? ` · ${m.note}` : ''}</small></div>
            <span>{[m.weightLb && `${m.weightLb} lb`, m.lengthCm && `${m.lengthCm} cm`, m.headCm && `${m.headCm} cm head`].filter(Boolean).join(' · ')}</span>
            <button className="icon-plain" aria-label="Delete growth measurement" onClick={() => setGrowthMeasurements((current) => current.filter((item) => item.id !== m.id))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <form className="modal growth-modal" aria-label="Add growth measurement" onSubmit={saveMeasurement} onMouseDown={(event) => event.stopPropagation()}>
            <div className="growth-modal-header">
              <div><p className="eyebrow">New measurement</p><h2>Add growth visit</h2><span>Age auto-calculates from DOB: {babyDob}</span></div>
              <button className="icon-plain" type="button" aria-label="Close growth measurement form" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="growth-form-grid">
              <label>Date<input type="date" value={draft.measuredAt} onChange={(e) => setDraft((d) => ({ ...d, measuredAt: e.target.value }))} /></label>
              <label>Age<input readOnly value={`${ageMonths} months`} aria-label="Calculated age in months" /></label>
              <label>Weight (lb)<input inputMode="decimal" placeholder="13.2" value={draft.weightLb} onChange={(e) => setDraft((d) => ({ ...d, weightLb: e.target.value }))} /></label>
              <label>Length (cm)<input inputMode="decimal" placeholder="60.5" value={draft.lengthCm} onChange={(e) => setDraft((d) => ({ ...d, lengthCm: e.target.value }))} /></label>
              <label>Head (cm)<input inputMode="decimal" placeholder="40.2" value={draft.headCm} onChange={(e) => setDraft((d) => ({ ...d, headCm: e.target.value }))} /></label>
              <label className="growth-note">Note<input placeholder="Doctor visit" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} /></label>
            </div>
            <div className="growth-modal-actions"><button type="button" onClick={closeModal}>Cancel</button><button className="primary" type="submit"><Plus size={16} /> Save measurement</button></div>
          </form>
        </div>
      ) : null}
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
  const x = (month: number) => 48 + (month / 24) * 560
  const y = (value: number) => 302 - ((value - min) / (max - min || 1)) * 230
  return (
    <svg className="growth-chart growth-chart-large" viewBox="0 0 650 340" role="img" aria-label={`${metric.label} percentile chart`}>
      <defs>
        <linearGradient id={`growthLine-${metric.key}`} x1="0" x2="1"><stop stopColor="#06b6d4" /><stop offset="1" stopColor="#6366f1" /></linearGradient>
      </defs>
      <line x1="48" x2="608" y1="302" y2="302" />
      <line x1="48" x2="48" y1="54" y2="302" />
      {[0, 6, 12, 18, 24].map((month) => <text key={month} x={x(month)} y="326">{month} mo</text>)}
      {GROWTH_PERCENTILE_LINES.map((line) => {
        const path = metric.standards.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.month).toFixed(1)} ${y(point[line]).toFixed(1)}`).join(' ')
        return <path key={line} className={line === 'p50' ? 'p50' : ''} d={path} />
      })}
      {GROWTH_PERCENTILE_LINES.map((line) => {
        const last = metric.standards.at(-1)!
        return <text className="percentile-label" key={line} x="616" y={y(last[line]) + 3}>{lineLabels[line]}</text>
      })}
      {babyPoints.map((point) => <circle key={point.measurement.id} className="baby-point" cx={x(point.ageMonths)} cy={y(point.value)} r="7"><title>{`${point.value} ${metric.unit}, ${formatPercentile(point.percentile)} percentile`}</title></circle>)}
    </svg>
  )
}
