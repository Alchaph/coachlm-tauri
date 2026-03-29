use futures_util::StreamExt;
use tauri::Emitter;

use crate::error::AppError;
use crate::models::{
    ChatMessage, CloudProvider, OllamaChatRequest, OllamaChatResponse, OllamaMessage,
    OllamaTagsResponse, OpenAiChatRequest, OpenAiChatResponse, SettingsData,
};

pub async fn chat(
    settings: &SettingsData,
    messages: Vec<OllamaMessage>,
) -> Result<String, AppError> {
    match settings.active_llm.as_str() {
        "groq" | "openrouter" => {
            let base_url = CloudProvider::base_url(&settings.active_llm)
                .ok_or_else(|| AppError::Llm(format!("Unknown cloud provider: {}", settings.active_llm)))?;
            let api_key = settings
                .cloud_api_key
                .as_deref()
                .ok_or_else(|| AppError::Config("API key not configured for cloud provider".into()))?;
            let model = settings
                .cloud_model
                .as_deref()
                .ok_or_else(|| AppError::Config("Model not configured for cloud provider".into()))?;
            chat_with_cloud(base_url, api_key, model, messages).await
        }
        _ => {
            chat_with_ollama(&settings.ollama_endpoint, &settings.ollama_model, messages).await
        }
    }
}

async fn chat_with_cloud(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<OllamaMessage>,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_mins(2))
        .build()?;
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let chat_messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let request = OpenAiChatRequest {
        model: model.to_string(),
        messages: chat_messages,
        stream: false,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("HTTP-Referer", "https://coachlm.app")
        .header("X-Title", "CoachLM")
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Llm(format!("Failed to reach cloud provider: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Llm(format!("Cloud provider returned status {status}: {body}")));
    }

    let text = response
        .text()
        .await
        .map_err(|e| AppError::Llm(format!("Failed to read cloud response: {e}")))?;
    let body: OpenAiChatResponse = serde_json::from_str(&text).map_err(|e| {
        AppError::Llm(format!(
            "Failed to parse cloud response: {e}\nRaw response: {}",
            &text[..text.len().min(500)]
        ))
    })?;

    body.choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::Llm("Empty response from cloud provider".into()))
}

pub async fn chat_with_ollama(
    endpoint: &str,
    model: &str,
    messages: Vec<OllamaMessage>,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_mins(5))
        .build()?;
    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));

    let request = OllamaChatRequest {
        model: model.to_string(),
        messages,
        stream: false,
    };

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::Llm("Ollama is not running. Start it with 'ollama serve' and try again.".into())
            } else {
                AppError::Llm(format!("Failed to reach Ollama: {e}"))
            }
        })?;

    if !response.status().is_success() {
        return Err(AppError::Llm(format!("Ollama returned status {}", response.status())));
    }

    let body: OllamaChatResponse = response.json().await?;
    body.message
        .map(|m| m.content)
        .ok_or_else(|| AppError::Llm("Empty response from Ollama".into()))
}

pub async fn get_ollama_models(endpoint: &str) -> Result<Vec<String>, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::Llm("Ollama is not running. Start it with 'ollama serve' and try again.".into())
            } else {
                AppError::Llm(format!("Failed to reach Ollama: {e}"))
            }
        })?;

    if !response.status().is_success() {
        return Err(AppError::Llm(format!("Ollama returned status {}", response.status())));
    }

    let body: OllamaTagsResponse = response.json().await?;
    Ok(body.models.into_iter().map(|m| m.name).collect())
}

pub async fn chat_stream(
    settings: &SettingsData,
    messages: Vec<OllamaMessage>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
) -> Result<String, AppError> {
    match settings.active_llm.as_str() {
        "groq" | "openrouter" => {
            let base_url = CloudProvider::base_url(&settings.active_llm)
                .ok_or_else(|| AppError::Llm(format!("Unknown cloud provider: {}", settings.active_llm)))?;
            let api_key = settings.cloud_api_key.as_deref()
                .ok_or_else(|| AppError::Config("API key not configured for cloud provider".into()))?;
            let model = settings.cloud_model.as_deref()
                .ok_or_else(|| AppError::Config("Model not configured for cloud provider".into()))?;
            stream_cloud(base_url, api_key, model, messages, app_handle, session_id).await
        }
        _ => {
            stream_ollama(&settings.ollama_endpoint, &settings.ollama_model, messages, app_handle, session_id).await
        }
    }
}

