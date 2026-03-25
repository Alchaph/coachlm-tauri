import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { Plus, Trash2, Trophy, Calendar, Pencil, Check } from "lucide-react";
import type { Race, TrainingPlanSummary } from "./types";
import { formatGoalTime, getWeeksToRace } from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export default function PlanCreator({ onPlanGenerated }: { onPlanGenerated: () => void }) {
  const [races, setRaces] = useState<Race[]>([]);
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const [showAddRace, setShowAddRace] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [raceName, setRaceName] = useState("");
  const [raceDistance, setRaceDistance] = useState<number>(21.1);
  const [raceDate, setRaceDate] = useState("");
  const [raceTerrain, setRaceTerrain] = useState("road");
  const [raceElevation, setRaceElevation] = useState("");
  const [raceGoalTime, setRaceGoalTime] = useState("");
  const [racePriority, setRacePriority] = useState("A");

  const loadData = useCallback(async () => {
    try {
      const [loadedRaces, loadedPlans] = await Promise.all([
        invoke<Race[]>("list_races"),
        invoke<TrainingPlanSummary[]>("list_plans"),
      ]);
      setRaces(loadedRaces);
      setPlans(loadedPlans);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const state = { cancelled: false };
    const cleanups: (() => void)[] = [];
    void (async () => {
      const fns = await Promise.all([
        listen("plan:generate:start", () => {
          if (state.cancelled) return;
          setIsGenerating(true);
          setProgressMessage("Starting plan generation...");
          setError(null);
        }),
        listen<{ status: string }>("plan:generate:progress", (event) => {
          if (state.cancelled) return;
          setProgressMessage(event.payload.status);
        }),
        listen("plan:generate:complete", () => {
          if (state.cancelled) return;
          setIsGenerating(false);
          setProgressMessage("");
          void loadData();
          onPlanGenerated();
        }),
        listen<{ message: string }>("plan:generate:error", (event) => {
          if (state.cancelled) return;
          setIsGenerating(false);
          setProgressMessage("");
          setError(event.payload.message);
        }),
      ]);
      if (state.cancelled) {
        for (const fn of fns) fn();
      } else {
        cleanups.push(...fns);
      }
    })();
    return () => { state.cancelled = true; for (const fn of cleanups) fn(); };
  }, [loadData, onPlanGenerated]);

  const resetRaceForm = () => {
    setShowAddRace(false);
    setEditingRaceId(null);
    setRaceName("");
    setRaceDistance(21.1);
    setRaceDate("");
    setRaceTerrain("road");
    setRaceElevation("");
    setRaceGoalTime("");
    setRacePriority("A");
  };

  const startEditRace = (race: Race) => {
    setEditingRaceId(race.id);
    setShowAddRace(true);
    setRaceName(race.name);
    setRaceDistance(race.distance_km);
    setRaceDate(race.race_date);
    setRaceTerrain(race.terrain);
    setRaceElevation(race.elevation_m !== null ? String(race.elevation_m) : "");
    setRaceGoalTime(race.goal_time_s !== null ? formatGoalTime(race.goal_time_s) : "");
    setRacePriority(race.priority);
  };

  const handleSaveRace = async () => {
    if (!raceName || !raceDate) {
      setError("Name and Date are required");
      return;
    }

    if (!editingRaceId) {
      const dateObj = new Date(raceDate);
      if (dateObj < new Date()) {
        setError("Race date must be in the future");
        return;
      }
      const twelveMonthsOut = new Date();
      twelveMonthsOut.setMonth(twelveMonthsOut.getMonth() + 12);
      if (dateObj > twelveMonthsOut) {
        setError("Race date is more than 12 months away. The plan will be capped at 26 weeks of training.");
        return;
      }
    }

    let goalTimeS: number | null = null;
    if (raceGoalTime) {
      const parts = raceGoalTime.split(":");
      if (parts.length === 3) {
        goalTimeS = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        goalTimeS = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
      if (goalTimeS !== null) {
        const minSeconds = 10 * 60;
        const maxSeconds = raceDistance >= 42 ? 10 * 3600 : raceDistance >= 30 ? 24 * 3600 : 6 * 3600;
        if (goalTimeS < minSeconds) {
          setError("Goal time must be at least 10 minutes");
          return;
        }
        if (goalTimeS > maxSeconds) {
          setError(`Goal time seems unreasonably long for this distance`);
          return;
        }
      }
    }

    try {
      if (editingRaceId) {
        const existingRace = races.find(r => r.id === editingRaceId);
        await invoke("update_race", {
          race: {
            id: editingRaceId,
            name: raceName,
            distance_km: raceDistance,
            race_date: raceDate,
            terrain: raceTerrain,
            elevation_m: raceElevation ? parseInt(raceElevation) : null,
            goal_time_s: goalTimeS,
            priority: racePriority,
            is_active: existingRace?.is_active ?? false,
            created_at: existingRace?.created_at ?? "",
          },
        });
      } else {
        await invoke("create_race", {
          race: {
            id: "",
            name: raceName,
            distance_km: raceDistance,
            race_date: raceDate,
            terrain: raceTerrain,
            elevation_m: raceElevation ? parseInt(raceElevation) : null,
            goal_time_s: goalTimeS,
            priority: racePriority,
            is_active: false,
            created_at: "",
          },
        });
      }
      resetRaceForm();
      void loadData();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetActiveRace = async (id: string) => {
    try {
      await invoke("set_active_race", { id });
      void loadData();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteRace = async (id: string) => {
    const confirmed = await ask("Delete this race? This will also remove any associated training plans.", { title: "CoachLM", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("delete_race", { id });
      void loadData();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleGeneratePlan = async (raceId: string) => {
    setError(null);
    try {
      await invoke("generate_plan_cmd", { raceId });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetActivePlan = async (planId: string) => {
    try {
      await invoke("set_active_plan", { planId });
      void loadData();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await invoke("delete_plan", { planId });
      void loadData();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold">Race Goals</h1>
        <Button onClick={() => { resetRaceForm(); setShowAddRace(true); }} className="flex items-center gap-1.5">
          <Plus size={16} /> Add Race
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {showAddRace && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-base font-semibold mb-4">{editingRaceId ? "Edit Race Goal" : "New Race Goal"}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="raceName">Race Name</Label>
                <Input id="raceName" type="text" value={raceName} onChange={e => { setRaceName(e.target.value); }} className="w-full" placeholder="e.g. Berlin Marathon" />
              </div>
              <div>
                <Label htmlFor="raceDate">Date</Label>
                <Input id="raceDate" type="date" value={raceDate} onChange={e => { setRaceDate(e.target.value); }} className="w-full" />
              </div>
              <div className="col-span-2">
                <Label>Distance</Label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {[5, 10, 21.1, 42.2, 50].map(d => (
                    <Button key={d} variant={raceDistance === d ? "default" : "secondary"} onClick={() => { setRaceDistance(d); }}>
                      {d === 21.1 ? "Half" : d === 42.2 ? "Marathon" : d === 50 ? "Ultra" : `${String(d)}K`}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input id="customDistance" type="number" value={raceDistance} onChange={e => { setRaceDistance(parseFloat(e.target.value)); }} className="w-24" step="0.1" />
                  <span className="text-muted-foreground">km</span>
                </div>
              </div>
              <div>
                <Label>Terrain</Label>
                <Select value={raceTerrain} onValueChange={(v) => { if (v !== null) setRaceTerrain(v); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="trail">Trail</SelectItem>
                    <SelectItem value="track">Track</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="raceElevation">Elevation Gain (m)</Label>
                <Input id="raceElevation" type="number" value={raceElevation} onChange={e => { setRaceElevation(e.target.value); }} className="w-full" placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="raceGoalTime">Goal Time</Label>
                <Input id="raceGoalTime" type="text" value={raceGoalTime} onChange={e => { setRaceGoalTime(e.target.value); }} className="w-full" placeholder="h:mm:ss (Optional)" />
              </div>
              <div>
                <Label>Priority</Label>
                <div className="flex gap-2">
                  {["A", "B", "C"].map(p => (
                    <Button key={p} variant={racePriority === p ? "default" : "secondary"} onClick={() => { setRacePriority(p); }} className="flex-1">
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { resetRaceForm(); }}>Cancel</Button>
              <Button onClick={() => { void handleSaveRace(); }}>{editingRaceId ? "Update Race" : "Save Race"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {races.length === 0 && !showAddRace ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Trophy size={48} className="mx-auto mb-4 opacity-30" />
          <p>No races planned yet.</p>
          <p className="text-xs mt-2">Add a race goal to generate a personalized training plan.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {races.map(race => (
            <Card key={race.id} className={cn(race.is_active ? "border-2 border-primary" : "border border-border")}>
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold">{race.name}</h3>
                      {race.is_active && <Badge className="bg-primary text-primary-foreground text-[10px]">ACTIVE</Badge>}
                      <Badge variant="secondary" className="text-[10px]">{race.priority} Race</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-4 mb-3">
                      <span>{new Date(race.race_date).toLocaleDateString()} ({getWeeksToRace(race.race_date)} weeks)</span>
                      <span>{race.distance_km} km &bull; {race.terrain}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!race.is_active && (
                      <Button variant="secondary" size="sm" onClick={() => { void handleSetActiveRace(race.id); }}>Set Active</Button>
                    )}
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="sm" aria-label="Edit race" onClick={() => { startEditRace(race); }}><Pencil size={16} /></Button>} />
                      <TooltipContent>Edit race</TooltipContent>
                    </Tooltip>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { void handleDeleteRace(race.id); }}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                {race.is_active && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button onClick={() => { void handleGeneratePlan(race.id); }} disabled={isGenerating} className="flex items-center gap-1.5">
                      <Calendar size={16} /> Generate Training Plan
                    </Button>
                    {isGenerating && progressMessage && (
                      <div className="mt-2 text-xs text-muted-foreground">{progressMessage}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {plans.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Training Plans</h2>
          <div className="flex flex-col gap-3">
            {plans.map(p => {
              const progress = p.total_sessions > 0 ? (p.completed_sessions / p.total_sessions) * 100 : 0;
              return (
                <Card key={p.id} className={cn(p.is_active ? "border-2 border-primary" : "border border-border")}>
                  <CardContent>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold">{p.race_name}</h3>
                        {p.is_active && <Badge className="bg-primary text-primary-foreground text-[10px]">ACTIVE</Badge>}
                      </div>
                      <div className="flex gap-2">
                        {!p.is_active && (
                          <Button variant="secondary" size="sm" onClick={() => { void handleSetActivePlan(p.id); }}>Set Active</Button>
                        )}
                        <Tooltip>
                          <TooltipTrigger render={<Button variant="ghost" size="sm" className="text-destructive" aria-label="Delete plan" onClick={() => { void handleDeletePlan(p.id); }}><Trash2 size={16} /></Button>} />
                          <TooltipContent>Delete plan</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2.5">
                      Generated {new Date(p.generated_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="bg-secondary rounded-sm h-1.5 overflow-hidden flex-1">
                        <div className="bg-success rounded-sm h-full transition-[width] duration-300" style={{ width: `${String(progress)}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Check size={12} />
                        {p.completed_sessions}/{p.total_sessions}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
