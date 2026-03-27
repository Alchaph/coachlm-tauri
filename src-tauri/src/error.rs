use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("{0}")]
    Strava(String),
    #[error("LLM error: {0}")]
    Llm(String),
    #[error("{0}")]
    Fit(String),
    #[error("{0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

// Tauri v2 requires Serialize for command return errors
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        Self::Internal(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_serializes_to_string() {
        let err = AppError::Config("missing key".to_string());
        let serialized = serde_json::to_string(&err).expect("serialize should not fail");
        assert_eq!(serialized, "\"Configuration error: missing key\"");
    }

    #[test]
    fn app_error_from_rusqlite_error() {
        let rusqlite_err = rusqlite::Error::QueryReturnedNoRows;
        let app_err: AppError = rusqlite_err.into();
        assert!(app_err.to_string().contains("Database error"));
    }

    #[test]
    fn app_error_display_variants() {
        assert_eq!(
            AppError::Strava("auth failed".into()).to_string(),
            "auth failed"
        );
        assert_eq!(
            AppError::Llm("timeout".into()).to_string(),
            "LLM error: timeout"
        );
        assert_eq!(AppError::Fit("bad file".into()).to_string(), "bad file");
        assert_eq!(
            AppError::NotFound("race missing".into()).to_string(),
            "race missing"
        );
        assert_eq!(
            AppError::Validation("invalid".into()).to_string(),
            "Validation error: invalid"
        );
        assert_eq!(
            AppError::Internal("oops".into()).to_string(),
            "Internal error: oops"
        );
    }
}