async fn stream_ollama(
    endpoint: &str,
    model: &str,
    messages: Vec<OllamaMessage>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()?;
    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));

    let request = OllamaChatRequest {
        model: model.to_string(),
        messages,
        stream: true,
    };

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::Llm("Ollama is not running. Start it with 'ollama serve' and try again.".into())
            } else {
                AppError::Llm(format!("Failed to reach Ollama: {e}"))
            }
        })?;

    if !response.status().is_success() {
        return Err(AppError::Llm(format!("Ollama returned status {}", response.status())));
    }

    let mut full_response = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| AppError::Llm(format!("Stream error: {e}")))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(parsed) = serde_json::from_str::<crate::models::OllamaStreamChunk>(&line) {
                if let Some(ref msg) = parsed.message {
                    if !msg.content.is_empty() {
                        full_response.push_str(&msg.content);
                        app_handle
                            .emit("chat:send:chunk", serde_json::json!({
                                "session_id": session_id,
                                "content": msg.content,
                                "done": false
                            }))
                            .ok();
                    }
                }
                if parsed.done {
                    app_handle
                        .emit("chat:send:chunk", serde_json::json!({
                            "session_id": session_id,
                            "content": "",
                            "done": true
                        }))
                        .ok();
                }
            }
        }
    }

    if full_response.is_empty() {
        return Err(AppError::Llm("Empty response from Ollama".into()));
    }

    Ok(full_response)
}

