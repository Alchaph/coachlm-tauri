---
id: S28
title: Desktop-oriented layout with sidebar navigation
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S28 — Desktop-oriented layout with sidebar navigation

## User story

As a user,
I want the app to use a sidebar navigation and full screen width
so that it feels like a proper desktop application and not a mobile web page.

## Acceptance criteria

- [ ] Top tab bar replaced with a vertical sidebar navigation on the left
- [ ] Sidebar includes icons and labels for: Chat, Dashboard, Context, Training Plan, Settings
- [ ] Max-width constraints removed from the app shell and content panels
- [ ] All content panels use full available width
- [ ] Sidebar collapses to icons on narrow viewports (< 768px)
- [ ] Active tab highlighted in sidebar
- [ ] App looks good at 1200px+ widths
- [ ] Icons from lucide-react library

## Technical notes

- Modify src/App.tsx: replace tab bar with sidebar component, change layout from column to row
- Content panels in src/components/*.tsx use full width
- Sidebar is ~200px wide with dark background matching existing theme
- React component state handles tab routing

## Tests required

- Visual: sidebar renders with all five nav items
- Visual: clicking each nav item switches content
- Visual: full width layout at desktop sizes

## Out of scope

- Responsive breakpoints below 768px (mobile support)
- Animated sidebar transitions
- User-configurable sidebar width

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
