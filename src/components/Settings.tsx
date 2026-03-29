import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "next-themes";
import { RefreshCw, Plug, Unplug, Globe, Info, Sun, Moon, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import OllamaSetupGuide from "@/components/OllamaSetupGuide";
import CloudProviderGuide from "@/components/CloudProviderGuide";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const { theme, setTheme } = useTheme();
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
  const [stravaAuth, setStravaAuth] = useState<StravaAuthStatus>({ connected: false, expires_at: null });
  const [stravaAvailable, setStravaAvailable] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [, setInitialSettings] = useState<SettingsData | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const debouncedSave = useDebouncedCallback(async (data: SettingsData) => {
    try {
      await invoke("save_settings", { data });
      setInitialSettings({ ...data });
      toast.success("Settings saved", { id: "settings-save" });
    } catch {
      toast.error("Failed to save settings", { id: "settings-save" });
    }
  }, 1000);

  const updateSettings = useCallback((patch: Partial<SettingsData>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  const updateSettingsImmediate = useCallback((patch: Partial<SettingsData>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      debouncedSave.cancel();
      void invoke("save_settings", { data: next }).then(
        () => { setInitialSettings({ ...next }); toast.success("Settings saved", { id: "settings-save" }); },
        () => { toast.error("Failed to save settings", { id: "settings-save" }); },
      );
      return next;
    });
  }, [debouncedSave]);

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
      const [rawSettings, auth, available] = await Promise.all([
        invoke<SettingsData | null>("get_settings"),
        invoke<StravaAuthStatus>("get_strava_auth_status"),
        invoke<boolean>("get_strava_credentials_available"),
      ]);
      const rawLlm = rawSettings?.active_llm ?? "";
      const rawEndpoint = rawSettings?.ollama_endpoint ?? "";
      const s: SettingsData = {
        active_llm: rawLlm === "" ? "local" : rawLlm,
        ollama_endpoint: rawEndpoint === "" ? "http://localhost:11434" : rawEndpoint,
        ollama_model: rawSettings?.ollama_model ?? "",
        custom_system_prompt: rawSettings?.custom_system_prompt ?? "",
        cloud_api_key: rawSettings?.cloud_api_key ?? null,
        cloud_model: rawSettings?.cloud_model ?? null,
        web_augmentation_mode: rawSettings?.web_augmentation_mode ?? "off",
      };
      setSettings(s);
      setInitialSettings(s);
      setStravaAuth(auth);
      setStravaAvailable(available);
      if (s.active_llm === "ollama" || s.active_llm === "local") {
        void checkOllamaConnection(s.ollama_endpoint);
      }
    } catch {
      toast.error("Failed to load settings");
    }
  }, [checkOllamaConnection]);

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

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      const fetchedModels = await invoke<string[]>("get_ollama_models", { endpoint: settings.ollama_endpoint });
      setModels(fetchedModels);
      setOllamaConnected(true);
    } catch {
      toast.error("Failed to fetch models");
      setOllamaConnected(false);
    } finally {
      setFetchingModels(false);
    }
  };

  const connectStrava = async () => {
    try {
      await invoke("start_strava_auth");
    } catch {
      toast.error("Failed to connect Strava");
    }
  };

  const disconnectStrava = () => {
    setShowDisconnectConfirm(true);
  };

  const doDisconnectStrava = async () => {
    try {
      await invoke("disconnect_strava");
      const auth = await invoke<StravaAuthStatus>("get_strava_auth_status");
      setStravaAuth(auth);
      toast.success("Strava disconnected");
    } catch {
      toast.error("Failed to disconnect Strava");
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 max-w-[600px]">

        <Card>
          <CardHeader>
            <CardTitle>LLM Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Select value={settings.active_llm === "local" ? "ollama" : settings.active_llm} onValueChange={(v) => { if (v !== null) updateSettingsImmediate({ active_llm: v }); }}>
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

            {(settings.active_llm === "ollama" || settings.active_llm === "local") ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ollama-endpoint">Ollama Endpoint URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ollama-endpoint"
                      type="text"
                      value={settings.ollama_endpoint}
                      onChange={(e) => { updateSettings({ ollama_endpoint: e.target.value }); }}
                      onBlur={() => { void debouncedSave.flush(); }}
                      placeholder="http://localhost:11434"
                      className="flex-1"
                    />
                    <Button variant="secondary" onClick={() => void fetchModels()} disabled={fetchingModels}>
                      <RefreshCw size={16} className={cn(fetchingModels && "animate-spin")} />
                      Fetch Models
                    </Button>
                  </div>
                  {ollamaConnected !== null && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        ollamaConnected ? "bg-green-500" : "bg-destructive"
                      )} />
                      <span className={cn(
                        "text-xs",
                        ollamaConnected ? "text-green-500" : "text-destructive"
                      )}>
                        {ollamaConnected ? "Connected" : "Not reachable"}
                      </span>
                    </div>
                  )}
                  {ollamaConnected === false && (
                    <Accordion className="mt-3 border border-border rounded-md">
                      <AccordionItem value="setup-guide" className="border-none">
                        <AccordionTrigger className="px-3 py-2.5 text-xs font-medium text-destructive bg-secondary rounded-md hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Info size={14} />
                            How to install and start Ollama
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pt-3 pb-4">
                          <OllamaSetupGuide
                            endpoint={settings.ollama_endpoint}
                            compact
                            onConnected={() => { setOllamaConnected(true); }}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ollama-model">Model Name</Label>
                  <Input
                    id="ollama-model"
                    type="text"
                    value={settings.ollama_model}
                    onChange={(e) => { updateSettings({ ollama_model: e.target.value }); }}
                    onBlur={() => { void debouncedSave.flush(); }}
                    placeholder="e.g. llama3"
                  />

                  {models.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {models.map((model) => (
                        <Button
                          key={model}
                          type="button"
                          variant={settings.ollama_model === model ? "default" : "secondary"}
                          size="sm"
                          onClick={() => {
                            const updated = { ...settings, ollama_model: model };
                            setSettings(updated);
                            void invoke("save_settings", { data: updated }).then(
                              () => { toast.success("Settings saved"); },
                              () => { toast.error("Failed to save settings"); },
                            );
                          }}
                        >
                          {model}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cloud-api-key">API Key</Label>
                  <Input
                    id="cloud-api-key"
                    type="password"
                    value={settings.cloud_api_key ?? ""}
                    onChange={(e) => { updateSettings({ cloud_api_key: e.target.value || null }); }}
                    onBlur={() => { void debouncedSave.flush(); }}
                    placeholder={settings.active_llm === "groq" ? "gsk_..." : "sk-or-..."}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {settings.active_llm === "groq"
                      ? "Get a free API key at console.groq.com"
                      : "Get a free API key at openrouter.ai/keys"}
                  </p>
                  <Accordion className="mt-3 border border-border rounded-md">
                    <AccordionItem value="cloud-guide" className="border-none">
                      <AccordionTrigger className="px-3 py-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md hover:no-underline">
                        <span className="flex items-center gap-2">
                          <Info size={14} />
                          How to get your {settings.active_llm === "groq" ? "Groq" : "OpenRouter"} API key
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4">
                        <CloudProviderGuide
                          provider={settings.active_llm as "groq" | "openrouter"}
                          compact
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cloud-model">Model Name</Label>
                  <Input
                    id="cloud-model"
                    type="text"
                    value={settings.cloud_model ?? ""}
                    onChange={(e) => { updateSettings({ cloud_model: e.target.value || null }); }}
                    onBlur={() => { void debouncedSave.flush(); }}
                    placeholder={settings.active_llm === "groq" ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.3-70b-instruct:free"}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-prompt">Custom System Prompt</Label>
              <Textarea
                id="custom-prompt"
                value={settings.custom_system_prompt}
                onChange={(e) => { updateSettings({ custom_system_prompt: e.target.value }); }}
                onBlur={() => { void debouncedSave.flush(); }}
                rows={4}
                placeholder="Add custom instructions for the coach..."
                className="resize-y"
              />
            </div>

            <Accordion className="border border-border rounded-md">
              <AccordionItem value="tips" className="border-none">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Info size={14} />
                    Getting better answers from your coach
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground leading-relaxed">
                  <p className="mb-3">
                    Local LLMs are powerful but have limitations. Smaller models (7B-8B parameters) may
                    misinterpret domain-specific running terms. For example, asking about the
                    &ldquo;Norwegian method&rdquo; might return information about Nordic walking instead of
                    threshold-based interval training.
                  </p>
                  <p className="font-semibold mb-1.5 text-foreground">Tips for better results:</p>
                  <ul className="list-disc pl-5 mb-3 space-y-1">
                    <li>Be specific: &ldquo;Norwegian 4x4 threshold interval training&rdquo; instead of just &ldquo;Norwegian method&rdquo;</li>
                    <li>Add context: &ldquo;For my marathon training, explain the Norwegian method of lactate threshold intervals&rdquo;</li>
                    <li>Use the custom system prompt above to anchor vocabulary, e.g. &ldquo;When I say Norwegian method, I mean threshold-based 4x4 minute intervals&rdquo;</li>
                    <li>If answers seem off-topic, rephrase with more running-specific terms</li>
                  </ul>
                  <p className="font-semibold mb-1.5 text-foreground">Model recommendations:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>For best local results, use 13B+ parameter models (e.g. llama3:13b, mistral-nemo)</li>
                    <li>Cloud providers (Groq, OpenRouter) offer larger models with better domain knowledge</li>
                    <li>Filling in your athlete profile and training history improves answer quality significantly</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Strava Integration</CardTitle>
          </CardHeader>
          <CardContent>
            {!stravaAvailable ? (
              <div className="rounded-md border border-border bg-secondary p-3">
                <p className="text-muted-foreground text-sm">
                  Strava credentials are not configured in the environment. Please set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    stravaAuth.connected ? "bg-green-500" : "bg-muted-foreground"
                  )} />
                  <div>
                    <div className="font-medium text-foreground">
                      {stravaAuth.connected ? "Connected" : "Not connected"}
                    </div>
                    {stravaAuth.connected && stravaAuth.expires_at && (
                      <div className="text-xs text-muted-foreground">
                        Token expires: {new Date(stravaAuth.expires_at * 1000).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {stravaAuth.connected ? (
                  <Button variant="destructive" onClick={() => { disconnectStrava(); }}>
                    <Unplug size={16} /> Disconnect
                  </Button>
                ) : (
                  <Button onClick={() => void connectStrava()}>
                    <Plug size={16} /> Connect Strava
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={18} /> Web Search
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Label>Web Augmentation Mode</Label>
            <p className="text-xs text-muted-foreground">
              Controls how the coach uses the web before answering. Auto detects when a search would help and asks you first. Simple always injects a DuckDuckGo snippet. Agent runs an LLM-driven research loop.
            </p>
            <Select value={settings.web_augmentation_mode} onValueChange={(v) => { if (v !== null) updateSettingsImmediate({ web_augmentation_mode: v }); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="auto">Auto (asks before searching)</SelectItem>
                <SelectItem value="simple">Simple (DuckDuckGo snippet)</SelectItem>
                <SelectItem value="agent">Agent (LLM-driven research)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {([
                { value: "light", label: "Light", icon: <Sun size={16} /> },
                { value: "dark", label: "Dark", icon: <Moon size={16} /> },
                { value: "system", label: "System", icon: <Monitor size={16} /> },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={theme === option.value ? "default" : "secondary"}
                  className="flex flex-1 items-center justify-center gap-2"
                  onClick={() => { setTheme(option.value); }}
                >
                  {option.icon}
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title="Disconnect Strava"
        description="Disconnect your Strava account? You can reconnect later."
        confirmLabel="Disconnect"
        onConfirm={() => { void doDisconnectStrava(); }}
      />
    </div>
  );
}
