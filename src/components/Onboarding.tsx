import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, ChevronRight, ChevronLeft, Zap, Globe, Settings } from "lucide-react";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [stravaAvailable, setStravaAvailable] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkStrava = async () => {
      try {
        const available = await invoke<boolean>("get_strava_credentials_available");
        setStravaAvailable(available);
      } catch { /* empty */ }
    };
    checkStrava();
  }, []);

  const handleConnectStrava = async () => {
    try {
      await invoke("start_strava_auth");
      setStravaConnected(true);
    } catch { /* empty */ }
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      const fetchedModels = await invoke<string[]>("get_ollama_models", { endpoint: ollamaEndpoint });
      setModels(fetchedModels);
      if (fetchedModels.length > 0 && !ollamaModel) {
        setOllamaModel(fetchedModels[0]);
      }
    } catch { /* empty */ } finally {
      setFetchingModels(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", {
        data: {
          active_llm: "local",
          ollama_endpoint: ollamaEndpoint,
          ollama_model: ollamaModel || "llama3",
          custom_system_prompt: ""
        }
      });
      onComplete();
    } catch { /* empty */ } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-primary)" }}>
      <div className="card" style={{ width: "100%", maxWidth: 520, padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{
              width: 12, height: 12, borderRadius: "50%",
              background: s === step ? "var(--accent)" : s < step ? "var(--success)" : "var(--bg-tertiary)",
              transition: "background 0.3s"
            }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Zap size={48} color="var(--accent)" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>CoachLM</h1>
            <p style={{ fontSize: 18, color: "var(--text-secondary)", margin: 0 }}>Your personal AI running coach</p>
            <div style={{ background: "var(--bg-tertiary)", padding: 16, borderRadius: 8, textAlign: "left", marginTop: 16 }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Globe size={20} color="var(--accent)" />
                  <span>Connects to your Strava account</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Zap size={20} color="var(--accent)" />
                  <span>Uses local LLMs for privacy</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Settings size={20} color="var(--accent)" />
                  <span>Stores all your data locally</span>
                </li>
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn-primary" onClick={() => setStep(2)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Get Started <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Connect Strava</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Sync your running activities automatically to get personalized coaching insights.
            </p>
            
            <div style={{ background: "var(--bg-tertiary)", padding: 24, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 8 }}>
              {!stravaAvailable ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  <p>Strava integration not available (no credentials configured).</p>
                </div>
              ) : stravaConnected ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 500 }}>
                  <Check size={20} /> Strava Connected
                </div>
              ) : (
                <button className="btn-primary" onClick={handleConnectStrava} style={{ width: "100%", padding: 12, fontSize: 16 }}>
                  Connect Strava
                </button>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setStep(1)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn-secondary" onClick={() => setStep(3)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {stravaConnected ? "Next" : "Skip"} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Ollama Setup</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Configure your local LLM endpoint and select a model.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
              <div>
                <label htmlFor="ollama-endpoint">Endpoint URL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="ollama-endpoint"
                    type="text"
                    value={ollamaEndpoint}
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-secondary" onClick={fetchModels} disabled={fetchingModels}>
                    {fetchingModels ? "Fetching..." : "Fetch Models"}
                  </button>
                </div>
              </div>

              {models.length > 0 && (
                <div>
                  <label>Available Models</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {models.map(m => (
                      <button
                        key={m}
                        className={ollamaModel === m ? "btn-primary" : "btn-secondary"}
                        onClick={() => setOllamaModel(m)}
                        style={{ padding: "4px 12px", fontSize: 13, borderRadius: 16 }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="ollama-model">Model Name</label>
                <input
                  id="ollama-model"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="e.g. llama3"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setStep(2)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronLeft size={16} /> Back
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => {
                  setOllamaEndpoint("http://localhost:11434");
                  setOllamaModel("llama3");
                  setStep(4);
                }}>
                  Use defaults
                </button>
                <button className="btn-primary" onClick={() => setStep(4)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>All Set!</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              You're ready to start using CoachLM.
            </p>

            <div style={{ background: "var(--bg-tertiary)", padding: 24, borderRadius: 8, display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "var(--success)", borderRadius: "50%", padding: 4, display: "flex" }}>
                  <Check size={16} color="white" />
                </div>
                <span>Settings configured</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: stravaConnected ? "var(--success)" : "var(--text-muted)", borderRadius: "50%", padding: 4, display: "flex" }}>
                  <Check size={16} color="white" />
                </div>
                <span style={{ color: stravaConnected ? "inherit" : "var(--text-muted)" }}>
                  {stravaConnected ? "Strava connected" : "Strava skipped"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: ollamaModel ? "var(--success)" : "var(--text-muted)", borderRadius: "50%", padding: 4, display: "flex" }}>
                  <Check size={16} color="white" />
                </div>
                <span style={{ color: ollamaModel ? "inherit" : "var(--text-muted)" }}>
                  {ollamaModel ? `Model selected: ${ollamaModel}` : "No model selected"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setStep(3)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn-primary" onClick={handleComplete} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {saving ? "Saving..." : "Go to Context"} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
