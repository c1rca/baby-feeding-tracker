import { Baby, Clock3, Droplets, Moon, TimerReset } from 'lucide-react'

export function CarePreview() {
  const routines = [
    { title: 'Diapers', detail: 'Quick care log', icon: Droplets, tone: 'teal', metric: '3 today' },
    { title: 'Tummy Time', detail: 'Build strength gently', icon: Baby, tone: 'lavender', metric: '10 / 20 min' },
    { title: 'Sleep', detail: 'Rest & recovery', icon: Moon, tone: 'indigo', metric: 'Start a session' },
    { title: 'Pumping', detail: 'Track output & rhythm', icon: TimerReset, tone: 'aqua', metric: 'Start a session' },
  ]
  return <section className="care-preview" aria-labelledby="care-preview-title">
    <div className="care-preview-heading"><div><span className="page-kicker">Your care space</span><h2 id="care-preview-title">Everything your little one needs</h2><p>Simple, calm tools for the moments between feeds.</p></div><span className="care-date-pill"><Clock3 size={14} /> Saturday · July 11</span></div>
    <div className="care-hero-card"><div className="care-hero-orb" /><div><span className="page-kicker">Today’s rhythm</span><h3>A softer way to stay in sync.</h3><p>Keep everyday care close without crowding the moments that matter.</p></div><button type="button">Explore routines</button></div>
    <div className="care-section-heading"><div><span className="page-kicker">Care routines</span><h3>Quick access</h3></div><span>4 routines</span></div>
    <div className="care-routine-grid">{routines.map(({ title, detail, icon: Icon, tone, metric }) => <button key={title} type="button" className={`care-routine-card care-routine--${tone}`}><span className="care-routine-icon"><Icon size={20} /></span><span className="care-routine-copy"><strong>{title}</strong><small>{detail}</small></span><span className="care-routine-metric">{metric}</span><span className="care-routine-arrow">↗</span></button>)}</div>
  </section>
}
