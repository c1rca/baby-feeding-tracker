import { BarChart3, Baby, ClipboardList, LayoutDashboard, Settings2, Sparkles } from 'lucide-react'
import type { View } from '../types'

type Props = { view: View | 'care'; setView: (view: View | 'care') => void; settingsOpen: boolean; setSettingsOpen: (open: boolean) => void }

export function PremiumSidebar({ view, setView, settingsOpen, setSettingsOpen }: Props) {
  const items = [
    { id: 'track' as const, label: 'Track', detail: 'Live care dashboard', icon: LayoutDashboard },
    { id: 'care' as const, label: 'Care', detail: 'Daily routines', icon: ClipboardList },
    { id: 'stats' as const, label: 'Insights', detail: 'Patterns & progress', icon: BarChart3 },
  ]
  return <aside className="premium-sidebar" aria-label="Primary navigation">
    <div className="sidebar-brand"><span className="sidebar-brand-mark"><Baby size={21} /></span><div><strong>Lullaby</strong><span>care companion</span></div></div>
    <div className="sidebar-section-label">Workspace</div>
    <nav className="sidebar-nav">{items.map(({ id, label, detail, icon: Icon }) => <button key={id} type="button" className={`sidebar-nav-item ${view === id ? 'is-active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><span className="sidebar-nav-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{detail}</small></span>{view === id ? <span className="sidebar-active-dot" /> : null}</button>)}</nav>
    <div className="sidebar-spacer" />
    <div className="sidebar-soft-card"><Sparkles size={16} /><div><strong>Gentle rhythm</strong><span>Small moments add up.</span></div></div>
    <button type="button" className={`sidebar-settings ${settingsOpen ? 'is-active' : ''}`} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={18} /><span>Settings</span></button>
    <div className="sidebar-profile"><span className="sidebar-avatar">A</span><span><strong>Family space</strong><small>Private & synced</small></span></div>
  </aside>
}
