use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection, Result as SqlResult};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
    encryption_key: [u8; 32],
}

impl Database {
    pub fn new(app_data_dir: &PathBuf) -> SqlResult<Self> {
        std::fs::create_dir_all(app_data_dir).ok();
        let db_path = app_data_dir.join("coachlm.db");
        let conn = Connection::open(&db_path)?;

        // Derive encryption key from data directory path
        let mut hasher = Sha256::new();
        hasher.update(app_data_dir.to_string_lossy().as_bytes());
        hasher.update(b"coachlm-encryption-salt-v1");
        let encryption_key: [u8; 32] = hasher.finalize().into();

        let db = Database {
            conn: Mutex::new(conn),
            encryption_key,
        };
        db.run_migrations()?;
        Ok(db)
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, String> {
        use rand::RngCore;
        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key).map_err(|e| e.to_string())?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| e.to_string())?;
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(BASE64.encode(&combined))
    }

    pub fn decrypt(&self, encrypted: &str) -> Result<String, String> {
        let combined = BASE64.decode(encrypted).map_err(|e| e.to_string())?;
        if combined.len() < 12 {
            return Err("Invalid encrypted data".to_string());
        }
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| e.to_string())?;
        String::from_utf8(plaintext).map_err(|e| e.to_string())
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        // Mutex poisoning only occurs if another thread panicked while holding the lock,
        // which is an unrecoverable state for the whole app.
        #[allow(clippy::unwrap_used)]
        self.conn.lock().unwrap()
    }

    #[allow(clippy::too_many_lines)]
    fn run_migrations(&self) -> SqlResult<()> {
        // Mutex poisoning is unrecoverable at startup — same justification as conn().
        #[allow(clippy::unwrap_used)]
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id INTEGER PRIMARY KEY DEFAULT 1,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                token_expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activities (
                activity_id TEXT PRIMARY KEY,
                strava_id TEXT UNIQUE,
                name TEXT,
                type TEXT,
                start_date TEXT,
                distance REAL,
                moving_time INTEGER,
                average_speed REAL,
                average_heartrate REAL,
                max_heartrate REAL,
                average_cadence REAL,
                gear_id TEXT
            );

            CREATE TABLE IF NOT EXISTS activity_streams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                activity_id TEXT NOT NULL REFERENCES activities(activity_id),
                stream_type TEXT NOT NULL,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS athlete_profile (
                id INTEGER PRIMARY KEY DEFAULT 1,
                age INTEGER,
                max_hr INTEGER,
                resting_hr INTEGER,
                threshold_pace_secs INTEGER,
                weekly_mileage_target REAL,
                race_goals TEXT,
                injury_history TEXT,
                experience_level TEXT,
                training_days_per_week INTEGER,
                preferred_terrain TEXT,
                heart_rate_zones TEXT,
                custom_notes TEXT
            );

            CREATE TABLE IF NOT EXISTS athlete_stats (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS athlete_zones (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS gear (
                gear_id TEXT PRIMARY KEY,
                name TEXT,
                distance REAL,
                brand_name TEXT,
                model_name TEXT
            );

            CREATE TABLE IF NOT EXISTS pinned_insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                source_session_id TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS races (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                distance_km REAL NOT NULL,
                race_date TEXT NOT NULL,
                terrain TEXT NOT NULL,
                elevation_m REAL,
                goal_time_s INTEGER,
                priority TEXT NOT NULL,
                is_active INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS training_plans (
                id TEXT PRIMARY KEY,
                race_id TEXT NOT NULL REFERENCES races(id),
                generated_at TEXT NOT NULL,
                llm_backend TEXT NOT NULL,
                prompt_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plan_weeks (
                id TEXT PRIMARY KEY,
                plan_id TEXT NOT NULL REFERENCES training_plans(id),
                week_number INTEGER NOT NULL,
                week_start TEXT NOT NULL,
                UNIQUE(plan_id, week_number)
            );

            CREATE TABLE IF NOT EXISTS plan_sessions (
                id TEXT PRIMARY KEY,
                week_id TEXT NOT NULL REFERENCES plan_weeks(id),
                day_of_week INTEGER NOT NULL,
                session_type TEXT NOT NULL,
                duration_min INTEGER,
                distance_km REAL,
                hr_zone INTEGER,
                pace_min_low REAL,
                pace_min_high REAL,
                notes TEXT,
                status TEXT DEFAULT 'planned',
                actual_duration_min INTEGER,
                actual_distance_km REAL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                active_llm TEXT DEFAULT 'local',
                ollama_endpoint TEXT DEFAULT 'http://localhost:11434',
                ollama_model TEXT DEFAULT 'llama3',
                custom_system_prompt TEXT DEFAULT ''
            );
        ",
        )?;

        // Add title column to existing chat_sessions tables (safe to run if column already exists)
        let has_title_col: bool = conn
            .prepare("SELECT title FROM chat_sessions LIMIT 0")
            .is_ok();
        if !has_title_col {
            conn.execute_batch("ALTER TABLE chat_sessions ADD COLUMN title TEXT")?;
        }

        // Add is_active column to training_plans (safe to run if column already exists)
        let has_plan_active: bool = conn
            .prepare("SELECT is_active FROM training_plans LIMIT 0")
            .is_ok();
        if !has_plan_active {
            conn.execute_batch(
                "ALTER TABLE training_plans ADD COLUMN is_active INTEGER DEFAULT 0",
            )?;
            // Migrate: set the most recent plan per active race as active
            conn.execute_batch(
                "UPDATE training_plans SET is_active = 1 WHERE id IN (
                    SELECT tp.id FROM training_plans tp
                    JOIN races r ON tp.race_id = r.id
                    WHERE r.is_active = 1
                    ORDER BY tp.generated_at DESC LIMIT 1
                )",
            )?;
        }

        // Add enhanced activity columns (safe to run if columns already exist)
        let new_activity_cols = [
            ("elapsed_time", "INTEGER"),
            ("total_elevation_gain", "REAL"),
            ("max_speed", "REAL"),
            ("workout_type", "INTEGER"),
            ("sport_type", "TEXT"),
            ("start_date_local", "TEXT"),
        ];
        for (col, col_type) in new_activity_cols {
            let exists: bool = conn
                .prepare(&format!("SELECT {col} FROM activities LIMIT 0"))
                .is_ok();
            if !exists {
                conn.execute_batch(&format!(
                    "ALTER TABLE activities ADD COLUMN {col} {col_type}"
                ))?;
            }
        }

        let new_settings_cols = [
            ("cloud_api_key", "TEXT"),
            ("cloud_model", "TEXT"),
            ("web_search_enabled", "INTEGER DEFAULT 0"),
            ("web_search_provider", "TEXT DEFAULT 'duckduckgo'"),
        ];
        for (col, col_type) in new_settings_cols {
            let exists: bool = conn
                .prepare(&format!("SELECT {col} FROM settings LIMIT 0"))
                .is_ok();
            if !exists {
                conn.execute_batch(&format!("ALTER TABLE settings ADD COLUMN {col} {col_type}"))?;
            }
        }

        let has_custom_notes: bool = conn
            .prepare("SELECT custom_notes FROM athlete_profile LIMIT 0")
            .is_ok();
        if !has_custom_notes {
            conn.execute_batch("ALTER TABLE athlete_profile ADD COLUMN custom_notes TEXT")?;
        }

        Ok(())
    }

    // ── Settings ───────────────────────────────────────────────
    pub fn get_settings(&self) -> SqlResult<Option<super::models::SettingsData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT active_llm, ollama_endpoint, ollama_model, custom_system_prompt, cloud_api_key, cloud_model, web_search_enabled, web_search_provider FROM settings WHERE id = 1"
        )?;
        let result = stmt.query_row([], |row| {
            Ok((
                super::models::SettingsData {
                    active_llm: row.get(0)?,
                    ollama_endpoint: row.get(1)?,
                    ollama_model: row.get(2)?,
                    custom_system_prompt: row.get(3)?,
                    cloud_api_key: None,
                    cloud_model: row.get(5)?,
                    web_search_enabled: row.get::<_, i64>(6).unwrap_or(0) != 0,
                    web_search_provider: row
                        .get::<_, Option<String>>(7)?
                        .unwrap_or_else(|| "duckduckgo".to_string()),
                },
                row.get::<_, Option<String>>(4)?,
            ))
        });
        match result {
            Ok((mut settings, encrypted_key)) => {
                if let Some(ref enc) = encrypted_key {
                    settings.cloud_api_key = self.decrypt(enc).ok();
                }
                Ok(Some(settings))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_settings(&self, data: &super::models::SettingsData) -> SqlResult<()> {
        let conn = self.conn();
        let encrypted_key: Option<String> = data
            .cloud_api_key
            .as_ref()
            .filter(|k| !k.is_empty())
            .and_then(|k| self.encrypt(k).ok());
        conn.execute(
            "INSERT OR REPLACE INTO settings (id, active_llm, ollama_endpoint, ollama_model, custom_system_prompt, cloud_api_key, cloud_model, web_search_enabled, web_search_provider)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![data.active_llm, data.ollama_endpoint, data.ollama_model, data.custom_system_prompt, encrypted_key, data.cloud_model, i64::from(data.web_search_enabled), data.web_search_provider],
        )?;
        Ok(())
    }

    pub fn is_first_run(&self) -> bool {
        self.get_settings().ok().flatten().is_none()
    }

    // ── OAuth Tokens ───────────────────────────────────────────
    pub fn save_oauth_tokens(
        &self,
        access_token: &str,
        refresh_token: &str,
        expires_at: i64,
    ) -> SqlResult<()> {
        let conn = self.conn();
        let enc_access = self.encrypt(access_token).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e)))
        })?;
        let enc_refresh = self.encrypt(refresh_token).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e)))
        })?;
        conn.execute(
            "INSERT OR REPLACE INTO oauth_tokens (id, access_token, refresh_token, token_expires_at)
             VALUES (1, ?1, ?2, ?3)",
            params![enc_access, enc_refresh, expires_at],
        )?;
        Ok(())
    }

    pub fn get_oauth_tokens(&self) -> SqlResult<Option<(String, String, i64)>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT access_token, refresh_token, token_expires_at FROM oauth_tokens WHERE id = 1",
        )?;
        let result = stmt.query_row([], |row| {
            let enc_access: String = row.get(0)?;
            let enc_refresh: String = row.get(1)?;
            let expires: i64 = row.get(2)?;
            Ok((enc_access, enc_refresh, expires))
        });
        match result {
            Ok((enc_a, enc_r, exp)) => {
                let access = self.decrypt(&enc_a).map_err(|e| {
                    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e)))
                })?;
                let refresh = self.decrypt(&enc_r).map_err(|e| {
                    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e)))
                })?;
                Ok(Some((access, refresh, exp)))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_oauth_tokens(&self) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM oauth_tokens", [])?;
        Ok(())
    }

    // ── Athlete Profile ────────────────────────────────────────
    pub fn get_profile(&self) -> SqlResult<Option<super::models::ProfileData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT age, max_hr, resting_hr, threshold_pace_secs, weekly_mileage_target,
                    race_goals, injury_history, experience_level, training_days_per_week,
                    preferred_terrain, heart_rate_zones, custom_notes
             FROM athlete_profile WHERE id = 1",
        )?;
        let result = stmt.query_row([], |row| {
            Ok(super::models::ProfileData {
                age: row.get(0)?,
                max_hr: row.get(1)?,
                resting_hr: row.get(2)?,
                threshold_pace_secs: row.get(3)?,
                weekly_mileage_target: row.get(4)?,
                race_goals: row.get(5)?,
                injury_history: row.get(6)?,
                experience_level: row.get(7)?,
                training_days_per_week: row.get(8)?,
                preferred_terrain: row.get(9)?,
                heart_rate_zones: row.get(10)?,
                custom_notes: row.get(11)?,
            })
        });
        match result {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_profile(&self, data: &super::models::ProfileData) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO athlete_profile
             (id, age, max_hr, resting_hr, threshold_pace_secs, weekly_mileage_target,
              race_goals, injury_history, experience_level, training_days_per_week,
              preferred_terrain, heart_rate_zones, custom_notes)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                data.age,
                data.max_hr,
                data.resting_hr,
                data.threshold_pace_secs,
                data.weekly_mileage_target,
                data.race_goals,
                data.injury_history,
                data.experience_level,
                data.training_days_per_week,
                data.preferred_terrain,
                data.heart_rate_zones,
                data.custom_notes,
            ],
        )?;
        Ok(())
    }

    // ── Activities ─────────────────────────────────────────────
    pub fn insert_activity(&self, a: &super::models::ActivityData) -> SqlResult<bool> {
        let conn = self.conn();
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM activities WHERE activity_id = ?1 OR strava_id = ?2",
            params![a.activity_id, a.strava_id],
            |row| row.get(0),
        )?;
        if exists {
            conn.execute(
                "UPDATE activities SET
                    elapsed_time = COALESCE(?1, elapsed_time),
                    total_elevation_gain = COALESCE(?2, total_elevation_gain),
                    max_speed = COALESCE(?3, max_speed),
                    workout_type = COALESCE(?4, workout_type),
                    sport_type = COALESCE(?5, sport_type),
                    start_date_local = COALESCE(?6, start_date_local)
                 WHERE strava_id = ?7 OR activity_id = ?8",
                params![
                    a.elapsed_time,
                    a.total_elevation_gain,
                    a.max_speed,
                    a.workout_type,
                    a.sport_type,
                    a.start_date_local,
                    a.strava_id,
                    a.activity_id,
                ],
            )?;
            return Ok(false);
        }
        conn.execute(
            "INSERT INTO activities (activity_id, strava_id, name, type, start_date, distance,
             moving_time, average_speed, average_heartrate, max_heartrate, average_cadence, gear_id,
             elapsed_time, total_elevation_gain, max_speed, workout_type, sport_type, start_date_local)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                a.activity_id,
                a.strava_id,
                a.name,
                a.activity_type,
                a.start_date,
                a.distance,
                a.moving_time,
                a.average_speed,
                a.average_heartrate,
                a.max_heartrate,
                a.average_cadence,
                a.gear_id,
                a.elapsed_time,
                a.total_elevation_gain,
                a.max_speed,
                a.workout_type,
                a.sport_type,
                a.start_date_local,
            ],
        )?;
        Ok(true)
    }

    pub fn get_recent_activities(&self, limit: u32) -> SqlResult<Vec<super::models::ActivityData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT activity_id, strava_id, name, type, start_date, distance, moving_time,
                    average_speed, average_heartrate, max_heartrate, average_cadence, gear_id,
                    elapsed_time, total_elevation_gain, max_speed, workout_type, sport_type, start_date_local
             FROM activities ORDER BY start_date DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(super::models::ActivityData {
                activity_id: row.get(0)?,
                strava_id: row.get(1)?,
                name: row.get(2)?,
                activity_type: row.get(3)?,
                start_date: row.get(4)?,
                distance: row.get(5)?,
                moving_time: row.get(6)?,
                average_speed: row.get(7)?,
                average_heartrate: row.get(8)?,
                max_heartrate: row.get(9)?,
                average_cadence: row.get(10)?,
                gear_id: row.get(11)?,
                elapsed_time: row.get(12)?,
                total_elevation_gain: row.get(13)?,
                max_speed: row.get(14)?,
                workout_type: row.get(15)?,
                sport_type: row.get(16)?,
                start_date_local: row.get(17)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_activity_stats(&self) -> SqlResult<super::models::StatsData> {
        let conn = self.conn();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM activities", [], |row| row.get(0))?;
        let total_distance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(distance), 0.0) FROM activities",
            [],
            |row| row.get(0),
        )?;
        let earliest: Option<String> =
            conn.query_row("SELECT MIN(start_date) FROM activities", [], |row| {
                row.get(0)
            })?;
        let latest: Option<String> =
            conn.query_row("SELECT MAX(start_date) FROM activities", [], |row| {
                row.get(0)
            })?;
        Ok(super::models::StatsData {
            total_activities: count,
            total_distance_km: total_distance / 1000.0,
            earliest_date: earliest,
            latest_date: latest,
        })
    }

    pub fn get_activities_since(&self, since: &str) -> SqlResult<Vec<super::models::ActivityData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT activity_id, strava_id, name, type, start_date, distance, moving_time,
                    average_speed, average_heartrate, max_heartrate, average_cadence, gear_id,
                    elapsed_time, total_elevation_gain, max_speed, workout_type, sport_type, start_date_local
             FROM activities WHERE start_date >= ?1 ORDER BY start_date DESC",
        )?;
        let rows = stmt.query_map(params![since], |row| {
            Ok(super::models::ActivityData {
                activity_id: row.get(0)?,
                strava_id: row.get(1)?,
                name: row.get(2)?,
                activity_type: row.get(3)?,
                start_date: row.get(4)?,
                distance: row.get(5)?,
                moving_time: row.get(6)?,
                average_speed: row.get(7)?,
                average_heartrate: row.get(8)?,
                max_heartrate: row.get(9)?,
                average_cadence: row.get(10)?,
                gear_id: row.get(11)?,
                elapsed_time: row.get(12)?,
                total_elevation_gain: row.get(13)?,
                max_speed: row.get(14)?,
                workout_type: row.get(15)?,
                sport_type: row.get(16)?,
                start_date_local: row.get(17)?,
            })
        })?;
        rows.collect()
    }

    // ── Pinned Insights ────────────────────────────────────────
    pub fn save_pinned_insight(&self, content: &str, session_id: Option<&str>) -> SqlResult<()> {
        let conn = self.conn();
        // Duplicate check
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM pinned_insights WHERE content = ?1",
            params![content],
            |row| row.get(0),
        )?;
        if exists {
            return Ok(());
        }
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO pinned_insights (content, source_session_id, created_at) VALUES (?1, ?2, ?3)",
            params![content, session_id, now],
        )?;
        Ok(())
    }

    pub fn get_pinned_insights(&self) -> SqlResult<Vec<super::models::InsightData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, content, source_session_id, created_at FROM pinned_insights ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(super::models::InsightData {
                id: row.get(0)?,
                content: row.get(1)?,
                source_session_id: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_pinned_insight(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM pinned_insights WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Chat Sessions & Messages ───────────────────────────────
    pub fn create_chat_session(&self) -> SqlResult<super::models::SessionData> {
        let conn = self.conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO chat_sessions (id, created_at) VALUES (?1, ?2)",
            params![id, now],
        )?;
        Ok(super::models::SessionData {
            id,
            title: None,
            created_at: now,
        })
    }

    pub fn get_chat_sessions(&self) -> SqlResult<Vec<super::models::SessionData>> {
        let conn = self.conn();
        let mut stmt = conn
            .prepare("SELECT id, title, created_at FROM chat_sessions ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(super::models::SessionData {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_chat_session(&self, session_id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "DELETE FROM chat_messages WHERE session_id = ?1",
            params![session_id],
        )?;
        conn.execute(
            "DELETE FROM chat_sessions WHERE id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    pub fn update_chat_session_title(&self, session_id: &str, title: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE chat_sessions SET title = ?1 WHERE id = ?2",
            params![title, session_id],
        )?;
        Ok(())
    }

    pub fn insert_chat_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> SqlResult<()> {
        let conn = self.conn();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, role, content, now],
        )?;
        Ok(())
    }

    pub fn get_chat_messages(
        &self,
        session_id: &str,
    ) -> SqlResult<Vec<super::models::MessageData>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(super::models::MessageData {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn update_chat_message_content(
        &self,
        session_id: &str,
        message_id: i64,
        content: &str,
    ) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE chat_messages SET content = ?1 WHERE id = ?2 AND session_id = ?3",
            params![content, message_id, session_id],
        )?;
        Ok(())
    }

    pub fn delete_chat_messages_after(&self, session_id: &str, message_id: i64) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "DELETE FROM chat_messages WHERE session_id = ?1 AND id > ?2",
            params![session_id, message_id],
        )?;
        Ok(())
    }

    // ── Athlete Stats / Zones / Gear ───────────────────────────
    pub fn save_athlete_stats(&self, data: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO athlete_stats (id, data) VALUES (1, ?1)",
            params![data],
        )?;
        Ok(())
    }

    pub fn get_athlete_stats(&self) -> SqlResult<Option<String>> {
        let conn = self.conn();
        match conn.query_row("SELECT data FROM athlete_stats WHERE id = 1", [], |row| {
            row.get(0)
        }) {
            Ok(data) => Ok(Some(data)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_athlete_zones(&self, data: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO athlete_zones (id, data) VALUES (1, ?1)",
            params![data],
        )?;
        Ok(())
    }

    pub fn get_athlete_zones(&self) -> SqlResult<Option<String>> {
        let conn = self.conn();
        match conn.query_row("SELECT data FROM athlete_zones WHERE id = 1", [], |row| {
            row.get(0)
        }) {
            Ok(data) => Ok(Some(data)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_gear(&self, gear: &super::models::GearData) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO gear (gear_id, name, distance, brand_name, model_name)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                gear.gear_id,
                gear.name,
                gear.distance,
                gear.brand_name,
                gear.model_name
            ],
        )?;
        Ok(())
    }

    pub fn get_all_gear(&self) -> SqlResult<Vec<super::models::GearData>> {
        let conn = self.conn();
        let mut stmt =
            conn.prepare("SELECT gear_id, name, distance, brand_name, model_name FROM gear")?;
        let rows = stmt.query_map([], |row| {
            Ok(super::models::GearData {
                gear_id: row.get(0)?,
                name: row.get(1)?,
                distance: row.get(2)?,
                brand_name: row.get(3)?,
                model_name: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    // ── Races ──────────────────────────────────────────────────
    pub fn create_race(&self, race: &super::models::Race) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO races (id, name, distance_km, race_date, terrain, elevation_m, goal_time_s, priority, is_active, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                race.id, race.name, race.distance_km, race.race_date, race.terrain,
                race.elevation_m, race.goal_time_s, race.priority, race.is_active, race.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_race(&self, race: &super::models::Race) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE races SET name=?2, distance_km=?3, race_date=?4, terrain=?5,
             elevation_m=?6, goal_time_s=?7, priority=?8, is_active=?9
             WHERE id=?1",
            params![
                race.id,
                race.name,
                race.distance_km,
                race.race_date,
                race.terrain,
                race.elevation_m,
                race.goal_time_s,
                race.priority,
                race.is_active,
            ],
        )?;
        Ok(())
    }

    pub fn delete_race(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        // Cascade: delete plan sessions, weeks, plans, then race
        conn.execute(
            "DELETE FROM plan_sessions WHERE week_id IN (
                SELECT pw.id FROM plan_weeks pw
                JOIN training_plans tp ON pw.plan_id = tp.id
                WHERE tp.race_id = ?1
            )",
            params![id],
        )?;
        conn.execute(
            "DELETE FROM plan_weeks WHERE plan_id IN (
                SELECT id FROM training_plans WHERE race_id = ?1
            )",
            params![id],
        )?;
        conn.execute("DELETE FROM training_plans WHERE race_id = ?1", params![id])?;
        conn.execute("DELETE FROM races WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_races(&self) -> SqlResult<Vec<super::models::Race>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, distance_km, race_date, terrain, elevation_m, goal_time_s, priority, is_active, created_at
             FROM races ORDER BY race_date ASC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(super::models::Race {
                id: row.get(0)?,
                name: row.get(1)?,
                distance_km: row.get(2)?,
                race_date: row.get(3)?,
                terrain: row.get(4)?,
                elevation_m: row.get(5)?,
                goal_time_s: row.get(6)?,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    pub fn set_active_race(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("UPDATE races SET is_active = 0", [])?;
        conn.execute("UPDATE races SET is_active = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ── Training Plans ─────────────────────────────────────────
    pub fn save_training_plan(&self, plan: &super::models::TrainingPlan) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO training_plans (id, race_id, generated_at, llm_backend, prompt_hash, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                plan.id,
                plan.race_id,
                plan.generated_at,
                plan.llm_backend,
                plan.prompt_hash,
                plan.is_active,
            ],
        )?;
        Ok(())
    }

    pub fn save_plan_week(&self, week: &super::models::PlanWeek) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO plan_weeks (id, plan_id, week_number, week_start) VALUES (?1, ?2, ?3, ?4)",
            params![week.id, week.plan_id, week.week_number, week.week_start],
        )?;
        Ok(())
    }

    pub fn save_plan_session(&self, session: &super::models::PlanSession) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO plan_sessions (id, week_id, day_of_week, session_type, duration_min,
             distance_km, hr_zone, pace_min_low, pace_min_high, notes, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                session.id,
                session.week_id,
                session.day_of_week,
                session.session_type,
                session.duration_min,
                session.distance_km,
                session.hr_zone,
                session.pace_min_low,
                session.pace_min_high,
                session.notes,
                session.status,
            ],
        )?;
        Ok(())
    }

    pub fn get_active_plan(&self) -> SqlResult<Option<super::models::TrainingPlan>> {
        let conn = self.conn();
        let result = conn.query_row(
            "SELECT tp.id, tp.race_id, tp.generated_at, tp.llm_backend, tp.prompt_hash, tp.is_active
             FROM training_plans tp
             WHERE tp.is_active = 1
             ORDER BY tp.generated_at DESC LIMIT 1",
            [],
            |row| {
                Ok(super::models::TrainingPlan {
                    id: row.get(0)?,
                    race_id: row.get(1)?,
                    generated_at: row.get(2)?,
                    llm_backend: row.get(3)?,
                    prompt_hash: row.get(4)?,
                    is_active: row.get(5)?,
                })
            },
        );
        match result {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_plan_weeks(
        &self,
        plan_id: &str,
    ) -> SqlResult<Vec<super::models::PlanWeekWithSessions>> {
        let conn = self.conn();
        let mut week_stmt = conn.prepare(
            "SELECT id, plan_id, week_number, week_start FROM plan_weeks WHERE plan_id = ?1 ORDER BY week_number"
        )?;
        let weeks: Vec<super::models::PlanWeek> = week_stmt
            .query_map(params![plan_id], |row| {
                Ok(super::models::PlanWeek {
                    id: row.get(0)?,
                    plan_id: row.get(1)?,
                    week_number: row.get(2)?,
                    week_start: row.get(3)?,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?;

        let mut result = Vec::new();
        for week in weeks {
            let mut sess_stmt = conn.prepare(
                "SELECT id, week_id, day_of_week, session_type, duration_min, distance_km,
                        hr_zone, pace_min_low, pace_min_high, notes, status,
                        actual_duration_min, actual_distance_km, completed_at
                 FROM plan_sessions WHERE week_id = ?1 ORDER BY day_of_week",
            )?;
            let sessions: Vec<super::models::PlanSession> = sess_stmt
                .query_map(params![week.id], |row| {
                    Ok(super::models::PlanSession {
                        id: row.get(0)?,
                        week_id: row.get(1)?,
                        day_of_week: row.get(2)?,
                        session_type: row.get(3)?,
                        duration_min: row.get(4)?,
                        distance_km: row.get(5)?,
                        hr_zone: row.get(6)?,
                        pace_min_low: row.get(7)?,
                        pace_min_high: row.get(8)?,
                        notes: row.get(9)?,
                        status: row.get(10)?,
                        actual_duration_min: row.get(11)?,
                        actual_distance_km: row.get(12)?,
                        completed_at: row.get(13)?,
                    })
                })?
                .collect::<SqlResult<Vec<_>>>()?;

            result.push(super::models::PlanWeekWithSessions { week, sessions });
        }
        Ok(result)
    }

    pub fn update_session_status(
        &self,
        session_id: &str,
        status: &str,
        actual_duration_min: Option<i64>,
        actual_distance_km: Option<f64>,
    ) -> SqlResult<()> {
        let conn = self.conn();
        let completed_at = if status == "completed" {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };
        conn.execute(
            "UPDATE plan_sessions SET status=?2, actual_duration_min=?3, actual_distance_km=?4, completed_at=?5
             WHERE id=?1",
            params![session_id, status, actual_duration_min, actual_distance_km, completed_at],
        )?;
        Ok(())
    }

    pub fn list_plans(&self) -> SqlResult<Vec<super::models::TrainingPlanSummary>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT tp.id, tp.race_id, r.name, tp.generated_at, tp.is_active,
                    (SELECT COUNT(*) FROM plan_sessions ps
                     JOIN plan_weeks pw ON ps.week_id = pw.id
                     WHERE pw.plan_id = tp.id) AS total_sessions,
                    (SELECT COUNT(*) FROM plan_sessions ps
                     JOIN plan_weeks pw ON ps.week_id = pw.id
                     WHERE pw.plan_id = tp.id AND ps.status = 'completed') AS completed_sessions
             FROM training_plans tp
             JOIN races r ON tp.race_id = r.id
             ORDER BY tp.generated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(super::models::TrainingPlanSummary {
                id: row.get(0)?,
                race_id: row.get(1)?,
                race_name: row.get(2)?,
                generated_at: row.get(3)?,
                is_active: row.get(4)?,
                total_sessions: row.get(5)?,
                completed_sessions: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn set_active_plan(&self, plan_id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("UPDATE training_plans SET is_active = 0", [])?;
        conn.execute(
            "UPDATE training_plans SET is_active = 1 WHERE id = ?1",
            params![plan_id],
        )?;
        Ok(())
    }

    pub fn deactivate_all_plans(&self) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("UPDATE training_plans SET is_active = 0", [])?;
        Ok(())
    }

    pub fn delete_plans_for_race(&self, race_id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "DELETE FROM plan_sessions WHERE week_id IN (
                SELECT pw.id FROM plan_weeks pw
                JOIN training_plans tp ON pw.plan_id = tp.id
                WHERE tp.race_id = ?1
            )",
            params![race_id],
        )?;
        conn.execute(
            "DELETE FROM plan_weeks WHERE plan_id IN (
                SELECT id FROM training_plans WHERE race_id = ?1
            )",
            params![race_id],
        )?;
        conn.execute(
            "DELETE FROM training_plans WHERE race_id = ?1",
            params![race_id],
        )?;
        Ok(())
    }

    pub fn delete_plan(&self, plan_id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "DELETE FROM plan_sessions WHERE week_id IN (
                SELECT id FROM plan_weeks WHERE plan_id = ?1
            )",
            params![plan_id],
        )?;
        conn.execute(
            "DELETE FROM plan_weeks WHERE plan_id = ?1",
            params![plan_id],
        )?;
        conn.execute("DELETE FROM training_plans WHERE id = ?1", params![plan_id])?;
        Ok(())
    }
}
