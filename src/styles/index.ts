// The Lullaby stylesheet, split by the section boundaries it already carried.
// It is injected as one string by skin.ts, so the parts are imported inline and
// joined here rather than relying on CSS @import at runtime. Order matters:
// tokens first, responsive and motion overrides last.
import s01 from './01-tokens.css?inline'
import s02 from './02-base.css?inline'
import s03 from './03-background.css?inline'
import s04 from './04-topbar.css?inline'
import s05 from './05-controls.css?inline'
import s06 from './06-cards.css?inline'
import s07 from './07-hero.css?inline'
import s08 from './08-reminders.css?inline'
import s09 from './09-track.css?inline'
import s10 from './10-timeline.css?inline'
import s11 from './11-toast.css?inline'
import s12 from './12-modals.css?inline'
import s13 from './13-settings.css?inline'
import s14 from './14-stats.css?inline'
import s15 from './15-growth.css?inline'
import s16 from './16-responsive.css?inline'
import s17 from './17-motion.css?inline'
import s18 from './18-auth.css?inline'

export const lullabyCss = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16, s17, s18].join('\n')
