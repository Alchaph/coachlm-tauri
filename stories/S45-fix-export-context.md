---
id: S45
title: Fix export context functionality
status: done
created: 2026-03-17
updated: 2026-03-18
---

# S45 — Fix export context functionality

## User story

As a **runner**,
I want **to export my coaching context to a file**
so that **I can backup my data and import it on another device**.

## Problem

When the user clicks the "Export Context" button in the Settings screen, an error occurs. The frontend calls `export_context()` without a file path argument, but the Rust backend function requires a `file_path` parameter. The function signature is:

```rust
#[tauri::command]
pub fn export_context(file_path: String) -> Result<(), String>
```

The frontend implementation in `src/components/Settings.tsx` is:

```tsx
async function handleExport() {
  try {
    await invoke('export_context')  // Missing file_path argument
    showFeedback('Context exported successfully', 'success')
  } catch (e: any) {
    showFeedback(e || 'Failed to export context', 'error')
  }
}
```

This causes the Tauri command to fail because the required `file_path` parameter is not provided. The error pops up on screen with no helpful context to the user.

## Acceptance criteria

- [ ] Export button triggers a native file save dialog using Tauri dialog plugin
- [ ] File dialog defaults to a sensible filename (e.g., `coach-context-YYYY-MM-DD.coachctx`)
- [ ] File dialog filters to `.coachctx` extension
- [ ] If user cancels the dialog, no error is shown (silent failure is OK for cancel)
- [ ] Selected file path is passed to the Rust backend's `export_context(file_path: String)` function
- [ ] Success message is shown after successful export
- [ ] Error message is shown if export fails (with meaningful error details)
- [ ] The export process shows feedback to the user during the operation

## Technical notes

**File location**: `src/components/Settings.tsx`

**Required Tauri dialog import**:
```typescript
import { save } from '@tauri-apps/plugin-dialog'
```

**Implementation approach**:
1. Before calling `export_context`, invoke `save()` with appropriate options
2. Pass the returned filePath to `invoke('export_context', { filePath })`
3. Handle null/empty filePath (user canceled) gracefully

**Example Tauri save dialog usage**:
```typescript
const filePath = await save({
  defaultPath: `coach-context-${new Date().toISOString().split('T')[0]}.coachctx`,
  filters: [
    { name: 'CoachLM Context', extensions: ['coachctx'] }
  ]
})
if (filePath) {
  await invoke('export_context', { filePath })
  // ... handle success
}
```

**Related files**:
- `src/components/Settings.tsx` - Add file dialog before export
- `src-tauri/src/lib.rs` - `export_context` command
- `src-tauri/src/storage/mod.rs` - Export logic

## Tests required

- Manual test: Click "Export Context" → File save dialog appears → Select location → File is created
- Manual test: Click "Export Context" → Cancel dialog → No error shown
- Manual test: Export to read-only location → Error message appears
- Edge case: Export when database is empty → File is created with valid empty envelope

## Out of scope

- Export format changes (the export format is correct; the bug is only about triggering the export)
- Import functionality (this is working correctly)
- Encryption of exported files (future enhancement)
- Progress bar for large exports

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-17 | draft | Created |
| 2026-03-18 | done | Updated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
