import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, ChevronRight, ChevronLeft, Zap, Globe, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import CloudProviderGuide from "@/components/CloudProviderGuide";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [stravaAvailable, setStravaAvailable] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [provider, setProvider] = useState("ollama");
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [cloudApiKey, setCloudApiKey] = useState("");
  const [cloudModel, setCloudModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkStrava = async () => {
      try {
        const available = await invoke<boolean>("get_strava_credentials_available");
        setStravaAvailable(available);
      } catch {
        toast.error("Failed to check Strava status");
      }
    };
    void checkStrava();
  }, []);

  const handleConnectStrava = async () => {
    try {
      await invoke("start_strava_auth");
      setStravaConnected(true);
    } catch {
      toast.error("Failed to connect Strava");
    }
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      const fetchedModels = await invoke<string[]>("get_ollama_models", { endpoint: ollamaEndpoint });
      setModels(fetchedModels);
      if (fetchedModels.length > 0 && !ollamaModel) {
        setOllamaModel(fetchedModels[0]);
      }
    } catch {
      toast.error("Failed to fetch models");
    } finally {
      setFetchingModels(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", {
        data: {
          active_llm: provider,
          ollama_endpoint: ollamaEndpoint,
          ollama_model: ollamaModel || "llama3",
          custom_system_prompt: "",
          cloud_api_key: cloudApiKey || null,
          cloud_model: cloudModel || null,
        }
      });
      onComplete();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Card className="w-full max-w-[520px]">
        <CardContent className="flex flex-col gap-6 p-8">
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                role="img"
                aria-label={`Step ${String(s)} of 4${s === step ? ", current" : s < step ? ", completed" : ""}`}
                className={cn(
                  "size-3 rounded-full transition-colors duration-300",
                  s === step ? "bg-primary" : s < step ? "bg-success" : "bg-secondary"
                )}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="text-center flex flex-col gap-4">
              <div className="flex justify-center mb-2">
                <Zap size={48} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold m-0">CoachLM</h1>
              <p className="text-lg text-muted-foreground m-0">Your personal AI running coach</p>
              <div className="bg-secondary p-4 rounded-md text-left mt-4">
                <ul className="list-none p-0 m-0 flex flex-col gap-3">
                  <li className="flex items-center gap-3">
                    <Globe size={20} className="text-primary" />
                    <span>Connects to your Strava account</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Zap size={20} className="text-primary" />
                    <span>Uses local or cloud LLMs</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Settings size={20} className="text-primary" />
                    <span>Stores all your data locally</span>
                  </li>
                </ul>
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={() => { setStep(2); }} className="flex items-center gap-2">
                  Get Started <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold m-0">Connect Strava</h2>
              <p className="text-muted-foreground m-0">
                Sync your running activities automatically to get personalized coaching insights.
              </p>

              <div className="bg-secondary p-6 rounded-md flex flex-col items-center gap-4 mt-2">
                {!stravaAvailable ? (
                  <div className="text-center text-muted-foreground">
                    <p>Strava integration not available (no credentials configured).</p>
                  </div>
                ) : stravaConnected ? (
                  <div className="flex items-center gap-2 text-success font-medium">
                    <Check size={20} /> Strava Connected
                  </div>
                ) : (
                  <Button onClick={() => void handleConnectStrava()} className="w-full py-3 text-base">
                    Connect Strava
                  </Button>
                )}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => { setStep(1); }} className="flex items-center gap-2">
                  <ChevronLeft size={16} /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setStep(3); }}>
                    Skip for now
                  </Button>
                  <Button variant="secondary" onClick={() => { setStep(3); }} className="flex items-center gap-2">
                    Next <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold m-0">LLM Setup</h2>
              <p className="text-muted-foreground m-0">
                Choose a local or cloud LLM provider.
              </p>

              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => { if (v !== null) setProvider(v); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      <SelectItem value="groq">Groq (Cloud - Free Tier)</SelectItem>
                      <SelectItem value="openrouter">OpenRouter (Cloud - Free Tier)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {provider === "ollama" ? (
                  <>
                    <div>
                      <Label htmlFor="ollama-endpoint">Endpoint URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="ollama-endpoint"
                          type="text"
                          value={ollamaEndpoint}
                          onChange={(e) => { setOllamaEndpoint(e.target.value); }}
                          className="flex-1"
                        />
                        <Button variant="secondary" onClick={() => void fetchModels()} disabled={fetchingModels}>
                          Fetch Models
                        </Button>
                      </div>
                    </div>

                    {models.length > 0 && (
                      <div>
                        <Label>Available Models</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {models.map(m => (
                            <Button
                              key={m}
                              variant={ollamaModel === m ? "default" : "secondary"}
                              onClick={() => { setOllamaModel(m); }}
                              size="xs"
                            >
                              {m}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="ollama-model">Model Name</Label>
                      <Input
                        id="ollama-model"
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => { setOllamaModel(e.target.value); }}
                        placeholder="e.g. llama3"
                        className="w-full"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="cloud-api-key">API Key</Label>
                      <Input
                        id="cloud-api-key"
                        type="password"
                        value={cloudApiKey}
                        onChange={(e) => { setCloudApiKey(e.target.value); }}
                        className="w-full"
                        placeholder={provider === "groq" ? "gsk_..." : "sk-or-..."}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {provider === "groq"
                          ? "Get a free API key at console.groq.com"
                          : "Get a free API key at openrouter.ai/keys"}
                      </p>
                      <div className="mt-3">
                        <CloudProviderGuide
                          provider={provider as "groq" | "openrouter"}
                          compact
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="cloud-model">Model Name</Label>
                      <Input
                        id="cloud-model"
                        type="text"
                        value={cloudModel}
                        onChange={(e) => { setCloudModel(e.target.value); }}
                        className="w-full"
                        placeholder={provider === "groq" ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.3-70b-instruct:free"}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => { setStep(2); }} className="flex items-center gap-2">
                  <ChevronLeft size={16} /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => {
                    setOllamaEndpoint("http://localhost:11434");
                    setOllamaModel("llama3");
                    setStep(4);
                  }}>
                    Skip for now
                  </Button>
                  {provider === "ollama" && (
                    <Button variant="ghost" onClick={() => {
                      setOllamaEndpoint("http://localhost:11434");
                      setOllamaModel("llama3");
                      setStep(4);
                    }}>
                      Use defaults
                    </Button>
                  )}
                  <Button onClick={() => { setStep(4); }} className="flex items-center gap-2">
                    Next <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold m-0">All Set!</h2>
              <p className="text-muted-foreground m-0">
                You're ready to start using CoachLM.
              </p>

              <div className="bg-secondary p-6 rounded-md flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="bg-success rounded-full p-1 flex">
                    <Check size={16} className="text-white" />
                  </div>
                  <span>Settings configured</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-full p-1 flex", stravaConnected ? "bg-success" : "bg-muted-foreground")}>
                    <Check size={16} className="text-white" />
                  </div>
                  <span className={cn(stravaConnected ? "text-foreground" : "text-muted-foreground")}>
                    {stravaConnected ? "Strava connected" : "Strava skipped"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-full p-1 flex", (provider === "ollama" ? ollamaModel : cloudModel) ? "bg-success" : "bg-muted-foreground")}>
                    <Check size={16} className="text-white" />
                  </div>
                  <span className={cn((provider === "ollama" ? ollamaModel : cloudModel) ? "text-foreground" : "text-muted-foreground")}>
                    {provider === "ollama"
                      ? (ollamaModel ? `Ollama model: ${ollamaModel}` : "No model selected")
                      : (cloudModel ? `${provider}: ${cloudModel}` : `${provider}: no model selected`)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => { setStep(3); }} className="flex items-center gap-2">
                  <ChevronLeft size={16} /> Back
                </Button>
                <Button onClick={() => void handleComplete()} disabled={saving} className="flex items-center gap-2">
                  Go to Context <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
