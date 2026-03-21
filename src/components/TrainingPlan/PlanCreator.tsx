import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Plus, Trash2, Trophy, Calendar, Pencil, Check } from "lucide-react";
import type { Race, TrainingPlanSummary } from "./types";
import { formatGoalTime, getWeeksToRace } from "./types";

export default function PlanCreator({ onPlanGenerated }: { onPlanGenerated: () => void }) {
  const [races, setRaces] = useState<Race[]>([]);
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    let cleanup: (() => void) | undefined;
    void (async () => {
      cleanup = await listen("plan:generate:complete", () => {
        void loadData();
        onPlanGenerated();
      });
    })();
    return () => { cleanup?.(); };
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

  return (
    <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Race Goals</h1>
        <button className="btn-primary" onClick={() => { resetRaceForm(); setShowAddRace(true); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> Add Race
        </button>
      </div>

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      {showAddRace && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{editingRaceId ? "Edit Race Goal" : "New Race Goal"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="raceName">Race Name</label>
              <input id="raceName" type="text" value={raceName} onChange={e => { setRaceName(e.target.value); }} style={{ width: "100%" }} placeholder="e.g. Berlin Marathon" />
            </div>
            <div>
              <label htmlFor="raceDate">Date</label>
              <input id="raceDate" type="date" value={raceDate} onChange={e => { setRaceDate(e.target.value); }} style={{ width: "100%" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Distance</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[5, 10, 21.1, 42.2, 50].map(d => (
                  <button key={d} className={raceDistance === d ? "btn-primary" : "btn-secondary"} onClick={() => { setRaceDistance(d); }}>
                    {d === 21.1 ? "Half" : d === 42.2 ? "Marathon" : d === 50 ? "Ultra" : `${String(d)}K`}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input id="customDistance" type="number" value={raceDistance} onChange={e => { setRaceDistance(parseFloat(e.target.value)); }} style={{ width: 100 }} step="0.1" />
                <span style={{ color: "var(--text-secondary)" }}>km</span>
              </div>
            </div>
            <div>
              <label htmlFor="raceTerrain">Terrain</label>
              <select id="raceTerrain" value={raceTerrain} onChange={e => { setRaceTerrain(e.target.value); }} style={{ width: "100%" }}>
                <option value="road">Road</option>
                <option value="trail">Trail</option>
                <option value="track">Track</option>
              </select>
            </div>
            <div>
              <label htmlFor="raceElevation">Elevation Gain (m)</label>
              <input id="raceElevation" type="number" value={raceElevation} onChange={e => { setRaceElevation(e.target.value); }} style={{ width: "100%" }} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="raceGoalTime">Goal Time</label>
              <input id="raceGoalTime" type="text" value={raceGoalTime} onChange={e => { setRaceGoalTime(e.target.value); }} style={{ width: "100%" }} placeholder="h:mm:ss (Optional)" />
            </div>
            <div>
              <label>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["A", "B", "C"].map(p => (
                  <button key={p} className={racePriority === p ? "btn-primary" : "btn-secondary"} onClick={() => { setRacePriority(p); }} style={{ flex: 1 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn-ghost" onClick={() => { resetRaceForm(); }}>Cancel</button>
            <button className="btn-primary" onClick={() => { void handleSaveRace(); }}>{editingRaceId ? "Update Race" : "Save Race"}</button>
          </div>
        </div>
      )}

      {races.length === 0 && !showAddRace ? (
        <div className="empty-state">
          <Trophy size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>No races planned yet.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Add a race goal to generate a personalized training plan.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {races.map(race => (
            <div key={race.id} className="card" style={{ border: race.is_active ? "2px solid var(--accent)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{race.name}</h3>
                     {race.is_active && <span style={{ background: "var(--accent)", color: "white", padding: "2px 6px", borderRadius: 0, fontSize: 10, fontWeight: 600 }}>ACTIVE</span>}
                     <span style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 0, fontSize: 10 }}>{race.priority} Race</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13, display: "flex", gap: 16, marginBottom: 12 }}>
                    <span>{new Date(race.race_date).toLocaleDateString()} ({getWeeksToRace(race.race_date)} weeks)</span>
                    <span>{race.distance_km} km &bull; {race.terrain}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!race.is_active && (
                    <button className="btn-secondary" onClick={() => { void handleSetActiveRace(race.id); }}>Set Active</button>
                  )}
                  <button className="btn-ghost" onClick={() => { startEditRace(race); }} title="Edit race">
                    <Pencil size={16} />
                  </button>
                  <button className="btn-ghost" onClick={() => { void handleDeleteRace(race.id); }} style={{ color: "var(--danger)" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {race.is_active && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <button className="btn-primary" onClick={() => { void handleGeneratePlan(race.id); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={16} /> Generate Training Plan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {plans.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Training Plans</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {plans.map(p => {
              const progress = p.total_sessions > 0 ? (p.completed_sessions / p.total_sessions) * 100 : 0;
              return (
                <div key={p.id} className="card" style={{ border: p.is_active ? "2px solid var(--accent)" : "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{p.race_name}</h3>
                       {p.is_active && <span style={{ background: "var(--accent)", color: "white", padding: "2px 6px", borderRadius: 0, fontSize: 10, fontWeight: 600 }}>ACTIVE</span>}
                    </div>
                    {!p.is_active && (
                      <button className="btn-secondary" onClick={() => { void handleSetActivePlan(p.id); }} style={{ fontSize: 12 }}>Set Active</button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    Generated {new Date(p.generated_at).toLocaleDateString()}
                  </div>
                   <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                     <div style={{ flex: 1, height: 6, background: "var(--bg-tertiary)", borderRadius: 0, overflow: "hidden" }}>
                       <div style={{ width: `${String(progress)}%`, height: "100%", background: "var(--success)", borderRadius: 0, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                      <Check size={12} />
                      {p.completed_sessions}/{p.total_sessions}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
