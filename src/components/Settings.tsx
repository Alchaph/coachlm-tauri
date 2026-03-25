import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { Save, RefreshCw, Plug, Unplug, Globe, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useToast } from "../hooks/useToast";

interface SettingsData {
  active_llm: string;
  ollama_endpoint: string;
  ollama_model: string;
  custom_system_prompt: string;
  cloud_api_key: string | null;
  cloud_model: string | null;
  web_augmentation_mode: string;
}

interface StravaAuthStatus {
  connected: boolean;
  expires_at: number | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    active_llm: "local",
    ollama_endpoint: "http://localhost:11434",
    ollama_model: "",
    custom_system_prompt: "",
    cloud_api_key: null,
    cloud_model: null,
    web_augmentation_mode: "off",
  });
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast, toastElement } = useToast();
  const [stravaAuth, setStravaAuth] = useState<StravaAuthStatus>({ connected: false, expires_at: null });
  const [stravaAvailable, setStravaAvailable] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const isDirty = initialSettings !== null && JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const checkOllamaConnection = useCallback(async (endpoint: string) => {
    try {
      const connected = await invoke<boolean>("check_ollama_status", { endpoint });
      setOllamaConnected(connected);
    } catch {
      setOllamaConnected(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, auth, available] = await Promise.all([
        invoke<SettingsData>("get_settings"),
        invoke<StravaAuthStatus>("get_strava_auth_status"),
        invoke<boolean>("get_strava_credentials_available"),
      ]);
      setSettings({
        ...s,
        active_llm: s.active_llm || "local",
        ollama_endpoint: s.ollama_endpoint || "http://localhost:11434",
      });
      setInitialSettings({
        ...s,
        active_llm: s.active_llm || "local",
        ollama_endpoint: s.ollama_endpoint || "http://localhost:11434",
      });
      setStravaAuth(auth);
      setStravaAvailable(available);
      if (s.active_llm === "ollama" || s.active_llm === "local" || !s.active_llm) {
        void checkOllamaConnection(s.ollama_endpoint || "http://localhost:11434");
      }
    } catch {
      showToast("Failed to load settings", "error");
    }
  }, [showToast, checkOllamaConnection]);

  useEffect(() => {
    void loadData();

    const state = { cancelled: false };
    let unlisten: (() => void) | undefined;
    void (async () => {
      const fn = await listen("strava:auth:complete", () => {
        if (state.cancelled) return;
        void loadData();
      });
      if (state.cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();

    return () => { state.cancelled = true; unlisten?.(); };
  }, [loadData]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", { data: settings });
      setInitialSettings({ ...settings });
      showToast("Settings saved", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      const fetchedModels = await invoke<string[]>("get_ollama_models", { endpoint: settings.ollama_endpoint });
      setModels(fetchedModels);
      setOllamaConnected(true);
    } catch {
      showToast("Failed to fetch models", "error");
      setOllamaConnected(false);
    } finally {
      setFetchingModels(false);
    }
  };

  const connectStrava = async () => {
    try {
      await invoke("start_strava_auth");
    } catch {
      showToast("Failed to connect Strava", "error");
    }
  };

  const disconnectStrava = async () => {
    const confirmed = await ask("Disconnect your Strava account? You can reconnect later.", { title: "CoachLM", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("disconnect_strava");
      const auth = await invoke<StravaAuthStatus>("get_strava_auth_status");
      setStravaAuth(auth);
      showToast("Strava disconnected", "success");
    } catch {
      showToast("Failed to disconnect Strava", "error");
    }
  };


  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Settings</h1>
        <button className="btn-primary" onClick={() => void saveSettings()} disabled={saving || !isDirty} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Save size={16} />
          Save Settings
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 600 }}>
        
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>LLM Configuration</h2>
          
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="llm-provider">Provider</label>
            <select
              id="llm-provider"
              value={settings.active_llm === "local" ? "ollama" : settings.active_llm}
              onChange={(e) => { setSettings({ ...settings, active_llm: e.target.value }); }}
              style={{ width: "100%" }}
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="groq">Groq (Cloud - Free Tier)</option>
              <option value="openrouter">OpenRouter (Cloud - Free Tier)</option>
            </select>
          </div>

          {(settings.active_llm === "ollama" || settings.active_llm === "local") ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="ollama-endpoint">Ollama Endpoint URL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="ollama-endpoint"
                    type="text"
                    value={settings.ollama_endpoint}
                    onChange={(e) => { setSettings({ ...settings, ollama_endpoint: e.target.value }); }}
                    style={{ flex: 1 }}
                    placeholder="http://localhost:11434"
                  />
                  <button className="btn-secondary" onClick={() => void fetchModels()} disabled={fetchingModels} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <RefreshCw size={16} className={fetchingModels ? "spin" : ""} />
                    Fetch Models
                  </button>
                </div>
                {ollamaConnected !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: ollamaConnected ? "var(--success)" : "var(--danger)",
                    }} />
                    <span style={{ fontSize: 12, color: ollamaConnected ? "var(--success)" : "var(--danger)" }}>
                      {ollamaConnected ? "Connected" : "Not reachable"}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="ollama-model">Model Name</label>
                <input
                  id="ollama-model"
                  type="text"
                  value={settings.ollama_model}
                  onChange={(e) => { setSettings({ ...settings, ollama_model: e.target.value }); }}
                  style={{ width: "100%" }}
                  placeholder="e.g. llama3"
                />
                
                {models.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {models.map((model) => (
                      <button
                        key={model}
                        onClick={() => {
                          const updated = { ...settings, ollama_model: model };
                          setSettings(updated);
                          void invoke("save_settings", { data: updated }).then(
                            () => { showToast("Settings saved", "success"); },
                            () => { showToast("Failed to save settings", "error"); },
                          );
                        }}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 0,
                          fontSize: 12,
                          border: `1px solid var(--border)`,
                          background: settings.ollama_model === model ? "var(--accent)" : "var(--bg-tertiary)",
                          color: settings.ollama_model === model ? "white" : "var(--text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="cloud-api-key">API Key</label>
                <input
                  id="cloud-api-key"
                  type="password"
                  value={settings.cloud_api_key ?? ""}
                  onChange={(e) => { setSettings({ ...settings, cloud_api_key: e.target.value || null }); }}
                  style={{ width: "100%" }}
                  placeholder={settings.active_llm === "groq" ? "gsk_..." : "sk-or-..."}
                />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {settings.active_llm === "groq"
                    ? "Get a free API key at console.groq.com"
                    : "Get a free API key at openrouter.ai/keys"}
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="cloud-model">Model Name</label>
                <input
                  id="cloud-model"
                  type="text"
                  value={settings.cloud_model ?? ""}
                  onChange={(e) => { setSettings({ ...settings, cloud_model: e.target.value || null }); }}
                  style={{ width: "100%" }}
                  placeholder={settings.active_llm === "groq" ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.3-70b-instruct:free"}
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="custom-prompt">Custom System Prompt</label>
            <textarea
              id="custom-prompt"
              value={settings.custom_system_prompt}
              onChange={(e) => { setSettings({ ...settings, custom_system_prompt: e.target.value }); }}
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Add custom instructions for the coach..."
            />
          </div>

          <div style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: 0 }}>
            <button
              type="button"
              onClick={() => { setTipsExpanded(!tipsExpanded); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                background: "var(--bg-tertiary)",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Info size={14} />
              Getting better answers from your coach
              <span style={{ marginLeft: "auto" }}>
                {tipsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {tipsExpanded && (
              <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}>
                  Local LLMs are powerful but have limitations. Smaller models (7B-8B parameters) may
                  misinterpret domain-specific running terms. For example, asking about the
                  &ldquo;Norwegian method&rdquo; might return information about Nordic walking instead of
                  threshold-based interval training.
                </p>
                <p style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>Tips for better results:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
                  <li style={{ marginBottom: 4 }}>Be specific: &ldquo;Norwegian 4x4 threshold interval training&rdquo; instead of just &ldquo;Norwegian method&rdquo;</li>
                  <li style={{ marginBottom: 4 }}>Add context: &ldquo;For my marathon training, explain the Norwegian method of lactate threshold intervals&rdquo;</li>
                  <li style={{ marginBottom: 4 }}>Use the custom system prompt above to anchor vocabulary, e.g. &ldquo;When I say Norwegian method, I mean threshold-based 4x4 minute intervals&rdquo;</li>
                  <li style={{ marginBottom: 4 }}>If answers seem off-topic, rephrase with more running-specific terms</li>
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>Model recommendations:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                  <li style={{ marginBottom: 4 }}>For best local results, use 13B+ parameter models (e.g. llama3:13b, mistral-nemo)</li>
                  <li style={{ marginBottom: 4 }}>Cloud providers (Groq, OpenRouter) offer larger models with better domain knowledge</li>
                  <li style={{ marginBottom: 4 }}>Filling in your athlete profile and training history improves answer quality significantly</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Strava Integration</h2>
          
          {!stravaAvailable ? (
            <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: 0, border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Strava credentials are not configured in the environment. Please set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 10, height: 10, borderRadius: "50%", 
                  background: stravaAuth.connected ? "var(--success)" : "var(--text-muted)" 
                }} />
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {stravaAuth.connected ? "Connected" : "Not connected"}
                  </div>
                  {stravaAuth.connected && stravaAuth.expires_at && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Token expires: {new Date(stravaAuth.expires_at * 1000).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              
              {stravaAuth.connected ? (
                <button className="btn-danger" onClick={() => void disconnectStrava()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Unplug size={16} /> Disconnect
                </button>
              ) : (
                <button className="btn-primary" onClick={() => void connectStrava()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Plug size={16} /> Connect Strava
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={18} /> Web Search
            </span>
          </h2>

          <div>
            <label htmlFor="web-augmentation-mode">Web Augmentation Mode</label>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 8 }}>
              Controls how the coach uses the web before answering. Simple injects a DuckDuckGo snippet. Agent runs an LLM-driven research loop.
            </p>
            <select
              id="web-augmentation-mode"
              value={settings.web_augmentation_mode}
              onChange={(e) => { setSettings({ ...settings, web_augmentation_mode: e.target.value }); }}
              style={{ width: "100%" }}
            >
              <option value="off">Off</option>
              <option value="simple">Simple (DuckDuckGo snippet)</option>
              <option value="agent">Agent (LLM-driven research)</option>
            </select>
          </div>
        </div>

      </div>

      {toastElement}
    </div>
  );
}
