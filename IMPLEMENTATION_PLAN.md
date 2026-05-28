# Baby Feeding Tracker Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a fast, modern baby feeding tracker for logging breastfeeding and bottle sessions with minimal taps.

**Architecture:** Create a responsive, offline-first single-page app with a polished mobile-first interface and local persistence. The core flow centers on a one-handed “start/stop feeding” experience, quick bottle logging, and a clean daily timeline with totals. Keep the first version simple and reliable: local app state, localStorage/IndexedDB persistence, strong data model, and export-ready structure.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn-style UI primitives, date-fns, Vitest + Testing Library, optional PWA support.

---

## Product Requirements

### Primary use cases
- Start a breastfeeding session quickly.
- Track left vs right side and switch sides during a session.
- Track elapsed time per side and total session duration.
- Log bottle feeding with ounces drank.
- View today’s feeding history at a glance.
- Edit/delete mistaken entries.
- See simple daily totals: total feeds, nursing time, bottle ounces, left/right split.

### UX principles
- **One-handed mobile-first:** large tap targets, bottom actions, minimal typing.
- **Fast in the dark:** high contrast, calm colors, optional dark mode from day one.
- **No modal maze:** primary flow stays on one screen.
- **Forgiving:** easy pause/resume, switch side, edit entries, undo delete.
- **Professional polish:** modern card layout, refined spacing, soft gradients, clear hierarchy.

### Core screens
1. **Dashboard / Active Feed**
   - Big active timer.
   - Breastfeeding quick controls: `Start Left`, `Start Right`, `Switch Side`, `Pause`, `End`.
   - Bottle quick log: ounces stepper and save button.
   - Today summary cards.
2. **Timeline**
   - Chronological feed list grouped by date.
   - Feed type badges: Breast, Bottle, Mixed.
   - Shows duration, left/right split, ounces, start time.
3. **Edit Feed Sheet**
   - Adjust start/end time.
   - Adjust left/right duration.
   - Adjust bottle ounces.
   - Add notes.
4. **Settings / Data**
   - Baby name optional.
   - Unit preference: ounces first; keep structure ready for ml later.
   - Export JSON.
   - Clear local data with confirmation.

---

## Data Model

```ts
export type FeedingType = 'breast' | 'bottle' | 'mixed'
export type BreastSide = 'left' | 'right'

export type SideSegment = {
  side: BreastSide
  startedAt: string
  endedAt: string
  durationSeconds: number
}

export type FeedingEntry = {
  id: string
  type: FeedingType
  startedAt: string
  endedAt: string
  leftSeconds: number
  rightSeconds: number
  bottleOunces: number | null
  sideSegments: SideSegment[]
  notes: string
  createdAt: string
  updatedAt: string
}

export type ActiveFeedingSession = {
  id: string
  startedAt: string
  activeSide: BreastSide | null
  activeSegmentStartedAt: string | null
  pausedAt: string | null
  sideSegments: SideSegment[]
  bottleOunces: number | null
}
```

### Derived totals
- `totalDurationSeconds = leftSeconds + rightSeconds`
- `dailyBottleOunces = sum(bottleOunces)`
- `dailyNursingSeconds = sum(leftSeconds + rightSeconds)`
- `lastFeedAt = max(endedAt)`
- `timeSinceLastFeed = now - lastFeedAt`

---

## Visual Design Direction

### Theme
- Calm premium health-app feel.
- Background: warm off-white / subtle slate dark mode.
- Accent palette: soft mint, lavender, peach, deep navy text.
- Use gradients sparingly for the active session hero card.

### Layout
- Mobile first at `390px` width.
- Desktop should become a centered max-width app shell with two columns:
  - left: active feed + quick log
  - right: summary + timeline

### Components
- `AppShell` — responsive page frame.
- `ActiveFeedCard` — timer + side controls.
- `BottleQuickLogCard` — ounces stepper + save.
- `TodaySummary` — metric cards.
- `FeedingTimeline` — list/grouping.
- `FeedEntryCard` — per-entry details.
- `EditFeedSheet` — edit form.
- `BottomNav` — optional mobile navigation if screens split.

---

## Project Setup Plan

### Task 1: Initialize React/Vite project

**Objective:** Create the app scaffold in the current project directory.

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Steps:**
1. Run `npm create vite@latest . -- --template react-ts`.
2. Install dependencies:
   ```bash
   npm install date-fns lucide-react clsx tailwind-merge
   npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/user-event jsdom
   ```
3. Configure scripts:
   - `dev`
   - `build`
   - `lint`
   - `test`
4. Verify:
   ```bash
   npm run build
   npm test
   ```

### Task 2: Add styling foundation

**Objective:** Establish modern UI styling, tokens, and layout primitives.

