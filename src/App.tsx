import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { MessageSquare, LayoutDashboard, Brain, Calendar, Settings as SettingsIcon, RefreshCw, X, Check, Zap, CloudDownload, Download } from "lucide-react";
import Chat from "./components/Chat";
import Dashboard from "./components/Dashboard";
import Context from "./components/Context";
import SettingsPage from "./components/Settings";
import TrainingPlanPage from "./components/TrainingPlan";
import ShoeCalculator from "./components/ShoeCalculator";
import Onboarding from "./components/Onboarding";
import "./styles/global.css";
import "./styles/markdown.css";

type Tab = "chat" | "dashboard" | "context" | "plan" | "shoes" | "settings";
type ChatStatus = "idle" | "thinking" | "replied";

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [chatProgress, setChatProgress] = useState("");
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planProgress, setPlanProgress] = useState("");
  const [planResult, setPlanResult] = useState<"success" | "error" | null>(null);
  const [planError, setPlanError] = useState("");
  const [syncActive, setSyncActive] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncResult, setSyncResult] = useState<"success" | "error" | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const firstRun = await invoke<boolean>("is_first_run");
        setShowOnboarding(firstRun);
        if (!firstRun) {
          const auth = await invoke<{ connected: boolean; expires_at: number | null }>("get_strava_auth_status");
          if (auth.connected) {
            void invoke("sync_strava_activities");
          }
        }
      } catch {
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const update = await check();
        if (update) {
          setUpdateAvailable(true);
          setUpdateVersion(update.version);
        }
      } catch {
        // Fail silently — offline or endpoint unreachable
      }
    })();
  }, []);

  const handleUpdate = useCallback(() => {
    void (async () => {
      try {
        const update = await check();
        if (!update) return;

        setUpdateDownloading(true);
        setUpdateProgress(0);

        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength ?? 0;
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              if (contentLength > 0) {
                setUpdateProgress(Math.round((downloaded / contentLength) * 100));
              }
              break;
            case "Finished":
              setUpdateProgress(100);
              break;
          }
        });

        await relaunch();
      } catch {
        setUpdateDownloading(false);
        setUpdateProgress(0);
      }
    })();
  }, []);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    void (async () => {
      unlisteners.push(
        await listen("strava:sync:start", () => {
          setSyncActive(true);
          setSyncProgress("Starting sync...");
          setSyncResult(null);
          setSyncMessage("");
        }),
        await listen<{ current: number; total: number }>("strava:sync:progress", (e) => {
          setSyncProgress(`Syncing: ${String(e.payload.current)} activities`);
        }),
        await listen<{ new_count: number; total_count: number }>("strava:sync:complete", (e) => {
          setSyncActive(false);
          setSyncResult("success");
          setSyncMessage(
            e.payload.new_count > 0
              ? `Synced ${String(e.payload.new_count)} new activities (${String(e.payload.total_count)} total)`
              : `Up to date (${String(e.payload.total_count)} activities)`,
          );
          setTimeout(() => { setSyncResult(null); }, 3000);
        }),
        await listen<{ message: string }>("strava:sync:error", (e) => {
          setSyncActive(false);
          setSyncResult("error");
          setSyncMessage(e.payload.message);
        }),
      );
    })();

    return () => { for (const u of unlisteners) u(); };
  }, []);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    void (async () => {
      unlisteners.push(
        await listen("plan:generate:start", () => {
          setPlanGenerating(true);
          setPlanProgress("Starting plan generation...");
          setPlanResult(null);
          setPlanError("");
        }),
        await listen<{ status: string }>("plan:generate:progress", (event) => {
          setPlanProgress(event.payload.status);
        }),
        await listen("plan:generate:complete", () => {
          setPlanGenerating(false);
          setPlanResult("success");
          setPlanProgress("Plan generated!");
          setTimeout(() => { setPlanResult(null); }, 3000);
        }),
        await listen<{ message: string }>("plan:generate:error", (event) => {
          setPlanGenerating(false);
          setPlanResult("error");
          setPlanError(event.payload.message);
          setPlanProgress("");
        }),
      );
    })();

    return () => { for (const u of unlisteners) u(); };
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      setChatStatus("idle");
    }
  }, [activeTab]);

  const handleChatStatusChange = useCallback((status: ChatStatus, detail?: string) => {
    setChatStatus(status);
    if (detail) {
      setChatProgress(detail);
    }
    if (status === "idle" || status === "replied") {
      setChatProgress("");
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setActiveTab("context");
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setActiveTab("chat");
        setTimeout(() => {
          document.getElementById("chat-input")?.focus();
        }, 50);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setActiveTab("chat");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => { window.removeEventListener("keydown", handleGlobalKeyDown); };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <div style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          padding: "12px 0",
        }}>
          <div style={{ padding: "8px 16px 20px" }}>
            <div className="skeleton" style={{ width: 90, height: 20 }} />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ padding: "10px 16px", margin: "2px 8px" }}>
              <div className="skeleton" style={{ width: "80%", height: 16 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24 }}>
          <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 20 }} />
          <div className="skeleton" style={{ width: "100%", height: 120, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: "60%", height: 16, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: "40%", height: 16 }} />
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const navItems: NavItem[] = [
    { id: "chat", label: "Chat", icon: <MessageSquare size={20} /> },
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { id: "context", label: "Context", icon: <Brain size={20} /> },
    { id: "plan", label: "Plans", icon: <Calendar size={20} /> },
    { id: "shoes", label: "Shoes", icon: <Zap size={20} /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon size={20} /> },
  ];

  const showBanner = activeTab !== "chat" && chatStatus !== "idle";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <nav
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "12px 0",
        }}
      >
        <div
          style={{
            padding: "8px 16px 20px",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          CoachLM
        </div>
        {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); }}
              aria-current={activeTab === item.id ? "page" : undefined}
               style={{
                 display: "flex",
                 alignItems: "center",
                 gap: 10,
                 padding: "10px 16px",
                 margin: "2px 8px",
                 borderRadius: 4,
                 background: activeTab === item.id ? "var(--bg-hover)" : "transparent",
                 color: activeTab === item.id ? "var(--text-primary)" : "var(--text-secondary)",
                 border: "none",
                 cursor: "pointer",
                 fontSize: 14,
                 fontWeight: activeTab === item.id ? 600 : 400,
                 textAlign: "left",
                 width: "calc(100% - 16px)",
                 transition: "background 0.15s, color 0.15s",
               }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
      </nav>

      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {showBanner && (
          <button
            className={`chat-banner ${chatStatus === "thinking" ? "chat-banner-thinking" : "chat-banner-replied"}`}
            onClick={() => { setActiveTab("chat"); }}
            type="button"
          >
            <MessageSquare size={14} />
            <span style={{ flex: 1 }}>
              {chatStatus === "thinking" ? (chatProgress || "Coach is thinking...") : "Coach has replied"}
            </span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Go to Chat</span>
          </button>
        )}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: activeTab === "chat" ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          <Chat onStatusChange={handleChatStatusChange} />
        </div>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "context" && <Context />}
        {activeTab === "plan" && <TrainingPlanPage />}
        {activeTab === "shoes" && <ShoeCalculator />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {(planGenerating || planResult) && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 200,
          background: "var(--bg-secondary)",
          border: `1px solid ${planResult === "error" ? "var(--danger)" : planResult === "success" ? "var(--success)" : "var(--border)"}`,
          padding: "14px 20px",
          minWidth: 280,
          maxWidth: 400,
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 4px 24px #000000",
        }}>
          {planGenerating && <RefreshCw size={18} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />}
          {planResult === "success" && <Check size={18} style={{ color: "var(--success)", flexShrink: 0 }} />}
          {planResult === "error" && <X size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: planResult === "error" ? 4 : 0 }}>
              {planGenerating ? "Generating Plan" : planResult === "success" ? "Plan Generated" : "Plan Generation Failed"}
            </div>
            {planGenerating && planProgress && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{planProgress}</div>
            )}
            {planResult === "error" && planError && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{planError}</div>
            )}
          </div>
          {planResult && (
            <button
              className="btn-ghost"
              onClick={() => { setPlanResult(null); setPlanError(""); }}
              style={{ flexShrink: 0, padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {(syncActive || syncResult) && (
        <div style={{
          position: "fixed",
          bottom: (planGenerating || planResult) ? 90 : 24,
          right: 24,
          zIndex: 200,
          background: "var(--bg-secondary)",
          border: `1px solid ${syncResult === "error" ? "var(--danger)" : syncResult === "success" ? "var(--success)" : "var(--border)"}`,
          padding: "14px 20px",
          minWidth: 280,
          maxWidth: 400,
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 4px 24px #000000",
          transition: "bottom 0.2s ease",
        }}>
          {syncActive && <RefreshCw size={18} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />}
          {syncResult === "success" && <Check size={18} style={{ color: "var(--success)", flexShrink: 0 }} />}
          {syncResult === "error" && <CloudDownload size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: syncResult === "error" ? 4 : 0 }}>
              {syncActive ? "Syncing Strava" : syncResult === "success" ? "Strava Sync Complete" : "Strava Sync Failed"}
            </div>
            {syncActive && syncProgress && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{syncProgress}</div>
            )}
            {syncResult && syncMessage && (
              <div style={{ fontSize: 12, color: syncResult === "error" ? "var(--danger)" : "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{syncMessage}</div>
            )}
          </div>
          {syncResult && (
            <button
              className="btn-ghost"
              onClick={() => { setSyncResult(null); setSyncMessage(""); }}
              style={{ flexShrink: 0, padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {updateAvailable && (
        <div style={{
          position: "fixed",
          bottom: (syncActive || syncResult) ? ((planGenerating || planResult) ? 156 : 90) : (planGenerating || planResult) ? 90 : 24,
          right: 24,
          zIndex: 200,
          background: "var(--bg-secondary)",
          border: "1px solid var(--accent)",
          padding: "14px 20px",
          minWidth: 280,
          maxWidth: 400,
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 4px 24px #000000",
          transition: "bottom 0.2s ease",
        }}>
          {updateDownloading
            ? <RefreshCw size={18} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
            : <Download size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {updateDownloading ? "Downloading Update" : `Update Available: v${updateVersion}`}
            </div>
            {updateDownloading ? (
              <div style={{ marginTop: 6 }}>
                <div style={{
                  height: 4,
                  background: "var(--bg-primary)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${String(updateProgress)}%`,
                    background: "var(--accent)",
                    borderRadius: 2,
                    transition: "width 0.2s ease",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {`${String(updateProgress)}%`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Click install to update and restart
              </div>
            )}
          </div>
          {!updateDownloading && (
            <>
              <button
                className="btn-ghost"
                onClick={handleUpdate}
                style={{ flexShrink: 0, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}
              >
                Install
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setUpdateAvailable(false); }}
                style={{ flexShrink: 0, padding: 4 }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
