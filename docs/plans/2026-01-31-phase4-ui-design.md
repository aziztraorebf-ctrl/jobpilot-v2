# Phase 4 - UI Design Plan

## Context

JobPilot backend is complete: Adzuna + JSearch aggregator, OpenAI scorer, CV parser, cover letter generator, Resend email. 40 unit tests + integration tests passing. No frontend pages built yet (default Next.js template). This plan covers the full UI implementation with mock data.

## Design Decisions (from brainstorming)

- **Priority**: Dashboard (resume + actions) > Applications pipeline > Jobs list > Settings
- **Pipeline style**: Kanban + List toggle
- **Visual style**: Modern/colorful with dark mode support
- **Data**: Mock data only (no Supabase connection yet)
- **i18n**: French default, English available (next-intl already configured)

## Available Tools

- 13 shadcn/ui components: badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, tabs, textarea, sonner
- Tailwind CSS v4 with OKLch color system, dark mode
- next-themes for dark/light toggle
- Lucide React icons
- Geist font (sans + mono)

---

## Architecture

### Route Structure (App Router)

```
src/app/
  layout.tsx              -- Root layout (fonts, metadata)
  [locale]/
    layout.tsx            -- App shell: ThemeProvider + Sidebar + Main area
    dashboard/
      page.tsx            -- Dashboard page
    jobs/
      page.tsx            -- Jobs list page
    applications/
      page.tsx            -- Pipeline page (Kanban + List)
    settings/
      page.tsx            -- Settings page
    login/
      page.tsx            -- Login page (placeholder)
```

### Component Structure

```
src/components/
  layout/
    app-sidebar.tsx       -- Sidebar navigation (logo + nav items + user)
    app-header.tsx        -- Top header (page title + dark mode toggle)
    theme-provider.tsx    -- next-themes ThemeProvider wrapper
    theme-toggle.tsx      -- Sun/Moon dark mode toggle button
  dashboard/
    stats-cards.tsx       -- 4 metric cards (new jobs, avg score, applications, interviews)
    top-jobs.tsx          -- Top 5 scored jobs with quick actions
    recent-applications.tsx -- Last 3 applications mini-table
  jobs/
    job-filters.tsx       -- Filter bar (search, source, remote, salary, score)
    job-card.tsx          -- Single job result card
    job-list.tsx          -- List of job cards
  applications/
    kanban-board.tsx      -- Kanban columns view
    kanban-column.tsx     -- Single column (Saved, Applied, etc.)
    kanban-card.tsx       -- Draggable application card
    list-view.tsx         -- Table/list view alternative
    view-toggle.tsx       -- Kanban/List toggle switch
  settings/
    profile-form.tsx      -- Name, email, language
    search-preferences.tsx -- Job titles, locations, salary, remote
    cv-upload.tsx         -- Drag-and-drop CV upload zone
    appearance-settings.tsx -- Theme toggle + preferences
  ui/                     -- Existing shadcn/ui components (unchanged)
```

### Mock Data

```
src/lib/mock-data.ts      -- All mock data in one file
  - mockJobs: UnifiedJob[] (15 jobs with realistic scores)
  - mockApplications: Application[] (10 applications across all statuses)
  - mockProfile: Profile (user preferences)
  - mockStats: { newJobs, avgScore, activeApps, upcomingInterviews }
```

---

## Page Specifications

### 1. Dashboard (/dashboard)

**Layout**:
- Header: "Dashboard" title + avatar + dark mode toggle
- 4 stats cards in a row (responsive: 2x2 on mobile)
  - New Jobs (blue gradient) with calendar icon
  - Average Score (green gradient) with chart icon
  - Active Applications (purple gradient) with send icon
  - Upcoming Interviews (orange gradient) with video icon
- "Top Jobs Today" section: horizontal scroll of 5 job mini-cards
  - Each card: title, company, location badge, score circle, 3 action buttons (save/apply/dismiss)
- "Recent Applications" section: simple 3-row table
  - Columns: Job Title, Company, Status pill (colored badge)

**Mock data**: 12 new jobs, score 78/100, 5 active apps, 2 interviews

### 2. Jobs (/jobs)

**Layout**:
- Header: "Jobs" title + result count
- Filter bar: search input + Source dropdown (JSearch/Adzuna/All) + Remote dropdown (Yes/No/All) + Min Score slider
- Job cards list (vertical scroll)
  - Each card: title (bold), company, location with pin icon, salary range, score circle (green/yellow/red), source badge, posted date, remote pill, 3 action buttons (bookmark/apply/dismiss)
  - Score colors: green >= 75, yellow >= 50, red < 50

**Mock data**: 15 jobs from mockJobs array, filters work client-side

### 3. Applications (/applications)

