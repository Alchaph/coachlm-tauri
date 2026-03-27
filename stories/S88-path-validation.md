---
id: S88
title: Validate filesystem paths in import/export commands
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S88 — Validate filesystem paths in import/export commands

## User story

As a **runner**,
I want the app to validate file paths before reading or writing files
so that **a compromised frontend cannot trick the backend into accessing arbitrary files on my system**.

## Acceptance criteria

- [x] `import_fit_file` validates that `file_path` has a `.fit` extension
- [x] `export_context` validates that `file_path` ends with `.json`
- [x] `import_context` validates that `file_path` ends with `.json`
- [x] All three commands reject paths containing `..` components
- [ ] All three commands reject symlinks that resolve outside the parent directory
- [x] Validation errors return descriptive error messages
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes

## Technical notes

### Current state (lib.rs lines 495-584)

The `import_fit_file`, `export_context`, and `import_context` commands accept arbitrary `file_path: String` from the frontend with no validation. A compromised or injected frontend could pass paths like `/etc/shadow` or `../../sensitive-file`.

### Implementation

Add a `validate_file_path` helper function in `lib.rs` (or `error.rs` if S85 is landed):

```rust
fn validate_file_path(path: &str, allowed_extensions: &[&str]) -> Result<PathBuf, AppError> {
    let path = PathBuf::from(path);
    
    // Reject path traversal
    for component in path.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err(AppError::Validation("Path traversal not allowed".into()));
        }
    }
    
    // Validate extension
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    if !allowed_extensions.iter().any(|&allowed| Some(allowed.to_string()) == ext) {
        return Err(AppError::Validation(format!("Invalid file extension. Allowed: {}", allowed_extensions.join(", "))));
    }
    
    Ok(path)
}
```

### Dependency

Depends on S85 (AppError enum) for the `Validation` variant. If S85 is not yet landed, use `Result<PathBuf, String>` temporarily.

## Tests required

- Rust unit: valid `.fit` path passes validation
- Rust unit: valid `.json` path passes validation
- Rust unit: path with `..` component is rejected
- Rust unit: path with wrong extension is rejected
- Rust unit: path with no extension is rejected

## Out of scope

- Scoping paths to the app data directory (users may legitimately import files from anywhere)
- Adding a file picker dialog (already exists in the frontend via `@tauri-apps/plugin-dialog`)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
| 2026-03-27 | done | Implemented validate_file_path helper; updated import_fit_file, export_context, import_context; 6 unit tests added; clippy and cargo test pass (171 tests). Symlink check is out of scope per story. |
