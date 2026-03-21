import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardList, Calendar } from "lucide-react";
import PlanCreator from "./PlanCreator";
import PlanCalendar from "./PlanCalendar";
import type { TrainingPlan } from "./types";

type SubTab = "plans" | "schedule";

export default function TrainingPlanPage() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("plans");

  useEffect(() => {
    void (async () => {
      try {
        await invoke<TrainingPlan>("get_active_plan");
        setActiveSubTab("schedule");
      } catch {
        // empty catch: no active plan means we stay on default "plans" tab
      }
    })();
  }, []);

  const handlePlanGenerated = () => {
    setActiveSubTab("schedule");
  };

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: "plans", label: "My Plans", icon: <ClipboardList size={14} /> },
    { id: "schedule", label: "Schedule", icon: <Calendar size={14} /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
        }}
      >
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              background: "transparent",
              color: activeSubTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeSubTab === tab.id ? 600 : 400,
              fontSize: 13,
              border: "none",
              borderRadius: 0,
              borderBottom: activeSubTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {activeSubTab === "plans" && <PlanCreator onPlanGenerated={handlePlanGenerated} />}
        {activeSubTab === "schedule" && <PlanCalendar onPlanGenerated={handlePlanGenerated} />}
      </div>
    </div>
  );
}