async fn stream_cloud(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<OllamaMessage>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_mins(2))
        .build()?;
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let chat_messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let request = OpenAiChatRequest {
        model: model.to_string(),
        messages: chat_messages,
        stream: true,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("HTTP-Referer", "https://coachlm.app")
        .header("X-Title", "CoachLM")
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Llm(format!("Failed to reach cloud provider: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Llm(format!("Cloud provider returned status {status}: {body}")));
    }

    let mut full_response = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| AppError::Llm(format!("Stream error: {e}")))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(double_newline) = buffer.find("\n\n") {
            let event_block = buffer[..double_newline].to_string();
            buffer = buffer[double_newline + 2..].to_string();

            for line in event_block.lines() {
                let line = line.trim();
                if line == "data: [DONE]" {
                    app_handle
                        .emit("chat:send:chunk", serde_json::json!({
                            "session_id": session_id,
                            "content": "",
                            "done": true
                        }))
                        .ok();
                    continue;
                }
                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(parsed) = serde_json::from_str::<crate::models::OpenAiStreamChunk>(data) {
                        for choice in &parsed.choices {
                            if let Some(ref content) = choice.delta.content {
                                if !content.is_empty() {
                                    full_response.push_str(content);
                                    app_handle
                                        .emit("chat:send:chunk", serde_json::json!({
                                            "session_id": session_id,
                                            "content": content,
                                            "done": false
                                        }))
                                        .ok();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if full_response.is_empty() {
        return Err(AppError::Llm("Empty response from cloud provider".into()));
    }

    Ok(full_response)
}

fn extract_json_block(text: &str) -> &str {
    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            return after[..end].trim();
        }
    }
    if let Some(start) = text.find("```") {
        let after = &text[start + 3..];
        if let Some(end) = after.find("```") {
            let inner = after[..end].trim();
            if inner.starts_with('{') || inner.starts_with('[') {
                return inner;
            }
        }
    }
    let trimmed = text.trim();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return trimmed;
    }
    if let Some(pos) = text.find('\n') {
        let after_newline = text[pos + 1..].trim_start();
        if after_newline.starts_with('{') || after_newline.starts_with('[') {
            return after_newline;
        }
    }
    text.trim()
}

const JSON_RETRY_LIMIT: u8 = 2;

pub async fn chat_json<T: serde::de::DeserializeOwned>(
    settings: &SettingsData,
    messages: Vec<OllamaMessage>,
) -> Result<T, AppError> {
    let mut last_error = AppError::Llm(String::new());
    for attempt in 0..=JSON_RETRY_LIMIT {
        let raw = match chat(settings, messages.clone()).await {
            Ok(r) => r,
            Err(e) => {
                last_error = AppError::Llm(format!("LLM call failed (attempt {attempt}): {e}"));
                continue;
            }
        };
        let json_str = extract_json_block(&raw);
        match serde_json::from_str::<T>(json_str) {
            Ok(parsed) => return Ok(parsed),
            Err(e) => {
                let msg = format!(
                    "JSON parse failed (attempt {attempt}): {e}\nRaw: {}",
                    &raw[..raw.len().min(300)]
                );
                log::warn!("{msg}");
                last_error = AppError::Llm(msg);
            }
        }
    }
    Err(last_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ollama_settings() -> SettingsData {
        SettingsData {
            active_llm: "ollama".to_string(),
            ollama_endpoint: "http://localhost:11434".to_string(),
            ollama_model: "llama3".to_string(),
            custom_system_prompt: String::new(),
            cloud_api_key: None,
            cloud_model: None,
            web_search_enabled: false,
            web_search_provider: String::new(),
            web_augmentation_mode: "off".to_string(),
        }
    }

    fn groq_settings() -> SettingsData {
        SettingsData {
            active_llm: "groq".to_string(),
            ollama_endpoint: String::new(),
            ollama_model: String::new(),
            custom_system_prompt: String::new(),
            cloud_api_key: Some("gsk_test_key".to_string()),
            cloud_model: Some("llama-3.3-70b-versatile".to_string()),
            web_search_enabled: false,
            web_search_provider: String::new(),
            web_augmentation_mode: "off".to_string(),
        }
    }

    fn sample_messages() -> Vec<OllamaMessage> {
        vec![OllamaMessage {
            role: "user".to_string(),
            content: "hello".to_string(),
        }]
    }

    #[tokio::test]
    async fn chat_groq_missing_api_key_returns_error() {
        let mut settings = groq_settings();
        settings.cloud_api_key = None;
        let result = chat(&settings, sample_messages()).await;
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err").to_string();
        assert!(err.contains("API key not configured"), "error: {err}");
    }

    #[tokio::test]
    async fn chat_groq_missing_model_returns_error() {
        let mut settings = groq_settings();
        settings.cloud_model = None;
        let result = chat(&settings, sample_messages()).await;
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err").to_string();
        assert!(err.contains("Model not configured"), "error: {err}");
    }

    #[tokio::test]
    async fn chat_openrouter_missing_api_key_returns_error() {
        let settings = SettingsData {
            active_llm: "openrouter".to_string(),
            cloud_api_key: None,
            cloud_model: Some("meta-llama/llama-3.3-70b-instruct:free".to_string()),
            ..groq_settings()
        };
        let result = chat(&settings, sample_messages()).await;
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err").to_string();
        assert!(err.contains("API key not configured"), "error: {err}");
    }

    #[tokio::test]
    async fn chat_ollama_does_not_require_cloud_fields() {
        let mut settings = ollama_settings();
        settings.ollama_endpoint = "http://127.0.0.1:1".to_string();
        let result = chat(&settings, sample_messages()).await;
        assert!(result.is_err(), "should fail on connection, not validation");
        let err = result.expect_err("already checked is_err").to_string();
        assert!(!err.contains("API key"), "should not be a cloud validation error: {err}");
        assert!(!err.contains("Model not configured"), "should not be a cloud validation error: {err}");
    }

    #[tokio::test]
    async fn chat_local_falls_through_to_ollama() {
        let mut settings = ollama_settings();
        settings.active_llm = "local".to_string();
        settings.ollama_endpoint = "http://127.0.0.1:1".to_string();
        let result = chat(&settings, sample_messages()).await;
        assert!(result.is_err(), "should fail on connection, not validation");
        let err = result.expect_err("already checked is_err").to_string();
        assert!(!err.contains("API key"), "should not be a cloud validation error: {err}");
    }

    #[test]
    fn extract_json_block_from_markdown() {
        let input = "Here is the result:\n```json\n{\"action\": \"search\", \"query\": \"test\"}\n```\nDone.";
        let extracted = extract_json_block(input);
        assert!(extracted.starts_with('{'), "got: {extracted}");
        let _: serde_json::Value = serde_json::from_str(extracted).expect("valid JSON");
    }

    #[test]
    fn extract_json_block_raw_json() {
        let input = "{\"action\": \"finish\", \"answer_outline\": \"done\"}";
        let extracted = extract_json_block(input);
        assert_eq!(extracted, input);
    }

    #[test]
    fn extract_json_block_with_preamble() {
        let input = "Sure! Here you go:\n{\"key\": \"value\"}";
        let extracted = extract_json_block(input);
        assert!(extracted.starts_with('{'), "got: {extracted}");
    }
}
