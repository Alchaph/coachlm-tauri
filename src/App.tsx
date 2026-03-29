import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { MessageSquare, LayoutDashboard, Brain, Calendar, Settings as SettingsIcon, RefreshCw, X, Check, Zap, CloudDownload, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import Chat from "./components/chat";
import Dashboard from "./components/dashboard";
import Context from "./components/Context";
import SettingsPage from "./components/Settings";
import TrainingPlanPage from "./components/TrainingPlan";
import ShoeCalculator from "./components/ShoeCalculator";
import Onboarding from "./components/Onboarding";

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
            invoke("sync_strava_activities").catch(() => undefined);
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
        // expected when offline or endpoint unreachable
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
    const state = { cancelled: false };
    const unlisteners: (() => void)[] = [];

    void (async () => {
      const fns = await Promise.all([
        listen("strava:sync:start", () => {
          if (state.cancelled) return;
          setSyncActive(true);
          setSyncProgress("Starting sync...");
          setSyncResult(null);
          setSyncMessage("");
        }),
        listen<{ current: number; total: number }>("strava:sync:progress", (e) => {
          if (state.cancelled) return;
          setSyncProgress(`Syncing: ${String(e.payload.current)} activities`);
        }),
        listen<{ new_count: number; total_count: number }>("strava:sync:complete", (e) => {
          if (state.cancelled) return;
          setSyncActive(false);
          setSyncResult("success");
          setSyncMessage(
            e.payload.new_count > 0
              ? `Synced ${String(e.payload.new_count)} new activities (${String(e.payload.total_count)} total)`
              : `Up to date (${String(e.payload.total_count)} activities)`,
          );
          setTimeout(() => { setSyncResult(null); }, 3000);
        }),
        listen<{ message: string }>("strava:sync:error", (e) => {
          if (state.cancelled) return;
          setSyncActive(false);
          setSyncResult("error");
          setSyncMessage(e.payload.message);
          setTimeout(() => { setSyncResult(null); }, 8000);
        }),
      ]);
      if (state.cancelled) {
        for (const fn of fns) fn();
      } else {
        unlisteners.push(...fns);
      }
    })();

    return () => { state.cancelled = true; for (const u of unlisteners) u(); };
  }, []);

  useEffect(() => {
    const state = { cancelled: false };
    const unlisteners: (() => void)[] = [];

    void (async () => {
      const fns = await Promise.all([
        listen("plan:generate:start", () => {
          if (state.cancelled) return;
          setPlanGenerating(true);
          setPlanProgress("Starting plan generation...");
          setPlanResult(null);
          setPlanError("");
        }),
        listen<{ status: string }>("plan:generate:progress", (event) => {
          if (state.cancelled) return;
          setPlanProgress(event.payload.status);
        }),
        listen("plan:generate:complete", () => {
          if (state.cancelled) return;
          setPlanGenerating(false);
          setPlanResult("success");
          setPlanProgress("Plan generated!");
          setTimeout(() => { setPlanResult(null); }, 3000);
        }),
        listen<{ message: string }>("plan:generate:error", (event) => {
          if (state.cancelled) return;
          setPlanGenerating(false);
          setPlanResult("error");
          setPlanError(event.payload.message);
          setPlanProgress("");
        }),
      ]);
      if (state.cancelled) {
        for (const fn of fns) fn();
      } else {
        unlisteners.push(...fns);
      }
    })();

    return () => { state.cancelled = true; for (const u of unlisteners) u(); };
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
      <div className="flex h-screen overflow-hidden">
        <div className="w-[220px] min-w-[220px] bg-card border-r border-sidebar-border py-4">
          <div className="px-5 pb-6 pt-1">
            <Skeleton className="h-5 w-[100px]" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="px-[22px] py-2 my-0.5">
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-7">
          <Skeleton className="h-6 w-[200px] mb-6" />
          <Skeleton className="h-[120px] w-full mb-5 rounded-md" />
          <Skeleton className="h-4 w-3/5 mb-3" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const mainNavItems: NavItem[] = [
    { id: "chat", label: "Chat", icon: <MessageSquare size={18} /> },
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "context", label: "Context", icon: <Brain size={18} /> },
    { id: "plan", label: "Plans", icon: <Calendar size={18} /> },
    { id: "shoes", label: "Shoes", icon: <Zap size={18} /> },
  ];

  const bottomNavItems: NavItem[] = [
    { id: "settings", label: "Settings", icon: <SettingsIcon size={18} /> },
  ];

  const showBanner = activeTab !== "chat" && chatStatus !== "idle";

  const renderNavButton = (item: NavItem) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { setActiveTab(item.id); }}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] text-left transition-colors duration-150",
          isActive
            ? "bg-accent text-foreground font-semibold"
            : "text-muted-foreground hover:bg-accent hover:text-foreground font-normal"
        )}
      >
        <div className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-sm transition-colors duration-150",
          isActive ? "bg-primary/15 text-primary" : "text-inherit"
        )}>
          {item.icon}
        </div>
        {item.label}
      </button>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="flex w-[220px] min-w-[220px] flex-col bg-card border-r border-sidebar-border pt-4 pb-3">
        <div className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2">
          {mainNavItems.map(renderNavButton)}
        </div>

        <div className="mx-2.5 border-t border-sidebar-border pt-2">
          {bottomNavItems.map(renderNavButton)}
        </div>
      </nav>

      <main className="flex flex-1 flex-col overflow-hidden">
        {showBanner && (
          <button
            className={cn(
              "flex w-full items-center gap-2.5 border-b border-border px-5 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-secondary",
              chatStatus === "thinking"
                ? "text-muted-foreground border-l-[3px] border-l-muted-foreground bg-card animate-pulse"
                : "text-primary border-l-[3px] border-l-primary font-medium bg-card"
            )}
            onClick={() => { setActiveTab("chat"); }}
            type="button"
          >
            <MessageSquare size={14} />
            <span className="flex-1">
              {chatStatus === "thinking" ? (chatProgress || "Coach is thinking...") : "Coach has replied"}
            </span>
            <span className="text-xs opacity-70">Go to Chat</span>
          </button>
        )}
        <div className={cn(
          "flex-1 overflow-hidden flex-col",
          activeTab === "chat" ? "flex" : "hidden"
        )}>
          <Chat onStatusChange={handleChatStatusChange} />
        </div>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "context" && <Context />}
        {activeTab === "plan" && <TrainingPlanPage />}
        {activeTab === "shoes" && <ShoeCalculator />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {(planGenerating || planResult) && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[200] flex min-w-[280px] max-w-[400px] items-center gap-3 rounded-md bg-card px-5 py-3.5 shadow-lg border",
          planResult === "error" ? "border-destructive" : planResult === "success" ? "border-success" : "border-border"
        )}>
          {planGenerating && <RefreshCw size={18} className="animate-spin shrink-0 text-primary" />}
          {planResult === "success" && <Check size={18} className="shrink-0 text-success" />}
          {planResult === "error" && <X size={18} className="shrink-0 text-destructive" />}
          <div className="flex-1 min-w-0">
            <div className={cn("text-[13px] font-semibold", planResult === "error" && "mb-1")}>
              {planGenerating ? "Generating Plan" : planResult === "success" ? "Plan Generated" : "Plan Generation Failed"}
            </div>
            {planGenerating && planProgress && (
              <div className="text-xs text-muted-foreground mt-0.5">{planProgress}</div>
            )}
            {planResult === "error" && planError && (
              <div className="text-xs text-destructive mt-0.5 truncate">{planError}</div>
            )}
          </div>
          {planResult && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Dismiss plan notification"
              onClick={() => { setPlanResult(null); setPlanError(""); }}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      )}

      {(syncActive || syncResult) && (
        <div className={cn(
          "fixed right-6 z-[200] flex min-w-[280px] max-w-[400px] items-center gap-3 rounded-md bg-card px-5 py-3.5 shadow-lg border transition-all duration-250",
          syncResult === "error" ? "border-destructive" : syncResult === "success" ? "border-success" : "border-border",
          (planGenerating || planResult) ? "bottom-[90px]" : "bottom-6"
        )}>
          {syncActive && <RefreshCw size={18} className="animate-spin shrink-0 text-primary" />}
          {syncResult === "success" && <Check size={18} className="shrink-0 text-success" />}
          {syncResult === "error" && <CloudDownload size={18} className="shrink-0 text-destructive" />}
          <div className="flex-1 min-w-0">
            <div className={cn("text-[13px] font-semibold", syncResult === "error" && "mb-1")}>
              {syncActive ? "Syncing Strava" : syncResult === "success" ? "Strava Sync Complete" : "Strava Sync Failed"}
            </div>
            {syncActive && syncProgress && (
              <div className="text-xs text-muted-foreground mt-0.5">{syncProgress}</div>
            )}
            {syncResult && syncMessage && (
              <div className={cn("text-xs mt-0.5 truncate", syncResult === "error" ? "text-destructive" : "text-muted-foreground")}>{syncMessage}</div>
            )}
          </div>
          {syncResult && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Dismiss sync notification"
              onClick={() => { setSyncResult(null); setSyncMessage(""); }}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      )}

      {updateAvailable && (
        <div className={cn(
          "fixed right-6 z-[200] flex min-w-[280px] max-w-[400px] items-center gap-3 rounded-md bg-card border border-primary px-5 py-3.5 shadow-lg transition-all duration-250",
          (syncActive || syncResult)
            ? (planGenerating || planResult) ? "bottom-[156px]" : "bottom-[90px]"
            : (planGenerating || planResult) ? "bottom-[90px]" : "bottom-6"
        )}>
          {updateDownloading
            ? <RefreshCw size={18} className="animate-spin shrink-0 text-primary" />
            : <Download size={18} className="shrink-0 text-primary" />}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">
              {updateDownloading ? "Downloading Update" : `Update Available: v${updateVersion}`}
            </div>
            {updateDownloading ? (
              <div className="mt-1.5">
                <Progress value={updateProgress} className="h-1" />
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {`${String(updateProgress)}%`}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-0.5">
                Click install to update and restart
              </div>
            )}
          </div>
          {!updateDownloading && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs font-semibold text-primary"
                onClick={handleUpdate}
              >
                Install
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                aria-label="Dismiss update notification"
                onClick={() => { setUpdateAvailable(false); }}
              >
                <X size={14} />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