**Files:**
- Modify: `src/styles.css`
- Create: `src/lib/cn.ts`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`

**Design notes:**
- Use CSS variables for light/dark colors.
- Buttons must have minimum `44px` touch target.
- Cards should have soft borders, subtle shadows, rounded `2xl` corners.

**Verification:**
- App renders without horizontal overflow on mobile viewport.
- Components have visible focus states.

### Task 3: Define feeding domain types and utilities

**Objective:** Create the domain layer before UI state.

**Files:**
- Create: `src/domain/feedingTypes.ts`
- Create: `src/domain/feedingUtils.ts`
- Create: `src/domain/feedingUtils.test.ts`

**Test cases:**
- Calculates left/right totals from side segments.
- Formats duration as `12m 30s` and `1h 05m`.
- Computes daily totals from mixed entries.
- Sorts entries newest-first.

**Verification:**
```bash
npm test -- feedingUtils
```

### Task 4: Add local persistence store

**Objective:** Persist feeding entries and active session locally.

**Files:**
- Create: `src/storage/feedingStorage.ts`
- Create: `src/storage/feedingStorage.test.ts`

**Requirements:**
- Save/load entries from localStorage.
- Save/load active session separately.
- Validate malformed payloads defensively.
- Keep storage keys versioned:
  - `baby-feeding-tracker:v1:entries`
  - `baby-feeding-tracker:v1:active-session`

**Verification:**
- Tests cover empty, valid, malformed, and migration-ready payloads.

### Task 5: Build feeding state hook

**Objective:** Centralize session logic and entry mutations.

**Files:**
- Create: `src/hooks/useFeedingTracker.ts`
- Create: `src/hooks/useFeedingTracker.test.tsx`

**Hook API:**
```ts
const tracker = useFeedingTracker()
tracker.entries
tracker.activeSession
tracker.startBreastSession('left')
tracker.switchSide('right')
tracker.pauseSession()
tracker.resumeSession('left')
tracker.endSession()
tracker.logBottle(ounces)
tracker.updateEntry(entry)
tracker.deleteEntry(id)
```

**Behavior requirements:**
- Starting side creates active session.
- Switching side closes previous segment and starts new one.
- Ending session creates a `FeedingEntry`.
- Bottle-only logging creates an entry immediately.
- Mixed feeding is possible by adding bottle ounces before ending breast session.

### Task 6: Build active breastfeeding UI

**Objective:** Make the core interaction fast and visually excellent.

**Files:**
- Create: `src/components/ActiveFeedCard.tsx`
- Create: `src/components/SideToggle.tsx`
- Create: `src/components/FeedingTimer.tsx`

**UX details:**
- Hero card shows large elapsed timer.
- Left/right controls are thumb-friendly segmented buttons.
- Active side has strong visual state.
- Primary action changes by state:
  - no session: `Start Left`, `Start Right`
  - active: `Switch`, `Pause`, `End Feed`
  - paused: `Resume Left`, `Resume Right`, `End Feed`

**Verification:**
- Manual: can start left, switch right, end session.
- Automated: component test for button states.

### Task 7: Build bottle quick log UI

**Objective:** Log bottle ounces in under 3 taps.

**Files:**
- Create: `src/components/BottleQuickLogCard.tsx`
- Create: `src/components/OunceStepper.tsx`

**UX details:**
- Default value: `2.0 oz`.
- Step controls: `-0.5`, `+0.5`.
- Quick chips: `1 oz`, `2 oz`, `3 oz`, `4 oz`.
- Save button: `Log bottle`.
- On save, show a subtle success toast.

### Task 8: Build today summary

**Objective:** Give caregivers instant confidence about the day.

**Files:**
- Create: `src/components/TodaySummary.tsx`
- Create: `src/components/SummaryMetricCard.tsx`

**Metrics:**
- Feeds today.
- Nursing time.
- Bottle ounces.
- Time since last feed.
- Left/right split.

### Task 9: Build timeline and entry cards

**Objective:** Make history scannable and editable.

**Files:**
- Create: `src/components/FeedingTimeline.tsx`
- Create: `src/components/FeedEntryCard.tsx`

**Card content:**
- Start time.
- Type badge.
- Duration and side split.
- Ounces if bottle/mixed.
- Notes preview.
- Edit/delete actions.

### Task 10: Add edit feed sheet

**Objective:** Allow correcting mistakes without data loss.

**Files:**
- Create: `src/components/EditFeedSheet.tsx`

**Fields:**
- Type.
- Start time.
- End time.
- Left minutes.
- Right minutes.
- Bottle ounces.
- Notes.

**Validation:**
- End time must be after start time.
- Durations cannot be negative.
- Bottle ounces cannot be negative.

### Task 11: Compose app shell

**Objective:** Assemble the polished product experience.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/AppShell.tsx`

**Layout:**
- Header with baby name and current date.
- Active feeding card at top.
- Bottle quick log below or beside active card.
- Summary metrics.
- Timeline.
- Sticky bottom safe-area action affordance on mobile if needed.

### Task 12: Add empty states, toasts, and accessibility polish

**Objective:** Make the app feel complete and safe.

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: key components

**Requirements:**
- Empty timeline state with friendly copy.
- Undo delete toast.
- ARIA labels for timer and side controls.
- Visible focus rings.
- Reduced-motion-safe transitions.

### Task 13: Add responsive QA pass

**Objective:** Verify excellent UI/UX across device sizes.

**Checks:**
- Mobile `390x844`.
- Small mobile `360x740`.
- Tablet `768x1024`.
- Desktop `1440x900`.
- Dark mode if implemented.

**Acceptance:**
- No horizontal overflow.
- Primary actions reachable with thumb on mobile.
- Timeline readable with long notes.
- Active timer remains obvious.

### Task 14: Final validation and README

**Objective:** Document how to run and verify the project.

**Files:**
- Create: `README.md`

**README content:**
- Project overview.
- Run commands.
- Feature list.
- Data storage note.
- Future roadmap.

**Final commands:**
```bash
npm run build
npm test
```

---

## Acceptance Criteria

- User can log breastfeeding by side with accurate time tracking.
- User can switch left/right during a session.
- User can pause/resume/end a session.
- User can log bottle ounces quickly.
- User can view daily totals and timeline.
- User can edit/delete entries.
- Data persists after refresh.
- UI is mobile-first, modern, polished, accessible, and quick to use.
- Build and tests pass.

---

## Future Enhancements

- Multiple caregivers sync.
- Cloud backup.
- Growth/diaper/sleep tracking.
- Feeding reminders.
- CSV export.
- Charts by week/month.
- Pediatrician report view.
- Native mobile wrapper via Capacitor.
