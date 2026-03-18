use crate::models::ActivityData;
use fitparser::de::from_reader_with_options;
use fitparser::profile::MesgNum;
use fitparser::Value;
use std::collections::HashSet;
use std::fs::File;

/// Parse a FIT file and extract session-level activity summaries.
///
/// Each FIT file may contain one or more Session records. Each session
/// becomes an ActivityData entry. If no session records exist, an error
/// is returned.
pub fn import_fit_file(file_path: &str) -> Result<Vec<ActivityData>, String> {
    let mut file = File::open(file_path).map_err(|e| format!("Failed to open FIT file: {}", e))?;

    let opts = HashSet::new();
    let records = from_reader_with_options(&mut file, &opts)
        .map_err(|e| format!("Failed to parse FIT file: {}", e))?;

    let mut activities: Vec<ActivityData> = Vec::new();

    for record in records {
        if record.kind() != MesgNum::Session {
            continue;
        }

        let mut activity = ActivityData {
            activity_id: uuid::Uuid::new_v4().to_string(),
            strava_id: None,
            name: None,
            activity_type: None,
            start_date: None,
            distance: None,
            moving_time: None,
            average_speed: None,
            average_heartrate: None,
            max_heartrate: None,
            average_cadence: None,
            gear_id: None,
        };

        for field in record.into_vec() {
            match field.name() {
                "total_distance" => {
                    activity.distance = try_as_f64(field.value());
                }
                "total_timer_time" => {
                    activity.moving_time = try_as_f64(field.value()).map(|t| t as i64);
                }
                "avg_heart_rate" => {
                    activity.average_heartrate = try_as_f64(field.value());
                }
                "max_heart_rate" => {
                    activity.max_heartrate = try_as_f64(field.value());
                }
                "enhanced_avg_speed" | "avg_speed" => {
                    // Only set if not already set (prefer enhanced_avg_speed)
                    if activity.average_speed.is_none() {
                        activity.average_speed = try_as_f64(field.value());
                    }
                }
                "avg_cadence" | "avg_running_cadence" => {
                    if activity.average_cadence.is_none() {
                        activity.average_cadence = try_as_f64(field.value());
                    }
                }
                "sport" | "sub_sport" => {
                    if activity.activity_type.is_none() {
                        activity.activity_type = try_as_string(field.value());
                    }
                }
                "sport_profile_name" => {
                    activity.name = try_as_string(field.value());
                }
                "start_time" | "timestamp" => {
                    if activity.start_date.is_none() {
                        if let Value::Timestamp(dt) = field.value() {
                            activity.start_date = Some(dt.format("%Y-%m-%dT%H:%M:%SZ").to_string());
                        }
                    }
                }
                _ => {}
            }
        }

        // Fall back to a generated name if the FIT file had no sport_profile_name
        if activity.name.is_none() {
            activity.name = activity
                .activity_type
                .as_ref()
                .map(|t| format!("Imported {} activity", t));
        }

        activities.push(activity);
    }

    if activities.is_empty() {
        return Err("No session data found in FIT file".to_string());
    }

    Ok(activities)
}

/// Try to extract an f64 from a fitparser Value.
fn try_as_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Float64(f) => Some(*f),
        Value::Float32(f) => Some(f64::from(*f)),
        Value::UInt8(n) => Some(f64::from(*n)),
        Value::UInt16(n) => Some(f64::from(*n)),
        Value::UInt32(n) => Some(*n as f64),
        Value::SInt8(n) => Some(f64::from(*n)),
        Value::SInt16(n) => Some(f64::from(*n)),
        Value::SInt32(n) => Some(*n as f64),
        _ => None,
    }
}

/// Try to extract a String from a fitparser Value.
fn try_as_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Enum(e) => Some(e.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_try_as_f64_float() {
        assert_eq!(try_as_f64(&Value::Float64(42.5)), Some(42.5));
    }

    #[test]
    fn test_try_as_f64_uint() {
        assert_eq!(try_as_f64(&Value::UInt16(180)), Some(180.0));
    }

    #[test]
    fn test_try_as_f64_string_returns_none() {
        assert_eq!(try_as_f64(&Value::String("nope".to_string())), None);
    }

    #[test]
    fn test_try_as_string_from_string() {
        assert_eq!(
            try_as_string(&Value::String("running".to_string())),
            Some("running".to_string())
        );
    }

    #[test]
    fn test_try_as_string_from_enum() {
        assert_eq!(try_as_string(&Value::Enum(1)), Some("1".to_string()));
    }

    #[test]
    fn test_try_as_string_from_float_returns_none() {
        assert_eq!(try_as_string(&Value::Float64(1.0)), None);
    }

    #[test]
    fn test_import_nonexistent_file() {
        let result = import_fit_file("/tmp/does_not_exist.fit");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open"));
    }
}
