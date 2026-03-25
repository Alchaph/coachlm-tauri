use rusqlite::{params, Connection};
use std::sync::Mutex;

const SEARCH_TTL_HOURS: i64 = 12;
const PAGE_TTL_HOURS: i64 = 168; // 7 days

pub struct ResearchCache {
    #[allow(dead_code)]
    conn: Mutex<Connection>,
}

impl ResearchCache {
    #[allow(dead_code)]
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }

    #[allow(dead_code)]
    pub fn from_shared(conn: &Mutex<Connection>) -> ResearchCacheRef<'_> {
        ResearchCacheRef { conn }
    }

    pub fn init_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS research_cache (
                cache_key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL
            )",
        )?;
        Ok(())
    }

    pub fn lookup(conn: &Connection, key: &str, category: &str) -> Option<String> {
        let ttl_hours = match category {
            "page" => PAGE_TTL_HOURS,
            _ => SEARCH_TTL_HOURS,
        };

        let mut stmt = conn
            .prepare(
                "SELECT value FROM research_cache
                 WHERE cache_key = ?1 AND category = ?2
                 AND datetime(created_at) > datetime('now', ?3)",
            )
            .ok()?;

        let ttl_param = format!("-{ttl_hours} hours");
        stmt.query_row(params![key, category, ttl_param], |row| row.get(0))
            .ok()
    }

    pub fn store(conn: &Connection, key: &str, value: &str, category: &str) -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO research_cache (cache_key, value, category, created_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
            params![key, value, category],
        )
        .map_err(|e| format!("Cache store failed: {e}"))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn cleanup_expired(conn: &Connection) -> Result<usize, String> {
        let deleted = conn
            .execute(
                "DELETE FROM research_cache WHERE
                 (category = 'search' AND datetime(created_at) <= datetime('now', ?1))
                 OR (category = 'page' AND datetime(created_at) <= datetime('now', ?2))",
                params![
                    format!("-{SEARCH_TTL_HOURS} hours"),
                    format!("-{PAGE_TTL_HOURS} hours"),
                ],
            )
            .map_err(|e| format!("Cache cleanup failed: {e}"))?;
        Ok(deleted)
    }
}

#[allow(dead_code)]
pub struct ResearchCacheRef<'a> {
    conn: &'a Mutex<Connection>,
}

impl ResearchCacheRef<'_> {
    #[allow(dead_code)]
    pub fn lookup(&self, key: &str, category: &str) -> Option<String> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ResearchCache::lookup(&conn, key, category)
    }

    #[allow(dead_code)]
    pub fn store(&self, key: &str, value: &str, category: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ResearchCache::store(&conn, key, value, category)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        ResearchCache::init_tables(&conn).expect("init tables");
        conn
    }

    #[test]
    fn store_and_lookup_returns_value() {
        let conn = test_conn();
        ResearchCache::store(&conn, "q:test", "results json", "search").expect("store");
        let value = ResearchCache::lookup(&conn, "q:test", "search");
        assert_eq!(value.as_deref(), Some("results json"));
    }

    #[test]
    fn lookup_miss_returns_none() {
        let conn = test_conn();
        let value = ResearchCache::lookup(&conn, "nonexistent", "search");
        assert!(value.is_none());
    }

    #[test]
    fn lookup_wrong_category_returns_none() {
        let conn = test_conn();
        ResearchCache::store(&conn, "q:test", "data", "search").expect("store");
        let value = ResearchCache::lookup(&conn, "q:test", "page");
        assert!(value.is_none());
    }

    #[test]
    fn store_overwrites_existing_key() {
        let conn = test_conn();
        ResearchCache::store(&conn, "q:test", "old", "search").expect("store");
        ResearchCache::store(&conn, "q:test", "new", "search").expect("store");
        let value = ResearchCache::lookup(&conn, "q:test", "search");
        assert_eq!(value.as_deref(), Some("new"));
    }

    #[test]
    fn cleanup_returns_count() {
        let conn = test_conn();
        ResearchCache::store(&conn, "q:a", "val", "search").expect("store");
        let deleted = ResearchCache::cleanup_expired(&conn).expect("cleanup");
        assert_eq!(deleted, 0, "fresh entries should not be cleaned up");
    }

    #[test]
    fn init_tables_idempotent() {
        let conn = test_conn();
        ResearchCache::init_tables(&conn).expect("second init should be ok");
    }
}
