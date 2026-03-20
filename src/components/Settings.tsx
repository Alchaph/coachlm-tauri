import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Save, RefreshCw, Plug, Unplug, Download, Upload, FileUp, Check, X } from "lucide-react";

interface SettingsData {
  active_llm: string;
  ollama_endpoint: string;
  ollama_model: string;
  custom_system_prompt: string;
}

interface StravaAuthStatus {
  connected: boolean;
  expires_at: number | null;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    active_llm: "local",
    ollama_endpoint: "http://localhost:11434",
    ollama_model: "",
    custom_system_prompt: "",
  });
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [stravaAuth, setStravaAuth] = useState<StravaAuthStatus>({ connected: false, expires_at: null });
  const [stravaAvailable, setStravaAvailable] = useState(false);

  useEffect(() => {
    void loadData();

    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen("strava:auth:complete", () => {
        void loadData();
      });
    })();

    return () => { unlisten?.(); };
  }, []);

  const loadData = async () => {
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
      setStravaAuth(auth);
      setStravaAvailable(available);
    } catch {
      showToast("Failed to load settings", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3000);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", { data: settings });
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
    } catch {
      showToast("Failed to fetch models", "error");
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
    try {
      await invoke("disconnect_strava");
      const auth = await invoke<StravaAuthStatus>("get_strava_auth_status");
      setStravaAuth(auth);
      showToast("Strava disconnected", "success");
    } catch {
      showToast("Failed to disconnect Strava", "error");
    }
  };

  const exportContext = async () => {
    try {
      const date = new Date().toISOString().split("T")[0];
      const filePath = await save({
        defaultPath: `coach-context-${date}.coachctx`,
        filters: [{ name: "Coach Context", extensions: ["coachctx"] }]
      });
      if (filePath) {
        await invoke("export_context", { filePath });
        showToast("Context exported", "success");
      }
    } catch {
      showToast("Failed to export context", "error");
    }
  };

  const importContext = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "Coach Context", extensions: ["coachctx"] }]
      });
      if (filePath && !Array.isArray(filePath)) {
        await invoke("import_context", { filePath, replaceAll: false });
        showToast("Context imported", "success");
      }
    } catch {
      showToast("Failed to import context", "error");
    }
  };

  const importFitFile = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "FIT File", extensions: ["fit"] }]
      });
      if (filePath && !Array.isArray(filePath)) {
        const count = await invoke<number>("import_fit_file", { filePath });
        showToast(`Imported ${String(count)} activities from FIT file`, "success");
      }
    } catch {
      showToast("Failed to import FIT file", "error");
    }
  };

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Settings</h1>
        <button className="btn-primary" onClick={() => void saveSettings()} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Save size={16} />
          Save Settings
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 600 }}>
        
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>LLM Configuration</h2>
          
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
                    onClick={() => { setSettings({ ...settings, ollama_model: model }); }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
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
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Strava Integration</h2>
          
          {!stravaAvailable ? (
            <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: 6, border: "1px solid var(--border)" }}>
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
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Data Management</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Export or import your athlete profile, pinned insights, and settings.
          </p>
          
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={() => void exportContext()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Download size={16} /> Export Context
            </button>
            <button className="btn-secondary" onClick={() => void importContext()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Upload size={16} /> Import Context
            </button>
            <button className="btn-secondary" onClick={() => void importFitFile()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileUp size={16} /> Import FIT File
            </button>
          </div>
        </div>

      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
