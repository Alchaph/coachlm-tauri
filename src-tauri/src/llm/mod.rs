use crate::models::{OllamaChatRequest, OllamaChatResponse, OllamaMessage, OllamaTagsResponse};

pub async fn chat_with_ollama(
    endpoint: &str,
    model: &str,
    messages: Vec<OllamaMessage>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
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
                "Ollama is not running. Start it with 'ollama serve' and try again.".to_string()
            } else {
                format!("Failed to reach Ollama: {e}")
            }
        })?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned status {}", response.status()));
    }

    let body: OllamaChatResponse = response.json().await.map_err(|e| e.to_string())?;
    body.message
        .map(|m| m.content)
        .ok_or_else(|| "Empty response from Ollama".to_string())
}

pub async fn get_ollama_models(endpoint: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                "Ollama is not running. Start it with 'ollama serve' and try again.".to_string()
            } else {
                format!("Failed to reach Ollama: {e}")
            }
        })?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned status {}", response.status()));
    }

    let body: OllamaTagsResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(body.models.into_iter().map(|m| m.name).collect())
}