**Layout**:
- Header: "Application Pipeline" + Kanban|List toggle
- Kanban view (default):
  - 5 columns: Saved (gray), Applied (blue), Interview (purple), Offer (green), Rejected (red)
  - Column headers with colored backgrounds and count badges
  - Cards in each column: title, company, date, score circle
  - No drag-and-drop for MVP (just visual layout, status changes via dropdown on card)
- List view (toggle):
  - Table with columns: Job, Company, Status (dropdown), Score, Date, Actions
  - Status dropdown allows changing status
  - Sortable by score or date

**Mock data**: 10 applications spread across statuses

### 4. Settings (/settings)

**Layout**:
- Header: "Settings"
- Tabs: Profile | Search Preferences | CV/Resume | Appearance
- Profile tab:
  - Avatar placeholder (circle with initials)
  - Full Name input
  - Email input (read-only)
  - Language toggle (FR/EN)
- Search Preferences tab:
  - Target Job Titles: tag input (add/remove tags)
  - Preferred Locations: tag input
  - Minimum Salary: currency select (CAD/USD) + number input
  - Remote Preference: radio group (Remote/Hybrid/Any)
- CV/Resume tab:
  - Drag-and-drop zone (dashed border, upload icon)
  - "Drop your CV here or click to browse"
  - Supported formats: PDF, DOCX
  - If CV uploaded: show file name + delete button
- Appearance tab:
  - Theme: Light/Dark/System radio group
  - Preview of current theme

**Mock data**: Pre-filled profile from mockProfile

---

## Shared Components Detail

### App Sidebar (app-sidebar.tsx)
- Fixed left, 240px wide, collapsible to icon-only on mobile via Sheet
- Logo: "JobPilot" with compass icon (Lucide: Compass)
- Nav items with icons:
  - Dashboard: LayoutDashboard
  - Jobs: Briefcase
  - Applications: FileText
  - Settings: Settings (gear)
- Active item highlighted with accent color
- Bottom: user avatar + name (small)

### Theme Toggle (theme-toggle.tsx)
- Button with Sun/Moon icon
- Uses next-themes useTheme() hook
- Toggles between light/dark/system

### Score Circle
- Reusable component showing score as colored circle
- Size: small (24px), medium (32px), large (48px)
- Color: green (>=75), yellow (>=50), red (<50)
- Shows number inside

---

## i18n Keys to Add

Both fr.json and en.json need new keys for dashboard, jobs, applications, settings sections. Each sub-agent adds its own section keys.

---

## Implementation Order (Sub-agents)

### Agent 1: Layout + Navigation + Theme
Files:
- src/app/layout.tsx (update: metadata, ThemeProvider)
- src/app/[locale]/layout.tsx (NEW: app shell with sidebar)
- src/components/layout/app-sidebar.tsx
- src/components/layout/app-header.tsx
- src/components/layout/theme-provider.tsx
- src/components/layout/theme-toggle.tsx
- src/lib/mock-data.ts (ALL mock data)
- messages/fr.json (update with all new keys)
- messages/en.json (update with all new keys)

### Agent 2: Dashboard Page
Files:
- src/app/[locale]/dashboard/page.tsx
- src/components/dashboard/stats-cards.tsx
- src/components/dashboard/top-jobs.tsx
- src/components/dashboard/recent-applications.tsx
- src/components/ui/score-circle.tsx (shared component)

### Agent 3: Jobs Page
Files:
- src/app/[locale]/jobs/page.tsx
- src/components/jobs/job-filters.tsx
- src/components/jobs/job-card.tsx
- src/components/jobs/job-list.tsx

### Agent 4: Applications Page
Files:
- src/app/[locale]/applications/page.tsx
- src/components/applications/kanban-board.tsx
- src/components/applications/kanban-column.tsx
- src/components/applications/kanban-card.tsx
- src/components/applications/list-view.tsx
- src/components/applications/view-toggle.tsx

### Agent 5: Settings Page
Files:
- src/app/[locale]/settings/page.tsx
- src/components/settings/profile-form.tsx
- src/components/settings/search-preferences.tsx
- src/components/settings/cv-upload.tsx
- src/components/settings/appearance-settings.tsx

---

## Critical Rules for All Agents

1. NO emojis in code files (ts, tsx, json)
2. Use shadcn/ui components from src/components/ui/ when available
3. Use Lucide React for all icons
4. Use cn() from @/lib/utils for class merging
5. Use Tailwind CSS classes only (no inline styles)
6. Support dark mode (use theme CSS variables, not hardcoded colors)
7. Import mock data from @/lib/mock-data
8. TypeScript strict: no `any`, no `as unknown`
9. All text content uses i18n keys via useTranslations() from next-intl
10. Use "use client" directive only where needed (interactivity, hooks)
11. Mobile responsive: sidebar collapses, cards stack vertically
12. Match the mockup screenshots provided by the user (modern/colorful style)
