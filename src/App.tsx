import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MessageSquare, LayoutDashboard, Brain, Calendar, Settings as SettingsIcon, RefreshCw, X, Check, Zap, CloudDownload } from "lucide-react";
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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading...</div>
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
    </div>
  );
}
