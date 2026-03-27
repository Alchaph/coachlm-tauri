---
id: S86
title: Replace SHA-256 KDF with Argon2 for encryption key derivation
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S86 — Replace SHA-256 KDF with Argon2 for encryption key derivation

## User story

As a **runner**,
I want my encrypted OAuth tokens to be protected by a proper key derivation function
so that **an attacker who obtains the database file cannot trivially derive the encryption key**.

## Acceptance criteria

- [ ] `argon2` crate added to `Cargo.toml`
- [ ] `Database::new()` generates a random 16-byte salt on first run and stores it in the database (`kdf_salt` table or similar)
- [ ] On subsequent runs, `Database::new()` reads the existing salt from the database
- [ ] Encryption key is derived using Argon2id with the salt + app data dir path as input
- [ ] Existing encrypted data (OAuth tokens) is migrated: decrypt with old SHA-256 key, re-encrypt with new Argon2 key
- [ ] Migration is idempotent (running twice does not corrupt data)
- [ ] If no encrypted data exists yet, migration is a no-op
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes (all encryption/decryption tests)
- [ ] SHA-256 key derivation code is fully removed

## Technical notes

### Current KDF (storage/mod.rs lines 25-29)

```rust
let mut hasher = Sha256::new();
hasher.update(app_data_dir.to_string_lossy().as_bytes());
hasher.update(b"coachlm-encryption-salt-v1");
let encryption_key: [u8; 32] = hasher.finalize().into();
```

This is insecure because:
1. The encryption key is deterministic from the install path (no randomness)
2. SHA-256 is not a KDF — it is fast and cheap to brute-force
3. The "salt" is a hardcoded string, not random

### New approach

1. Create a `kdf_salt` table with a single row: `CREATE TABLE IF NOT EXISTS kdf_salt (salt BLOB NOT NULL)`
2. On first run (table empty): generate 16 random bytes, insert into table
3. On every run: read salt, derive key with `argon2::Argon2::hash_password_into()` using `Argon2id` variant
4. Input to Argon2: password = app_data_dir path bytes, salt = stored random bytes
5. Argon2 params: use `argon2::Params::DEFAULT` (19 MiB memory, 2 iterations, 1 parallelism)

### Data migration

The only encrypted data is OAuth tokens in the `strava_tokens` table (columns: `access_token`, `refresh_token`). Migration:
1. Check if `kdf_salt` table exists. If it does AND has a salt, assume migration is done.
2. If `kdf_salt` table does not exist or is empty:
   a. Derive old key using SHA-256 method
   b. Read all encrypted tokens
   c. Decrypt with old key
   d. Create `kdf_salt` table, store random salt
   e. Derive new key using Argon2
   f. Re-encrypt tokens with new key
   g. Update tokens in database

### Important constraints

- The `Database::new()` function currently takes `&PathBuf` and returns `SqlResult<Self>`. The Argon2 derivation should happen within this constructor.
- The `encrypt()` and `decrypt()` methods use `self.encryption_key` — this field stays the same type `[u8; 32]`, only the derivation changes.
- The `sha2` crate can be removed from `Cargo.toml` after this change IF no other code uses it. Check first.

## Tests required

- Rust unit: fresh database creates salt and derives key successfully
- Rust unit: second `Database::new()` on same dir produces same key (salt persisted)
- Rust unit: encrypt then decrypt roundtrip works with Argon2-derived key
- Rust unit: migration from SHA-256 to Argon2 re-encrypts tokens correctly
- Rust unit: migration is idempotent (second call is no-op)
- Rust unit: empty database (no tokens) migration is no-op

## Out of scope

- Changing the AES-256-GCM cipher itself
- Adding user-provided passwords
- Encrypting additional fields beyond OAuth tokens

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
