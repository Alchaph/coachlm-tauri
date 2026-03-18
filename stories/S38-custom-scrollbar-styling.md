---
id: S38
title: Custom scrollbar styling for dark theme
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S38 — Custom scrollbar styling for dark theme

## User story

As a **user of CoachLM**,
I want **scrollbars that match the dark theme**
so that **the UI looks cohesive and the default browser scrollbar doesn't stand out**.

## Problem

The app uses a dark theme (`#1b2636` background, `#e2e8f0` text) but has no custom scrollbar styling. The browser-default scrollbar shows:
- Light gray/white track
- Contrasting thumb
- Sharp edges that don't match the rounded design language

This creates an inconsistent, slightly jarring visual experience — everything else is styled (buttons, inputs, cards, modals) but the scrollbar is left raw.

## Acceptance criteria

- [ ] All scrollable containers in the app use custom scrollbar styling:
  - Chat messages area
  - Dashboard activity table (overflow-x)
  - Context tab (both profile form and activity table)
  - Settings tab
  - Any other scrollable areas
- [ ] Scrollbar uses the app's color palette:
  - Track: transparent or very subtle (`rgba(255, 255, 255, 0.05)`)
  - Thumb: muted blue-gray (`#475569` or `#64748b`)
  - Thumb hover: slightly brighter (`#94a3b8`)
  - Thumb border-radius: matches the rounded aesthetic (`6px`)
- [ ] Scrollbar is thin and unobtrusive (8–10px width)
- [ ] Custom scrollbar works on Chromium-based browsers (Chrome, Edge, Brave) and Firefox
- [ ] No layout shift — scrollbar overlay doesn't affect content width

## Technical notes

- Use CSS pseudo-elements for cross-browser compatibility:
  ```css
  /* WebKit (Chrome, Safari, Edge) */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 6px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #475569 transparent;
  }
  ```
- Apply globally in `src/styles/global.css`
- Ensure scrollbar doesn't push content: use `scrollbar-gutter: stable` or overlay technique
- Test on both dark background containers (chat, dashboard) and any potential light containers

## Tests required

- Manual: Scroll through chat messages → verify custom scrollbar appears and matches theme
- Manual: Scroll dashboard table horizontally → verify scrollbar styling
- Manual: Scroll context tab → verify scrollbar styling
- Manual: Hover over scrollbar thumb → verify color change
- Browser: Verify on Chrome/Edge, Firefox, Safari (if possible)

## Out of scope

- Animated scrollbar thumb
- Custom scrollbar on mobile / touch devices (use native scrollbars)
- Hiding scrollbar entirely (keep visible for discoverability)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Added custom scrollbar styling to global.css |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
