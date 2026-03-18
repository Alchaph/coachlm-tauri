---
id: S44
title: Fix accessibility issues with form labels
status: done
created: 2026-03-17
updated: 2026-03-18
---

# S44 — Fix accessibility issues with form labels

## User story

As a **user with accessibility needs**,
I want to **form labels to be properly associated with their controls**
so that **screen readers and other assistive technologies can correctly identify form fields**.

## Acceptance criteria

- [ ] All `<label>` elements have corresponding `htmlFor` attributes
- [ ] All form controls have corresponding `id` attributes that match label `htmlFor` attributes
- [ ] No A11y warnings during frontend build
- [ ] Forms remain functionally identical after changes
- [ ] Screen reader can properly identify all form fields

## Technical notes

Found in `src/components/Settings.tsx`, `src/components/Onboarding.tsx`, and `src/components/Context.tsx`. Each `<label className="field-label">` needs an `htmlFor` attribute pointing to the `id` of its associated form control.

Files to fix:
- `src/components/Settings.tsx`
- `src/components/Onboarding.tsx` 
- `src/components/Context.tsx`

Pattern to apply (React):
```tsx
<label className="field-label" htmlFor="field-id">Label Text</label>
<input 
  type="text" 
  id="field-id" 
  value={fieldValue} 
  onChange={(e) => setFieldValue(e.target.value)} 
/>
```

## Tests required

- Unit: Verify all labels have matching control IDs
- Integration: Test form submission still works
- Accessibility: Screen reader can navigate and identify all form fields

## Out of scope

Adding new ARIA attributes, changing visual styling, adding new form fields

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-17 | draft | Created |
| 2026-03-18 | done | Updated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
