import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardList, Calendar } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
        // no active plan — stay on default "plans" tab
      }
    })();
  }, []);

  const handlePlanGenerated = () => {
    setActiveSubTab("schedule");
  };

  return (
    <Tabs
      value={activeSubTab}
      onValueChange={(v) => { setActiveSubTab(v as SubTab); }}
      className="flex flex-col h-full gap-0"
    >
      <TabsList variant="line" className="w-full justify-start rounded-none border-b border-border bg-card px-4">
        <TabsTrigger value="plans" className="gap-1.5 text-sm">
          <ClipboardList size={14} />
          My Plans
        </TabsTrigger>
        <TabsTrigger value="schedule" className="gap-1.5 text-sm">
          <Calendar size={14} />
          Schedule
        </TabsTrigger>
      </TabsList>

      <TabsContent value="plans" className="flex-1 overflow-auto">
        <PlanCreator onPlanGenerated={handlePlanGenerated} />
      </TabsContent>
      <TabsContent value="schedule" className="flex-1 overflow-auto">
        <PlanCalendar onPlanGenerated={handlePlanGenerated} />
      </TabsContent>
    </Tabs>
  );
}
