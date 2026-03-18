import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MessageSquare, LayoutDashboard, Brain, Calendar, Settings as SettingsIcon } from "lucide-react";
import Chat from "./components/Chat";
import Dashboard from "./components/Dashboard";
import Context from "./components/Context";
import SettingsPage from "./components/Settings";
import TrainingPlan from "./components/TrainingPlan";
import Onboarding from "./components/Onboarding";
import "./styles/global.css";
import "./styles/markdown.css";

type Tab = "chat" | "dashboard" | "context" | "plan" | "settings";

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const firstRun = await invoke<boolean>("is_first_run");
        setShowOnboarding(firstRun);
        const plan = await invoke("get_active_plan");
        setHasPlan(plan !== null);
      } catch {
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    })();
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
    { id: "plan", label: "Training Plan", icon: <Calendar size={20} />, hidden: !hasPlan },
    { id: "settings", label: "Settings", icon: <SettingsIcon size={20} /> },
  ];

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
        {navItems
          .filter((item) => !item.hidden)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                margin: "2px 8px",
                borderRadius: 6,
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
        {activeTab === "chat" && <Chat />}
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "context" && <Context />}
        {activeTab === "plan" && <TrainingPlan onPlanChange={setHasPlan} />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
